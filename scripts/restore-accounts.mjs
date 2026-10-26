import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvironment } from '../server/config.mjs';
import { privateDataDir } from '../server/data-path.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = loadEnvironment({ root });
if (!process.argv[2]) throw new Error('用法：node scripts/restore-accounts.mjs 私有备份文件.sqlite（仅恢复到空数据目录）');
const source = fs.realpathSync(path.resolve(process.argv[2]));
const directory = privateDataDir(root, env.CAMPUS_DATA_DIR || '.campus-data');
const target = path.join(directory, 'campus.sqlite');
if ([target, target + '-wal', target + '-shm'].some(file => fs.existsSync(file))) throw new Error('目标已有数据库，未作任何修改。请停止服务，并选择新的空私有数据目录再恢复。');
const input = new DatabaseSync(source, { readOnly: true });
try {
  if (input.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('备份完整性检查未通过。');
  for (const [table, columns] of Object.entries({ users: ['id','username','display_name','password','created_at'], sessions: ['token_hash','user_id','csrf','expires_at'], circles: ['id','name','created_at'], members: ['circle_id','user_id','role','joined_at'], invites: ['id','circle_id','token_hash','expires_at','max_uses','uses','revoked','created_at'], submissions: ['circle_id','user_id','answers','matrix_version','consent','submitted_at','revision'] })) {
    const actual = input.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name);
    if (actual.length !== columns.length || columns.some(c => !actual.includes(c))) throw new Error('备份格式不兼容，未恢复。');
  }
  if (input.prepare('PRAGMA foreign_key_check').all().length) throw new Error('备份中的关联数据不完整，未恢复。');
  privateDataDir(root, directory, { create: true });
  input.prepare('VACUUM INTO ?').run(target);
} finally { input.close(); }
const restored = new DatabaseSync(target);
try { restored.exec('BEGIN; DELETE FROM sessions; UPDATE invites SET revoked=1; COMMIT;'); }
finally { restored.close(); }
try { fs.chmodSync(target, 0o600); } catch { /* Windows inherits directory ACL. */ }
console.log('已恢复账号、圈子和答卷。旧会话已清除，旧邀请码已撤销；原密码继续可用，请重新登录并生成新邀请。');
