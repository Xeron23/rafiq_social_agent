import { z } from 'zod';

export const HookVariationSchema = z.object({
  type: z.enum(['question', 'counter_intuitive', 'statistic_driven', 'story_starter', 'bold_claim']),
  text: z.string().min(1),
});
export type HookVariation = z.infer<typeof HookVariationSchema>;

export const CanonicalContentSchema = z.object({
  id: z.string().uuid(),
  planItemId: z.string().uuid(),
  topicTitle: z.string().min(1),
  contentPillar: z.string().min(1),
  mainThesis: z.string().min(1),
  hooks: z.array(HookVariationSchema).min(2),
  coreArguments: z.array(z.string()).min(2),
  supportingFacts: z.array(z.string()).min(1),
  callToActions: z.array(z.string()).min(1),
  rawMasterDraft: z.string().min(50),
  createdAt: z.date().default(() => new Date()),
});
export type CanonicalContent = z.infer<typeof CanonicalContentSchema>;
