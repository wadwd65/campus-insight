import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createClientAddressResolver } from '../server/client-address.mjs';
import { createAccountHandler } from '../server/accounts.mjs';

let count = 0;
const check = (label, fn) => { fn(); count++; console.log(`✓ ${label}`); };
const request = (peer, forwarded) => ({ socket: { remoteAddress: peer }, headers: { 'x-forwarded-for': forwarded } });
const untrusted = createClientAddressResolver();
const trusted = createClientAddressResolver('127.0.0.1,::1,10.20.0.0/16');
check('默认忽略伪造的转发头', () => assert.equal(untrusted(request('127.0.0.1', '192.0.2.1')), '127.0.0.1'));
check('只接收可信代理传来的真实来源', () => assert.equal(trusted(request('127.0.0.1', '192.0.2.1')), '192.0.2.1'));
check('IPv4映射地址与可信代理匹配', () => assert.equal(trusted(request('::ffff:127.0.0.1', '192.0.2.2')), '192.0.2.2'));
check('代理链从右往左停在第一个非可信来源', () => assert.equal(trusted(request('::1', '198.51.100.1, 192.0.2.3, 10.20.0.2')), '192.0.2.3'));
check('非可信直连不能利用可信IP的转发头', () => assert.equal(trusted(request('192.0.2.4', '127.0.0.1')), '192.0.2.4'));
check('畸形、空和过长转发链保守回退到连接来源', () => {
  for (const value of ['', ',192.0.2.1', '192.0.2.1, unknown', Array(34).fill('192.0.2.1').join(',')]) assert.equal(trusted(request('127.0.0.1', value)), '127.0.0.1');
});
check('IPv6可信网络可以正确解析', () => assert.equal(createClientAddressResolver('2001:db8::/32')(request('2001:db8::1', '2001:db9::2')), '2001:db9::2'));
check('非法代理配置拒绝启动', () => {
  for (const value of ['true', '1', '0.0.0.0/0', '::/0', '127.0.0.1/33', '::1/129', '127.0.0.1/no', '127.0.0.1/8/2']) assert.throws(() => createClientAddressResolver(value), /CAMPUS_TRUSTED_PROXIES/);
});

const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'campus-proxy-test-'));
let service;
async function start(name, proxies) {
  const handler = createAccountHandler({ dataDir: path.join(temporary, name), trustedProxies: proxies, setupToken: undefined });
  const server = http.createServer((req, res) => handler(req, res, () => { res.writeHead(404); res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    async stop() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); handler.close(); },
  };
}
async function sessions(service, addressOf) {
  let firstFailure = null;
  for (let i = 1; i <= 241; i++) {
    const response = await fetch(service.url + '/api/campus/session', { headers: { 'X-Forwarded-For': addressOf(i) } });
    await response.json();
    if (response.status !== 200) { firstFailure = { request: i, status: response.status }; break; }
  }
  return firstFailure;
}
try {
  service = await start('trusted', '127.0.0.1');
  const separate = await sessions(service, i => `192.0.2.${i}`);
  check('同一可信代理后的241位不同访客不再共用限流桶', () => assert.equal(separate, null));
  const cookies = [];
  for (let i = 1; i <= 21; i++) {
    const response = await fetch(service.url + '/api/campus/register', { method: 'POST', headers: { Origin: service.url, 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.100.${i}` }, body: JSON.stringify({ username: `test-${i}`, password: '123456', registrationMode: 'create' }) });
    await response.json(); assert.equal(response.status, 200, `第${i}个不同来源注册应成功`);
    if (i <= 2) cookies.push(response.headers.get('set-cookie').split(';')[0]);
  }
  check('21位不同来源注册不会耗尽同一个20次创建配额', () => {});
  for (let i = 1; i <= 241; i++) {
    const response = await fetch(service.url + '/api/campus/session', { headers: { Cookie: cookies[0], 'X-Forwarded-For': '203.0.113.1' } });
    await response.json(); assert.equal(response.status, i === 241 ? 429 : 200);
  }
  const otherUser = await fetch(service.url + '/api/campus/session', { headers: { Cookie: cookies[1], 'X-Forwarded-For': '203.0.113.1' } });
  const otherData = await otherUser.json();
  check('同一网络的已登录账号请求配额互不影响', () => { assert.equal(otherUser.status, 200); assert.ok(otherData.user); });
  await service.stop(); service = null;
  service = await start('same-client', '127.0.0.1');
  const repeated = await sessions(service, () => '192.0.2.1');
  check('同一个真实来源第241次请求仍被限流', () => assert.deepEqual(repeated, { request: 241, status: 429 }));
  await service.stop(); service = null;
  service = await start('forged', '');
  assert.deepEqual(await sessions(service, i => `192.0.2.${i}`), { request: 241, status: 429 });
  check('未配置可信代理时，轮换伪造转发头不能绕过限流', () => {});
  console.log(`可信代理与限流隔离：${count}项通过（临时数据库，无生产写入）`);
} finally {
  await service?.stop();
  assert.equal(path.dirname(path.resolve(temporary)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(temporary).startsWith('campus-proxy-test-'));
  await fs.rm(temporary, { recursive: true, force: true });
}
