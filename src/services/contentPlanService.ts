import axios from 'axios';
import dotenv from 'dotenv';
import { ContentPlanMatrix, ContentPlanItem, MatrixApprovalStatus } from '../domain/contentPlan.js';
import { CampaignBrief } from '../domain/campaign.js';
import { Application } from '../domain/tenancy.js';

dotenv.config();

const API_BASE_URL = process.env.OPENAI_BASE_URL || 'https://je.jerouter.web.id/v1';
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'jerouter';
const API_KEY = process.env.OPENAI_API_KEY || '';

function safeJsonParse(raw: string): any {
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(clean);
}

export class ContentPlanService {
  private matrices: Map<string, ContentPlanMatrix> = new Map();

  /**
   * Generate a batch Content Plan Matrix (e.g. 5–15 topics) from Campaign Brief
   */
  public async generateMatrix(
    campaign: CampaignBrief,
    application: Application,
    itemCount: number = 5
  ): Promise<ContentPlanMatrix> {
    const prompt = `You are the Content Planning Architect for Rafiq Worker.
Generate a structured batch Content Plan Matrix of ${itemCount} high-impact topics for social media publication based on the campaign brief.

Campaign Context:
- Title: ${campaign.title}
- Objective: ${campaign.objective}
- Target ICP: ${campaign.targetAudience}
- Pillars: ${campaign.selectedPillars.join(', ')}
- Available Platforms: ${application.connectedPlatforms.join(', ')}

Return ONLY a valid JSON object matching this schema:
{
  "title": "${campaign.title} - Content Plan Matrix",
  "items": [
    {
      "sequenceNumber": 1,
      "scheduledDate": "2026-10-02",
      "contentPillar": "Selected Pillar Name",
      "topicTitle": "Engaging Topic Headline",
      "hookAngle": "Specific provocative angle or problem-solution hook",
      "targetPlatforms": ["${application.connectedPlatforms[0]}"]
    }
  ]
}`;

    const response = await axios.post(`${API_BASE_URL}/chat/completions`, {
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: 'You produce strictly valid JSON for content planning matrices.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
    },
      { timeout: 90000, headers: { Authorization: `Bearer ${API_KEY}` } }
    );

    const parsed = safeJsonParse(response.data.choices[0].message.content);
    const items: ContentPlanItem[] = parsed.items.map((item: any, idx: number) => ({
      id: crypto.randomUUID(),
      sequenceNumber: item.sequenceNumber || idx + 1,
      scheduledDate: item.scheduledDate || new Date().toISOString().split('T')[0],
      contentPillar: item.contentPillar,
      topicTitle: item.topicTitle,
      hookAngle: item.hookAngle,
      targetPlatforms: item.targetPlatforms || application.connectedPlatforms,
      status: 'pending_approval',
    }));

    const matrix: ContentPlanMatrix = {
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      title: parsed.title || `${campaign.title} Matrix`,
      totalItems: items.length,
      status: 'pending_review',
      items,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.matrices.set(matrix.id, matrix);
    return matrix;
  }

  /**
   * Macro Human-in-the-Loop Gate (1-click Approve All or Reject)
   */
  public updateMatrixApprovalStatus(
    matrixId: string,
    newStatus: MatrixApprovalStatus,
    feedback?: string
  ): ContentPlanMatrix {
    const matrix = this.matrices.get(matrixId);
    if (!matrix) throw new Error(`Matrix with id ${matrixId} not found.`);

    matrix.status = newStatus;
    matrix.updatedAt = new Date();

    if (newStatus === 'approved') {
      matrix.items.forEach((item) => {
        if (item.status === 'pending_approval') {
          item.status = 'approved';
        }
      });
    } else if (newStatus === 'revision_requested') {
      matrix.items.forEach((item) => {
        item.feedbackNote = feedback;
      });
    }

    return matrix;
  }

  /**
   * Conversational Mutation: Adjust a specific item in the matrix via natural language instruction
   */
  public async mutateMatrixItem(
    matrixId: string,
    sequenceNumber: number,
    instruction: string
  ): Promise<ContentPlanItem> {
    const matrix = this.matrices.get(matrixId);
    if (!matrix) throw new Error(`Matrix with id ${matrixId} not found.`);

    const item = matrix.items.find((i) => i.sequenceNumber === sequenceNumber);
    if (!item) throw new Error(`Item sequence #${sequenceNumber} not found in matrix.`);

    const prompt = `Adjust this social media content plan item according to user instruction.

Current Item:
${JSON.stringify(item)}

User Adjustment Instruction:
"${instruction}"

Return ONLY a valid JSON object matching the updated fields:
{
  "topicTitle": "Updated Topic",
  "hookAngle": "Updated Hook",
  "contentPillar": "Updated Pillar"
}`;

    const response = await axios.post(`${API_BASE_URL}/chat/completions`, {
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: 'You modify content plan JSON based on user revision notes.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
    },
      { timeout: 90000, headers: { Authorization: `Bearer ${API_KEY}` } }
    );

    const parsed = safeJsonParse(response.data.choices[0].message.content);
    item.topicTitle = parsed.topicTitle || item.topicTitle;
    item.hookAngle = parsed.hookAngle || item.hookAngle;
    item.contentPillar = parsed.contentPillar || item.contentPillar;
    item.status = 'pending_approval';
    matrix.updatedAt = new Date();

    return item;
  }

  public getMatrix(id: string): ContentPlanMatrix | undefined {
    return this.matrices.get(id);
  }
}
