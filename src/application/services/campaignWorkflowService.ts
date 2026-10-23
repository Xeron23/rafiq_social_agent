import { Mastra } from '@mastra/core';
import { buildCampaignWorkflow } from '../workflows/campaignWorkflow.js';
import { StrategyAgent } from '../../infrastructure/mastra/agents/strategyAgent.js';
import { PlanningAgent } from '../../infrastructure/mastra/agents/planningAgent.js';
import { CanonicalAgent } from '../../infrastructure/mastra/agents/canonicalAgent.js';
import { PlatformAdapterAgent } from '../../infrastructure/mastra/agents/platformAdapterAgent.js';
import { CampaignAggregate } from '../../domain/campaign/campaign.aggregate.js';
import { ICampaignRepository } from '../../domain/campaign/campaign.repository.js';
import { IPostRepository, PostAggregate } from '../../domain/planner/post.aggregate.js';
import { IMemoryRepository } from '../../domain/analytics/memory.aggregate.js';
import {
  CampaignType,
  ChannelKey,
  StrategyVO,
  ContentPlanWeekVO,
  CanonicalContentVO,
  PlatformVariantsVO,
  IBrandVoiceStore,
} from '../../domain/campaign/campaign.types.js';

export class CampaignWorkflowService {
  private mastra: Mastra;
  private activeRuns: Map<string, any> = new Map(); // campaignId -> mastraRun
  private strategyAgent = new StrategyAgent();
  private planningAgent = new PlanningAgent();
  private canonicalAgent = new CanonicalAgent();
  private platformAdapterAgent = new PlatformAdapterAgent();

  constructor(
    private campaignRepo: ICampaignRepository,
    private postRepo: IPostRepository,
    private memoryRepo: IMemoryRepository,
    private brandVoiceStore: IBrandVoiceStore
  ) {
    const workflow = buildCampaignWorkflow();
    this.mastra = new Mastra({
      workflows: {
        campaignPipeline: workflow,
      },
    });
  }

  /**
   * TAHAP 1: Start Campaign & Formulate Strategy
   */
  public async initiateCampaign(params: {
    type: CampaignType;
    brief?: string;
    targetChannels?: ChannelKey[];
  }): Promise<{ campaign: CampaignAggregate; suspendedData: any }> {
    const id = crypto.randomUUID();
    const brandVoice = this.brandVoiceStore.getProfile();
    const channels = params.targetChannels || ['li', 'ig', 'fb', 'th', 'x', 'md'];

    const defaultNames: Record<CampaignType, string> = {
      hb: 'Konten Hari Besar',
      lt: 'Leadership Thought Series',
      pp: 'Promosi Produk & Solusi B2B',
    };

    const campaign = CampaignAggregate.create({
      id,
      name: defaultNames[params.type] || 'Kampanye Baru',
      type: params.type,
      targetChannels: channels,
      brandVoice,
    });

    // Ingest past Stage 1 memory reflections for closed-loop continuous improvement
    const pastStage1Memories = await this.memoryRepo.findByStage('STAGE_1');
    const pastLearnings = pastStage1Memories.map(m => `${m.title}: ${m.lesson}`);

    const workflow = this.mastra.getWorkflow('campaignPipeline');
    const run = await workflow.createRun();
    this.activeRuns.set(id, run);

    // Execute step 1
    const runResult = await run.start({
      inputData: {
        type: params.type,
        brief: params.brief || '',
        brandVoice,
        pastLearnings,
        targetChannels: channels,
      },
    });

    const suspendedStep: any = runResult.steps?.['step-1-strategy'];
    const suspendedData =
      suspendedStep?.suspendPayload ||
      (runResult as any)?.suspendPayload?.['step-1-strategy'] ||
      suspendedStep?.payload ||
      suspendedStep?.output ||
      {};

    if (suspendedData.strategy) {
      campaign.setStrategyGenerated(suspendedData.strategy as StrategyVO);
    }

    await this.campaignRepo.save(campaign);
    return { campaign, suspendedData };
  }

  /**
   * HITL GATE 1: Approve or Request Revision for Strategy
   */
  public async handleStrategyHitl(
    campaignId: string,
    action: { approved: boolean; revisions?: string }
  ): Promise<{ campaign: CampaignAggregate; stepResult?: any }> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

