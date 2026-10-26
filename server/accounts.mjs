import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { QUESTIONS, MATRIX_VERSION, isKnownOption } from '../src/lib/surveySchema.js';
import { privateDataDir } from './data-path.mjs';

const scrypt = promisify(scryptCallback);
const hash = value => createHash('sha256').update(value).digest('hex');
const secret = () => randomBytes(32).toString('base64url');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const safeEqual = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const iso = value => value ? new Date(value).toISOString() : null;
const publicUser = row => ({ id: row.id, username: row.username, displayName: row.display_name });
const usernameOf = value => typeof value === 'string' && /^[a-zA-Z0-9_.@-]{3,40}$/.test(value.trim()) ? value.trim().toLowerCase() : fail(400, '账号需为 3–40 位字母、数字或 _.@-');
const nameOf = value => typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 40 && !/[\x00-\x1f\x7f]/.test(value) ? value.trim() : fail(400, '显示名称需为 1–40 个字');
const passwordOf = value => typeof value === 'string' && value.length >= 6 && value.length <= 12 ? value : fail(400, '密码需为 6–12 位');
// Existing accounts may still use the previous 12–128 character passwords.
const loginPasswordOf = value => typeof value === 'string' && value.length >= 1 && value.length <= 128 ? value : fail(400, '请输入密码');

