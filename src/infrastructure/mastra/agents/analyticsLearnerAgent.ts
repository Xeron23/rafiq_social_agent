import { Agent } from '@mastra/core/agent';
import { getMastraModel } from '../../ai/modelProvider.js';
import { AIMemoryAggregate } from '../../../domain/analytics/memory.aggregate.js';
import { extractJson } from '../../utils/jsonHelper.js';

export class AnalyticsLearnerAgent {
  private agent: Agent;

  constructor() {
    this.agent = new Agent({
      id: 'rafiq-analytics-learner-agent',
      name: 'rafiq-analytics-learner-agent',
      instructions: `Anda adalah Data Intelligence & Continuous Learning Specialist untuk Rafiqspace.ai.
Tugas Anda adalah menganalisis data performa kampanye (Tahap 5) dan merumuskan PEMBELAJARAN TERTUTUP (Closed-Loop Reflection).
Pembelajaran ini harus dapat diaplikasikan kembali ke:
- Tahap 1 (Content Strategy): seperti penyesuaian audiens, tone, atau positioning brand.
- Tahap 2 (Content Planning): seperti format konten terbaik (Carousel vs Single image), hari posting optimal, atau waktu jeda posting.

Output HARUS berupa JSON valid tanpa markdown formatting dengan struktur:
{
  "reflections": [
    {
      "title": "Judul Temuan Pembelajaran",
      "lesson": "Apa yang dipelajari dari metrik keterlibatan audiens",
      "impact": "Rekomendasi tindakan konkret untuk siklus berikutnya",
      "targetStage": "STAGE_1"
    },
    {
      "title": "Judul Temuan Pembelajaran 2",
      "lesson": "Pola format yang terbukti efektif",
      "impact": "Tindakan otomatis yang diterapkan pada kalender postingan",
      "targetStage": "STAGE_2"
    }
  ]
}`,
      model: getMastraModel(),
    });
  }

  public async analyzeAndReflect(params: {
    recentPostsSummary: string;
    kpiStats: string;
  }): Promise<AIMemoryAggregate[]> {
    const prompt = `Analisis metrik performa berikut dan sintesiskan memori pembelajaran baru:
Ringkasan Postingan:
${params.recentPostsSummary}

Statistik KPI:
${params.kpiStats}

Keluarkan HANYA JSON valid.`;

    const res = await this.agent.generate(prompt);
    const parsed = extractJson(res.text || '');

    if (!parsed.reflections || !Array.isArray(parsed.reflections)) {
      return [];
    }

    return parsed.reflections.map(
      (r: any) =>
        new AIMemoryAggregate(
          crypto.randomUUID(),
          r.title,
          r.lesson,
          r.impact,
          r.targetStage === 'STAGE_1' ? 'STAGE_1' : 'STAGE_2'
        )
    );
  }
}
