import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastAckWorker } from '../src/application/services/fastAckWorker.js';
import { ChatOrchestratorAgent } from '../src/infrastructure/mastra/agents/chatOrchestratorAgent.js';
import { createServerApp } from '../src/server/app.js';
import { Server } from 'http';

describe('Phase 3 — Dual-Channel Conversational Orchestrator & Fast-ACK Engine', () => {
  let agent: ChatOrchestratorAgent;
  let worker: FastAckWorker;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    agent = new ChatOrchestratorAgent();
    worker = new FastAckWorker(agent);
    const serverBundle = createServerApp();
    const app = serverBundle.app;

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr: any = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('1. FastAckWorker: enqueues message instantly (< 50ms) and creates a valid job', () => {
    const t0 = performance.now();
    const { job, ackResponse } = worker.enqueue({
      channel: 'whatsapp',
      senderId: '6281234567890',
      userMessage: 'Ada jadwal event apa saja di kalender bulan ini?',
    });
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(50);
    expect(ackResponse.success).toBe(true);
    expect(ackResponse.ack).toBe(true);
    expect(ackResponse.jobId).toBeDefined();
    expect(ackResponse.message).toContain('kalender');
    expect(job.status).toBe('QUEUED');
  });

  it('2. POST /api/webhooks/whatsapp: returns Fast-ACK in < 800ms', async () => {
    const t0 = performance.now();
    const res = await fetch(`${baseUrl}/api/webhooks/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: '6281234567890',
        body: 'Buatkan campaign Hari Pahlawan 2026',
      }),
    });
    const elapsed = performance.now() - t0;
    const body: any = await res.json();

    expect(elapsed).toBeLessThan(800);
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.ack).toBe(true);
    expect(body.jobId).toBeDefined();
    expect(body.channel).toBe('whatsapp');
  });

  it('3. POST /api/webhooks/telegram: returns Fast-ACK in < 800ms', async () => {
    const t0 = performance.now();
    const res = await fetch(`${baseUrl}/api/webhooks/telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        update_id: 10001,
        message: {
          chat: { id: 1391982793 },
          text: 'Bagaimana parameter brand voice aktif kita?',
        },
      }),
    });
    const elapsed = performance.now() - t0;
    const body: any = await res.json();

    expect(elapsed).toBeLessThan(800);
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.ack).toBe(true);
    expect(body.jobId).toBeDefined();
    expect(body.channel).toBe('telegram');
  });

  it('4. POST /api/chat/agent (async mode): returns immediate job ID for client polling', async () => {
    const res = await fetch(`${baseUrl}/api/chat/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'web-session-test',
        message: 'Jadwalkan postingan pengantar ke LinkedIn',
        mode: 'async',
      }),
    });
    const body: any = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.ack).toBe(true);
    expect(body.jobId).toBeDefined();

    // Verify job polling route
    const jobRes = await fetch(`${baseUrl}/api/webhooks/jobs/${body.jobId}`);
    const jobBody: any = await jobRes.json();
    expect(jobRes.status).toBe(200);
    expect(jobBody.job.jobId).toBe(body.jobId);
    expect(['QUEUED', 'PROCESSING', 'COMPLETED']).toContain(jobBody.job.status);
  });

  it('5. GET /api/webhooks/jobs: lists recent background jobs', async () => {
    const res = await fetch(`${baseUrl}/api/webhooks/jobs`);
    const body: any = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.jobs)).toBe(true);
  });
});
