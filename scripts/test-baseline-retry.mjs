import assert from 'node:assert/strict';
import { fetchBaselineText } from '../src/data/fetchBaselineText.js';
const url = '/data/问卷基准数据.csv';
const instant = { delays: [0, 0], wait: async () => {} };
let count = 0;
async function check(label, run) { await run(); count++; console.log(`✓ ${label}`); }
await check('首次网络失败、第二次成功，不向用户暴露临时错误', async () => {
  let calls = 0; const result = await fetchBaselineText(url, { ...instant, fetchImpl: async () => { if (++calls === 1) throw new TypeError('synthetic offline'); return new Response('valid csv'); } });
  assert.equal(result, 'valid csv'); assert.equal(calls, 2);
});
await check('503可自动重试，最多三个请求', async () => {
  let calls = 0; assert.equal(await fetchBaselineText(url, { ...instant, fetchImpl: async () => ++calls < 3 ? new Response('', { status: 503 }) : new Response('recovered') }), 'recovered'); assert.equal(calls, 3);
});
await check('读取响应体中断也能重新获取', async () => {
  let calls = 0; const fetchImpl = async () => ++calls === 1 ? { ok: true, text: async () => { throw new TypeError('stream interrupted'); } } : new Response('complete');
  assert.equal(await fetchBaselineText(url, { ...instant, fetchImpl }), 'complete'); assert.equal(calls, 2);
});
await check('超时会中止当前请求，再重新读取', async () => {
  let calls = 0; const fetchImpl = async (_, { signal }) => ++calls === 1 ? new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })) : new Response('after timeout');
  assert.equal(await fetchBaselineText(url, { ...instant, timeoutMs: 15, fetchImpl }), 'after timeout'); assert.equal(calls, 2);
});
await check('404不反复请求，不暴露本机目录', async () => {
  let calls = 0; await assert.rejects(fetchBaselineText(url, { ...instant, fetchImpl: async () => { calls++; return new Response('', { status: 404 }); } }), error => error.message.includes('维护者') && !error.message.includes('public/')); assert.equal(calls, 1);
});
await check('持续断网到达次数上限后给出可重试提示', async () => {
  let calls = 0; const fetchImpl = async () => { calls++; throw new TypeError('offline'); };
  await assert.rejects(fetchBaselineText(url, { ...instant, fetchImpl }), /已自动重试.*重新加载/); assert.equal(calls, 3);
});
await check('首次成功不增加请求，保持原始正文', async () => {
  let calls = 0; const text = '\ufeff标题,答案\r\n甲,乙\r\n'; assert.equal(await fetchBaselineText(url, { ...instant, fetchImpl: async () => { calls++; return { ok: true, text: async () => text }; } }), text); assert.equal(calls, 1);
});
console.log(`基准数据读取恢复：${count}项通过（故障注入，无公网写入）`);
