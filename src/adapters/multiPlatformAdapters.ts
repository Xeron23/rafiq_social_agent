import axios from 'axios';
import dotenv from 'dotenv';
import {
  XPostPayload,
  XPostPayloadSchema,
  LinkedInPostPayload,
  LinkedInPostPayloadSchema,
  InstagramPostPayload,
  InstagramPostPayloadSchema,
  MediumPostPayload,
  MediumPostPayloadSchema,
  CompiledPlatformPosts,
} from '../domain/platformPosts.js';
import { CanonicalContent } from '../domain/canonicalContent.js';
import { SocialPlatformType } from '../domain/tenancy.js';

dotenv.config();

const API_BASE_URL = process.env.OPENAI_BASE_URL || 'https://je.jerouter.web.id/v1';
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'jerouter';
const API_KEY = process.env.OPENAI_API_KEY || '';

function safeJsonParse(raw: string): any {
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(clean);
}

export class MultiPlatformAdapterEngine {
  /**
   * Compile Canonical Content to X (Twitter) format (Single or Thread <=280 chars)
   */
  public async compileX(canonical: CanonicalContent): Promise<XPostPayload> {
    const prompt = `Convert this Canonical Content into an engaging X (Twitter) format.
RULES:
- Every tweet in the array MUST strictly be <= 280 characters.
- If it is a thread, sequence them naturally.
- Use 1-3 high intent hashtags.

Canonical Content:
Thesis: ${canonical.mainThesis}
Hooks: ${JSON.stringify(canonical.hooks)}
Arguments: ${JSON.stringify(canonical.coreArguments)}
Facts: ${JSON.stringify(canonical.supportingFacts)}

Return ONLY a valid JSON object matching:
{
  "type": "single" | "thread",
  "tweets": ["Tweet 1 (max 280 chars)", "Tweet 2 (max 280 chars)"],
  "hashtags": ["tag1", "tag2"]
}`;

    const response = await axios.post(`${API_BASE_URL}/chat/completions`, {
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: 'You are a master X (Twitter) copywriter. Strictly follow character limits.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
    },
      { timeout: 90000, headers: { Authorization: `Bearer ${API_KEY}` } }
    );

    const parsed = safeJsonParse(response.data.choices[0].message.content);
    
    // Deterministic Post-Processing guardrail: truncate or auto-split any tweet exceeding 280 chars
    if (Array.isArray(parsed.tweets)) {
      parsed.tweets = parsed.tweets.map((t: string) => (t.length > 280 ? t.slice(0, 277) + '...' : t));
    }

    return XPostPayloadSchema.parse(parsed);
  }

  /**
   * Compile Canonical Content to LinkedIn format (Professional, whitespace, CTA)
   */
  public async compileLinkedIn(canonical: CanonicalContent): Promise<LinkedInPostPayload> {
    const prompt = `Convert this Canonical Content into a high-engagement LinkedIn post.
RULES:
- Strong hook in the first 2-3 lines (before the "see more" cutoff).
- Generous whitespace and bullet points for readability.
- Clear professional discussion question at the end.
- 3 to 5 relevant hashtags.

Canonical Content:
Thesis: ${canonical.mainThesis}
Hooks: ${JSON.stringify(canonical.hooks)}
Arguments: ${JSON.stringify(canonical.coreArguments)}
CTAs: ${JSON.stringify(canonical.callToActions)}

Return ONLY a valid JSON object matching:
{
  "headline": "Post Headline / Hook",
  "body": "Full body text formatted with markdown / linebreaks",
  "discussionPrompt": "Question for comments",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
}`;

    const response = await axios.post(`${API_BASE_URL}/chat/completions`, {
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: 'You are a top 1% LinkedIn creator and ghostwriter.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
    },
      { timeout: 90000, headers: { Authorization: `Bearer ${API_KEY}` } }
    );

    const parsed = safeJsonParse(response.data.choices[0].message.content);
    return LinkedInPostPayloadSchema.parse(parsed);
  }

