import { z } from 'zod';
import { SocialPlatformTypeSchema } from './tenancy.js';

export const PublishJobStatusSchema = z.enum(['queued', 'processing', 'published', 'failed']);
export type PublishJobStatus = z.infer<typeof PublishJobStatusSchema>;

export const PublishJobSchema = z.object({
  id: z.string().uuid(),
  applicationId: z.string().uuid(),
  planItemId: z.string().uuid(),
  platform: SocialPlatformTypeSchema,
  payload: z.any(),
  scheduledTime: z.date(),
  status: PublishJobStatusSchema.default('queued'),
  attempts: z.number().default(0),
  publishedAt: z.date().optional(),
  error: z.string().optional(),
});
export type PublishJob = z.infer<typeof PublishJobSchema>;

export const PostPerformanceMetricSchema = z.object({
  jobId: z.string().uuid(),
  platform: SocialPlatformTypeSchema,
  impressions: z.number().int().nonnegative(),
  clicks: z.number().int().nonnegative(),
  engagements: z.number().int().nonnegative(),
  engagementRate: z.number().min(0).max(1),
  topFeedbackTheme: z.string(),
});
export type PostPerformanceMetric = z.infer<typeof PostPerformanceMetricSchema>;

export const ClosedLoopFeedbackSchema = z.object({
  overallSummary: z.string(),
  highestPerformingPillars: z.array(z.string()),
  lowestPerformingPillars: z.array(z.string()),
  proactiveActionableAdvice: z.array(z.string()).min(1),
  recommendedNextCampaignTopics: z.array(z.string()).min(1),
  generatedAt: z.date().default(() => new Date()),
});
export type ClosedLoopFeedback = z.infer<typeof ClosedLoopFeedbackSchema>;
