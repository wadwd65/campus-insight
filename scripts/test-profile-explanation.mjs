import assert from 'node:assert/strict';
import { QUESTIONS, BASE_ATTR_KEYS, ALL_ATTR_KEYS } from '../src/lib/surveySchema.js';
import { toAttributes, withDerivedAttributes, buildBaseline, toPercents } from '../src/lib/matrix.js';
import { profileSources, explainProfile, previewAnswer } from '../src/lib/profileExplanation.js';

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
const answers = Object.fromEntries(QUESTIONS.map((q, i) => [q.field, q.options[i % q.options.length].text]));
const baseline = buildBaseline(Array.from({ length: 80 }, (_, index) => toAttributes(Object.fromEntries(QUESTIONS.map((q, i) => [q.field, q.options[(index + i) % q.options.length].text])))));
const attributes = toAttributes(answers);
const quizTrail = QUESTIONS.map((q) => ({ id: `${q.field}=${answers[q.field]}`, label: q.text }));
const delta = { academic: 1, plan: 1, resilience: -1 };
const trail = [...quizTrail, { at: 'library', label: '图书馆 · 再次自习', delta }];
const combined = withDerivedAttributes(Object.fromEntries(BASE_ATTR_KEYS.map((key) => [key, attributes[key] + (delta[key] ?? 0)])));
const original = structuredClone({ answers, trail, combined });

check('问卷账本不重复计入，十个答案加一次地图行动恰好十一条', () => assert.equal(profileSources(answers, trail).length, QUESTIONS.length + 1));
check('地图采用已衰减的实际增量，不重新查地点基础奖励', () => assert.equal(profileSources(answers, trail).at(-1).delta.academic, 1));
check('派生维逐条使用相同公式，实际地图佛系增量为负二', () => assert.equal(profileSources(answers, trail).at(-1).delta.buddhist, -2));
check('所有九维的已追溯正负增量之和等于报告原始分', () => { for (const item of explainProfile({ answers, trail, attributes: combined, baseline })) { assert.equal(item.positive + item.negative, combined[item.key]); assert.equal(item.unexplained, 0); assert.equal(item.percentile, toPercents(combined, baseline)[item.key]); } });
check('未知答案与没有实际 delta 的地图条目不虚构贡献', () => assert.deepEqual(profileSources({ wrong: 'unknown' }, [{ at: 'x', label: 'unknown' }]), []));
check('未记入轨迹的属性标出无法追溯的余量', () => assert.equal(explainProfile({ answers: null, attributes: { academic: 3 }, baseline })[0].unexplained, 3));
check('纯地图路径也能解释，问卷题目不会被捏造', () => { const sources = profileSources(null, trail); assert.equal(sources.length, 1); assert.equal(sources[0].kind, 'map'); });
check('替换一道回答的预览与重新计算完全一致，并保留已有地图增量', () => {
  const q = QUESTIONS[0], value = q.options[1].text;
  const result = previewAnswer({ answers, attributes: combined, baseline, field: q.field, value });
  const expected = toAttributes({ ...answers, [q.field]: value });
  for (const key of BASE_ATTR_KEYS) expected[key] += delta[key] ?? 0;
  assert.deepEqual(result.attributes, withDerivedAttributes(expected));
  assert.deepEqual(result.percents, toPercents(withDerivedAttributes(expected), baseline));
});
check('原选项预览不漂移，未知选项不参与计算', () => { const q = QUESTIONS[1]; assert.deepEqual(previewAnswer({ answers, attributes: combined, baseline, field: q.field, value: answers[q.field] }).attributes, combined); assert.equal(previewAnswer({ answers, attributes: combined, baseline, field: q.field, value: 'unknown' }), null); });
check('解释与预览不会修改答案、原报告或行动账本', () => assert.deepEqual({ answers, trail, combined }, original));
check('空输入不会出现 NaN 或伪造回答', () => { const result = explainProfile({}); assert.equal(result.length, ALL_ATTR_KEYS.length); assert.ok(result.every((item) => item.raw === 0 && item.percentile === 50 && item.influences.length === 0)); });
console.log(`画像解释与临时预览：${passed} 项通过`);
