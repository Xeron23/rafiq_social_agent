// Fast-ACK Background Worker Service (Phase 3: Dual-Channel Engine)
//
// Implements the Fast-ACK pattern (< 800ms) for high-latency conversational channels (WhatsApp, Telegram, Web):
// 1. Immediately acknowledges webhook requests with HTTP 200 and a friendly instant notice (e.g. "⏳ Sedang merumuskan...").
// 2. Offloads the heavy LLM ReAct loop + MCP tools execution to an asynchronous background worker.
// 3. Records execution metrics, tool traces, and state in memory + allows polling or outbound delivery.

import { ChatOrchestratorAgent, ChatOrchestrationResult } from '../../infrastructure/mastra/agents/chatOrchestratorAgent.js';
import { telegramNotifier } from '../../infrastructure/telegram/telegramNotificationService.js';

export type ChannelSource = 'whatsapp' | 'telegram' | 'web';
export type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface FastAckJob {
  jobId: string;
  channel: ChannelSource;
  senderId: string;
  userMessage: string;
  status: JobStatus;
  fastAckReply: string;
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  result?: ChatOrchestrationResult;
  error?: string;
}

export class FastAckWorker {
  private jobs: Map<string, FastAckJob> = new Map();
  private agent: ChatOrchestratorAgent;

  constructor(agent?: ChatOrchestratorAgent) {
    this.agent = agent || new ChatOrchestratorAgent();
  }

  /**
   * Generates a conversational quick acknowledgment message in < 5ms
   */
  private generateAckNotice(channel: ChannelSource, text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('campaign') || lower.includes('kampanye') || lower.includes('buat konten')) {
      return '⏳ Siap! Saya sedang merumuskan strategi kampanye dan menganalisis DNA brand voice Rafiqspace.ai...';
    }
    if (lower.includes('setujui') || lower.includes('approve')) {
      return '⏳ Baik, instruksi persetujuan Anda sedang diproses ke sistem kalender dan platform publisher...';
    }
    if (lower.includes('kalender') || lower.includes('jadwal')) {
      return '⏳ Sedang memeriksa data kalender dan event nasional...';
    }
    return '⏳ Pesan Anda diterima. Asisten AI sedang memproses...';
  }

  /**
   * Enqueues an inbound message, triggers non-blocking execution, and returns instant ACK payload
   */
  public enqueue(params: {
    channel: ChannelSource;
    senderId: string;
    userMessage: string;
    sessionId?: string;
  }): { job: FastAckJob; ackResponse: { success: boolean; ack: boolean; jobId: string; message: string } } {
    const jobId = crypto.randomUUID();
    const effectiveSessionId = params.sessionId || `${params.channel}:${params.senderId}`;
    const fastAckReply = this.generateAckNotice(params.channel, params.userMessage);

    const job: FastAckJob = {
      jobId,
      channel: params.channel,
      senderId: params.senderId,
      userMessage: params.userMessage,
      status: 'QUEUED',
      fastAckReply,
      queuedAt: new Date(),
    };

    this.jobs.set(jobId, job);

    // Asynchronous background execution (Zero blocking on HTTP thread)
    setImmediate(async () => {
      job.status = 'PROCESSING';
      job.startedAt = new Date();
      const t0 = performance.now();

      try {
        console.log(`[FastAckWorker] 🚀 Processing job ${jobId} for [${params.channel}:${params.senderId}]...`);
        const result = await this.agent.processMessage(effectiveSessionId, params.userMessage);
        const duration = Math.round(performance.now() - t0);

        job.status = 'COMPLETED';
        job.completedAt = new Date();
        job.durationMs = duration;
        job.result = result;

        console.log(`[FastAckWorker] ✅ Job ${jobId} finished in ${duration}ms (Tools used: ${result.toolsExecuted.join(', ') || 'none'})`);

        // Outbound push: automatically send the agent's finalized reply back to Telegram
        if (params.channel === 'telegram' && params.senderId) {
          await telegramNotifier.sendMessage(result.reply, params.senderId);
        }
      } catch (err: any) {
        const duration = Math.round(performance.now() - t0);
        job.status = 'FAILED';
        job.completedAt = new Date();
        job.durationMs = duration;
        job.error = err?.message || String(err);
        console.error(`[FastAckWorker] ❌ Job ${jobId} failed in ${duration}ms:`, err);
      }
    });

    return {
      job,
      ackResponse: {
        success: true,
        ack: true,
        jobId,
        message: fastAckReply,
      },
    };
  }

  public getJob(jobId: string): FastAckJob | undefined {
    return this.jobs.get(jobId);
  }

  public listRecentJobs(limit: number = 20): FastAckJob[] {
    return Array.from(this.jobs.values())
      .sort((a, b) => b.queuedAt.getTime() - a.queuedAt.getTime())
      .slice(0, limit);
  }
}
