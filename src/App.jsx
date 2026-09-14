/**
 * 应用外壳：欢迎 → 答题 → 结果。
 *
 * 两处刻意的安排：
 *   1. **结果页单独分包**。它带着 ECharts（约 600 KB），而欢迎页与答题页一行图表都用不到。
 *      首屏因此只剩 React + 表单 —— 评委点开链接的第一眼不该在等图表库下载。
 *   2. **基准数据进页面就开始加载**（不等用户点「开始」）。答完 6 题时它早就准备好了，
 *      出结果不该让人等。
 */

import { lazy, Suspense, useEffect, useState } from 'react';
import SurveyForm from './components/SurveyForm.jsx';
import { loadBaseline } from './data/loadSample.js';
import { QUESTIONS } from './lib/surveySchema.js';
import { BRAND } from './lib/theme.js';

const ReportView = lazy(() => import('./components/ReportView.jsx'));

export default function App() {
  const [stage, setStage] = useState('welcome'); // welcome | quiz | report
  const [baseline, setBaseline] = useState(null);
  const [answers, setAnswers] = useState(null);
  const [error, setError] = useState(null);

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
    setStage('welcome');
  }

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
        ) : stage === 'quiz' ? (
          <SurveyForm
            onComplete={(a) => {
              setAnswers(a);
              setStage('report');
            }}
            onCancel={restart}
          />
        ) : stage === 'report' && answers && baseline ? (
          <Suspense fallback={<Hint text="正在生成你的报告…" />}>
            <ReportView answers={answers} baseline={baseline} onRestart={restart} />
          </Suspense>
        ) : (
          <Welcome ready={!!baseline} onStart={() => setStage('quiz')} />
        )}
      </main>

      <footer className="border-t border-[var(--line)] bg-[var(--surface)]">
        <div className="max-w-5xl mx-auto px-6 py-3 text-xs text-[var(--ink-soft)]">
          数据只在你的浏览器里处理，不会上传到任何服务器 · 基准人群数据为模拟生成，非真实调查结果
        </div>
      </footer>
    </div>
  );
}

function Welcome({ ready, onStart }) {
  return (
    <div className="max-w-2xl mx-auto py-8 text-center">
      <h2 className="text-3xl font-semibold tracking-tight leading-snug mb-5">
        回答 6 个问题，
        <br />
        看看你的大学落在哪一个宇宙
      </h2>

      <p className="text-base text-[var(--ink-soft)] leading-7 mb-10">
        不需要账号，不需要上传任何数据。
        <br />
        六道有画面感的选择题，大约 30 秒。
      </p>

      <button
        type="button"
        disabled={!ready}
        onClick={onStart}
        className="rounded-xl px-7 py-3.5 text-base text-white transition disabled:cursor-wait disabled:opacity-50"
        style={{ background: BRAND }}
      >
        {ready ? `开始（${QUESTIONS.length} 题，约 30 秒）` : '正在加载基准人群数据…'}
      </button>

      <p className="mt-10 text-sm text-[var(--ink-soft)] leading-7 text-left">
        答完你会拿到一份只属于你的报告：一张人物雷达图、一份「时间去哪了」、
        一条四年的心情曲线，以及一句只有你能拿到的评语。
        <br />
        你的每一题都会同时影响 8 个属性，再与 2000 人基准人群比对 ——
        所以不同的人答完，结果是真的不一样。
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
