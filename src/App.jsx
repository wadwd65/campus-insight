/**
 * 应用外壳：入场 → （主站）欢迎 → 答题 → 结果 ／ 欢迎 → 上传 → 群体画像。
 *
 * 四条刻意的安排：
 *   1. **带 ECharts 的两页单独分包**（结果页、群体画像页）。欢迎页与答题页一行图表都用不到，
 *      首屏因此只剩 React + 表单 —— 评委点开链接的第一眼不该在等图表库下载。
 *      （入场动画同样遵守这条：它用 CSS 排版，不引动画库，理由见 IntroScene.jsx 顶部。）
 *   2. **基准数据进页面就开始加载**（不等用户点「进入」）。看入场动画的这几秒里它早就准备好了，
 *      出结果不该让人等。真入口也用它，所以基准只下载一次。
 *   3. **两个入口共用 `answers`**。在真入口里点「先答一轮」，答完会**回到群体画像**而不是
 *      跳去个人报告 —— 用户的目标是"看谁和我最像"，不该被带走。
 *      这也顺手让两个入口有了一处真正的交点，而不只是并列的两条路。
 *   4. **答题结果同时写进终端账本**（useGameStore）。问卷的每道题本来就带 8 维增量向量，
 *      是现成的真实数据源；写进去之后，顶部 HUD 立刻有数据可看，
 *      而且"问卷"和"地图"从此进的是同一本账 —— 档案页不必关心数据从哪来。
 */

import { lazy, Suspense, useEffect, useState } from 'react';
import SurveyForm from './components/SurveyForm.jsx';
import UploadPanel from './components/UploadPanel.jsx';
import HubHud from './components/HubHud.jsx';
import IntroScene from './scenes/IntroScene.jsx';
import MapScene from './scenes/MapScene.jsx';
import { loadBaseline } from './data/loadSample.js';
import { useGameStore } from './store/useGameStore.js';
import { QUESTIONS, vectorOf } from './lib/surveySchema.js';
import { cleanName } from './lib/text.js';
import { BRAND } from './lib/theme.js';

const ReportView = lazy(() => import('./components/ReportView.jsx'));
const CohortPage = lazy(() => import('./components/CohortPage.jsx'));

