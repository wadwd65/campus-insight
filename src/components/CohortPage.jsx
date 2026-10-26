/**
 * 群体画像页（任务 T-22）—— 真入口的结果页。
 *
 * 和快入口的结果页刻意长得不像：那边是「这就是我」，叙事优先；这边是「这个班什么样」，
 * 结论优先。所以这里开头就是一句可以直接念出来的话，然后才是图。
 * 教师拿到的第一样东西应该是结论，不是一张需要自己读的图。
 *
 * 三块内容各自回答一个问题：
 *   雷达图   —— 这个班整体偏哪边，偏多少？（中位数 vs 50 分位基准圈）
 *   类型分布 —— 这群人大概分成几类，哪类最多？
 *   最像的人 —— 这个班里，谁和我最接近？（需要先答过快入口）
 */

import { useMemo, useState } from 'react';
import Chart from './Chart.jsx';
import RadarChart from './RadarChart.jsx';
import { buildCohort, cohortHeadline } from '../lib/cohort.js';
import { BRAND, INK_SOFT, FONT, AXIS_LABEL_STYLE } from '../lib/theme.js';
import TermPanel from './TermPanel.jsx';
import { MonoTag, SectionHead } from './TermHead.jsx';
import CohortAi from './CohortAi.jsx';
import { TERM_INK, monoTag, sectionIndex } from '../lib/surface.js';
import { downloadText } from '../lib/exportProfile.js';
import { buildCohortExport } from '../lib/cohortSummary.js';
import AnswerLens from './AnswerLens.jsx';
import { THRESHOLDS } from '../lib/thresholds.js';
import './cohort-reading.css';

