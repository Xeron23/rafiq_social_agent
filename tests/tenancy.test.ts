import { describe, it, expect, beforeEach } from 'vitest';
import { TenancyManager } from '../src/services/tenancyService.js';
import { Company, Project, Application } from '../src/domain/tenancy.js';

describe('Domain 1: Context Scoping & Tenancy Isolation', () => {
  let tenancyManager: TenancyManager;

  const mockCompanyA: Company = {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'SaaS Alpha Corp',
    slug: 'saas-alpha',
    brandVoice: {
      tone: ['Authoritative', 'Innovative'],
      primaryKeywords: ['cloud', 'agents', 'scalability'],
      negativeKeywords: ['cheap', 'easy-hack'],
      targetAudienceSummary: 'CTOs and VP of Engineering',
      guidelines: 'Use data-backed statements and precise technical terms.',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCompanyB: Company = {
    id: 'b0000000-0000-0000-0000-000000000002',
    name: 'Fitness Guru Agency',
    slug: 'fitness-guru',
    brandVoice: {
      tone: ['Energetic', 'Empathetic'],
      primaryKeywords: ['health', 'workout', 'wellness'],
      negativeKeywords: ['lethargic', 'steroids'],
      targetAudienceSummary: 'Gym enthusiasts and casual runners',
      guidelines: 'Use vibrant emojis and motivational calls to action.',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProjectA: Project = {
    id: 'c0000000-0000-0000-0000-000000000001',
    companyId: mockCompanyA.id,
    name: 'DevOps Orchestrator Pro',
    slug: 'devops-pro',
    icpDescription: 'Enterprise Tech Leads managing Kubernetes clusters',
    contentPillars: ['CI/CD Optimization', 'Kubernetes Security', 'Cloud Cost Reduction'],
    defaultGoals: ['Drive trial signups', 'Establish thought leadership'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAppA: Application = {
    id: 'd0000000-0000-0000-0000-000000000001',
    projectId: mockProjectA.id,
    companyId: mockCompanyA.id,
    name: 'Alpha Social Media Engine',
    connectedPlatforms: ['x', 'linkedin', 'medium'],
    activeCampaignCount: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    tenancyManager = new TenancyManager();
  });

  it('should register company, project, and application within valid hierarchy', () => {
    tenancyManager.registerCompany(mockCompanyA);
    tenancyManager.registerProject(mockProjectA);
    tenancyManager.registerApplication(mockAppA);

    const scoped = tenancyManager.getScopedContext({
      companyId: mockCompanyA.id,
      projectId: mockProjectA.id,
      applicationId: mockAppA.id,
    });

    expect(scoped.company.name).toBe('SaaS Alpha Corp');
    expect(scoped.project.name).toBe('DevOps Orchestrator Pro');
    expect(scoped.application.connectedPlatforms).toContain('linkedin');
  });

  it('should throw error when registering project under non-existent company', () => {
    expect(() => {
      tenancyManager.registerProject(mockProjectA);
    }).toThrow(/does not exist/);
  });

  it('should prevent cross-tenant context bleed (Company B accessing Project A)', () => {
    tenancyManager.registerCompany(mockCompanyA);
    tenancyManager.registerCompany(mockCompanyB);
    tenancyManager.registerProject(mockProjectA);
    tenancyManager.registerApplication(mockAppA);

    expect(() => {
      tenancyManager.getScopedContext({
        companyId: mockCompanyB.id, // Mismatch!
        projectId: mockProjectA.id,
        applicationId: mockAppA.id,
      });
    }).toThrow(/Security Violation/);
  });
});
