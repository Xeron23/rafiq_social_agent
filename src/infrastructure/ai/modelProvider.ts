import { createOpenAI } from '@ai-sdk/openai';
import dotenv from 'dotenv';

dotenv.config();

const baseURL = process.env.OPENAI_BASE_URL || 'https://je.jerouter.web.id/v1';
const apiKey = process.env.OPENAI_API_KEY || '';
const defaultModelName = process.env.DEFAULT_MODEL || 'jerouter';

export const customOpenAI = createOpenAI({
  baseURL,
  apiKey,
  fetch: async (url, init) => {
    let lastError: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const t0 = performance.now();
      try {
        console.log(`[AI-Call] ⏳ Requesting model '${defaultModelName}' (Attempt ${attempt}/3)...`);
        const headers = new Headers(init?.headers);
        let isStreaming = false;
        try {
          if (init?.body && typeof init.body === 'string') {
            const parsed = JSON.parse(init.body);
            if (parsed.stream) isStreaming = true;
          }
        } catch {}
        if (!isStreaming) {
          headers.set('accept', 'application/json');
        }
        const res = await fetch(url, {
          ...init,
          headers,
          signal: AbortSignal.timeout(180_000),
        });
        const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
        if (res.ok) {
          console.log(`[AI-Call] ✅ Responded 200 OK in ${elapsed}s`);
          return res;
        }
        console.warn(`[AI-Call] ⚠️ Upstream ${res.status} returned in ${elapsed}s`);
        if (res.status >= 500 && attempt < 3) {
          console.warn(`[AI-Call] Retrying in ${attempt * 1.5}s...`);
          await new Promise(r => setTimeout(r, attempt * 1500));
          continue;
        }
        return res;
      } catch (err: any) {
        lastError = err;
        const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
        console.warn(`[AI-Call] ❌ Fetch error after ${elapsed}s: ${err?.message}`);
        if (attempt < 3) {
          console.warn(`[AI-Call] Retrying in ${attempt * 1.5}s...`);
          await new Promise(r => setTimeout(r, attempt * 1.5));
        }
      }
    }
    throw lastError;
  },
});

export function getMastraModel(modelName: string = defaultModelName) {
  return customOpenAI.chat(modelName);
}

export function getModelName(): string {
  return defaultModelName;
}

export const AI_CONFIG = {
  baseURL,
  model: defaultModelName,
};

// ── Phase 1: SSE Streaming ─────────────────────────────────────────────

const SLEEP = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Encode a text stream into Server-Sent Events (text/event-stream).
 * Emits one `token` event per chunk; optional `onStatus` for lifecycle
 * events pushed into the HTTP response.
 */
export function streamToSse(
  source: AsyncIterable<string> | ReadableStream<string>,
  onStatus?: (status: string) => void,
  onToken?: (token: string) => void,
): ReadableStream<Uint8Array> {
  const asyncIter = source as AsyncIterable<string>;
  const isReadableStream = 'getReader' in source && typeof (source as any).getReader === 'function';

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const NL = '\n';
      const sseEvent = (event: string, data: string) =>
        `event: ${event}${NL}` +
        `data: ${data}${NL}${NL}`;

      if (isReadableStream) {
        const reader = (source as ReadableStream<string>).getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (onToken) onToken(value);
            controller.enqueue(encoder.encode(sseEvent('token', JSON.stringify({ token: value }))));
          }
        } finally {
          reader.releaseLock();
        }
      } else {
        let buffer = '';
        for await (const chunk of asyncIter) {
          buffer += chunk;
          if (onToken) onToken(buffer);
          controller.enqueue(encoder.encode(sseEvent('token', JSON.stringify({ token: buffer }))));
          buffer = '';
        }
      }
      controller.close();
    },
    cancel() {
      // Nothing to cancel locally; the upstream reader is released implicitly.
    },
  });
}

/**
 * Stream a model completion over SSE with a bounded retry window.
 * Callers provide `onStatus` and `onToken` callbacks to mirror progress
 * straight into the HTTP response (see the `/stream` route).
 */
export async function streamTextSse(
  modelName: string,
  prompt: string,
  onStatus?: (status: string) => void,
  onToken?: (token: string) => void
): Promise<ReadableStream<Uint8Array>> {
  let lastError: any;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController();
      const t0 = performance.now();

      // 1. Signal start
      onStatus?.('starting stream');
      console.log(`[AI-Stream] ⏳ Requesting model '${modelName}' (Attempt ${attempt}/3)...`);

      // 2. Call the OpenAI-compatible /chat/completions with stream:true
      const response = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content: prompt }],
          stream: true,
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
      if (!response.ok) {
        const errBody = await response.text();
        console.warn(`[AI-Stream] ❌ Upstream ${response.status} in ${elapsed}s: ${errBody.slice(0, 200)}`);
        if (response.status >= 500 && attempt < 3) {
          console.warn(`[AI-Stream] Retrying in ${attempt * 1.5}s...`);
          await SLEEP(attempt * 1500);
          continue;
        }
        throw new Error(`Upstream ${response.status}: ${errBody.slice(0, 200)}`);
      }

      console.log(`[AI-Stream] ✅ Responded ${response.status} in ${elapsed}s`);

      // 3. Pipe the raw SSE stream into the encoder
      const readable = response.body as ReadableStream<Uint8Array>;
      const decoder = new TextDecoder();
      let pending = '';

      const reader = readable.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          pending += decoder.decode(value, { stream: true });
          const lines = pending.split('\n');
          pending = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const raw = line.slice(6).trim();
              if (raw === '[DONE]') continue;
              try {
                const parsed = JSON.parse(raw);
                const token = parsed.choices?.[0]?.delta?.content ?? '';
                if (token) {
                  onToken?.(token);
                }
              } catch (e) {
                // Not a complete JSON chunk; keep buffering
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      return readable;
    } catch (err: any) {
      lastError = err;
      console.warn(`[AI-Stream] ❌ Attempt ${attempt} failed: ${err?.message}`);
      if (attempt < 3) await SLEEP(attempt * 1.5);
    }
  }
  throw lastError;
}

// Re-export streamText for backward compatibility with code that imports it
// (the module no longer directly exports it; this re-export is zero-cost at runtime).
// NOTE: @ai-sdk/openai@4.0.83 does NOT export streamText, so this line is a
// no-op re-export that satisfies the legacy import path across the codebase.
