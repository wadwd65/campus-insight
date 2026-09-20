/**
 * 入场动画自检 —— `npm run selftest:intro`
 *
 * 入场看着是"一堆随机位置的装饰"，但它的每一条规则**破了都不会报错**，
 * 只会让第一屏悄悄变差 —— 而第一屏是评委看到的第一眼。
 * 所以这里有四组底线：
 *
 *   1. **确定性**。用 Math.random() 的话，浏览器任何一次 re-render
 *      （字体加载完、窗口 resize、HMR）都会让整片元素瞬移。
 *      断言方式：同样入参生成两次，逐字段深比。
 *
 *   2. **推镜的层序**。这是本文件最核心的一条。视差读得出来的前提是
 *      "近处涨得比远处快"。写反了不会报错，只会让画面"有点怪"，
 *      肉眼极难定位（上一版就是这么错的）。
 *      断言方式：逐层比同一 t 下的 scale，要求严格递增。
 *
 *   3. **推镜的单调性**。t 变大而进度回退 = 镜头在抖。
 *      断言方式：沿 t 采样，要求 pushProgress 单调不减。
 *
 *   4. **分档要压过层内抖动**。只比平均是不够的：平均能过，
 *      而单个元素里有一半是反的 —— 那正是上一版的毛病。
 *      断言方式：逐元素比 min/max（最慢的近处元素也要快过最快的远处元素）。
 *
 * 另外钉住"**减少动效时预算为 0 / 装饰层整个不生成**"——
 * 不是"生成了再隐藏"，那样 DOM 里仍然挂着几十个元素在跑合成。
 */

import {
  prand,
  SCENE_LAYERS,
  PUSH,
  layerTransform,
  isParallaxOrdered,
  buildFloaters,
  buildLightRain,
  pickSceneBudget,
} from '../src/lib/introLayers.js';
import { pushEase, pushProgress, shouldDraw, FRAME_GAP_MS } from '../src/lib/introPush.js';
import { INTRO_TIMING, LIGHT } from '../src/lib/terminalTheme.js';

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
const nums = (arr, f) => arr.map((x) => parseFloat(f(x)));
const avg = (arr, f) => (arr.length ? arr.reduce((s, x) => s + parseFloat(f(x)), 0) / arr.length : 0);

// ── 1 · 确定性伪随机 ──
console.log('1 · 确定性伪随机');
{
  check('同一入参返回同一值', prand(7, 3) === prand(7, 3));
  check('不同入参基本不同', prand(7, 3) !== prand(8, 3));

  const vals = Array.from({ length: 500 }, (_, i) => prand(i, 1));
  check('全部落在 [0, 1)', vals.every((v) => v >= 0 && v < 1));
  check('没有 NaN', vals.every((v) => Number.isFinite(v)));

  const bins = new Array(10).fill(0);
  for (const v of vals) bins[Math.floor(v * 10)] += 1;
  check('10 个分箱都有样本', bins.every((n) => n > 0), `最少一箱 ${Math.min(...bins)} 个`);
}

