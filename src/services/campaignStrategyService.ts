import axios from 'axios';
import dotenv from 'dotenv';
import { TrendResearchReport, CampaignBrief } from '../domain/campaign.js';
import { Company, Project, Application } from '../domain/tenancy.js';

dotenv.config();

const API_BASE_URL = process.env.OPENAI_BASE_URL || 'https://je.jerouter.web.id/v1';
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'jerouter';
const API_KEY = process.env.OPENAI_API_KEY || '';

function safeJsonParse(raw: string): any {
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(clean);
}

export class CampaignStrategyService {
  /**
   * Autonomous Trend Research & Social Listening
   */
  public async conductTrendResearch(
    project: Project,
    topics: string[]
  ): Promise<TrendResearchReport> {
    const prompt = `You are an expert Social Media Trend Researcher and Market Intelligence Agent for Rafiq Worker.
Analyze the target project and content pillars to synthesize current market trends, audience pain points, and viral angles.

Project Context:
- Name: ${project.name}
- Target ICP: ${project.icpDescription}
- Focus Pillars: ${topics.join(', ')}

Return ONLY a valid JSON object matching this schema:
{
  "query": "Synthesized search keywords",
  "keyInsights": ["Insight 1", "Insight 2", "Insight 3"],
  "trends": [
    {
      "topic": "Specific Trend Name",
      "headline": "Punchy Trend Headline",
      "summary": "Brief 2-sentence breakdown of what is happening in the industry",
      "relevanceScore": 0.95,
      "sourceType": "social",
      "keywords": ["tag1", "tag2"]
    }
  ],
  "suggestedAngles": ["Hook Angle 1", "Hook Angle 2", "Hook Angle 3"]
}`;

    const response = await axios.post(`${API_BASE_URL}/chat/completions`, {
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: 'You extract and synthesize actionable market intelligence in valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
    },
      { timeout: 90000, headers: { Authorization: `Bearer ${API_KEY}` } }
    );

    const parsed = safeJsonParse(response.data.choices[0].message.content);
    return {
      ...parsed,
      timestamp: new Date(),
    };
  }

  /**
   * Conversational Campaign Brief Synthesizer
   */
  public async formulateCampaignBrief(
    context: { company: Company; project: Project; application: Application },
    userIntent: string,
    research?: TrendResearchReport
  ): Promise<CampaignBrief> {
    const prompt = `You are a Chief Campaign Strategist Agent for Rafiq Worker.
Based on the client company brand DNA, project ICP, user conversational prompt, and trend research, formulate an end-to-end structured Campaign Brief.

Company Brand Voice: ${JSON.stringify(context.company.brandVoice)}
Project ICP: ${context.project.icpDescription}
Project Pillars: ${context.project.contentPillars.join(', ')}
Connected Platforms: ${context.application.connectedPlatforms.join(', ')}
User Intent: "${userIntent}"
${research ? `Trend Intelligence: ${JSON.stringify(research.keyInsights)}` : ''}

Return ONLY a valid JSON object matching this schema:
{
  "title": "Campaign Name",
  "objective": "Clear measurable objective",
  "targetAudience": "Refined ICP for this campaign",
  "selectedPillars": ["Pillar 1", "Pillar 2"],
  "toneOfVoice": ["Tone 1", "Tone 2"],
  "durationDays": 14,
  "postFrequencyPerDay": 1
}`;

    const response = await axios.post(`${API_BASE_URL}/chat/completions`, {
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: 'You are an executive marketing strategist AI returning structured campaign JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
    },
      { timeout: 90000, headers: { Authorization: `Bearer ${API_KEY}` } }
    );

    const parsed = safeJsonParse(response.data.choices[0].message.content);
    return {
      id: crypto.randomUUID(),
      applicationId: context.application.id,
      title: parsed.title,
      objective: parsed.objective,
      targetAudience: parsed.targetAudience,
      selectedPillars: parsed.selectedPillars,
      toneOfVoice: parsed.toneOfVoice,
      durationDays: parsed.durationDays || 14,
      postFrequencyPerDay: parsed.postFrequencyPerDay || 1,
      researchReport: research,
      createdAt: new Date(),
    };
  }
}
