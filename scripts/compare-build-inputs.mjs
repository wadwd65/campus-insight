import fs from 'node:fs/promises';
import { compareBuildInputs } from './build-inputs.mjs';

const target = process.argv[2];
if (!target) { console.error('用法：npm run compare:inputs -- https://网站地址（也可提供另一份build-inputs.json路径）'); process.exit(2); }
const expected = JSON.parse(await fs.readFile(new URL('../dist/build-inputs.json', import.meta.url), 'utf8'));
let text;
if (/^https?:\/\//.test(target)) {
  const base = new URL(target);
  if (base.username || base.password) throw new Error('网站地址不能带账号密码');
  const response = await fetch(new URL('/build-inputs.json', base.origin), { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`线上输入清单返回${response.status}；旧版本需先由部署方运行新版构建，或导出清单文件再比对`);
  text = await response.text();
} else text = await fs.readFile(target, 'utf8');
const actual = JSON.parse(text), difference = compareBuildInputs(expected, actual);
console.log(`本地源码摘要：${expected.sourceSha256}\n目标源码摘要：${actual.sourceSha256}`);
for (const [key, label] of [['extra', '仅目标存在'], ['missing', '目标缺少'], ['changed', '内容不同']]) {
  console.log(`${label}：${difference[key].length}项`);
  for (const name of difference[key]) console.log(`  ${name}`);
}
const equal = Object.values(difference).every(files => files.length === 0) && expected.sourceSha256 === actual.sourceSha256;
console.log(equal ? '构建输入一致。' : '构建输入不一致；请合并或清理已定位的源码文件，不要修改生产账号数据。');
process.exitCode = equal ? 0 : 1;
