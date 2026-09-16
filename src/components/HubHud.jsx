/**
 * 主站顶部状态条（HUD）。
 *
 * 它存在的理由，是解决一个**结构上的断裂**：
 * 入场是深色的终端，主站是浅色的报告页 —— 两屏之间如果什么都不做，
 * 看起来就是"两个网站拼在一起"。这条 HUD 是那个过渡层：
 * 深色外壳（终端）× 浅色内容（报告），并把玩家当前的数据摆在外壳上。
 *
 * 为什么八个属性做成竖条，而不是一张小雷达图：
 *   1. 雷达图在四十像素高的条里读不出形状，竖条至少能读出高低
 *   2. 竖条没有依赖 —— 一张 ECharts 小图要额外实例、额外首屏体积，
 *      而它只是一个"状态指示"，不值这个价
 *   3. 数据真的攒起来之后（地图探索阶段），档案页里还有一张正经雷达图
 *
 * ⚠️ 条是**双向**的（零线居中，向上为正、向下为负）。
 * 映射矩阵的增量带负数，答案里"减掉的那几项"和"加上来的那几项"同样重要；
 * 只画正值等于把一半信息丢掉。零线因此必须画出来，否则看不出哪边是正。
 *
 * 本组件只负责画。数值怎么换算、哪边算强、分母取多少，全在 lib/hudModel.js ——
 * 那些是判定逻辑，要能被自动断言，不能藏在 JSX 里。
 */

import { TERMINAL } from '../lib/terminalTheme.js';
import { HUD_HALF, signed, summarizeAttributes } from '../lib/hudModel.js';
import { useGameStore } from '../store/useGameStore.js';

export default function HubHud({ onRestart }) {
  const player = useGameStore((s) => s.player);
  const backToIntro = useGameStore((s) => s.backToIntro);
  const resetPlayer = useGameStore((s) => s.resetPlayer);

  const model = summarizeAttributes(player.attributes);
  const collected = player.flags.length;

  return (
    <header className="term-canvas" style={{ borderBottom: `1px solid ${TERMINAL.line}` }}>
      <div className="max-w-5xl mx-auto px-6 pt-4 pb-3">
        {/* 第一行：身份与状态 */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={backToIntro}
            className="term-mono text-[11px] transition-opacity hover:opacity-100"
            style={{ color: TERMINAL.inkSoft }}
            title="回到入场画面"
          >
            ◄ 终端
          </button>

          <span className="term-mono text-[11px]" style={{ color: TERMINAL.inkDim }}>
            CAMPUS&nbsp;ARCHIVE&nbsp;//&nbsp;TERMINAL&nbsp;v3
          </span>

          <span className="flex-1" />

          <span
            className="term-mono text-[11px]"
            style={{ color: model.started ? TERMINAL.cyan : TERMINAL.inkDim }}
          >
            {model.started ? `已采集 ${collected} 项` : '待采集'}
          </span>

          {model.started && (
            <button
              type="button"
              onClick={() => {
                resetPlayer();
                onRestart?.();
              }}
              className="term-mono text-[11px] transition-opacity hover:opacity-100"
              style={{ color: TERMINAL.inkDim }}
            >
              清空
            </button>
          )}
        </div>

        {/* 第二行：属性双向条 */}
        <div className="mt-3 flex items-start gap-2">
          {model.rows.map((r) => (
            <div
              key={r.key}
              className="flex flex-col items-center"
              title={`${r.label} ${signed(r.value)}`}
            >
              {/* 上半区：正条从零线往上长 */}
              <div style={{ height: HUD_HALF, display: 'flex', alignItems: 'flex-end' }}>
                {model.started && r.positive && (
                  <div style={{ width: 10, height: r.height, background: TERMINAL.cyan }} />
                )}
              </div>

              {/* 零线。不画出来就分不清上下哪边是正 */}
              <div
                style={{
                  height: 1,
                  width: 14,
                  background: model.started ? TERMINAL.inkDim : TERMINAL.line,
                }}
              />

              {/* 下半区：负条从零线往下长 */}
              <div style={{ height: HUD_HALF, display: 'flex', alignItems: 'flex-start' }}>
                {model.started && !r.positive && (
                  <div style={{ width: 10, height: r.height, background: TERMINAL.amber }} />
                )}
              </div>

              <span className="term-mono mt-1" style={{ fontSize: 9, color: TERMINAL.inkDim }}>
                {r.short}
              </span>
            </div>
          ))}

          <div className="ml-3 mt-0.5 term-mono text-[11px] leading-5" style={{ color: TERMINAL.inkSoft }}>
            {model.started ? (
              <>
                <div style={{ color: TERMINAL.cyan }}>
                  ↑ {model.top.label} {signed(model.top.value)}
                </div>
                <div style={{ color: TERMINAL.amber }}>
                  ↓ {model.bottom.label} {signed(model.bottom.value)}
                </div>
              </>
            ) : (
              <div style={{ color: TERMINAL.inkDim }}>答完 6 题或走过地图，这里开始长数据</div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
