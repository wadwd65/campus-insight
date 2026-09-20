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
import { MonoTag, SectionHead } from './TermHead.jsx';
import { buildReport, buildReportFromAttributes } from '../lib/results.js';
import { pickKeyword, buildClosing } from '../lib/keyword.js';
import { fallbackText } from '../lib/fallback.js';
import { BRAND } from '../lib/theme.js';
import { TERM_INK } from '../lib/surface.js';

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
      {/* 报告也长得像终端：顶部一条状态行，和入场/地图同一种语言。
          "REPORT // GENERATED" 这句不是装饰 ——
          它把"你刚刚的二十次点击已经被算完了"这件事讲出来，
          这正好是入场那句"等待和你的答案对上"的兑现。 */}
      <div className="flex items-center justify-between mb-8">
        <MonoTag>REPORT&nbsp;//&nbsp;GENERATED</MonoTag>
        <MonoTag tone="cyan">
          {fromMap ? `轨道 ${trail?.length ?? 0} 步` : `采集 ${Object.keys(answers ?? {}).length} 项`}
        </MonoTag>
      </div>

      {/* 称号区。原先是一行大字纯文本，现在是「纹章 + 等宽小标 + 称号」，
          纹章直接复刻入场那个六边形 ——
          同一台机器在入场认一次、在报告再认一次，四页才算一个作品。
          称号用琥珀色：那是入场立绘右侧（运动）的颜色，也是终端里"结果出来了"的色。 */}
      <div className="text-center mb-12">
        <div className="flex justify-center mb-5">
          <Crest />
        </div>
        <MonoTag tone="amber">// 你的称号</MonoTag>
        <h1 className="mt-2.5 text-3xl font-semibold tracking-tight" style={{ color: TERM_INK.amber }}>
          {report.facts.title}
        </h1>
      </div>

      <div className="space-y-10">
        {/* 这一块只有地图路径会有：问卷答完没有"顺序"这个概念，
            而地图的轨迹是**有序的** —— 先去了图书馆再去小吃街，
            和反过来是两种人。这是地图给报告带来的、问卷给不了的东西。 */}
        {fromMap && trail?.length > 0 && (
          <Section n={1} show={step >= 1} title="你走过的路" hint="按顺序重放一遍这四年">
            <ActionTrail trail={trail} />
          </Section>
        )}

        <Section
          n={fromMap && trail?.length > 0 ? 2 : 1}
          show={step >= 1}
          title="大学生活者画像"
          hint="每个数字的意思是：你超过了多少比例的大学生"
        >
          <RadarChart data={report.radar} />
        </Section>

        <Section n={fromMap && trail?.length > 0 ? 3 : 2} show={step >= 2} title="时间去哪了">
          <TimeDonut data={report.timeSplit} />
        </Section>

        <Section
          n={fromMap && trail?.length > 0 ? 4 : 3}
          show={step >= 3}
          title="四年心情曲线"
          hint="不是分数，只是一条相对起伏的线"
        >
          <MoodCurve data={report.moodCurve} />
        </Section>

        <Section n={fromMap && trail?.length > 0 ? 5 : 4} show={step >= 4} title="人群冷知识">
          <FactsCard facts={report.facts} />
        </Section>

        <Section
          n={fromMap && trail?.length > 0 ? 6 : 5}
          show={step >= 4}
          title="给你的话"
          hint="这段话由大模型照着你的数据写，不是模板填空"
        >
          <AiSummary report={report} name={name} onText={(text) => setAiText(text)} />
          <p className="text-base font-medium mt-5" style={{ color: TERM_INK.amber }}>
            {closing}
          </p>
        </Section>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-12 pt-8 border-t border-[var(--line)]">
        <button
          type="button"
          onClick={copyText}
          className="px-4 py-2 text-sm text-white transition hover:opacity-90"
          style={{ background: BRAND }}
        >
          {copied ? '已复制' : '复制文字版'}
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--ink)] transition hover:border-slate-300"
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

function Section({ n, show, title, hint, children }) {
  return (
    <section
      className="transition-all duration-500 ease-out"
      style={{ opacity: show ? 1 : 0, transform: show ? 'none' : 'translateY(14px)' }}
    >
      <SectionHead index={n} title={title} hint={hint} />
      {children}
    </section>
  );
}

/**
 * 纹章 —— 与入场那个同一个图形（六边形 + 内环 + 中心菱形 + 射线）。
 *
 * 这里刻意**没有抽成共用组件**，两个原因：
 *   1. 入场的那个尺寸是 112，还带一个 term-breathe 的呼吸动画（它要"活着"）；
 *      报告这个要小一半、且是静态的 —— 报告已经结束了，还在呼吸是错的语义。
 *   2. 两处的颜色来源不同：入场直接读 TERMINAL 常量，
 *      报告页在浅色底上，用同一组色但透明度不同（浅底上 0.45 会看不见）。
 *   形状共用、参数不共用，硬抽成一个组件会让它长出四个 props，反而更难读。
 */
function Crest() {
  return (
    <svg width="64" height="64" viewBox="0 0 120 120" role="img" aria-label="终端纹章">
      <title>终端纹章</title>
      <polygon
        points="60,4 108,32 108,88 60,116 12,88 12,32"
        fill="none"
        stroke={TERM_INK.cyan}
        strokeWidth="1"
        opacity="0.5"
      />
      <polygon
        points="60,20 96,40 96,80 60,100 24,80 24,40"
        fill="none"
        stroke={TERM_INK.amber}
        strokeWidth="1"
        opacity="0.85"
      />
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <line
          key={deg}
          x1="60"
          y1="34"
          x2="60"
          y2="44"
          stroke={TERM_INK.cyan}
          strokeWidth="1"
          opacity="0.55"
          transform={`rotate(${deg} 60 60)`}
        />
      ))}
      <polygon points="60,46 74,60 60,74 46,60" fill={TERM_INK.amber} opacity="0.9" />
    </svg>
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
