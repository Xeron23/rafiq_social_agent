// Chat Orchestrator Agent (Phase 3: Conversational ReAct Loop + MCP Tools)
//
// Powered by Mastra / custom LLM provider with access to all 12 MCP Tools:
//   - Campaign: start_campaign, approve_strategy, approve_plan, approve_canonical,
//               authorize_campaign, update_platform_copy
//   - Planner: get_calendar_schedule, schedule_post, publish_instant, reschedule_post
//   - Brand Voice: get_brand_voice, update_brand_voice
//
// The agent reasons in a ReAct loop (Thought -> Action -> Observation -> Response)
// to manage campaigns, inspect calendars, and answer user questions in conversational channels.

import { getMastraModel, AI_CONFIG } from '../../ai/modelProvider.js';
import { mcpTools, mcpToolMap, McpTool } from '../../mcp/tools/index.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export interface AgentChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCall?: {
    tool: string;
    args: any;
  };
  toolResult?: any;
  timestamp?: Date;
}

export interface ReActStep {
  thought: string;
  tool?: string;
  args?: any;
  observation?: any;
}

export interface ChatOrchestrationResult {
  reply: string;
  steps: ReActStep[];
  toolsExecuted: string[];
  sessionHistory: AgentChatMessage[];
}

export class ChatOrchestratorAgent {
  private sessions: Map<string, AgentChatMessage[]> = new Map();

  constructor() {}

