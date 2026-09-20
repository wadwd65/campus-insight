/**
 * 入场动画分层自检 —— `npm run selftest:intro`
 *
 * 入场动画看上去是"一堆随机位置的装饰"，没什么可测的。但它有两条底线，
 * 一旦破了，**肉眼看第一屏时几乎不可能立刻发现**，而后果都不小：
 *
 *   1. **确定性**。用 Math.random() 的话，浏览器任何一次 re-render
 *      （字体加载完、窗口 resize、HMR）都会让整片星点瞬移。
 *      第一屏尤其致命 —— 那是评委看到的第一眼。
 *      断言方式：同样入参生成两次，逐字段深比。
 *
 *   2. **分层必须有速度差**。视差能读出来的前提是"层与层速度可辨"。
 *      如果哪天有人把某一层的时长调得和另一层一样，画面不会报错，
 *      只会**悄悄从'有景深'退化成'一片平的'"。这是典型的静默劣化。
 *      断言方式：逐层比较推导出的 drift，要求严格递增。
 *
 *   3. **层内要散开**。所有光带如果都落在屏幕左半边，右半屏就空了。
 *      断言方式：把位置分箱，要求覆盖率达标。
 *
 * 另外这里还钉住"**减少动效时预算为 0**"——不是"生成了再隐藏"，
 * 而是根本不生成；否则 DOM 里仍然挂着几十个元素。
 */

import {
  prand,
  PARALLAX_LAYERS,
  PUSH,
  buildDots,
  buildLightShafts,
  buildRidges,
  pickLayerBudget,
  LAYER_REVEAL,
} from '../src/lib/introLayers.js';
import { INTRO_TIMING } from '../src/lib/terminalTheme.js';

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

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── 1 · 确定性伪随机 ──
console.log('1 · 确定性伪随机');
{
  check('同一入参返回同一值', prand(7, 3) === prand(7, 3));
  check('不同入参基本不同', prand(7, 3) !== prand(8, 3));

  const vals = Array.from({ length: 500 }, (_, i) => prand(i, 1));
  check('全部落在 [0, 1)', vals.every((v) => v >= 0 && v < 1));
  check('没有 NaN', vals.every((v) => Number.isFinite(v)));

  // 分布不能全挤在一处：把 [0,1) 分成 10 箱，每箱都该有人
  const bins = new Array(10).fill(0);
  for (const v of vals) bins[Math.floor(v * 10)] += 1;
  check('10 个分箱都有样本', bins.every((n) => n > 0), `最少一箱 ${Math.min(...bins)} 个`);
}

// ── 2 · 分层数据各自确定 ──
console.log('\n2 · 分层数据确定性（重渲染不跳位）');
{
  check('buildDots 两次结果完全一致', same(buildDots(30), buildDots(30)));
  check('buildLightShafts 两次结果完全一致', same(buildLightShafts(20), buildLightShafts(20)));
  check('buildRidges 两次结果完全一致', same(buildRidges(8), buildRidges(8)));

  const d1 = buildDots(12);
  check('buildDots 长度正确', d1.length === 12);
  check('buildDots 的 key 是 0..n-1', d1.every((d, i) => d.key === i));
  check(
    'buildDots 每项都有位置与尺寸',
    d1.every((d) => /%$/.test(d.left) && /%$/.test(d.bottom) && d.size > 0),
  );
  check(
    'buildDots 的输出里没有 NaN 字面量',
    !JSON.stringify(buildDots(60)).includes('NaN'),
  );
}

