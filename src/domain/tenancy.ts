import { z } from 'zod';

export const BrandVoiceSchema = z.object({
  tone: z.array(z.string()).min(1),
  primaryKeywords: z.array(z.string()).default([]),
  negativeKeywords: z.array(z.string()).default([]),
  targetAudienceSummary: z.string(),
  guidelines: z.string().default(''),
});
export type BrandVoice = z.infer<typeof BrandVoiceSchema>;

export const CompanySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  brandVoice: BrandVoiceSchema,
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});
export type Company = z.infer<typeof CompanySchema>;

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  icpDescription: z.string(),
  contentPillars: z.array(z.string()).min(1),
  defaultGoals: z.array(z.string()).default([]),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});
export type Project = z.infer<typeof ProjectSchema>;

export const SocialPlatformTypeSchema = z.enum(['x', 'linkedin', 'instagram', 'medium']);
export type SocialPlatformType = z.infer<typeof SocialPlatformTypeSchema>;

export const ApplicationSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  companyId: z.string().uuid(),
  name: z.string().min(1),
  connectedPlatforms: z.array(SocialPlatformTypeSchema).min(1),
  activeCampaignCount: z.number().default(0),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});
export type Application = z.infer<typeof ApplicationSchema>;

export const TenantContextScopeSchema = z.object({
  companyId: z.string().uuid(),
  projectId: z.string().uuid(),
  applicationId: z.string().uuid(),
});
export type TenantContextScope = z.infer<typeof TenantContextScopeSchema>;
