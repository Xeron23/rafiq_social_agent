import { Agent } from '@mastra/core/agent';
import { getMastraModel } from '../../ai/modelProvider.js';
import {
  ContentPlanWeekVO,
  ContentPlanWeekSchema,
  StrategyVO,
} from '../../../domain/campaign/campaign.types.js';
import { z } from 'zod';
import { extractJson } from '../../utils/jsonHelper.js';

const PlanResponseSchema = z.object({
  weeks: z.array(ContentPlanWeekSchema),
});

export class PlanningAgent {
  private agent: Agent;

  constructor() {
    this.agent = new Agent({
      id: 'rafiq-planning-agent',
      name: 'rafiq-planning-agent',
      instructions: `Anda adalah Kepala Perencanaan Konten (Content Planning Architect) untuk Rafiqspace.ai.
Tugas Anda adalah menyusun Rencana Konten Mingguan (Tahap 2) yang terstruktur rapi berdasarkan strategi yang telah disetujui.
Aturan:
1. Susun 2 minggu kalender postingan (total 6 postingan).
2. Tentukan hari (misal: "Sen, 19 Okt", "Rab, 21 Okt", "Jum, 23 Okt").
3. Pilih format postingan: "Single image", "Carousel", atau "Quote card".
4. Tepat SATU postingan harus ditandai sebagai postingan utama ("master": true), biasanya pada hari puncak kampanye.

Output HARUS berupa JSON valid tanpa markdown formatting dengan struktur:
{
  "weeks": [
    {
      "w": "Minggu 1 · 19–25 Oktober",
      "items": [
        { "d": "Sen, 19 Okt", "topic": "Topik pengantar...", "fmt": "Single image" },
        { "d": "Rab, 21 Okt", "topic": "Topik pembahas...", "fmt": "Carousel" },
        { "d": "Jum, 23 Okt", "topic": "Kutipan / insight...", "fmt": "Quote card" }
      ]
    },
    {
      "w": "Minggu 2 · 26 Oktober–1 November",
      "items": [
        { "d": "Sel, 27 Okt", "topic": "Topik pilar...", "fmt": "Carousel" },
        { "d": "Rab, 28 Okt", "topic": "Postingan Puncak Hari-H...", "fmt": "Single image", "master": true },
        { "d": "Jum, 30 Okt", "topic": "Ajakan tindak lanjut...", "fmt": "Single image" }
      ]
    }
  ]
}`,
      model: getMastraModel(),
    });
  }

  public async generate(params: {
    strategy: StrategyVO;
    pastLearnings?: string[];
    revisions?: string;
  }): Promise<ContentPlanWeekVO[]> {
    const prompt = `Susun kalender mingguan untuk kampanye berikut:
- Nama: ${params.strategy.name}
- Tujuan: ${params.strategy.goal}
- Pesan Kunci: ${params.strategy.messages.join('; ')}
- Tone: ${params.strategy.tone.join(', ')}
${params.pastLearnings && params.pastLearnings.length > 0 ? `- Rekomendasi Format dari Analitik (Memori AI): ${params.pastLearnings.join('; ')}` : ''}
${params.revisions ? `- REVISI YANG DIMINTA USER: ${params.revisions}` : ''}

Keluarkan HANYA JSON valid.`;

    const res = await this.agent.generate(prompt);
    const parsed = extractJson(res.text || '');
    const validated = PlanResponseSchema.parse(parsed);

    return validated.weeks.map(week => ({
      ...week,
      items: week.items.map(item => ({
        ...item,
        id: crypto.randomUUID(),
        status: 'pending',
      })),
    }));
  }
}