/** A single-server store; keep its directory on a persistent private disk when deployed. */
export function createAccountHandler({ root = process.cwd(), dataDir = process.env.CAMPUS_DATA_DIR || path.join(root, '.campus-data'), setupToken = process.env.CAMPUS_SETUP_TOKEN, origin = process.env.APP_ORIGIN || '' } = {}) {
  dataDir = privateDataDir(root, dataDir);
  if (origin) {
    const url = new URL(origin);
    if (url.origin !== origin || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('APP_ORIGIN must be an HTTPS origin (HTTP loopback is allowed).');
  }
  dataDir = privateDataDir(root, dataDir, { create: true });
  const databasePath = path.join(dataDir, 'campus.sqlite');
  const db = new DatabaseSync(databasePath);
  try { fs.chmodSync(databasePath, 0o600); } catch { /* Windows uses the current user's inherited ACL. */ }
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, password TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS circles(id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS members(circle_id TEXT REFERENCES circles(id) ON DELETE CASCADE, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, role TEXT CHECK(role IN ('admin','member')), joined_at INTEGER NOT NULL, PRIMARY KEY(circle_id,user_id));
    CREATE TABLE IF NOT EXISTS invites(id TEXT PRIMARY KEY, circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE, token_hash TEXT UNIQUE NOT NULL, expires_at INTEGER NOT NULL, max_uses INTEGER NOT NULL, uses INTEGER NOT NULL DEFAULT 0, revoked INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS submissions(circle_id TEXT, user_id TEXT, answers TEXT NOT NULL, matrix_version INTEGER NOT NULL, consent TEXT NOT NULL, submitted_at INTEGER NOT NULL, revision INTEGER NOT NULL, PRIMARY KEY(circle_id,user_id), FOREIGN KEY(circle_id,user_id) REFERENCES members(circle_id,user_id) ON DELETE CASCADE);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS members_user ON members(user_id);`);
  // Registration grants administration of one's own circles, never of the whole site.
  // Retain the explicitly configured legacy setup endpoint for old deployment tooling.
  const setupPath = path.join(dataDir, 'setup-key.txt');
  if (setupToken && setupToken.length < 24) { db.close(); throw new Error('CAMPUS_SETUP_TOKEN must have at least 24 characters.'); }
  const setupHash = setupToken ? hash(setupToken) : '';
  setupToken = undefined;
  let hashesRunning = 0;
  const rates = new Map();
  function rate(key, limit, duration) {
    const now = Date.now();
    if (rates.size > 5000) for (const [k, r] of rates) if (r.until <= now) rates.delete(k);
    if (rates.size > 10000 && !rates.has(key)) fail(429, '请求繁忙，请稍后再试');
    const r = rates.get(key);
    if (!r || r.until <= now) rates.set(key, { n: 1, until: now + duration });
    else if (++r.n > limit) fail(429, '尝试过于频繁，请稍后再试');
  }
  async function derive(password, salt) {
    if (hashesRunning >= 2) fail(429, '登录服务繁忙，请稍后再试');
    hashesRunning++;
    try { return await scrypt(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }); }
    finally { hashesRunning--; }
  }
  async function passwordHash(password) {
    const salt = randomBytes(16).toString('hex');
    return `scrypt-v1:${salt}:${(await derive(passwordOf(password), salt)).toString('hex')}`;
  }
  async function verify(password, stored) {
    const [, salt, expected] = (stored || '').split(':');
    const result = await derive(password, salt || '00000000000000000000000000000000');
    return Boolean(expected && safeEqual(result.toString('hex'), expected));
  }
  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function membership(circleId, userId, admin = false) {
    const row = db.prepare('SELECT m.*, c.name FROM members m JOIN circles c ON c.id=m.circle_id WHERE circle_id=? AND user_id=?').get(circleId, userId);
    if (!row || (admin && row.role !== 'admin')) fail(403, '你没有这个圈子的访问权限');
    return row;
  }
  function inviteOf(token) {
    if (typeof token !== 'string' || token.length < 24 || token.length > 100) fail(400, '邀请码无效、已用完或已过期');
    const invite = db.prepare('SELECT i.*, c.name FROM invites i JOIN circles c ON c.id=i.circle_id WHERE token_hash=?').get(hash(token.trim()));
    if (!invite || invite.revoked || invite.expires_at <= Date.now() || invite.uses >= invite.max_uses) fail(400, '邀请码无效、已用完或已过期');
    if (db.prepare('SELECT COUNT(*) AS n FROM members WHERE circle_id=?').get(invite.circle_id).n >= 200) fail(409, '圈子人数已达 200 人上限');
    return invite;
  }
  function join(token, userId) {
    const invite = inviteOf(token);
    if (db.prepare('SELECT 1 FROM members WHERE circle_id=? AND user_id=?').get(invite.circle_id, userId)) fail(409, '你已在这个圈子中');
    if (db.prepare('SELECT COUNT(*) AS n FROM members WHERE user_id=?').get(userId).n >= 20) fail(409, '每个账号最多加入 20 个圈子');
    db.prepare("INSERT INTO members VALUES(?,?,'member',?)").run(invite.circle_id, userId, Date.now());
    db.prepare('UPDATE invites SET uses=uses+1 WHERE id=?').run(invite.id);
    return invite.circle_id;
  }
  function submission(circleId, userId) {
    const row = db.prepare('SELECT * FROM submissions WHERE circle_id=? AND user_id=?').get(circleId, userId);
    return row ? { answers: JSON.parse(row.answers), matrixVersion: row.matrix_version, submittedAt: iso(row.submitted_at), revision: row.revision } : null;
  }
  const secure = origin.startsWith('https:');
  const cookieName = secure ? '__Host-campus_sid' : 'campus_sid';
  const cookie = (token, age) => `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`;
  function sessionFor(req) {
    const value = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (!value || !/^[\w-]{43}$/.test(value)) return null;
    return db.prepare('SELECT s.*, u.id, u.username, u.display_name FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires_at>?').get(hash(value), Date.now());
  }
  function newSession(user, req, res) {
    const previous = sessionFor(req);
    if (previous) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(previous.token_hash);
    db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
    // A bounded number of devices per account, with oldest sessions removed first.
    db.prepare('DELETE FROM sessions WHERE token_hash IN (SELECT token_hash FROM sessions WHERE user_id=? ORDER BY expires_at DESC LIMIT -1 OFFSET 9)').run(user.id);
    const token = secret(), csrf = secret();
    db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hash(token), user.id, csrf, Date.now() + 7 * 86400000);
    res.setHeader('Set-Cookie', cookie(token, 7 * 86400));
    return { user: publicUser(user), csrf, setupRequired: false };
  }
  async function body(req) {
    if (!(req.headers['content-type'] || '').startsWith('application/json')) fail(415, '请使用 JSON 提交');
    if (Number(req.headers['content-length']) > 16384) fail(413, '提交内容过大');
    const chunks = []; let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 16384) fail(413, '提交内容过大');
      chunks.push(chunk);
    }
    try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!value || Array.isArray(value) || typeof value !== 'object') throw 0; return value; }
    catch { fail(400, '提交格式不正确'); }
  }
  async function route(req, res) {
    const pathname = new URL(req.url, 'http://local').pathname;
    const method = req.method;
    let expectedOrigin = origin;
    if (!expectedOrigin) {
      const local = new URL(`http://${req.headers.host}`);
      if (!['localhost', '127.0.0.1', '[::1]'].includes(local.hostname)) fail(503, '上线前请配置 APP_ORIGIN 为网站的 HTTPS 地址');
      expectedOrigin = local.origin;
    }
    if (req.headers.origin && req.headers.origin !== expectedOrigin) fail(403, '请求来源不匹配，请从本站操作');
    if (req.headers['sec-fetch-site'] === 'cross-site') fail(403, '请从本站操作');
    if (!['GET', 'POST', 'DELETE'].includes(method)) fail(405, '不支持此操作');
    if (method !== 'GET' && req.headers.origin !== expectedOrigin) fail(403, '请从本站操作');
    rate(`all:${req.socket.remoteAddress}`, 240, 60000);
    const session = sessionFor(req);
    if (pathname === '/api/campus/session' && method === 'GET') return { user: session ? publicUser(session) : null, csrf: session?.csrf || null, setupRequired: false };
    if (['/api/campus/setup', '/api/campus/login', '/api/campus/register'].includes(pathname) && method === 'POST') {
      // Shared school networks and reverse proxies may put many legitimate members on one IP.
      rate(`auth:${req.socket.remoteAddress}`, 300, 15 * 60000);
      if (pathname.endsWith('/setup')) rate(`setup:${req.socket.remoteAddress}`, 6, 15 * 60000);
      const b = await body(req);
      const username = usernameOf(b.username), password = pathname.endsWith('/login') ? loginPasswordOf(b.password) : passwordOf(b.password);
      rate(`name:${hash(username)}`, 8, 15 * 60000);
      if (pathname.endsWith('/login')) {
        const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
        if (!(await verify(password, user?.password))) fail(401, '账号或密码不正确');
        return newSession(user, req, res);
      }
      const rawName = b.displayName ?? '';
      const displayName = nameOf(typeof rawName === 'string' ? rawName.trim() || username : rawName);
      const registrationMode = b.registrationMode ?? (b.invite ? 'join' : 'create');
      if (!['create', 'join'].includes(registrationMode)) fail(400, '请选择创建自己的圈子，或通过邀请加入已有圈子');
      if (pathname.endsWith('/register') && registrationMode === 'create') rate(`create-account:${req.socket.remoteAddress}`, 20, 3600000);
      if (pathname.endsWith('/setup')) {
        if (db.prepare('SELECT 1 FROM users LIMIT 1').get()) fail(409, '网站已初始化，请登录或使用邀请码注册');
        if (!setupHash) fail(410, '请直接选择注册并创建圈子，无需初始化口令');
        if (typeof b.setupToken !== 'string' || !safeEqual(hash(b.setupToken), setupHash)) fail(403, '旧版开通凭证不正确，请直接注册自己的账号');
      } else if (registrationMode === 'join') inviteOf(b.invite);
      const circleName = registrationMode === 'create' && !pathname.endsWith('/setup')
        ? nameOf(typeof b.circleName === 'string' && b.circleName.trim() ? b.circleName : `${Array.from(displayName).slice(0, 18).join('')}的圈子`) : null;
      const encoded = await passwordHash(password);
      const user = { id: randomUUID(), username, display_name: displayName };
      const circleId = transaction(() => {
        if (pathname.endsWith('/setup') && db.prepare('SELECT 1 FROM users LIMIT 1').get()) fail(409, '网站已初始化');
        if (db.prepare('SELECT 1 FROM users WHERE username=?').get(username)) fail(409, '该账号已被使用，请更换账号或登录');
        db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(user.id, username, displayName, encoded, Date.now());
        if (pathname.endsWith('/setup')) return null;
        if (registrationMode === 'join') return join(b.invite, user.id);
        const id = randomUUID(), now = Date.now();
        db.prepare('INSERT INTO circles VALUES(?,?,?)').run(id, circleName, now);
        db.prepare("INSERT INTO members VALUES(?,?,'admin',?)").run(id, user.id, now);
        return id;
      });
      if (pathname.endsWith('/setup')) { try { fs.unlinkSync(setupPath); } catch { /* An environment token has no file. */ } }
      return { ...newSession(user, req, res), circleId };
    }
    if (!session) fail(401, '请先登录');
    if (method !== 'GET' && !safeEqual(req.headers['x-csrf-token'], session.csrf)) fail(403, '登录校验已更新，请刷新后重试');
    if (pathname === '/api/campus/logout' && method === 'POST') {
      db.prepare('DELETE FROM sessions WHERE token_hash=?').run(session.token_hash);
      res.setHeader('Set-Cookie', cookie('', 0)); return { ok: true };
    }
    if (pathname === '/api/campus/password' && method === 'POST') {
      rate(`password:${session.id}`, 5, 15 * 60000);
      const b = await body(req);
      const user = db.prepare('SELECT * FROM users WHERE id=?').get(session.id);
      if (!(await verify(loginPasswordOf(b.currentPassword), user.password))) fail(401, '当前密码不正确');
      const encoded = await passwordHash(b.password);
      transaction(() => { db.prepare('UPDATE users SET password=? WHERE id=?').run(encoded, session.id); db.prepare('DELETE FROM sessions WHERE user_id=?').run(session.id); });
      return newSession(user, req, res);
    }
    if (pathname === '/api/campus/circles') {
      if (method === 'GET') return { circles: db.prepare('SELECT c.id,c.name,m.role FROM circles c JOIN members m ON m.circle_id=c.id WHERE m.user_id=? ORDER BY c.created_at DESC').all(session.id) };
      if (method === 'POST') {
        if (db.prepare("SELECT COUNT(*) AS n FROM members WHERE user_id=? AND role='admin'").get(session.id).n >= 10) fail(409, '每个账号最多创建 10 个圈子');
        const b = await body(req), id = randomUUID(), name = nameOf(b.name);
        transaction(() => {
          if (db.prepare('SELECT COUNT(*) AS n FROM members WHERE user_id=?').get(session.id).n >= 20 || db.prepare("SELECT COUNT(*) AS n FROM members WHERE user_id=? AND role='admin'").get(session.id).n >= 10) fail(409, '圈子数量已达上限');
          db.prepare('INSERT INTO circles VALUES(?,?,?)').run(id, name, Date.now()); db.prepare("INSERT INTO members VALUES(?,?,'admin',?)").run(id, session.id, Date.now());
        });
        return { id, name, role: 'admin' };
      }
    }
    if (pathname === '/api/campus/join' && method === 'POST') { const b = await body(req); return { circleId: transaction(() => join(b.invite, session.id)) }; }
    const match = pathname.match(/^\/api\/campus\/circles\/([\w-]+)(?:\/(invites|submissions|members)(?:\/([\w-]+))?)?$/);
    if (!match) fail(404, '接口不存在');
    const [, circleId, resource, target] = match;
    const member = membership(circleId, session.id);
    if (!resource && method === 'GET') return { id: circleId, name: member.name, role: member.role, submission: submission(circleId, session.id) };
    if (resource === 'submissions' && !target && method === 'POST') {
      const b = await body(req);
      if (b.expectedUserId !== session.id) fail(409, '登录账号已变化，请回圈子重新填报');
      if (b.consent !== 'circle-raw-v1') fail(400, '请先确认将原始答案和提交时间交给圈内管理员');
      if (b.matrixVersion !== MATRIX_VERSION || !b.answers || typeof b.answers !== 'object' || Array.isArray(b.answers) || Object.keys(b.answers).length !== QUESTIONS.length || QUESTIONS.some(q => !isKnownOption(q.field, b.answers[q.field]))) fail(400, '需要当前版本的完整 10 题有效答案');
      const answers = Object.fromEntries(QUESTIONS.map(q => [q.field, b.answers[q.field]]));
      db.prepare('INSERT INTO submissions VALUES(?,?,?,?,?,?,1) ON CONFLICT(circle_id,user_id) DO UPDATE SET answers=excluded.answers,matrix_version=excluded.matrix_version,consent=excluded.consent,submitted_at=excluded.submitted_at,revision=submissions.revision+1').run(circleId, session.id, JSON.stringify(answers), MATRIX_VERSION, b.consent, Date.now());
      return { submission: submission(circleId, session.id) };
    }
    if (resource === 'submissions' && !target && method === 'DELETE') {
      db.prepare('DELETE FROM submissions WHERE circle_id=? AND user_id=?').run(circleId, session.id); return { ok: true };
    }
    membership(circleId, session.id, true);
    if (resource === 'members' && !target && method === 'GET') return { members: db.prepare('SELECT u.id,u.display_name AS displayName,m.role,m.joined_at,s.submitted_at,s.revision,s.answers,s.matrix_version FROM members m JOIN users u ON u.id=m.user_id LEFT JOIN submissions s ON s.circle_id=m.circle_id AND s.user_id=m.user_id WHERE m.circle_id=? ORDER BY m.joined_at,u.id').all(circleId).map(row => ({ id: row.id, displayName: row.displayName, role: row.role, joinedAt: iso(row.joined_at), submission: row.answers ? { answers: JSON.parse(row.answers), submittedAt: iso(row.submitted_at), revision: row.revision, matrixVersion: row.matrix_version } : null })) };
    if (resource === 'members' && target && method === 'DELETE') {
      if (target === session.id) fail(400, '不能移除自己');
      db.prepare("DELETE FROM members WHERE circle_id=? AND user_id=? AND role='member'").run(circleId, target); return { ok: true };
    }
    if (resource === 'invites' && !target && method === 'GET') return { invites: db.prepare('SELECT id,expires_at,max_uses,uses,revoked,created_at FROM invites WHERE circle_id=? ORDER BY created_at DESC LIMIT 100').all(circleId).map(i => ({ id: i.id, expiresAt: iso(i.expires_at), maxUses: i.max_uses, uses: i.uses, revoked: Boolean(i.revoked), createdAt: iso(i.created_at) })) };
    if (resource === 'invites' && !target && method === 'POST') {
      rate(`invite:${session.id}`, 30, 3600000);
      const b = await body(req), hours = b.hours ?? 72, maxUses = b.maxUses ?? 1;
      if (!Number.isInteger(hours) || hours < 1 || hours > 168 || !Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100) fail(400, '邀请码有效期 1–168 小时，可用人数 1–100');
      const token = secret(), id = randomUUID(), expiresAt = Date.now() + hours * 3600000;
      db.prepare('INSERT INTO invites VALUES(?,?,?,?,?,0,0,?)').run(id, circleId, hash(token), expiresAt, maxUses, Date.now());
      return { id, token, expiresAt: iso(expiresAt), maxUses };
    }
    if (resource === 'invites' && target && method === 'DELETE') { db.prepare('UPDATE invites SET revoked=1 WHERE id=? AND circle_id=?').run(target, circleId); return { ok: true }; }
    fail(404, '接口不存在');
  }
  const handler = (req, res, next) => {
    if (!req.url?.split('?')[0].startsWith('/api/campus/')) return next();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    route(req, res).then(value => { if (!res.destroyed) { res.statusCode = 200; res.end(JSON.stringify(value)); } }).catch(error => {
      if (!res.destroyed) { res.statusCode = error.status || 500; res.end(JSON.stringify({ error: error.status ? error.message : '服务器暂时无法处理，请稍后重试' })); }
    });
  };
  handler.close = () => db.close();
  return handler;
}
