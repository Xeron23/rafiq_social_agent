import { describe, it, expect, beforeEach } from 'vitest';
import { ChatOrchestratorService } from '../src/services/chatOrchestratorService.js';
import { TenancyManager } from '../src/services/tenancyService.js';
import { CampaignStrategyService } from '../src/services/campaignStrategyService.js';
import { ContentPlanService } from '../src/services/contentPlanService.js';
import { CanonicalContentEngine } from '../src/services/canonicalContentService.js';
import { MultiPlatformAdapterEngine } from '../src/adapters/multiPlatformAdapters.js';
import { PublishingSchedulerService, ClosedLoopAnalyticsService } from '../src/services/publishingAndAnalyticsService.js';

describe('ChatOrchestratorService — Single Chat Cockpit Lifecycle', () => {
  let chatOrchestrator: ChatOrchestratorService;
  let tenancyManager: TenancyManager;
  let campaignStrategyService: CampaignStrategyService;
  let contentPlanService: ContentPlanService;
  let canonicalContentEngine: CanonicalContentEngine;
  let multiPlatformAdapterEngine: MultiPlatformAdapterEngine;
  let publishingSchedulerService: PublishingSchedulerService;
  let closedLoopAnalyticsService: ClosedLoopAnalyticsService;

  beforeEach(() => {
    tenancyManager = new TenancyManager();
    campaignStrategyService = new CampaignStrategyService();
    contentPlanService = new ContentPlanService();
    canonicalContentEngine = new CanonicalContentEngine();
    multiPlatformAdapterEngine = new MultiPlatformAdapterEngine();
    publishingSchedulerService = new PublishingSchedulerService();
    closedLoopAnalyticsService = new ClosedLoopAnalyticsService();

    chatOrchestrator = new ChatOrchestratorService(
      tenancyManager,
      campaignStrategyService,
      contentPlanService,
      canonicalContentEngine,
      multiPlatformAdapterEngine,
      publishingSchedulerService,
      closedLoopAnalyticsService
    );
  });

  it('Flow Step 1: Ingests company context when agent is hired without posting side-effects', async () => {
    const sessionId = 'test-session-001';
    const res = await chatOrchestrator.handleUserMessage(
      sessionId,
      'Saya hire kamu untuk fokus mengelola konten Bank BRI (BRImo).'
    );

    expect(res.currentState).toBe('CONTEXT_LOCKED');
    expect(res.detectedIntent).toBe('SETUP_CONTEXT');
    expect(res.widget.type).toBe('CONTEXT_CARD');
    expect(res.scope).toBeDefined();
    expect(res.textResponse).toContain('Bank Rakyat Indonesia');
  });

  it('Flow Step 2: Handles advisory/trend queries in pure Q&A mode without modifying queue', async () => {
    const sessionId = 'test-session-002';
    // First lock context
    await chatOrchestrator.handleUserMessage(sessionId, 'Fokus untuk company BRI.');

    // Now ask advisory
    const res = await chatOrchestrator.handleUserMessage(
      sessionId,
      'Isu tren apa yang sedang hangat seputar transaksi QRIS UMKM?'
    );

    expect(res.detectedIntent).toBe('ADVISORY_QUERY');
    expect(res.widget.type).toBe('NONE');
    expect(res.textResponse).toContain('Advisory Mode - No Queue Side-Effect');
  }, 30000);

  it('Flow Step 3 & 4: Generates Content Plan Matrix, allows interactive tweak, and executes Macro Approval into Cloud Queue', async () => {
    const sessionId = 'test-session-003';
    await chatOrchestrator.handleUserMessage(sessionId, 'Saya hire kamu untuk Bank BRI.');

    // Trigger Campaign
    const planRes = await chatOrchestrator.handleUserMessage(
      sessionId,
      'Buatkan kampanye 1 minggu untuk edukasi keamanan BRImo dan QRIS.'
    );

    expect(planRes.detectedIntent).toBe('TRIGGER_CAMPAIGN_PLAN');
    expect(planRes.currentState).toBe('PLANNING_MATRIX_READY');
    expect(planRes.widget.type).toBe('CONTENT_PLAN_MATRIX');
    expect(planRes.widget.data.items.length).toBeGreaterThan(0);

    // Tweak item in chat
    const tweakRes = await chatOrchestrator.handleUserMessage(
      sessionId,
      'Ubah topik hari kedua tambahkan angle real-time settlement.'
    );
    expect(tweakRes.detectedIntent).toBe('TWEAK_CONTENT_PLAN');
    expect(tweakRes.widget.type).toBe('CONTENT_PLAN_MATRIX');

    // 1-Click Macro Approval
    const approveRes = await chatOrchestrator.handleUserMessage(
      sessionId,
      'Approve semua, gas jadwalkan sekarang.'
    );

    expect(approveRes.detectedIntent).toBe('APPROVE_MACRO_PLAN');
    expect(approveRes.currentState).toBe('CAMPAIGN_SCHEDULED_ACTIVE');
    expect(approveRes.widget.type).toBe('QUEUE_CONFIRMATION');
    expect(approveRes.widget.data.queuedCount).toBeGreaterThan(0);
    expect(approveRes.textResponse).toContain('Macro Approval Sukses');
  }, 180000);
});
