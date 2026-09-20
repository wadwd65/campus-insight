/**
 * 行动地图 —— 方向 6 的「采集界面」本体。
 *
 * 和问卷的分工：
 *   问卷是**一次性**的（答完就结束），负责"快" —— 30 秒拿到报告。
 *   地图是**可反复**的，负责"深" —— 同一个地方可以再去，但增量衰减。
 *   两者写进同一本账，所以档案页不需要关心数据从哪来。
 *
 * 界面为什么是深色（而不是跟 SurveyForm 一样浅色）：
 *   地图是**场景层**，与入场动画、主站 HUD 同属"仪表盘"那一类；
 *   问卷与报告是**内容区**，是"报告正文"。这条边界在 index.css 顶部就写明了，
 *   这里沿用，不新开第三种气质。
 *
 * 动效只用 transform / opacity（不触发布局重排），降级交给 @media (prefers-reduced-motion)。
 */

import { useMemo, useState } from 'react';
import { useGameStore } from '../store/useGameStore.js';
import { ZONES, placesInZone } from '../data/mapPlaces.js';
import { mapModel, nextDelta, DECAY_LIMIT } from '../lib/mapEngine.js';
import { summarizeAttributes, signed } from '../lib/hudModel.js';
// 题数从契约取 —— 题库从 6 扩到 10 题时，写死过的地方全都成了谎话
import { QUESTIONS, shortLabelOf } from '../lib/surveySchema.js';

/** 区域配色 —— 与入场立绘的两色（青 / 琥珀）同一套色板，不引入新颜色。 */
const ZONE_TONE = {
  north: '#4fa8d8',
  east: '#5fd3a0',
  south: '#f5a623',
  west: '#c084fc',
};

/** 增益标签：把向量压成「学术 +4」这种短标签，最多显示三个。 */
function DeltaTags({ vec }) {
  const entries = Object.entries(vec)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3);
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([k, v]) => (
        <span
          key={k}
          className="term-mono text-[10px] px-1.5 py-0.5 rounded-sm"
          style={{
            color: v > 0 ? '#5fd3a0' : '#f5a623',
            background: v > 0 ? 'rgba(95,211,160,0.10)' : 'rgba(245,166,35,0.10)',
            border: `1px solid ${v > 0 ? 'rgba(95,211,160,0.28)' : 'rgba(245,166,35,0.28)'}`,
          }}
        >
          {shortLabelOf(k)} {signed(v)}
        </span>
      ))}
    </div>
  );
}

/** 地点卡片。 */
function PlaceCard({ place, onPick, busy }) {
  const tone = ZONE_TONE[place.zone] ?? '#8a98a8';
  const dead = !place.enabled;

  return (
    <button
      type="button"
      disabled={dead || busy}
      onClick={() => onPick(place)}
      className="term-panel group relative text-left p-3.5 h-full flex flex-col transition-[transform,border-color,background-color]"
      style={{
        borderColor: dead ? 'var(--term-line)' : tone,
        background: dead ? 'rgba(20,28,37,0.42)' : 'var(--term-panel)',
        opacity: dead ? 0.45 : 1,
        cursor: dead ? 'not-allowed' : 'pointer',
        transform: 'translateZ(0)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="text-[13px] font-semibold"
          style={{ color: dead ? '#5d6b7a' : 'var(--term-ink)' }}
        >
          {place.name}
        </span>
        <span className="term-mono text-[10px] shrink-0" style={{ color: dead ? '#5d6b7a' : tone }}>
          {place.times > 0 ? `×${place.times}` : `${place.cost}格`}
        </span>
      </div>

      <p
        className="text-[11px] leading-relaxed mt-1.5"
        style={{ color: dead ? '#4a5866' : 'var(--term-ink-soft)' }}
      >
        {place.line}
      </p>

      {!dead && (
        <div className="mt-auto pt-1">
          <DeltaTags vec={nextDelta(place, { [place.id]: place.times })?.vec ?? {}} />
        </div>
      )}

      {dead && place.reason && (
        <p className="term-mono text-[10px] mt-2" style={{ color: '#5d6b7a' }}>
          {place.reason}
        </p>
      )}

      {/* 去过但已衰减到头：与"没去过"在视觉上分开 */}
      {place.exhausted && (
        <span
          className="term-mono absolute top-2 right-2 text-[9px] px-1"
          style={{ color: '#5d6b7a', border: '1px solid var(--term-line)' }}
        >
          已尽
        </span>
      )}
    </button>
  );
}

/** 时段格：4 个方格，用掉一个少一个。 */
function SlotBar({ slots, total }) {
  return (
    <div className="flex items-center gap-2">
      <span className="term-mono text-[10px]" style={{ color: 'var(--term-ink-soft)' }}>
        今天还剩
      </span>
      <div className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className="inline-block w-3.5 h-3.5"
            style={{
              background: i < slots ? 'rgba(79,168,216,0.85)' : 'transparent',
              border: `1px solid ${i < slots ? '#4fa8d8' : 'var(--term-line)'}`,
              transform: 'translateZ(0)',
              transition: 'background 220ms ease, border-color 220ms ease',
            }}
          />
        ))}
      </div>
      <span className="term-mono text-[10px] tabular-nums" style={{ color: slots > 0 ? '#4fa8d8' : '#f5a623' }}>
        {slots} / {total}
      </span>
    </div>
  );
}

