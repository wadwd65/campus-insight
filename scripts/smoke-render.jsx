/**
 * 渲染冒烟测试 —— `npm run smoke`
 *
 * 解决一个很具体的问题：**「构建成功」不等于「页面打不开」。**
 * JSX 写错一个属性名、模板里取了一个不存在的字段、import 路径少一层，
 * 这些都不会让 `vite build` 失败 —— 它只会让浏览器里出现一块白屏。
 * 而白屏是评委能看到的最糟的一种失败：没有任何提示，也没有任何线索。
 *
 * 做法：把四个页面在 Node 里**服务端渲染一遍**（renderToString），
 * 然后断言页面上真的出现了该有的字。渲染时 React 不执行 useEffect，
 * 所以 ECharts 不会被真的初始化 —— 这恰好是我们想要的：
 * 这一步只验「能不能画出结构」，图表本身由 selftest 验数据、由浏览器验观感。
 *
 * 关键的一条兜底断言：整页 HTML 里不许出现 `undefined` / `NaN` / `[object Object]`。
 * 一个字段名写错，页面通常不会报错，只会把这三个字符串之一印在用户面前。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToString } from 'react-dom/server';
import { createElement as h } from 'react';

import SurveyForm from '../src/components/SurveyForm.jsx';
import ReportView from '../src/components/ReportView.jsx';
import CohortPage from '../src/components/CohortPage.jsx';
import UploadPanel from '../src/components/UploadPanel.jsx';
import HubHud from '../src/components/HubHud.jsx';
import MapScene from '../src/scenes/MapScene.jsx';
import { useGameStore } from '../src/store/useGameStore.js';
import { parseCsvText } from '../src/lib/parseCsv.js';
import { cleanSurveyRows } from '../src/lib/surveyClean.js';
import { toAttributeMatrix, buildBaseline } from '../src/lib/matrix.js';
import { QUESTIONS, REQUIRED_COLUMNS } from '../src/lib/surveySchema.js';
import { PLACES, SLOTS_PER_DAY } from '../src/data/mapPlaces.js';
import { nextDelta } from '../src/lib/mapEngine.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, 'public', 'data', f), 'utf8');

let pass = 0;
const failures = [];

function check(name, cond, detail = '') {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${name}${detail ? `  ${detail}` : ''}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? `  ${detail}` : ''}`);
  }
}

/**
 * 把 React 输出的 HTML 归一成"人能读的文字"再做断言。
 *
 * React 在两个相邻的文本节点之间会插入 `<!-- -->` 作分隔符，
 * 于是 `{n} 个人` 渲染出来是 `48<!-- --> 个人` —— 直接搜「48 个人」必然搜不到。
 * 这不是 bug，是 React 的 hydration 标记；断言必须先把它们去掉，
 * 否则测试会一直红，而人会开始怀疑被测代码 —— 事实是断言写错了。
 */
const plain = (html) => html.replace(/<!--.*?-->/g, '');

/** 渲染一个组件，返回 HTML；渲染本身抛错也算失败（而不是让整个脚本崩掉）。 */
function render(label, element) {
  try {
    return renderToString(element);
  } catch (e) {
    failures.push(`${label} 渲染抛错`);
    console.log(`  ✗ ${label} 渲染抛错：${e.message}`);
    return '';
  }
}

// ── 准备真实数据（与浏览器里走的完全同一条路径） ──
const baseParsed = parseCsvText(read('问卷基准数据.csv'), REQUIRED_COLUMNS);
const baseCleaned = cleanSurveyRows(baseParsed.rows);
const baseline = buildBaseline(toAttributeMatrix(baseCleaned.records));

const cohortParsed = parseCsvText(read('示例-班级问卷.csv'), REQUIRED_COLUMNS);
const cohortCleaned = cleanSurveyRows(cohortParsed.rows);

const myAnswers = {};
for (const q of QUESTIONS) myAnswers[q.field] = q.options[1].text;

console.log(`\n使用 ${baseCleaned.records.length} 人基准 / ${cohortCleaned.records.length} 人班级\n`);

// ── 1 · 答题页 ──
console.log('1 · 答题页');
const quizHtml = render('答题页', h(SurveyForm, { onComplete: () => {}, onCancel: () => {} }));
const quizText = plain(quizHtml);
check('渲染出第一题的题干', quizText.includes(QUESTIONS[0].text));
check('渲染出第一题的全部选项', QUESTIONS[0].options.every((o) => quizText.includes(o.text)));
check(
  `显示题号进度 1 / ${QUESTIONS.length}`,
  quizText.includes(`1 / ${QUESTIONS.length}`),
  `（第 1 题 / 共 ${QUESTIONS.length} 题）`,
);

