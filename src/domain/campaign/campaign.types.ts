import { z } from 'zod';

export type ChannelKey = 'li' | 'ig' | 'fb' | 'th' | 'x' | 'md';

export type CampaignType = 'hb' | 'lt' | 'pp';

export type CampaignLifecycleStatus =
  | 'DRAFT'
  | 'STRATEGY_GENERATING'
  | 'STRATEGY_AWAITING_HITL'
  | 'STRATEGY_APPROVED'
  | 'PLAN_GENERATING'
  | 'PLAN_AWAITING_HITL'
  | 'PLAN_APPROVED'
  | 'SYNTHESIS_GENERATING'
  | 'SYNTHESIS_AWAITING_HITL'
  | 'AUTHORIZED'
  | 'COMPLETED';

export interface PersonaVO {
  i: string; // initials (e.g. "RK", "SR")
  n: string; // name & title (e.g. "Raka, 24 · AI engineer junior")
  d: string; // description (e.g. "Aktif di LinkedIn dan Threads...")
}

export interface BrandVoiceProfileVO {
  name: string;
  desc: string;
  formal: number; // 0=Formal, 100=Santai
  warm: number;   // 0=Lugas, 100=Hangat
  simple: number; // 0=Teknis, 100=Sederhana
  keywords: string[];
  guidelines?: string;
}

export interface IBrandVoiceStore {
  getProfile(): BrandVoiceProfileVO;
  getProfileAsync?(): Promise<BrandVoiceProfileVO>;
  updateProfile(profile: Partial<BrandVoiceProfileVO>): BrandVoiceProfileVO;
}

export interface StrategyVO {
  name: string;
  brief: string;
  goal: string;
  market: string;
  personas: PersonaVO[];
  messages: string[];
  tone: string[];
  freq: string;
}

export type PlatformVariantsVO = Record<ChannelKey, string>;

export interface ContentPlanItemVO {
  id: string;
  d: string;        // Date label, e.g. "Sen, 19 Okt"
  dayOfMonth?: number; // Parsed day of month (1..31)
  timeStr?: string; // Optimal posting time, e.g. "08.00"
  topic: string;    // Topic title
  fmt: string;      // Format, e.g. "Single image" | "Carousel" | "Quote card"
  master?: boolean; // Highlighted flagship post
  status?: 'pending' | 'approved';
  caption?: string; // Generated narrative copy for this specific item
  headline?: string;
  platformVariants?: Partial<PlatformVariantsVO>; // Per-platform adapted variants for this item
}

export interface ContentPlanWeekVO {
  w: string; // e.g. "Minggu 1 · 19–25 Oktober"
  items: ContentPlanItemVO[];
}

export interface CanonicalContentVO {
  headline: string;
  sub: string;
  caption: string; // Master comprehensive copy
  tags: string;
  artDirection: {
    visualTheme: string;
    headline: string;
    sub: string;
    brandKit: string;
    aspectRatio: string;
  };
}

export const PersonaSchema = z.object({
  i: z.string(),
  n: z.string(),
  d: z.string(),
});

export const StrategySchema = z.object({
  name: z.string(),
  brief: z.string(),
  goal: z.string(),
  market: z.string(),
  personas: z.array(PersonaSchema),
  messages: z.array(z.string()),
  tone: z.array(z.string()),
  freq: z.string(),
});

export const ContentPlanItemSchema = z.object({
  d: z.string(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  timeStr: z.string().optional(),
  topic: z.string(),
  fmt: z.string(),
  master: z.boolean().optional(),
  caption: z.string().optional(),
  headline: z.string().optional(),
  platformVariants: z.record(z.string(), z.string()).optional(),
});

export const ContentPlanWeekSchema = z.object({
  w: z.string(),
  items: z.array(ContentPlanItemSchema),
});

export const CanonicalContentSchema = z.object({
  headline: z.string(),
  sub: z.string(),
  caption: z.string(),
  tags: z.string(),
  artDirection: z.object({
    visualTheme: z.string(),
    headline: z.string(),
    sub: z.string(),
    brandKit: z.string(),
    aspectRatio: z.string(),
  }),
});
