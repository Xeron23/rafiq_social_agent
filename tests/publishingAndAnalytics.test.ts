import { describe, it, expect } from 'vitest';
import {
  PublishingSchedulerService,
  ClosedLoopAnalyticsService,
} from '../src/services/publishingAndAnalyticsService.js';
import { CompiledPlatformPosts } from '../src/domain/platformPosts.js';
import { PostPerformanceMetric } from '../src/domain/publishingAndAnalytics.js';

describe('Domain 7 & 8: Cloud Queue Scheduler & Closed-Loop Analytics Loop', () => {
  const scheduler = new PublishingSchedulerService();
  const analytics = new ClosedLoopAnalyticsService();

  const mockCompiled: CompiledPlatformPosts = {
    canonicalId: 'g0000000-0000-0000-0000-000000000001',
    planItemId: 'f0000000-0000-0000-0000-000000000001',
    x: {
      type: 'single',
      tweets: ['DNS multi-region failover tips for CTOs.'],
      hashtags: ['DevOps', 'Cloud'],
    },
    linkedin: {
      headline: 'DNS Outage Failover',
      body: 'Here is how to ensure your multi-region cluster stays up during global DNS outages...',
      discussionPrompt: 'What is your current TTL strategy?',
      hashtags: ['Kubernetes', 'SRE'],
    },
    compiledAt: new Date(),
  };

  it('should enqueue and execute background publishing jobs', async () => {
    const jobs = scheduler.enqueueCompiledPosts(
      'd0000000-0000-0000-0000-000000000001',
      mockCompiled.planItemId,
      mockCompiled,
      new Date()
    );

    expect(jobs.length).toBe(2); // X and LinkedIn
    expect(jobs[0].status).toBe('queued');

    const publishedJob = await scheduler.executeJob(jobs[0].id);
    expect(publishedJob.status).toBe('published');
    expect(publishedJob.publishedAt).toBeDefined();
  });

  it('should synthesize proactive closed-loop feedback from raw engagement metrics', async () => {
    const mockMetrics: PostPerformanceMetric[] = [
      {
        jobId: 'h0000000-0000-0000-0000-000000000001',
        platform: 'linkedin',
        impressions: 4500,
        clicks: 320,
        engagements: 410,
        engagementRate: 0.091,
        topFeedbackTheme: 'SRE engineers loved the DNS TTL breakdown.',
      },
      {
        jobId: 'h0000000-0000-0000-0000-000000000002',
        platform: 'x',
        impressions: 8900,
        clicks: 450,
        engagements: 620,
        engagementRate: 0.069,
        topFeedbackTheme: 'Viral retweets on the CrowdStrike incident angle.',
      },
    ];

    const feedback = await analytics.generateClosedLoopFeedback(
      mockMetrics,
      'October Multi-Cloud Resilience Launch'
    );

    expect(feedback.overallSummary).toBeDefined();
    expect(feedback.highestPerformingPillars.length).toBeGreaterThan(0);
    expect(feedback.proactiveActionableAdvice.length).toBeGreaterThan(0);
    expect(feedback.recommendedNextCampaignTopics.length).toBeGreaterThan(0);
  }, 25000);
});
