import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const input = process.argv[2];
if (!input) { console.error('用法：npm run verify:live -- https://你的网站'); process.exit(1); }
const base = new URL(input);
if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('请提供不带账号密码的网站地址');
const expected = JSON.parse(await fs.readFile(new URL('../dist/build-edition.json', import.meta.url), 'utf8'));
async function get(route) {
  const url = new URL(route, base.origin); url.searchParams.set('build_check', String(Date.now()));
  const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${route} 返回 ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
const actual = JSON.parse((await get('/build-edition.json')).toString());
if (actual.edition !== expected.edition || actual.version !== expected.version || !actual.build?.sourceSha256 || actual.build.sourceSha256 !== expected.build?.sourceSha256) throw new Error('线上版本或源码摘要与本次本机构建不一致');
// A platform may rebuild the same source with different asset names. Validate
// its own declared artifacts rather than pinning this machine's Vite hashes.
const artifacts = actual.build.artifacts;
const campusPath = '/map/校园地图-3D实景.html';
if (!Array.isArray(artifacts) || !artifacts.length || artifacts.length > 128 || !artifacts.some(file => file.path === '/index.html') || !artifacts.some(file => file.path === campusPath) || !artifacts.every(file => (file.path === '/index.html' || file.path === campusPath || /^\/assets\/[A-Za-z0-9_.-]+\.(?:js|css)$/.test(file.path)) && /^[a-f0-9]{64}$/.test(file.sha256))) throw new Error('线上构建资源清单无效（需包含实际3D入口）');
const homepage = await get('/');
const referenced = [...homepage.toString().matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map(match => match[1]);
if (!referenced.some(file => file.endsWith('.js')) || referenced.some(file => !artifacts.some(artifact => artifact.path === file))) throw new Error('首页引用的资源未包含在本次构建清单中');
for (let i = 0; i < artifacts.length; i += 4) {
  await Promise.all(artifacts.slice(i, i + 4).map(async artifact => {
    const content = artifact.path === '/index.html' ? homepage : await get(artifact.path);
    if (createHash('sha256').update(content).digest('hex') !== artifact.sha256) throw new Error(`${artifact.path} 的内容不一致`);
  }));
}
console.log(`发布资源核验通过：${actual.edition}-${actual.version}，源码摘要一致，${artifacts.length}个文件符合线上本次构建清单。`);
console.log('仍需真实浏览器完成十题、查看图表与建议、圈子提交及返回恢复；资源核验不等于功能验收。');
