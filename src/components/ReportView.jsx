import JourneyContinuity from './JourneyContinuity.jsx';
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

import { useEffect, useMemo, useRef, useState } from 'react';
import RadarChart from './RadarChart.jsx';
import TimeDonut from './TimeDonut.jsx';
import MoodCurve from './MoodCurve.jsx';
import FactsCard from './FactsCard.jsx';
import CampusKeepsake from './CampusKeepsake.jsx';
import AiSummary from './AiSummary.jsx';
import ProfileExplanation from './ProfileExplanation.jsx';
import { MonoTag, ArchiveSectionHead } from './TermHead.jsx';
import { labelOf, QUESTIONS } from '../lib/surveySchema.js';
import GeometricBackdrop from './GeometricBackdrop.jsx';
import CampusFieldLog from './CampusFieldLog.jsx';
import DaySurveyConnection from './DaySurveyConnection.jsx';

import {useAccount} from '../lib/accounts.jsx';
import NavButton from './NavButton.jsx';
import { buildProfileCsv, makeProfileId, downloadText } from '../lib/exportProfile.js';
import { nextStepOf } from '../lib/nextStep.js';
import { downloadReportCard, reportIdentity } from '../lib/reportCard.js';
import './survey-guidance.css';

/** 插图路径统一走这里：换目录只改一行，且 base 路径交给 Vite（部署到子路径也不会 404）。 */
const ART = (f) => `${import.meta.env.BASE_URL}art/ark/${f}`;
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
export default function ReportView({
  answers,
  attributes,
  trail,
  baseline,
  name = '',
  quizSnapshot = null,
  onStartDay,
  onGoMap,
  onRestart,
  onBackToMap,
  submissionPanel,
  onGoStory,
  storyContext,
  onApplyAnswers,
  dayContext,
}) {
  const report = useMemo(
    () =>
      attributes
        ? buildReportFromAttributes(attributes, baseline, { answers: answers ?? null })
        : buildReport(answers, baseline),
    [answers, attributes, baseline],
  );
  // ★ 10-14 B+C 修 bug：原来是 `Boolean(attributes) && !answers`。
  //   问卷答完再去地图复测时，answers 还在（复测不清它），于是这个判断变成 false ——
  //   报告转而去读问卷答案、不读账本，「两次测量」也被关掉，整个复测链路断在这里。
  //   正确的判据只有一个：**App 有没有传 attributes**（它只在 mapRun 时传）。
  const fromMap = Boolean(attributes);
  const openDay = onStartDay || onGoMap;
  const closing = useMemo(() => buildClosing(pickKeyword(report.percents)), [report]);

  // 大模型成稿后由 AiSummary 回传，供「复制文字版」使用。
  // 在它成稿之前，用内置文案顶上 —— 让"复制"按钮从第一秒就可点，
  // 而且复制到的东西本来就是一份完整的、个性化的文案，不是空的。
  const [aiText, setAiText] = useState(null);

  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [cardState, setCardState] = useState('idle');
  const titleRef = useRef(null);
  const [exported, setExported] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setStep(4); return undefined; }
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
        ? ['', `我走过的路：${trail.filter((t) => t.at).map((t) => t.label).join(' → ')}`]
        : []),
      '',
      body,
      closing,
      '说明：基准为模拟人群；时间分配与四年曲线为规则推算，非实测或心理评估。',
    ];
    return lines.join('\n');
  }, [report, closing, aiText, name, fromMap, trail]);

  /**
   * ★ 10-17 新增：把这份档案导成一个文件，用户可以直接发到班群。
   * 这是「子端」的出口 —— 母端（管理员）收齐这些文件后导入，
   * 走的是与上传 CSV 完全相同的管线（见 exportProfile.js 的说明）。
   *
   * 只在问卷路径可用：地图路径没有 answers（只有一本累加的账），
   * 而档案文件里要写的是"这个人选了哪些选项"，账本给不出这个。
   */
  function exportProfile() {
    const id = makeProfileId();
    downloadText(`campus-insight-档案-${id}.csv`, buildProfileCsv(answers, { id }));
    setExported(true);
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setCopyFailed(false);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  }

  /**
   * 档案编号与时间（2026-10-17 美术重做新增）。
   *
   * ★ 编号是**从答案派生**的稳定 id，不是伪造的学号/学籍号：
   *   同一份答案永远得到同一个编号，换一份答案就不同。
   *   useMemo 依赖 answers/name，所以重渲染不会变；页面刷新才重新算。
   *   真实时间同理 —— 在首次渲染时定格，不会每帧跳。
   *
   * 为什么不用随机数：随机会让"同一份档案"每次刷新都换编号，
   * 那它就只是个装饰。派生 id 才有"这是这一份"的含义。
   */
  /* 2026-11-04 增：报告末给一条能马上做的事（记录者：3号 / WorkBuddy） */
  const nextStep = useMemo(() => nextStepOf(report.percents), [report.percents]);

  const meta = useMemo(() => {
    const now = new Date();
    const p2 = (n) => String(n).padStart(2, '0');
    return {
      id: reportIdentity(answers, attributes, name),
      time: `${now.getFullYear()}.${p2(now.getMonth() + 1)}.${p2(now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}`,
    };
  }, [answers, name, attributes]);

  /**
   * 称号字号：按字数分档。
   * 用户要求「桌面端 64–72px 作为初始范围，短称号更有冲击力，长称号必须避免溢出」。
   * 用 clamp 兜住小屏，再用字数分档兜住长标题 —— 两者职责不同，都要有。
   */
  const titleSize = useMemo(() => {
    const len = [...(report.facts.title || '')].length;
    if (len <= 5) return 'clamp(46px, 7.6vw, 72px)';
    if (len <= 8) return 'clamp(38px, 6.2vw, 62px)';
    if (len <= 12) return 'clamp(31px, 5.0vw, 52px)';
    return 'clamp(25px, 4.0vw, 42px)';
  }, [report.facts.title]);

  /** 章节索引：脊标下的刻度条，每一格是**可点的锚点**（不是装饰）。 */
  const sections = useMemo(
    () =>
      [
        ...((trail?.length ?? 0) > 0 ? ['这一轮你是怎么走的'] : []),
        '大学生活者画像',
        '时间去哪了',
        '四年心情曲线',
        '人群冷知识',
        '给你的话',
      ].map((title, index) => ({ n: index + 1, title })),
    [trail],
  );

  function scrollWithinReport(event) {
    // App owns location.hash for routes; report chapters must not replace that route.
    event.preventDefault();
    const destination = event.currentTarget.getAttribute('href');
    const target = destination?.startsWith('#') ? document.getElementById(destination.slice(1)) : null;
    if (!target) return;
    setStep(4);
    if (target.tagName === 'DETAILS') target.open = true;
    const focusTarget = target.id === 'archive-top'
      ? titleRef.current ?? target
      : target.querySelector('h2, h3, summary, button') ?? target;
    if (!focusTarget.matches('a[href], button, input, select, textarea, summary') && !focusTarget.hasAttribute('tabindex')) {
      focusTarget.setAttribute('tabindex', '-1');
    }
    focusTarget.setAttribute('data-report-scroll-focus', '');
    focusTarget.focus({ preventScroll: true });
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' });
  }

  return (
    <div className="archive" id="archive-top">
      {/* 页首天空窗：只占上方，mask 渐隐进纸面。全站那层 fixed 天空在本页被 :has() 关掉。 */}
      <div className="archive-sky" aria-hidden="true" />

      <div className="archive-grid">
        {/* ── 档案脊标 ────────────────────────────────────── */}
        <aside className="archive-spine" aria-label="档案元信息">
          <p className="archive-spine-kicker">STUDENT&nbsp;RECORD</p>
          <p className="archive-spine-id">{meta.id}</p>

          <div className="archive-spine-row">
            <span className="archive-spine-key">姓名</span>
            <span className="archive-spine-val">{name?.trim() || '未署名'}</span>
          </div>
          <div className="archive-spine-row">
            <span className="archive-spine-key">生成</span>
            <span className="archive-spine-val">{meta.time}</span>
          </div>
          <div className="archive-spine-row">
            <span className="archive-spine-key">来源</span>
            <span className="archive-spine-val">
              {fromMap ? `地图 ${trail?.filter((t) => t.at).length ?? 0} 步${answers ? ' + 问卷' : ''}` : `问卷 ${Object.keys(answers ?? {}).length} 题`}
            </span>
          </div>
          <div className="archive-spine-row">
            <span className="archive-spine-key">基准</span>
            <span className="archive-spine-val">2000 人模拟人群</span>
          </div>

          {/* 章节索引：刻度即目录。每一格可点，跳到对应章节 ——
              这是"原创符号系统"该有的样子：有稳定用途，不是角落里的装饰。 */}
          <nav className="archive-ticks" aria-label="章节索引">
            {sections.map((sec) => (
              <a
                key={sec.n}
                href={`#sec-${sec.n}`}
                onClick={scrollWithinReport}
                title={sec.title}
                aria-label={`跳到第 ${sec.n} 节：${sec.title}`}
                className={sec.n <= step + 1 ? 'is-long' : ''}
              >
                <i aria-hidden="true" /><span>{sec.title}</span>
              </a>
            ))}
          </nav>
        </aside>

        {/* ── 主栏 ────────────────────────────────────────── */}
        <article className="archive-main" aria-label="个人校园档案">
          <header className="archive-head">
            <p className="archive-head-kicker">{fromMap ? '行动档案已生成' : '十题已完成 · 个人档案已生成'}</p>
            <h1 ref={titleRef} tabIndex={-1} className="archive-title" style={{ fontSize: titleSize }}>
              你的校园，有迹可循。
            </h1>
            <p className="field-rule-title">规则趣味称号 · {report.facts.title}</p>
            <div className="archive-head-meta">
              <span>
                {fromMap
                  ? `由 ${trail?.filter((t) => t.at).length ?? 0} 步地图行动${answers ? `与 ${Object.keys(answers).length} 个答案` : ''}推算`
                  : `由 ${Object.keys(answers ?? {}).length} 个答案推算`}
              </span>
              <span aria-hidden="true">·</span>
              <span>基准为 2000 条模拟数据，非真实调查</span>
            </div>
            <p className="report-opening">{closing}</p>
            <section className="report-personal-reading" aria-label="基于本次回答的个人解读"><h2>这份回答里，看见了怎样的你？</h2>{fallbackText(report, { name }).split('\n\n').slice(0,2).map((text,index)=><p key={index}>{text}</p>)}<small>本地规则解读 · 与下方图表使用同一份回答 · 可继续查看每一道题的影响</small></section>
            <div className="report-highlights" aria-label="画像中数值较高的三项">
              {[...report.radar].sort((a,b) => b.value - a.value).slice(0,3).map((d) => <div key={d.key}><span>{d.axis}</span><b>{d.value}<small>百分位</small></b></div>)}
            </div>
            <div className="report-quick-actions" id="report-save-actions" aria-label="保存与分享报告">
              {submissionPanel && <a className="report-submit-shortcut" href="#report-submission" onClick={scrollWithinReport}>提交到我的圈子 <span aria-hidden="true">↓</span></a>}
              <button type="button" className="report-save-card" disabled={cardState === 'saving'} onClick={async () => {
                setCardState('saving');
                try { await downloadReportCard(report, { id: meta.id, closing }); setCardState('saved'); }
                catch { setCardState('error'); }
              }}>{cardState === 'saving' ? '正在生成…' : cardState === 'saved' ? '再次保存档案卡 ↓' : '保存我的档案卡 ↓'}</button>
              <button type="button" onClick={copyText}>{copied ? '已复制 ✓' : '复制文字版'}</button>
              <a href={trail?.length ? '#sec-2' : '#sec-1'} onClick={scrollWithinReport}>往下看记录与图表 <span aria-hidden="true">↓</span></a>
            </div>
            <div className="report-action-status" role="status">
              {copied && '已复制到剪贴板，可以粘贴到聊天或文档中。'}
              {cardState === 'saved' && '档案卡已生成，请在浏览器下载中查看。'}
              {cardState === 'error' && '图片未能生成，你仍然可以复制文字版或导出答题数据。'}
              {copyFailed && <>当前浏览器无法复制，<button type="button" onClick={() => downloadText(`campus-insight-${meta.id}.txt`, plainText, 'text/plain;charset=utf-8')}>下载文字版</button>。</>}
            </div>
          </header>

          {submissionPanel && <div id="report-submission" className="report-submission-target">{submissionPanel}</div>}
          <div className="report-user-guide report-user-guide-compact" aria-label="报告使用指引">
            <div className="survey-help-heading"><p className="survey-question-kicker">{submissionPanel ? '我的档案 · 自主决定是否提交' : fromMap ? '行动地图报告' : '个人报告 · 本机预览'}</p><button type="button" onClick={() => setShowGuide((visible) => !visible)} aria-expanded={showGuide} aria-controls="report-reading-help">{showGuide ? '收起说明' : '如何使用这份报告？'}</button></div>
            <div id="report-reading-help" hidden={!showGuide}><h2>报告已生成，下一步这样做</h2><p>{submissionPanel ? '想把这份答案交到圈子？点“提交到我的圈子”，选好圈子并确认共享即可，管理员本人也能提交。' : '先看图表和解释，喜欢的话可以保存为图片或复制文字。'}</p><p className="report-guide-note">{submissionPanel ? '只有勾选同意并确认提交后才会保存到圈子，提交成功会有明确提示。' : '生成个人报告不会把答卷交给管理员；在线解读的状态会在「给你的话」中说明。'}</p></div>
          </div>

      <DaySurveyConnection context={dayContext} answers={report.answers} />
      <details className="report-supporting-records">
        <summary>回看十个选择，留下一张纪念卡</summary>
        {onGoStory&&<JourneyContinuity context={storyContext} answers={answers} onGoStory={onGoStory} onStartDay={openDay} onGoMap={onGoMap} fromMap={fromMap}/>}
        <CampusFieldLog answers={report.answers} />
        <CampusKeepsake answers={report.answers} onSkip={scrollWithinReport} reportLink={trail?.length?'#sec-2':'#sec-1'} />
      </details>

      <div className="space-y-10">
        {trail?.length > 0 && (
          <details id="sec-1" className="archive-answer-trail">
            <summary>这一轮你是怎么走的 · 查看 {trail.length} 条记录</summary>
            <div className="pt-5"><ActionTrail trail={trail} answers={answers} /></div>
          </details>
        )}

        <Section
          n={trail?.length > 0 ? 2 : 1}
          show={step >= 1}
          title="大学生活者画像"
          hint="每个数字的意思是：你在模拟基准人群中的相对位置；用于理解这套回答，不代表真实大学生总体排名"
          art={ART('sec-profile.webp')}
        >
          <div className="archive-plate">
            <div className="archive-duo">
              <div>
                <RadarChart data={report.radar} />
              </div>
              <div className="archive-prose">
                <p className="mb-3">
                  这张网展示 {report.radar.length} 项特征的相对位置，由八项基础属性和一项派生属性中选取。
                  数值与 2000 条模拟记录比较，并列取中点，显示范围为 2–98；不是能力评分。
                </p>
                <p
                  className="archive-spine-kicker"
                  style={{ marginBottom: 8, letterSpacing: '0.24em' }}
                >
                  突出的三项
                </p>
                <ul className="space-y-1.5 mb-4" style={{ listStyle: 'none', paddingLeft: 0 }}>
                  {[...report.radar]
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 3)
                    .map((d) => (
                      <li
                        key={d.key ?? d.label}
                        className="flex items-baseline gap-3 tabular-nums"
                      >
                        <span style={{ color: 'var(--stamp)', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                          {String(d.value).padStart(2, '0')}
                        </span>
                        <span style={{ color: 'var(--ink-on-paper)', fontSize: 13.5 }}>
                          {labelOf(d.key)}
                        </span>
                      </li>
                    ))}
                </ul>
                <p style={{ fontSize: 12.5 }}>
                  统计由浏览器按映射矩阵与模拟基准本地计算。启用在线解读时，
                  仅发送作答与统计摘要生成文字，原始 CSV 文件不发送。
                </p>
              </div>
            </div>
          </div>
          <ProfileExplanation report={report} baseline={baseline} trail={trail} onApplyAnswers={fromMap ? undefined : onApplyAnswers} />
        </Section>

        <Section
          n={trail?.length > 0 ? 3 : 2}
          show={step >= 2}
          title="时间去哪了"
          hint="五类规则权重归一化为 100%，用于展示分配倾向；不是实际时长，也不是雷达图百分位的占比"
          art={ART('sec-time.webp')}
          boxed
        >
          <TimeDonut data={report.timeSplit} />
        </Section>

        <Section
          n={trail?.length > 0 ? 4 : 3}
          show={step >= 3}
          title="四年心情曲线"
          hint="不是分数，也不是实测 —— 按你的回答绘出的一条相对起伏的线"
          art={ART('sec-mood.webp')}
          boxed
        >
          <MoodCurve data={report.moodCurve} />
        </Section>

        <Section n={trail?.length > 0 ? 5 : 4} show={step >= 4} title="人群冷知识" art={ART('sec-facts.webp')}>
          <FactsCard facts={report.facts} />
        </Section>

        <Section
          n={trail?.length > 0 ? 6 : 5}
          show={step >= 4}
          title="给你的话"
          hint="解读基于上面的计算结果；具体生成方式见下方状态标记"
          art={ART('sec-closing.webp')}
        >
          <AiSummary report={report} name={name} onText={(text) => setAiText(text)} />
          {fromMap && quizSnapshot && (
            <DualMeasure quizSnapshot={quizSnapshot} baseline={baseline} current={report} />
          )}
          <div
            className="mt-5 pl-4 py-3 pr-3"
            style={{
              borderLeft: '3px solid var(--ark)',
              background:
                'linear-gradient(90deg, rgba(21,107,122,0.10), rgba(21,107,122,0) 72%)',
            }}
          >
            <p className="text-[17px] font-semibold leading-8" style={{ color: 'var(--ark-deep)' }}>
              {closing}
            </p>
          </div>
        </Section>
      </div>

      {openDay && (
        <div className="archive-map-extra mt-9 pt-5" style={{ borderTop: '1px solid var(--rule-strong)' }}>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
            <div className="flex-1" style={{ minWidth: 260 }}>
              <p className="text-[14px] font-semibold" style={{ color: 'var(--ink-on-paper)' }}>
                这份报告来自你的 {Object.keys(answers ?? {}).length} 个答案
              </p>
              <p
                className="text-[12.5px] mt-1.5 leading-[1.8]"
                style={{ color: 'var(--ink-on-paper-soft)', maxWidth: '56ch' }}
              >
                {dayContext
                  ? '回到刚才的「校园一天」情境地图，改一个决定并核对问卷变化，生成新的个人档案。'
                  : '进入「校园一天」情境地图做十个日常决定，行动会带出问卷建议，核对后统一更新个人档案。'}
              </p>
            </div>
            <button
              type="button"
              onClick={openDay}
              className="shrink-0 text-[13px] font-semibold"
              style={{
                color: 'var(--stamp)',
                borderBottom: '1px solid var(--stamp)',
                paddingBottom: 2,
                background: 'none',
              }}
            >
              安排我的校园一天 →
            </button>
          </div>
          {onGoMap && onStartDay && (
            <details className="mt-3 text-xs" style={{ color: 'var(--ink-on-paper-soft)' }}>
              <summary className="cursor-pointer">可选：打开自由行动账本（四时段地点探索，独立附加体验）</summary>
              <p className="mt-1.5 leading-5">
                自由行动账本使用四个时段地点累加属性，与十题情境问卷分属不同玩法。
                <button type="button" onClick={onGoMap} className="ml-2 underline" style={{ color: 'var(--ark-deep)' }}>
                  进入自由行动账本 →
                </button>
              </p>
            </details>
          )}
        </div>
      )}

      {nextStep && (
        <section className="report-next-step" aria-label="下一步建议">
          <p className="report-next-step-kicker">下一步 · 只做一件小事</p>
          <h2 className="report-next-step-title">你在「{nextStep.label}」上处在 {nextStep.value}% 的位置，不必补短板——先做这一件：</h2>
          <p className="report-next-step-text">{nextStep.text}</p>
          <p className="report-next-step-note">这条建议由五维里最低的一项推出，不构成评价；不想做可以换一件同类的小事。</p>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3 mt-12 pt-8 border-t border-[var(--line)]">
        <a href="#archive-top" className="report-back-top" onClick={scrollWithinReport}>回到档案顶部 ↑</a>

        {answers && (
          <button
            type="button"
            onClick={exportProfile}
            className="ci-lift border px-4 py-2.5 text-sm font-medium transition-colors"
            style={{
              borderColor: 'var(--ark-line)',
              color: 'var(--ark-deep)',
              background: 'rgba(255,255,255,0.9)',
            }}
            title="可选：下载自己的十题答案副本。在线填报请在本页核对并确认提交，无需传文件。"
          >
            {exported ? '已导出答题数据 ✓' : '导出答题数据 CSV'}
          </button>
        )}
        <button
          type="button"
          onClick={onRestart}
          className="ci-lift border bg-[var(--surface)] px-4 py-2.5 text-sm transition-colors"
          style={{ borderColor: 'var(--line-strong)', color: 'var(--ink-mid)' }}
        >
          再答一次
        </button>
        {(fromMap ? onBackToMap : openDay || onBackToMap) && (
          <NavButton
            onClick={fromMap ? onBackToMap : (openDay || onBackToMap)}
            icon="←"
            title={fromMap ? '回到自由行动账本' : '回到校园一天情境地图'}
          >
            {fromMap ? '回到行动账本' : '回到校园一天'}
          </NavButton>
        )}
        <span className="text-xs text-[var(--ink-soft)]">
          换个答案，报告的走向会完全不同
        </span>
      </div>
        </article>
      </div>
    </div>
  );
}

function Section({ n, show, title, hint, children, boxed = false, art = null }) {
  return (
    <section
      className="transition-all duration-500 ease-out"
      style={{ opacity: show ? 1 : 0, transform: show ? 'none' : 'translateY(14px)' }}
    >
      <ArchiveSectionHead index={n} title={title} hint={hint} />
      {boxed ? <div className="archive-plate">{children}</div> : children}
    </section>
  );
}

function Crest() {
  const ARK = '#156b7a';
  const ARK_DEEP = '#0b5a6b';
  const WARM = '#b45309';
  return (
    <svg width="88" height="88" viewBox="0 0 120 120" role="img" aria-label="终端纹章">
      <title>终端纹章</title>
      <defs>
        <radialGradient id="crest-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={ARK} stopOpacity="0.20" />
          <stop offset="55%" stopColor={ARK} stopOpacity="0.07" />
          <stop offset="100%" stopColor={ARK} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="58" fill="url(#crest-glow)" />
      <circle
        cx="60"
        cy="60"
        r="44"
        fill="none"
        stroke={ARK}
        strokeWidth="0.6"
        opacity="0.28"
      />
      <circle
        cx="60"
        cy="60"
        r="54"
        fill="none"
        stroke={ARK}
        strokeWidth="0.8"
        strokeDasharray="2 5"
        opacity="0.4"
      />
      <polygon
        points="60,4 108,32 108,88 60,116 12,88 12,32"
        fill="none"
        stroke={ARK}
        strokeWidth="1"
        opacity="0.5"
      />
      <polygon
        points="60,20 96,40 96,80 60,100 24,80 24,40"
        fill="none"
        stroke={ARK_DEEP}
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
          stroke={ARK}
          strokeWidth="1"
          opacity="0.55"
          transform={`rotate(${deg} 60 60)`}
        />
      ))}
      <polygon points="60,46 74,60 60,74 46,60" fill={WARM} opacity="0.9" />
    </svg>
  );
}

