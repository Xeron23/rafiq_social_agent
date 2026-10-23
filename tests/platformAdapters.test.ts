import { describe, it, expect } from 'vitest';
import { MultiPlatformAdapterEngine } from '../src/adapters/multiPlatformAdapters.js';
import { CanonicalContent } from '../src/domain/canonicalContent.js';

describe('Domain 6: Deterministic Multi-Platform Adapters (Zod Validated)', () => {
  const adapterEngine = new MultiPlatformAdapterEngine();

  const mockCanonical: CanonicalContent = {
    id: 'g0000000-0000-0000-0000-000000000001',
    planItemId: 'f0000000-0000-0000-0000-000000000001',
    topicTitle: 'Mengapa Multi-Region Kubernetes Gagal Saat Terjadi DNS Outage Global',
    contentPillar: 'Disaster Recovery',
    mainThesis: 'Multi-region failover sering gagal bukan karena compute down, melainkan DNS TTL cache yang lambat berpindah.',
    hooks: [
      { type: 'bold_claim', text: 'Multi-region tidak menjamin 99.99% uptime jika DNS routing Anda masih terpusat.' },
      { type: 'statistic_driven', text: '73% downtime multi-cloud disebabkan oleh miskonfigurasi anycast DNS.' },
    ],
    coreArguments: [
      'TTL DNS client-side sering di-cache lebih lama oleh ISP lokal.',
      'Health check DNS resolver lambat mendeteksi endpoint mati dibanding BGP anycast.',
      'Solusinya adalah kombinasi Anycast IP BGP dengan automated failover script.',
    ],
    supportingFacts: ['Studi kasus insiden global cloud outage 2024.'],
    callToActions: ['Bagikan strategi DNS failover tim Anda di kolom komentar!'],
    rawMasterDraft: '# Mengapa Multi-Region Kubernetes Gagal Saat Terjadi DNS Outage Global\n\nKetika kita merancang arsitektur multi-region...',
    createdAt: new Date(),
  };

  it('should compile valid X (Twitter) post with strict <=280 character limit per tweet', async () => {
    const xPost = await adapterEngine.compileX(mockCanonical);

    expect(xPost.tweets.length).toBeGreaterThan(0);
    xPost.tweets.forEach((tweet) => {
      expect(tweet.length).toBeLessThanOrEqual(280);
    });
    expect(xPost.hashtags.length).toBeLessThanOrEqual(3);
  }, 25000);

  it('should compile valid LinkedIn post with readable body and discussion prompt', async () => {
    const linkedInPost = await adapterEngine.compileLinkedIn(mockCanonical);

    expect(linkedInPost.headline).toBeDefined();
    expect(linkedInPost.body.length).toBeGreaterThan(50);
    expect(linkedInPost.discussionPrompt).toBeDefined();
    expect(linkedInPost.hashtags.length).toBeLessThanOrEqual(5);
  }, 25000);

  it('should compile valid Instagram post with carousel structure and caption', async () => {
    const igPost = await adapterEngine.compileInstagram(mockCanonical);

    expect(igPost.visualConceptPrompt).toBeDefined();
    expect(igPost.carouselSlides.length).toBeGreaterThan(0);
    expect(igPost.caption.length).toBeGreaterThan(20);
    expect(igPost.hashtags.length).toBeGreaterThanOrEqual(3);
  }, 25000);

  it('should compile valid Medium post with rich markdown', async () => {
    const mediumPost = await adapterEngine.compileMedium(mockCanonical);

    expect(mediumPost.title).toBeDefined();
    expect(mediumPost.markdownContent.length).toBeGreaterThan(150);
    expect(mediumPost.tags.length).toBeGreaterThan(0);
  }, 60000);
});