export default function App() {
  const scene = useGameStore((s) => s.scene);
  const applyChoice = useGameStore((s) => s.applyChoice);
  const resetPlayer = useGameStore((s) => s.resetPlayer);

  const [stage, setStage] = useState('welcome'); // welcome | quiz | report | upload | cohort | map
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

  function restart() {
    setAnswers(null);
    setFromCohort(false);
    setMapRun(false);
    setStage('welcome');
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

  // 入场场景独立成屏：它是深色的、不依赖基准数据，不该被上面的加载态卡住。
  if (scene === 'intro') return <IntroScene />;

  // 地图同样独立成屏 —— 理由与入场同源：它是**场景层**（深色满宽），
  // 而下面那个 main 是浅色内容容器（max-w-5xl + 白底内边距）。
  // 把地图塞进内容容器，会得到"浅色页面里嵌一块深色"，也就是这个项目
  // 一直在避免的拼接感。两个场景层各自成屏，"两条不混在同一屏里"这条边界才守得住。
  if (stage === 'map') {
    return (
      <div className="min-h-full flex flex-col term-enter">
        <HubHud onRestart={restart} />
        <main className="flex-1 w-full">
          {/* 基准数据还没到也不拦着 —— 地图不依赖基准人群，它只写账本 */}
          <MapScene
            onGoReport={() => {
              setMapRun(true);
              setStage('report');
            }}
            onGoQuiz={() => setStage('quiz')}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col term-enter">
      <HubHud onRestart={restart} />

      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-12">
        {error ? (
          <ErrorBlock message={error} />
        ) : !baseline ? (
          <Hint text="正在加载基准人群数据…" />
        ) : stage === 'quiz' ? (
          <SurveyForm onComplete={finishQuiz} onCancel={restart} />
        ) : stage === 'report' && (answers || mapRun) ? (
          <Suspense fallback={<Hint text="正在生成你的报告…" />}>
            <ReportView
              answers={answers}
              attributes={mapRun ? player.attributes : undefined}
              trail={mapRun ? player.trail : undefined}
              baseline={baseline}
              name={name}
              onRestart={restart}
            />
          </Suspense>
        ) : stage === 'upload' ? (
          <UploadPanel
            onReady={(r) => {
              setCohort(r.records);
              setStage('cohort');
            }}
          />
        ) : stage === 'cohort' && cohort ? (
          <Suspense fallback={<Hint text="正在算这个班的画像…" />}>
            <CohortPage
              records={cohort}
              baseline={baseline}
              ownAnswers={answers}
              onGoQuiz={() => {
                setFromCohort(true);
                setStage('quiz');
              }}
              onRestart={restart}
            />
          </Suspense>
        ) : (
          <Welcome
            name={name}
            onNameChange={(v) => setName(cleanName(v))}
            onStart={() => setStage('quiz')}
            onMap={() => setStage('map')}
            onUpload={() => setStage('upload')}
          />
        )}
      </main>

      <footer className="border-t border-[var(--line)] bg-[var(--surface)]">
        <div className="max-w-5xl mx-auto px-6 py-3 text-xs text-[var(--ink-soft)] leading-5">
          你的选择与上传的文件只在浏览器里计算；开启大模型解读时，只把算好的百分比与称号发给模型服务来写那段话，
          其余什么都不发 · 基准人群与示例班级数据为模拟生成，非真实调查结果
        </div>
      </footer>
    </div>
  );
}

function Welcome({ name, onNameChange, onStart, onMap, onUpload }) {
  return (
    <div className="max-w-2xl mx-auto py-8 text-center">
      <h2 className="text-3xl font-semibold tracking-tight leading-snug mb-5">
        回答 {QUESTIONS.length} 个问题，
        <br />
        看看你的大学落在哪一个宇宙
      </h2>

      <p className="text-base text-[var(--ink-soft)] leading-7 mb-8">
        不需要账号，不需要上传任何数据。
        <br />
        {QUESTIONS.length} 道有画面感的选择题，大约 1 分钟。
      </p>

      {/* 称呼是选填的。但它值一个输入框：报告里带上名字，
          那份「这是在说我」的感觉是"你"这个代词给不了的 */}
      <label className="block mb-6">
        <span className="sr-only">怎么称呼你</span>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={8}
          placeholder="怎么称呼你？（选填，比如一个姓）"
          className="w-56 mx-auto block rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-sm text-center text-[var(--ink)] outline-none transition focus:border-[var(--brand)]"
        />
      </label>

      <button
        type="button"
        onClick={onStart}
        className="rounded-xl px-7 py-3.5 text-base text-white transition hover:opacity-90"
        style={{ background: BRAND }}
      >
        开始（{QUESTIONS.length} 题，约 1 分钟）
      </button>

      {/* 第二条路：地图。摆在旁边而不是收进二级入口，因为它不是"更多选项"，
          而是完全不同的玩法 —— 问卷是答完就没，地图是可以反复走的。
          两条路写进同一本账，所以先走哪条都行 */}
      <div className="mt-4">
        <button
          type="button"
          onClick={onMap}
          className="term-mono rounded-xl px-6 py-3 text-sm transition-[border-color,color]"
          style={{
            border: '1px solid var(--line)',
            color: 'var(--ink-soft)',
          }}
        >
          ▸ 或者去校园里走走（4 个时段，16 个地方）
        </button>
      </div>

      <div className="mt-6 pt-6 border-t border-[var(--line)]">
        <button
          type="button"
          onClick={onUpload}
          className="text-sm text-[var(--ink-soft)] underline decoration-dotted hover:text-[var(--ink)] transition"
        >
          或者：上传一份班级问卷 CSV，看一个群体的画像 →
        </button>
      </div>

      <p className="mt-8 text-sm text-[var(--ink-soft)] leading-7 text-left">
        答完你会拿到一份只属于你的报告：一张人物雷达图、一份「时间去哪了」、
        一条四年的心情曲线，以及一段只有你会拿到的话 —— 最后那句话由大模型照着你的数据写。
        <br />
        你的每一题都会同时影响 8 个属性，再与 2000 人基准人群比对 ——
        所以不同的人答完，结果是真的不一样。
        <br />
        如果你手上有一批已经收集好的问卷，走真入口可以看这个群体的分布，
        以及班里跟谁和你最像。
      </p>
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
