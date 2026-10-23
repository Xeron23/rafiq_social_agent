import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { StrategyAgent } from '../../infrastructure/mastra/agents/strategyAgent.js';
import { PlanningAgent } from '../../infrastructure/mastra/agents/planningAgent.js';
import { CanonicalAgent } from '../../infrastructure/mastra/agents/canonicalAgent.js';
import { PlatformAdapterAgent } from '../../infrastructure/mastra/agents/platformAdapterAgent.js';
import {
  StrategyVO,
  ContentPlanWeekVO,
  ContentPlanItemVO,
} from '../../domain/campaign/campaign.types.js';

const strategyAgent = new StrategyAgent();
const planningAgent = new PlanningAgent();
const canonicalAgent = new CanonicalAgent();
const platformAdapterAgent = new PlatformAdapterAgent();

// Step 1: Content Strategy (Tahap 1) + HITL Gate 1
export const strategyStep = createStep({
  id: 'step-1-strategy',
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData, getInitData, suspend, resumeData }: any) => {
    const initData = getInitData ? getInitData() : {};

    // If resuming from HITL approval
    if (resumeData) {
      if (resumeData.revisions) {
        // Regenerate with revisions
        const revised = await strategyAgent.generate({
          type: inputData?.type || initData?.type || 'hb',
          brief: inputData?.brief || initData?.brief || '',
          brandVoice: inputData?.brandVoice || initData?.brandVoice,
          pastLearnings: inputData?.pastLearnings || initData?.pastLearnings,
          revisions: resumeData.revisions,
        });
        return suspend({
          strategy: revised,
          awaitingHitl: true,
          message: 'Strategi diperbarui berdasarkan revisi. Menunggu konfirmasi ulang.',
        });
      }
      return { strategy: resumeData.strategy || inputData?.cachedStrategy, approved: true };
    }

    // First run: generate strategy
    const strategy = await strategyAgent.generate({
      type: inputData?.type || initData?.type || 'hb',
      brief: inputData?.brief || initData?.brief || '',
      brandVoice: inputData?.brandVoice || initData?.brandVoice,
      pastLearnings: inputData?.pastLearnings || initData?.pastLearnings,
    });

    // Suspend workflow to wait for HITL Gate 1
    return suspend({
      strategy,
      awaitingHitl: true,
      message: 'Strategi selesai disusun oleh AI Agent. Menunggu persetujuan pengguna (HITL 1).',
    });
  },
});

// Step 2: Content Planning Matrix (Tahap 2) + HITL Gate 2
export const planningStep = createStep({
  id: 'step-2-planning',
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData, getInitData, getStepResult, suspend, resumeData }: any) => {
    const initData = getInitData ? getInitData() : {};
    const prevResult = getStepResult('step-1-strategy');
    const strategy: StrategyVO = prevResult?.strategy || resumeData?.strategy || inputData?.strategy;

    if (resumeData) {
      if (resumeData.revisions) {
        const revisedPlan = await planningAgent.generate({
          strategy,
          pastLearnings: inputData?.pastLearnings || initData?.pastLearnings,
          revisions: resumeData.revisions,
        });
        return suspend({
          contentPlan: revisedPlan,
          awaitingHitl: true,
          message: 'Rencana mingguan diperbarui berdasarkan revisi. Menunggu konfirmasi ulang.',
        });
      }
      return {
        contentPlan: resumeData.contentPlan || inputData?.cachedPlan,
        strategy,
        approved: true,
      };
    }

    const contentPlan = await planningAgent.generate({
      strategy,
      pastLearnings: inputData?.pastLearnings || initData?.pastLearnings,
    });

    // Suspend workflow to wait for HITL Gate 2
    return suspend({
      contentPlan,
      strategy,
      awaitingHitl: true,
      message: 'Rencana mingguan selesai disusun oleh AI Agent. Menunggu persetujuan pengguna (HITL 2).',
    });
  },
});

// Step 3 & 4: Canonical Content & Multi-Platform Adaptation (Tahap 3 & 4) + HITL Gate 3 & 4
export const synthesisStep = createStep({
  id: 'step-3-synthesis',
  inputSchema: z.any(),
  outputSchema: z.any(),
  execute: async ({ inputData, getInitData, getStepResult, suspend, resumeData }: any) => {
    const initData = getInitData ? getInitData() : {};
    const planResult = getStepResult('step-2-planning');
    const strategy: StrategyVO = planResult?.strategy || inputData?.strategy;
    const contentPlan: ContentPlanWeekVO[] = planResult?.contentPlan || resumeData?.contentPlan || inputData?.contentPlan;

    if (resumeData && resumeData.authorized) {
      return {
        canonical: inputData?.canonical,
        platformVariants: inputData?.platformVariants,
        authorized: true,
        customCaptions: resumeData.customCaptions || {},
        scheduleMode: resumeData.scheduleMode || 'planner',
      };
    }

    // Resolve Brand Voice from initial data
    const brandVoice = initData?.brandVoice || inputData?.brandVoice || {
      name: 'Rafiqspace.ai',
      desc: 'Perusahaan AI Indonesia yang membangun solusi AI berdaulat untuk enterprise dan pemerintah.',
      formal: 30,
      warm: 60,
      simple: 55,
      keywords: ['Responsible AI', 'Enterprise Grade', 'Kedaulatan Data', 'Sovereignty'],
    };

    // Find the master post from the plan
    let masterItem: ContentPlanItemVO | undefined = contentPlan
      ?.flatMap(w => w.items)
      .find(i => i.master);

    if (!masterItem && contentPlan && contentPlan.length > 0 && contentPlan[0].items.length > 0) {
      masterItem = contentPlan[0].items[0];
    }

    if (!masterItem) {
      masterItem = {
        id: crypto.randomUUID(),
        d: 'Hari-H',
        topic: strategy?.name || 'Postingan Utama Kampanye',
        fmt: 'Single image',
        master: true,
      };
    }

    // 1. Synthesize Canonical Content (Single Source of Truth)
    const canonical = await canonicalAgent.generate({
      strategy,
      masterItem,
      brandVoice,
    });

    // 2. Parallel Multi-Platform Adaptation
    const targetChannels = initData?.targetChannels || inputData?.targetChannels || ['li', 'ig', 'fb', 'th', 'x', 'md'];
    const platformVariants = await platformAdapterAgent.adapt({
      canonical,
      targetChannels,
    });

    // Suspend to wait for HITL Gate 3 & 4 (Review per platform & final authorization)
    return suspend({
      canonical,
      platformVariants,
      masterItem,
      strategy,
      awaitingHitl: true,
      message: 'Sintesis materi dan adaptasi multi-platform selesai. Menunggu otorisasi final pengguna.',
    });
  },
});

export function buildCampaignWorkflow() {
  return createWorkflow({
    id: 'campaign-agentic-pipeline',
    inputSchema: z.any(),
    outputSchema: z.any(),
  })
    .then(strategyStep)
    .then(planningStep)
    .then(synthesisStep)
    .commit();
}
