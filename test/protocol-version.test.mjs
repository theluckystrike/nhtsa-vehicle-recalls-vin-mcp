import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/worker.js';

async function toolsList(version) {
  const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
  if (version !== undefined) headers['mcp-protocol-version'] = version;
  const res = await worker.fetch(
    new Request('https://worker.test/mcp', {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    })
  );
  return { status: res.status, text: await res.text() };
}

test('protocol version 2026-07-28 is served without 400', async () => {
  const r = await toolsList('2026-07-28');
  assert.equal(r.status, 200, r.text);
  const parsed = JSON.parse(r.text);
  assert.equal(parsed.result.tools.length, 4);
});

test('known protocol versions (2025-06-18, 2025-03-26) and omitted header are served', async () => {
  for (const v of ['2025-06-18', '2025-03-26', undefined]) {
    const r = await toolsList(v);
    assert.equal(r.status, 200, `${v}: ${r.text}`);
  }
});

test('malformed and unknown older protocol versions are rejected with 400', async () => {
  for (const v of ['2026-7-28', 'latest', '2026-07-28x', '2024-01-01']) {
    const r = await toolsList(v);
    assert.equal(r.status, 400, `${v}: ${r.text}`);
    assert.match(r.text, /Unsupported protocol version/, v);
  }
});
