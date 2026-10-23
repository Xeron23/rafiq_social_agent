import express, { Request, Response } from 'express';
import axios from 'axios';
import { CampaignWorkflowService } from '../../application/services/campaignWorkflowService.js';
import { IBrandVoiceStore } from '../../domain/campaign/campaign.types.js';
import { IPostRepository } from '../../domain/planner/post.aggregate.js';
import { IMemoryRepository } from '../../domain/analytics/memory.aggregate.js';
import { AnalyticsLearnerAgent } from '../../infrastructure/mastra/agents/analyticsLearnerAgent.js';
import { PostgresAuxiliaryService } from '../../infrastructure/repositories/postgres/postgresAuxiliaryService.js';

export function createHttpRouter(
  campaignService: CampaignWorkflowService,
  brandVoiceStore: IBrandVoiceStore,
  postRepo: IPostRepository,
  memoryRepo: IMemoryRepository,
  auxService?: PostgresAuxiliaryService
) {
  const router = express.Router();
  const analyticsLearner = new AnalyticsLearnerAgent();
  const auxiliary = auxService || new PostgresAuxiliaryService();

  // --- HEALTH CHECK ---
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      engine: 'Mastra v1.73 (AI Agentic Framework)',
      database: 'PostgreSQL 15 (socialpal_db)',
      architecture: 'Domain-Driven Design (DDD) + Prompt Chaining',
      model: process.env.DEFAULT_MODEL || 'jerouter',
      timestamp: new Date().toISOString(),
    });
  });

  // --- TAHAP 1: INITIATE CAMPAIGN & STRATEGY ---
  router.post('/campaigns/initiate', async (req: Request, res: Response) => {
    try {
      const { type, brief, targetChannels } = req.body;
      const result = await campaignService.initiateCampaign({
        type: type || 'hb',
        brief,
        targetChannels,
      });

      res.status(201).json({
        success: true,
        campaignId: result.campaign.id,
        status: result.campaign.status,
        step: result.campaign.step,
        strategy: result.campaign.strategy,
      });
    } catch (error: any) {
      console.error('Error in initiateCampaign:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // --- GET CAMPAIGN STATUS & DETAILS ---
  router.get('/campaigns/:id', async (req: Request, res: Response) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      const campaign = await campaignService.getCampaign(id);
      if (!campaign) {
        return res.status(404).json({ success: false, error: 'Campaign not found' });
      }
      res.json({ success: true, campaign });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // --- HITL GATE 1: APPROVE / REVISE STRATEGY ---
  router.post('/campaigns/:id/hitl/strategy', async (req: Request, res: Response) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      const { approved, revisions } = req.body;

      const result = await campaignService.handleStrategyHitl(id, {
        approved: approved !== false,
        revisions,
      });

      res.json({
        success: true,
        campaignId: result.campaign.id,
        status: result.campaign.status,
        step: result.campaign.step,
        strategy: result.campaign.strategy,
        contentPlan: result.campaign.contentPlan,
      });
    } catch (error: any) {
      console.error('Error in handleStrategyHitl:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // --- HITL GATE 2: APPROVE / REVISE CONTENT PLAN ---
  router.post('/campaigns/:id/hitl/plan', async (req: Request, res: Response) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      const { approved, revisions } = req.body;

      const result = await campaignService.handlePlanHitl(id, {
        approved: approved !== false,
        revisions,
      });

      res.json({
        success: true,
        campaignId: result.campaign.id,
        status: result.campaign.status,
        step: result.campaign.step,
        contentPlan: result.campaign.contentPlan,
        canonical: result.campaign.canonicalContent,
        platformVariants: result.campaign.platformVariants,
      });
    } catch (error: any) {
      console.error('Error in handlePlanHitl:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // --- TAHAP 4: EDIT PLATFORM COPY ---
  router.post('/campaigns/:id/platform-copy', async (req: Request, res: Response) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      const { channel, copy } = req.body;

      const campaign = await campaignService.updatePlatformCopy(id, channel, copy);
      res.json({
        success: true,
        campaignId: campaign.id,
        customCaptions: campaign.customCaptions,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // --- HITL GATE 4: FINAL AUTHORIZATION & SCHEDULE ---
  router.post('/campaigns/:id/authorize', async (req: Request, res: Response) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      const { customCaptions, scheduleMode } = req.body;

      const result = await campaignService.authorizeCampaign({
        campaignId: id,
        customCaptions,
        scheduleMode: scheduleMode || 'planner',
      });

      res.json({
        success: true,
        message: 'Campaign authorized and scheduled into Planner (PostgreSQL).',
        campaignId: result.campaign.id,
        scheduledCount: result.scheduledPosts.length,
        posts: result.scheduledPosts.map(p => p.toDTO()),
      });
    } catch (error: any) {
      console.error('Error in authorizeCampaign:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // --- IMAGE GENERATION (MODEL 'ig' VIA ROUTER) ---
  router.post('/campaigns/generate-image', async (req: Request, res: Response) => {
    try {
      const { prompt, aspectRatio } = req.body;
      const apiKey = process.env.IMAGE_API_KEY || process.env.OPENAI_API_KEY || '';
      const baseUrl = process.env.IMAGE_BASE_URL || process.env.OPENAI_BASE_URL || 'https://je.jerouter.web.id/v1';

      const finalPrompt = prompt || 'Minimalist sleek AI technology banner, dark corporate mode with cyan and deep purple accents';

      console.log('[AI-Image] 🎨 Requesting image generation with model "ig"...');
      const start = performance.now();

      let imgData: any = null;
      let lastErr: any = null;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const resp = await axios.post(
            `${baseUrl}/images/generations`,
            {
              model: 'ig',
              prompt: finalPrompt,
              n: 1,
              size: aspectRatio === '16:9' ? '1536x1024' : '1024x1024',
            },
            {
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              proxy: false,
              timeout: 60000,
            }
          );
          imgData = resp.data;
          break;
        } catch (err: any) {
          lastErr = err;
          console.warn(`[AI-Image] Attempt ${attempt} failed: ${err?.message}`);
          if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
        }
      }

      const d = ((performance.now() - start) / 1000).toFixed(2);

      if (!imgData) {
        console.error(`[AI-Image] ❌ Failed in ${d}s:`, lastErr?.response?.data || lastErr?.message);
        return res.status(lastErr?.response?.status || 500).json({
          success: false,
          error: lastErr?.response?.data || lastErr?.message,
        });
      }

      console.log(`[AI-Image] ✅ Generated image successfully in ${d}s!`);

      const b64 = imgData.data?.[0]?.b64_json;
      // The router (model 'ig' -> OpenAI gpt-image-2) returns PNG for some sizes
      // and JPEG for others, so the mime type must be sniffed, not assumed.
      let mime = 'image/png';
      if (b64) {
        if (b64.startsWith('/9j/')) mime = 'image/jpeg';
        else if (b64.startsWith('UklGR')) mime = 'image/webp';
        else if (b64.startsWith('iVBORw0KGgo')) mime = 'image/png';
      }
      const dataUrl = b64 ? `data:${mime};base64,${b64}` : null;

      res.json({
        success: true,
        duration: d,
        imageUrl: dataUrl,
      });
    } catch (error: any) {
      console.error('Error generating image:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // --- BRAND VOICE API ---
  router.get('/brand-voice', (_req: Request, res: Response) => {
    res.json({ success: true, profile: brandVoiceStore.getProfile() });
  });

  router.post('/brand-voice', (req: Request, res: Response) => {
    try {
      const updated = brandVoiceStore.updateProfile(req.body);
      res.json({ success: true, profile: updated });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // --- PLANNER API ---
  router.get('/planner/posts', async (_req: Request, res: Response) => {
    try {
      const posts = await postRepo.findAll();
      res.json({ success: true, posts: posts.map(p => p.toDTO()) });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/planner/calendar-events', async (_req: Request, res: Response) => {
    try {
      const events = await auxiliary.getCalendarEvents();
      res.json({ success: true, events });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/planner/publish-instant', async (req: Request, res: Response) => {
    try {
      const { postId } = req.body;
      const post = await postRepo.findById(Number(postId));
      if (!post) {
        return res.status(404).json({ success: false, error: 'Post not found' });
      }
      post.publishInstant();
      await postRepo.save(post);
      res.json({ success: true, post: post.toDTO() });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // --- NOTIFICATIONS API ---
  router.get('/notifications', async (req: Request, res: Response) => {
    try {
      const tab = (req.query.tab as string) || 'all';
      const data = await auxiliary.getNotifications(tab);
      res.json({ success: true, ...data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/notifications/:id/read', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      await auxiliary.markNotificationRead(id);
      res.json({ success: true, id });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/notifications/read-all', async (_req: Request, res: Response) => {
    try {
      await auxiliary.markAllNotificationsRead();
      res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/notifications/preferences', async (_req: Request, res: Response) => {
    try {
      const prefs = await auxiliary.getNotificationPreferences();
      res.json({ success: true, preferences: prefs });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/notifications/preferences', async (req: Request, res: Response) => {
    try {
      const { category_key, field, value } = req.body;
      await auxiliary.updateNotificationPreference(category_key, field, value);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // --- ANALYTICS & CLOSED-LOOP AI MEMORY (Tahap 5) ---
  router.get('/analytics/overview', async (_req: Request, res: Response) => {
    try {
      const posts = await postRepo.findAll();
      const memories = await memoryRepo.findAll();
      const recs = await auxiliary.getRecommendations();
      const metrics = await auxiliary.getAggregatedMetrics();

      res.json({
        success: true,
        kpis: {
          views: metrics.formattedViews,
          likes: metrics.formattedLikes,
          shares: metrics.formattedShares,
          publishedCount: posts.filter(p => p.status === 'terbit').length,
          scheduledCount: posts.filter(p => p.status === 'terjadwal').length,
        },
        rawMetrics: {
          totalViews: metrics.totalViews,
          totalLikes: metrics.totalLikes,
          totalShares: metrics.totalShares,
          channelBreakdown: metrics.channelBreakdown,
        },
        memories: memories.map(m => m.toDTO()),
        recommendations: recs,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/analytics/memories', async (_req: Request, res: Response) => {
    try {
      const memories = await memoryRepo.findAll();
      res.json({ success: true, memories: memories.map(m => m.toDTO()) });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/analytics/recommendations/:id/toggle', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const { applied } = req.body;
      await auxiliary.toggleRecommendation(id, applied !== false);
      res.json({ success: true, id, applied });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/analytics/learn', async (req: Request, res: Response) => {
    try {
      const { postsSummary, kpiStats } = req.body;
      const metrics = await auxiliary.getAggregatedMetrics();

      const resolvedPostsSummary = postsSummary || metrics.topPostsSummary;
      const resolvedKpiStats = kpiStats || `Total Views: ${metrics.formattedViews}, Total Likes: ${metrics.formattedLikes}, Total Shares: ${metrics.formattedShares}`;

      const reflections = await analyticsLearner.analyzeAndReflect({
        recentPostsSummary: resolvedPostsSummary,
        kpiStats: resolvedKpiStats,
      });

      for (const r of reflections) {
        await memoryRepo.save(r);
      }

      res.json({
        success: true,
        newMemoriesCount: reflections.length,
        memories: reflections.map(r => r.toDTO()),
      });
    } catch (error: any) {
      console.error('Error in analytics learn:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // --- CHANNELS API ---
  router.get('/channels', async (_req: Request, res: Response) => {
    try {
      const channels = await auxiliary.getChannels();
      res.json({ success: true, channels });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/channels/:id/toggle', async (req: Request, res: Response) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      const nextStatus = await auxiliary.toggleChannelStatus(id);
      res.json({ success: true, id, status: nextStatus });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
