import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PlatformAdapterAgent } from '../src/infrastructure/mastra/agents/platformAdapterAgent.js';
import { CanonicalContentVO, BrandVoiceProfileVO } from '../src/domain/campaign/campaign.types.js';
import { CampaignAggregate } from '../src/domain/campaign/campaign.aggregate.js';
import twitter from 'twitter-text';

describe('P0 & P1 Hardening Unit Tests', () => {
  it('1. PlatformAdapterAgent: enforces strict twitter-text parsing limits on X copy', async () => {
    const adapter = new PlatformAdapterAgent();
    const canonical: CanonicalContentVO = {
      headline: 'Kedaulatan AI Indonesia Bukan Sekadar Wacana Retorika',
      sub: 'Membangun infrastruktur LLM mandiri berbasis open-source yang aman untuk data nasional dan enterprise.',
      caption: 'Kedaulatan kecerdasan artifisial (AI Sovereignty) adalah keharusan mutlak di era transformasi digital. ' +
        'Kunjungi tautan resmi kami https://rafiqspace.ai/research/enterprise-sovereign-ai-paper-2026 dan https://github.com/Xeron23/rafiq_social_agent ' +
        'untuk membaca manifesto kedaulatan data dan teknologi mandiri.',
      tags: '#AISovereignty #IndonesiaBisa #TechIndependence #EnterpriseGrade #SecureData',
    };

    const variants = await adapter.adapt({
      canonical,
      targetChannels: ['x', 'th', 'li'],
    });

    expect(variants.x).toBeDefined();
    // Validate via official twitter-text parser
    const parsed = twitter.parseTweet(variants.x!);
    expect(parsed.valid).toBe(true);
    expect(parsed.weightedLength).toBeLessThanOrEqual(280);

    // Threads length constraint check
    expect(variants.th!.length).toBeLessThanOrEqual(500);
  });

  it('2. Optimistic Concurrency & Versioning in CampaignAggregate', () => {
    const defaultVoice: BrandVoiceProfileVO = {
      name: 'Rafiqspace.ai',
      desc: '',
      formal: 30,
      warm: 60,
      simple: 55,
      keywords: ['Sovereignty'],
    };

    const campaign = CampaignAggregate.create({
      id: 'test-agg-1',
      name: 'Test Campaign',
      type: 'hb',
      targetChannels: ['li', 'x'],
      brandVoice: defaultVoice,
      version: 1,
    });

    expect(campaign.version).toBe(1);
    expect(campaign.status).toBe('DRAFT');

    // Simulate events recording
    const events = campaign.pullDomainEvents();
    expect(events.length).toBe(1);
    expect(events[0].eventName).toBe('CampaignCreated');
    expect(events[0].eventId).toBeDefined();

    // Pulling again should be empty (drained)
    expect(campaign.pullDomainEvents().length).toBe(0);
  });
});
