import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

// Synthetic resources test only the verifier, not application functionality.
const expected = JSON.parse(await fs.readFile(new URL('../dist/build-edition.json', import.meta.url), 'utf8'));
const homepage = '<!doctype html><html><head><link rel="stylesheet" href="/assets/index-rebuilt.css"></head><body><script type="module" src="/assets/index-rebuilt.js"></script></body></html>';
const resources = new Map([['/index.html', homepage], ['/assets/index-rebuilt.js', '// Synthetic verifier fixture'], ['/assets/index-rebuilt.css', 'body{margin:0}'], ['/map/校园地图-3D实景.html', '<html>Synthetic current map fixture</html>']]);
const digest = value => createHash('sha256').update(value).digest('hex');
const edition = { ...expected, build: { ...expected.build, artifacts: [...resources].map(([path, value]) => ({ path, sha256: digest(value), bytes: Buffer.byteLength(value) })) } };
let mode = 'rebuilt';
const server = http.createServer((req, res) => {
  const route = decodeURIComponent(new URL(req.url, 'http://local').pathname);
  if (route === '/build-edition.json') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(mode === 'wrong-source' ? { ...edition, build: { ...edition.build, sourceSha256: '0'.repeat(64) } } : edition)); return; }
  if (route === '/' && mode === 'stale-home') { res.end('<html>old homepage</html>'); return; }
  if (route === '/assets/index-rebuilt.css' && mode === 'missing-resource') { res.writeHead(404); res.end(); return; }
  if (route === '/map/校园地图-3D实景.html' && mode === 'stale-map') { res.end('<html>old map</html>'); return; }
  if (route === '/map/校园地图-3D实景.html' && mode === 'missing-map') { res.writeHead(404); res.end(); return; }
  const value = resources.get(route === '/' ? '/index.html' : route);
  if (value === undefined) res.writeHead(404);
  res.end(value || '');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const verify = () => promisify(execFile)(process.execPath, ['scripts/verify-live.mjs', url], { timeout: 15000, windowsHide: true });
try {
  assert.match((await verify()).stdout, /发布资源核验通过/);
  console.log('✓ 同源码重新构建、资源文件名变化时可以通过');
  for (const [scenario, label] of [['stale-home', '根首页仍旧时不能被新index.html蒙混通过'], ['missing-resource', '引用的资源404时验收失败'], ['wrong-source', '同版本号但源码摘要不同仍会拒绝'], ['stale-map', '主站更新但3D仍旧时必须失败'], ['missing-map', '实际3D入口404时必须失败']]) {
    mode = scenario;
    await assert.rejects(verify);
    console.log(`✓ ${label}`);
  }
  console.log('发布核验器：6项通过（合成资源，不替代真实浏览器功能验收）');
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
