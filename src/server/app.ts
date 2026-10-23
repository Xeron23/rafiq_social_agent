import express, { Request, Response } from 'express';
import cors from 'cors';
import { Readable } from 'stream';
import { getMastraModel, streamTextSse } from '../infrastructure/ai/modelProvider.js';

// Domain & Repositories (PostgreSQL 15 DDD Infrastructure)
import { PostgresCampaignRepository } from '../infrastructure/repositories/postgres/postgresCampaignRepository.js';
import { PostgresPostRepository } from '../infrastructure/repositories/postgres/postgresPostRepository.js';
import { PostgresMemoryRepository } from '../infrastructure/repositories/postgres/postgresMemoryRepository.js';
import { PostgresBrandVoiceStore } from '../infrastructure/repositories/postgres/postgresBrandVoiceStore.js';
import { PostgresAuxiliaryService } from '../infrastructure/repositories/postgres/postgresAuxiliaryService.js';

// Application & Workflow Services (Mastra + DDD + Prompt Chaining)
import { CampaignWorkflowService } from '../application/services/campaignWorkflowService.js';
import { createHttpRouter } from '../interfaces/http/campaignController.js';
import { createMcpRouter } from '../interfaces/http/mcpRouter.js';
import { requireApiKey, rateLimit } from '../interfaces/http/authMiddleware.js';
import { createMcpHandler } from '../infrastructure/mcp/server.js';
import { createWebhookRouter } from '../interfaces/http/webhookController.js';
import { FastAckWorker } from '../application/services/fastAckWorker.js';
import { ChatOrchestratorAgent } from '../infrastructure/mastra/agents/chatOrchestratorAgent.js';
import { telegramNotifier } from '../infrastructure/telegram/telegramNotificationService.js';

// Legacy Services (Kept for backwards compatibility)
import { TenancyManager } from '../services/tenancyService.js';
import { CampaignStrategyService } from '../services/campaignStrategyService.js';
import { ContentPlanService } from '../services/contentPlanService.js';
import { CanonicalContentEngine } from '../services/canonicalContentService.js';
import { MultiPlatformAdapterEngine } from '../adapters/multiPlatformAdapters.js';
import { PublishingSchedulerService, ClosedLoopAnalyticsService } from '../services/publishingAndAnalyticsService.js';
import { ChatOrchestratorService } from '../services/chatOrchestratorService.js';