export default function CohortPage({ records, baseline, ownAnswers, onGoQuiz, onRestart, onUpload, source = 'csv' }) {
  const [downloaded, setDownloaded] = useState(false);
  const cohort = useMemo(
    () => buildCohort(records, baseline, ownAnswers),
    [records, baseline, ownAnswers],
  );
  const headline = useMemo(() => cohortHeadline(cohort), [cohort]);
  const canSummarize = cohort.size >= THRESHOLDS.minRecordsForCohort;
  const sourceLabel = source === 'sample' ? '合成示例 · 非真实调查' : source === 'circle' ? '圈子答卷 · 仅已提交成员' : '导入文件 · 当前有效答卷';
  const scopeNote = source === 'sample'
    ? `这 ${cohort.size} 份答卷是为演示生成的合成数据，用来体验统计功能，不代表任何真实班级。`
    : source === 'circle'
      ? `本次只统计本圈 ${cohort.size} 份已提交的有效答卷，每人取最新一份；未提交的成员不在统计内，不能据此概括整个圈子或班级。`
      : `本次只统计你导入文件中的 ${cohort.size} 份有效答卷。数据是否来自真实调查取决于文件；示例文件中的答卷为合成数据。`;

  function downloadSummary() {
    const summary = [
      `数据来源：${sourceLabel}`,
      `统计范围：${scopeNote}`,
      '画像比较基准为模拟记录；本摘要不能代表整个班级或真实大学生总体。',
      '',
      buildCohortExport(cohort),
    ].join('\n');
    downloadText('campus-insight-班级统计摘要.txt', summary, 'text/plain;charset=utf-8');
    setDownloaded(true);
  }

  return (
    <div className="cohort-page data-surface max-w-3xl mx-auto">
      {/* 状态行 —— 与报告页的 `REPORT // GENERATED` 同句式，让"这是另一份档案"一眼成立 */}
      <div className="flex items-baseline justify-between gap-3 mb-6">
        <MonoTag>COHORT // COMPUTED</MonoTag>
        <MonoTag>{cohort.size} 人 · 5 维</MonoTag>
      </div>

      <div className="cohort-overview mb-10">
        <SectionHead
          index={1}
          level={1}
          title={`${cohort.size} 份答卷，看看大家怎样选择`}
          hint="先看分布，再理解每一位同学的不同"
        />
        <div className={`cohort-reading-scope ${source === 'sample' ? 'is-sample' : ''}`} role="note" aria-label="数据来源与统计范围">
          <strong>{sourceLabel}</strong>
          <p>{scopeNote}</p>
          <p className="cohort-reading-purpose">先看十题的选择人数，再看规则计算的生活倾向。活动安排前，仍需向同学确认意愿。</p>
        </div>
        {headline && (
          <p
            className="cohort-headline text-[17px] leading-8 text-[var(--ink)] mt-3"
            style={{
              borderLeft: '3px solid var(--ark)',
              paddingLeft: '1rem',
              paddingTop: '0.6rem',
              paddingBottom: '0.6rem',
              background: 'linear-gradient(90deg, rgba(21,107,122,.10), rgba(21,107,122,0) 72%)',
            }}
          >
            {headline}
          </p>
        )}

        {/* ★ 10-08：三个关键数字先摆出来（结论优先的视觉化）——
            教师扫一眼就能记住的三件事：多少人、最多是哪类、分歧在哪。 */}
        {/* ★ 10-17：三个 KPI 从"三个等权方块"改成"一主两次"。
            原来三张一样大，扫一眼分不清哪个是重点；而"这个班有 48 人"
            是唯一决定下面所有图表意义的数字，它该占主位。
            主导占 2 列、数字放大；两个次级竖排在第 3 列。 */}
        <div className={`cohort-kpis ${canSummarize ? '' : 'is-limited'}`}>
            <Kpi label="有效答卷" value={cohort.size} unit="份" hero />
            {canSummarize && <>
            <Kpi
              label="最多的一类"
              value={cohort.most.name}
              unit={`${cohort.most.count} 人 · ${cohort.most.pct}%`}
              accent
            />
            <Kpi
              label={cohort.divergent ? '分歧最大' : '分歧比较'}
              value={cohort.divergent ? cohort.divergent.axis : '暂不比较'}
              unit={cohort.divergent ? `一半人落在 ${cohort.divergent.q1}~${cohort.divergent.q3}` : `至少 ${THRESHOLDS.minRecordsForDivergence} 份才展示分歧`}
            />
            </>}
        </div>
        {!canSummarize && <div className="cohort-small-sample" role="status"><strong>答卷还比较少，先看具体选择</strong><p>目前 {cohort.size} 份有效答卷，少于 {THRESHOLDS.minRecordsForCohort} 份。暂不展示群体画像、类型结论和 AI 解读；你仍能查看、导出下面的十题人数统计。</p><p>{source === 'circle' ? '可以先返回圈子继续邀请成员，收到更多答卷后再查看汇总。' : '可以补充更多答卷后重新导入。'}</p></div>}
        <div className="cohort-toolbar">{canSummarize && <button type="button" onClick={downloadSummary}>下载统计摘要 ↓</button>}{onUpload && <button type="button" onClick={onUpload}>{source === 'circle' ? '返回圈子 →' : source === 'sample' ? '试试导入自己的数据 →' : '换一份 CSV →'}</button>}<span role="status">{downloaded ? '已生成含数据来源与统计范围的摘要，请在下载中查看。' : canSummarize ? '统计摘要仅含群体数据，不包含个人作答。' : '下方可导出逐题统计，不包含个人作答记录。'}</span></div>
      </div>

      <div className="space-y-12">
        <Section n={2} title={source === 'sample' ? '看看示例答卷怎样选择' : '回到大家真实的选择'} hint={source === 'circle' ? '逐题查看本圈已提交答卷的人数与占比；每人使用最新一份，不包含未提交者。' : source === 'sample' ? '直接统计合成答卷的选项人数，不经过属性映射；示例不代表真实调查。' : '逐题查看当前文件中的作答人数与占比，不经过属性映射。示例文件中的作答仍为模拟数据。'}>
          <AnswerLens records={records} sourceLabel={source === 'circle' ? '本圈已提交答卷' : source === 'sample' ? '合成示例答卷' : '当前文件'} />
        </Section>

        {canSummarize && <>
        <Section
          n={3}
          title="这个班的位置"
          hint="实线是班内个体百分位的中位数；虚线为模拟基准的第 50 百分位。与个人报告使用同一标尺，不代表真实大学生总体。"
        >
          <RadarChart
            data={cohort.axes.map((a) => ({ key: a.key, axis: a.axis, value: a.median }))}
            compare={{ value: 50, name: '模拟基准第 50 百分位' }}
            name="这个班的中位数"
          />
          <ul className="mt-4 space-y-1.5">
            {cohort.axes.map((a) => (
              <li key={a.key} className="flex items-baseline gap-3 text-sm">
                <span className="w-20 shrink-0 text-[var(--ink-soft)]">{a.axis}</span>
                <span
                  className="ci-num text-[15px] font-semibold"
                  style={{ color: BRAND, minWidth: 28, display: 'inline-block' }}
                >
                  {a.median}
                </span>
                <span className="text-xs text-[var(--ink-soft)] tabular-nums">
                  一半人落在 {a.q1}~{a.q3} · 最低 {a.min} 最高 {a.max}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section n={4} title="这个班分成几类" hint="按每个人最突出的那一维归组，一个人只会进一个组">
          <GroupBars groups={cohort.groups} size={cohort.size} />
          <ul className="mt-3 space-y-1">
            {cohort.groups.map((g) => (
              <li key={g.key} className="text-xs text-[var(--ink-soft)]">
                <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ background: g.color }} />
                {g.name} —— {g.desc}
              </li>
            ))}
          </ul>
        </Section>

        {/* ★ 10-08：大模型解读 —— 官方链路三段里的第三段（数据 → 图表 → 解读）。
            放在"结论"之后，因为它就是这份数据的人话版结论。 */}
        <Section
          n={5}
          title="这份数据说了什么"
          hint="先解释分组与差异，再给出需要向同学核实的建议。解读来源会在正文前明确标注。"
        >
          <CohortAi cohort={cohort} />
        </Section>


        {source !== 'circle' && <Section n={6} title="班里和你最像的人" hint="按八项基础属性算距离，派生维度不重复计权。需要一份你的作答做参照。">
          {cohort.similar ? (
            <div className="space-y-2">
              {cohort.similar.top.map((s, i) => (
                <TermPanel key={s.id} hoverable style={{ padding: '12px 16px' }}>
                  <div className="flex items-center gap-3">
                    <span style={monoTag({ color: 'var(--ink-soft)', fontSize: 11 })}>{sectionIndex(i + 1)}</span>
                    <span className="text-sm text-[var(--ink)] flex-1">{s.id}</span>
                    <span className="text-xs text-[var(--ink-soft)]">{s.groupName}</span>
                    <span className="text-xs font-medium" style={{ color: BRAND }}>
                      {s.level}
                    </span>
                  </div>
                </TermPanel>
              ))}
              {/* ★ 10-14 审查（任务书 P4#7）：原句「你自己的类型是「X」那一种。」
                  读起来像在给人贴标签。这里补上归类规则 —— 它是**按最突出的那一维**
                  做的规则分组，不是人格分类，也不代表"你就是这一类人"。 */}
              <p className="text-xs text-[var(--ink-soft)] pt-1 leading-5">
                按最突出的那一维归类，你落在「{cohort.similar.mineGroup}」——
                这只是一种便于对照的规则分组，不是给你下定义。
              </p>
            </div>
          ) : (
            <TermPanel style={{ padding: '18px 20px' }}>
              <p className="text-sm text-[var(--ink)] leading-6 mb-3">
                要先有一份「你的」作答，才能算出谁和你最像 —— 这也正是两个入口的交点：
                <br />
                十个选择题，答案会和班里每个人的答案逐一对上距离。
              </p>
              <button
                type="button"
                onClick={onGoQuiz}
                className="px-4 py-2 text-sm text-white transition hover:opacity-90"
                style={{ background: 'var(--grad-ark)', boxShadow: 'var(--shadow-ark)' }}
              >
                先答完一轮，再回来看
              </button>
            </TermPanel>
          )}
        </Section>}
        </>}

        <details className="text-xs text-[var(--ink-soft)] leading-6">
          <summary className="cursor-pointer">这张图是怎么算出来的</summary>
          <div className="mt-3 space-y-2">
            <p>
              每份有效答卷都走与基准人群完全相同的路径：每道题 → 八个基础属性与一个派生属性 → 与模拟基准比对 → 百分位。
              所以「班里学术力中位数 62」和某位同学自己报告里的「学术力 82」是同一个标尺，可以直接比。
            </p>
            <p>
              这里展示每份答卷百分位的中位数，即这批答卷排序后的中间位置。
              它通常较少受少数极端值影响，但不等于平均分，也不能说明大多数人的具体行为。
            </p>
            <p>
              {source === 'circle' ? '本页作答来自圈内成员主动提交的答卷；百分位仍与模拟基准比较。' : source === 'sample' ? '本页答卷全部为合成示例，并非真实调查；所有百分位仍与模拟基准比较。' : '示例班级问卷是模拟生成的数据，不是真实调查结果。你上传自己的数据时，班级作答来自你的文件；百分位仍与这套模拟基准比较。'}
            </p>
          </div>
        </details>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-12 pt-8 border-t border-[var(--line)]">
        <button
          type="button"
          onClick={onRestart}
          className="border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--ink)] transition hover:border-slate-300"
        >
          {source === 'circle' ? '返回圈子' : '回到首页'}
        </button>
        <span className="text-xs text-[var(--ink-soft)]">
          {source === 'circle' ? '成员更新答卷后，返回圈子刷新即可重新汇总。' : source === 'sample' ? '示例用于体验流程；可以返回后导入自己的答卷。' : '可以换一份 CSV，查看另一批有效答卷的分布。'}
        </span>
      </div>
    </div>
  );
}

function Section({ n, title, hint, children }) {
  return (
    <section>
      <SectionHead index={n} level={2} title={title} hint={hint} />
      {children}
    </section>
  );
}

/**
 * 把颜色往白色里混一点（0 = 原色，1 = 纯白）。
 * 条形图末端要变浅，而这一组色是 cohort.js 里给死的十六进制，
 * 这里就地算一个浅版，不去动那边的数据。
 */
function mixWhite(hex, amount) {
  const m = /^#?([\da-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.round(v + (255 - v) * amount),
  );
  return `rgb(${ch[0]}, ${ch[1]}, ${ch[2]})`;
}

