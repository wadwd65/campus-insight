/**
 * 应用外壳。
 *
 * ── 2026-09-20 改版：地图升为主界面，答题降为子入口 ─────────────────
 *
 * 改版前是「入场 → Welcome（正中一个大蓝按钮「开始 10 题」）→ 答题 → 结果」。
 * 那个结构把**答题当成了门**，地图反而是旁边一条次按钮。
 * 用户指出来这是反的：「**地图是第一界面，答题是他的子端口，而不是主端口**」。
 *
 * 理由站得住：地图是可反复走的、有空间感的、有即时反馈的；
 * 答题是一次性的。可反复的那个才该是家，一次性的那个该是家中的一个功能。
 *
 * 新结构：
 *   入场 → 地图（默认界面，深色场景层）
 *          ├─ 01 生成档案（走过地方之后可用）→ 报告
 *          ├─ 02 答 10 题 → 答题入口面板 → 问卷 → 报告
 *          └─ 03 上传班级 CSV → 群体画像
 *
 * 另外新加了 `gate` 这一站（答题入口面板）——
 * 点「答 10 题」不再直接落到第一题。见 QuizGate.jsx 的说明。
 *
 * 四条沿用至今的安排：
 *   1. **带 ECharts 的两页单独分包**（结果页、群体画像页）。首屏因此只剩
 *      React + 表单 —— 评委点开链接的第一眼不该在等图表库下载。
 *   2. **基准数据进页面就开始加载**（不等用户点「进入」）。看入场动画的这几秒里
 *      它早就准备好了，出结果不该让人等。真入口也用它，所以基准只下载一次。
 *   3. **两个入口共用 `answers`**。在真入口里点「先答一轮」，答完会**回到群体画像**
 *      而不是跳去个人报告 —— 用户的目标是"看谁和我最像"，不该被带走。
 *   4. **答题结果同时写进终端账本**（useGameStore）。问卷的每道题本来就带 8 维增量向量，
 *      是现成的真实数据源；写进去之后 HUD 立刻有数据可看，
 *      而且"问卷"和"地图"从此进的是同一本账 —— 档案页不必关心数据从哪来。
 */

import { lazy, Suspense, useEffect, useState } from 'react';
import SurveyForm from './components/SurveyForm.jsx';
import UploadPanel from './components/UploadPanel.jsx';
import QuizGate from './components/QuizGate.jsx';
import HubHud from './components/HubHud.jsx';
import { MonoTag } from './components/TermHead.jsx';
import IntroScene from './scenes/IntroScene.jsx';
import MapScene from './scenes/MapScene.jsx';
import { loadBaseline } from './data/loadSample.js';
import { useGameStore } from './store/useGameStore.js';
import { QUESTIONS, vectorOf } from './lib/surveySchema.js';
import { cleanName } from './lib/text.js';

const ReportView = lazy(() => import('./components/ReportView.jsx'));
const CohortPage = lazy(() => import('./components/CohortPage.jsx'));

