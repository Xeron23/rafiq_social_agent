import { describe, it, expect } from 'vitest';
import { CampaignStrategyService } from '../src/services/campaignStrategyService.js';
import { Company, Project, Application } from '../src/domain/tenancy.js';

describe('Domain 2 & 3: Trend Research & Campaign Strategy Engine', () => {
  const service = new CampaignStrategyService();

  const mockCompany: Company = {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'SaaS Alpha Corp',
    slug: 'saas-alpha',
    brandVoice: {
      tone: ['Authoritative', 'Data-Driven'],
      primaryKeywords: ['cloud', 'kubernetes', 'scalability'],
      negativeKeywords: ['cheap', 'sloppy'],
      targetAudienceSummary: 'Engineering Directors and CTOs',
      guidelines: 'Focus on uptime and ROI.',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProject: Project = {
    id: 'c0000000-0000-0000-0000-000000000001',
    companyId: mockCompany.id,
    name: 'Kubernetes Optimizer',
    slug: 'k8s-opt',
    icpDescription: 'DevOps leads scaling multi-cloud infrastructure',
    contentPillars: ['Cluster Cost Optimization', 'Zero-Downtime Deployment', 'Observability'],
    defaultGoals: ['Drive trial signups'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockApp: Application = {
    id: 'd0000000-0000-0000-0000-000000000001',
    projectId: mockProject.id,
    companyId: mockCompany.id,
    name: 'Alpha Social Engine',
    connectedPlatforms: ['x', 'linkedin'],
    activeCampaignCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should autonomously discover trends for given project pillars', async () => {
    const report = await service.conductTrendResearch(mockProject, mockProject.contentPillars);

    expect(report.query).toBeDefined();
    expect(report.keyInsights.length).toBeGreaterThan(0);
    expect(report.trends.length).toBeGreaterThan(0);
    expect(report.suggestedAngles.length).toBeGreaterThan(0);
  }, 20000);

  it('should formulate an end-to-end Campaign Brief from user prompt and context', async () => {
    const userIntent = 'Kita mau launch fitur Cluster Cost Auto-Pilot bulan Oktober ini untuk CTO.';
    const brief = await service.formulateCampaignBrief(
      { company: mockCompany, project: mockProject, application: mockApp },
      userIntent
    );

    expect(brief.title).toBeDefined();
    expect(brief.objective).toBeDefined();
    expect(brief.targetAudience).toBeDefined();
    expect(brief.selectedPillars.length).toBeGreaterThan(0);
    expect(brief.toneOfVoice.length).toBeGreaterThan(0);
    expect(brief.durationDays).toBeGreaterThan(0);
  }, 20000);
});
