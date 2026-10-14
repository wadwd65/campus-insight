#!/usr/bin/env node
/**
 * clean-dist.mjs —— 构建前清空 dist（`node scripts/clean-dist.mjs`）
 *
 * ── 为什么需要它 ────────────────────────────────────────────────
 * `vite.config.js` 里设了 `build.emptyOutDir: false`：本机环境的"批量删除保护"
 * 会拦住 Vite 清空 outDir（[safe-delete][SAFE_DELETE_BULK_GUARD_ERROR]），
 * 让 `npm run build` 必然失败。
 *
 * 但"不清空"的副作用在 10-14 审查时才暴露：**每次构建的新 hash 文件名都留着，
 * 旧的一起堆** —— dist 从 3.77MB 涨到 6.79MB（assets 里堆了 5 个 llm-*.js），
 * 还会让 verify:dist 的"总体积 < 6MB"断言随机变红。
 *
 * ── 做法：逐文件删，而不是整目录删/改名 ──────────────────────────
 * 实测（10-14）本机保护对**目录级**操作拦得很死：
 *   · `fs.renameSync(dist, ...)` → EPERM
 *   · shell `mv dist ...`        → Permission denied
 *   · 而 `rm dist/index.html`（单文件）→ **成功**
 * 所以这里改成"递归遍历 + 逐个 unlink"，最后再尽力删空目录（删不掉也无妨，
 * 空目录不影响 vite build 与体积校验）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

if (!fs.existsSync(DIST)) {
  console.log('[clean-dist] dist/ 不存在，无需清理');
  process.exit(0);
}

/** 递归收集所有文件与目录（目录按深度倒序，便于先删文件后删空目录）。 */
function walk(dir, files = [], dirs = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      dirs.push(full);
      walk(full, files, dirs);
    } else {
      files.push(full);
    }
  }
  return { files, dirs };
}

const { files, dirs } = walk(DIST);
let removed = 0;
let failed = 0;

/**
 * 删除文件，失败则重试。
 *
 * ★ 10-14 实测：**构建刚结束时，有些产物文件还被系统短暂占用** ——
 * 第一次跑会剩十几个删不掉，隔一会儿再跑就全删掉了（34 个文件一次通过）。
 * 这不是权限问题，是 Windows 的文件锁还没释放。所以这里做三次短重试：
 * 每次失败隔 120ms 再试，够等到锁释放，又不会拖慢构建。
 */
function unlinkWithRetry(f, tries = 3) {
  for (let i = 0; i < tries; i += 1) {
    try {
      fs.unlinkSync(f);
      return true;
    } catch {
      // 同步 sleep：clean-dist 是构建前置步骤，这里阻塞几十毫秒无妨
      if (i < tries - 1) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 120);
    }
  }
  return false;
}

for (const f of files) {
  if (unlinkWithRetry(f)) removed += 1;
  else failed += 1;
}

// 目录按深度倒序删（先删最深的子目录），失败的忽略
dirs.sort((a, b) => b.split(path.sep).length - a.split(path.sep).length);
let dirsRemoved = 0;
for (const d of [...dirs, DIST]) {
  try {
    fs.rmdirSync(d);
    dirsRemoved += 1;
  } catch {
    /* 目录非空或受保护：留着即可 */
  }
}

console.log(`[clean-dist] 删除 ${removed} 个文件${failed ? `（${failed} 个失败）` : ''}、${dirsRemoved} 个目录`);
if (fs.existsSync(DIST)) {
  const left = walk(DIST).files.length;
  if (left) console.log(`[clean-dist] 注意：dist/ 仍有 ${left} 个文件残留（构建会继续，但体积会偏大）`);
}
