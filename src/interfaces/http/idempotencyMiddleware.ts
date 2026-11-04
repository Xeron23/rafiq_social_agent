import { Request, Response, NextFunction } from 'express';
import { pool } from '../../infrastructure/database/db.js';

export function idempotencyMiddleware(actionName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const rawKey = req.headers['x-idempotency-key'] || req.body?.idempotencyKey;
    if (!rawKey) {
      // If client didn't supply key, proceed without caching response
      return next();
    }

    const key = String(rawKey).trim();
    const targetId = String(req.params.id || req.body?.campaignId || 'global');

    try {
      const checkRes = await pool.query(
        'SELECT response_payload FROM idempotency_keys WHERE key = $1',
        [key]
      );

      if (checkRes.rows.length > 0 && checkRes.rows[0].response_payload) {
        console.log(`[Idempotency] ⚡ Returning cached response for key: ${key}`);
        return res.status(200).json(checkRes.rows[0].response_payload);
      }

      // Reserve the idempotency key in DB
      await pool.query(
        `INSERT INTO idempotency_keys (key, target_id, action, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (key) DO NOTHING`,
        [key, targetId, actionName]
      );

      // Intercept res.json to cache response payload
      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          pool.query(
            'UPDATE idempotency_keys SET response_payload = $1 WHERE key = $2',
            [JSON.stringify(body), key]
          ).catch(err => {
            console.error('[Idempotency] Failed to store response payload:', err.message);
          });
        }
        return originalJson(body);
      };

      next();
    } catch (err: any) {
      console.error('[Idempotency] Error in middleware:', err.message);
      next();
    }
  };
}
