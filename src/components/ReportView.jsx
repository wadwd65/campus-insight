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
  const [showGuide, setShowGuide] = useState(true);

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
          <div className="report-user-guide" aria-label="报告使用指引">
            <div className="survey-help-heading"><p className="survey-question-kicker">{submissionPanel ? '我的档案 · 可提交到圈子' : fromMap ? '行动地图报告' : '个人报告 · 本机预览'}</p><button type="button" onClick={() => setShowGuide((visible) => !visible)} aria-expanded={showGuide} aria-controls="report-reading-help">{showGuide ? '跳过说明' : '查看使用说明'}</button></div>
            <div id="report-reading-help" hidden={!showGuide}><h2>报告已生成，下一步这样做</h2><p>{submissionPanel ? '想把这份答案交到圈子？直接点下方“提交到我的圈子”，选好圈子并确认共享即可，管理员本人也能提交。' : '这是你本次留下的校园生活记录。先看图表和解释，喜欢的话可以保存为图片或复制文字。'}</p><p className="report-guide-note">{submissionPanel ? '只有勾选同意并确认提交后才会保存到圈子，提交成功会有明确提示。' : '生成个人报告不会把答卷交给管理员；在线 AI 解读是单独的服务，状态会在「给你的话」中说明。'}</p></div>
            <div className="report-guide-links"><a href={submissionPanel ? '#report-submission' : trail?.length ? '#sec-2' : '#sec-1'} onClick={scrollWithinReport}>{submissionPanel ? '查看填报与提交状态' : '先看我的行迹'} <span aria-hidden="true">↓</span></a><a href="#report-save-actions" onClick={scrollWithinReport}>保存或复制报告 <span aria-hidden="true">↓</span></a></div>
          </div>
          {submissionPanel && <div id="report-submission" className="report-submission-target">{submissionPanel}</div>}
          {onGoStory&&<JourneyContinuity context={storyContext} answers={answers} onGoStory={onGoStory} onGoMap={onGoMap} fromMap={fromMap}/>}
          <header className="archive-head">
            <p className="archive-head-kicker">校园行迹&nbsp;/&nbsp;CAMPUS FIELD NOTES</p>
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

      <DaySurveyConnection context={dayContext} answers={report.answers} />
      <CampusFieldLog answers={report.answers} />
      <CampusKeepsake answers={report.answers} onSkip={scrollWithinReport} reportLink={trail?.length?'#sec-2':'#sec-1'} />

      <div className="space-y-10">
        {/* ★ 10-14 B+C（B3）：这一块**两种路径都有**。
            问卷的每一题也会 applyChoice 进账本（见 App.finishQuiz），
            所以 trail 里本来就躺着 10 条作答记录 —— 以前只有地图路径才显示，
            于是问卷玩家答完 10 题，报告里却看不到自己答过什么，两个玩法互相看不见。
            现在合成一条时间线，并用来源标签把"这是你选的"和"这是你走的"分开。 */}
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
          {/* ★ 10-17 美术返工：原来是"雷达图独占一块图版"。
              用户要求「雷达图与解释文字采用有明确关系的并置布局」——
              图解释不了自己，必须有人给它一句话。
              ★ 右侧那段**不是编的**：前三项由 report.radar 现算排序得出，
                数字就是图上那几个值；口径说明也是既有事实（映射矩阵 + 百分位）。 */}
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

        {/* ★ 10-13 审查补注（任务书 P2#7）：时间分配与四年曲线都由百分位经固定公式
            "估算"出来，属于叙事性推导，不是实测记录 —— 以前这两处都没说，读者容易
            把环形图上的百分比当成"他真的这样分配时间"。这里把口径写在标题下方。 */}
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
          {/* ★ B+C（C3）：两次测量对比。
              只在地图路径 + 有问卷快照时出现 —— 也就是"答完题又去走了地图"。
              它把两个玩法从"并列的两个入口"变成"同一件事的两次测量"：
              一致 → "两种走法得出了同一个你"；不一致 → 本身就是有意思的结论，
              而且这里必须说清"不一致不代表谁错了"（口径见下方说明）。 */}
          {fromMap && quizSnapshot && (
            <DualMeasure quizSnapshot={quizSnapshot} baseline={baseline} current={report} />
          )}
          {/* ★ 10-14 美化：结尾这句是全页最可能被截图的一句话，
              原来它只是一行 16px 的琥珀色字，混在正文里。
              现在给它一整个引用块：左侧琥珀竖线 + 极淡的琥珀渐变底 +
              字号提到 17px。它读起来像"被框起来的一句话"，而不是又一段正文。 */}
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

      {onGoMap && (
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
                用行动地图安排四个时段。地点选择会叠加到这份问卷画像上，
                回来可以对比探索前后的变化。
              </p>
            </div>
            <button
              type="button"
              onClick={onGoMap}
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
        </div>
      )}

      {/* ★ 10-14 美化：三个按钮原来是"一个实心紫 + 两个白描边"，
          三个长得差不多、主次不清。现在：
            主按钮 = 渐变实底 + 品牌色投影（明确"点这里"）
            次按钮 = 白底 + 描边 + 悬停抬起（明确"也可以点这里"）
            三级（回地图）= 只留文字，不加框 —— 它是"离开"，不该抢主按钮 */}
      <div className="flex flex-wrap items-center gap-3 mt-12 pt-8 border-t border-[var(--line)]">
        <a href="#archive-top" className="report-back-top" onClick={scrollWithinReport}>回到档案顶部 ↑</a>

        {/* ★ 10-17：子端的出口。只在问卷路径出现（地图路径没有 answers）。
            它比"复制文字版"更重要 —— 复制出去是一段话，导出出去是一份
            **能被别人汇总的数据**，这是"班级画像"这条链路的起点。 */}
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
        {/* 回地图。改版后地图是主界面，报告是它的一个产出 ——
            所以"看完这份报告"的默认去向是回地图，而不是重来一遍。
            没有这个出口，玩家看完报告就只能关掉页面（或按浏览器的后退键）。 */}
        {onBackToMap && (
          <NavButton onClick={onBackToMap} icon="←" title="回到行动地图">
            回到地图
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

/**
 * @param {boolean} [boxed] 把内容装进一张卡片。
 *   ★ 10-14 美化：原来三张图是直接铺在页面底色上的，
 *     图表和正文用的是**同一个背景**，读者看不出"这里是一张图"。
 *     装进卡片之后，图有了自己的面，页面才有"标题→图→标题→图"的节奏。
 *     纯文字块（冷知识、给你的话）不加框 —— 它们本来就是正文的一部分。
 */
function Section({ n, show, title, hint, children, boxed = false, art = null }) {
  return (
    <section
      className="transition-all duration-500 ease-out"
      style={{ opacity: show ? 1 : 0, transform: show ? 'none' : 'translateY(14px)' }}
    >
      <ArchiveSectionHead index={n} title={title} hint={hint} />
      {/* ★ 10-17：`boxed` 原来是 TermBlock（白底圆角卡片）。
          在纸面上再套一张白卡，等于把"模板"换个颜色继续用 —— 用户明令禁止。
          改成 archive-plate：无圆角、无阴影，只有上下细线与极薄的纸色加深，
          读作"一块印刷图版"，而不是"一张卡片"。 */}
      {boxed ? <div className="archive-plate">{children}</div> : children}
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
  // ★ 10-14：纹章的配色也换到蓝紫家族（众生行记主色）。
  // 原来外环青、内核琥珀，是两套色；现在统一成"一个主色的两个深浅"，
  // 中心菱形仍是暖色 —— 全页唯一允许出现琥珀的地方，作为"结果出来了"的落点。
  const ARK = '#156b7a';
  const ARK_DEEP = '#0b5a6b';
  const WARM = '#b45309';
  return (
    <svg width="88" height="88" viewBox="0 0 120 120" role="img" aria-label="终端纹章">
      <title>终端纹章</title>
      {/* ★ 10-14 美化：垫一层径向光晕（中间琥珀、向外透明）。
          原来纹章是浮在白纸上的一组细线，现在是"一个有光的东西" ——
          代价只是两个 circle + 一个 radialGradient，不引入图片也不做动画。 */}
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
      {/* ★ 10-14：外圈再加一道制图式虚线圆 ——
          工程制图里虚线表示"参考/辅助"，它让纹章从"一个标志"变成"一张图上的一个基准" */}
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
function ActionTrail({ trail, answers }) {
  return (
    <ol className="relative pl-6 space-y-3">
      {/* 竖线：用绝对定位的一条线串起所有节点，比给每个 li 画边框稳 */}
      <span
        className="absolute left-[7px] top-2 bottom-2 w-px"
        style={{ background: 'var(--line)' }}
        aria-hidden="true"
      />
      {trail.map((t, i) => {
        // ★ 10-14 B+C：区分来源。地图行动带时间戳（at），问卷作答不带 ——
        //   这是两个路径在账本里唯一可靠的差别，比按 id 猜稳健。
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
              {/* 来源徽标：让"这是你选的"和"这是你走的"在一行里就分得清 */}
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

/**
 * ★ B+C（C3）两次测量对比 —— 这是把问卷与地图粘起来的关键一块。
 *
 * 它存在的理由：两个玩法以前是**并列的两个入口**，答完问卷出报告、
 * 走完地图也出报告，玩家没有任何契机意识到"这俩量的是同一个人"。
 * 现在地图的增量叠在问卷算出的属性上，于是可以并排问一句：
 * 「用答题的方式量出来的你」和「用脚走出来的你」，是不是同一个？
 *
 * 三条设计约束：
 *   ① **不复用 percentileOf 自己算** —— 直接调 buildReportFromAttributes，
 *      保证两边走的是同一条归一化路径（否则对比出的差是口径差，不是行为差）。
 *   ② **不一致不能说成"你答错了"**。两种测量本来就该有差异：
 *      答题是"你觉得自己是什么样"，地图是"你实际选择了什么"。
 *      差异本身是结论，不是错误 —— 这句话必须写在界面上，否则用户会以为出了 bug。
 *   ③ 差值用 ± 与颜色区分方向，但**不做过度的红绿**（本作的约定见 regional_conventions：
 *      涨红跌绿是股市约定，这里是行为数据，用主色/暖色区分更贴合作品气质）。
 */
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

  // 最大绝对差：用来把差条归一化到同一长度，否则大差值会把小差值压成一条线
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
              {/* 差条：从中线向两侧长，长度按最大差归一化 */}
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
