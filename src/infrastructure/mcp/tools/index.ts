// MCP Tools Registry for Rafiq Social Agent
// Phase 2 (active): MCP Tool-Calling Layer
// Provides 3 domains of tool-calling:
//   - mcp-campaign     (start/approve/revise/secure publish campaign workflow)
//   - mcp-planner      (calendar, schedule, publish control)
//   - mcp-brandvoice   (brand voice profile access)
//
// All tools are real implementations, wired to:
//   - CampaignWorkflowService (Mastra macro-HITL workflow)
//   - ContentPlanService           (matrix generation & mutation)
//   - PostgresCampaignRepository   (campaign DDD aggregate)
//   - PostgresPostRepository       (planner/scheduled posts)
//   - PostgresBrandVoiceStore      (brand voice profile)
//   - PostgresAuxiliaryService     (calendar, notifications, analytics)
//
// Response shape:
//   - success: boolean
//   - data?: any          (domain payload)
//   - error?: string
//   - meta.timestamp: number
//   - meta.tool: string

import { z } from 'zod';
import { CampaignWorkflowService } from '../../../application/services/campaignWorkflowService.js';
import { PostgresCampaignRepository } from '../../../infrastructure/repositories/postgres/postgresCampaignRepository.js';
import { PostgresPostRepository } from '../../../infrastructure/repositories/postgres/postgresPostRepository.js';
import { PostgresBrandVoiceStore } from '../../../infrastructure/repositories/postgres/postgresBrandVoiceStore.js';
import { PostgresAuxiliaryService } from '../../../infrastructure/repositories/postgres/postgresAuxiliaryService.js';
import { PostgresMemoryRepository } from '../../../infrastructure/repositories/postgres/postgresMemoryRepository.js';
import { PostAggregate } from '../../../domain/planner/post.aggregate.js';
import { toolJobs } from '../toolJobs.js';

// ── Schema Definitions ────────────────────────────────────────────────

export const CampaignBriefInputSchema = z.object({
  type: z.enum(['hb', 'lt', 'pp']),
  brief: z.string().optional(),
  targetChannels: z.array(z.enum(['li', 'ig', 'fb', 'th', 'x', 'md'])).default(['li', 'ig', 'fb', 'th', 'x', 'md']),
});

export const HitlActionSchema = z.object({
  approved: z.boolean(),
  revisions: z.string().optional(),
});

export const PlatformCopySchema = z.object({
  campaignId: z.string().min(1),
  channel: z.string().min(1),
  copy: z.string().min(1),
});

export const AuthorizeSchema = z.object({
  campaignId: z.string().min(1),
  customCaptions: z.record(z.string(), z.string()).default({}),
  scheduleMode: z.enum(['planner', 'instant']).default('planner'),
});

export const PlannerInputSchema = z.object({
  month: z.number().min(1).max(12).optional(),
  year: z.number().optional(),
});

export const SchedulePostInputSchema = z.object({
  campaignId: z.string().min(1),
  dayOfMonth: z.number().int().min(1).max(31),
  time: z.string().min(1),
  title: z.string().min(1),
  channels: z.array(z.enum(['li', 'ig', 'fb', 'th', 'x', 'md'])),
});

export const PublishInstantInputSchema = z.object({
  postId: z.number().int().positive(),
  campaignId: z.string().min(1),
});

export const ReschedulePostInputSchema = z.object({
  postId: z.number().int().positive(),
  newDate: z.string().min(1),
  newTime: z.string().min(1),
});

// ── Tool Runtime Helpers ────────────────────────────────────────────────

export interface McpTool {
  name: string;
  description: string;
  inputSchema: any;
  execute: (args: any) => Promise<any>;
}

export function makeMcpPayload(success: boolean, data?: any, error?: string): Record<string, any> {
  const payload: Record<string, any> = { success };
  if (data !== undefined) payload.data = data;
  if (error !== undefined) payload.error = error;
  return payload;
}

