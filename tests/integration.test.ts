import { describe, it, expect, beforeAll } from 'vitest';
import { createServerApp } from '../src/server/app.js';
import { Company, Project, Application, TenantContextScope } from '../src/domain/tenancy.js';

describe('Domain 8: Master Integration & End-to-End Operational Lifecycle', () => {
  let serverInstance: ReturnType<typeof createServerApp>;

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

  const mockApp: Application = {
    id: 'd0000000-0000-0000-0000-000000000001',
    projectId: mockProject.id,
    companyId: mockCompany.id,
    name: 'Alpha Social Engine',
    connectedPlatforms: ['x', 'linkedin'],
    activeCampaignCount: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const scope: TenantContextScope = {
    companyId: mockCompany.id,
    projectId: mockProject.id,
    applicationId: mockApp.id,
  };

  beforeAll(() => {
    serverInstance = createServerApp();
    serverInstance.tenancyManager.registerCompany(mockCompany);
    serverInstance.tenancyManager.registerProject(mockProject);
    serverInstance.tenancyManager.registerApplication(mockApp);
  });

  it('should execute full lifecycle: Strategy -> Matrix -> HITL Approve -> Canonical -> Multi-Platform -> Queue', async () => {
    // 1. Brief setup
    const brief = await serverInstance.campaignStrategyService.formulateCampaignBrief(
      { company: mockCompany, project: mockProject, application: mockApp },
      'Launch modul Disaster Recovery untuk enterprise CTO bulan ini.'
    );
    expect(brief.title).toBeDefined();

    // 2. Generate Plan Matrix
    const matrix = await serverInstance.contentPlanService.generateMatrix(brief, mockApp, 2);
    expect(matrix.items.length).toBe(2);
    expect(matrix.status).toBe('pending_review');

    // 3. Macro HITL Approval Gate
    const approvedMatrix = serverInstance.contentPlanService.updateMatrixApprovalStatus(matrix.id, 'approved');
    expect(approvedMatrix.status).toBe('approved');
    expect(approvedMatrix.items[0].status).toBe('approved');

    // 4. Canonical Synthesis for Approved Item 1
    const targetItem = approvedMatrix.items[0];
    const canonical = await serverInstance.canonicalContentEngine.synthesize(mockCompany, mockProject, targetItem);
    expect(canonical.mainThesis).toBeDefined();

    // 5. Multi-Platform Adapters Compilation
    const compiled = await serverInstance.multiPlatformAdapterEngine.compileAll(canonical, targetItem.targetPlatforms);
    expect(compiled.x).toBeDefined();
    expect(compiled.linkedin).toBeDefined();

    // 6. Cloud Queue Enqueue
    const jobs = serverInstance.publishingSchedulerService.enqueueCompiledPosts(
      mockApp.id,
      targetItem.id,
      compiled,
      new Date()
    );
    expect(jobs.length).toBe(2);
    expect(jobs[0].status).toBe('queued');

    // 7. Execute Queue Job Handshake
    const published = await serverInstance.publishingSchedulerService.executeJob(jobs[0].id);
    expect(published.status).toBe('published');
  }, 120000);
});