/** 类型分布条形图。用条形而不是饼：五类的占比要能直接比长短，饼里比角度要费劲得多。 */
function GroupBars({ groups, size }) {
  const option = useMemo(() => {
    const shown = [...groups].reverse(); // ECharts 的类目轴自下而上，反向之后第一名在最上面
    const total = size || 1;
    return {
      grid: { left: 76, right: 56, top: 8, bottom: 8 },
      tooltip: {
        trigger: 'item',
        formatter: (p) => {
          const g = shown[p.dataIndex];
          return `${g.name}：${g.count} 人（${g.pct}%）`;
        },
        textStyle: { fontFamily: FONT, fontSize: 12 },
      },
      xAxis: {
        type: 'value',
        max: total,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'category',
        data: shown.map((g) => g.name),
        axisLabel: AXIS_LABEL_STYLE,
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          barWidth: 16,
          data: shown.map((g) => ({
            value: g.count,
            itemStyle: {
              borderRadius: [0, 4, 4, 0],
              // 每一根条从"本色"渐变到"本色混白"。不只是好看：
              // 长条和短条在末端都变浅，视觉上不会像纯色块那样"顶到头"。
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 1, y2: 0,
                colorStops: [
                  { offset: 0, color: g.color },
                  { offset: 1, color: mixWhite(g.color, 0.4) },
                ],
              },
            },
          })),
          label: {
            show: true,
            position: 'right',
            formatter: (p) => `${p.value} 人 · ${Math.round((p.value / total) * 1000) / 10}%`,
            ...AXIS_LABEL_STYLE,
          },
        },
      ],
    };
  }, [groups, size]);

  return <Chart option={option} height={190} ariaLabel="班级类型分布条形图" />;
}

