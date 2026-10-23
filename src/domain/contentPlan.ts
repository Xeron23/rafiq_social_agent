import { z } from 'zod';
import { SocialPlatformTypeSchema } from './tenancy.js';

export const ContentPlanItemStatusSchema = z.enum([
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'canonical_generated',
  'scheduled',
  'published',
]);
export type ContentPlanItemStatus = z.infer<typeof ContentPlanItemStatusSchema>;

export const ContentPlanItemSchema = z.object({
  id: z.string().uuid(),
  sequenceNumber: z.number().int().positive(),
  scheduledDate: z.string(), // YYYY-MM-DD
  contentPillar: z.string().min(1),
  topicTitle: z.string().min(1),
  hookAngle: z.string().min(1),
  targetPlatforms: z.array(SocialPlatformTypeSchema).min(1),
  status: ContentPlanItemStatusSchema.default('pending_approval'),
  feedbackNote: z.string().optional(),
});
export type ContentPlanItem = z.infer<typeof ContentPlanItemSchema>;

export const MatrixApprovalStatusSchema = z.enum([
  'draft',
  'pending_review',
  'approved',
  'revision_requested',
]);
export type MatrixApprovalStatus = z.infer<typeof MatrixApprovalStatusSchema>;

export const ContentPlanMatrixSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  title: z.string().min(1),
  totalItems: z.number().int().positive(),
  status: MatrixApprovalStatusSchema.default('pending_review'),
  items: z.array(ContentPlanItemSchema).min(1),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});
export type ContentPlanMatrix = z.infer<typeof ContentPlanMatrixSchema>;
