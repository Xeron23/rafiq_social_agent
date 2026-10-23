# Socialpal MCP Server

Model Context Protocol server for the Rafiq Socialpal backend.
Transport: **Streamable HTTP (stateless)**, spec version `2025-06-18`.

## Endpoint

```
POST https://rafiq.xrn.my.id/mcp        (public, via Cloudflare tunnel)
POST http://127.0.0.1:3010/mcp          (local)
```

Auth (required, both endpoints): `X-API-Key: <key>` or `Authorization: Bearer <key>`.
The key lives on the server at `~/secrets/rafiq_mcp_api_key.txt` (mode 600) and in
`/opt/projects/rafiq_social_agent/.env` as `MCP_API_KEY`.

- Missing/wrong key -> `401`
- No key configured on the server -> `503`
- Rate limit: 120 requests/minute per IP -> `429` + `Retry-After`

`GET /mcp` returns `405` by design (stateless mode has no server-initiated stream).

## Tools (15)

| Domain | Tools |
|---|---|
| Campaign lifecycle | `start_campaign`, `approve_strategy`, `approve_plan`, `approve_canonical`, `authorize_campaign` |
| Campaign read | `list_campaigns`, `get_campaign_status` |
| Content & planner | `update_platform_copy`, `get_calendar_schedule`, `schedule_post`, `publish_instant`, `reschedule_post` |
| Brand voice | `get_brand_voice`, `update_brand_voice` |
| Jobs | `get_tool_job` |

Read tools answer immediately. Heavy LLM tools — `start_campaign`, `approve_strategy`,
`approve_plan`, `approve_canonical` — return in ~5 ms with:

```json
{ "success": true, "jobId": "<uuid>", "status": "QUEUED", "pollWith": "get_tool_job" }
```

Poll `get_tool_job({ jobId })` until `status` is `COMPLETED` or `FAILED`
(25-120 s typically). Jobs are in memory, 1 h TTL, max 200 entries: a restart
loses the audit trail, not the campaign data (that is in PostgreSQL).

## Client config

Claude Desktop / any MCP client that supports HTTP headers:

```json
{
  "mcpServers": {
    "socialpal": {
      "type": "http",
      "url": "https://rafiq.xrn.my.id/mcp",
      "headers": { "X-API-Key": "<key from ~/secrets/rafiq_mcp_api_key.txt>" }
    }
  }
}
```

MCP Inspector:

```bash
npx @modelcontextprotocol/inspector
# Transport: Streamable HTTP
# URL: http://127.0.0.1:3010/mcp
# Header: X-API-Key: <key>
```

## Verification

```bash
cd /opt/projects/rafiq_social_agent
NO_PROXY='*' node scripts/mcp-smoke.mjs http://127.0.0.1:3010
```

Checks: connect, `tools/list` = 15, three read tool calls, schema rejection of
invalid args, async job creation < 5 s, job completion.
The smoke test creates one real campaign (`start_campaign`); delete it afterwards.

## REST compatibility layer

The old REST surface still exists and is now authenticated too:

```
GET  /api/tools/list            (with key)
GET  /api/tools/schema/:name    (with key)
POST /api/tools/execute         (with key)
```

It maps 1:1 to the same registry, so nothing that already integrates breaks -
it just needs the key now.

## Known limits

- Tool calling inside the chat agent is still prompt-fence based (not native
  function calling); the MCP layer itself uses real JSON-RPC.
- `schedule_post` has no idempotency key: a retried call creates a second row.
- Tool auth is a single shared key, not per-tenant OAuth 2.1.
- Non-tool REST routes (`/api/campaigns/*`, `/api/notifications/*`, ...) are
  still unauthenticated because the Next.js rewrite proxy cannot inject
  headers; closing those needs a Next.js middleware proxy.
