import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import { configureDeployment } from '../server/deployment-config.mjs';
import { createDeploymentHandler } from '../server/deployment.mjs';
import { createAccountHandler } from '../server/accounts.mjs';
import { buildCircleCsv } from '../src/lib/circleExport.js';
import { QUESTIONS, MATRIX_VERSION, REQUIRED_COLUMNS } from '../src/lib/surveySchema.js';
import { parseCsvText } from '../src/lib/parseCsv.js';
import { cleanSurveyRows } from '../src/lib/surveyClean.js';
import Papa from 'papaparse';

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'campus-deployment-test-'));
let passed = 0;
const check = (label, fn) => { fn(); passed++; console.log(`✓ ${label}`); };
const root = path.join(temporary, 'program'); fs.mkdirSync(root);
const setupToken = 'synthetic-deployment-test-token-2026';
const password = 'Restore12345';
const answers = Object.fromEntries(QUESTIONS.map(q => [q.field, q.options[0].text]));
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const cli = (file, args, env) => execFileSync(process.execPath, [fileURLToPath(new URL(`./${file}`, import.meta.url)), ...args], { env: { ...process.env, ...env }, stdio: 'pipe' });
async function listen(handler) {
  const server = http.createServer((req, res) => handler(req, res, () => { res.writeHead(404); res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); handler.close?.(); } };
}
function client(service) {
  return { cookie: '', csrf: '', async call(route, method = 'GET', body) {
    const response = await fetch(service.url + '/api/campus' + route, { method, headers: { Cookie: this.cookie, ...(method === 'GET' ? {} : { Origin: service.url, 'Content-Type': 'application/json', 'X-CSRF-Token': this.csrf }) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json(); if (response.headers.get('set-cookie')) this.cookie = response.headers.get('set-cookie').split(';')[0]; if (data.csrf) this.csrf = data.csrf;
    return { status: response.status, data };
  } };
}
let service, restoredService;
try {
  fs.writeFileSync(path.join(root, '.env.local'), "# prior config\nLLM_API_KEY='synthetic-not-a-real-key'\nLLM_API_KEY_FILE='C:/private/owner key.txt'\nCUSTOM='preserve # spaces'\n");
  const common = { root, siteName: '体验站点', mode: 'self-hosted', access: 'local' };
  const result = configureDeployment(common);
  let env = parseEnv(fs.readFileSync(path.join(root, '.env.local'), 'utf8'));
  check('独立部署可配置本机模式，不要求公共站点在线', () => { assert.equal(result.mode, 'self-hosted'); assert.equal(env.APP_ORIGIN, ''); assert.equal(env.PORT, '5191'); });
  check('配置工具保留原有模型配置与其他环境值', () => { assert.equal(env.LLM_API_KEY, 'synthetic-not-a-real-key'); assert.equal(env.LLM_API_KEY_FILE, 'C:/private/owner key.txt'); assert.equal(env.CUSTOM, 'preserve # spaces'); });
  check('仅配置不会初始化账号或改写数据库', () => assert.equal(fs.existsSync(path.join(root, '.campus-data')), false));
  configureDeployment({ ...common, mode: 'shared', access: 'public', origin: 'https://campus.example.com', port: 5240 });
  env = parseEnv(fs.readFileSync(path.join(root, '.env.local'), 'utf8'));
  check('公共站点使用相同配置工具，生成 HTTPS 来源与域名', () => { assert.equal(env.CAMPUS_DEPLOYMENT, 'shared'); assert.equal(env.CAMPUS_DOMAIN, 'campus.example.com'); assert.equal(env.APP_ORIGIN, 'https://campus.example.com'); assert.equal(env.PORT, '5240'); });
  const beforeInvalid = digest(path.join(root, '.env.local'));
  for (const origin of ['http://campus.example.com', 'https://campus.example.com/', 'https://campus.example.com/path', 'https://user:pass@campus.example.com', 'https://campus.example.com:5443']) check(`拒绝不兼容正式来源 ${origin.replace('user:pass@','')}`, () => assert.throws(() => configureDeployment({ ...common, access: 'public', origin })));
  check('拒绝将数据目录配置到公开下载目录', () => assert.throws(() => configureDeployment({ ...common, dataDir: 'release-download/data' }), /outside public/));
  check('无效配置不破坏原配置', () => assert.equal(digest(path.join(root, '.env.local')), beforeInvalid));
  const deployment = await listen(createDeploymentHandler({ root, env }));
  try {
    let r = await fetch(deployment.url + '/api/deployment'), d = await r.json();
    check('公开状态只含使用方式、站名和下载是否可用', () => { assert.deepEqual(Object.keys(d).sort(), ['downloadAvailable', 'mode', 'siteName']); assert.equal(d.mode, 'shared'); assert.equal(d.downloadAvailable, false); assert.ok(!JSON.stringify(d).includes(temporary)); });
    r = await fetch(deployment.url + '/api/deployment/download'); check('没有部署包时不返回假下载', () => assert.equal(r.status, 404));
    fs.mkdirSync(path.join(root, 'release-download'));
    const archive = Buffer.from('PK\x03\x04synthetic-package'); fs.writeFileSync(path.join(root, 'release-download/campus-insight-admin.zip'), archive);
    r = await fetch(deployment.url + '/api/deployment'); d = await r.json();
    check('提供部署包后状态即时可用，无需重新构建', () => assert.equal(d.downloadAvailable, true));
    r = await fetch(deployment.url + '/api/deployment/download?file=.env.local');
    const bytes = Buffer.from(await r.arrayBuffer());
    check('下载只返回固定的无数据部署包，不能用参数读取其他文件', () => { assert.deepEqual(bytes, archive); assert.equal(r.headers.get('content-type'), 'application/zip'); assert.match(r.headers.get('content-disposition'), /attachment/); });
    r = await fetch(deployment.url + '/api/deployment/download', { method: 'POST' }); check('下载接口不接受写入', () => assert.equal(r.status, 405));
  } finally { await deployment.close(); }
  const sourceDir = path.join(temporary, 'source-data');
  service = await listen(createAccountHandler({ root, dataDir: sourceDir, setupToken }));
  const owner = client(service);
  let r = await owner.call('/setup', 'POST', { username: 'owner', displayName: '迁移管理员', password, setupToken }); assert.equal(r.status, 200);
  const ownerId = r.data.user.id;
  r = await owner.call('/circles', 'POST', { name: '迁移测试圈子' }); const circleId = r.data.id;
  await owner.call(`/circles/${circleId}/invites`, 'POST', { maxUses: 2 });
  await owner.call(`/circles/${circleId}/submissions`, 'POST', { answers, matrixVersion: MATRIX_VERSION, expectedUserId: ownerId, consent: 'circle-raw-v1' });
  const backup = path.join(temporary, 'private-backup.sqlite');
  cli('backup-accounts.mjs', [backup], { CAMPUS_DATA_DIR: sourceDir });
  const destination = path.join(temporary, 'restored-data');
  cli('restore-accounts.mjs', [backup], { CAMPUS_DATA_DIR: destination });
  const db = new DatabaseSync(path.join(destination, 'campus.sqlite'));
  check('整站迁移保留账号、圈子与答卷', () => { assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1); assert.equal(db.prepare('SELECT name FROM circles WHERE id=?').get(circleId).name, '迁移测试圈子'); assert.deepEqual(JSON.parse(db.prepare('SELECT answers FROM submissions').get().answers), answers); });
  check('迁移自动清除会话并撤销旧邀请', () => { assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0); assert.equal(db.prepare('SELECT COUNT(*) AS n FROM invites WHERE revoked=0').get().n, 0); });
  db.close();
  const beforeRestore = digest(path.join(destination, 'campus.sqlite'));
  check('恢复拒绝覆盖现有数据库', () => assert.throws(() => cli('restore-accounts.mjs', [backup], { CAMPUS_DATA_DIR: destination })));
  check('被拒绝的恢复未修改目标数据', () => assert.equal(digest(path.join(destination, 'campus.sqlite')), beforeRestore));
  const invalidDb = path.join(temporary, 'invalid.sqlite'); const invalid = new DatabaseSync(invalidDb); invalid.exec('CREATE TABLE users(id TEXT)'); invalid.close();
  const invalidDestination = path.join(temporary, 'invalid-destination');
  check('损坏或不兼容备份不能成为正式数据库', () => { assert.throws(() => cli('restore-accounts.mjs', [invalidDb], { CAMPUS_DATA_DIR: invalidDestination })); assert.equal(fs.existsSync(path.join(invalidDestination, 'campus.sqlite')), false); });
  restoredService = await listen(createAccountHandler({ root, dataDir: destination }));
  const restoredOwner = client(restoredService);
  r = await restoredOwner.call('/login', 'POST', { username: 'owner', password });
  check('独立迁移后仍可用原账号密码登录', () => assert.equal(r.status, 200));
  const afterMigration = await restoredOwner.call(`/circles/${circleId}/members`);
  check('迁移后管理员仍可查看原始答案', () => assert.deepEqual(afterMigration.data.members[0].submission.answers, answers));
  const sourceCookie = owner.cookie;
  const cross = client(restoredService); cross.cookie = sourceCookie;
  r = await cross.call('/session'); check('另一个站点的 cookie 不能跨实例登录', () => assert.equal(r.data.user, null));
  const csv = buildCircleCsv([{ id: 'one', displayName: '=HYPERLINK("x")', submission: { answers, matrixVersion: MATRIX_VERSION, submittedAt: '2026-10-22T00:00:00.000Z', revision: 2 } }, { id: 'unsubmitted' }, { id: 'old', submission: { answers, matrixVersion: MATRIX_VERSION - 1 } }]);
  const parsed = parseCsvText(csv, REQUIRED_COLUMNS);
  const cleaned = cleanSurveyRows(parsed.rows);
  check('答卷 CSV 可直接进入既有离线统计，不重复导出未提交或旧题库记录', () => { assert.equal(cleaned.records.length, 1); for (const q of QUESTIONS) assert.equal(cleaned.records[0][q.field], answers[q.field]); });
  check('姓名公式转义，账号密码不进入圈子 CSV', () => { const row = Papa.parse(csv, { header: true }).data[0]; assert.equal(row['显示名称'], '\'=HYPERLINK("x")'); assert.ok(!csv.includes(password)); assert.equal(row['提交次数'], '2'); });
  console.log(`双方式部署、交接恢复与数据带走：${passed} 项通过`);
} finally {
  if (service) await service.close(); if (restoredService) await restoredService.close();
  const relative = path.relative(os.tmpdir(), temporary);
  if (!relative.startsWith('campus-deployment-test-') || relative.includes(path.sep)) throw new Error('Unexpected test directory');
  fs.rmSync(temporary, { recursive: true });
}