    const run = this.activeRuns.get(campaignId);
    if (!run) {
      // In-memory run not found (e.g. server restart or state re-hydration).
      // Seamlessly fallback to direct Mastra agent execution while maintaining domain aggregate state.
      if (!action.approved && action.revisions) {
        campaign.requestStrategyRevision(action.revisions);
        const pastMemories = await this.memoryRepo.findByStage('STAGE_1');
        const revised = await this.strategyAgent.generate({
          type: campaign.type,
          brief: campaign.strategy?.brief || '',
          brandVoice: this.brandVoiceStore.getProfile(),
          pastLearnings: pastMemories.map(m => `${m.title}: ${m.lesson}`),
          revisions: action.revisions,
        });
        campaign.setStrategyGenerated(revised);
        await this.campaignRepo.save(campaign);
        return { campaign, stepResult: { strategy: revised } };
      }

      if (campaign.status === 'STRATEGY_AWAITING_HITL') {
        campaign.approveStrategy();
        await this.campaignRepo.save(campaign);
      }

      const pastStage2Memories = await this.memoryRepo.findByStage('STAGE_2');
      const pastLearnings = pastStage2Memories.map(m => `${m.title}: ${m.lesson}`);
      const contentPlan = await this.planningAgent.generate({
        strategy: campaign.strategy!,
        pastLearnings,
      });
      campaign.setContentPlanGenerated(contentPlan);
      await this.campaignRepo.save(campaign);
      return { campaign, stepResult: { contentPlan } };
    }

    if (!action.approved && action.revisions) {
      campaign.requestStrategyRevision(action.revisions);
      // Resume step 1 with revisions
      const res = await run.resume({
        stepId: 'step-1-strategy',
        resumeData: { revisions: action.revisions },
      });
      const suspendedData = res.steps?.['step-1-strategy']?.payload || {};
      if (suspendedData.strategy) {
        campaign.setStrategyGenerated(suspendedData.strategy);
      }
      await this.campaignRepo.save(campaign);
      return { campaign, stepResult: suspendedData };
    }

    // Approved: approve in aggregate (idempotent guard)
    if (campaign.status === 'STRATEGY_AWAITING_HITL') {
      campaign.approveStrategy();
      await this.campaignRepo.save(campaign);
    }

    // Ingest Stage 2 memories
    const pastStage2Memories = await this.memoryRepo.findByStage('STAGE_2');
    const pastLearnings = pastStage2Memories.map(m => `${m.title}: ${m.lesson}`);

    // Resume run to advance to Step 2 (Content Planning)
    const resumeRes = await run.resume({
      stepId: 'step-1-strategy',
      resumeData: { strategy: campaign.strategy, approved: true, pastLearnings },
    });

    const planStep: any = resumeRes.steps?.['step-2-planning'];
    const planData =
      planStep?.suspendPayload ||
      (resumeRes as any)?.suspendPayload?.['step-2-planning'] ||
      planStep?.payload ||
      planStep?.output ||
      {};

    if (planData.contentPlan) {
      campaign.setContentPlanGenerated(planData.contentPlan as ContentPlanWeekVO[]);
      await this.campaignRepo.save(campaign);
    }

