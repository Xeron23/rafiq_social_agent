import { Agent } from '@mastra/core/agent';
import { getMastraModel } from '../../ai/modelProvider.js';
import { StrategyVO, StrategySchema, BrandVoiceProfileVO } from '../../../domain/campaign/campaign.types.js';
import { extractJson } from '../../utils/jsonHelper.js';

export class StrategyAgent {
  private agent: Agent;

  constructor() {
    this.agent = new Agent({
      id: 'rafiq-strategy-agent',
      name: 'rafiq-strategy-agent',
      instructions: `Anda adalah Kepala Strategi Media Sosial (Chief Campaign Strategist) untuk Rafiqspace.ai.
Tugas Anda adalah memformulasikan Konsep & Strategi Kampanye Media Sosial (Tahap 1) berdasarkan:
1. Jenis kampanye (Hari Besar, Leadership Thought, Promosi Produk)
2. Target brand voice dan parameter audiens
3. Feedback / pembelajaran dari siklus kampanye sebelumnya.

Output HARUS berupa JSON valid tanpa markdown formatting dengan struktur:
{
  "name": "Judul Kampanye yang menarik dan berbobot",
  "brief": "Penjelasan ringkas narasi kampanye",
  "goal": "Tujuan utama kampanye (misal: memperkuat citra kedaulatan AI, menarik talenta, dll)",
  "market": "Target pasar spesifik dan demografi",
  "personas": [
    { "i": "Inisial 2 huruf", "n": "Nama, umur · profesi", "d": "Deskripsi preferensi medsos dan pain point" },
    { "i": "Inisial 2 huruf", "n": "Nama, umur · profesi", "d": "Deskripsi preferensi medsos dan pain point" }
  ],
  "messages": [
    "Poin pesan kunci 1",
    "Poin pesan kunci 2",
    "Poin pesan kunci 3"
  ],
  "tone": ["Inspiratif", "Hangat", "Visioner"],
  "freq": "3 postingan/minggu"
}`,
      model: getMastraModel(),
    });
  }

  public async generate(params: {
    type: string;
    brief: string;
    brandVoice: BrandVoiceProfileVO;
    pastLearnings?: string[];
    revisions?: string;
  }): Promise<StrategyVO> {
    const prompt = `Formulasikan strategi kampanye media sosial:
- Tipe: ${params.type}
- Brief Awal: ${params.brief || 'Kampanye korporat Rafiqspace.ai'}
- Brand DNA: Formalitas=${params.brandVoice.formal}/100, Kehangatan=${params.brandVoice.warm}/100, Kesederhanaan=${params.brandVoice.simple}/100.
- Brand Keywords: ${params.brandVoice.keywords.join(', ')}
${params.pastLearnings && params.pastLearnings.length > 0 ? `- Pembelajaran Siklus Sebelumnya (Memori AI): ${params.pastLearnings.join('; ')}` : ''}
${params.revisions ? `- REVISI YANG DIMINTA USER: ${params.revisions}` : ''}

Keluarkan HANYA JSON valid.`;

    const res = await this.agent.generate(prompt);
    const parsed = extractJson(res.text || '');
    return StrategySchema.parse(parsed);
  }
}
