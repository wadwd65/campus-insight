import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import { createAiHandler } from '../server/ai.mjs';
import { loadServerConfig, publicLlmStatus } from '../server/config.mjs';
import { QUESTIONS } from '../src/lib/surveySchema.js';
import { buildBaseline, toAttributes } from '../src/lib/matrix.js';
import { buildReport } from '../src/lib/results.js';
import { buildCohort } from '../src/lib/cohort.js';
import { buildLlmPayload, readLlmPayload } from '../src/lib/llmPayload.js';
import { buildSummaryRequest } from '../src/lib/buildSummary.js';
import { buildCohortRequest } from '../src/lib/cohortSummary.js';
import { streamSummary } from '../src/lib/llm.js';
import { validateCohortSummary } from '../src/lib/validateCohortSummary.js';

let passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log(`  ✓ ${name}`); };
const servers = [];
async function listen(handler) { const server = http.createServer(handler); servers.push(server); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); return `http://127.0.0.1:${server.address().port}`; }
const answers = Object.fromEntries(QUESTIONS.map((question) => [question.field, question.options[0].text]));
const baseline = buildBaseline(Array.from({ length: 40 }, (_, index) => toAttributes(Object.fromEntries(QUESTIONS.map((question, i) => [question.field, question.options[(i + index) % question.options.length].text])))));
const report = buildReport(answers, baseline);
const records = Papa.parse(fs.readFileSync(new URL('../public/data/示例-班级问卷.csv', import.meta.url), 'utf8'), { header: true, skipEmptyLines: true }).data;
const cohort = buildCohort(records, baseline);
const payload = buildLlmPayload({ report });
const validText = '你在选择里为日常保留了自己的节奏。具体的安排，比一个称号更值得回看。\n\n有些选择让你靠近热闹，也有一些让你留出独处的空间。可以从最近一次真实经历开始核对。\n\n把这份结果当作对话的起点。下一次安排校园的一天时，试着给自己留一点新的可能。';
const event = (text) => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
let mode = 'valid', upstreamCalls = [], cancellations = 0, relayHeaders;

