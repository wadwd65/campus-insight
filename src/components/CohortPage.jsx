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

import { useMemo } from 'react';
import Chart from './Chart.jsx';
import RadarChart from './RadarChart.jsx';
import { buildCohort, cohortHeadline } from '../lib/cohort.js';
import { BRAND, INK_SOFT, FONT, AXIS_LABEL_STYLE } from '../lib/theme.js';
import TermPanel from './TermPanel.jsx';
import { MonoTag, SectionHead } from './TermHead.jsx';
import CohortAi from './CohortAi.jsx';
import { TERM_INK, monoTag, sectionIndex } from '../lib/surface.js';

export default function CohortPage({ records, baseline, ownAnswers, onGoQuiz, onRestart }) {
  const cohort = useMemo(
    () => buildCohort(records, baseline, ownAnswers),
    [records, baseline, ownAnswers],
  );
  const headline = useMemo(() => cohortHeadline(cohort), [cohort]);

  return (
    <div className="max-w-3xl mx-auto">
      {/* 状态行 —— 与报告页的 `REPORT // GENERATED` 同句式，让"这是另一份档案"一眼成立 */}
      <div className="flex items-baseline justify-between gap-3 mb-6">
        <MonoTag>COHORT // COMPUTED</MonoTag>
        <MonoTag>{cohort.size} 人 · 5 维</MonoTag>
      </div>

      <div className="mb-10">
        <SectionHead
          index={1}
          level={1}
          title={`${cohort.size} 个人的大学，落在这些位置`}
          hint="结论优先 —— 下面这句可以直接念出来"
        />
        {headline && (
          <p
            className="text-[17px] leading-8 text-[var(--ink)] mt-3"
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          <Kpi label="有效样本" value={cohort.size} unit="人" />
          <Kpi
            label="最多的一类"
            value={cohort.most.name}
            unit={`${cohort.most.count} 人 · ${cohort.most.pct}%`}
            accent
          />
          <Kpi
            label="分歧最大"
            value={cohort.divergent ? cohort.divergent.axis : '—'}
            unit={cohort.divergent ? `一半人落在 ${cohort.divergent.q1}~${cohort.divergent.q3}` : ''}
          />
        </div>
      </div>

      <div className="space-y-12">
        {/* ★ 10-08：大模型解读 —— 官方链路三段里的第三段（数据 → 图表 → 解读）。
            放在"结论"之后，因为它就是这份数据的人话版结论。 */}
        <Section
          n={2}
          title="这份数据说了什么"
          hint="大模型读上面的分布写的三段话；没有配置密钥时，由本地规则按同一套数字生成"
        >
          <CohortAi cohort={cohort} />
        </Section>

        <Section
          n={3}
          title="这个班的位置"
          hint="实线是班里每个人的百分位的中位数；虚线圈是全体大学生 50% 的位置。同标尺，可以直接和快入口的报告对比"
        >
          <RadarChart
            data={cohort.axes.map((a) => ({ key: a.key, axis: a.axis, value: a.median }))}
            compare={{ value: 50, name: '全体大学生 50%' }}
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

        <Section n={5} title="班里和你最像的人" hint="按九维属性算距离。需要一个『你』做参照">
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
        </Section>

        <details className="text-xs text-[var(--ink-soft)] leading-6">
          <summary className="cursor-pointer">这张图是怎么算出来的</summary>
          <div className="mt-3 space-y-2">
            <p>
              上传的每一行都走与基准人群**完全相同**的路径：每道题 → 八个属性 → 与 2000 人基准比对 → 百分位。
              所以「班里学术力中位数 62」和某位同学自己报告里的「学术力 82」是同一个标尺，可以直接比。
            </p>
            <p>
              这里用的是**个体百分位的中位数**，不是平均值的百分位。原因：几十个人的平均值波动很小，
              算出来的百分位几乎永远落在 40~60 之间，每个班都会显示成「中等」，反而看不出特点。
              中位数不受极端个体影响，也更容易被念出来。
            </p>
            <p>
              ⚠️ 示例班级问卷是**模拟生成**的数据，不是真实调查结果。你上传自己的数据时，
              结果完全来自你的文件 —— 这个页面不掺任何模拟数据。
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
          回到首页
        </button>
        <span className="text-xs text-[var(--ink-soft)]">
          换一份 CSV，画像会完全不同
        </span>
      </div>
    </div>
  );
}

function Section({ n, title, hint, children }) {
  return (
    <section>
      <SectionHead index={n} title={title} hint={hint} />
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
function Kpi({ label, value, unit, accent = false }) {
  const isText = typeof value === 'string' && !/^\d+(\.\d+)?$/.test(value);

  return (
    <TermPanel
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
      <p className="mt-2" title={String(value)}>
        <span
          className={isText ? 'block leading-tight font-semibold' : 'ci-stat ci-num block leading-tight'}
          style={
            isText
              ? { fontSize: 20, letterSpacing: '-0.01em', color: accent ? BRAND : 'var(--ink-strong)' }
              : { color: accent ? BRAND : 'var(--ink-strong)' }
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
