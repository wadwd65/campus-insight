import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import { build } from 'vite';

const rootPath = fileURLToPath(new URL('../', import.meta.url));
const fixtureDir = path.join(rootPath, '.smoke-out/cohort-flow');
process.env.NODE_ENV = 'test';
await build({
  configFile: false, root: rootPath, logLevel: 'error',
  plugins: [{ name: 'test-chart-boundary', enforce: 'pre', resolveId(source) {
    if (/(^|\/)(?:RadarChart|Chart)\.jsx$/.test(source)) return path.join(rootPath, 'scripts/cohort-flow-chart-stub.jsx');
  } }],
  build: { ssr: path.join(rootPath, 'scripts/cohort-flow-fixture.jsx'), outDir: fixtureDir, emptyOutDir: true },
});
const errors = [];
const console = new VirtualConsole();
console.on('jsdomError', error => errors.push(error.message));
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost:5191/', pretendToBeVisual: true, virtualConsole: console });
const win = dom.window, doc = win.document;
for (const key of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'HTMLElement', 'HTMLCanvasElement', 'Element', 'Node', 'Event', 'MouseEvent', 'getComputedStyle']) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? win : typeof win[key] === 'function' && key === 'getComputedStyle' ? win[key].bind(win) : win[key] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = win.requestAnimationFrame.bind(win);
globalThis.cancelAnimationFrame = win.cancelAnimationFrame.bind(win);
win.scrollTo = () => {};
win.HTMLElement.prototype.scrollIntoView = () => {};
win.HTMLElement.prototype.scrollTo = () => {};
win.matchMedia = query => ({ matches: query.includes('prefers-reduced-motion'), media: query, addEventListener() {}, removeEventListener() {} });
globalThis.matchMedia = win.matchMedia;
win.HTMLMediaElement.prototype.pause = function () {};
win.HTMLMediaElement.prototype.load = function () {};
win.HTMLMediaElement.prototype.play = async function () {};
win.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
win.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
globalThis.ResizeObserver = win.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
win.sessionStorage.setItem('campus:intro-seen', '1');
let sampleFailures = 1;
let accountScenario = 'ready';
globalThis.fetch = async (url, options = {}) => {
  assert.equal(options.method || 'GET', 'GET', '这项访客测试不应产生任何服务端写入');
  if (url === '/api/campus/session') return accountScenario === 'configuration' ? Response.json({error:'上线前请配置 APP_ORIGIN 为网站的 HTTPS 地址'}, {status:503}) : Response.json({ user: null, csrf: null, setupRequired: false });
  const file = path.basename(decodeURIComponent(String(url)));
  if (file === '示例-班级问卷.csv' && sampleFailures-- > 0) return Response.json({ error: '测试第一次示例加载失败' }, { status: 503 });
  if (['问卷基准数据.csv', '示例-班级问卷.csv'].includes(file)) return new Response(await fs.readFile(path.join(rootPath, 'public/data', file)));
  return Response.json({ error: '此离线测试未连接可选服务' }, { status: 503 });
};
const { App, act, createRoot, createElement } = await import(pathToFileURL(path.join(fixtureDir, 'cohort-flow-fixture.js')));
const { readSurveyReport } = await import('../src/lib/surveyReportSession.js');
const root = createRoot(doc.getElementById('root'));
const query = selector => doc.querySelector(selector);
const button = text => [...doc.querySelectorAll('button')].find(element => element.textContent.includes(text));
async function waitFor(predicate) {
  for (let i = 0; i < 200; i++) {
    if (predicate()) return;
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  }
  throw new Error(`页面未出现预期结果：${doc.body.textContent.slice(-1200)}`);
}
async function click(element) {
  assert.ok(element, '需要可见的操作入口'); assert.equal(element.disabled, false);
  await act(async () => { element.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })); });
}
try {
  await act(async () => { root.render(createElement(App)); });
  await waitFor(() => query('.landing-action-primary'));
  assert.equal(query('.campus-companion').classList.contains('is-folded'), false, '桌面首页默认展开小人');
  await click(button('先看 48 人模拟班级'));
  await waitFor(() => doc.body.textContent.includes('暂时没能打开示例'));
  assert.equal(button('先看 48 人模拟班级').disabled, false, '失败后应允许重试');
  assert.ok(query('.landing-action-primary'), '示例失败不能挡住个人答题入口');
  await click(button('先看 48 人模拟班级'));
  await waitFor(() => button('先答完一轮，再回来看'));
  assert.equal(query('[data-testid="cohort-personal-comparison"]'), null, '无本人答卷时不能伪造个人比较');
  await click(button('先答完一轮，再回来看'));
  await waitFor(() => query('.quiz-gate'));
  await click(button('开始答题'));
  await waitFor(() => query('.quiz-options'));
  assert.equal(query('.survey-route-details').open, false, '五站路线默认收起，让题目与选项先呈现');
  assert.equal(query('.survey-question-help').open, false, '详细选项说明默认按需展开');
  assert.equal(doc.querySelectorAll('.quiz-options button').length, 5, '减负不能减少可选答案');
  assert.ok(query('.quiz-options').compareDocumentPosition(query('.survey-bottom-rail')) & win.Node.DOCUMENT_POSITION_FOLLOWING, '翻页入口放在全部选项之后');
  for (let i = 0; i < 10; i++) {
    await click(doc.querySelectorAll('.quiz-options button')[i === 0 ? 1 : 0]);
    await click(query('.survey-next'));
  }
  await waitFor(() => query('[data-testid="cohort-personal-comparison"]'));
  assert.equal(Object.keys(readSurveyReport() || {}).length, 10);
  assert.equal(button('先答完一轮，再回来看'), undefined, '完成十题后不应再要求重复答题');
  assert.match(query('[data-testid="cohort-personal-comparison"]').textContent, /这些编号不代表真实同学/);
  await click(button('查看我的完整档案'));
  await waitFor(() => query('.report-next-step'));
  assert.match(query('.report-next-step').textContent, /只做一件小事/);
  await act(async () => { root.unmount(); });
  const restoredRoot = createRoot(doc.getElementById('root'));
  await act(async () => { restoredRoot.render(createElement(App)); });
  await waitFor(() => query('.landing-saved-report'));
  await click(button('先看 48 人模拟班级'));
  await waitFor(() => query('[data-testid="cohort-personal-comparison"]'));
  assert.equal(button('先答完一轮，再回来看'), undefined, '重新挂载恢复本人档案后仍应显示比较');
  await click(button('查看我的完整档案'));
  await waitFor(() => button('安排我的校园一天'));
  const previousAnswers = readSurveyReport();
  await click(button('安排我的校园一天'));
  await waitFor(() => button('去教室提前到，坐前排'));
  await click(button('去教室提前到，坐前排'));
  await click(query('.day-confirm'));
  await waitFor(() => button('带着已有选择，去核对校园问卷'));
  await click(button('带着已有选择，去核对校园问卷'));
  await waitFor(() => query('.quiz-options'));
  const { readSurveyDraft } = await import('../src/lib/surveyDraft.js');
  const resumed = readSurveyDraft();
  assert.deepEqual(resumed.answers, previousAnswers, '答完后再玩地图，应保留十题人工答案，不能只剩一题游戏建议');
  assert.equal(resumed.confirmedFields.length, 10);
  assert.ok(button('采用这次游戏带来的回答'), '与人工答案不同时，应由本人选择是否采用游戏建议');
  await click(button('采用这次游戏带来的回答'));
  await click(button('完成核对，查看我的报告'));
  await waitFor(() => query('.report-next-step'));
  const revised = readSurveyReport();
  assert.equal(revised['早八到教室'], '提前十分钟到，坐前排');
  for (const field of Object.keys(previousAnswers).filter(field => field !== '早八到教室')) assert.equal(revised[field], previousAnswers[field]);
  await click(button('主页'));
  await waitFor(() => query('.landing-action-primary'));
  assert.equal(query('.campus-companion').classList.contains('is-folded'), false, '经过答题、报告和地图后，回首页仍展开小人');
  await click(query('[aria-label="收起同行小人"]'));
  await click(query('.landing-action-primary'));
  await waitFor(() => query('.quiz-options'));
  await click(button('稍后填写，回到首页'));
  await waitFor(() => query('.landing-action-primary'));
  assert.equal(query('.campus-companion').classList.contains('is-folded'), true, '手动收起后，往返页面不擅自展开');
  await click(button('打开同行小人'));
  assert.equal(query('.campus-companion').classList.contains('is-folded'), false, '手动再次展开仍可用');
  await act(async () => { restoredRoot.unmount(); });
  // Reachable but unconfigured authentication must recover after a retry.
  accountScenario = 'configuration';
  win.location.hash = '#/circles';
  const authRoot = createRoot(doc.getElementById('root'));
  await act(async () => { authRoot.render(createElement(App)); });
  await waitFor(() => doc.body.textContent.includes('账号服务暂未就绪'));
  assert.ok(!doc.querySelector('form input[name="password"]'), '服务未配置时不诱导用户反复输入密码');
  assert.ok(!doc.body.textContent.includes('APP_ORIGIN'), '部署配置细节不作为普通用户的登录提示');
  accountScenario = 'ready';
  await click(button('重新连接'));
  await waitFor(() => doc.querySelector('form input[name="username"]'));
  assert.ok(doc.body.textContent.includes('账号登录'), '服务恢复后无需刷新整页即可登录');
  await act(async () => { authRoot.unmount(); });
  assert.deepEqual(errors, []);
  process.stdout.write('示例重试、十题、个人比较、报告恢复、完成后地图建议保留原答案、账号配置错误提示与重连恢复：通过（React DOM，图表像素未验证）\n');
} finally {
  dom.window.close();
}
