// Real MCP server (Model Context Protocol, Streamable HTTP transport).
//
// Scope of this file:
//   - Exposes the same 15 tools that the REST registry exposes, but over the
//     actual MCP protocol (initialize / tools/list / tools/call).
//   - Stateless transport: a fresh McpServer + transport per request, which is
//     the documented pattern for running MCP behind a proxy without session
//     stickiness (Cloudflare tunnel -> Express).
//   - Heavy LLM tools are turned into async jobs (see toolJobs.ts) because MCP
//     clients time out around 30-60s while campaign generation needs 25-120s.
//
// The chat orchestrator keeps calling `mcpTools` in-process: same code path for
// the domain logic, zero extra network hop.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Request, Response, NextFunction } from 'express';

import { mcpTools } from './tools/index.js';
import { toolJobs, ASYNC_TOOLS } from './toolJobs.js';

/** Wraps the internal {success,data,error} envelope into an MCP CallToolResult. */
function toCallResult(payload: any) {
  const isError = payload?.success === false;
  return {
    content: [
      {
        type: 'text' as const,
        text: typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2),
      },
    ],
    isError,
  };
}

/** Tool hints so clients can decide when to ask the human for confirmation. */
function annotationsFor(name: string) {
  const readOnly = name.startsWith('get_') || name.startsWith('list_');
  const destructive = ['authorize_campaign', 'publish_instant', 'reschedule_post'].includes(name);
  return {
    readOnlyHint: readOnly,
    destructiveHint: destructive,
    idempotentHint: readOnly,
    openWorldHint: false,
  };
}

/** Builds an McpServer with every tool from the shared registry registered. */
export function buildMcpServer(): McpServer {
  const server = new McpServer(
    { name: 'socialpal-rafiq-mcp', version: '1.0.0' },
    {
      instructions:
        'Socialpal by Rafiqspace.ai - social media automation tools. ' +
        'Read tools are immediate. Heavy tools (start_campaign, approve_*, authorize_campaign) ' +
        'return a jobId instantly; poll get_tool_job until status is COMPLETED or FAILED.',
    }
  );

  for (const tool of mcpTools) {
    const inputShape: any = (tool.inputSchema as any)?.shape ?? {};

    server.registerTool(
      tool.name,
      {
        title: tool.name,
        description: tool.description,
        inputSchema: inputShape,
        annotations: annotationsFor(tool.name),
      },
      (async (args: any) => {
        // Heavy, LLM-bound tools: answer immediately with a job handle.
        if (ASYNC_TOOLS.has(tool.name)) {
          const job = toolJobs.enqueue(tool.name, () => tool.execute(args));
          return toCallResult({
            success: true,
            jobId: job.id,
            status: job.status,
            tool: tool.name,
            pollWith: 'get_tool_job',
            message:
              'Job accepted. This tool needs 25-120s to call the LLM, so it runs in the background. ' +
              'Call get_tool_job with this jobId to fetch the result.',
          });
        }

        try {
          const result = await tool.execute(args);
          return toCallResult(result);
        } catch (err: any) {
          return toCallResult({ success: false, error: err?.message || String(err) });
        }
      }) as any
    );
  }

  return server;
}

/**
 * Express handler for POST /mcp (stateless Streamable HTTP).
 * `req.body` is already parsed by express.json(), so it is forwarded as-is.
 */
export function createMcpHandler() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const server = buildMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req as any, res as any, req.body);
    } catch (err) {
      console.error('[MCP] transport error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal MCP transport error' },
          id: null,
        });
      } else {
        next(err);
      }
    }
  };
}