// ── 2 · 推镜的层序（本文件最核心的一组） ──
console.log('\n2 · 推镜层序：近处涨得快（写反了看不出但一定错）');
{
  check('SCENE_LAYERS 内部自洽（zoom 严格递增）', isParallaxOrdered());
  check('层数正好是 3（远 / 中 / 近）', SCENE_LAYERS.length === 3, `实际 ${SCENE_LAYERS.length}`);

  const depths = SCENE_LAYERS.map((l) => l.depth);
  check('depth 从 0 连续编号（0=最远）', depths.every((d, i) => d === i), depths.join('/'));

  const zooms = SCENE_LAYERS.map((l) => l.zoom);
  check(
    'zoom 逐层严格递增（近处的终态更大）',
    zooms.every((v, i) => i === 0 || v > zooms[i - 1]),
    zooms.join(' → '),
  );

  check(
    '每层都有可读的中文标签',
    SCENE_LAYERS.every((l) => /[\u4e00-\u9fa5]/.test(l.label)),
  );

  check(
    '每层都有素材文件名（场景是"图"，不是几何拼的）',
    SCENE_LAYERS.every((l) => /\.webp$/.test(l.asset)),
    SCENE_LAYERS.map((l) => l.asset).join(' / '),
  );

  // ★ 真正的判据：同一个 t 下，越近的层 scale 必须越大。
  for (const t of [0.25, 0.5, 0.75, 1]) {
    const scales = SCENE_LAYERS.map((l) => layerTransform(l, t).scale);
    check(
      `t=${t} 时 scale 逐层递增（近处压过来、远处稳如背景）`,
      scales.every((v, i) => i === 0 || v > scales[i - 1]),
      scales.map((s) => s.toFixed(3)).join(' → '),
    );
  }

  // 越近的层，从 t=0 到 t=1 的**涨幅**必须越大 —— 上面那条只保证"当下更大"，
  // 这条才保证"涨得更快"。两者是不同的性质，都要钉。
  const gains = SCENE_LAYERS.map((l) => layerTransform(l, 1).scale - layerTransform(l, 0).scale);
  check(
    '涨幅逐层递增（近处的"推进感"更强，不只是基数大）',
    gains.every((v, i) => i === 0 || v > gains[i - 1]),
    gains.map((g) => `+${(g * 100).toFixed(0)}%`).join(' → '),
  );

  // 边界：t 越界要被夹住，不能外推
  check('t < 0 被夹到 0', layerTransform(SCENE_LAYERS[2], -5).scale === layerTransform(SCENE_LAYERS[2], 0).scale);
  check('t > 1 被夹到 1', layerTransform(SCENE_LAYERS[2], 9).scale === layerTransform(SCENE_LAYERS[2], 1).scale);

  // drift：近处横移更大，且奇偶层方向相反（交错才有视差感）
  const drifts = SCENE_LAYERS.map((l) => Math.abs(layerTransform(l, 1).drift));
  check(
    'drift 逐层递增（近处横移更大）',
    drifts.every((v, i) => i === 0 || v > drifts[i - 1]),
    drifts.join(' → '),
  );
  const dirs = SCENE_LAYERS.map((l) => Math.sign(layerTransform(l, 1).drift));
  check('相邻层横移方向相反（交错而非整片同向平移）', dirs[0] !== dirs[1] && dirs[1] !== dirs[2]);

  // 相邻层 zoom 差必须够大，否则"推镜"退化成"整体放大一张图"
  const gaps = zooms.slice(1).map((v, i) => v - zooms[i]);
  check('相邻层 zoom 差 ≥ 0.1（差太小读不出景深）', gaps.every((g) => g >= 0.1), `实际间隔 ${gaps.map((g) => g.toFixed(2)).join(' / ')}`);
}

// ── 3 · 推镜的时间行为 ──
console.log('\n3 · 推镜的时间行为（单调、闭合、首尾缓）');
{
  check('推镜时长 ≥ 20s（比入场动画本身长得多，看完还在推）', PUSH.durationMs >= 20000, `${PUSH.durationMs / 1000}s`);

  check('pushProgress(0) === 0', pushProgress(0, PUSH.durationMs) === 0);
  check('pushProgress(全程) === 1', pushProgress(PUSH.durationMs, PUSH.durationMs) === 1);
  check('pushProgress(超时) 被夹到 1', pushProgress(PUSH.durationMs * 3, PUSH.durationMs) === 1);

  // 单调不减：沿 200 个采样点走一遍
  const samples = Array.from({ length: 201 }, (_, i) => pushProgress((i / 200) * PUSH.durationMs, PUSH.durationMs));
  check('沿全程单调不减（绝不回退 = 绝不抖）', samples.every((v, i) => i === 0 || v >= samples[i - 1]));
  check('全部落在 [0, 1]', samples.every((v) => v >= 0 && v <= 1));
  check('没有 NaN', samples.every(Number.isFinite));

  // 首尾缓、中段接近匀速：首尾的斜率必须低于中段
  const h = 0.01;
  const slope = (t) => (pushEase(t + h) - pushEase(t - h)) / (2 * h);
  const mid = slope(0.5);
  check('中段斜率接近 1（匀速慢推，不是 ease-in-out）', mid > 0.9 && mid < 1.5, `中段 ${mid.toFixed(2)}`);
  check('起点斜率低于中段（镜头不是硬起）', slope(0.01 + h) < mid);
  check('终点斜率低于中段（镜头不是硬停）', slope(0.99 - h) < mid);

  // 时长非法时不能算出 NaN（除零是最容易漏的一种）
  check('时长为 0 时返回 1 而不是 NaN', pushProgress(500, 0) === 1);
  check('时长为负时返回 1 而不是 NaN', pushProgress(500, -100) === 1);

  // 帧率闸
  check('首帧一定画（lastMs=0 时 shouldDraw 为真）', shouldDraw(1000, 0, FRAME_GAP_MS));
  check('间隔不够时不画（30fps 上限）', !shouldDraw(1000 + FRAME_GAP_MS - 5, 1000, FRAME_GAP_MS));
  check('间隔够了就画', shouldDraw(1000 + FRAME_GAP_MS + 1, 1000, FRAME_GAP_MS));
  check('FRAME_GAP_MS 对应 30fps 左右', FRAME_GAP_MS >= 30 && FRAME_GAP_MS <= 40, `${FRAME_GAP_MS}ms`);
}

