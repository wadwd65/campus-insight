/**
 * 地图引擎自检 —— `npm run selftest:map`
 *
 * 与 selftest-store.mjs 同一个立场：**"点了几下页面涨得对不对"没法靠肉眼验**，
 * 但衰减、时段、可用性判定全是算术，必须被锁住。
 *
 * 这里最要紧的四条断言：
 *   1. 衰减确实在衰减（第 2 次是第 1 次的一半，第 4 次为 0）
 *   2. 衰减后**不会**塌成"涨了但显示为 0"（非零增量保底 ±1）
 *   3. 时段确实是稀缺的（16 个地点不可能在 4 个时段里点完，且 cost=2 的门槛真的生效）
 *   4. 地图与问卷写进的是**同一本账**（同一套键名、同一套累加规则）
 * 第 4 条尤其重要：它是"档案页不关心数据从哪来"这句话唯一的证据。
 */

import { useGameStore } from '../src/store/useGameStore.js';
import { BASE_ATTR_KEYS } from '../src/lib/surveySchema.js';
import { PLACES, PLACE_INDEX, SLOTS_PER_DAY, ZONES } from '../src/data/mapPlaces.js';
import {
  decayFactor,
  countVisits,
  nextDelta,
  slotsLeft,
  canVisit,
  mapModel,
  timeline,
  DECAY_LIMIT,
} from '../src/lib/mapEngine.js';

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

console.log('\n1 · 地点数据本身是合法的');

{
  const ids = PLACES.map((p) => p.id);
  check('id 不重复', new Set(ids).size === ids.length, `${ids.length} 个地点`);
  check('每个地点都有氛围句', PLACES.every((p) => typeof p.line === 'string' && p.line.length > 4));
  check('每个地点都有 cost（1 或 2）', PLACES.every((p) => p.cost === 1 || p.cost === 2));

  const zoneKeys = new Set(ZONES.map((z) => z.key));
  check('zone 都在已声明的四个区域里', PLACES.every((p) => zoneKeys.has(p.zone)));
  check('四个区域都有地点', ZONES.every((z) => PLACES.some((p) => p.zone === z.key)));

  // 向量键名必须落在契约的 8 个基础属性里 —— 写错一个键名，
  // 账本会**静默**忽略它（applyChoice 里是 `if (k in attributes)`），
  // 表现为"这个地点好像不怎么加属性"，极难定位
  const unknown = [];
  for (const p of PLACES) {
    for (const k of Object.keys(p.vec)) {
      if (!BASE_ATTR_KEYS.includes(k)) unknown.push(`${p.id}.${k}`);
    }
  }
  check('所有向量的键名都在契约的 8 维里', unknown.length === 0, unknown.join(' ') || '键名全部合法');

  const hasNeg = PLACES.some((p) => Object.values(p.vec).some((v) => v < 0));
  check('确实有地点带负增量（否则地点之间没有取舍）', hasNeg);
  check('每个地点至少给一维正增量', PLACES.every((p) => Object.values(p.vec).some((v) => v > 0)));
}

console.log('\n2 · 衰减规则');

{
  check('第 1 次不衰减', decayFactor(1) === 1);
  check('第 2 次减半', decayFactor(2) === 0.5);
  check('第 3 次是三分之一', Math.abs(decayFactor(3) - 1 / 3) < 1e-9);
  check('第 4 次归零', decayFactor(DECAY_LIMIT + 1) === 0);
  check('第 99 次仍是零（不会回弹）', decayFactor(99) === 0);

  const lib = PLACE_INDEX.get('library');

  const d1 = nextDelta(lib, {});
  check('第一次去图书馆：学术 +4', d1.vec.academic === 4, JSON.stringify(d1.vec));
  check('第一次带访问序号', d1.visit === 1 && d1.factor === 1);

  const d2 = nextDelta(lib, { library: 1 });
  check('第二次去：学术 +2', d2.vec.academic === 2, JSON.stringify(d2.vec));

  const d3 = nextDelta(lib, { library: 2 });
  check('第三次去：学术 +1（4/3 四舍五入到 1）', d3.vec.academic === 1, JSON.stringify(d3.vec));

  const d4 = nextDelta(lib, { library: 3 });
  check('第四次去：返回 null（不再给增量）', d4 === null);

  // 这条是给"取整"设的：图书馆的 sport 是 -1，第二次去是 -0.5，
  // 若不保底就会 Math.round(-0.5) = -0（JS 里是 -0，显示成 0），
  // 于是"这次行动确实少了点运动"这件事在界面上消失了
  const dec = nextDelta(lib, { library: 1 });
  check('衰减后非零增量的符号被保住', dec.vec.sport === -1, `sport=${dec.vec.sport}`);
  check(
    '衰减后的增量全是整数',
    Object.values(dec.vec).every((v) => Number.isInteger(v)),
    JSON.stringify(dec.vec),
  );
}

console.log('\n3 · 时段是稀缺资源');

