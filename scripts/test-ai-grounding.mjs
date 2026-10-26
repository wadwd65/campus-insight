#!/usr/bin/env node
/**
 * AI 落地闸门 —— `node scripts/test-ai-grounding.mjs`
 *
 * ★ 10-13 新增（对应审查任务书 P3#4 与 P6#2）。
 *
 * 「AI 不会编数字」这句话，靠提示词是**做不到保证**的 —— 提示词只是请求。
 * 所以这里测的是**机制**：模型万一不听话，我们的代码能不能发现、能不能兜住。
 *
 * ── 在线 / 离线的区分（任务书 P6#2 明确要求）────────────────────
 *   · 离线（本文件默认跑的）：给 validateSummary 喂**固定的假输出**，
 *     验证它能识别编造数字、诊断口吻、格式符号。**不联网、不需要密钥**。
 *   · 在线（本文件末尾，需 `--online` + 真实密钥才会跑）：
 *     真的调一次模型，看它会不会越界。默认**跳过并打印"未执行"** ——
 *     不假装跑过（任务书第 28 条：没有实际执行的测试必须明确标记为未执行）。
 */

import http from 'node:http';
import { validateSummary, describeIssues } from '../src/lib/validateSummary.js';
import { buildSummaryFacts } from '../src/lib/buildSummary.js';
import { buildReport } from '../src/lib/results.js';
import { buildBaseline, toAttributes } from '../src/lib/matrix.js';
import { QUESTIONS, emptyAnswers } from '../src/lib/surveySchema.js';
import { streamSummary } from '../src/lib/llm.js';

const ONLINE = process.argv.includes('--online');

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

// ── 固定测试输入（不依赖网络）──────────────────────────────────────────
const answers = emptyAnswers();
for (const q of QUESTIONS) answers[q.field] = q.options[0].text;
const baseline = buildBaseline([toAttributes(answers)]);
const report = buildReport(answers, baseline);
const facts = buildSummaryFacts(report);

// 合法的"好输出"：只使用白名单里的数字
const goodPct = facts.percents[0].value;
const GOOD = `你在深夜出没地选了「${answers[QUESTIONS[0].field]}」，期末安排选了「${answers[QUESTIONS[1].field]}」。这套选择的相对位置在模拟基准中为 ${goodPct}%。\n\n` +
  `这两个回答让休息与复习出现在同一份日常里。先回看最近一次真实安排，会比只看称号更具体。\n\n` +
  `不妨试着给下一次复习留出一个明确的开始时间，再看看这样的安排是否适合自己。`;

console.log('\n一 · 好输出必须通过（闸门不能误报）');
{
  const v = validateSummary(GOOD, { facts });
  check('只含白名单数字的正常输出 → 通过', v.ok, describeIssues(v));
}

console.log('\n二 · 编造数字必须抓出来');
{
  // 数据里根本没有 "77%"，这句是模型编的
  const bad = GOOD.replace(String(goodPct), '77');
  const v = validateSummary(bad, { facts });
  const hit = v.issues.some((i) => i.type === 'invented-number');
  check('出现白名单外的百分数 → 判定为编造', hit, describeIssues(v));
  check('同类问题不再重复报（只报一次即可）', v.issues.filter((i) => i.type === 'invented-number').length === 1);
}

console.log('\n三 · 越界表述必须抓出来');
{
  const d = validateSummary('测试结果说明你有明显的回避型人格倾向，建议尽早干预。', { facts });
  check('心理诊断口吻 → 被抓出', d.issues.some((i) => i.type === 'diagnosis'), describeIssues(d));

  const w = validateSummary('根据数据显示，你的雷达图在学术维度上很突出，算法给出的模型认为你适合读研。', { facts });
  check('提示词禁用的词 → 被抓出', w.issues.some((i) => i.type === 'forbidden-word'), describeIssues(w));
}

console.log('\n四 · 格式异常必须抓出来');
{
  check('未选择的选项不能写成用户回答', validateSummary(`你选了「${QUESTIONS[0].options[1].text}」。`, { facts }).issues.some((issue) => issue.type === 'invented-answer'));
  check('明确标注的小尝试不被误报为用户已做的选择', !validateSummary(`下次可以试试「${QUESTIONS[0].options[1].text}」。`, { facts }).issues.some((issue) => issue.type === 'invented-answer'));
  check('规则曲线不能写成真实大学经历', validateSummary('课程最难的大二你反而最稳，压力最大的大三你也没散。', { facts }).issues.some((issue) => issue.type === 'ungrounded-narrative'));
}
{
  const md = validateSummary('## 你的画像\n\n- 你很特别\n- 你也很矛盾\n\n**这是加粗**', { facts });
  const types = md.issues.map((i) => i.type);
  check('markdown 符号 → 被抓出', types.filter((t) => t === 'format').length >= 2, describeIssues(md));

  const emo = validateSummary('你这四年过得真不错 🌟 继续保持！', { facts });
  check('emoji → 被抓出', emo.issues.some((i) => i.type === 'format'));

  const short = validateSummary('很好。', { facts });
  check('过短（基本等于没写）→ 被抓出', short.issues.some((i) => i.type === 'too-short'));

  const empt = validateSummary('   ', { facts });
  check('空内容 → 被抓出', empt.issues.some((i) => i.type === 'empty'));
}

console.log('\n五 · 端到端：模型说错话时，会不会真的降级');
{
  // 起一个本地假服务端，让它返回一段"编造数字"的流式输出，
  // 验证 streamSummary 拿到之后**不会把它当成功返回**。
  const SENT = `你超过了 91% 的大学生。\n\n你的四年过得很稳。\n\n继续这样下去就好。`;
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    // 按 SSE 分块吐出去（顺便验证分块不会破坏校验）
    const chunks = SENT.match(/[\s\S]{1,7}/g) ?? [];
    for (const c of chunks) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;

  const res = await streamSummary({
    report,
    endpoint: { baseUrl: `http://127.0.0.1:${port}`, apiKey: 'test-key', model: 'test-model' },
  });
  server.close();

  // 91 不在白名单里（白名单来自这份报告的 facts），所以应当被判为 invalid-summary 并降级
  check('编造数字的输出 → 被判 invalid 并降级', res.degraded && res.reason === 'invalid-summary',
    `degraded=${res.degraded}, reason=${res.reason}`);
  check('降级后给的是完整的内置文案（不是半句错话）', res.text.length > 60 && !res.text.includes('91%'));
}

console.log('\n六 · 在线测试（需真实密钥）');
if (!ONLINE) {
  console.log('  ⚠ 未执行：真实调用需单独运行 npm run test:ai:live，默认检查不消耗在线额度');
  console.log('    （跳过 ≠ 通过 —— 本文件不声称在线链路已被验证）');
} else {
  await import('./check-live-ai.mjs');
  check('显式在线测试通过同源服务端生成', !process.exitCode);
}

console.log('\n' + '─'.repeat(64));
if (failures.length) {
  console.log(`✗ ${failures.length} 项失败 / 共 ${pass + failures.length} 项`);
  for (const f of failures) console.log(`   · ${f}`);
  process.exit(1);
} else {
  console.log(`✓ 全部 ${pass} 项通过（在线部分见上方"未执行"提示）`);
}