export default function MapScene({ onGoReport, onGoQuiz }) {
  const player = useGameStore((s) => s.player);
  const applyChoice = useGameStore((s) => s.applyChoice);
  const resetPlayer = useGameStore((s) => s.resetPlayer);
  const [last, setLast] = useState(null);
  const [busy, setBusy] = useState(false);

  const model = useMemo(() => mapModel(player.trail), [player.trail]);
  const hud = useMemo(() => summarizeAttributes(player.attributes), [player.attributes]);

  function pick(place) {
    const delta = nextDelta(place, model.visited);
    if (!delta) return;
    setBusy(true);
    applyChoice({
      id: place.id,
      label: place.name,
      delta: delta.vec,
      at: Date.now(),
    });
    setLast({ name: place.name, vec: delta.vec, visit: delta.visit, trait: place.line });
    window.setTimeout(() => setBusy(false), 160);
  }

  return (
    <div className="term-canvas term-grid relative min-h-full">
      <div className="relative max-w-5xl mx-auto px-6 py-8">
        {/* ── 顶栏：时段 + 今日状态 ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <p className="term-mono text-[10px] tracking-[0.3em]" style={{ color: 'var(--term-ink-soft)' }}>
              CAMPUS · ACTION MAP
            </p>
            <h2 className="text-xl font-semibold mt-1" style={{ color: 'var(--term-ink)' }}>
              今天的四个时段，你打算怎么花
            </h2>
          </div>
          <SlotBar slots={model.slots} total={model.slotsPerDay} />
        </div>

        {/* ── 左侧：地图格 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_268px] gap-6 items-start">
          <div className="space-y-5">
            {ZONES.map((zone) => (
              <section key={zone.key}>
                <div className="flex items-baseline gap-2 mb-2.5">
                  <span
                    className="term-mono text-[10px] tracking-[0.2em]"
                    style={{ color: ZONE_TONE[zone.key] }}
                  >
                    {zone.label}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--term-ink-soft)' }}>
                    {zone.hint}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                  {placesInZone(zone.key).map((p) => (
                    <PlaceCard
                      key={p.id}
                      place={model.items.find((i) => i.id === p.id)}
                      onPick={pick}
                      busy={busy}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* ── 右侧：属性实时反馈 ── */}
          <aside className="lg:sticky lg:top-6 space-y-4">
            <div className="term-panel p-4">
              <p className="term-mono text-[10px] tracking-[0.25em] mb-3" style={{ color: 'var(--term-ink-soft)' }}>
                ATTRIBUTE TRACE
              </p>

              {!hud.started ? (
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--term-ink-soft)' }}>
                  还没有留下任何轨迹。
                  <br />
                  选一个地方走走 —— 每去一次，八维都会变一点。
                </p>
              ) : (
                <div className="space-y-1.5">
                  {hud.rows.map((r) => (
                    <div key={r.key} className="flex items-center gap-2">
                      <span className="text-[11px] w-[52px] shrink-0" style={{ color: 'var(--term-ink-soft)' }}>
                        {r.label}
                      </span>
                      <span
                        className="inline-block h-[6px]"
                        style={{
                          width: `${Math.max(2, (Math.abs(r.value) / hud.peak) * 96)}px`,
                          background: r.positive ? '#4fa8d8' : '#f5a623',
                          transform: 'translateZ(0)',
                          transition: 'width 260ms cubic-bezier(0.16,1,0.3,1)',
                        }}
                      />
                      <span
                        className="term-mono text-[10px] tabular-nums ml-auto"
                        style={{ color: r.positive ? '#4fa8d8' : '#f5a623' }}
                      >
                        {signed(r.value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {last && (
                <div
                  key={last.name + last.visit}
                  className="term-rise mt-3 pt-3 text-[11px] leading-relaxed"
                  style={{ borderTop: '1px solid var(--term-line)', color: 'var(--term-ink-soft)' }}
                >
                  <span style={{ color: 'var(--term-ink)' }}>→ {last.name}</span>
                  {last.visit > 1 && (
                    <span className="term-mono text-[10px]"> · 第 {last.visit} 次（增量已衰减）</span>
                  )}
                  <br />
                  {last.trait}
                </div>
              )}
            </div>

            {/* 行程轨迹 */}
            <div className="term-panel p-4">
              <p className="term-mono text-[10px] tracking-[0.25em] mb-2.5" style={{ color: 'var(--term-ink-soft)' }}>
                TRAIL · {model.totalTrips} 次行动
              </p>
              {model.totalTrips === 0 ? (
                <p className="text-[11px]" style={{ color: 'var(--term-ink-soft)' }}>
                  轨迹还是空的。
                </p>
              ) : (
                <ol className="space-y-1.5">
                  {player.trail.map((t, i) => {
                    const p = model.items.find((x) => x.id === t.id);
                    if (!p) return null;
                    return (
                      <li key={i} className="flex items-center gap-2 text-[11px]">
                        <span className="term-mono text-[10px] w-4 shrink-0" style={{ color: 'var(--term-ink-soft)' }}>
                          {i + 1}
                        </span>
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: ZONE_TONE[p.zone] }}
                        />
                        <span style={{ color: 'var(--term-ink)' }}>{p.name}</span>
                        {p.times > 1 && (
                          <span className="term-mono text-[9px] ml-auto" style={{ color: 'var(--term-ink-soft)' }}>
                            ×{p.times}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {/* 出口 */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onGoReport}
                disabled={!hud.started}
                className="term-mono text-[11px] py-2.5 transition-[border-color,color]"
                style={{
                  border: `1px solid ${hud.started ? '#4fa8d8' : 'var(--term-line)'}`,
                  color: hud.started ? '#4fa8d8' : '#5d6b7a',
                  cursor: hud.started ? 'pointer' : 'not-allowed',
                }}
              >
                用这段经历生成档案 →
              </button>
              {!hud.started && (
                <button
                  type="button"
                  onClick={onGoQuiz}
                  className="term-mono text-[11px] py-2.5 transition-colors"
                  style={{ border: '1px solid var(--term-line)', color: 'var(--term-ink-soft)' }}
                >
                  或者，先答 {QUESTIONS.length} 题
                </button>
              )}
              {model.totalTrips > 0 && (
                <button
                  type="button"
                  onClick={resetPlayer}
                  className="term-mono text-[10px] py-1.5"
                  style={{ color: '#5d6b7a' }}
                >
                  清空重来
                </button>
              )}
            </div>

            <p className="text-[10px] leading-relaxed" style={{ color: '#5d6b7a' }}>
              同一地点最多计 {DECAY_LIMIT} 次增量。这就是为什么"去哪"比"去几次"更重要。
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