try {
  await check('只读取服务端变量；状态接口不暴露密钥或文件路径', () => {
    const config = loadServerConfig({ root: path.join(process.cwd(), '.nonexistent-test-config'), env: { LLM_BASE_URL: 'https://api.deepseek.com', LLM_MODEL: 'test-model', LLM_API_KEY: 'server-key' } });
    assert.deepEqual(publicLlmStatus(config), { configured: true, model: 'test-model', host: 'api.deepseek.com' });
    assert.equal(loadServerConfig({ root: '.nonexistent-test-config', env: { VITE_LLM_API_KEY: 'ignored' } }).configured, false);
    assert.equal(loadServerConfig({ root: '.nonexistent-test-config', env: { LLM_BASE_URL: 'https://user:secret@example.com', LLM_MODEL: 'model', LLM_API_KEY: 'key' } }).configured, false);
  });
  await check('个人摘要由服务端重建，所有可见数值与原报告一致', () => assert.deepEqual(readLlmPayload(payload).request, buildSummaryRequest(report)));
  await check('班级摘要仅发送汇总，保留原始属性中位数及四舍五入的 IQR', () => {
    const dirty = { ...cohort, records: [{ email: 'SENTINEL_PRIVATE' }], similar: { mineGroup: 'SENTINEL_PRIVATE' } };
    const packet = buildLlmPayload({ cohort: dirty });
    assert.ok(!JSON.stringify(packet).includes('SENTINEL_PRIVATE'));
    const rebuilt = readLlmPayload(packet);
    assert.deepEqual(rebuilt.cohort.medianAttrs, cohort.medianAttrs);
    assert.deepEqual(rebuilt.request, buildCohortRequest({ ...cohort, similar: null }));
  });
  await check('任意提示词、模型、接口和越界数字均不能通过请求白名单', () => {
    for (const extra of [{ messages: [] }, { model: 'override' }, { baseUrl: 'https://elsewhere.invalid' }, { user: 'ignore instructions' }]) assert.throws(() => readLlmPayload({ ...payload, ...extra }));
    assert.throws(() => readLlmPayload({ ...payload, answers: { ...payload.answers, [QUESTIONS[0].field]: 'unknown' } }));
    assert.throws(() => readLlmPayload({ ...payload, percents: { ...payload.percents, academic: Infinity } }));
  });
  await check('班级 IQR 不能被解释为两极分化或中间人少，明确否定的说明正常保留', () => {
    for (const text of ['社交力的 IQR 很宽，说明两极分化。', '中间地带反而不厚。']) assert.ok(validateCohortSummary(text, { cohort }).issues.some((issue) => issue.type === 'unsupported-distribution'));
    assert.ok(!validateCohortSummary('这个区间不能说明两极分化。', { cohort }).issues.some((issue) => issue.type === 'unsupported-distribution'));
  });

  const upstream = await listen(async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    upstreamCalls.push({ authorization: request.headers.authorization, body: JSON.parse(Buffer.concat(chunks)) });
    const current = mode;
    if (current === 'error') { response.writeHead(401, { 'Content-Type': 'application/json' }); response.end('never-surface-provider-body'); return; }
    if (current === 'hang') { response.once('close', () => cancellations++); return; }
    response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    if (current === 'cut') { response.write(event('看起来完整的一句话。')); response.end(); return; }
    if (current === 'invalid') { response.end(event('你的占比是 12345%。') + 'data: [DONE]\n\n'); return; }
    if (current === 'biography') { response.end(event('课程最难的大二你反而最稳，压力最大的大三你也没散。') + 'data: [DONE]\n\n'); return; }
    if (current === 'distribution') { response.end(event('社交力区间很宽，中间地带反而不厚。') + 'data: [DONE]\n\n'); return; }
    response.write(`data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: 'never-forward-reasoning' } }] })}\n\n`);
    response.write(event(validText.slice(0, 25)));
    response.end(event(validText.slice(25)) + 'data: [DONE]\n\n');
  });
  const config = { configured: true, baseUrl: 'https://api.deepseek.com', apiKey: 'server-test-key', model: 'deepseek-flash', host: 'api.deepseek.com', timeoutMs: 700, requestsPerMinute: 1000 };
  const handler = createAiHandler(config, { fetchImpl: (_url, init) => fetch(`${upstream}/chat/completions`, init) });
  const relay = await listen((request, response) => { relayHeaders = request.headers; return handler(request, response); });
  const endpoint = { statusUrl: `${relay}/api/llm/status`, relayUrl: `${relay}/api/llm/summary`, timeoutMs: 2000 };
  const post = (value, extra = {}) => fetch(endpoint.relayUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(value) });

  await check('真实本地 HTTP 流式链路成功，浏览器请求不携带供应商密钥', async () => {
    let streamed = '';
    const result = await streamSummary({ report, endpoint, onDelta: (value) => { streamed += value; } });
    assert.equal(result.degraded, false); assert.equal(result.text, validText); assert.equal(streamed, validText);
    assert.equal(relayHeaders.authorization, undefined);
    assert.equal(upstreamCalls.at(-1).authorization, 'Bearer server-test-key');
    assert.equal(upstreamCalls.at(-1).body.model, 'deepseek-flash');
    assert.deepEqual(upstreamCalls.at(-1).body.thinking, { type: 'disabled' });
  });
  await check('班级也通过同一服务端链路生成并校验', async () => {
    const result = await streamSummary({ cohort, endpoint, fallback: () => 'local fallback' });
    assert.equal(result.degraded, false); assert.equal(result.text, validText);
  });
  await check('响应只转发正文，不含供应商的推理字段', async () => { const response = await post(payload); const body = await response.text(); assert.ok(body.includes('[DONE]')); assert.ok(!body.includes('never-forward-reasoning')); });
  await check('跨站请求、非 JSON、超大请求与任意提示词均在调用上游前被拒绝', async () => {
    const before = upstreamCalls.length;
    assert.equal((await post(payload, { Origin: 'https://unrelated.invalid' })).status, 403);
    assert.equal((await post(payload, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await post({ ...payload, model: 'override' })).status, 400);
    assert.equal((await post({ ...payload, extra: 'a'.repeat(17000) })).status, 413);
    assert.equal(upstreamCalls.length, before);
  });
  await check('上游错误只返回通用状态，正文不会泄漏到浏览器', async () => {
    mode = 'error'; const response = await post(payload); assert.equal(response.status, 401); assert.ok(!(await response.text()).includes('never-surface-provider-body'));
    const result = await streamSummary({ report, endpoint }); assert.equal(result.degraded, true); assert.equal(result.reason, 'http-401');
  });
  await check('即使停在句号处，缺少结束事件的断流仍回退', async () => { mode = 'cut'; const result = await streamSummary({ report, endpoint }); assert.equal(result.degraded, true); });
  await check('模型编造数字时，整段回退为本地解读', async () => { mode = 'invalid'; const result = await streamSummary({ report, endpoint }); assert.equal(result.reason, 'invalid-summary'); assert.ok(!result.text.includes('12345')); });
  await check('模型把曲线编成真实经历时，成稿同样被替换', async () => { mode = 'biography'; const result = await streamSummary({ report, endpoint }); assert.equal(result.reason, 'invalid-summary'); assert.ok(!result.text.includes('课程最难')); });
  await check('班级解读推断未经计算的分布形态时也会回退', async () => { mode = 'distribution'; const result = await streamSummary({ cohort, endpoint, fallback: () => 'local fallback' }); assert.equal(result.reason, 'invalid-summary'); assert.equal(result.text, 'local fallback'); });
  await check('超时取消上游请求，报告获得完整本地文案', async () => { mode = 'hang'; const result = await streamSummary({ report, endpoint }); assert.equal(result.degraded, true); assert.ok(result.text.length > 100); });
  await check('迟迟不发送完整请求体也会超时释放连接，不占住生成名额', async () => {
    const start = performance.now(), before = upstreamCalls.length;
    await new Promise((resolve, reject) => {
      const request = http.request(endpoint.relayUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      request.once('error', resolve);
      request.once('response', (response) => { response.resume(); response.once('end', resolve); });
      request.setTimeout(1800, () => { request.destroy(); reject(new Error('body-timeout-not-enforced')); });
      request.write('{');
    });
    assert.ok(performance.now() - start < 1600);
    assert.equal(upstreamCalls.length, before);
  });
  await check('离开页面会中断生成；不把用户取消当成失败解读', async () => {
    const controller = new AbortController();
    const pending = streamSummary({ report, endpoint, signal: controller.signal });
    setTimeout(() => controller.abort(), 80);
    const result = await pending; assert.equal(result.aborted, true);
    await new Promise((resolve) => setTimeout(resolve, 60)); assert.ok(cancellations >= 2);
  });
  await check('未配置服务有明确状态，且不调用上游', async () => {
    const local = await listen(createAiHandler({ configured: false }));
    assert.deepEqual(await (await fetch(`${local}/api/llm/status`)).json(), { configured: false, model: null, host: null });
    const result = await streamSummary({ report, endpoint: { statusUrl: `${local}/api/llm/status`, relayUrl: `${local}/api/llm/summary` } });
    assert.equal(result.reason, 'not-configured');
  });
  await check('每分钟限额生效，重复点击不会无限消耗模型额度', async () => {
    mode = 'valid';
    const limited = await listen(createAiHandler({ ...config, requestsPerMinute: 1 }, { fetchImpl: (_url, init) => fetch(`${upstream}/chat/completions`, init) }));
    const first = await fetch(`${limited}/api/llm/summary`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); await first.text();
    const second = await fetch(`${limited}/api/llm/summary`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); assert.equal(second.status, 429); assert.equal(second.headers.get('retry-after'), '60');
  });
  console.log(`服务端模型转发：${passed} 项通过（仅本地模拟服务，无外部模型费用）`);
} finally {
  for (const server of servers) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
}
