// Auth + rate limiting for the tool-execution surface.
//
// Why this exists: the Rafiq tool API is reachable from the public internet via
// the Cloudflare tunnel (rafiq.xrn.my.id). Before this guard, ANY caller could
// run `authorize_campaign`, `publish_instant`, or `update_brand_voice` and mutate
// production data. Every tool route now requires a bearer/API key.
//
// Key resolution order: MCP_API_KEY, then API_KEY (legacy).
// Accepted headers: `Authorization: Bearer <key>` or `X-API-Key: <key>`.

import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

const API_KEY = process.env.MCP_API_KEY || process.env.API_KEY || '';

/** Constant-time string comparison (prevents timing-based key discovery). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

/** Extracts a presented key from either supported header. */
export function extractApiKey(req: Request): string {
  const header = req.header('authorization') || '';
  if (header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  return (req.header('x-api-key') || '').trim();
}

export function isAuthorized(req: Request): boolean {
  const presented = extractApiKey(req);
  if (!API_KEY || !presented) return false;
  return safeEqual(presented, API_KEY);
}

/** Express guard: 503 when the server has no key configured, 401 otherwise. */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  if (!API_KEY) {
    res.status(503).json({
      success: false,
      error: 'Tool API is not configured on this server (MCP_API_KEY missing).',
    });
    return;
  }
  if (!isAuthorized(req)) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized. Send the key as "Authorization: Bearer <key>" or "X-API-Key: <key>".',
    });
    return;
  }
  next();
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Sliding-window-ish rate limit (fixed window per minute) keyed by client IP.
 * Tool calls hit the LLM and the database, so a runaway client is expensive.
 */
export function rateLimit(maxPerMinute = 120, windowMs = 60_000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const bucket = buckets.get(ip);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(ip, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > maxPerMinute) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        success: false,
        error: `Rate limit exceeded (${maxPerMinute}/min). Retry in ${retryAfter}s.`,
      });
      return;
    }
    next();
  };
}