  /**
   * Get or create conversation history for a session (WhatsApp phone, Telegram chat ID, Web session)
   */
  public getHistory(sessionId: string): AgentChatMessage[] {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, [
        {
          role: 'system',
          content: this.getSystemPrompt(),
          timestamp: new Date(),
        },
      ]);
    }
    return this.sessions.get(sessionId)!;
  }

  private getSystemPrompt(): string {
    const toolsSummary = mcpTools
      .map((t) => {
        const args = this.describeToolArgs(t);
        return `- **${t.name}**(${args}): ${t.description}`;
      })
      .join('\n');

    return `Anda adalah Socialpal AI Assistant (didukung ekosistem Rafiqspace.ai), digital employee otonom untuk pengelolaan media sosial cerdas.
Anda melayani pengguna melalui antarmuka chat (WhatsApp, Telegram, dan Web Dashboard).

KEMAMPUAN TOOLS ANDA (12 MCP Tools):
${toolsSummary}

ATURAN REASONING (ReAct Loop):
1. Jika pengguna meminta aksi konkret (misal: buat campaign, setujui rencana, jadwalkan postingan, lihat kalender, ubah brand voice):
   - Pilihlah tool yang tepat.
   - Format tool call Anda HARUS berupa JSON block:
     \`\`\`tool_call
     {
       "tool": "nama_tool",
       "args": { ... }
     }
     \`\`\`
2. Jika pengguna hanya bertanya umum, menyapa, atau berkonsultasi, jawab secara langsung dengan ramah, lugas, dan profesional tanpa memanggil tool.
3. Selalu komunikasikan status dengan jelas. Saat tool berhasil dieksekusi, sampaikan hasil utamanya kepada pengguna (misal: ID campaign, status approval, atau jadwal postingan).
4. Gunakan bahasa Indonesia baku namun modern dan profesional.
5. WAJIB: gunakan HANYA nama parameter yang tertera pada daftar tools di atas (dalam tanda kurung setelah nama tool). Jangan mengarang nama parameter sendiri. Jika parameter wajib tidak diketahui (mis. campaignId), panggil tool pembaca yang relevan (list_campaigns) terlebih dahulu.

CONTOH FORMAT TOOL CALL YANG BENAR:
\`\`\`tool_call
{"tool": "get_calendar_schedule", "args": {"month": 10, "year": 2026}}
\`\`\`
Blok \`\`\`bash, \`\`\`sh, atau kode lain DILARANG. Jika tidak perlu tool, balas dengan kalimat biasa tanpa blok kode.`;
  }

  /**
   * Single AI completion call. Timeout is generous (150s) because the upstream
   * router streams slowly (~100s for a full JSON strategy), which otherwise
   * aborts mid-stream and silently degrades the bot to the intent fallback.
   */
  private async callModel(messages: Array<{ role: string; content: string }>): Promise<string> {
    const res = await axios.post(
      `${AI_CONFIG.baseURL}/chat/completions`,
      {
        model: AI_CONFIG.model,
        messages,
        temperature: 0.2,
      },
      {
        timeout: 150000,
        proxy: false,
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY || ''}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return res.data.choices?.[0]?.message?.content || '';
  }

  /**
   * Compacts a tool's Zod input schema into a single line of `key:type` pairs,
   * so the model sees the exact argument names instead of inventing its own
   * (e.g. sending `platform`/`date` to a tool that expects `campaignId`/`dayOfMonth`).
   */
  private describeToolArgs(tool: any): string {
    const shape = tool?.inputSchema?.def?.shape;
    if (!shape) return '';

    const fmt = (node: any): string => {
      const d = node?.def ?? {};
      switch (d.type) {
        case 'optional':
          return `${fmt(d.innerType)}?`;
        case 'default':
          return `${fmt(d.innerType)}?`;
        case 'nullable':
          return fmt(d.innerType);
        case 'enum': {
          const opts = d.options ?? (d.entries ? Object.values(d.entries) : []);
          return `enum(${(opts as any[]).join('|')})`;
        }
        case 'array':
          return `array<${fmt(d.element)}>`;
        case 'object':
          return 'object';
        case 'number':
          return 'number';
        case 'boolean':
          return 'boolean';
        default:
          return 'string';
      }
    };

    return Object.entries(shape)
      .map(([key, node]) => `${key}:${fmt(node)}`)
      .join(', ');
  }

  /**
   * Main conversational entrypoint. Runs a multi-step ReAct loop (max 3 tool iterations).
   */
  public async processMessage(
    sessionId: string,
    userMessage: string
  ): Promise<ChatOrchestrationResult> {
    const history = this.getHistory(sessionId);
    history.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    const steps: ReActStep[] = [];
    const toolsExecuted: string[] = [];
    let currentIteration = 0;
    let repairAttempted = false;
    const maxIterations = 3;
    let finalReply = '';

    while (currentIteration < maxIterations) {
      currentIteration++;

      const promptMessages = history.map((m) => ({
        role: m.role === 'tool' ? 'user' : m.role,
        content: m.content,
      }));

      // Call AI model
      let aiResponseText = '';
      try {
        aiResponseText = await this.callModel(promptMessages);
      } catch (err: any) {
        console.warn(`[ChatOrchestratorAgent] AI call failed (${err.message}). Retrying once...`);
        try {
          aiResponseText = await this.callModel(promptMessages);
        } catch (err2: any) {
          console.warn(`[ChatOrchestratorAgent] AI call failed again (${err2.message}). Using intelligent intent parser.`);
          aiResponseText = this.deterministicIntentParser(userMessage, history);
        }
      }

      // Check if AI requested a tool call
      const toolMatch = aiResponseText.match(/```(?:tool_call|json|tool)\s*([\s\S]*?)\s*```/i);

      // Repair pass: the upstream model occasionally answers with a stray code
      // fence (e.g. ```bash echo ...```) instead of prose or a tool call.
      // Ask it once more, explicitly, before giving up.
      if (!toolMatch && !repairAttempted) {
        const stripped = aiResponseText.replace(/```[\s\S]*?```/g, '').trim();
        const unusable =
          !stripped || stripped.length < 4 || /^echo\b/i.test(stripped) || /^```/.test(aiResponseText.trim());
        if (unusable) {
          repairAttempted = true;
          try {
            aiResponseText = await this.callModel([
              ...promptMessages,
              {
                role: 'user',
                content:
                  'Jawaban sebelumnya tidak valid/kosong. Ulangi sekarang: jawab langsung kepada pengguna dalam bahasa Indonesia, ATAU panggil satu tool dengan format tepat:\n```tool_call\n{"tool":"nama_tool","args":{...}}\n```\nJangan menulis blok ```bash atau kode lain.',
              },
            ]);
            continue;
          } catch {
            // fall through to the graceful fallback below
          }
        }
      }

      if (toolMatch && toolMatch[1]) {
        let toolCallData: { tool: string; args: any } | null = null;
        try {
          toolCallData = JSON.parse(toolMatch[1]);
        } catch (parseErr) {
          console.warn('[ChatOrchestratorAgent] Failed to parse tool_call block:', toolMatch[1]);
        }

        if (toolCallData && mcpToolMap[toolCallData.tool]) {
          const toolName = toolCallData.tool;
          const toolArgs = toolCallData.args || {};
          toolsExecuted.push(toolName);

          const toolObj = mcpToolMap[toolName];
          let executionResult: any = null;

          try {
            const parsedArgs = toolObj.inputSchema.safeParse(toolArgs);
            if (parsedArgs.success) {
              executionResult = await toolObj.execute(parsedArgs.data);
            } else {
              executionResult = {
                success: false,
                error: 'Validasi argumen tool gagal',
                expectedArgs: this.describeToolArgs(toolObj),
                details: parsedArgs.error.errors,
              };
            }
          } catch (execErr: any) {
            executionResult = { success: false, error: execErr.message };
          }

          steps.push({
            thought: aiResponseText.replace(/```tool_call[\s\S]*?```/i, '').trim(),
            tool: toolName,
            args: toolArgs,
            observation: executionResult,
          });

          // Feed observation back into history
          history.push({
            role: 'assistant',
            content: aiResponseText,
            toolCall: { tool: toolName, args: toolArgs },
            timestamp: new Date(),
          });

          history.push({
            role: 'tool',
            content: `[Tool Result of ${toolName}]: ${JSON.stringify(executionResult)}`,
            toolResult: executionResult,
            timestamp: new Date(),
          });

          continue; // Loop again so AI can summarize the tool output to user
        }
      }

      // No further tool calls: this is the final response to user
      finalReply = aiResponseText
        .replace(/```(?:tool_call|json|tool)[\s\S]*?```/gi, '')
        .trim();

      // A reply that is nothing but a code fence is degenerate model output
      if (/^```[\s\S]*```$/.test(finalReply)) {
        finalReply = '';
      }

      // Guard: never leak garbage like "echo try-again" to a human
      const degenerate =
        !finalReply ||
        finalReply.length < 4 ||
        /^echo\b/i.test(finalReply) ||
        /^(try-again|tool_call|bash)$/i.test(finalReply);

      if (degenerate) {
        const lastStep = steps[steps.length - 1];
        if (lastStep && lastStep.observation?.success === false) {
          finalReply =
            `⚠️ Saya belum berhasil menjalankan **${lastStep.tool}** karena parameter yang dikirim tidak sesuai skema.\n\n` +
            `Parameter yang dibutuhkan: \`${this.describeToolArgs(mcpToolMap[String(lastStep.tool)])}\`\n\n` +
            `Coba ulangi dengan menyebutkan detail yang diminta (mis. bulan/tahun, atau ID campaign).`;
        } else if (lastStep && lastStep.observation?.success) {
          finalReply = `✅ **${lastStep.tool}** berhasil dieksekusi.\n\n` +
            JSON.stringify(lastStep.observation.data).slice(0, 600);
        } else {
          finalReply = 'Maaf, saya belum bisa memproses permintaan itu. Bisa dijelaskan lebih spesifik?';
        }
      }
      break;
    }

    // If finalReply is still empty after loop iterations but tools were executed, format a clear summary
    if ((!finalReply || finalReply === 'Baik, instruksi Anda telah berhasil diproses oleh sistem.') && steps.length > 0) {
      const lastStep = steps[steps.length - 1];
      if (lastStep.observation?.success) {
        const obsData = lastStep.observation.data || {};
        if (lastStep.tool === 'start_campaign') {
          finalReply = `🚀 **Kampanye Berhasil Dibuat (Tahap 1)**\n\n` +
            `• **Nama Kampanye:** ${obsData.name || 'Kampanye Baru'}\n` +
            `• **ID Kampanye:** \`${obsData.campaignId}\`\n` +
            `• **Status:** \`${obsData.status}\` (Menunggu persetujuan Anda di Gate 1)\n` +
            `• **Tujuan:** ${obsData.strategy?.goal || '-'}\n\n` +
            `Ketik **"Setujui strategi"** untuk menyetujui dan membuat matriks perencanaan konten.`;
        } else if (lastStep.tool === 'approve_strategy') {
          finalReply = `✅ **Strategi Kampanye Disetujui (Tahap 2)**\n\n` +
            `• **Status:** \`${obsData.status}\`\n` +
            `• **Matriks Konten:** Telah berhasil disusun oleh Planning Agent.\n\n` +
            `Ketik **"Setujui rencana"** untuk melanjutkan ke sintesis materi konten master.`;
        } else if (lastStep.tool === 'approve_plan') {
          finalReply = `✅ **Rencana Konten Disetujui (Tahap 3 & 4)**\n\n` +
            `• **Status:** \`${obsData.status}\`\n` +
            `• Canonical Content & varian platform siap diotorisasi ke kalender.`;
        } else {
          finalReply = `✅ **Aksi ${lastStep.tool} Berhasil Dieksekusi**\n\n${obsData.message || JSON.stringify(obsData)}`;
        }
      } else if (lastStep.observation?.error) {
        finalReply = `⚠️ Terjadi kendala saat mengeksekusi **${lastStep.tool}**: ${lastStep.observation.error}`;
      }
    }

    // Save final response in history
    history.push({
      role: 'assistant',
      content: finalReply,
      timestamp: new Date(),
    });

    return {
      reply: finalReply,
      steps,
      toolsExecuted,
      sessionHistory: history,
    };
  }

  /**
   * Deterministic fallback intent parser if upstream model times out or 504s.
   * Ensures 100% reliable execution even under severe network constraints.
   */
  private deterministicIntentParser(userMessage: string, history: AgentChatMessage[]): string {
    const lower = userMessage.toLowerCase();

    // Check for campaign creation
    if (lower.includes('campaign') || lower.includes('kampanye') || lower.includes('buat konten')) {
      const type = lower.includes('produk') ? 'pp' : lower.includes('pahlawan') || lower.includes('hari besar') ? 'hb' : 'lt';
      return `Saya akan membantu membuat kampanye baru.
\`\`\`tool_call
{
  "tool": "start_campaign",
  "args": {
    "type": "${type}",
    "brief": "${userMessage.replace(/"/g, "'")}",
    "targetChannels": ["li", "ig", "fb", "x"]
  }
}
\`\`\``;
    }

    // Check for approve strategy
    if (lower.includes('setujui strategi') || lower.includes('approve strategi')) {
      const lastCampaignId = this.findRecentCampaignId(history);
      if (lastCampaignId) {
        return `Menyetujui strategi kampanye.
\`\`\`tool_call
{
  "tool": "approve_strategy",
  "args": {
    "campaignId": "${lastCampaignId}",
    "approved": true
  }
}
\`\`\``;
      }
    }

    // Check for approve plan
    if (lower.includes('setujui rencana') || lower.includes('approve plan') || lower.includes('setujui matriks')) {
      const lastCampaignId = this.findRecentCampaignId(history);
      if (lastCampaignId) {
        return `Menyetujui rencana mingguan kampanye.
\`\`\`tool_call
{
  "tool": "approve_plan",
  "args": {
    "campaignId": "${lastCampaignId}",
    "approved": true
  }
}
\`\`\``;
      }
    }

    // Check for context setup / hire
    if (lower.includes('hire') || lower.includes('setup') || lower.includes('mulai') || lower.includes('kenalan') || lower.includes('siapa kamu') || lower.includes('kelola akun')) {
      return `Selamat datang! Saya adalah **Socialpal AI**, digital employee otonom Anda untuk pengelolaan media sosial.

Berikut alur kerja yang bisa kita lakukan bersama dari chat ini:
1. 🏢 **Konfigurasi Brand Voice:** Ketik *"Lihat brand voice"* atau beri tahu gaya bahasa & nilai perusahaan Anda.
2. 🗓️ **Cek Kalender:** Ketik *"Ada event apa bulan ini?"* untuk melihat momen nasional & jadwal rilis.
3. 🚀 **Buat Kampanye:** Ketik misalnya *"Buatkan kampanye Hari Pahlawan 2026"* untuk memulai formulasi strategi (Tahap 1).
4. 🛑 **Macro-HITL Approval:** Setiap strategi & matriks konten akan saya kirimkan ke sini untuk Anda setujui sebelum dijadwalkan.

Perusahaan atau kampanye apa yang ingin kita kelola hari ini?`;
    }

    // Check for calendar
    if (lower.includes('kalender') || lower.includes('jadwal') || lower.includes('event')) {
      return `Mengambil data jadwal kalender nasional.
\`\`\`tool_call
{
  "tool": "get_calendar_schedule",
  "args": {
    "month": 10,
    "year": 2026
  }
}
\`\`\``;
    }

    // Check for brand voice
    if (lower.includes('brand voice') || lower.includes('karakter brand') || lower.includes('nada bicara')) {
      return `Mengambil profil brand voice aktif.
\`\`\`tool_call
{
  "tool": "get_brand_voice",
  "args": {}
}
\`\`\``;
    }

    return `Halo! Saya adalah Socialpal AI Assistant. Saya dapat membantu Anda merancang strategi kampanye, meninjau matriks konten, memeriksa jadwal kalender, dan mengotomasi publikasi media sosial. Ada yang bisa saya bantu hari ini?`;
  }

  private findRecentCampaignId(history: AgentChatMessage[]): string | null {
    for (let i = history.length - 1; i >= 0; i--) {
      const content = history[i].content || '';
      const match = content.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (match) return match[0];
    }
    return null;
  }
}