// ── 3 · 视差层序：近的动得快 ──
console.log('\n3 · 视差层序（近的动得快）');
{
  const drifts = PARALLAX_LAYERS.map((l) => l.drift);
  check(
    'drift 逐层严格递增（远→近越快）',
    drifts.every((v, i) => i === 0 || v > drifts[i - 1]),
    drifts.join(' → '),
  );

  const scales = PARALLAX_LAYERS.map((l) => l.scale);
  check(
    'scale 逐层递减（越近放大越少）',
    scales.every((v, i) => i === 0 || v < scales[i - 1]),
    scales.join(' → '),
  );

  const depths = PARALLAX_LAYERS.map((l) => l.depth);
  check('depth 从 0 连续编号', depths.every((d, i) => d === i));

  check('层数正好是 3（不含粒子与中心）', PARALLAX_LAYERS.length === 3);
  check(
    '每层都有可读的中文标签',
    PARALLAX_LAYERS.every((l) => /[\u4e00-\u9fa5]/.test(l.label)),
  );

  // 相邻层的 drift 差必须够大，否则视差读不出来
  const gaps = drifts.slice(1).map((v, i) => v - drifts[i]);
  check(
    '相邻层的速度差 ≥ 15（差太小看不出视差）',
    gaps.every((g) => g >= 15),
    `实际间隔 ${gaps.join(' / ')}`,
  );
}

// ── 4 · 推镜参数 ──
console.log('\n4 · 推镜参数');
{
  check('是放大而不是缩小', PUSH.toScale > PUSH.fromScale);
  check('放大克制在 10% 以内', PUSH.toScale - PUSH.fromScale <= 0.1, `+${((PUSH.toScale - PUSH.fromScale) * 100).toFixed(0)}%`);
  check('有轻微上移（画面向上走）', PUSH.toY < PUSH.fromY);
  check('时长够慢（≥ 15s，否则不叫氛围动画）', PUSH.durationMs >= 15000, `${PUSH.durationMs / 1000}s`);
}

// ── 5 · 层内散开 ──
console.log('\n5 · 层内元素散开（不能全挤一边）');
{
  const shafts = buildLightShafts(40);
  const bins = new Array(4).fill(0);
  for (const s of shafts) bins[Math.min(3, Math.floor((parseFloat(s.left) / 100) * 4))] += 1;
  check('光带覆盖全部 4 个横向区间', bins.every((n) => n > 0), bins.join('/'));

  const ridges = buildRidges(10);
  const rBins = new Array(4).fill(0);
  for (const r of ridges) rBins[Math.min(3, Math.max(0, Math.floor((parseFloat(r.left) / 100) * 4)))] += 1;
  check('剪影覆盖 3 个以上横向区间', rBins.filter((n) => n > 0).length >= 3, rBins.join('/'));

  const dots = buildDots(60);
  const dBins = new Array(4).fill(0);
  for (const d of dots) dBins[Math.min(3, Math.floor((parseFloat(d.left) / 100) * 4))] += 1;
  check('光点覆盖全部 4 个横向区间', dBins.every((n) => n > 0), dBins.join('/'));

  check(
    '光带亮度都很低（≤ 0.2，否则会糊住标题）',
    shafts.every((s) => parseFloat(s.opacity) <= 0.2),
    `最大 ${Math.max(...shafts.map((s) => parseFloat(s.opacity)))}`,
  );
}

// ── 6 · 光点分档 ──
console.log('\n6 · 光点分三档深度');
{
  const dots = buildDots(90);
  const depths = new Set(dots.map((d) => d.depth));
  check('三档深度都出现过', depths.size === 3, `实际 ${[...depths].sort().join('/')}`);
  check('depth 只取 0/1/2', dots.every((d) => [0, 1, 2].includes(d.depth)));

  // 近处的点：更大、更亮、更快
  const far = dots.filter((d) => d.depth === 0);
  const near = dots.filter((d) => d.depth === 2);
  const avg = (arr, f) => arr.reduce((s, x) => s + parseFloat(f(x)), 0) / arr.length;
  check('近处的点平均更大', avg(near, (d) => d.size) > avg(far, (d) => d.size));
  check('近处的点平均更亮', avg(near, (d) => d.opacity) > avg(far, (d) => d.opacity));
  check('近处的点平均更快（时长更短）', avg(near, (d) => d.duration) < avg(far, (d) => d.duration));

  // 只比平均是**不够**的：平均能过，而单个点里有一半是反的（这正是第一版公式的毛病 ——
  // 层内抖动 8s 盖过了深度步进 2.6s，平均刚好还占优，但画面已经乱了）。
  // 所以这里逐点比 min/max：最慢的"近点"也必须快过最快的"远点"。
  const nums = (arr, f) => arr.map((x) => parseFloat(f(x)));
  check(
    '最慢的近点也快过最快的远点（深度步进压过层内抖动）',
    Math.max(...nums(near, (d) => d.duration)) < Math.min(...nums(far, (d) => d.duration)),
    `近点最慢 ${Math.max(...nums(near, (d) => d.duration))}s / 远点最快 ${Math.min(...nums(far, (d) => d.duration))}s`,
  );
  check(
    '最小的近点也大过最大的远点',
    Math.min(...nums(near, (d) => d.size)) > Math.max(...nums(far, (d) => d.size)),
  );
}

