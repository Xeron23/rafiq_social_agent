import { z } from 'zod';

export const TrendItemSchema = z.object({
  topic: z.string(),
  headline: z.string(),
  summary: z.string(),
  relevanceScore: z.number().min(0).max(1),
  sourceType: z.enum(['web', 'social', 'news', 'academic']),
  keywords: z.array(z.string()),
});
export type TrendItem = z.infer<typeof TrendItemSchema>;

export const TrendResearchReportSchema = z.object({
  query: z.string(),
  timestamp: z.date().default(() => new Date()),
  keyInsights: z.array(z.string()).min(1),
  trends: z.array(TrendItemSchema).min(1),
  suggestedAngles: z.array(z.string()).min(1),
});
export type TrendResearchReport = z.infer<typeof TrendResearchReportSchema>;

export const CampaignBriefSchema = z.object({
  id: z.string().uuid(),
  applicationId: z.string().uuid(),
  title: z.string().min(1),
  objective: z.string().min(1),
  targetAudience: z.string().min(1),
  selectedPillars: z.array(z.string()).min(1),
  toneOfVoice: z.array(z.string()).min(1),
  durationDays: z.number().int().positive().default(14),
  postFrequencyPerDay: z.number().int().positive().default(1),
  researchReport: TrendResearchReportSchema.optional(),
  createdAt: z.date().default(() => new Date()),
});
export type CampaignBrief = z.infer<typeof CampaignBriefSchema>;