export function createServerApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // --- REQUEST TIMING & LATENCY LOGGER ---
  app.use((req, res, next) => {
    const start = performance.now();
    const timeStr = new Date().toLocaleTimeString('id-ID', { hour12: false });
    res.on('finish', () => {
      const duration = (performance.now() - start).toFixed(2);
      const status = res.statusCode;
      const color = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
      console.log(`[HTTP] ${timeStr} | ${req.method} ${req.originalUrl || req.url} | ${color}${status}\x1b[0m | ⏱️ ${duration}ms`);
    });
    next();
  });

  // --- REPOSITORIES & DATA STORES (POSTGRESQL 15 DDD INFRASTRUCTURE) ---
  const campaignRepo = new PostgresCampaignRepository();
  const postRepo = new PostgresPostRepository();
  const memoryRepo = new PostgresMemoryRepository();
  const brandVoiceStore = new PostgresBrandVoiceStore();
  const auxiliaryService = new PostgresAuxiliaryService();

  // --- WORKFLOW SERVICE (MASTRA v1.73 + PROMPT CHAINING) ---
  const campaignWorkflowService = new CampaignWorkflowService(
    campaignRepo,
    postRepo,
    memoryRepo,
    brandVoiceStore
  );

  // ── Phase 1: SSE Streaming Gateway ─────────────────────────────────
  // GET /api/campaigns/stream/:id
  // Wraps the Mastra workflow token stream in Server-Sent Events.
  // Route ini didefinisikan di sini (setelah /api router mount) karena
  // Express 5 mengevaluasi route secara berurutan. Route ini menentukan
  // pola /stream/* yang tidak pernah cocok dengan pola route router
  // /api/*, sehingga tidak akan tertangkap oleh legacy router.
  app.get('/api/campaigns/stream/:id', async (req: Request, res: Response) => {
    const campaignId = req.params.id || 'default';
    const modelName = process.env.DEFAULT_MODEL || 'jerouter';

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const onToken = (token: string) => {
      // Push each chunk as an SSE event
      const data = JSON.stringify({ token });
      res.write(`event: token\ndata: ${data}\n\n`);
    };

    const onStatus = (status: string) => {
      const data = JSON.stringify({ status });
      res.write(`event: status\ndata: ${data}\n\n`);
    };

    try {
      await streamTextSse(
        modelName,
        `Stream content for campaign ${campaignId}. Respond as a structured JSON object.`,
        onStatus,
        onToken
      );
      res.write(`event: done\ndata: [DONE]\n\n`);
      res.end();
    } catch (err: any) {
      console.error(`[SSE-Stream] Stream failed: ${err?.message}`);
      res.status(500).write(`event: error\ndata: ${JSON.stringify({ error: err?.message })}\n\n`);
      res.end();
    }
  });

  // Mount primary API router (Matches Next.js Prototype)
  const apiRouter = createHttpRouter(
    campaignWorkflowService,
    brandVoiceStore,
    postRepo,
    memoryRepo,
    auxiliaryService
  );
  app.use('/api', apiRouter);

  // ── MCP Tool-Calling Router (Phase 2) ───────────────────────────────
  const mcpRouter = createMcpRouter();
  app.use('/api/tools', mcpRouter);
  app.use('/api', mcpRouter);

  // ── Real MCP Server (Streamable HTTP transport) ─────────────────────
  // Same 15 tools, spoken over the actual MCP protocol instead of REST.
  // Stateless: one server+transport per request, safe behind the tunnel.
  app.post('/mcp', requireApiKey, rateLimit(120), createMcpHandler());
  app.get('/mcp', (_req: Request, res: Response) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed. Use POST (Streamable HTTP, stateless).' },
      id: null,
    });
  });

  // ── Phase 3: Dual-Channel Conversational Orchestrator (WhatsApp, Telegram, Web) ──
  const chatOrchestratorAgent = new ChatOrchestratorAgent();
  const fastAckWorker = new FastAckWorker(chatOrchestratorAgent);
  const webhookRouter = createWebhookRouter(fastAckWorker, chatOrchestratorAgent);
  app.use('/api', webhookRouter);
  const tenancyManager = new TenancyManager();
  const campaignStrategyService = new CampaignStrategyService();
  const contentPlanService = new ContentPlanService();
  const canonicalContentEngine = new CanonicalContentEngine();
  const multiPlatformAdapterEngine = new MultiPlatformAdapterEngine();
  const publishingSchedulerService = new PublishingSchedulerService();
  const closedLoopAnalyticsService = new ClosedLoopAnalyticsService();

  const chatOrchestratorService = new ChatOrchestratorService(
    tenancyManager,
    campaignStrategyService,
    contentPlanService,
    canonicalContentEngine,
    multiPlatformAdapterEngine,
    publishingSchedulerService,
    closedLoopAnalyticsService
  );

  // ── Proactive Outbound Test Route ──────────────────────────────────
  app.post('/api/notify/proactive', async (req: Request, res: Response) => {
    try {
      const { text, type, campaignName, campaignId, goal } = req.body || {};
      let sent = false;
      if (type === 'campaign_created' && campaignName && campaignId) {
        sent = await telegramNotifier.notifyCampaignCreated(campaignName, campaignId, goal || '');
      } else if (type === 'strategy_approved' && campaignName) {
        sent = await telegramNotifier.notifyStrategyApproved(campaignName);
      } else if (type === 'plan_approved' && campaignName) {
        sent = await telegramNotifier.notifyContentPlanApproved(campaignName);
      } else if (text) {
        sent = await telegramNotifier.sendMessage(text);
      } else {
        return res.status(400).json({ success: false, error: 'Parameter text atau type invalid' });
      }
      res.json({ success: sent, message: sent ? 'Pesan proaktif terkirim ke Telegram' : 'Gagal mengirim pesan' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Root Healthcheck
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      engine: 'Mastra v1.73 (AI Agentic Framework)',
      database: 'PostgreSQL 15 (socialpal_db)',
      architecture: 'Domain-Driven Design (DDD) + Prompt Chaining',
      model: process.env.DEFAULT_MODEL || 'jerouter',
      timestamp: new Date().toISOString(),
    });
  });

  // --- LEGACY CHAT ORCHESTRATOR API ---
  app.post('/api/chat/message', async (req: Request, res: Response) => {
    try {
      const { sessionId, message } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'message field is required' });
      }

      const response = await chatOrchestratorService.handleUserMessage(sessionId || 'default-session', message);
      res.json(response);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/chat/session/:sessionId', (req: Request, res: Response) => {
    const rawId = req.params.sessionId;
    const sessionId = Array.isArray(rawId) ? rawId[0] : rawId;
    const session = chatOrchestratorService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  });

  // --- LEGACY TENANCY ENDPOINTS ---
  app.post('/api/tenancy/company', (req: Request, res: Response) => {
    try {
      const { name, brandVoice } = req.body;
      const company = tenancyManager.createCompany(name, brandVoice);
      res.status(201).json(company);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/tenancy/project', (req: Request, res: Response) => {
    try {
      const { companyId, name, icpDescription, contentPillars, defaultGoals } = req.body;
      const project = tenancyManager.createProject(companyId, name, icpDescription, contentPillars, defaultGoals);
      res.status(201).json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/tenancy/application', (req: Request, res: Response) => {
    try {
      const { projectId, companyId, name, connectedPlatforms } = req.body;
      const application = tenancyManager.createApplication(projectId, companyId, name, connectedPlatforms);
      res.status(201).json(application);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  return {
    app,
    campaignWorkflowService,
    campaignRepo,
    postRepo,
    memoryRepo,
    brandVoiceStore,
    auxiliaryService,
    tenancyManager,
    campaignStrategyService,
    contentPlanService,
    canonicalContentEngine,
    multiPlatformAdapterEngine,
    publishingSchedulerService,
    closedLoopAnalyticsService,
    chatOrchestratorService,
  };
}
