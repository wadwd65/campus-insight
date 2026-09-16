/**
 * 终端账本自检 —— `npm run selftest:store`
 *
 * 解决一个很具体的问题：**"点了几下页面，属性条没动"这件事没法用肉眼定位。**
 * 浏览器里点选项有过渡动画、有 React 重渲染，点不准是常态；
 * 而账本本身的规则（向量怎么累加、负值保不保留）是纯计算，完全可以在 Node 里断言。
 *
 * 这里专门锁住一个刚修掉的缺陷：
 *   之前 applyChoice 里写了 Math.max(0, …) 把负增量夹成 0，
 *   于是八个维度退化成"只增不减的计数器" —— 答「宿舍床上」与答「图书馆自习室」
 *   在账上几乎无差别，整条映射链的语义就废了。
 *   最后两条断言就是为这件事设的：矩阵确有负向量，账本也确会记下负数。
 */

import { useGameStore } from '../src/store/useGameStore.js';
import { QUESTIONS, BASE_ATTR_KEYS, vectorOf } from '../src/lib/surveySchema.js';
import { summarizeAttributes, signed, HUD_HALF } from '../src/lib/hudModel.js';

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

const store = useGameStore;
const read = () => store.getState().player;

console.log('\n1 · 初始状态');

store.getState().resetPlayer();
{
  const p = read();
  check('八个属性都归零', BASE_ATTR_KEYS.every((k) => p.attributes[k] === 0));
  check('属性个数与契约一致', Object.keys(p.attributes).length === BASE_ATTR_KEYS.length);
  check('账本初始为空', p.flags.length === 0 && p.trail.length === 0);
}

console.log('\n2 · 六题作答逐题入账');

// 每题固定选最后一个选项：六个选项的向量各不相同，若累加写错，下面的逐维核对必然对不上
store.getState().resetPlayer();
const picks = {};
for (const q of QUESTIONS) {
  const chosen = q.options[q.options.length - 1];
  picks[q.field] = chosen.text;
  store.getState().applyChoice({
    id: `${q.field}=${chosen.text}`,
    label: q.text,
    delta: chosen.vec,
  });
}

{
  const p = read();

  // 期望值：直接按契约把六个向量相加 —— 与账本走的是同一条定义，但算法是这里独立写的
  const expected = Object.fromEntries(BASE_ATTR_KEYS.map((k) => [k, 0]));
  for (const q of QUESTIONS) {
    const v = vectorOf(q.field, picks[q.field]);
    for (const [k, n] of Object.entries(v)) expected[k] += n;
  }

  const mismatch = BASE_ATTR_KEYS.filter((k) => p.attributes[k] !== expected[k]);
  check(
    '逐维等于六个向量之和',
    mismatch.length === 0,
    mismatch.length ? mismatch.map((k) => `${k}: 账本${p.attributes[k]} ≠ 期望${expected[k]}`).join('；') : '',
  );

  // 题数从契约取，不写死 —— 题库从 6 题扩到 10 题时，这两条断言曾各红一次
  const n = QUESTIONS.length;
  check(`记录了 ${n} 条选择标记`, p.flags.length === n, `实际 ${p.flags.length}`);
  check(`记录了 ${n} 条轨迹`, p.trail.length === n, `实际 ${p.trail.length}`);

  const hasNegative = BASE_ATTR_KEYS.some((k) => p.attributes[k] < 0);
  check('账本保留了负值（负增量没被夹成 0）', hasNegative);
}

console.log('\n3 · 矩阵确实带负向量（这条不成立，上面那条就失去意义）');
{
  const negatives = [];
  for (const q of QUESTIONS) {
    for (const o of q.options) {
      for (const [k, v] of Object.entries(o.vec)) {
        if (v < 0) negatives.push(`${q.field}·${o.text}·${k}=${v}`);
      }
    }
  }
  check('矩阵里存在负增量', negatives.length > 0, `共 ${negatives.length} 处，如 ${negatives[0] ?? '—'}`);
}

console.log('\n4 · 重答一次得到新账，而不是接着累加');
{
  const before = read().attributes.academic;
  store.getState().resetPlayer();
  const q = QUESTIONS[0];
  const o = q.options[1];
  store.getState().applyChoice({ id: 'x', label: 'y', delta: o.vec });
  const after = read().attributes.academic;
  check('清空后从零开始算', after === (o.vec.academic ?? 0), `清空前 ${before} → 清空后 ${after}`);
}

console.log('\n5 · HUD 显示规则（纯函数）');
{
  const empty = summarizeAttributes({});
  check('空账本：不算已启用', empty.started === false);
  check('空账本：八条高度都是 0', empty.rows.every((r) => r.height === 0));
  check('空账本：没有最强最弱', empty.top === null && empty.bottom === null);

  const mixed = summarizeAttributes({ academic: 3, social: -2 });
  check('有数据：算已启用', mixed.started === true);
  check(
    '最强是学术投入 +3',
    mixed.top.label === '学术投入' && mixed.top.value === 3,
    `${mixed.top.label} ${mixed.top.value}`,
  );
  check(
    '最弱是社交活跃 -2',
    mixed.bottom.label === '社交活跃' && mixed.bottom.value === -2,
    `${mixed.bottom.label} ${mixed.bottom.value}`,
  );
  check('正值归上半区', mixed.rows.find((r) => r.key === 'academic').positive === true);
  check('负值归下半区', mixed.rows.find((r) => r.key === 'social').positive === false);
  check('分母取绝对值最大者', mixed.peak === 3, `peak=${mixed.peak}`);
  check('最高的一条占满单侧', mixed.rows.find((r) => r.key === 'academic').height === HUD_HALF);
  check(
    '负值也按绝对值占高',
    mixed.rows.find((r) => r.key === 'social').height === Math.round((2 / 3) * HUD_HALF),
  );

  check('正数带 + 号', signed(3) === '+3', signed(3));
  check('负数原样', signed(-2) === '-2', signed(-2));
  check('零不带符号', signed(0) === '0', signed(0));

  // 一正一负相抵：不能用"总和是否为 0"判断有没有数据，否则这种情况会被判成空账本
  const cancel = summarizeAttributes({ academic: 2, social: -2 });
  check('正负相抵时仍算已有数据', cancel.started === true);
}

console.log(`\n${'─'.repeat(64)}`);
if (failures.length) {
  console.log(`✗ ${pass} 项通过，${failures.length} 项失败：`);
  for (const f of failures) console.log(`    · ${f}`);
  process.exit(1);
}
console.log(`✓ 全部 ${pass} 项通过 —— 终端账本的累加规则与契约一致`);
