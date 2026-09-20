/**
 * 结果页 —— 五件套的组装与出场节奏。
 *
 * 「依次出现」不是装饰：五块内容一次全砸出来，人会不知道先看哪里，
 * 结果反而等于都没看。分四拍出现，每拍之间 240 毫秒，
 * 读的人自然会把注意力跟着走一遍。
 *
 * 「复制文字版」也不是顺手加的：报告如果不能被带走，就只是一次性的屏幕内容；
 * 能被复制粘贴到群里，它才算真的传播出去了。
 *
 * 第四拍里有两块：大模型写的正文（AiSummary，现场生成、三种状态）
 * 和结尾那一句（本地确定性生成、不走大模型）。分开是刻意的 ——
 * 结尾那句是最可能被截图的一句话，不能出现"这次没生成好"。
 */

import { useEffect, useMemo, useState } from 'react';
import RadarChart from './RadarChart.jsx';
import TimeDonut from './TimeDonut.jsx';
import MoodCurve from './MoodCurve.jsx';
import FactsCard from './FactsCard.jsx';
import AiSummary from './AiSummary.jsx';
import { buildReport, buildReportFromAttributes } from '../lib/results.js';
import { pickKeyword, buildClosing } from '../lib/keyword.js';
import { fallbackText } from '../lib/fallback.js';
import { BRAND } from '../lib/theme.js';

/**
 * @param {Record<string,string>} [answers] 问卷答案（走快入口时给）
 * @param {Record<string,number>} [attributes] 账本属性（走地图时给）
 *
 * 两个输入二选一，`attributes` 优先。为什么让报告页同时认这两种形状，
 * 而不是在外面转成同一种：它们在语义上**就是不同的东西** ——
 * answers 是"用户说了什么"，attributes 是"这些选择算出来是多少"。
 * 硬要在外面把地图的账伪造一份 answers，等于在数据层撒谎，
 * 而且摘要（buildSummary）读 answers 时会真的筛出错误的题。
 */
export default function ReportView({ answers, attributes, trail, baseline, name = '', onRestart }) {
  const report = useMemo(
    () =>
      attributes
        ? buildReportFromAttributes(attributes, baseline, { answers: answers ?? null })
        : buildReport(answers, baseline),
    [answers, attributes, baseline],
  );
  const fromMap = Boolean(attributes) && !answers;
  const closing = useMemo(() => buildClosing(pickKeyword(report.percents)), [report]);

  // 大模型成稿后由 AiSummary 回传，供「复制文字版」使用。
  // 在它成稿之前，用内置文案顶上 —— 让"复制"按钮从第一秒就可点，
  // 而且复制到的东西本来就是一份完整的、个性化的文案，不是空的。
  const [aiText, setAiText] = useState(null);

  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timers = [1, 2, 3, 4].map((n, i) =>
      window.setTimeout(() => setStep(n), 240 * (i + 1)),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  const plainText = useMemo(() => {
    const body = aiText ?? fallbackText(report, { name });
    const lines = [
      `我的大学平行宇宙 · ${report.facts.title}`,
      '',
      ...report.facts.lines.map((l) => `· ${l.text}`),
      '',
      `四年心情：${report.moodCurve.map((d) => `${d.stage} ${d.value}`).join(' → ')}`,
      `时间分配：${report.timeSplit.map((d) => `${d.name} ${d.value}%`).join(' · ')}`,
      // 地图路径才有的部分：走过的顺序。问卷答完没有这项，也不会打印空标题
      ...(fromMap && trail?.length
        ? ['', `我走过的路：${trail.map((t) => t.label).join(' → ')}`]
        : []),
      '',
      body,
      closing,
    ];
    return lines.join('\n');
  }, [report, closing, aiText, name, fromMap, trail]);

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
        {/* 这一块只有地图路径会有：问卷答完没有"顺序"这个概念，
            而地图的轨迹是**有序的** —— 先去了图书馆再去小吃街，
            和反过来是两种人。这是地图给报告带来的、问卷给不了的东西。 */}
        {fromMap && trail?.length > 0 && (
          <Section show={step >= 1} title="你走过的路" hint="按顺序重放一遍这四年">
            <ActionTrail trail={trail} />
          </Section>
        )}

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
          <AiSummary
            report={report}
            name={name}
            onText={(text) => setAiText(text)}
          />
          <p className="text-base font-medium mt-5" style={{ color: BRAND }}>
            {closing}
          </p>
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

/**
 * 行动轨迹 —— 把地图上走过的路按顺序重放一遍。
 *
 * 这一块**只属于地图路径**。为什么值得单独做：
 *   问卷答完，得到的是"你在八个维度上分别是多少" —— 一个**快照**。
 *   地图走完，除了快照还多一样东西：**顺序**。
 *   先图书馆后小吃街，和先小吃街后图书馆，八维可能算出来完全一样，
 *   但那是两种完全不同的人。快照会丢掉这个信息，重放不会。
 *
 * 配色跟内容区走（浅色令牌），不搬场景层的深色 —— 报告页是"报告正文"，
 * 不是仪表盘。这条边界见 index.css 顶部。
 */
function ActionTrail({ trail }) {
  return (
    <ol className="relative pl-6 space-y-3">
      {/* 竖线：用绝对定位的一条线串起所有节点，比给每个 li 画边框稳 */}
      <span
        className="absolute left-[7px] top-2 bottom-2 w-px"
        style={{ background: 'var(--line)' }}
        aria-hidden="true"
      />
      {trail.map((t, i) => (
        <li key={`${t.id}-${i}`} className="relative">
          <span
            className="absolute -left-6 top-[5px] inline-block w-[15px] h-[15px] rounded-full border-2"
            style={{ borderColor: BRAND, background: 'var(--surface)' }}
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--ink)] leading-6">
            <span className="text-xs text-[var(--ink-soft)] mr-2">{i + 1}</span>
            {t.label}
          </p>
        </li>
      ))}
    </ol>
  );
}