export default function App() {
  const scene = useGameStore((s) => s.scene);
  const applyChoice = useGameStore((s) => s.applyChoice);
  const resetPlayer = useGameStore((s) => s.resetPlayer);

  // ★ 默认就是地图。这是本次改版的核心一行 ——
  // 改版前这里写的是 'welcome'，于是答题成了门。
  // map | gate | quiz | report | upload | cohort
  const [stage, setStage] = useState('map');
  const [baseline, setBaseline] = useState(null);
  const [answers, setAnswers] = useState(null);
  const [cohort, setCohort] = useState(null); // 真入口最近一次上传的可用记录
  const [fromCohort, setFromCohort] = useState(false); // 答题是为了回到群体画像
  const [name, setName] = useState('');
  const [error, setError] = useState(null);

  // 报告有两条来路：问卷（answers）与地图（账本里的 attributes）。
  // 这里用一个标记记住"这份报告是从地图来的"，因为两者的数据形状不同 ——
  // 地图没有 answers，只有一本累加的账。见 results.js 的 buildReportFromAttributes。
  const [mapRun, setMapRun] = useState(false);
  const player = useGameStore((s) => s.player);

  // 基准数据在**入场动画播放时就已经开始下载**：等用户点「进入终端」时它多半已就绪，
  // 所以这个 effect 不能挪到 hub 分支里去 —— 那样就会白白等一次网络往返。
  useEffect(() => {
    let alive = true;
    loadBaseline()
      .then((d) => {
        if (alive) setBaseline(d.baseline);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);

  // ★ 回到地图 —— 这是全站的"回首页"。
  // 注意它**不清空账本**（restart 才清）：从报告页按返回、从上传页按返回，
  // 玩家走过的地方应该还在，否则"回去再走一段"这件事就没法做了。
  function backToMap() {
    setFromCohort(false);
    setStage('map');
  }

  // 彻底重来：清账本、清作答、回地图。
  // 它对应 HUD 上的「重来」——那是"我不想保留这一轮了"，语义与 backToMap 不同。
  function restart() {
    resetPlayer();
    setAnswers(null);
    setFromCohort(false);
    setMapRun(false);
    setName('');
    setStage('map');
  }

  function finishQuiz(a) {
    setAnswers(a);
    setMapRun(false); // 走问卷这条路，报告就读 answers，不读地图的账

    // 把这一轮作答的增量写进终端账本。
    // 先清空再写：重答一次应该得到一份新账，而不是在上一次的基础上继续累加。
    resetPlayer();
    for (const q of QUESTIONS) {
      const vec = vectorOf(q.field, a[q.field]);
      if (vec) applyChoice({ id: `${q.field}=${a[q.field]}`, label: q.text, delta: vec });
    }

    if (fromCohort) {
      setFromCohort(false);
      setStage('cohort');
    } else {
      setStage('report');
    }
  }

  // 入场场景独立成屏：它不依赖基准数据，也不依赖账本，不该被上面的加载态卡住。
  if (scene === 'intro') return <IntroScene />;

  // ── 场景层：地图 ──
  // 它是**深色满宽**的仪表盘，不该塞进下面那个浅色内容容器
  // （max-w-5xl + 白底内边距）里 —— 那样会得到"浅色页面里嵌一块深色"，
  // 也就是这个项目一直在避免的拼接感。
  if (stage === 'map') {
    return (
      <div className="min-h-full flex flex-col term-enter">
        <HubHud onRestart={restart} />
        {/* 地图整屏都是深的，所以这里**不加**过渡带 ——
            过渡带的作用是"深浅相接处化一下"，而这里两侧都是深色，
            加一条亮线只会在深色里多出一条没有意义的横线。 */}
        <main className="flex-1 w-full">
          {/* 基准数据还没到也不拦着 —— 地图不依赖基准人群，它只写账本 */}
          <MapScene
            onGoReport={() => {
              setMapRun(true);
              setStage('report');
            }}
            onGoQuiz={() => setStage('gate')}
            onUpload={() => setStage('upload')}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col term-enter">
      <HubHud onRestart={restart} />
      {/* 深色 HUD → 浅色正文的过渡带。见 index.css 的 .term-seam 说明：
          不加它，这条边界就是一条硬切的黑白线。 */}
      <div className="term-seam" aria-hidden="true" />

      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-12">
        {error ? (
          <ErrorBlock message={error} />
        ) : !baseline ? (
          <Hint text="正在加载基准人群数据…" />
        ) : stage === 'gate' ? (
          /* 答题入口面板：点「答 10 题」不再直接落到第一题。
             用户原话「答题应该是一个功能，而不是点进去就是答题」。 */
          <QuizGate onStart={() => setStage('quiz')} onBack={backToMap} />
        ) : stage === 'quiz' ? (
          <SurveyForm onComplete={finishQuiz} onCancel={() => setStage('gate')} />
        ) : stage === 'report' && (answers || mapRun) ? (
          <Suspense fallback={<Hint text="正在生成你的报告…" />}>
            <ReportView
              answers={answers}
              attributes={mapRun ? player.attributes : undefined}
              trail={mapRun ? player.trail : undefined}
              baseline={baseline}
              name={name}
              onRestart={restart}
              onBackToMap={backToMap}
            />
          </Suspense>
        ) : stage === 'upload' ? (
          <UploadPanel
            onReady={(r) => {
              setCohort(r.records);
              setStage('cohort');
            }}
            onBack={backToMap}
          />
        ) : stage === 'cohort' && cohort ? (
          <Suspense fallback={<Hint text="正在算这个班的画像…" />}>
            <CohortPage
              records={cohort}
              baseline={baseline}
              ownAnswers={answers}
              onGoQuiz={() => {
                setFromCohort(true);
                setStage('gate');
              }}
              onRestart={restart}
            />
          </Suspense>
        ) : (
          /* 兜底不再是 Welcome —— 那条"两条并列的路"的版式整个删掉了。
             任何没被上面接住的状态都回地图。 */
          <FallbackToMap onBack={backToMap} />
        )}
      </main>

      <footer className="border-t border-[var(--line)] bg-[var(--surface)]">
        <div className="max-w-5xl mx-auto px-6 py-4 space-y-2">
          {/* 两条声明各占一行。原先挤成一行时，"PRIVACY //" 后面跟了 40 多个字，
              等宽小标的作用就没了 —— 它本来是用来分隔和指路的，
              被正文淹没之后只剩噪音。 */}
          <div className="flex gap-3">
            <MonoTag style={{ minWidth: 76, flexShrink: 0 }}>PRIVACY&nbsp;//</MonoTag>
            <span className="text-xs text-[var(--ink-soft)] leading-5">
              你的选择与上传的文件只在浏览器里计算；开启大模型解读时，
              只把算好的百分比与称号发给模型服务来写那段话，其余什么都不发
            </span>
          </div>
          <div className="flex gap-3">
            <MonoTag style={{ minWidth: 76, flexShrink: 0 }}>SIMULATED&nbsp;//</MonoTag>
            <span className="text-xs text-[var(--ink-soft)] leading-5">
              基准人群与示例班级数据为模拟生成，非真实调查结果
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * 兜底：任何没能匹配上的 stage 都回地图。
 *
 * 为什么不保留旧的 Welcome 当兜底：
 * 那个组件就是"两条并列的路"的版式本身，而这一版要删的正是它。
 * 留一个改过用途的 Welcome 会让人以为"首页还在"，下次改版又会绕回来。
 */
function FallbackToMap({ onBack }) {
  return (
    <div className="max-w-md mx-auto py-16 text-center">
      <p className="text-sm text-[var(--ink-soft)] mb-5">这里没有内容，回地图吧。</p>
      <button
        type="button"
        onClick={onBack}
        className="term-mono text-[12px] px-6 py-3 rounded-sm transition-colors"
        style={{ border: '1px solid var(--line)', color: 'var(--ink-soft)' }}
      >
        ← 回到地图
      </button>
    </div>
  );
}

function Hint({ text }) {
  return <p className="text-center text-sm text-[var(--ink-soft)] py-20">{text}</p>;
}

function ErrorBlock({ message }) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-6 py-8">
        <p className="text-base font-medium mb-2">基准数据没能加载</p>
        <p className="text-sm text-[var(--ink-soft)] leading-6">{message}</p>
      </div>
    </div>
  );
}
