// Webhook & Dual-Channel Conversational Router (Phase 3)
//
// Endpoints:
//   POST /api/webhooks/whatsapp   (Fast-ACK WhatsApp Gateway)
//   POST /api/webhooks/telegram   (Fast-ACK Telegram Gateway)
//   POST /api/chat/agent          (Unified ReAct + MCP Tool-Calling Cockpit: sync & async)
//   GET  /api/webhooks/jobs/:id   (Job status & observation polling)
//   GET  /api/webhooks/jobs       (Recent jobs audit)

import { Router, Request, Response } from 'express';
import { FastAckWorker } from '../../application/services/fastAckWorker.js';
import { ChatOrchestratorAgent } from '../../infrastructure/mastra/agents/chatOrchestratorAgent.js';

export function createWebhookRouter(
  worker?: FastAckWorker,
  agent?: ChatOrchestratorAgent
) {
  const router = Router();
  const orchestratorAgent = agent || new ChatOrchestratorAgent();
  const fastAckWorker = worker || new FastAckWorker(orchestratorAgent);

  // ── POST /api/webhooks/whatsapp ───────────────────────────────────────
  // Instant ACK (< 800ms) for WhatsApp (Meta Cloud API / Baileys webhook)
  router.post('/webhooks/whatsapp', (req: Request, res: Response) => {
    try {
      const body = req.body || {};

      // Standardize input from Baileys or Meta Cloud API format
      let sender = body.from || body.sender || 'unknown-wa';
      let text = body.body || body.text || body.message?.conversation || '';

      // Support Meta Webhook entry structure if present
      if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        const msg = body.entry[0].changes[0].value.messages[0];
        sender = msg.from;
        text = msg.text?.body || '';
      }

      if (!text) {
        return res.status(200).json({ success: true, ignored: true, reason: 'Empty text message' });
      }

      const { job, ackResponse } = fastAckWorker.enqueue({
        channel: 'whatsapp',
        senderId: String(sender),
        userMessage: String(text),
      });

      // Immediate 200 OK Fast-ACK to avoid 504 gateway timeout
      return res.status(200).json({
        ...ackResponse,
        channel: 'whatsapp',
        sender,
      });
    } catch (err: any) {
      console.error('[Webhook:WhatsApp] Error:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Webhook processing failed' });
    }
  });

  // ── POST /api/webhooks/telegram ───────────────────────────────────────
  // Instant ACK (< 800ms) for Telegram Bot Webhook
  router.post('/webhooks/telegram', (req: Request, res: Response) => {
    try {
      const update = req.body || {};
      const message = update.message || update.edited_message;

      // Extract sender and text
      let chatId = message?.chat?.id || update.chatId || 'unknown-tg';
      let text = message?.text || update.text || '';

      if (!text) {
        return res.status(200).json({ success: true, ignored: true, reason: 'No text in Telegram update' });
      }

      const { job, ackResponse } = fastAckWorker.enqueue({
        channel: 'telegram',
        senderId: String(chatId),
        userMessage: String(text),
      });

      return res.status(200).json({
        ...ackResponse,
        channel: 'telegram',
        chatId,
      });
    } catch (err: any) {
      console.error('[Webhook:Telegram] Error:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Telegram webhook error' });
    }
  });

  // ── POST /api/chat/agent ─────────────────────────────────────────────
  // Unified ReAct Cockpit endpoint (Dual mode: Synchronous by default, or ?mode=async for Fast-ACK)
  router.post('/chat/agent', async (req: Request, res: Response) => {
    try {
      const { message, sessionId, mode } = req.body || {};
      const isAsync = mode === 'async' || req.query.mode === 'async';

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ success: false, error: 'Field "message" (string) is required' });
      }

      const effectiveSessionId = sessionId || 'web-cockpit-default';

      if (isAsync) {
        const { ackResponse } = fastAckWorker.enqueue({
          channel: 'web',
          senderId: effectiveSessionId,
          userMessage: message,
          sessionId: effectiveSessionId,
        });
        return res.status(200).json(ackResponse);
      }

      // Synchronous mode: run full ReAct loop and return reply + tool traces
      const result = await orchestratorAgent.processMessage(effectiveSessionId, message);
      return res.status(200).json({
        success: true,
        sessionId: effectiveSessionId,
        reply: result.reply,
        toolsExecuted: result.toolsExecuted,
        steps: result.steps,
      });
    } catch (err: any) {
      console.error('[Chat:Agent] Error:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Agent error' });
    }
  });

  // ── GET /api/webhooks/jobs/:id ────────────────────────────────────────
  router.get('/webhooks/jobs/:id', (req: Request, res: Response) => {
    const rawId = req.params.id;
    const jobId = Array.isArray(rawId) ? rawId[0] : rawId;
    const job = fastAckWorker.getJob(jobId);

    if (!job) {
      return res.status(404).json({ success: false, error: `Job ${jobId} not found` });
    }

    return res.json({
      success: true,
      job: {
        jobId: job.jobId,
        channel: job.channel,
        senderId: job.senderId,
        status: job.status,
        fastAckReply: job.fastAckReply,
        queuedAt: job.queuedAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        durationMs: job.durationMs,
        reply: job.result?.reply,
        toolsExecuted: job.result?.toolsExecuted,
        steps: job.result?.steps,
        error: job.error,
      },
    });
  });

  // ── GET /api/webhooks/jobs ────────────────────────────────────────────
  router.get('/webhooks/jobs', (_req: Request, res: Response) => {
    const jobs = fastAckWorker.listRecentJobs(30);
    return res.json({
      success: true,
      count: jobs.length,
      jobs: jobs.map((j) => ({
        jobId: j.jobId,
        channel: j.channel,
        senderId: j.senderId,
        status: j.status,
        queuedAt: j.queuedAt,
        durationMs: j.durationMs,
        toolsExecuted: j.result?.toolsExecuted || [],
      })),
    });
  });

  return router;
}
