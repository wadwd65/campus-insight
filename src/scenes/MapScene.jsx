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
import EntryDock from '../components/EntryDock.jsx';
import NavButton from '../components/NavButton.jsx';
// 题数从契约取 —— 题库从 6 扩到 10 题时，写死过的地方全都成了谎话
import { QUESTIONS, shortLabelOf } from '../lib/surveySchema.js';

/** 区域配色。
 *  ★ 10-15：从"深场景的亮色"换成**浅底可读**的同色相版本。
 *  原值在 #f7fafb（新画布）上的对比度分别是
 *  north 3.59 / east 1.77 / south 1.93 / west 2.62 —— **全部不可读**，
 *  它们本来是为深色底设计的。新值 4.79~5.72，全部达标，色相一致。 */
const ZONE_TONE = {
  north: '#1b6c80',
  east: '#0f7a5a',
  south: '#b45309',
  west: '#0e6e80',
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
          className="term-mono text-[11px] px-1.5 py-0.5 rounded-sm"
          style={{
            color: v > 0 ? '#0f7a5a' : '#b45309',
            background: v > 0 ? 'rgba(15,122,90,0.10)' : 'rgba(180,83,9,0.10)',
            border: `1px solid ${v > 0 ? 'rgba(15,122,90,0.30)' : 'rgba(180,83,9,0.30)'}`,
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
  const tone = ZONE_TONE[place.zone] ?? 'var(--term-ink-dim)';
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
          style={{ color: dead ? 'var(--term-ink-dim)' : 'var(--term-ink)' }}
        >
          {place.name}
        </span>
        <span className="term-mono text-[11px] shrink-0" style={{ color: dead ? 'var(--term-ink-dim)' : tone }}>
          {place.times > 0 ? `×${place.times}` : `${place.cost}格`}
        </span>
      </div>

      <p
        className="text-[11px] leading-relaxed mt-1.5"
        style={{ color: dead ? 'var(--term-ink-dim)' : 'var(--term-ink-soft)' }}
      >
        {place.line}
      </p>

      {!dead && (
        <div className="mt-auto pt-1">
          <DeltaTags vec={nextDelta(place, { [place.id]: place.times })?.vec ?? {}} />
        </div>
      )}

      {dead && place.reason && (
        <p className="term-mono text-[11px] mt-2" style={{ color: 'var(--term-ink-dim)' }}>
          {place.reason}
        </p>
      )}

      {/* 去过但已衰减到头：与"没去过"在视觉上分开 */}
      {place.exhausted && (
        <span
          className="term-mono absolute top-2 right-2 text-[11px] px-1"
          style={{ color: 'var(--term-ink-dim)', border: '1px solid var(--term-line)' }}
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
      <span className="term-mono text-[11px]" style={{ color: 'var(--term-ink-soft)' }}>
        今天还剩
      </span>
      <div className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className="inline-block w-3.5 h-3.5"
            style={{
              background: i < slots ? 'rgba(79,168,216,0.85)' : 'transparent',
              border: `1px solid ${i < slots ? '#156b7a' : 'var(--term-line)'}`,
              transform: 'translateZ(0)',
              transition: 'background 220ms ease, border-color 220ms ease',
            }}
          />
        ))}
      </div>
      <span className="term-mono text-[11px] tabular-nums" style={{ color: slots > 0 ? '#156b7a' : '#b45309' }}>
        {slots} / {total}
      </span>
    </div>
  );
}