/**
 * 结论优先的三个关键数字：一个标签 + 一个值 + 一行单位说明。
 *
 * ★★ 10-14 二次修（**看图才发现**）：value 不一定是数字。
 *   「最多的一类」的值是「学术型」，「分歧最大」的值是「社交力」——
 *   四字中文在 26px 下几乎占满 216px 的卡宽，单位「12 人 · 25%」被一路
 *   挤到右边缘、几乎贴上边框。现在按值分档：
 *     数字 → 26px 大号 + 单位同行
 *     中文 → 20px + **单位换到下一行**，两者不再抢同一行宽度
 */
function Kpi({ label, value, unit, accent = false, hero = false }) {
  const isText = typeof value === 'string' && !/^\d+(\.\d+)?$/.test(value);

  return (
    <TermPanel
      className={`cohort-kpi${hero ? ' cohort-kpi-hero' : ''}`}
      tick={accent ? 'accent' : null}
      lift
      style={{ padding: '14px 15px 12px' }}
    >
      <p
        className="term-mono text-[11px] tracking-[0.16em]"
        style={{ color: 'var(--ink-dim)' }}
      >
        {label}
      </p>
      <p className={hero ? 'mt-1' : 'mt-2'} title={String(value)}>
        <span
          className={
            isText
              ? 'block leading-tight font-semibold'
              : hero
                ? 'ci-stat ci-num block leading-tight'
                : 'ci-stat ci-num block leading-tight'
          }
          style={
            isText
              ? { fontSize: hero ? 26 : 20, letterSpacing: '-0.01em', color: accent ? BRAND : 'var(--ink-strong)' }
              : { fontSize: hero ? 64 : undefined, color: accent ? BRAND : 'var(--ink-strong)' }
          }
        >
          {value}
        </span>
        {unit ? (
          <span
            className="text-[11px] tabular-nums block mt-1"
            style={{ color: 'var(--ink-dim)' }}
          >
            {unit}
          </span>
        ) : null}
      </p>
      {/* 底部细条：强调项用品牌渐变，普通项用灰 —— 一眼分得出哪张是重点 */}
      <span
        className="mt-3 block h-[2px]"
        style={{ background: accent ? 'var(--grad-hair)' : 'var(--line)' }}
      />
    </TermPanel>
  );
}
