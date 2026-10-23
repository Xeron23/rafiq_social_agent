import { z } from 'zod';
import { TenantContextScopeSchema } from './tenancy.js';
import { ContentPlanMatrixSchema } from './contentPlan.js';
import { CampaignBriefSchema } from './campaign.js';

export const ChatSessionStateSchema = z.enum([
  'UNINITIALIZED',
  'CONTEXT_LOCKED',
  'ADVISORY',
  'PLANNING_MATRIX_READY',
  'CAMPAIGN_SCHEDULED_ACTIVE'
]);
export type ChatSessionState = z.infer<typeof ChatSessionStateSchema>;

export const ChatIntentTypeSchema = z.enum([
  'SETUP_CONTEXT',
  'ADVISORY_QUERY',
  'TRIGGER_CAMPAIGN_PLAN',
  'TWEAK_CONTENT_PLAN',
  'APPROVE_MACRO_PLAN',
  'FETCH_ANALYTICS',
  'GENERAL_CHAT'
]);
export type ChatIntentType = z.infer<typeof ChatIntentTypeSchema>;

export const ChatWidgetPayloadSchema = z.object({
  type: z.enum(['NONE', 'CONTEXT_CARD', 'CONTENT_PLAN_MATRIX', 'QUEUE_CONFIRMATION', 'ANALYTICS_DASHBOARD']),
  data: z.any().optional(),
});
export type ChatWidgetPayload = z.infer<typeof ChatWidgetPayloadSchema>;

export const ChatMessageResponseSchema = z.object({
  sessionId: z.string().uuid(),
  currentState: ChatSessionStateSchema,
  detectedIntent: ChatIntentTypeSchema,
  textResponse: z.string(),
  widget: ChatWidgetPayloadSchema,
  scope: TenantContextScopeSchema.optional(),
  timestamp: z.date().default(() => new Date()),
});
export type ChatMessageResponse = z.infer<typeof ChatMessageResponseSchema>;

export interface ChatSessionRecord {
  sessionId: string;
  state: ChatSessionState;
  scope?: z.infer<typeof TenantContextScopeSchema>;
  currentBrief?: z.infer<typeof CampaignBriefSchema>;
  currentMatrix?: z.infer<typeof ContentPlanMatrixSchema>;
  history: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}
