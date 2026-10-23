// In-memory registry for long-running tool executions.
//
// Why: MCP clients (Claude Desktop, Inspector, n8n) abort a tool call after
// ~30-60s, but the campaign tools call an LLM and legitimately need 25-120s.
// Instead of failing, heavy tools return { jobId } immediately and the client
// polls `get_tool_job`.
//
// Trade-off: jobs live in process memory. A restart drops the *audit trail*
// (not the business data - that is already persisted in PostgreSQL by the
// domain services). TTL + max-size keep memory bounded.

import crypto from 'node:crypto';

export type ToolJobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ToolJob {
  id: string;
  tool: string;
  status: ToolJobStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  result?: unknown;
  error?: string;
}

/** Tools that call an LLM and routinely exceed client-side timeouts. */
export const ASYNC_TOOLS = new Set([
  'start_campaign',
  'approve_strategy',
  'approve_plan',
  'approve_canonical',
]);

const MAX_JOBS = 200;
const TTL_MS = 60 * 60 * 1000; // 1 hour

class ToolJobRegistry {
  private jobs = new Map<string, ToolJob>();

  /** Stores a job and starts `runner` in the background (never blocks the caller). */
  public enqueue(tool: string, runner: () => Promise<unknown>): ToolJob {
    this.prune();

    const job: ToolJob = {
      id: crypto.randomUUID(),
      tool,
      status: 'QUEUED',
      createdAt: new Date(),
    };
    this.jobs.set(job.id, job);

    setImmediate(async () => {
      job.status = 'PROCESSING';
      job.startedAt = new Date();
      const t0 = Date.now();
      try {
        job.result = await runner();
        job.status = 'COMPLETED';
      } catch (err: any) {
        job.status = 'FAILED';
        job.error = err?.message || String(err);
      } finally {
        job.completedAt = new Date();
        job.durationMs = Date.now() - t0;
        console.log(`[McpJob] ${job.tool} ${job.id} -> ${job.status} (${job.durationMs}ms)`);
      }
    });

    return job;
  }

  public get(id: string): ToolJob | undefined {
    return this.jobs.get(id);
  }

  public list(limit = 20): ToolJob[] {
    return Array.from(this.jobs.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /** Drops finished jobs older than TTL, then enforces the size cap. */
  private prune(): void {
    const now = Date.now();
    for (const [id, job] of this.jobs) {
      const finished = job.status === 'COMPLETED' || job.status === 'FAILED';
      const endedAt = job.completedAt?.getTime() ?? job.createdAt.getTime();
      if (finished && now - endedAt > TTL_MS) this.jobs.delete(id);
    }
    if (this.jobs.size > MAX_JOBS) {
      const sorted = Array.from(this.jobs.values()).sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );
      for (const job of sorted.slice(0, this.jobs.size - MAX_JOBS)) {
        this.jobs.delete(job.id);
      }
    }
  }
}

export const toolJobs = new ToolJobRegistry();
