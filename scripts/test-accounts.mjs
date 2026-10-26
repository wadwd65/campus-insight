import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomBytes, scryptSync } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createAccountHandler } from '../server/accounts.mjs';
import { QUESTIONS, MATRIX_VERSION } from '../src/lib/surveySchema.js';
import { readSurveyDraft, saveSurveyDraft, clearAccountDrafts } from '../src/lib/surveyDraft.js';
import { JOURNEY_QUESTIONS } from '../src/lib/surveyJourney.js';

const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'campus-accounts-test-'));
const setupToken = randomBytes(32).toString('hex');
const password = '123456';
const answers = Object.fromEntries(QUESTIONS.map(q => [q.field, q.options[0].text]));
let handler, server, origin, checks = 0;
const check = (label, fn) => { fn(); checks++; console.log(`✓ ${label}`); };
async function start() {
  handler = createAccountHandler({ dataDir: temporary, setupToken });
  server = http.createServer((req, res) => handler(req, res, () => { res.writeHead(404); res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
}
async function stop() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); handler.close(); }
function client() {
  return { cookie: '', csrf: '', user: null, async call(route, method = 'GET', body, extra = {}) {
    const headers = { Cookie: this.cookie, ...(method === 'GET' ? {} : { Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': this.csrf }), ...extra };
    const r = await fetch(origin + '/api/campus' + route, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const cookie = r.headers.get('set-cookie'); if (cookie) this.cookie = cookie.split(';')[0];
    const data = await r.json();
    if (data.user) { this.user = data.user; this.csrf = data.csrf; }
    return { status: r.status, data, headers: r.headers };
  } };
}
async function ok(c, route, method = 'GET', body) { const r = await c.call(route, method, body); assert.equal(r.status, 200, JSON.stringify({ route, status: r.status, data: r.data })); return r.data; }
try {
  await start();
  const guest = client(), admin = client(), member = client(), outsider = client();
  check('首次启动无默认账号', () => { const initial = new DatabaseSync(path.join(temporary, 'campus.sqlite')); try { assert.equal(initial.prepare('SELECT COUNT(*) AS n FROM users').get().n, 0); } finally { initial.close(); } });
  check('拒绝将数据库放进公开资源目录', () => assert.throws(() => createAccountHandler({ root: temporary, dataDir: path.join(temporary, 'public', 'data'), setupToken }), /outside public/));
  let r = await guest.call('/session');
  check('直接开放注册，会话不要求开通口令且禁用缓存', () => { assert.equal(r.data.setupRequired, false); assert.equal(r.data.user, null); assert.ok(!JSON.stringify(r.data).includes(setupToken)); assert.equal(r.headers.get('cache-control'), 'no-store'); });
  r = await guest.call('/circles'); check('匿名不能读取圈子', () => assert.equal(r.status, 401));
  r = await guest.call('/setup', 'POST', { username: 'admin', password, displayName: '测试管理员', setupToken: 'wrong' }); check('初始化不允许访客抢占', () => assert.equal(r.status, 403));
  r = await admin.call('/setup', 'POST', { username: 'admin', password, displayName: '测试管理员', setupToken });
  check('部署者凭口令初始化，使用 HttpOnly SameSite cookie', () => { assert.equal(r.status, 200); assert.match(r.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/); assert.ok(r.data.csrf); });
  r = await guest.call('/setup', 'POST', { username: 'otheradmin', password, displayName: '伪管理员', setupToken }); check('已初始化后拒绝再次初始化', () => assert.equal(r.status, 409));
  r = await admin.call('/circles', 'POST', { name: '测试一班' }, { Origin: 'https://evil.example' }); check('阻止跨站写入', () => assert.equal(r.status, 403));
  r = await admin.call('/circles', 'POST', { name: '测试一班' }, { 'X-CSRF-Token': '' }); check('缺少 CSRF 校验拒绝写入', () => assert.equal(r.status, 403));
  r = await admin.call('/circles', 'POST', { name: '测试一班' }, { Origin: '' }); check('写入必须来自本站 Origin', () => assert.equal(r.status, 403));
  const a = await ok(admin, '/circles', 'POST', { name: '测试一班' });
  const invite = await ok(admin, `/circles/${a.id}/invites`, 'POST', { maxUses: 2, hours: 24 });
  for (const [username, invalidPassword] of [['shortpass', '12345'], ['longpass', '1234567890123']]) {
    r = await guest.call('/register', 'POST', { username, password: invalidPassword, invite: invite.token });
    check(`拒绝 ${invalidPassword.length} 位新密码，未消耗邀请`, () => { assert.equal(r.status, 400); assert.equal(r.data.error, '密码需为 6–12 位'); });
  }
  r = await member.call('/register', 'POST', { username: 'member', password, displayName: '测试成员', invite: invite.token });
  check('6 位纯数字密码注册并自动加入指定圈子', () => { assert.equal(r.status, 200); assert.equal(r.data.circleId, a.id); });
  r = await outsider.call('/register', 'POST', { username: 'outsider', password: 'Abcd12345678', invite: invite.token });
  check('12 位密码可注册，显示名称选填且邀请按人数消耗', () => { assert.equal(r.status, 200); assert.equal(r.data.user.displayName, 'outsider'); });
  r = await guest.call('/register', 'POST', { username: 'excess', password, displayName: '超额', invite: invite.token }); check('用完的邀请码不可继续注册', () => assert.equal(r.status, 400));
  r = await member.call(`/circles/${a.id}/members`); check('成员不能列举他人身份或答卷', () => assert.equal(r.status, 403));
  r = await member.call(`/circles/${a.id}/invites`, 'POST', {}); check('成员不能创建管理员邀请', () => assert.equal(r.status, 403));
  const b = await ok(outsider, '/circles', 'POST', { name: '测试二班' });
  r = await admin.call(`/circles/${b.id}/members`); check('另一圈管理员没有跨圈读取特权', () => assert.equal(r.status, 403));
  r = await member.call(`/circles/${b.id}`); check('猜测圈子编号不能越权访问', () => assert.equal(r.status, 403));
  const payload = { answers, matrixVersion: MATRIX_VERSION, consent: 'circle-raw-v1', expectedUserId: member.user.id };
  r = await member.call(`/circles/${a.id}/submissions`, 'POST', { ...payload, consent: null }); check('缺少明确共享确认拒绝提交', () => assert.equal(r.status, 400));
  r = await member.call(`/circles/${a.id}/submissions`, 'POST', { ...payload, expectedUserId: admin.user.id }); check('账号切换后拒绝误交旧账号答卷', () => assert.equal(r.status, 409));
  r = await member.call(`/circles/${a.id}/submissions`, 'POST', { ...payload, answers: { ...answers, privateEmail: 'excluded@example.invalid' } }); check('多余身份字段不能进入答卷', () => assert.equal(r.status, 400));
  r = await member.call(`/circles/${a.id}/submissions`, 'POST', { ...payload, answers: { ...answers, [QUESTIONS[0].field]: '未知选项' } }); check('未知选项不能进入统计', () => assert.equal(r.status, 400));
  r = await member.call(`/circles/${a.id}/submissions`, 'POST', { ...payload, matrixVersion: MATRIX_VERSION + 1 }); check('旧或未知题库版本不能误算', () => assert.equal(r.status, 400));
  const saved = await ok(member, `/circles/${a.id}/submissions`, 'POST', payload);
  check('有效十题与提交时间持久化', () => { assert.deepEqual(saved.submission.answers, answers); assert.equal(saved.submission.revision, 1); assert.ok(Date.parse(saved.submission.submittedAt)); });
  const changed = { ...answers, [QUESTIONS[0].field]: QUESTIONS[0].options[1].text };
  const revised = await ok(member, `/circles/${a.id}/submissions`, 'POST', { ...payload, answers: changed });
  check('重复填报替换同一人的最新答卷', () => { assert.equal(revised.submission.revision, 2); assert.deepEqual(revised.submission.answers, changed); });
  const all = await ok(admin, `/circles/${a.id}/members`);
  check('管理员可读本圈原始答卷且不返回密码、会话或账号标识', () => { const m = all.members.find(x => x.id === member.user.id); assert.deepEqual(m.submission.answers, changed); assert.equal(all.members.filter(x => x.submission).length, 1); assert.ok(!JSON.stringify(all).includes(password)); assert.ok(!Object.hasOwn(m, 'username')); });
  const own = await ok(outsider, `/circles/${a.id}`); check('普通成员读取详情只返回自己的填报', () => { assert.equal(own.submission, null); assert.ok(!Object.hasOwn(own, 'members')); });
  r = await outsider.call(`/circles/${a.id}/submissions/${member.user.id}`); check('成员不能指定别人读取答卷', () => assert.equal(r.status, 403));
  r = await admin.call(`/circles/${b.id}/submissions`, 'POST', { ...payload, expectedUserId: admin.user.id }); check('非成员不可向别圈写入', () => assert.equal(r.status, 403));
  const revoked = await ok(admin, `/circles/${a.id}/invites`, 'POST', {});
  await ok(admin, `/circles/${a.id}/invites/${revoked.id}`, 'DELETE');
  r = await outsider.call('/join', 'POST', { invite: revoked.token }); check('管理员撤销邀请码立即生效', () => assert.equal(r.status, 400));
  const activeInvite = await ok(outsider, `/circles/${b.id}/invites`, 'POST', {});
  r = await member.call('/join', 'POST', { invite: activeInvite.token }); check('已注册用户可受邀加入另一个圈子', () => assert.equal(r.status, 200));
  const detailB = await ok(member, `/circles/${b.id}`); check('圈间答卷不自动复制', () => assert.equal(detailB.submission, null));
  await stop(); await start();
  const persisted = await ok(admin, `/circles/${a.id}/members`);
  check('服务重启后账号、会话和最新答卷仍可使用', () => { assert.equal(persisted.members.find(x => x.id === member.user.id).submission.revision, 2); });
  const inspection = new DatabaseSync(path.join(temporary, 'campus.sqlite'));
  check('数据库只保存 scrypt 密码派生值及会话/邀请哈希', () => {
    const u = inspection.prepare('SELECT password FROM users WHERE username=?').get('member'); assert.match(u.password, /^scrypt-v1:/); assert.ok(!u.password.includes(password));
    const s = inspection.prepare('SELECT token_hash FROM sessions WHERE user_id=?').get(member.user.id); assert.notEqual(s.token_hash, member.cookie.split('=')[1]);
    assert.equal(inspection.prepare('SELECT 1 FROM invites WHERE token_hash=?').get(invite.token), undefined);
  });
  const exp = await ok(admin, `/circles/${a.id}/invites`, 'POST', {});
  inspection.prepare('UPDATE invites SET expires_at=0 WHERE id=?').run(exp.id);
  r = await member.call('/join', 'POST', { invite: exp.token }); check('过期邀请码不可使用', () => assert.equal(r.status, 400));
  const legacyPassword = 'Synthetic-legacy-passphrase-2026';
  const legacySalt = randomBytes(16).toString('hex');
  const legacyHash = `scrypt-v1:${legacySalt}:${scryptSync(legacyPassword, legacySalt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }).toString('hex')}`;
  inspection.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run('legacy-test-user', 'legacyuser', '历史测试账号', legacyHash, Date.now());
  inspection.close();
  const legacy = client();
  r = await legacy.call('/login', 'POST', { username: 'legacyuser', password: legacyPassword });
  check('已有长密码账号仍能直接登录，无需重新注册', () => assert.equal(r.status, 200));
  await ok(legacy, '/password', 'POST', { currentPassword: legacyPassword, password });
  r = await legacy.call('/login', 'POST', { username: 'legacyuser', password });
  check('历史长密码可直接修改为 6 位新密码并重登', () => assert.equal(r.status, 200));
  const backupFile = path.join(temporary, 'snapshot.sqlite');
  execFileSync(process.execPath, [fileURLToPath(new URL('./backup-accounts.mjs', import.meta.url)), backupFile], { env: { ...process.env, CAMPUS_DATA_DIR: temporary }, stdio: 'pipe' });
  const backupDb = new DatabaseSync(backupFile, { readOnly: true });
  check('运行中一致性备份可独立恢复最新答卷', () => { assert.equal(backupDb.prepare('SELECT revision FROM submissions WHERE circle_id=? AND user_id=?').get(a.id, member.user.id).revision, 2); assert.equal(backupDb.prepare('PRAGMA integrity_check').get().integrity_check, 'ok'); });
  backupDb.close();
  await ok(member, `/circles/${a.id}/submissions`, 'DELETE');
  const withdrawn = await ok(admin, `/circles/${a.id}/members`); check('成员撤回后管理员汇总不再包含该人答卷', () => assert.equal(withdrawn.members.find(m => m.id === member.user.id).submission, null));
  await ok(member, `/circles/${a.id}/submissions`, 'POST', payload);
  await ok(admin, `/circles/${a.id}/members/${member.user.id}`, 'DELETE');
  r = await member.call(`/circles/${a.id}`); check('移除成员后立即撤销圈内访问', () => assert.equal(r.status, 403));
  const afterRemove = await ok(admin, `/circles/${a.id}/members`); check('移除成员同时删除其本圈答卷', () => assert.ok(!afterRemove.members.some(m => m.id === member.user.id)));
  r = await admin.call(`/circles/${a.id}/members/${admin.user.id}`, 'DELETE'); check('管理员不能误删自己', () => assert.equal(r.status, 400));
  const stale = { cookie: member.cookie, csrf: member.csrf };
  for (const invalidPassword of ['12345', '1234567890123']) {
    r = await member.call('/password', 'POST', { currentPassword: password, password: invalidPassword });
    check(`修改密码拒绝 ${invalidPassword.length} 位新值`, () => assert.equal(r.status, 400));
  }
  await ok(member, '/password', 'POST', { currentPassword: password, password: 'Abcd12345678' });
  const oldDevice = client(); Object.assign(oldDevice, stale);
  r = await oldDevice.call('/session'); check('改密后其他设备旧会话失效', () => assert.equal(r.data.user, null));
  r = await guest.call('/login', 'POST', { username: 'member', password }); check('旧密码无法登录', () => assert.equal(r.status, 401));
  await ok(guest, '/login', 'POST', { username: 'member', password: 'Abcd12345678' });
  const tokenBeforeLogout = guest.cookie;
  await ok(guest, '/logout', 'POST', {});
  guest.cookie = tokenBeforeLogout;
  r = await guest.call('/session'); check('退出后旧 cookie 不能复用', () => assert.equal(r.data.user, null));
  const expiredDb = new DatabaseSync(path.join(temporary, 'campus.sqlite'));
  expiredDb.prepare('UPDATE sessions SET expires_at=0 WHERE user_id=?').run(outsider.user.id);
  expiredDb.close();
  r = await outsider.call('/circles'); check('过期会话无法读取圈内数据', () => assert.equal(r.status, 401));
  const jar = new Map(); const storage = { get length() { return jar.size; }, key: index => [...jar.keys()][index], getItem: key => jar.get(key), setItem: (key, value) => jar.set(key, value), removeItem: key => jar.delete(key) };
  const firstTwo = Object.fromEntries(JOURNEY_QUESTIONS.slice(0, 2).map(q => [q.field, q.options[0].text]));
  saveSurveyDraft(2, firstTwo, storage, 'a:circle-one'); saveSurveyDraft(2, firstTwo, storage, 'b:circle-one'); saveSurveyDraft(2, firstTwo, storage);
  check('圈子和账号分开保存草稿', () => { assert.equal(readSurveyDraft(storage, 'a:circle-two'), null); assert.deepEqual(readSurveyDraft(storage, 'a:circle-one').answers, firstTwo); });
  clearAccountDrafts('a', storage);
  check('退出仅清除该账号圈子草稿，保留访客草稿', () => { assert.equal(readSurveyDraft(storage, 'a:circle-one'), null); assert.ok(readSurveyDraft(storage, 'b:circle-one')); assert.ok(readSurveyDraft(storage)); });
  for (let n = 0; n < 14; n++) r = await guest.call('/login', 'POST', { username: 'nonexistent', password });
  check('登录爆破触发服务端速率限制', () => assert.equal(r.status, 429));
  const secureHandler = createAccountHandler({ dataDir: path.join(temporary, 'https'), setupToken, origin: 'https://campus.example.test' });
  const secureServer = http.createServer((req, res) => secureHandler(req, res, () => res.end()));
  await new Promise(resolve => secureServer.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${secureServer.address().port}/api/campus/setup`, { method: 'POST', headers: { Origin: 'https://campus.example.test', 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'secure', displayName: 'HTTPS测试', password, setupToken }) });
    check('HTTPS 部署使用 Secure 主机专属 Cookie', () => { assert.equal(response.status, 200); assert.match(response.headers.get('set-cookie'), /^__Host-campus_sid=/); assert.match(response.headers.get('set-cookie'), /; Secure$/); assert.ok(!response.headers.get('set-cookie').includes('Domain=')); });
  } finally { secureServer.closeAllConnections(); await new Promise(resolve => secureServer.close(resolve)); secureHandler.close(); }
  console.log(`账号、邀请、权限隔离与持久化：${checks} 项通过`);
} finally {
  if (server?.listening) await stop();
  const relative = path.relative(os.tmpdir(), temporary);
  if (!relative.startsWith('campus-accounts-test-') || relative.includes(path.sep)) throw new Error('Refusing to remove an unexpected temporary directory');
  await fs.rm(temporary, { recursive: true });
}