    return { campaign, stepResult: planData };
  }

  /**
   * HITL GATE 2: Approve or Request Revision for Content Plan
   */
  public async handlePlanHitl(
    campaignId: string,
    action: { approved: boolean; revisions?: string }
  ): Promise<{ campaign: CampaignAggregate; stepResult?: any }> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

    const run = this.activeRuns.get(campaignId);
    if (!run) {
      // In-memory run not found (e.g. server restart or state re-hydration).
      // Seamlessly fallback to direct Mastra agent execution while maintaining domain aggregate state.
      if (!action.approved && action.revisions) {
        campaign.requestPlanRevision(action.revisions);
        const pastStage2Memories = await this.memoryRepo.findByStage('STAGE_2');
        const pastLearnings = pastStage2Memories.map(m => `${m.title}: ${m.lesson}`);
        const revisedPlan = await this.planningAgent.generate({
          strategy: campaign.strategy!,
          pastLearnings,
          revisions: action.revisions,
        });
        campaign.setContentPlanGenerated(revisedPlan);
        await this.campaignRepo.save(campaign);
        return { campaign, stepResult: { contentPlan: revisedPlan } };
      }

      if (campaign.status === 'PLAN_AWAITING_HITL') {
        campaign.approveContentPlan();
        await this.campaignRepo.save(campaign);
      }

      const brandVoice = this.brandVoiceStore.getProfile();
      let masterItem = campaign.contentPlan?.flatMap(w => w.items).find(i => i.master)
        || campaign.contentPlan?.[0]?.items?.[0]
        || { id: crypto.randomUUID(), d: 'Hari-H', topic: campaign.strategy?.name || campaign.name, fmt: 'Single image', master: true };

      const canonical = await this.canonicalAgent.generate({
        strategy: campaign.strategy!,
        masterItem,
        brandVoice,
      });

      const platformVariants = await this.platformAdapterAgent.adapt({
        canonical,
        targetChannels: campaign.targetChannels,
      });

      campaign.setSynthesisCompleted(canonical, platformVariants);
      await this.campaignRepo.save(campaign);
      return { campaign, stepResult: { canonical, platformVariants } };
    }

    if (!action.approved && action.revisions) {
      campaign.requestPlanRevision(action.revisions);
      const res = await run.resume({
        stepId: 'step-2-planning',
        resumeData: { revisions: action.revisions },
      });
      const planData = res.steps?.['step-2-planning']?.payload || {};
      if (planData.contentPlan) {
        campaign.setContentPlanGenerated(planData.contentPlan);
      }
      await this.campaignRepo.save(campaign);
      return { campaign, stepResult: planData };
    }

    // Approved (idempotent guard)
    if (campaign.status === 'PLAN_AWAITING_HITL') {
      campaign.approveContentPlan();
      await this.campaignRepo.save(campaign);
    }

    // Resume run to advance to Step 3 & 4 (Synthesis & Multi-Platform)
    const resumeRes = await run.resume({
      stepId: 'step-2-planning',
      resumeData: { contentPlan: campaign.contentPlan, approved: true },
    });

    const synthesisStep: any = resumeRes.steps?.['step-3-synthesis'];
    const synthesisData =
      synthesisStep?.suspendPayload ||
      (resumeRes as any)?.suspendPayload?.['step-3-synthesis'] ||
      synthesisStep?.payload ||
      synthesisStep?.output ||
      {};

    if (synthesisData.canonical && synthesisData.platformVariants) {
      campaign.setSynthesisCompleted(
        synthesisData.canonical as CanonicalContentVO,
        synthesisData.platformVariants as PlatformVariantsVO
      );
      await this.campaignRepo.save(campaign);
    }

    return { campaign, stepResult: synthesisData };
  }

  /**
   * TAHAP 4 (HITL GATE 4): Customize copy & Authorize final publishing
   */
  public async updatePlatformCopy(
    campaignId: string,
    channel: ChannelKey,
    copy: string
  ): Promise<CampaignAggregate> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

    campaign.updatePlatformCopy(channel, copy);
    await this.campaignRepo.save(campaign);
    return campaign;
  }

  public async authorizeCampaign(params: {
    campaignId: string;
    customCaptions?: Partial<PlatformVariantsVO>;
    scheduleMode?: 'planner' | 'instant';
  }): Promise<{ campaign: CampaignAggregate; scheduledPosts: PostAggregate[] }> {
    const campaign = await this.campaignRepo.findById(params.campaignId);
    if (!campaign) throw new Error(`Campaign ${params.campaignId} not found`);

    if (params.customCaptions) {
      for (const [ch, copy] of Object.entries(params.customCaptions)) {
        if (copy) campaign.updatePlatformCopy(ch as ChannelKey, copy);
      }
    }

    const scheduleMode = params.scheduleMode || 'planner';
    if (campaign.status === 'SYNTHESIS_AWAITING_HITL') {
      campaign.authorize(scheduleMode);
      await this.campaignRepo.save(campaign);
    }

    // Create PostAggregate entries and commit to IPostRepository
    const allPosts = await this.postRepo.findAll();
    let nextId = allPosts.length > 0 ? Math.max(...allPosts.map(p => p.id)) + 1 : 10;

    const scheduledPosts: PostAggregate[] = [];
    const activeChannels = campaign.targetChannels;

    // Convert plan items into calendar post aggregates
    if (campaign.contentPlan) {
      const typeLabelMap: Record<string, string> = {
        hb: 'Konten Hari Besar',
        lt: 'Leadership Thought',
        pp: 'Promosi Produk',
      };
      const contentType = typeLabelMap[campaign.type] || 'Leadership Thought';
      let dayCounter = 20; // Default schedule start
      for (const week of campaign.contentPlan) {
        for (const item of week.items) {
          const isMaster = !!item.master;
          const status = scheduleMode === 'instant' && isMaster ? 'terbit' : 'terjadwal';
          const stage = isMaster ? 'Postingan Utama' : 'Terjadwal di Kalender';
          const caption = isMaster
            ? (campaign.customCaptions['li'] || campaign.platformVariants['li'] || campaign.canonicalContent?.caption || item.topic)
            : item.topic;

          const post = new PostAggregate(
            nextId++,
            dayCounter++,
            '10.00',
            item.topic,
            item.topic.length > 30 ? item.topic.slice(0, 27) + '...' : item.topic,
            contentType,
            status,
            activeChannels,
            caption,
            stage,
            `${item.d} · 10.00`,
            campaign.id,
            campaign.strategy?.name || campaign.name
          );
          scheduledPosts.push(post);
        }
      }
    }

    await this.postRepo.saveBatch(scheduledPosts);
    return { campaign, scheduledPosts };
  }

  public async getCampaign(id: string): Promise<CampaignAggregate | null> {
    return this.campaignRepo.findById(id);
  }

  public async listCampaigns(): Promise<CampaignAggregate[]> {
    return this.campaignRepo.findAll();
  }
}
