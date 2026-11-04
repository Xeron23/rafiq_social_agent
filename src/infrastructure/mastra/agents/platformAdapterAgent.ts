import { Agent } from '@mastra/core/agent';
import { getMastraModel } from '../../ai/modelProvider.js';
import twitter from 'twitter-text';
import {
  CanonicalContentVO,
  ChannelKey,
  PlatformVariantsVO,
} from '../../../domain/campaign/campaign.types.js';
import { extractJson } from '../../utils/jsonHelper.js';

export class PlatformAdapterAgent {
  private agent: Agent;

  constructor() {
    this.agent = new Agent({
      id: 'rafiq-platform-adapter-agent',
      name: 'rafiq-platform-adapter-agent',
      instructions: `Anda adalah Spesialis Adaptasi Multi-Platform Media Sosial untuk Rafiqspace.ai.
Tugas Anda adalah mengadaptasi Konten Master (Canonical Content) menjadi salinan teks spesifik untuk setiap platform target:
1. LinkedIn ("li"): Nada profesional, spasi paragraf nyaman, kalimat pembuka tajam, ajakan diskusi di akhir, 3–4 tagar.
2. Instagram ("ig"): Kalimat pertama menarik sebelum "baca selengkapnya", visual friendly, emoji terukur, tagar relevan.
3. Facebook ("fb"): Nada hangat, komunikatif, ajakan berdiskusi dan berbagi (share).
4. Threads ("th"): Ringkas, mengalir santai tapi berbobot, WAJIB di bawah 500 karakter.
5. X / Twitter ("x"): Padat, tajam, menggugah pikiran, WAJIB di bawah 280 karakter.
6. Medium ("md"): Format artikel pengantar pemikiran (thought leadership), pembuka naratif berbobot.

Output HARUS berupa JSON valid tanpa markdown formatting dengan struktur:
{
  "li": "Teks LinkedIn...",
  "ig": "Teks Instagram...",
  "fb": "Teks Facebook...",
  "th": "Teks Threads (maks. 500 karakter)...",
  "x": "Teks X (maks. 280 karakter)...",
  "md": "Teks Medium..."
}`,
      model: getMastraModel(),
    });
  }

  public async adapt(params: {
    canonical: CanonicalContentVO;
    targetChannels: ChannelKey[];
  }): Promise<PlatformVariantsVO> {
    const prompt = `Adaptasikan Konten Master berikut secara utuh dan presisi ke tiap platform:
Headline: ${params.canonical.headline}
Sub-headline: ${params.canonical.sub}
Master Caption (Utuh): ${params.canonical.caption}
Tags: ${params.canonical.tags}

Saluran target: ${params.targetChannels.join(', ')}

Keluarkan HANYA JSON valid. Patuhi batas ketat: X (<=280 karakter) dan Threads (<=500 karakter).`;

    let parsed: any = {};
    try {
      const res = await this.agent.generate(prompt);
      parsed = extractJson(res.text || '');
    } catch (err: any) {
      console.warn(`[PlatformAdapterAgent] AI generation failed (${err.message}). Using deterministic fallback adapter.`);
    }

    // Deterministic post-processing to guarantee 100% platform compliance
    const fallbackCopy = params.canonical.caption;
    const xCandidate = `${params.canonical.headline}. ${params.canonical.sub}\n\n${params.canonical.tags}`;

    const result: PlatformVariantsVO = {
      li: parsed.li || `${params.canonical.headline}\n\n${fallbackCopy}\n\n${params.canonical.tags}`,
      ig: parsed.ig || `${params.canonical.sub}\n\n${fallbackCopy}\n\n${params.canonical.tags}`,
      fb: parsed.fb || `${params.canonical.headline}\n\n${fallbackCopy}`,
      th: parsed.th || (fallbackCopy.length > 450 ? fallbackCopy.slice(0, 447) + '...' : fallbackCopy),
      x: parsed.x || xCandidate,
      md: parsed.md || `# ${params.canonical.headline}\n\n${params.canonical.sub}\n\n${fallbackCopy}`,
    };

    // Rigorous Twitter/X character & weighted length compliance via twitter-text
    if (result.x) {
      let parsedTweet = twitter.parseTweet(result.x);
      if (!parsedTweet.valid) {
        // Truncate based on validRangeEnd from twitter-text
        let safeEnd = parsedTweet.validRangeEnd > 3 ? parsedTweet.validRangeEnd - 3 : parsedTweet.validRangeEnd;
        result.x = result.x.slice(0, safeEnd) + '...';
        // Double-check re-validation
        while (!twitter.parseTweet(result.x).valid && result.x.length > 5) {
          result.x = result.x.slice(0, result.x.length - 4) + '...';
        }
      }
    }

    if (result.th && result.th.length > 500) {
      result.th = result.th.slice(0, 497) + '...';
    }

    return result;
  }
}
