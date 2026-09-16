/**
 * 应用外壳：欢迎 → 答题 → 结果 ／ 欢迎 → 上传 → 群体画像。
 *
 * 三条刻意的安排：
 *   1. **带 ECharts 的两页单独分包**（结果页、群体画像页）。欢迎页与答题页一行图表都用不到，
 *      首屏因此只剩 React + 表单 —— 评委点开链接的第一眼不该在等图表库下载。
 *   2. **基准数据进页面就开始加载**（不等用户点「开始」）。答完 6 题时它早就准备好了，
 *      出结果不该让人等。真入口也用它，所以基准只下载一次。
 *   3. **两个入口共用 `answers`**。在真入口里点「先答 6 题」，答完会**回到群体画像**而不是
 *      跳去个人报告 —— 用户的目标是"看谁和我最像"，不该被带走。
 *      这也顺手让两个入口有了一处真正的交点，而不只是并列的两条路。
 */

import { lazy, Suspense, useEffect, useState } from 'react';
import SurveyForm from './components/SurveyForm.jsx';
import UploadPanel from './components/UploadPanel.jsx';
import IntroScene from './scenes/IntroScene.jsx';
import { loadBaseline } from './data/loadSample.js';
import { useGameStore } from './store/useGameStore.js';
import { QUESTIONS } from './lib/surveySchema.js';
import { cleanName } from './lib/text.js';
import { BRAND } from './lib/theme.js';

const ReportView = lazy(() => import('./components/ReportView.jsx'));
const CohortPage = lazy(() => import('./components/CohortPage.jsx'));

export default function App() {
  const scene = useGameStore((s) => s.scene);
  const [stage, setStage] = useState('welcome'); // welcome | quiz | report | upload | cohort
  const [baseline, setBaseline] = useState(null);
  const [answers, setAnswers] = useState(null);
  const [cohort, setCohort] = useState(null); // 真入口最近一次上传的可用记录
  const [fromCohort, setFromCohort] = useState(false); // 答题是为了回到群体画像
  const [name, setName] = useState('');
  const [error, setError] = useState(null);

  // 基准数据在**入场动画播放时就已经开始下载**：等用户点「进入终端」时它多半已就绪，
  // 所以这里的位置不能挪到 hub 分支里去 —— 那样就会白白等一次网络往返。
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
    setStage('welcome');
  }

  function finishQuiz(a) {
    setAnswers(a);
    if (fromCohort) {
      setFromCohort(false);
      setStage('cohort');
    } else {
      setStage('report');
    }
  }

  // 入场场景独立成屏：它是深色的、不依赖基准数据，不该被上面的加载态卡住。
  if (scene === 'intro') return <IntroScene />;

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-baseline gap-3">
          <button type="button" onClick={restart} className="text-lg font-semibold tracking-tight">
            你的大学平行宇宙
          </button>
          <span className="text-sm text-[var(--ink-soft)] hidden sm:inline">
            个人青春行为图谱生成器
          </span>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-12">
        {error ? (
          <ErrorBlock message={error} />
        ) : !baseline ? (
          <Hint text="正在加载基准人群数据…" />
        ) : stage === 'quiz' ? (
          <SurveyForm onComplete={finishQuiz} onCancel={restart} />
        ) : stage === 'report' && answers ? (
          <Suspense fallback={<Hint text="正在生成你的报告…" />}>
            <ReportView answers={answers} baseline={baseline} name={name} onRestart={restart} />
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

function Welcome({ name, onNameChange, onStart, onUpload }) {
  return (
    <div className="max-w-2xl mx-auto py-8 text-center">
      <h2 className="text-3xl font-semibold tracking-tight leading-snug mb-5">
        回答 6 个问题，
        <br />
        看看你的大学落在哪一个宇宙
      </h2>

      <p className="text-base text-[var(--ink-soft)] leading-7 mb-8">
        不需要账号，不需要上传任何数据。
        <br />
        六道有画面感的选择题，大约 30 秒。
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
        开始（{QUESTIONS.length} 题，约 30 秒）
      </button>

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