// ── 4 · 层数据的确定性 ──
console.log('\n4 · 层数据确定性（重渲染不跳位）');
{
  check('buildFloaters 两次结果完全一致', same(buildFloaters(26), buildFloaters(26)));
  check('buildLightRain 两次结果完全一致', same(buildLightRain(60), buildLightRain(60)));

  const f = buildFloaters(16);
  check('buildFloaters 长度正确', f.length === 16);
  check('buildFloaters 的 key 是 0..n-1', f.every((x, i) => x.key === i));
  check(
    'buildFloaters 每项都有位置与尺寸',
    f.every((x) => /%$/.test(x.left) && /%$/.test(x.top) && x.size > 0),
  );
  check('buildFloaters 只有两种形态（petal / butterfly）', f.every((x) => ['petal', 'butterfly'].includes(x.kind)));
  check('两种形态都出现过（不能只有一种）', new Set(f.map((x) => x.kind)).size === 2);
  check('buildFloaters 输出里没有 NaN 字面量', !JSON.stringify(buildFloaters(80)).includes('NaN'));

  const r = buildLightRain(20);
  check('buildLightRain 长度正确', r.length === 20);
  check(
    'buildLightRain 每项都有位置、长度、粗细',
    r.every((x) => /%$/.test(x.left) && x.length > 0 && x.thickness > 0),
  );
  check(
    '雨丝全部同向倾斜（同向才读成"雨"，乱向就读成"一堆线"）',
    r.every((x) => x.tilt < 0),
    `倾角 ${Math.min(...r.map((x) => x.tilt))} ~ ${Math.max(...r.map((x) => x.tilt))}`,
  );
  check('buildLightRain 输出里没有 NaN 字面量', !JSON.stringify(buildLightRain(80)).includes('NaN'));
}

// ── 5 · 分档压过抖动（逐元素比，不只比平均） ──
console.log('\n5 · 分档压过层内抖动（只比平均会放过"一半是反的"）');
{
  const rain = buildLightRain(90);
  const depths = new Set(rain.map((x) => x.depth));
  check('三档深度都出现过', depths.size === 3, `实际 ${[...depths].sort().join('/')}`);
  check('depth 只取 0/1/2', rain.every((x) => [0, 1, 2].includes(x.depth)));

  const far = rain.filter((x) => x.depth === 0);
  const near = rain.filter((x) => x.depth === 2);

  check('近处的雨丝平均更长', avg(near, (x) => x.length) > avg(far, (x) => x.length));
  check('近处的雨丝平均更亮', avg(near, (x) => x.opacity) > avg(far, (x) => x.opacity));
  check('近处的雨丝平均落得更快（时长更短）', avg(near, (x) => x.duration) < avg(far, (x) => x.duration));

  // ★ 逐元素比 min/max：最慢的"近处雨丝"也必须快过最快的"远处雨丝"。
  // 平均能过而逐元素垮掉，正是上一版公式的毛病（层内抖动盖过了深度步进）。
  check(
    '最慢的近处雨丝也快过最快的远处雨丝（深度步进压过抖动）',
    Math.max(...nums(near, (x) => x.duration)) < Math.min(...nums(far, (x) => x.duration)),
    `近处最慢 ${Math.max(...nums(near, (x) => x.duration))}s / 远处最快 ${Math.min(...nums(far, (x) => x.duration))}s`,
  );
  check(
    '最短的近处雨丝也长过最长的远处雨丝',
    Math.min(...nums(near, (x) => x.length)) > Math.max(...nums(far, (x) => x.length)),
  );
  check(
    '最暗的近处雨丝也亮过最亮的远处雨丝',
    Math.min(...nums(near, (x) => x.opacity)) > Math.max(...nums(far, (x) => x.opacity)),
  );

  // 飘浮物同理
  const fl = buildFloaters(90);
  const flFar = fl.filter((x) => x.depth === 0);
  const flNear = fl.filter((x) => x.depth === 2);
  check('近处的飘浮物平均更大', avg(flNear, (x) => x.size) > avg(flFar, (x) => x.size));
  check('近处的飘浮物平均更亮', avg(flNear, (x) => x.opacity) > avg(flFar, (x) => x.opacity));
  check(
    '最小的近处飘浮物也大过最大的远处飘浮物',
    Math.min(...nums(flNear, (x) => x.size)) > Math.max(...nums(flFar, (x) => x.size)),
  );
}

