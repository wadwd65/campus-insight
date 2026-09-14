/**
 * 结果页 —— 五件套的组装与出场节奏。
 *
 * 「依次出现」不是装饰：五块内容一次全砸出来，人会不知道先看哪里，
 * 结果反而等于都没看。分四拍出现，每拍之间 240 毫秒，
 * 读的人自然会把注意力跟着走一遍。
 *
 * 「复制文字版」也不是顺手加的：报告如果不能被带走，就只是一次性的屏幕内容；
 * 能被复制粘贴到群里，它才算真的传播出去了。
 */

import { useEffect, useMemo, useState } from 'react';
import RadarChart from './RadarChart.jsx';
import TimeDonut from './TimeDonut.jsx';
import MoodCurve from './MoodCurve.jsx';
import FactsCard from './FactsCard.jsx';
import { buildReport } from '../lib/results.js';
import { buildFallbackSummary } from '../lib/fallback.js';
import { BRAND } from '../lib/theme.js';

export default function ReportView({ answers, baseline, onRestart }) {
  const report = useMemo(() => buildReport(answers, baseline), [answers, baseline]);
  const summary = useMemo(() => buildFallbackSummary(report), [report]);

  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timers = [1, 2, 3, 4].map((n, i) =>
      window.setTimeout(() => setStep(n), 240 * (i + 1)),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  const plainText = useMemo(() => {
    const lines = [
      `我的大学平行宇宙 · ${report.facts.title}`,
      '',
      ...report.facts.lines.map((l) => `· ${l.text}`),
      '',
      `四年心情：${report.moodCurve.map((d) => `${d.stage} ${d.value}`).join(' → ')}`,
      `时间分配：${report.timeSplit.map((d) => `${d.name} ${d.value}%`).join(' · ')}`,
      '',
      ...summary.paragraphs,
      summary.closing,
    ];
    return lines.join('\n');
  }, [report, summary]);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-12">
        <p className="text-xs tracking-widest text-[var(--ink-soft)] mb-3">你的称号</p>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: BRAND }}>
          {report.facts.title}
        </h1>
      </div>

      <div className="space-y-12">
        <Section show={step >= 1} title="大学生活者画像" hint="每个数字的意思是：你超过了多少比例的大学生">
          <RadarChart data={report.radar} />
        </Section>

        <Section show={step >= 2} title="时间去哪了">
          <TimeDonut data={report.timeSplit} />
        </Section>

        <Section show={step >= 3} title="四年心情曲线" hint="不是分数，只是一条相对起伏的线">
          <MoodCurve data={report.moodCurve} />
        </Section>

        <Section show={step >= 4} title="人群冷知识">
          <FactsCard facts={report.facts} />
        </Section>

        <Section show={step >= 4} title="给你的话">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-5 py-5">
            {summary.paragraphs.map((t) => (
              <p key={t} className="text-sm leading-7 text-[var(--ink)] mb-3">
                {t}
              </p>
            ))}
            <p className="text-base font-medium mt-5" style={{ color: BRAND }}>
              {summary.closing}
            </p>
            {summary.degraded && (
              <p className="text-xs text-[var(--ink-soft)] mt-4 pt-4 border-t border-[var(--line)]">
                当前为内置文案 —— 页面没有配置大模型接口，或接口暂时不可用。
                图表与百分位不受影响。
              </p>
            )}
          </div>
        </Section>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-12 pt-8 border-t border-[var(--line)]">
        <button
          type="button"
          onClick={copyText}
          className="rounded-lg px-4 py-2 text-sm text-white transition hover:opacity-90"
          style={{ background: BRAND }}
        >
          {copied ? '已复制' : '复制文字版'}
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--ink)] transition hover:border-slate-300"
        >
          再答一次
        </button>
        <span className="text-xs text-[var(--ink-soft)]">
          换个答案，报告的走向会完全不同
        </span>
      </div>
    </div>
  );
}

function Section({ show, title, hint, children }) {
  return (
    <section
      className="transition-all duration-500 ease-out"
      style={{ opacity: show ? 1 : 0, transform: show ? 'none' : 'translateY(14px)' }}
    >
      <h3 className="text-base font-medium text-[var(--ink)] mb-1">{title}</h3>
      {hint ? <p className="text-xs text-[var(--ink-soft)] mb-4">{hint}</p> : <div className="mb-4" />}
      {children}
    </section>
  );
}
