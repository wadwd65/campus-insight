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
import { BRAND, INK_SOFT, FONT } from '../lib/theme.js';

export default function CohortPage({ records, baseline, ownAnswers, onGoQuiz, onRestart }) {
  const cohort = useMemo(
    () => buildCohort(records, baseline, ownAnswers),
    [records, baseline, ownAnswers],
  );
  const headline = useMemo(() => cohortHeadline(cohort), [cohort]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-10">
        <p className="text-xs tracking-widest text-[var(--ink-soft)] mb-3">群体画像</p>
        <h1 className="text-2xl font-semibold tracking-tight leading-snug mb-4">
          {cohort.size} 个人的大学，落在这些位置
        </h1>
        {headline && (
          <p className="text-base leading-7 text-[var(--ink)]" style={{ borderLeft: `3px solid ${BRAND}`, paddingLeft: '0.9rem' }}>
            {headline}
          </p>
        )}
      </div>

      <div className="space-y-12">
        <Section
          title="这个班的位置"
          hint="实线是班里每个人的百分位的**中位数**；虚线圈是全体大学生 50% 的位置。同标尺，可以直接和快入口的报告对比"
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
                <span className="tabular-nums font-medium" style={{ color: BRAND }}>
                  {a.median}
                </span>
                <span className="text-xs text-[var(--ink-soft)] tabular-nums">
                  一半人落在 {a.q1}~{a.q3} · 最低 {a.min} 最高 {a.max}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="这个班分成几类" hint="按每个人最突出的那一维归组，一个人只会进一个组">
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

        <Section title="班里和你最像的人" hint="按九维属性算距离。需要一个『你』做参照">
          {cohort.similar ? (
            <div className="space-y-2">
              {cohort.similar.top.map((s, i) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
                >
                  <span className="text-xs text-[var(--ink-soft)] tabular-nums w-4">{i + 1}</span>
                  <span className="text-sm text-[var(--ink)] flex-1">{s.id}</span>
                  <span className="text-xs text-[var(--ink-soft)]">{s.groupName}</span>
                  <span className="text-xs font-medium" style={{ color: BRAND }}>
                    {s.level}
                  </span>
                </div>
              ))}
              <p className="text-xs text-[var(--ink-soft)] pt-1">
                你自己的类型是「{cohort.similar.mineGroup}」那一种。
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-5 py-4">
              <p className="text-sm text-[var(--ink)] leading-6 mb-3">
                要先有一份「你的」作答，才能算出谁和你最像 —— 这也正是两个入口的交点：
                <br />
                六个选择题，答案会和班里每个人的答案逐一对上距离。
              </p>
              <button
                type="button"
                onClick={onGoQuiz}
                className="rounded-lg px-4 py-2 text-sm text-white transition hover:opacity-90"
                style={{ background: BRAND }}
              >
                先答完一轮，再回来看
              </button>
            </div>
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
          className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--ink)] transition hover:border-slate-300"
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

function Section({ title, hint, children }) {
  return (
    <section>
      <h3 className="text-base font-medium text-[var(--ink)] mb-1">{title}</h3>
      {hint ? <p className="text-xs text-[var(--ink-soft)] mb-4 leading-5">{hint}</p> : <div className="mb-4" />}
      {children}
    </section>
  );
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
        axisLabel: { color: INK_SOFT, fontSize: 12, fontFamily: FONT },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          barWidth: 16,
          data: shown.map((g) => ({
            value: g.count,
            itemStyle: { color: g.color, borderRadius: [0, 4, 4, 0] },
          })),
          label: {
            show: true,
            position: 'right',
            formatter: (p) => `${p.value} 人 · ${Math.round((p.value / total) * 1000) / 10}%`,
            color: INK_SOFT,
            fontSize: 12,
            fontFamily: FONT,
          },
        },
      ],
    };
  }, [groups, size]);

  return <Chart option={option} height={190} ariaLabel="班级类型分布条形图" />;
}
