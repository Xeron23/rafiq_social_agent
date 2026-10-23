import { z } from 'zod';

export const XPostPayloadSchema = z.object({
  type: z.enum(['single', 'thread']),
  tweets: z.array(z.string().min(1).max(280)).min(1),
  hashtags: z.array(z.string()).max(3),
});
export type XPostPayload = z.infer<typeof XPostPayloadSchema>;

export const LinkedInPostPayloadSchema = z.object({
  headline: z.string().min(1),
  body: z.string().min(50).max(3000),
  discussionPrompt: z.string().min(1),
  hashtags: z.array(z.string()).max(5),
});
export type LinkedInPostPayload = z.infer<typeof LinkedInPostPayloadSchema>;

export const InstagramPostPayloadSchema = z.object({
  visualConceptPrompt: z.string().min(1),
  slideCount: z.number().int().min(1).max(10),
  carouselSlides: z.array(
    z.object({
      slideNumber: z.number(),
      title: z.string(),
      body: z.string(),
    })
  ).min(1),
  caption: z.string().min(20).max(2200),
  hashtags: z.array(z.string()).min(3).max(15),
});
export type InstagramPostPayload = z.infer<typeof InstagramPostPayloadSchema>;

export const MediumPostPayloadSchema = z.object({
  title: z.string().min(5),
  subtitle: z.string().min(5),
  estimatedReadTimeMinutes: z.number().int().positive(),
  markdownContent: z.string().min(200),
  tags: z.array(z.string()).min(1).max(5),
});
export type MediumPostPayload = z.infer<typeof MediumPostPayloadSchema>;

export const CompiledPlatformPostsSchema = z.object({
  canonicalId: z.string().uuid(),
  planItemId: z.string().uuid(),
  x: XPostPayloadSchema.optional(),
  linkedin: LinkedInPostPayloadSchema.optional(),
  instagram: InstagramPostPayloadSchema.optional(),
  medium: MediumPostPayloadSchema.optional(),
  compiledAt: z.date().default(() => new Date()),
});
export type CompiledPlatformPosts = z.infer<typeof CompiledPlatformPostsSchema>;
