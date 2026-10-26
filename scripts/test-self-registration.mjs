import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createAccountHandler } from '../server/accounts.mjs';
import { QUESTIONS, MATRIX_VERSION } from '../src/lib/surveySchema.js';

const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'campus-self-register-'));
let handler, server, origin, checks = 0;
function check(label, fn) { fn(); checks++; console.log(`✓ ${label}`); }
async function start() {
  handler = createAccountHandler({ root: temporary, dataDir: path.join(temporary, 'data'), setupToken: '', origin: '' });
  server = http.createServer((req, res) => handler(req, res, () => { res.writeHead(404); res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
}
async function stop() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); handler.close(); }
function client() {
  return { cookie: '', csrf: '', user: null, async call(route, method = 'GET', body) {
    const response = await fetch(origin + '/api/campus' + route, { method, headers: { Cookie: this.cookie, ...(method !== 'GET' ? { Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': this.csrf } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json();
    if (response.headers.get('set-cookie')) this.cookie = response.headers.get('set-cookie').split(';')[0];
    if (data.user) { this.user = data.user; this.csrf = data.csrf; }
    return { status: response.status, data };
  } };
}
const answers = Object.fromEntries(QUESTIONS.map(q => [q.field, q.options[0].text]));
try {
  await start();
  const a = client(), b = client(), m = client(), guest = client();
  let r = await a.call('/session');
  check('新空站点直接提供注册，无需初始化', () => assert.equal(r.data.setupRequired, false));
  const hasSetupFile = await fs.access(path.join(temporary, 'data/setup-key.txt')).then(() => true, () => false);
  check('新部署不生成初始化口令文件', () => assert.equal(hasSetupFile, false));
  r = await a.call('/register', 'POST', { username: 'firstadmin', password: '123456', registrationMode: 'create', circleName: '自己的第一圈' });
  check('首位用户自设6位密码，注册即创建圈子', () => { assert.equal(r.status, 200); assert.ok(r.data.circleId); });
  const firstId = r.data.circleId;
  r = await a.call('/circles');
  check('新用户只具有自己新建圈子的管理员权限', () => assert.deepEqual(r.data.circles, [{ id: firstId, name: '自己的第一圈', role: 'admin' }]));
  r = await b.call('/register', 'POST', { username: 'secondadmin', password: '123456789012', registrationMode: 'create' });
  const secondId = r.data.circleId;
  check('后来的用户也能直接注册为自己圈子的管理员', () => { assert.equal(r.status, 200); assert.ok(secondId && secondId !== firstId); });
  for (const [who, id] of [[a, secondId], [b, firstId]]) {
    r = await who.call(`/circles/${id}/members`);
    check('自建圈子不会授予跨圈读取权限', () => assert.equal(r.status, 403));
  }
  const payload = { answers, matrixVersion: MATRIX_VERSION, consent: 'circle-raw-v1', expectedUserId: a.user.id };
  r = await a.call(`/circles/${firstId}/submissions`, 'POST', { ...payload, consent: null });
  check('管理员自己填报也须确认共享', () => assert.equal(r.status, 400));
  r = await a.call(`/circles/${firstId}/submissions`, 'POST', payload);
  check('管理员的十题答案可直接提交到自己的圈子', () => { assert.equal(r.status, 200); assert.deepEqual(r.data.submission.answers, answers); });
  r = await a.call(`/circles/${firstId}/members`);
  check('工作台真实收到管理员本人答卷，汇总仅有一份', () => { assert.equal(r.data.members.length, 1); assert.equal(r.data.members[0].id, a.user.id); assert.deepEqual(r.data.members[0].submission.answers, answers); });
  const invited = await a.call(`/circles/${firstId}/invites`, 'POST', { maxUses: 1 });
  r = await m.call('/register', 'POST', { username: 'invited', password: '123456', registrationMode: 'join', invite: invited.data.token });
  check('邀请码仍只授予成员权限', () => { assert.equal(r.status, 200); assert.equal(r.data.circleId, firstId); });
  r = await m.call(`/circles/${firstId}/members`);
  check('受邀成员不能读取管理员或他人答卷', () => assert.equal(r.status, 403));
  r = await guest.call('/register', 'POST', { username: 'noinvite', password: '123456', registrationMode: 'join' });
  check('选择加入别人圈子时仍必须提供邀请', () => assert.equal(r.status, 400));
  r = await guest.call('/register', 'POST', { username: 'noinvite', password: '123456', registrationMode: 'create', circleName: '个人圈子' });
  check('失败注册不会留下占用账号的半成品', () => assert.equal(r.status, 200));
  const denied = await b.call(`/circles/${firstId}/submissions`, 'POST', { ...payload, expectedUserId: b.user.id });
  check('另一管理员不能向未加入的圈子写入', () => assert.equal(denied.status, 403));
  await stop(); await start();
  r = await a.call(`/circles/${firstId}`);
  check('服务重启后新注册账号和本人答卷保留', () => { assert.equal(r.status, 200); assert.deepEqual(r.data.submission.answers, answers); });
  console.log(`自主注册与管理员直接填报：${checks} 项通过`);
} finally {
  if (server?.listening) await stop();
  const relative = path.relative(os.tmpdir(), temporary);
  if (!relative.startsWith('campus-self-register-') || relative.includes(path.sep)) throw new Error('Unexpected temporary path');
  await fs.rm(temporary, { recursive: true });
}
