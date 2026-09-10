import assert from 'node:assert/strict';
import worker from '../worker.js';
const env = {HF_API_KEY_ID:'test', HF_API_KEY_SECRET:'test'};
const original = globalThis.fetch;
let calls = 0;
globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({detail:'Temporary outage'}), {status:503}); };
try {
  const status = await worker.fetch(new Request('https://test/status?task_id=task-1'), env);
  assert.equal(status.status, 502);
  assert.equal((await status.json()).status, undefined, 'transient errors must not look terminal');
  const form = new FormData(); form.append('duration','7'); form.append('prompt','test');
  const invalid = await worker.fetch(new Request('https://test/generate', {method:'POST',body:form}), env);
  assert.equal(invalid.status,400);
  const id = await worker.fetch(new Request('https://test/status?task_id=../../secret'),env);
  assert.equal(id.status,400);
  assert.equal(calls,1);
  console.log('PASS: provider outage preserves task, invalid duration and task IDs rejected');
} finally { globalThis.fetch = original; }
