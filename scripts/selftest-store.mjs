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

console.log('\n6 · 最强 / 最弱不能落在「没被碰过」的维度上');

// 这一节锁的是地图上线后抓到的一个真实缺陷：
// 只去过图书馆（学术 +4）时，HUD 摘要显示「↓ 夜猫程度 0」——
// 说"你最弱的是夜猫程度，值是 0"没有信息量，
// 而且把"没被任何行动影响过"和"被负向影响过"混成了一件事。
{
  const one = summarizeAttributes({ academic: 4 });
  check('只有一项非零时，最强是它', one.top.label === '学术投入' && one.top.value === 4);
  // 真正的不变量是"绝不指向没被碰过的维度"，而不是"bottom 必须是负值"。
  // 只有一项非零时 bottom 指向那一项本身 —— 这是对的：touched 里只有它，
  // 它就是"被碰过的维度里最低的那个"。（我第一版断言写成 `bottom.value < 0`，
  // 于是这条自己红了 —— 断言写错比代码写错更常见，这里如实留着。）
  check('最弱项绝不指向值为 0 的维度', one.bottom.value !== 0, `实际拿到 ${one.bottom.label} ${one.bottom.value}`);
  check(
    '只有一项被碰过时，最强与最弱是同一项（这是对的，不是缺陷）',
    one.top.key === one.bottom.key,
    `${one.top.label} / ${one.bottom.label}`,
  );
  check('记录了"被碰过"的维度数', one.touchedCount === 1, `touchedCount=${one.touchedCount}`);

  // 有负值时，最弱才是真的弱
  const withNeg = summarizeAttributes({ academic: 4, night: -2 });
  check('有负值时最弱指向真正的负值', withNeg.bottom.label === '夜猫程度' && withNeg.bottom.value === -2);
  check('此时被碰过的维度是两项', withNeg.touchedCount === 2);

  // 全为非负：不该选出任何"弱项"
  const allPos = summarizeAttributes({ academic: 3, social: 2 });
  check('全为非负时最弱项也是正值', allPos.bottom.value === 2, `${allPos.bottom.label} ${allPos.bottom.value}`);
  check('全为非负时没有被碰过的负向维度', allPos.rows.every((r) => r.value >= 0));

  // ★ 直接复现修之前那个缺陷的场景：只去过图书馆（8 项里 5 项是 0）。
  //   旧实现在全部 8 项里取最小，会被 0 项吃掉 —— 当没有任何负值时，
  //   最小值就是 0，于是界面上出现「↓ 夜猫程度 0」这种没有信息量的话。
  const partly = summarizeAttributes({ academic: 4, plan: 2, night: -1, sport: -1, social: -1 });
  const zeros = partly.rows.filter((r) => r.value === 0).map((r) => r.label);
  check('确实存在没被碰过的维度（这条不成立，下面那条就没意义）', zeros.length === 3, `0 值维度：${zeros.join('、')}`);
  check(
    '最弱项不是任何一个 0 值维度',
    partly.bottom.value !== 0 && !zeros.includes(partly.bottom.label),
    `最弱=${partly.bottom.label} ${partly.bottom.value}；0 值维度=${zeros.join('、')}`,
  );

  // 这才是旧实现真正会出错的形状：所有被碰过的项都是正的，其余是 0。
  // 旧实现必然选出 0（因为 0 < 任何正数），并且会把"没碰过"说成"最弱"。
  const onlyPos = summarizeAttributes({ academic: 4, plan: 2 });
  const zeroDims = onlyPos.rows.filter((r) => r.value === 0).map((r) => r.label);
  check('全正的账本里，0 值维度有 6 个', zeroDims.length === 6, zeroDims.join('、'));
  check(
    '旧缺陷复现点：最弱不能是 0 值维度',
    onlyPos.bottom.value !== 0,
    `最弱=${onlyPos.bottom.label} ${onlyPos.bottom.value}（若为 0 则缺陷回归）`,
  );
  check('此时最弱应落在被碰过的最低项上', onlyPos.bottom.label === '计划性' && onlyPos.bottom.value === 2);

  // 与空态的区别：空账本 top/bottom 都是 null，不能因此崩掉
  const empty2 = summarizeAttributes({});
  check('空账本 top / bottom 仍是 null', empty2.top === null && empty2.bottom === null);
  check('空账本 touchedCount 为 0', empty2.touchedCount === 0);
}

console.log(`\n${'─'.repeat(64)}`);
if (failures.length) {
  console.log(`✗ ${pass} 项通过，${failures.length} 项失败：`);
  for (const f of failures) console.log(`    · ${f}`);
  process.exit(1);
}
console.log(`✓ 全部 ${pass} 项通过 —— 终端账本的累加规则与契约一致`);
