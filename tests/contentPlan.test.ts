import { describe, it, expect, beforeEach } from 'vitest';
import { ContentPlanService } from '../src/services/contentPlanService.js';
import { CampaignBrief } from '../src/domain/campaign.js';
import { Application } from '../src/domain/tenancy.js';

describe('Domain 4: Content Plan Matrix & Macro-HITL State Machine', () => {
  let service: ContentPlanService;

  const mockApp: Application = {
    id: 'd0000000-0000-0000-0000-000000000001',
    projectId: 'c0000000-0000-0000-0000-000000000001',
    companyId: 'a0000000-0000-0000-0000-000000000001',
    name: 'Alpha Social Media Engine',
    connectedPlatforms: ['x', 'linkedin', 'medium'],
    activeCampaignCount: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCampaign: CampaignBrief = {
    id: 'e0000000-0000-0000-0000-000000000001',
    applicationId: mockApp.id,
    title: 'October Multi-Cloud Resilience Launch',
    objective: 'Generate 20 enterprise demo leads',
    targetAudience: 'CTOs and VP of Engineering',
    selectedPillars: ['Disaster Recovery', 'Zero-Downtime Deployment', 'FinOps'],
    toneOfVoice: ['Authoritative', 'Pragmatic'],
    durationDays: 14,
    postFrequencyPerDay: 1,
    createdAt: new Date(),
  };

  beforeEach(() => {
    service = new ContentPlanService();
  });

  it('should generate a structured Content Plan Matrix with requested item count', async () => {
    const matrix = await service.generateMatrix(mockCampaign, mockApp, 3);

    expect(matrix.id).toBeDefined();
    expect(matrix.campaignId).toBe(mockCampaign.id);
    expect(matrix.totalItems).toBe(3);
    expect(matrix.items.length).toBe(3);
    expect(matrix.status).toBe('pending_review');

    matrix.items.forEach((item) => {
      expect(item.sequenceNumber).toBeDefined();
      expect(item.topicTitle).toBeDefined();
      expect(item.hookAngle).toBeDefined();
      expect(item.status).toBe('pending_approval');
    });
  }, 25000);

  it('should execute 1-click Macro-HITL Approval across all items', async () => {
    const matrix = await service.generateMatrix(mockCampaign, mockApp, 2);
    expect(matrix.status).toBe('pending_review');

    const approvedMatrix = service.updateMatrixApprovalStatus(matrix.id, 'approved');
    expect(approvedMatrix.status).toBe('approved');
    approvedMatrix.items.forEach((item) => {
      expect(item.status).toBe('approved');
    });
  }, 25000);

  it('should support natural language conversational mutation on a specific item', async () => {
    const matrix = await service.generateMatrix(mockCampaign, mockApp, 2);
    const item1 = matrix.items[0];

    const updated = await service.mutateMatrixItem(
      matrix.id,
      item1.sequenceNumber,
      'Ganti sudut pandangnya agar lebih fokus pada insiden outage CrowdStrike dan langkah pencegahannya.'
    );

    expect(updated.sequenceNumber).toBe(item1.sequenceNumber);
    expect(updated.topicTitle).toBeDefined();
    expect(updated.hookAngle).toBeDefined();
  }, 25000);
});