export default function MapScene({ onGoReport, onGoQuiz, onUpload, onGoEntry }) {
  const player = useGameStore((s) => s.player);
  const applyChoice = useGameStore((s) => s.applyChoice);
  const resetPlayer = useGameStore((s) => s.resetPlayer);
  const [last, setLast] = useState(null);
  const [busy, setBusy] = useState(false);

  const model = useMemo(() => mapModel(player.trail), [player.trail]);
  const hud = useMemo(() => summarizeAttributes(player.attributes), [player.attributes]);

  // ★ B+C（B4）：轨迹里不带 at 的条目就是问卷作答（地图行动都带 Date.now()）。
  //   用它来回答"这个玩家之前答过题吗"，从而在地图上给出"已入账"的提示。
  const quizAnswered = player.trail.filter((t) => !t.at).length;

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
    <div className="term-light term-grid relative min-h-full">
      <div className="relative max-w-5xl mx-auto px-6 py-8">
        {/* ★ 10-14 B+C（B4）：让地图**知道问卷的存在**。
            以前从问卷答完 10 题再来地图，界面没有任何提示说"你答的题已经入账了" ——
            玩家会以为地图是另一个从零开始的玩法，于是两个入口永远是两张皮。
            这里读一眼轨迹：不带 at 的条目就是问卷作答（见 App.finishQuiz），
            有就明说"已经算进这本账"，并把"走完可以对比两次测量"也说出来。 */}
        {quizAnswered > 0 && (
          <div
            className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px]"
            style={{
              background: 'rgba(21,107,122,0.08)',
              borderLeft: '3px solid #156b7a',
              color: 'var(--term-ink)',
            }}
          >
            <span
              className="term-mono text-[11px] px-1.5 py-[1px] shrink-0"
              style={{ color: '#156b7a', border: '1px solid rgba(21,107,122,.32)' }}
            >
              已入账
            </span>
            <span>
              你答过的 <span className="ci-num font-semibold">{quizAnswered}</span> 题已经算进这本账了 ——
              接下来在地图上的每一步都会叠在它上面。走完回档案页，可以并排对比两次测量。
            </span>
          </div>
        )}

        {/* ── 顶栏：返回 + 时段 + 今日状态 ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            {/* ★ 10-10 修返回逻辑：此前从地图出发后全站回不到入口页（主页）。
                HUD 上虽然也有了「◄ 主页」，但地图是整屏深色场景，
                顶栏本地再放一颗更直观的，不用去找 HUD。 */}
            {onGoEntry && (
              <NavButton onClick={onGoEntry} icon="←" title="回到站点主页（入口页）">
                返回主页
              </NavButton>
            )}
            <div>
              <p className="term-mono text-[11px] tracking-[0.3em]" style={{ color: 'var(--term-ink-soft)' }}>
                CAMPUS · ACTION MAP
              </p>
              {/* ★ 10-14：地图这一屏原本整页没有 h1（这一行是 h2）。
                  它是这一屏唯一的主标题，提到 h1 —— 屏幕阅读器才能按标题跳转。
                  样式与字号不变，只换标签。 */}
              <h1 className="text-xl font-semibold mt-1" style={{ color: 'var(--term-ink)' }}>
                今天的四个时段，你打算怎么花
              </h1>
            </div>
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
                    className="term-mono text-[11px] tracking-[0.2em]"
                    style={{ color: ZONE_TONE[zone.key] }}
                  >
                    {zone.label}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--term-ink-soft)' }}>
                    {zone.hint}
                  </span>
                </div>
                {/* ★ 10-14 v4：每个区块加一条**场景横幅**（绘世出的 zone-*.webp）。
                    以前三个区是清一色深底 + 一排卡片，视觉上分不出"这是图书馆那片"
                    还是"这是小吃街那片"—— 地点卡再精致也只是一个列表。
                    横幅高 76px、压暗、斜切角，只做"这是哪一片"的提示，
                    不抢下面地点卡的风头。mapEngine 里 ZONES 的 key 与文件名对应。 */}
                <div
                  className="relative h-[76px] overflow-hidden mb-2.5"
                  style={{
                    clipPath:
                      'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
                  }}
                >
                  <img
                    src={`${import.meta.env.BASE_URL}art/ark/zone-${zone.key}.webp`}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full object-cover ark-art"
                    decoding="async"
                  />
                  {/* 暗角：左边压暗（贴着区域名）、右边留亮 ——
                      ★ v4 初版用 0.90→0.42→0.12，整条几乎全黑，
                      场景图等于白放（看图后发现）。现在左 0.78 起，
                      右边只留 0.05，画面能读出来，又不抢下面地点卡。 */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(100deg, rgba(10,8,20,0.78) 0%, rgba(10,8,20,0.26) 46%, rgba(10,8,20,0.05) 100%)',
                    }}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-0 bottom-0 w-[3px]"
                    style={{ background: ZONE_TONE[zone.key] }}
                  />
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
              <p className="term-mono text-[11px] tracking-[0.25em] mb-3" style={{ color: 'var(--term-ink-soft)' }}>
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
                          background: r.positive ? '#156b7a' : '#b45309',
                          transform: 'translateZ(0)',
                          transition: 'width 260ms cubic-bezier(0.16,1,0.3,1)',
                        }}
                      />
                      <span
                        className="term-mono text-[11px] tabular-nums ml-auto"
                        style={{ color: r.positive ? '#156b7a' : '#b45309' }}
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
                    <span className="term-mono text-[11px]"> · 第 {last.visit} 次（增量已衰减）</span>
                  )}
                  <br />
                  {last.trait}
                </div>
              )}
            </div>

            {/* 行程轨迹 */}
            <div className="term-panel p-4">
              <p className="term-mono text-[11px] tracking-[0.25em] mb-2.5" style={{ color: 'var(--term-ink-soft)' }}>
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
                        <span className="term-mono text-[11px] w-4 shrink-0" style={{ color: 'var(--term-ink-soft)' }}>
                          {i + 1}
                        </span>
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: ZONE_TONE[p.zone] }}
                        />
                        <span style={{ color: 'var(--term-ink)' }}>{p.name}</span>
                        {p.times > 1 && (
                          <span className="term-mono text-[11px] ml-auto" style={{ color: 'var(--term-ink-soft)' }}>
                            ×{p.times}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {/* ── 功能入口坞 ──
                答题从"主入口"降成这里的 02 号。
                见 EntryDock.jsx 顶部的说明：地图是可反复的主体，
                答题是一次性的功能点，不该当门。
                坞里 01（生成档案）的状态跟地图走，03（上传）是独立入口。 */}
            <EntryDock
              canReport={hud.started}
              onGoReport={onGoReport}
              onGoQuiz={onGoQuiz}
              onUpload={onUpload}
            />

            {/* ── 3D 实景校园：★ 10-07 作品重心修正 —— 降级为**附加展示**：
                保留文件本身（public/map/ 里，不参与构建），这里只放一个外链按钮，
                不做站内场景、不参与任何评分功能，也不再往主流程里加耦合。 ── */}
            <a
              href={`${import.meta.env.BASE_URL}map/校园地图-3D实景.html`}
              className="term-mono block w-full text-center text-[11px] py-2 tracking-[0.12em]"
              style={{ color: 'var(--term-ink-dim)', border: '1px dashed rgba(255,255,255,.16)', borderRadius: 3 }}
            >
              3D 实景校园（附加展示）
            </a>

            {model.totalTrips > 0 && (
              <button
                type="button"
                onClick={resetPlayer}
                className="term-mono text-[11px] py-1.5 w-full"
                style={{ color: 'var(--term-ink-dim)' }}
              >
                清空重来
              </button>
            )}

            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--term-ink-dim)' }}>
              同一地点最多计 {DECAY_LIMIT} 次增量。这就是为什么"去哪"比"去几次"更重要。
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
