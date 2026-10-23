import { describe, it, expect } from 'vitest';
import { CanonicalContentEngine } from '../src/services/canonicalContentService.js';
import { Company, Project } from '../src/domain/tenancy.js';
import { ContentPlanItem } from '../src/domain/contentPlan.js';

describe('Domain 5: Canonical Content Synthesis Engine', () => {
  const engine = new CanonicalContentEngine();

  const mockCompany: Company = {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'SaaS Alpha Corp',
    slug: 'saas-alpha',
    brandVoice: {
      tone: ['Authoritative', 'Engineering-First'],
      primaryKeywords: ['Kubernetes', 'Multi-tenant', 'FinOps'],
      negativeKeywords: ['cheap', 'sloppy'],
      targetAudienceSummary: 'CTOs and VP of Engineering',
      guidelines: 'Focus on zero downtime and deterministic architecture.',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProject: Project = {
    id: 'c0000000-0000-0000-0000-000000000001',
    companyId: mockCompany.id,
    name: 'Kubernetes Optimizer',
    slug: 'k8s-opt',
    icpDescription: 'Senior DevOps Engineers and Platform Tech Leads',
    contentPillars: ['Disaster Recovery', 'Zero-Downtime Deployment'],
    defaultGoals: ['Drive signups'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPlanItem: ContentPlanItem = {
    id: 'f0000000-0000-0000-0000-000000000001',
    sequenceNumber: 1,
    scheduledDate: '2026-10-05',
    contentPillar: 'Disaster Recovery',
    topicTitle: 'Mengapa Multi-Region Kubernetes Gagal Saat Terjadi DNS Outage Global',
    hookAngle: '90% insiden outage bukan karena node crash, melainkan kegagalan propagasi kontrol DNS.',
    targetPlatforms: ['x', 'linkedin', 'medium'],
    status: 'approved',
  };

  it('should synthesize a rich Canonical Content object without platform constraint bleed', async () => {
    const canonical = await engine.synthesize(mockCompany, mockProject, mockPlanItem);

    expect(canonical.id).toBeDefined();
    expect(canonical.planItemId).toBe(mockPlanItem.id);
    expect(canonical.mainThesis).toBeDefined();
    expect(canonical.hooks.length).toBeGreaterThanOrEqual(2);
    expect(canonical.coreArguments.length).toBeGreaterThanOrEqual(2);
    expect(canonical.supportingFacts.length).toBeGreaterThanOrEqual(1);
    expect(canonical.callToActions.length).toBeGreaterThanOrEqual(1);
    expect(canonical.rawMasterDraft.length).toBeGreaterThan(100);
  }, 25000);
});