// ── 2 · 结果页（快入口） ──
console.log('\n2 · 结果页（快入口）');
const reportHtml = render('结果页', h(ReportView, { answers: myAnswers, baseline, name: '陈', onRestart: () => {} }));
const reportText = plain(reportHtml);
check('渲染出称号', reportText.includes('你的称号'));
check(
  '结果页五个 section 标题都在',
  ['大学生活者画像', '时间去哪了', '四年心情曲线', '人群冷知识', '给你的话'].every((t) => reportText.includes(t)),
);
check('大模型那块有加载态文案', reportText.includes('正在读你的答案'));
check('「复制文字版」按钮在', reportText.includes('复制文字版'));
check('结尾句出现了（本地确定性生成，不依赖大模型）', reportText.includes('如果只用一个词概括你的大学，是「'));

// ── 3 · 群体画像页（真入口） ──
console.log('\n3 · 群体画像页（真入口）');
const cohortHtml = render(
  '群体画像页',
  h(CohortPage, {
    records: cohortCleaned.records,
    baseline,
    ownAnswers: myAnswers,
    onGoQuiz: () => {},
    onRestart: () => {},
  }),
);
const cohortText = plain(cohortHtml);
check('写出总人数', cohortText.includes(`${cohortCleaned.records.length} 个人的大学`));
check('五个类型名都出现了', ['学术型', '社交型', '运动型', '生活型', '佛系型'].every((t) => cohortText.includes(t)));
check('标题与三块内容都在', ['这个班的位置', '这个班分成几类', '班里和你最像的人'].every((t) => cohortText.includes(t)));
check('给出了「最像的人」', /非常像|挺像|有点像/.test(cohortText));
check('写明了示例数据是模拟的', cohortText.includes('模拟生成'));

// 「你自己的类型是『?』」那一句必须印中文组名。
// groupOf() 返回的是键（academic/buddhist…），漏了 key→name 的映射就会把英文键印到页面上 ——
// 而且这件事**不会**触发上面任何一条断言：页面结构完好，只是有一个词是英文的。
const mineGroupMatch = /你自己的类型是「([^」]*)」/.exec(cohortText);
check(
  '「你自己的类型」印的是中文组名而不是英文键',
  mineGroupMatch != null && /^[\u4e00-\u9fa5]+型$/.test(mineGroupMatch[1]),
  mineGroupMatch ? `实际印出：「${mineGroupMatch[1]}」` : '页面上没找到这句话',
);

// 没答过快入口时，不该凭空造一个「你」
const noMeHtml = plain(
  render(
    '群体画像页（无自己的作答）',
    h(CohortPage, { records: cohortCleaned.records, baseline, ownAnswers: null, onGoQuiz: () => {}, onRestart: () => {} }),
  ),
);
check('没有自己的作答时，给出「先答 10 题」的引导而不是假数据', noMeHtml.includes('先有一份「你的」作答'));

// ── 4 · 上传页 ──
console.log('\n4 · 上传页');
const uploadHtml = render('上传页', h(UploadPanel, { onReady: () => {} }));
const uploadText = plain(uploadHtml);
check('列出了必需列名', REQUIRED_COLUMNS.every((c) => uploadText.includes(c)));
check('说明了文件不会上传', uploadText.includes('不会上传到任何服务器'));
check('提供了示例入口', uploadText.includes('示例班级问卷'));

// ── 4.5 · 主站 HUD ──
// 这里只验**空态**。有数据时的显示规则（正负、分母、最强最弱）不在这一步验，
// 原因是 zustand 在 SSR 下会刻意返回**初始状态**（避免 hydration 前后不一致），
// 服务端渲染根本读不到预置数据 —— 硬要在这里断言"有数据的 HUD"，
// 得到的是一个永远失败的假失败。那些规则改由 scripts/selftest-store.mjs 直接断言纯函数。
console.log('\n4.5 · 主站 HUD（空态）');
{
  useGameStore.getState().resetPlayer(); // 清空账本，确保渲染的确是空态
  const hudHtml = render('主站 HUD（空态）', h(HubHud, { onRestart: () => {} }));
  const hudText = plain(hudHtml);
  check('空态下显示「待采集」', hudText.includes('待采集'));
  check('空态下给出「怎么开始长数据」的提示', hudText.includes('这里开始长数据'));
  check('空态下没有「已采集」字样', !hudText.includes('已采集'));

  const bad = ['undefined', 'NaN', '[object Object]'].filter((s) => hudHtml.includes(s));
  check('HUD：HTML 里没有 undefined / NaN / [object Object]', bad.length === 0, bad.join(' '));
}

