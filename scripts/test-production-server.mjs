/** Check a running packaged Node server. No generation requests or provider charges. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const origin = process.env.CAMPUS_TEST_ORIGIN || 'http://127.0.0.1:5192';
let passed = 0;
const check = async (name, run) => { await run(); passed++; console.log(`  ✓ ${name}`); };
await check('生产状态接口仅公开配置状态、模型和主机', async () => {
  const response = await fetch(`${origin}/api/llm/status`);
  assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /application\/json/);
  assert.deepEqual(Object.keys(await response.json()).sort(), ['configured', 'host', 'model']);
});
await check('首页与同源 3D 页面都能由生产服务提供', async () => {
  for (const route of ['/', '/map/' + encodeURIComponent('校园地图-3D实景.html')]) { const response = await fetch(origin + route, { method: 'HEAD' }); assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /text\/html/); }
});
await check('私有配置、后端源码和包描述不作为静态资源公开', async () => {
  for (const route of ['/.env', '/.env.local', '/server/config.mjs', '/package.json', '/src/lib/llmPayload.js', '/.campus-data/campus.sqlite', '/.campus-data/setup-key.txt']) assert.equal((await fetch(origin + route)).status, 404);
});
await check('生产账号服务可连接，不暴露初始化口令或会话凭据', async () => {
  const response = await fetch(`${origin}/api/campus/session`);
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const data = await response.json(); assert.equal(data.user, null); assert.equal(data.csrf, null); assert.equal(typeof data.setupRequired, 'boolean');
  assert.ok(!Object.hasOwn(data, 'setupToken'));
});
await check('路径越界和损坏编码返回 404', async () => {
  for (const route of ['/%2e%2e%5c.env', '/%E0%A4%A']) assert.equal((await fetch(origin + route)).status, 404);
});
await check('缺失的资源不会误回 SPA 首页', async () => assert.equal((await fetch(`${origin}/assets/missing-file.js`)).status, 404));
await check('静态资源拒绝 POST，HEAD 不带正文', async () => {
  assert.equal((await fetch(origin + '/', { method: 'POST' })).status, 405);
  assert.equal((await (await fetch(origin + '/', { method: 'HEAD' })).text()).length, 0);
});
if (process.argv[2]) await check('构建哈希资源有长期缓存，服务响应与打包文件一致', async () => {
  const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const entry = manifest.files.find((file) => /^dist\/assets\/.*\.js$/.test(file.path));
  const response = await fetch(origin + '/' + entry.path.slice(5));
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /immutable/);
  assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), entry.sha256);
});
console.log(`生产启动包服务：${passed} 项通过（未调用模型生成）`);