export function mcpLogError(tool: string, err: unknown, baseMessage: string): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[MCP:${tool}] ${baseMessage}: ${message}`);
}

// ── Campaign Tool Implementations ───────────────────────────────────────

export const campaignTools: McpTool[] = [
  {
    name: 'start_campaign',
    description: 'Start a new campaign and generate strategy (Tahap 1). Calls CampaignWorkflowService.initiateCampaign() and persists to PostgreSQL.',
    inputSchema: CampaignBriefInputSchema,
    execute: async (args: any) => {
      try {
        const parsed = CampaignBriefInputSchema.parse(args || {});
        const campaignRepo = new PostgresCampaignRepository();
        const postRepo = new PostgresPostRepository();
        const memoryRepo = new PostgresMemoryRepository();
        const brandVoiceStore = new PostgresBrandVoiceStore();
        const service = new CampaignWorkflowService(campaignRepo, postRepo, memoryRepo, brandVoiceStore);
        const result = await service.initiateCampaign({
          type: parsed.type,
          brief: parsed.brief || '',
          targetChannels: parsed.targetChannels,
        });
        return makeMcpPayload(true, {
          campaignId: result.campaign.id,
          name: result.campaign.name,
          type: result.campaign.type,
          status: result.campaign.status,
          step: result.campaign.step,
          strategy: result.campaign.strategy,
          message: 'Campaign started and saved to PostgreSQL.',
        });
      } catch (err: any) {
        mcpLogError('start_campaign', err, 'Failed to start campaign');
        return makeMcpPayload(false, undefined, err?.message || 'Failed to start campaign');
      }
    },
  },
  {
    name: 'approve_strategy',
    description: 'Approve or request revision for campaign strategy (HITL Gate 1). Calls CampaignWorkflowService.handleStrategyHitl().',
    inputSchema: z.object({
      campaignId: z.string().min(1),
      approved: z.boolean(),
      revisions: z.string().optional(),
    }),
    execute: async (args: any) => {
      try {
        const parsed = z.object({
          campaignId: z.string().min(1),
          approved: z.boolean(),
          revisions: z.string().optional(),
        }).parse(args || {});
        const campaignRepo = new PostgresCampaignRepository();
        const postRepo = new PostgresPostRepository();
        const memoryRepo = new PostgresMemoryRepository();
        const brandVoiceStore = new PostgresBrandVoiceStore();
        const service = new CampaignWorkflowService(campaignRepo, postRepo, memoryRepo, brandVoiceStore);
        const result = await service.handleStrategyHitl(parsed.campaignId, {
          approved: parsed.approved,
          revisions: parsed.revisions,
        });
        return makeMcpPayload(true, {
          campaignId: result.campaign.id,
          status: result.campaign.status,
          step: result.campaign.step,
          strategy: result.campaign.strategy,
          message: parsed.approved ? 'Strategy approved. Planning continues.' : 'Strategy revision queued.',
        });
      } catch (err: any) {
        mcpLogError('approve_strategy', err, 'Failed to approve/revise strategy');
        return makeMcpPayload(false, undefined, err?.message || 'Failed to approve strategy');
      }
    },
  },
  {
    name: 'approve_plan',
    description: 'Approve or request revision for content plan matrix (HITL Gate 2). Calls CampaignWorkflowService.handlePlanHitl().',
    inputSchema: z.object({
      campaignId: z.string().min(1),
      approved: z.boolean(),
      revisions: z.string().optional(),
    }),
    execute: async (args: any) => {
      try {
        const parsed = z.object({
          campaignId: z.string().min(1),
          approved: z.boolean(),
          revisions: z.string().optional(),
        }).parse(args || {});
        const campaignRepo = new PostgresCampaignRepository();
        const postRepo = new PostgresPostRepository();
        const memoryRepo = new PostgresMemoryRepository();
        const brandVoiceStore = new PostgresBrandVoiceStore();
        const service = new CampaignWorkflowService(campaignRepo, postRepo, memoryRepo, brandVoiceStore);
        const result = await service.handlePlanHitl(parsed.campaignId, {
          approved: parsed.approved,
          revisions: parsed.revisions,
        });
        return makeMcpPayload(true, {
          campaignId: result.campaign.id,
          status: result.campaign.status,
          step: result.campaign.step,
          contentPlan: result.campaign.contentPlan,
          canonical: result.campaign.canonicalContent,
          message: parsed.approved ? 'Content plan approved. Synthesis continues.' : 'Plan revision queued.',
        });
      } catch (err: any) {
        mcpLogError('approve_plan', err, 'Failed to approve/revise plan');
        return makeMcpPayload(false, undefined, err?.message || 'Failed to approve plan');
      }
    },
  },
  {
    name: 'approve_canonical',
    description: 'Approve or request revision for canonical content (HITL Gate 3). Advance campaign to platform authorization.',
    inputSchema: z.object({
      campaignId: z.string().min(1),
      approved: z.boolean(),
      revisions: z.string().optional(),
    }),
    execute: async (args: any) => {
      try {
        const parsed = z.object({
          campaignId: z.string().min(1),
          approved: z.boolean(),
          revisions: z.string().optional(),
        }).parse(args || {});
        const campaignRepo = new PostgresCampaignRepository();
        const campaign = await campaignRepo.findById(parsed.campaignId);
        if (!campaign) return makeMcpPayload(false, undefined, `Campaign ${parsed.campaignId} not found`);
        if (!parsed.approved && parsed.revisions) {
          campaign.requestCanonicalRevision(parsed.revisions);
          await campaignRepo.save(campaign);
          return makeMcpPayload(true, { campaignId: campaign.id, status: campaign.status, message: 'Canonical revision requested.' });
        }
        campaign.approveCanonical();
        await campaignRepo.save(campaign);
        return makeMcpPayload(true, { campaignId: campaign.id, status: campaign.status, step: campaign.step, message: 'Canonical approved. Ready for final authorization.' });
      } catch (err: any) {
        mcpLogError('approve_canonical', err, 'Failed to approve canonical');
        return makeMcpPayload(false, undefined, err?.message || 'Failed to approve canonical');
      }
    },
  },
  {
    name: 'authorize_campaign',
    description: 'Final authorization for campaign publishing (HITL Gate 4). Calls CampaignWorkflowService.authorizeCampaign().',
    inputSchema: AuthorizeSchema,
    execute: async (args: any) => {
      try {
        const parsed = AuthorizeSchema.parse(args || {});
        const campaignRepo = new PostgresCampaignRepository();
        const postRepo = new PostgresPostRepository();
        const memoryRepo = new PostgresMemoryRepository();
        const brandVoiceStore = new PostgresBrandVoiceStore();
        const service = new CampaignWorkflowService(campaignRepo, postRepo, memoryRepo, brandVoiceStore);
        const result = await service.authorizeCampaign({
          campaignId: parsed.campaignId,
          customCaptions: parsed.customCaptions,
          scheduleMode: parsed.scheduleMode,
        });
        return makeMcpPayload(true, {
          campaignId: result.campaign.id,
          status: result.campaign.status,
          scheduleMode: parsed.scheduleMode,
          scheduledCount: result.scheduledPosts.length,
          message: 'Campaign authorized and scheduled into PostgreSQL.',
        });
      } catch (err: any) {
        mcpLogError('authorize_campaign', err, 'Failed to authorize campaign');
        return makeMcpPayload(false, undefined, err?.message || 'Failed to authorize campaign');
      }
    },
  },
  {
    name: 'update_platform_copy',
    description: 'Update custom copy for a specific platform channel. Calls CampaignWorkflowService.updatePlatformCopy().',
    inputSchema: PlatformCopySchema,
    execute: async (args: any) => {
      try {
        const parsed = PlatformCopySchema.parse(args || {});
        const campaignRepo = new PostgresCampaignRepository();
        const postRepo = new PostgresPostRepository();
        const memoryRepo = new PostgresMemoryRepository();
        const brandVoiceStore = new PostgresBrandVoiceStore();
        const service = new CampaignWorkflowService(campaignRepo, postRepo, memoryRepo, brandVoiceStore);
        const campaign = await service.updatePlatformCopy(parsed.campaignId, parsed.channel as any, parsed.copy);
        return makeMcpPayload(true, {
          campaignId: campaign.id,
          channel: parsed.channel,
          message: 'Platform copy updated and saved to PostgreSQL.',
        });
      } catch (err: any) {
        mcpLogError('update_platform_copy', err, 'Failed to update platform copy');
        return makeMcpPayload(false, undefined, err?.message || 'Failed to update platform copy');
      }
    },
  },
];

// ── Planner Tool Implementations ────────────────────────────────────────

export const plannerTools: McpTool[] = [
  {
    name: 'get_calendar_schedule',
    description: 'Get calendar / planner schedule for a month/year. Reads from PostgresAuxiliaryService.getCalendarEvents().',
    inputSchema: PlannerInputSchema,
    execute: async (args: any) => {
      try {
        const parsed = PlannerInputSchema.parse(args || {});
        const auxiliary = new PostgresAuxiliaryService();
        const events = await auxiliary.getCalendarEvents(parsed.month, parsed.year);
        return makeMcpPayload(true, { events, month: parsed.month, year: parsed.year });
      } catch (err: any) {
        mcpLogError('get_calendar_schedule', err, 'Failed to read calendar schedule');
        return makeMcpPayload(false, undefined, err?.message || 'Failed to read calendar schedule');
      }
    },
  },
  {
    name: 'schedule_post',
    description: 'Schedule a post for a specific date/time. Creates a PostAggregate and persists to PostgresPostRepository.',
    inputSchema: SchedulePostInputSchema,
    execute: async (args: any) => {
      try {
        const parsed = SchedulePostInputSchema.parse(args || {});
        const campaignRepo = new PostgresCampaignRepository();
        const postRepo = new PostgresPostRepository();
        const memoryRepo = new PostgresMemoryRepository();
        const brandVoiceStore = new PostgresBrandVoiceStore();
        const service = new CampaignWorkflowService(campaignRepo, postRepo, memoryRepo, brandVoiceStore);
        const campaign = await campaignRepo.findById(parsed.campaignId);
        if (!campaign) return makeMcpPayload(false, undefined, `Campaign ${parsed.campaignId} not found`);
        const existing = await postRepo.findAll();
        const nextId = existing.length > 0 ? Math.max(...existing.map(p => p.id)) + 1 : 10;
        const post = new PostAggregate(
          nextId,
          parsed.dayOfMonth,
          parsed.time,
          parsed.title,
          parsed.title.length > 60 ? parsed.title.slice(0, 57) + '...' : parsed.title,
          'Leadership Thought',
          'terjadwal',
          parsed.channels,
          parsed.title,
          'Terjadwal di Kalender',
          `${parsed.dayOfMonth} · ${parsed.time}`,
          campaign.id,
          campaign.name,
          4
        );
        await postRepo.save(post);
        return makeMcpPayload(true, {
          postId: post.id,
          dayOfMonth: post.dayOfMonth,
          time: post.timeStr,
          title: post.title,
          status: post.status,
          channels: post.channels,
          message: 'Post scheduled and saved to PostgreSQL.',
        });
      } catch (err: any) {
        mcpLogError('schedule_post', err, 'Failed to schedule post');
        return makeMcpPayload(false, undefined, err?.message || 'Failed to schedule post');
      }
    },
  },
  {
    name: 'publish_instant',
    description: 'Publish a post immediately (instant mode). Calls PostAggregate.publishInstant() and PostgresPostRepository.save().',
    inputSchema: PublishInstantInputSchema,
    execute: async (args: any) => {
      try {
        const parsed = PublishInstantInputSchema.parse(args || {});
        const postRepo = new PostgresPostRepository();
        const post = await postRepo.findById(parsed.postId);
        if (!post) return makeMcpPayload(false, undefined, `Post ${parsed.postId} not found`);
        post.publishInstant();
        await postRepo.save(post);
        return makeMcpPayload(true, {
          postId: post.id,
          status: post.status,
          message: 'Post published instantly.',
        });
      } catch (err: any) {
        mcpLogError('publish_instant', err, 'Failed to publish instant');
        return makeMcpPayload(false, undefined, err?.message || 'Failed to publish instant');
      }
    },
  },
  {
    name: 'reschedule_post',
    description: 'Reschedule an existing post. Updates day_of_month and scheduled_time, persists to PostgresPostRepository.',
    inputSchema: ReschedulePostInputSchema,
    execute: async (args: any) => {
      try {
        const parsed = ReschedulePostInputSchema.parse(args || {});
        const postRepo = new PostgresPostRepository();
        const post = await postRepo.findById(parsed.postId);
        if (!post) return makeMcpPayload(false, undefined, `Post ${parsed.postId} not found`);
        post.schedule(parseInt(parsed.newDate, 10), parsed.newTime);
        await postRepo.save(post);
        return makeMcpPayload(true, {
          postId: post.id,
          newDay: post.dayOfMonth,
          newTime: post.timeStr,
          status: post.status,
          message: 'Post rescheduled and saved to PostgreSQL.',
        });
      } catch (err: any) {
        mcpLogError('reschedule_post', err, 'Failed to reschedule post');
        return makeMcpPayload(false, undefined, err?.message || 'Failed to reschedule post');
      }
    },
  },
];

// ── Brand Voice Tool Implementations ────────────────────────────────────

export const brandvoiceTools: McpTool[] = [
  {
    name: 'get_brand_voice',
    description: 'Get active brand voice profile. Reads from PostgresBrandVoiceStore.',
    inputSchema: z.object({}),
    execute: async (_args: any) => {
      try {
        const store = new PostgresBrandVoiceStore();
        const profile = await store.getProfileAsync();
        return makeMcpPayload(true, { profile });
      } catch (err: any) {
        mcpLogError('get_brand_voice', err, 'Failed to read brand voice profile');
        return makeMcpPayload(false, undefined, err?.message || 'Failed to read brand voice profile');
      }
    },
  },
  {
    name: 'update_brand_voice',
    description: 'Update brand voice parameters. Calls PostgresBrandVoiceStore.updateProfile().',
    inputSchema: z.object({
      formal: z.number().min(0).max(100).optional(),
      warm: z.number().min(0).max(100).optional(),
      simple: z.number().min(0).max(100).optional(),
      keywords: z.array(z.string()).optional(),
      avoid: z.array(z.string()).optional(),
      guidelines: z.string().optional(),
    }),
    execute: async (args: any) => {
      try {
        const parsed = z.object({
          formal: z.number().min(0).max(100).optional(),
          warm: z.number().min(0).max(100).optional(),
          simple: z.number().min(0).max(100).optional(),
          keywords: z.array(z.string()).optional(),
          avoid: z.array(z.string()).optional(),
          guidelines: z.string().optional(),
        }).parse(args || {});
        const store = new PostgresBrandVoiceStore();
        const updated = store.updateProfile(parsed);
        return makeMcpPayload(true, { profile: updated, message: 'Brand voice updated and saved to PostgreSQL.' });
      } catch (err: any) {
        mcpLogError('update_brand_voice', err, 'Failed to update brand voice');
        return makeMcpPayload(false, undefined, err?.message || 'Failed to update brand voice');
      }
    },
  },
];

// ── Campaign Read Tools (status / listing) ─────────────────────────────

export const campaignReadTools: McpTool[] = [
  {
    name: 'list_campaigns',
    description: 'List every campaign with id, name, type, lifecycle status, current step and target channels. Use this whenever the user asks which campaigns exist, are running, or are waiting for approval.',
    inputSchema: z.object({
      status: z.string().optional(),
    }),
    execute: async (args: any) => {
      try {
        const repo = new PostgresCampaignRepository();
        const service = new CampaignWorkflowService(
          repo,
          new PostgresPostRepository(),
          new PostgresMemoryRepository(),
          new PostgresBrandVoiceStore()
        );
        const all = await service.listCampaigns();
        const needle = typeof args?.status === 'string' ? args.status.toLowerCase() : '';
        const filtered = needle
          ? all.filter((c) => String(c.status).toLowerCase().includes(needle))
          : all;
        return makeMcpPayload(true, {
          count: filtered.length,
          campaigns: filtered.map((c) => ({
            campaignId: c.id,
            name: c.name,
            type: c.type,
            status: c.status,
            step: c.step,
            targetChannels: c.targetChannels,
            createdAt: c.createdAt,
          })),
        });
      } catch (err: any) {
        mcpLogError('list_campaigns', err, 'Failed to list campaigns');
        return makeMcpPayload(false, undefined, err?.message || 'Failed to list campaigns');
      }
    },
  },
  {
    name: 'get_campaign_status',
    description: 'Get the detailed status of a single campaign by id: lifecycle status, current HITL step (0-4), and which artifacts (strategy, content plan, canonical content, platform variants) already exist.',
    inputSchema: z.object({
      campaignId: z.string().min(1),
    }),
    execute: async (args: any) => {
      try {
        const parsed = z.object({ campaignId: z.string().min(1) }).parse(args || {});
        const repo = new PostgresCampaignRepository();
        const campaign = await repo.findById(parsed.campaignId);
        if (!campaign) {
          return makeMcpPayload(false, undefined, `Campaign ${parsed.campaignId} not found.`);
        }
        return makeMcpPayload(true, {
          campaignId: campaign.id,
          name: campaign.name,
          type: campaign.type,
          status: campaign.status,
          step: campaign.step,
          targetChannels: campaign.targetChannels,
          hasStrategy: Boolean(campaign.strategy),
          hasContentPlan: Array.isArray(campaign.contentPlan) && campaign.contentPlan.length > 0,
          hasCanonicalContent: Boolean(campaign.canonicalContent),
          platformVariantChannels: Object.keys(campaign.platformVariants || {}),
          updatedAt: campaign.updatedAt,
        });
      } catch (err: any) {
        mcpLogError('get_campaign_status', err, 'Failed to read campaign status');
        return makeMcpPayload(false, undefined, err?.message || 'Failed to read campaign status');
      }
    },
  },
];

// ── Async job tools ─────────────────────────────────────────────────────

export const jobTools: McpTool[] = [
  {
    name: 'get_tool_job',
    description: 'Poll the status of an asynchronous tool job. Heavy tools (start_campaign, approve_*, authorize_campaign) return { jobId } immediately; call this with that id to get QUEUED | PROCESSING | COMPLETED | FAILED plus the final result.',
    inputSchema: z.object({
      jobId: z.string().min(1),
    }),
    execute: async (args: any) => {
      try {
        const parsed = z.object({ jobId: z.string().min(1) }).parse(args || {});
        const job = toolJobs.get(parsed.jobId);
        if (!job) {
          return makeMcpPayload(
            false,
            undefined,
            `Job ${parsed.jobId} not found. Jobs are kept in memory for 1 hour; if the server restarted, the audit trail is gone but the campaign data is still in PostgreSQL.`
          );
        }
        return makeMcpPayload(true, {
          jobId: job.id,
          tool: job.tool,
          status: job.status,
          createdAt: job.createdAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          durationMs: job.durationMs,
          result: job.result,
          error: job.error,
        });
      } catch (err: any) {
        mcpLogError('get_tool_job', err, 'Failed to read tool job');
        return makeMcpPayload(false, undefined, err?.message || 'Failed to read tool job');
      }
    },
  },
];

// ── Export combined registry ────────────────────────────────────────────

export const mcpTools: McpTool[] = [
  ...campaignTools,
  ...campaignReadTools,
  ...plannerTools,
  ...brandvoiceTools,
  ...jobTools,
];

export const mcpToolMap = mcpTools.reduce((acc, tool) => {
  acc[tool.name] = tool;
  return acc;
}, {} as Record<string, McpTool>);

export function getTool(name: string): McpTool | undefined {
  return mcpToolMap[name];
}
