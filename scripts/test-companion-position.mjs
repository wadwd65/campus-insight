import assert from 'node:assert/strict';
import {
  POSITION_STORAGE_KEY,
  clampCompanionPosition,
  readCompanionPosition,
  restoreCompanionPosition,
  saveCompanionPosition,
  clearCompanionPosition,
} from '../src/lib/companionPosition.js';

let count = 0;
function test(name, run) { run(); count++; console.log('  ✓ ' + name); }
function memoryStorage(initial) {
  const values = new Map(initial === undefined ? [] : [[POSITION_STORAGE_KEY, initial]]);
  return {
    values,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
}
const viewport = {width: 1200, height: 800};
const portrait = {width: 138, height: 472};

test('桌面四边夹紧：上方为操作条留出空间，拖到屏外仍能抓回来', () => {
  assert.deepEqual(clampCompanionPosition({x: -900, y: -900}, viewport, portrait), {x: 8, y: 42});
  assert.deepEqual(clampCompanionPosition({x: 9000, y: 9000}, viewport, portrait), {x: 1054, y: 320});
  assert.deepEqual(clampCompanionPosition({x: 120.5, y: 150.25}, viewport, portrait), {x: 120.5, y: 150.25});
});

test('极小窗口、超大立绘与非法坐标不会产生负位置或 NaN', () => {
  assert.deepEqual(clampCompanionPosition({x: 999, y: 999}, {width: 5, height: 6}, portrait), {x: 0, y: 0});
  assert.deepEqual(clampCompanionPosition({x: 999, y: 999}, {width: 148, height: 500}, portrait), {x: 8, y: 28});
  assert.deepEqual(clampCompanionPosition({x: NaN, y: Infinity}, viewport, portrait), {x: 8, y: 42});
  assert.deepEqual(clampCompanionPosition(null, null, null), {x: 0, y: 0});
});

test('不同窗口和人物尺寸组合下，可容纳时始终保留边距', () => {
  for (const width of [0, 7, 20, 320, 1200]) for (const height of [0, 25, 100, 640, 900]) {
    for (const size of [{width: 0, height: 0}, {width: 66, height: 226}, portrait]) {
      for (const position of [{x: -1e6, y: -1e6}, {x: 1e6, y: 1e6}]) {
        const result = clampCompanionPosition(position, {width, height}, size);
        assert.ok(Number.isFinite(result.x) && Number.isFinite(result.y));
        assert.ok(result.x >= 0 && result.y >= 0);
        if (width >= size.width + 16) assert.ok(result.x >= 8 && result.x + size.width <= width - 8);
        if (height >= size.height + 50) assert.ok(result.y >= 42 && result.y + size.height <= height - 8);
      }
    }
  }
});

test('位置按可移动区域比例保存，缩放窗口后仍保持相同相对位置', () => {
  const storage = memoryStorage();
  const at = {x: 8 + 1046 * 0.25, y: 42 + 278 * 0.75};
  assert.equal(saveCompanionPosition(storage, at, viewport, portrait), true);
  assert.deepEqual(readCompanionPosition(storage), {rx: 0.25, ry: 0.75});
  assert.deepEqual(restoreCompanionPosition(readCompanionPosition(storage), viewport, portrait), at);
  assert.deepEqual(restoreCompanionPosition(readCompanionPosition(storage), {width: 400, height: 700}, {width: 66, height: 226}), {x: 87.5, y: 360});
  const saved = JSON.parse(storage.getItem(POSITION_STORAGE_KEY));
  assert.deepEqual(Object.keys(saved).sort(), ['rx', 'ry', 'version']);
  assert.deepEqual(saved, {version: 1, rx: 0.25, ry: 0.75});
});

test('拖到外面只保存夹紧后的比例，零可移动区域不会保存无穷值', () => {
  const storage = memoryStorage();
  assert.equal(saveCompanionPosition(storage, {x: -3, y: 30000}, viewport, portrait), true);
  assert.deepEqual(readCompanionPosition(storage), {rx: 0, ry: 1});
  assert.equal(saveCompanionPosition(storage, {x: 100, y: 100}, {width: 0, height: 0}, portrait), true);
  assert.deepEqual(readCompanionPosition(storage), {rx: 0, ry: 0});
  assert.deepEqual(restoreCompanionPosition({rx: 1, ry: 1}, {width: 10, height: 10}, portrait), {x: 0, y: 0});
});

test('缺失、损坏、版本不符与越界偏好回到默认位置，而不是污染布局', () => {
  for (const value of [undefined, '', '{', 'null', '[]', '42', '{}',
    '{"version":2,"rx":0.5,"ry":0.5}', '{"version":1,"rx":-0.1,"ry":0.5}',
    '{"version":1,"rx":0.5,"ry":1.1}', '{"version":1,"rx":"0.5","ry":0.5}',
    '{"version":1,"rx":0.5,"ry":null}', '{"version":1,"rx":1e999,"ry":0.5}']) {
    assert.equal(readCompanionPosition(memoryStorage(value)), null);
  }
  for (const preference of [null, {}, {rx: 0, ry: NaN}, {rx: 2, ry: 0}]) {
    assert.equal(restoreCompanionPosition(preference, viewport, portrait), null);
  }
  assert.equal(restoreCompanionPosition({rx: 0, ry: 0}, {width: -1, height: 800}, portrait), null);
});

test('存储被禁用或配额已满时仍能使用，清除只影响小人的位置记录', () => {
  const blocked = new Proxy({}, {get() { throw new Error('Storage blocked'); }});
  for (const storage of [undefined, null, blocked]) {
    assert.equal(readCompanionPosition(storage), null);
    assert.equal(saveCompanionPosition(storage, {x: 100, y: 100}, viewport, portrait), false);
    assert.equal(clearCompanionPosition(storage), false);
  }
  const storage = memoryStorage();
  storage.setItem('unrelated-setting', 'keep');
  saveCompanionPosition(storage, {x: 100, y: 100}, viewport, portrait);
  assert.equal(clearCompanionPosition(storage), true);
  assert.equal(clearCompanionPosition(storage), true);
  assert.equal(readCompanionPosition(storage), null);
  assert.equal(storage.getItem('unrelated-setting'), 'keep');
  assert.equal(saveCompanionPosition(storage, {x: Infinity, y: 0}, viewport, portrait), false);
  assert.equal(storage.getItem(POSITION_STORAGE_KEY), null);
});

console.log(`同行小人位置：${count} 项通过`);