// ── 7 · 设备预算 ──
console.log('\n7 · 设备预算');
{
  const b = pickLayerBudget();
  check('返回三个层的数量', 'dots' in b && 'shafts' in b && 'ridges' in b, JSON.stringify(b));
  check('三项都是正整数', b.dots > 0 && b.shafts > 0 && b.ridges > 0);

  // SSR 下（navigator 不存在）给的是保守值
  check('SSR 下 dots 走保守值 24', b.dots === 24, `实际 ${b.dots}`);

  check('光带数远少于光点数（光带是"线"，多了会像栅栏）', b.shafts < b.dots);
  check('剪影数少于光带数（剪影是"块"，最忌多）', b.ridges < b.shafts);
}

// ── 8 · 时间线 ──
console.log('\n8 · 时间线');
{
  // LAYER_REVEAL 与 INTRO_TIMING 必须对齐 —— 两处都写死了数字，很容易改一处忘一处。
  // 这是本自检里最有价值的一条：它抓的是"同一件事写在两个地方"这类结构性隐患。
  const pairs = [
    ['crest', LAYER_REVEAL.crest, INTRO_TIMING.crest],
    ['rule', LAYER_REVEAL.rule, INTRO_TIMING.rule],
    ['title', LAYER_REVEAL.title, INTRO_TIMING.title],
    ['subtitle', LAYER_REVEAL.subtitle, INTRO_TIMING.subtitle],
    ['meta', LAYER_REVEAL.meta, INTRO_TIMING.meta],
    ['cta', LAYER_REVEAL.cta, INTRO_TIMING.cta],
  ];
  for (const [name, a, b] of pairs) {
    check(`LAYER_REVEAL.${name} 与 INTRO_TIMING.${name} 一致`, a === b, `${a} / ${b}`);
  }

  const order = [
    LAYER_REVEAL.sky,
    LAYER_REVEAL.ridge,
    LAYER_REVEAL.dots,
    LAYER_REVEAL.shaft,
    LAYER_REVEAL.crest,
    LAYER_REVEAL.rule,
    LAYER_REVEAL.title,
    LAYER_REVEAL.subtitle,
    LAYER_REVEAL.meta,
    LAYER_REVEAL.cta,
  ];
  check('十个节拍严格递增', order.every((v, i) => i === 0 || v > order[i - 1]));

  check('第一个节拍在 0ms（环境先于文字）', LAYER_REVEAL.sky === 0);
  check(
    '装饰层在文字层之前铺完（先给环境、后给主体）',
    LAYER_REVEAL.shaft < LAYER_REVEAL.crest,
  );
  check('总长控制在 2.5 秒内（再长就是让人等了）', INTRO_TIMING.cta <= 2500, `${INTRO_TIMING.cta}ms`);
  check('总长不短于 1.5 秒（否则又回到"干脆"那一版）', INTRO_TIMING.cta >= 1500, `${INTRO_TIMING.cta}ms`);

  // 相比上一版（1000ms 干脆路线）确实变慢了
  check('比上一版的 1000ms 慢（本次改版的目标）', INTRO_TIMING.cta > 1000);
}

console.log(`\n${'─'.repeat(64)}`);
if (failures.length) {
  console.log(`✗ ${pass} 项通过，${failures.length} 项失败：`);
  for (const f of failures) console.log(`    · ${f}`);
  process.exit(1);
}
console.log(`✓ 全部 ${pass} 项通过 —— 入场四层视差的分层规则成立`);
