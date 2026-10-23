import { Agent } from '@mastra/core/agent';
import { getMastraModel } from '../../ai/modelProvider.js';
import {
  CanonicalContentVO,
  CanonicalContentSchema,
  StrategyVO,
  ContentPlanItemVO,
  BrandVoiceProfileVO,
} from '../../../domain/campaign/campaign.types.js';
import { extractJson } from '../../utils/jsonHelper.js';

export class CanonicalAgent {
  private agent: Agent;

  constructor() {
    this.agent = new Agent({
      id: 'rafiq-canonical-agent',
      name: 'rafiq-canonical-agent',
      instructions: `Anda adalah Principal Content Synthesizer & Creative Director untuk Rafiqspace.ai.
Tugas Anda adalah memproduksi KONTEN MASTER (Canonical Content) dan Arahan Seni Visual (Visual Art Direction) untuk topik postingan utama (Tahap 3).
Konten ini adalah SINGLE SOURCE OF TRUTH yang kaya konteks, narasi berbobot, dan tidak terdistorsi batasan karakter platform.

Output HARUS berupa JSON valid tanpa markdown formatting dengan struktur:
{
  "headline": "Judul Utama yang Menarik dan Berwibawa",
  "sub": "Sub-judul atau Konteks Momen",
  "caption": "Teks narasi master yang lengkap, terstruktur, mencakup pembuka, isi argumen mendalam, nilai kedaulatan data, dan penutup",
  "tags": "#HashtagUtama #HashtagKedua #HashtagKetiga",
  "artDirection": {
    "visualTheme": "Deskripsi komposisi visual, tata letak teks, dan ornamen grafis",
    "headline": "Headline visual untuk artwork",
    "sub": "Sub-headline untuk artwork",
    "brandKit": "Brand Kit Locked (Deep Navy, Electric Purple #5F27CD, Cyan #00C2FF)",
    "aspectRatio": "1:1 Square & 4:5 Vertical"
  }
}`,
      model: getMastraModel(),
    });
  }

  public async generate(params: {
    strategy: StrategyVO;
    masterItem: ContentPlanItemVO;
    brandVoice: BrandVoiceProfileVO;
    revisions?: string;
  }): Promise<CanonicalContentVO> {
    const prompt = `Sintesis Konten Master (Canonical Content) untuk postingan utama berikut:
- Topik Postingan: ${params.masterItem.topic} (Format: ${params.masterItem.fmt}, Tanggal: ${params.masterItem.d})
- Kampanye: ${params.strategy.name}
- Tujuan: ${params.strategy.goal}
- Pesan Kunci: ${params.strategy.messages.join('; ')}
- Tone: ${params.strategy.tone.join(', ')}
- Brand Voice: ${params.brandVoice.name} - ${params.brandVoice.desc}
${params.revisions ? `- REVISI YANG DIMINTA USER: ${params.revisions}` : ''}

Keluarkan HANYA JSON valid.`;

    try {
      const res = await this.agent.generate(prompt);
      const parsed = extractJson(res.text || '');
      return CanonicalContentSchema.parse(parsed);
    } catch (err: any) {
      console.warn(`[CanonicalAgent] Upstream AI generation failed (${err?.message}). Falling back to deterministic synthesis.`);
      const tags = (params.strategy.tone || []).map(t => `#${t.replace(/\s+/g, '')}`).concat(['#ResponsibleAI', '#KedaulatanData']).slice(0, 4).join(' ');
      return CanonicalContentSchema.parse({
        headline: params.masterItem.topic,
        sub: params.strategy.name,
        caption: `${params.masterItem.topic}\n\n${params.strategy.goal}\n\n${params.strategy.messages.join('\n\n')}\n\n${tags}`,
        tags,
        artDirection: {
          visualTheme: 'Komposisi visual korporat modern bernuansa dark navy dengan aksen electric purple (#5F27CD) dan cyan (#00C2FF).',
          headline: params.masterItem.topic,
          sub: params.strategy.name,
          brandKit: 'Brand Kit Locked (Deep Navy, Electric Purple #5F27CD, Cyan #00C2FF)',
          aspectRatio: '1:1 Square & 4:5 Vertical',
        },
      });
    }
  }
}
