import axios from 'axios';
import dotenv from 'dotenv';
import {
  PublishJob,
  PostPerformanceMetric,
  ClosedLoopFeedback,
  ClosedLoopFeedbackSchema,
} from '../domain/publishingAndAnalytics.js';
import { CompiledPlatformPosts } from '../domain/platformPosts.js';
import { SocialPlatformType } from '../domain/tenancy.js';

dotenv.config();

const API_BASE_URL = process.env.OPENAI_BASE_URL || 'https://je.jerouter.web.id/v1';
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'jerouter';
const API_KEY = process.env.OPENAI_API_KEY || '';

function safeJsonParse(raw: string): any {
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(clean);
}

export class PublishingSchedulerService {
  private queue: Map<string, PublishJob> = new Map();

  /**
   * Enqueue compiled posts for cloud background distribution
   */
  public enqueueCompiledPosts(
    applicationId: string,
    planItemId: string,
    compiled: CompiledPlatformPosts,
    scheduledTime: Date
  ): PublishJob[] {
    const jobs: PublishJob[] = [];

    const platforms: SocialPlatformType[] = ['x', 'linkedin', 'instagram', 'medium'];
    for (const p of platforms) {
      if ((compiled as any)[p]) {
        const job: PublishJob = {
          id: crypto.randomUUID(),
          applicationId,
          planItemId,
          platform: p,
          payload: (compiled as any)[p],
          scheduledTime,
          status: 'queued',
          attempts: 0,
        };
        this.queue.set(job.id, job);
        jobs.push(job);
      }
    }

    return jobs;
  }

  /**
   * Execute cloud distribution worker (simulates API publish handshake)
   */
  public async executeJob(jobId: string): Promise<PublishJob> {
    const job = this.queue.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found in queue.`);

    job.status = 'processing';
    job.attempts += 1;

    // Simulate API network latency & publish handshake
    await new Promise((res) => setTimeout(res, 50));

    job.status = 'published';
    job.publishedAt = new Date();
    return job;
  }

  public getJob(id: string): PublishJob | undefined {
    return this.queue.get(id);
  }

  public getAllJobs(): PublishJob[] {
    return Array.from(this.queue.values());
  }
}

export class ClosedLoopAnalyticsService {
  /**
   * Synthesize proactive strategic feedback from collected post performance metrics
   */
  public async generateClosedLoopFeedback(
    metrics: PostPerformanceMetric[],
    campaignTitle: string
  ): Promise<ClosedLoopFeedback> {
    const prompt = `You are the Lead Data & Strategy Analytics Agent for Rafiq Worker.
Analyze the following post performance metrics across platforms and provide proactive data-driven insights for future campaigns.

Campaign: ${campaignTitle}
Performance Data:
${JSON.stringify(metrics, null, 2)}

Return ONLY a valid JSON object matching:
{
  "overallSummary": "2-3 sentence executive synthesis of performance",
  "highestPerformingPillars": ["Pillar Name"],
  "lowestPerformingPillars": ["Pillar Name"],
  "proactiveActionableAdvice": [
    "Insight 1: What worked and why",
    "Insight 2: Timing or hook adjustment"
  ],
  "recommendedNextCampaignTopics": [
    "Suggested Topic 1 for next sprint",
    "Suggested Topic 2 for next sprint"
  ]
}`;

    const response = await axios.post(`${API_BASE_URL}/chat/completions`, {
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: 'You are an executive social media data intelligence analyst.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
    },
      { timeout: 90000, headers: { Authorization: `Bearer ${API_KEY}` } }
    );

    const parsed = safeJsonParse(response.data.choices[0].message.content);
    return ClosedLoopFeedbackSchema.parse({
      ...parsed,
      generatedAt: new Date(),
    });
  }
}