function ActionTrail({ trail, answers }) {
  return (
    <ol className="relative pl-6 space-y-3">
      <span
        className="absolute left-[7px] top-2 bottom-2 w-px"
        style={{ background: 'var(--line)' }}
        aria-hidden="true"
      />
      {trail.map((t, i) => {
        const fromMapPath = Boolean(t.at);
        const tag = fromMapPath ? '地图' : '问卷';
        const question = !fromMapPath && QUESTIONS.find(q => t.id?.startsWith(`${q.field}=`) || q.text === t.label);
        const answer = question && answers?.[question.field];
        return (
          <li key={`${t.id}-${i}`} className="relative">
            <span
              className="absolute -left-6 top-[5px] inline-block w-[15px] h-[15px] rounded-full border-2"
              style={{
                borderColor: fromMapPath ? 'var(--accent-warm)' : 'var(--ark)',
                background: fromMapPath ? 'var(--accent-warm)' : 'var(--surface)',
              }}
              aria-hidden="true"
            />
            <p className="text-sm text-[var(--ink)] leading-6 flex flex-wrap items-baseline gap-x-2">
              <span className="text-xs text-[var(--ink-soft)] mr-1 tabular-nums">{i + 1}</span>
              <span
                className="term-mono text-[10px] px-1.5 py-[1px] shrink-0"
                style={{
                  color: fromMapPath ? 'var(--accent-warm-deep)' : 'var(--ark)',
                  border: `1px solid ${fromMapPath ? 'rgba(180,83,9,.35)' : 'var(--ark-line)'}`,
                  background: fromMapPath ? 'rgba(180,83,9,.07)' : 'var(--ark-wash)',
                }}
              >
                {tag}
              </span>
              <span>{t.label}{answer && <strong className="block font-medium" style={{ color: 'var(--ark-deep)' }}>你的选择：{answer}</strong>}</span>
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function DualMeasure({ quizSnapshot, baseline, current }) {
  const quizReport = useMemo(
    () => buildReportFromAttributes(quizSnapshot, baseline, { answers: null }),
    [quizSnapshot, baseline],
  );

  const rows = useMemo(() => {
    const quizMap = {};
    for (const d of quizReport.radar) quizMap[d.key] = d.value;
    return current.radar.map((d) => ({
      key: d.key,
      axis: d.axis,
      quiz: quizMap[d.key],
      now: d.value,
      diff: d.value - quizMap[d.key],
    }));
  }, [quizReport, current]);

  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.diff)));

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="ci-chip ci-chip-accent">探索前后</span>
        <span className="text-sm font-medium" style={{ color: 'var(--ink-strong)' }}>
          同一份档案，行动带来了什么变化
        </span>
      </div>

      <dl className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.key} className="flex items-baseline gap-3">
            <dt className="w-16 shrink-0 text-xs" style={{ color: 'var(--ink-mid)' }}>
              {r.axis}
            </dt>
            <dd className="flex-1 flex items-baseline gap-2">
              <span className="ci-num text-sm font-semibold w-8 text-right" style={{ color: 'var(--ink-mid)' }}>
                {r.quiz}
              </span>
              <span className="text-xs" style={{ color: 'var(--ink-dim)' }}>→</span>
              <span className="ci-num text-sm font-semibold w-8" style={{ color: 'var(--ark-deep)' }}>
                {r.now}
              </span>
              <span className="flex-1 flex items-center gap-2">
                <span className="relative h-[6px] flex-1" style={{ background: 'var(--line-soft)' }}>
                  <span
                    className="absolute top-0 bottom-0"
                    style={{
                      left: r.diff >= 0 ? '50%' : `${50 - (Math.abs(r.diff) / maxAbs) * 50}%`,
                      width: `${(Math.abs(r.diff) / maxAbs) * 50}%`,
                      background: r.diff >= 0 ? 'var(--ark)' : 'var(--accent-warm)',
                    }}
                  />
                  <span className="absolute left-1/2 top-[-2px] bottom-[-2px] w-px" style={{ background: 'var(--line-strong)' }} />
                </span>
                <span
                  className="ci-num text-[11px] w-9 shrink-0 text-right"
                  style={{ color: r.diff === 0 ? 'var(--ink-dim)' : r.diff > 0 ? 'var(--ark)' : 'var(--accent-warm)' }}
                >
                  {r.diff > 0 ? `+${r.diff}` : r.diff}
                </span>
              </span>
            </dd>
          </div>
        ))}
      </dl>

      <p className="text-xs leading-5 mt-3" style={{ color: 'var(--ink-dim)' }}>
        左边来自问卷，右边是在问卷基础上叠加地图行动后的结果。
        差值展示规则下的变化，不是两次独立测量，也不用于验证答案是否正确。
      </p>
    </div>
  );
}
