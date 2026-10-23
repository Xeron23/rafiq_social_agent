// MCP smoke test: connects as a real MCP client over Streamable HTTP,
// lists tools, calls read tools, and exercises the async job path.
//
// Usage: node scripts/mcp-smoke.mjs [baseUrl]
// Requires MCP_API_KEY in the environment or in ~/secrets/rafiq_mcp_api_key.txt

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const baseUrl = process.argv[2] || 'http://127.0.0.1:3010';

function resolveKey() {
  if (process.env.MCP_API_KEY) return process.env.MCP_API_KEY.trim();
  const p = path.join(os.homedir(), 'secrets', 'rafiq_mcp_api_key.txt');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  throw new Error('MCP_API_KEY not found');
}

const key = resolveKey();

const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
  requestInit: { headers: { 'X-API-Key': key } },
});

const client = new Client({ name: 'mcp-smoke', version: '1.0.0' }, { capabilities: {} });

let failures = 0;
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ' :: ' + extra : ''}`);
  if (!ok) failures++;
};

try {
  await client.connect(transport);
  check('initialize + connect', true);

  const { tools } = await client.listTools();
  check('tools/list returns 15 tools', tools.length === 15, `got ${tools.length}`);
  console.log('       tools:', tools.map((t) => t.name).join(', '));

  // read tool
  const brand = await client.callTool({ name: 'get_brand_voice', arguments: {} });
  const brandPayload = JSON.parse(brand.content[0].text);
  check('tools/call get_brand_voice', brandPayload.success === true, brandPayload?.data?.profile?.name);

  // read tool with args
  const cal = await client.callTool({
    name: 'get_calendar_schedule',
    arguments: { month: 10, year: 2026 },
  });
  const calPayload = JSON.parse(cal.content[0].text);
  check(
    'tools/call get_calendar_schedule',
    calPayload.success === true && (calPayload.data.events?.length ?? 0) > 0,
    `${calPayload.data?.events?.length ?? 0} events`
  );

  // new campaign read tool
  const list = await client.callTool({ name: 'list_campaigns', arguments: {} });
  const listPayload = JSON.parse(list.content[0].text);
  check(
    'tools/call list_campaigns',
    listPayload.success === true && listPayload.data.count >= 1,
    `${listPayload.data?.count} campaigns`
  );

  // invalid args must come back as a protocol-level error, not a crash
  const bad = await client.callTool({
    name: 'get_campaign_status',
    arguments: {},
  });
  check('invalid arguments rejected by schema', bad.isError === true, bad.content?.[0]?.text?.slice(0, 80));

  // async path: heavy tool returns a job id immediately
  const started = Date.now();
  const heavy = await client.callTool({
    name: 'start_campaign',
    arguments: {
      type: 'lt',
      brief: 'MCP smoke test campaign - hapus otomatis setelah verifikasi',
      targetChannels: ['li'],
    },
  });
  const elapsed = Date.now() - started;
  const heavyPayload = JSON.parse(heavy.content[0].text);
  check(
    'heavy tool returns jobId instantly (<5s)',
    heavyPayload.success === true && !!heavyPayload.jobId && elapsed < 5000,
    `${elapsed}ms job=${heavyPayload.jobId}`
  );

  // poll the job
  let jobStatus = 'QUEUED';
  let lastPayload = null;
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    const poll = await client.callTool({
      name: 'get_tool_job',
      arguments: { jobId: heavyPayload.jobId },
    });
    lastPayload = JSON.parse(poll.content[0].text);
    jobStatus = lastPayload?.data?.status;
    process.stdout.write(`       poll: ${jobStatus}\n`);
    if (jobStatus === 'COMPLETED' || jobStatus === 'FAILED') break;
  }
  check('async job completes', jobStatus === 'COMPLETED', `status=${jobStatus}`);
  if (jobStatus === 'COMPLETED') {
    console.log('       campaignId:', lastPayload?.data?.result?.data?.campaignId);
    fs.writeFileSync(
      path.join(os.homedir(), '.hermes', 'cache', 'scratch', 'mcp_smoke_campaign.json'),
      JSON.stringify(lastPayload, null, 2)
    );
  }
} catch (err) {
  console.error('ERROR', err);
  failures++;
} finally {
  try {
    await client.close();
  } catch {}
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