  /**
   * Compile Canonical Content to Instagram (Carousel slide concepts + Caption)
   */
  public async compileInstagram(canonical: CanonicalContent): Promise<InstagramPostPayload> {
    const prompt = `Convert this Canonical Content into an Instagram Carousel post.
RULES:
- Provide 3-7 visual slide outlines (Slide Title & Body).
- Engaging caption with emoji styling and clear swipe/save prompt.
- 5 to 10 focused hashtags.

Canonical Content:
Thesis: ${canonical.mainThesis}
Arguments: ${JSON.stringify(canonical.coreArguments)}
CTAs: ${JSON.stringify(canonical.callToActions)}

Return ONLY a valid JSON object matching:
{
  "visualConceptPrompt": "Description of aesthetic/design style for designer/AI image gen",
  "slideCount": 4,
  "carouselSlides": [
    { "slideNumber": 1, "title": "Cover Slide Hook", "body": "Short subtitle" },
    { "slideNumber": 2, "title": "Key Insight", "body": "Explanation" }
  ],
  "caption": "Full Instagram caption text",
  "hashtags": ["tag1", "tag2", "tag3"]
}`;

    const response = await axios.post(`${API_BASE_URL}/chat/completions`, {
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: 'You are an Instagram content strategist specializing in tech carousels.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
    },
      { timeout: 90000, headers: { Authorization: `Bearer ${API_KEY}` } }
    );

    const parsed = safeJsonParse(response.data.choices[0].message.content);
    return InstagramPostPayloadSchema.parse(parsed);
  }

  /**
   * Compile Canonical Content to Medium (Long-form structured markdown)
   */
  public async compileMedium(canonical: CanonicalContent): Promise<MediumPostPayload> {
    const prompt = `Convert this Canonical Content into a deep, long-form Medium article in Markdown.
RULES:
- Clear H1 title, subtitle, and H2 section headings.
- Rich code or quote block examples if relevant.
- Actionable takeaways and closing CTA.
- 3 to 5 tags.

Canonical Content:
Thesis: ${canonical.mainThesis}
Draft: ${canonical.rawMasterDraft}
Arguments: ${JSON.stringify(canonical.coreArguments)}
Facts: ${JSON.stringify(canonical.supportingFacts)}

Return ONLY a valid JSON object matching:
{
  "title": "Article Title",
  "subtitle": "Engaging Subtitle",
  "estimatedReadTimeMinutes": 5,
  "markdownContent": "# Title\\n\\nFull detailed markdown article...",
  "tags": ["DevOps", "Cloud", "Kubernetes"]
}`;

    const response = await axios.post(`${API_BASE_URL}/chat/completions`, {
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: 'You are an executive tech publication editor writing long-form Medium articles.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
    },
      { timeout: 90000, headers: { Authorization: `Bearer ${API_KEY}` } }
    );

    const parsed = safeJsonParse(response.data.choices[0].message.content);
    return MediumPostPayloadSchema.parse(parsed);
  }

  /**
   * Batch compile for all selected target platforms
   */
  public async compileAll(
    canonical: CanonicalContent,
    targetPlatforms: SocialPlatformType[]
  ): Promise<CompiledPlatformPosts> {
    const result: CompiledPlatformPosts = {
      canonicalId: canonical.id,
      planItemId: canonical.planItemId,
      compiledAt: new Date(),
    };

    for (const platform of targetPlatforms) {
      if (platform === 'x') {
        result.x = await this.compileX(canonical);
      } else if (platform === 'linkedin') {
        result.linkedin = await this.compileLinkedIn(canonical);
      } else if (platform === 'instagram') {
        result.instagram = await this.compileInstagram(canonical);
      } else if (platform === 'medium') {
        result.medium = await this.compileMedium(canonical);
      }
    }

    return result;
  }
}
