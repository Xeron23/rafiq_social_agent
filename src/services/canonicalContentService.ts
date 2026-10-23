import axios from 'axios';
import dotenv from 'dotenv';
import { CanonicalContent } from '../domain/canonicalContent.js';
import { ContentPlanItem } from '../domain/contentPlan.js';
import { Company, Project } from '../domain/tenancy.js';

dotenv.config();

const API_BASE_URL = process.env.OPENAI_BASE_URL || 'https://je.jerouter.web.id/v1';
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'jerouter';
const API_KEY = process.env.OPENAI_API_KEY || '';

function safeJsonParse(raw: string): any {
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(clean);
}

export class CanonicalContentEngine {
  /**
   * Synthesize rich Canonical Content (Single Source of Truth) from an approved Content Plan Item
   */
  public async synthesize(
    company: Company,
    project: Project,
    planItem: ContentPlanItem
  ): Promise<CanonicalContent> {
    const prompt = `You are the Principal Content Research & Synthesis Specialist for Rafiq Worker.
Create a rich, structured, authoritative CANONICAL MASTER CONTENT (Single Source of Truth) for the approved topic.
This canonical piece is NOT yet tied to any specific social platform constraints—it serves as the dense intellectual raw material.

Company Brand Voice:
- Tone: ${company.brandVoice.tone.join(', ')}
- Keywords: ${company.brandVoice.primaryKeywords.join(', ')}
- Guidelines: ${company.brandVoice.guidelines}

Target Audience (ICP):
${project.icpDescription}

Topic to Synthesize:
- Title: ${planItem.topicTitle}
- Content Pillar: ${planItem.contentPillar}
- Initial Hook Angle: ${planItem.hookAngle}

Return ONLY a valid JSON object matching this schema:
{
  "mainThesis": "Core provocative insight or thesis of this content",
  "hooks": [
    { "type": "bold_claim", "text": "Hook text" },
    { "type": "statistic_driven", "text": "Hook text" },
    { "type": "counter_intuitive", "text": "Hook text" }
  ],
  "coreArguments": [
    "Pillar Argument 1 with deep context",
    "Pillar Argument 2 with deep context",
    "Pillar Argument 3 with actionable insight"
  ],
  "supportingFacts": [
    "Empirical case example or industry observation",
    "Technical architectural rationale"
  ],
  "callToActions": [
    "Discussion prompt for peer exchange",
    "Product discovery / trial prompt"
  ],
  "rawMasterDraft": "Full comprehensive master markdown draft capturing all depth, nuance, and structural points."
}`;

    const response = await axios.post(`${API_BASE_URL}/chat/completions`, {
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: 'You produce deeply researched, authoritative canonical master content in valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
    },
      { timeout: 90000, headers: { Authorization: `Bearer ${API_KEY}` } }
    );

    const parsed = safeJsonParse(response.data.choices[0].message.content);

    return {
      id: crypto.randomUUID(),
      planItemId: planItem.id,
      topicTitle: planItem.topicTitle,
      contentPillar: planItem.contentPillar,
      mainThesis: parsed.mainThesis,
      hooks: parsed.hooks,
      coreArguments: parsed.coreArguments,
      supportingFacts: parsed.supportingFacts,
      callToActions: parsed.callToActions,
      rawMasterDraft: parsed.rawMasterDraft,
      createdAt: new Date(),
    };
  }
}