// ── 6 · 元素散开（不能全挤一边） ──
console.log('\n6 · 元素散开（不能全挤一边）');
{
  const bin = (arr, key, n = 4) => {
    const out = new Array(n).fill(0);
    for (const x of arr) out[Math.min(n - 1, Math.max(0, Math.floor((parseFloat(x[key]) / 100) * n)))] += 1;
    return out;
  };

  const rainBins = bin(buildLightRain(90), 'left');
  check('光雨覆盖全部 4 个横向区间', rainBins.every((n) => n > 0), rainBins.join('/'));

  const flBins = bin(buildFloaters(90), 'left');
  check('飘浮物覆盖 3 个以上横向区间', flBins.filter((n) => n > 0).length >= 3, flBins.join('/'));
  check('飘浮物不堆在顶部（4 个纵向区间都有人）', bin(buildFloaters(90), 'top').every((n) => n > 0));

  // 两个方向的飘浮物都要有，否则会出现"整片同向流" —— 那是"看起来假"的头号原因
  const fl = buildFloaters(60);
  const rightCount = fl.filter((x) => x.toRight).length;
  check(
    '两个飘向都出现过（同向流会显得很假）',
    rightCount > 0 && rightCount < fl.length,
    `向右 ${rightCount} / 向左 ${fl.length - rightCount}`,
  );

  const rain = buildLightRain(90);
  check(
    '光雨亮度都很低（≤ 0.45，否则会糊住标题）',
    rain.every((x) => x.opacity <= 0.45),
    `最大 ${Math.max(...rain.map((x) => x.opacity)).toFixed(3)}`,
  );
  check('飘浮物亮度也压着（≤ 0.8，不抢文字）', buildFloaters(90).every((x) => x.opacity <= 0.8));
}

// ── 7 · 设备预算 ──
console.log('\n7 · 设备预算');
{
  const b = pickSceneBudget();
  check('返回两项数量（floaters / rain）', 'floaters' in b && 'rain' in b, JSON.stringify(b));
  check('两项都是正整数', b.floaters > 0 && b.rain > 0);

  // SSR 下（navigator 不存在）给的是保守值
  check('SSR 下 floaters 走保守值 14', b.floaters === 14, `实际 ${b.floaters}`);
  check('SSR 下 rain 走保守值 34', b.rain === 34, `实际 ${b.rain}`);
  check('光雨数多于飘浮物数（雨是"面"，飘浮物是"点"）', b.rain > b.floaters);

  // 预算必须是**有限**的：雨丝上百条就会开始掉帧
  check('预算封顶合理（rain ≤ 100）', b.rain <= 100);
}

