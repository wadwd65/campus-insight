#!/usr/bin/env node
/**
 * 隐私与构建产物闸门 —— `node scripts/test-privacy-build.mjs`
 *
 * ★ 10-13 新增（对应审查任务书 P1#1-5 / P6#3）。
 *
 * 为什么必须有一个自动跑的隐私闸门：
 *   隐私声明是一句**承诺**，而承诺最容易在"后来有人往摘要里加了一样东西"时悄悄失效 ——
 *   而且失效之后没有任何症状：页面照常显示，只是多泄了一类数据。
 *   这类问题人眼永远发现不了（谁会去逐字比对声明和 buildFactsText？），
 *   只能靠断言守着。本文件就是那道断言。
 *
 * 三道闸门：
 *   一 · 白名单与实现一致 —— SUMMARY_FIELD_KEYS 登记的，buildSummaryFacts() 必须都给出来；
 *       反之亦然。两边漂移过一次，隐私声明就会开始说谎。
 *   二 · 白名单之外的数据**真的进不去摘要** —— 往报告里埋哨兵字段，断言摘要里找不到它。
 *       这是"只发允许的字段"这句话唯一的硬证明方式。
 *   三 · 构建产物里没有密钥 —— 扫 dist，找 API key 特征串与不应公开的调试标记。
 *       没构建过就跳过（不假装通过），但会打出一条明确的"未执行"。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { QUESTIONS, ALL_ATTR_KEYS, emptyAnswers } from '../src/lib/surveySchema.js';
import { toAttributes, buildBaseline, toPercents } from '../src/lib/matrix.js';
import { buildReport } from '../src/lib/results.js';
import { buildFactsText, buildSummaryFacts, SUMMARY_FIELD_KEYS } from '../src/lib/buildSummary.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0;
const failures = [];

function check(name, ok, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`  ✓ ${name}${detail ? '  ' + detail : ''}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? '  ' + detail : ''}`);
  }
}

// ── 造一份报告（每题取第一个选项，属性值稳定可复现） ──────────────────────
const answers = emptyAnswers();
for (const q of QUESTIONS) answers[q.field] = q.options[0].text;

// 基准：用同一条记录自比，只为把 baseline 结构凑齐（本测试不关心百分位数值）
const base = buildBaseline([toAttributes(answers)]);
const report = buildReport(answers, base);

console.log('\n一 · 白名单与实现一致（SUMMARY_FIELD_KEYS ↔ buildSummaryFacts）');
{
  const facts = buildSummaryFacts(report);
  const implKeys = Object.keys(facts);
  check(
    '白名单登记了 7 类数据',
    SUMMARY_FIELD_KEYS.length === 7,
    `实际 ${SUMMARY_FIELD_KEYS.length} 类`,
  );
  check(
    '白名单每一项都由 buildSummaryFacts 给出',
    SUMMARY_FIELD_KEYS.every((k) => k in facts),
    SUMMARY_FIELD_KEYS.filter((k) => !(k in facts)).join(',') || '全部命中',
  );
  check(
    'buildSummaryFacts 没有给出白名单之外的东西',
    implKeys.every((k) => SUMMARY_FIELD_KEYS.includes(k)),
    implKeys.filter((k) => !SUMMARY_FIELD_KEYS.includes(k)).join(',') || '无越界字段',
  );
  check(
    '每个字段都带了 meaning / source / allowedUse 三段元数据',
    ['choices', 'percents', 'timeSplit', 'moodCurve'].every((k) =>
      facts[k].every((x) => x.meaning && x.source && x.allowedUse),
    ) && facts.title.meaning && facts.title.allowedUse,
  );
}

console.log('\n二 · 白名单之外的数据进不了摘要（哨兵验证）');
{
  const SENTINEL = 'SENTINEL_SHOULD_NOT_LEAK';
  // 模拟"后来有人往报告里塞了新东西"：report 顶层、answers 里、以及一个假身份字段
  const dirty = {
    ...report,
    __secretField: SENTINEL,
    userEmail: `${SENTINEL}@example.com`,
    answers: { ...report.answers, __phone: `${SENTINEL}13800138000` },
  };
  const text = buildFactsText(dirty);
  check('报告顶层新增字段不进摘要', !text.includes(SENTINEL));
  check('answers 里的额外字段不进摘要', !text.includes('13800138000'));

  // 反向：白名单里的第 1 道题原话必须真的在摘要里（否则"白名单"是空话）
  check('白名单内的数据确实进了摘要', text.includes(QUESTIONS[0].text));
}

console.log('\n三 · 构建产物不含密钥（dist 扫描）');
{
  const dist = path.join(ROOT, 'dist');
  if (!fs.existsSync(dist)) {
    console.log('  ⚠ 未执行：dist/ 不存在（先跑 npm run build 再跑本测试）');
  } else {
    const files = [];
    const walk = (dir) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (/\.(js|css|html|map)$/.test(ent.name)) files.push(p);
      }
    };
    walk(dist);

    // 密钥特征：sk- 开头的一长串；以及示例文件里的占位串
    const KEY_PATTERNS = [
      /sk-[A-Za-z0-9_-]{20,}/g,
      /VITE_LLM_API_KEY\s*[:=]\s*['"][^'"]{8,}/g,
      /在这里填你的密钥/g,
    ];
    let hits = [];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      for (const re of KEY_PATTERNS) {
        const m = src.match(re);
        if (m) hits.push(`${path.relative(ROOT, f)}: ${m[0].slice(0, 40)}`);
      }
    }
    check(`dist 里没有密钥特征串（扫了 ${files.length} 个文件）`, hits.length === 0, hits.slice(0, 3).join(' | '));
  }
}

console.log('\n' + '─'.repeat(64));
if (failures.length) {
  console.log(`✗ ${failures.length} 项失败 / 共 ${pass + failures.length} 项`);
  for (const f of failures) console.log(`   · ${f}`);
  process.exit(1);
} else {
  console.log(`✓ 全部 ${pass} 项通过`);
}
