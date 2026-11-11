import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { staticEncoding, streamStaticFile } from '../server/static-delivery.mjs';

let count = 0;
const check = (label, run) => { run(); count++; console.log(`✓ ${label}`); };
for (const [header, expected] of [['', 'identity'], ['gzip, br', 'br'], ['gzip;q=1, br;q=0.5', 'gzip'], ['br;q=0, gzip', 'gzip'], ['br;q=0, gzip;q=0', 'identity'], ['identity;q=1, gzip;q=0.5', 'identity'], ['*;q=0.8', 'br'], ['*;q=0, gzip;q=1', 'gzip'], ['*;q=0', null], ['br;q=0, identity;q=0', null], ['br;q=9, gzip', 'gzip'], ['unknown', 'identity']]) {
  check(`Accept-Encoding ${header || '(无)'} → ${expected}`, () => assert.equal(staticEncoding(header), expected));
}
const file = fileURLToPath(new URL('../dist/map/校园地图-3D实景.html', import.meta.url));
const original = await fs.readFile(file);
const service = http.createServer((req, res) => {
  if (req.url === '/api-check') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return; }
  streamStaticFile(req, res, file, { contentType: req.url === '/binary' ? 'image/webp' : 'text/html; charset=utf-8', cacheControl: 'no-cache', bytes: original.length });
});
await new Promise(resolve => service.listen(0, '127.0.0.1', resolve));
const port = service.address().port;
const get = (url, encoding, method = 'GET') => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port, path: url, method, headers: encoding === undefined ? {} : { 'Accept-Encoding': encoding } }, res => {
    const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, bytes: Buffer.concat(chunks) })); res.on('error', reject);
  }); req.on('error', reject); req.end();
});
try {
  for (const encoding of ['br', 'gzip']) {
    const result = await get('/', encoding);
    check(`${encoding}解压后与实际3D文件逐字节相同`, () => { assert.equal(result.status, 200); assert.equal(result.headers['content-encoding'], encoding); assert.equal(result.headers.vary, 'Accept-Encoding'); assert.deepEqual(encoding === 'br' ? brotliDecompressSync(result.bytes) : gunzipSync(result.bytes), original); });
    check(`${encoding}实际传输体积减少至少30%`, () => assert.ok(result.bytes.length < original.length * 0.7));
    console.log(`  ${encoding}: ${original.length} → ${result.bytes.length} bytes`);
  }
  const identity = await get('/', 'br;q=0, gzip;q=0');
  check('显式拒绝压缩时返回原文件', () => { assert.equal(identity.headers['content-encoding'], undefined); assert.deepEqual(identity.bytes, original); });
  const head = await get('/', 'br', 'HEAD');
  check('HEAD协商编码但不发送响应体', () => { assert.equal(head.headers['content-encoding'], 'br'); assert.equal(head.bytes.length, 0); });
  const unacceptable = await get('/', '*;q=0');
  check('所有编码均被拒绝时返回406', () => assert.equal(unacceptable.status, 406));
  const binary = await get('/binary', 'br, gzip');
  check('已压缩媒体不重复压缩', () => { assert.equal(binary.headers['content-encoding'], undefined); assert.deepEqual(binary.bytes, original); });
  const api = await get('/api-check', 'br, gzip');
  check('静态压缩不改变API响应', () => { assert.equal(api.headers['content-encoding'], undefined); assert.equal(api.bytes.toString(), '{"ok":true}'); });
  console.log(`静态资源压缩：${count}项通过（本地HTTP、实际3D文件，未写生产数据）`);
} finally { service.closeAllConnections(); await new Promise(resolve => service.close(resolve)); }
