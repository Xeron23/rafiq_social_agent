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

export function parseDayOfMonth(dateLabel: string, fallbackDay: number): number {
  const match = dateLabel.match(/\b(\d{1,2})\b/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 31) return num;
  }
  return fallbackDay;
}

export class PlanningAgent {
  private agent: Agent;

  constructor() {
    this.agent = new Agent({
      id: 'rafiq-planning-agent',
      name: 'rafiq-planning-agent',
      instructions: `Anda adalah Kepala Perencanaan Konten (Content Planning Architect) untuk Rafiqspace.ai.
Tugas Anda adalah menyusun Rencana Konten Mingguan (Tahap 2) yang terstruktur rapi berdasarkan strategi yang telah disetujui dan tanggal referensi saat ini.
Aturan:
1. Susun 2 minggu kalender postingan (total 6 postingan).
2. Tentukan hari dan tanggal secara akurat mengikuti kalender bulan berjalan (misal: "Sen, 23 Okt", "Rab, 25 Okt", "Jum, 27 Okt"), sertakan juga "dayOfMonth" (angka 1-31) dan "timeStr" (jam optimal misal "07.30" atau "08.00").
3. Pilih format postingan: "Single image", "Carousel", atau "Quote card".
4. Tepat SATU postingan harus ditandai sebagai postingan utama ("master": true), biasanya pada hari puncak kampanye.

Output HARUS berupa JSON valid tanpa markdown formatting dengan struktur:
{
  "weeks": [
    {
      "w": "Minggu 1 · Rentang Tanggal",
      "items": [
        { "d": "Sen, 19 Okt", "dayOfMonth": 19, "timeStr": "08.00", "topic": "Topik pengantar...", "fmt": "Single image" },
        { "d": "Rab, 21 Okt", "dayOfMonth": 21, "timeStr": "08.30", "topic": "Topik pembahas...", "fmt": "Carousel" },
        { "d": "Jum, 23 Okt", "dayOfMonth": 23, "timeStr": "09.00", "topic": "Kutipan / insight...", "fmt": "Quote card" }
      ]
    },
    {
      "w": "Minggu 2 · Rentang Tanggal",
      "items": [
        { "d": "Sel, 27 Okt", "dayOfMonth": 27, "timeStr": "08.00", "topic": "Topik pilar...", "fmt": "Carousel" },
        { "d": "Rab, 28 Okt", "dayOfMonth": 28, "timeStr": "07.30", "topic": "Postingan Puncak Hari-H...", "fmt": "Single image", "master": true },
        { "d": "Jum, 30 Okt", "dayOfMonth": 30, "timeStr": "10.00", "topic": "Ajakan tindak lanjut...", "fmt": "Single image" }
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
    referenceDate?: Date;
  }): Promise<ContentPlanWeekVO[]> {
    const now = params.referenceDate || new Date();
    const dateContextStr = now.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const prompt = `Susun kalender mingguan untuk kampanye berikut:
- Tanggal Referensi Saat Ini: ${dateContextStr}
- Nama Kampanye: ${params.strategy.name}
- Tujuan: ${params.strategy.goal}
- Pesan Kunci: ${params.strategy.messages.join('; ')}
- Tone: ${params.strategy.tone.join(', ')}
${params.pastLearnings && params.pastLearnings.length > 0 ? `- Rekomendasi Format & Jam dari Analitik (Memori AI): ${params.pastLearnings.join('; ')}` : ''}
${params.revisions ? `- REVISI YANG DIMINTA USER: ${params.revisions}` : ''}

Keluarkan HANYA JSON valid.`;

    const res = await this.agent.generate(prompt);
    const parsed = extractJson(res.text || '');
    const validated = PlanResponseSchema.parse(parsed);

    const defaultSlots = ['07.30', '08.00', '08.30', '09.00', '10.00', '08.00'];
    let fallbackDayCounter = now.getDate();

    return validated.weeks.map((week) => ({
      ...week,
      items: week.items.map((item, idx) => {
        fallbackDayCounter = ((fallbackDayCounter + 1) % 30) + 1;
        const resolvedDay = item.dayOfMonth || parseDayOfMonth(item.d, fallbackDayCounter);
        const resolvedTime = item.timeStr || defaultSlots[idx % defaultSlots.length];
        return {
          ...item,
          id: crypto.randomUUID(),
          dayOfMonth: resolvedDay,
          timeStr: resolvedTime,
          status: 'pending',
        };
      }),
    }));
  }
}
