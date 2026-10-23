// MCP Tools HTTP Router
// Exposes the unified MCP tool-calling registry as REST endpoints.
//
// Endpoint:
//   POST /api/tools/execute
//     Body: { tool: "start_campaign", args: {...} }
//     Response: { success: true, data: ..., meta: {...} } | { success: false, error: ..., meta: {...} }
//
//   GET  /api/tools/list
//     Response: { tools: [{ name, description, inputSchema }] }
//
//   GET  /api/tools/schema/:name
//     Response: { name, description, inputSchema }

import { Router, Request, Response } from 'express';
import {
  mcpToolMap,
  mcpTools,
  mcpLogError,
} from '../../infrastructure/mcp/tools/index.js';
import { requireApiKey, rateLimit } from './authMiddleware.js';

export function createMcpRouter() {
  const router = Router();

  // Auth + rate limit are applied PER ROUTE (not router.use): this router is
  // also mounted at /api, so router-level middleware would swallow unrelated
  // /api traffic (chat, webhooks, notifications) that is mounted after it.
  const guard = [requireApiKey, rateLimit(120)];

  // ── GET /api/tools/list or /api/list ────────────────────────────────
  router.get(['/list', '/tools/list'], ...guard, (_req: Request, res: Response) => {
    try {
      const tools = mcpTools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
      res.json({ success: true, tools });
    } catch (err: any) {
      mcpLogError('mcp.list', err, 'Failed to list tools');
      res.status(500).json({ success: false, error: err?.message || 'Failed to list tools' });
    }
  });

  // ── GET /api/tools/schema/:name or /api/schema/:name ─────────────────
  router.get(['/schema/:name', '/tools/schema/:name'], ...guard, (req: Request, res: Response) => {
    try {
      const name = typeof req.params.name === 'string' ? req.params.name : String(req.params.name);
      const mcpMap = mcpToolMap as any;
      const tool = mcpMap[name];
      if (!tool) {
        return res.status(404).json({
          success: false,
          error: `Tool "${name}" not found`,
          available: mcpTools.map((t) => t.name),
        });
      }
      res.json({ success: true, name: tool.name, description: tool.description, inputSchema: tool.inputSchema });
    } catch (err: any) {
      mcpLogError('mcp.schema', err, 'Failed to get tool schema');
      res.status(500).json({ success: false, error: err?.message || 'Failed to get tool schema' });
    }
  });

  // ── POST /api/tools/execute or /api/execute ──────────────────────────
  router.post(['/execute', '/tools/execute'], ...guard, async (req: Request, res: Response) => {
    try {
      const { tool, args } = req.body || {};
      if (!tool || typeof tool !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Missing "tool" field (string).',
        });
      }

      const entry = mcpToolMap[tool];
      if (!entry) {
        return res.status(404).json({
          success: false,
          error: `Tool "${tool}" not found`,
          available: mcpTools.map((t) => t.name),
        });
      }

      const parsedArgs = entry.inputSchema.safeParse(args);
      if (!parsedArgs.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid arguments',
          details: parsedArgs.error.errors,
        });
      }

      const result = await entry.execute(parsedArgs.data);
      res.json(result);
    } catch (err: any) {
      mcpLogError('mcp.execute.' + (req.body?.tool || 'unknown'), err, 'Failed to execute MCP tool');
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to execute MCP tool',
      });
    }
  });

  return router;
}