// ── 8 · 时间线（三幕） ──
console.log('\n8 · 时间线（三幕：纯环境 → 文字 → 入口）');
{
  const beats = [
    ['scene', INTRO_TIMING.scene],
    ['crest', INTRO_TIMING.crest],
    ['rule', INTRO_TIMING.rule],
    ['title', INTRO_TIMING.title],
    ['subtitle', INTRO_TIMING.subtitle],
    ['meta', INTRO_TIMING.meta],
    ['cta', INTRO_TIMING.cta],
  ];

  check('节拍严格递增', beats.every(([, v], i) => i === 0 || v > beats[i - 1][1]), beats.map(([, v]) => v).join(' → '));

  // 第一幕：环境先于一切。参考里是 0-6s 一个字都没有，这里压到 1.2s 以上。
  check('第一幕是纯环境（纹章不早于 1200ms）', INTRO_TIMING.crest >= 1200, `${INTRO_TIMING.crest}ms`);
  check('scene 从 0 开始', INTRO_TIMING.scene === 0);

  // 第二幕：文字之间的间隔给足，不能挤在一起
  const textGaps = [
    INTRO_TIMING.rule - INTRO_TIMING.crest,
    INTRO_TIMING.title - INTRO_TIMING.rule,
    INTRO_TIMING.subtitle - INTRO_TIMING.title,
    INTRO_TIMING.meta - INTRO_TIMING.subtitle,
  ];
  check(
    '文字行之间都有停顿（间隔 ≥ 350ms，否则读起来是"一坨"）',
    textGaps.every((g) => g >= 350),
    textGaps.join(' / '),
  );

  // 第三幕：入口最后出现，但要留得住
  check('入口最后出现', INTRO_TIMING.cta > INTRO_TIMING.meta);
  check('入口与最后一行文字之间留了空隙（≥ 400ms）', INTRO_TIMING.cta - INTRO_TIMING.meta >= 400);
  check('总长 ≥ 4000ms（是"一段演出"而不是"界面动画"）', INTRO_TIMING.cta >= 4000, `${INTRO_TIMING.cta}ms`);
  check('总长 ≤ 6000ms（再长就是让评委等了）', INTRO_TIMING.cta <= 6000, `${INTRO_TIMING.cta}ms`);

  // 文字必须在推镜还没到一半时就出完 —— 否则读字的时候画面还在剧烈变化
  check('全部文字出完时推镜进度还不到 20%', INTRO_TIMING.cta / PUSH.durationMs < 0.2, `${((INTRO_TIMING.cta / PUSH.durationMs) * 100).toFixed(1)}%`);
}

// ── 9 · 浅色调色板 ──
console.log('\n9 · 浅色调色板（入场专用）');
{
  const keys = ['mist', 'sky', 'haze', 'stone', 'ink', 'inkSoft', 'inkFaint', 'accent', 'glow'];
  check('九个色位都在', keys.every((k) => typeof LIGHT[k] === 'string' && LIGHT[k].startsWith('#')));
  check('全部是合法十六进制', keys.every((k) => /^#[0-9a-f]{6}$/i.test(LIGHT[k])));

  // 入场的底色必须是**浅**的。这条防的是"哪天有人改回深色"——
  // 改回深色不会报错，只会让"走进来"这件事又消失。
  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return (((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255;
  };
  check('mist 是浅色（亮度 > 0.8）', lum(LIGHT.mist) > 0.8, `亮度 ${lum(LIGHT.mist).toFixed(2)}`);
  check('天空比雾略深（0.7~0.85，否则没有层次）', lum(LIGHT.sky) > 0.7 && lum(LIGHT.sky) < 0.85, `亮度 ${lum(LIGHT.sky).toFixed(2)}`);
  check('文字是深色（亮度 < 0.4，浅底上读得清）', lum(LIGHT.ink) < 0.4, `亮度 ${lum(LIGHT.ink).toFixed(2)}`);
  check('文字比雾深得多（对比度够）', lum(LIGHT.mist) - lum(LIGHT.ink) > 0.45);
  check('次级文字比主文字浅、但比雾深', lum(LIGHT.ink) < lum(LIGHT.inkSoft) && lum(LIGHT.inkSoft) < lum(LIGHT.mist));
  check('最淡的说明文字仍比雾深（不然看不见）', lum(LIGHT.inkFaint) < lum(LIGHT.mist));
}

console.log(`\n${'─'.repeat(64)}`);
if (failures.length) {
  console.log(`✗ ${pass} 项通过，${failures.length} 项失败：`);
  for (const f of failures) console.log(`    · ${f}`);
  process.exit(1);
}
console.log(`✓ 全部 ${pass} 项通过 —— 推镜分层、分档、时间线与浅色调色板的规则都成立`);