// ── 4.7 · 行动地图（空态） ──
// 与 HUD 同一个理由：地图的**规则**（衰减、时段、可用性）由 selftest-map.mjs 断言，
// 这里只验"结构能不能画出来" —— 地点名、氛围句、时段数是渲染层的事。
console.log('\n4.7 · 行动地图（空态）');
{
  useGameStore.getState().resetPlayer();
  const mapHtml = render('行动地图（空态）', h(MapScene, { onGoReport: () => {}, onGoQuiz: () => {} }));
  const mapText = plain(mapHtml);

  check('渲染出标题问句', mapText.includes('今天的四个时段'));
  check(
    `16 个地点名都在`,
    PLACES.every((p) => mapText.includes(p.name)),
    `共 ${PLACES.length} 个地点`,
  );
  check('渲染出地点氛围句', mapText.includes(PLACES[0].line));
  check('显示时段计数', mapText.includes(`${SLOTS_PER_DAY} / ${SLOTS_PER_DAY}`), `空态应为 ${SLOTS_PER_DAY}/${SLOTS_PER_DAY}`);
  check('四个区域名都在', ['北区 · 教学', '东区 · 运动', '南区 · 生活', '西区 · 自由'].every((z) => mapText.includes(z)));
  check('空态下主按钮不可用但仍渲染出来', mapText.includes('用这段经历生成档案'));
  check('空态下给出「先答题」的备选路径', mapText.includes(`先答 ${QUESTIONS.length} 题`));
  check('写明了衰减规则', mapText.includes('最多计 3 次增量'));

  const mapBad = ['undefined', 'NaN', '[object Object]'].filter((s) => mapHtml.includes(s));
  check('地图：HTML 里没有 undefined / NaN / [object Object]', mapBad.length === 0, mapBad.join(' '));
}

// ── 4.8 · 从地图生成报告（不答题也能出档案） ──
// 这是地图存在的意义。上线时这里曾经**真是坏的**：点「用这段经历生成档案」
// 会掉回欢迎页，因为 ReportView 只认问卷的 answers，而地图玩家没答过题。
// 下面这两条断言就是钉死那个缺陷不再回来。
console.log('\n4.8 · 从地图生成报告（走账本，不走问卷）');
{
  const lib = PLACES.find((p) => p.id === 'library');
  const attrs = { ...nextDelta(lib, {}).vec };

  const mapReportHtml = render(
    '地图报告页',
    h(ReportView, {
      answers: null,
      attributes: attrs,
      trail: [{ id: 'library', label: '图书馆', at: 1 }],
      baseline,
      name: '地图玩家',
      onRestart: () => {},
    }),
  );
  const mapReportText = plain(mapReportHtml);

  check('地图路径也能渲染出称号与五个 section', mapReportText.includes('你的称号'));
  check(
    '地图路径的五块内容都在',
    ['大学生活者画像', '时间去哪了', '四年心情曲线', '人群冷知识', '给你的话'].every((t) =>
      mapReportText.includes(t),
    ),
  );
  check('地图路径多出「你走过的路」这一块', mapReportText.includes('你走过的路'));
  check('轨迹里出现了去过的地点名', mapReportText.includes('图书馆'));

  // 反过来：问卷路径不该出现"你走过的路"（它没有轨迹这个概念）
  const quizReportText = plain(
    render('问卷报告页（不应有轨迹块）', h(ReportView, { answers: myAnswers, baseline, onRestart: () => {} })),
  );
  check('问卷路径不出现「你走过的路」', !quizReportText.includes('你走过的路'));

  const mapBad = ['undefined', 'NaN', '[object Object]'].filter((s) => mapReportHtml.includes(s));
  check('地图报告：HTML 里没有 undefined / NaN / [object Object]', mapBad.length === 0, mapBad.join(' '));
}

// ── 5 · 全局兜底：页面上不许出现这三种"坏味道" ──
// 这一项扫的是**未归一化**的原始 HTML：字段名写错时，坏字符串也可能落在属性里，
// 只扫可见文字会漏掉一半
console.log('\n5 · 全局兜底');
for (const [label, html] of [
  ['答题页', quizHtml],
  ['结果页', reportHtml],
  ['群体画像页', cohortHtml],
  ['上传页', uploadHtml],
]) {
  const bad = ['undefined', 'NaN', '[object Object]'].filter((s) => html.includes(s));
  check(`${label}：HTML 里没有 undefined / NaN / [object Object]`, bad.length === 0, bad.join(' '));
}

console.log(`\n${'─'.repeat(64)}`);
if (failures.length) {
  console.log(`✗ ${pass} 项通过，${failures.length} 项失败：`);
  for (const f of failures) console.log(`    · ${f}`);
  process.exit(1);
}
console.log(`✓ 全部 ${pass} 项通过 —— 四个页面都能渲染出结构`);