{
  check('一天四个时段', SLOTS_PER_DAY === 4);
  check('空轨迹时四个时段都在', slotsLeft([]) === 4);

  const after1 = slotsLeft([{ id: 'library' }]);
  check('去一次图书馆消耗 1 个时段', after1 === 3, `剩 ${after1}`);

  const after2 = slotsLeft([{ id: 'library' }, { id: 'intern' }]);
  check('实习（cost=2）消耗 2 个时段', after2 === 1, `剩 ${after2}`);

  // 时段不会被扣成负数
  const overdraft = slotsLeft([{ id: 'intern' }, { id: 'intern' }]);
  check('时段扣不出负数', overdraft === 0, `剩 ${overdraft}`);

  const total = PLACES.length;
  check(
    `地点数（${total}）远多于时段数（${SLOTS_PER_DAY}）`,
    total > SLOTS_PER_DAY,
    '这意味着"点完全部地点"在结构上不可能，必须取舍',
  );

  // cost=2 的地点在没有时段时必须被拦住
  const intern = PLACE_INDEX.get('intern');
  const blocked = canVisit(intern, { visited: {}, slots: 1 });
  check('时段不够时 cost=2 的地点不可去', blocked.ok === false && blocked.reason === '时段不够', blocked.reason);

  const okAt2 = canVisit(intern, { visited: {}, slots: 2 });
  check('时段刚好够时可以走', okAt2.ok === true);

  // 未知地点 id 不该凭空消耗时段
  check('未知 id 不消耗时段（模板容错）', slotsLeft([{ id: 'not-a-place' }]) === 4);
}

console.log('\n4 · 地图状态模型');

{
  const empty = mapModel([]);
  check('空态：四个时段都在', empty.slots === 4);
  check('空态：未启用', empty.started === false);
  check('空态：全部地点可点', empty.items.every((i) => i.enabled === true));
  check('空态：零次行程', empty.totalTrips === 0);
  check('空态：每个地点的可用状态表都带 name', empty.items.every((i) => typeof i.name === 'string'));

  const one = mapModel([{ id: 'canteen', label: '食堂' }]);
  check('去过一次：食堂标为 1 次', one.items.find((i) => i.id === 'canteen').times === 1);
  check('去过一次：已启用', one.started === true);
  check('去过一次：剩 3 个时段', one.slots === 3, `剩 ${one.slots}`);
  check('去过一次：总行程 1', one.totalTrips === 1);

  // 用满 4 个时段后，所有地点都不该再可点
  const full = mapModel([
    { id: 'library', label: 'x' },
    { id: 'court', label: 'x' },
    { id: 'dorm', label: 'x' },
    { id: 'rooftop', label: 'x' },
  ]);
  check('时段用完后一切不可点', full.items.every((i) => i.enabled === false));
  check('时段用完：明确说「今天的时段用完了」', full.anyLeft === false && full.slots === 0);
  check(
    '时段用完：未去过的地方给出「时段用完」的原因，而不是空白',
    full.items.filter((i) => i.times === 0).every((i) => i.reason.length > 0),
  );

  const counts = countVisits([{ id: 'a' }, { id: 'a' }, { id: 'b' }]);
  check('出行计数正确', counts.a === 2 && counts.b === 1, JSON.stringify(counts));
  check('缺 id 的轨迹不计入地点计数', Object.keys(countVisits([{ label: '只有标签' }])).length === 0);

  const tl = timeline([{ id: 'library', label: 'x' }, { id: '不存在' }]);
  check('时间轴只保留认识的地点', tl.length === 1 && tl[0].name === '图书馆', JSON.stringify(tl.map((t) => t.name)));
}

console.log('\n5 · 地图与问卷进的是同一本账');

{
  store.getState().resetPlayer();

  const place = PLACE_INDEX.get('nightmarket');
  const delta = nextDelta(place, {});
  store.getState().applyChoice({ id: place.id, label: place.name, delta: delta.vec, at: 1 });

  {
    const p = read();
    // 逐维核对：账本的值必须等于地点向量本身（第一次去，衰减系数为 1）
    const mismatch = BASE_ATTR_KEYS.filter((k) => p.attributes[k] !== (place.vec[k] ?? 0));
    check(
      '地点增量逐维进入账本',
      mismatch.length === 0,
      mismatch.length ? mismatch.map((k) => `${k}: 账本${p.attributes[k]} ≠ 期望${place.vec[k] ?? 0}`).join('；') : '',
    );
    check('地点 id 进了 flags', p.flags.includes('nightmarket'));
    check('地点名进了轨迹', p.trail.some((t) => t.label === '小吃街'));
    check('轨迹保留了时间戳', p.trail[0].at === 1);
  }

  // 再点一次同名地点：账本要继续累加（衰减由调用方算好再传进来）
  const delta2 = nextDelta(place, { nightmarket: 1 });
  const beforeFood = read().attributes.food;
  store.getState().applyChoice({ id: place.id, label: place.name, delta: delta2.vec, at: 2 });
  {
    const p = read();
    check(
      '第二次去按衰减后的值累加',
      p.attributes.food === beforeFood + delta2.vec.food,
      `${beforeFood} → ${p.attributes.food}`,
    );
    check('同地点可以去多次，轨迹两条', p.trail.length === 2);
    check('flags 记了两条（可以重复）', p.flags.filter((f) => f === 'nightmarket').length === 2);
  }

  // 地图 + 问卷混合：这就是"两条路进同一本账"的证明
  const before = { ...read().attributes };
  store.getState().applyChoice({
    id: 'Q1=宿舍床上',
    label: '深夜最常出没在哪个角落？',
    delta: { academic: -1, night: 1 },
  });
  {
    const p = read();
    check('问卷与地图的增量叠加在同一本账上', p.attributes.night === before.night + 1);
    check('轨迹里同时有地点与题目', p.trail.some((t) => t.id === 'nightmarket') && p.trail.some((t) => t.id === 'Q1=宿舍床上'));
  }

  store.getState().resetPlayer();
  check('清空后地图状态也归零', mapModel(read().trail).slots === 4 && mapModel(read().trail).started === false);
}

console.log(`\n${'─'.repeat(64)}`);
if (failures.length) {
  console.log(`✗ ${pass} 项通过，${failures.length} 项失败：`);
  for (const f of failures) console.log(`    · ${f}`);
  process.exit(1);
}
console.log(`✓ 全部 ${pass} 项通过 —— 地图的衰减、时段与账本对接都符合预期`);
