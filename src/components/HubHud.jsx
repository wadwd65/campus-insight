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

import { HUD_LIGHT as TERMINAL } from '../lib/terminalTheme.js';
import { HUD_HALF, signed, summarizeAttributes } from '../lib/hudModel.js';
import { useGameStore } from '../store/useGameStore.js';
import NavButton from './NavButton.jsx';

export default function HubHud({ onRestart, onGoEntry }) {
  const player = useGameStore((s) => s.player);
  const backToIntro = useGameStore((s) => s.backToIntro);
  const resetPlayer = useGameStore((s) => s.resetPlayer);

  const model = summarizeAttributes(player.attributes);
  const collected = player.flags.length;

  // ★ 10-15：顶栏从"全站唯一的深色块"改成**浅色玻璃**。
  //   用户要「色调更明亮」，而这条黑边是最大的单一暗块；
  //   更重要的是：它压在动漫天空上，等于给画面盖了顶黑帽子。
  //   换成浅玻璃之后，天空从上到下是连贯的，界面元素浮在它上面。
  //   ⚠️ 这里**不能再用 .term-canvas** —— 那个类会把 --ink/--line/--accent
  //      全部重映射成深色底的值，浅底文字会瞬间掉对比度。
  //   ⚠️ 注释必须写在 return 之前：放在 `return (` 与 `<header>` 之间
  //      会被解析成"两个表达式"，构建直接报错（本轮踩过一次）。
  return (
    <header
      style={{
        background: 'rgba(255, 255, 255, 0.80)',
        borderBottom: `1px solid ${TERMINAL.line}`,
      }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-2.5 pb-2 sm:pt-4 sm:pb-3">
        {/* 第一行：身份与状态 */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* ★ 10-10 修返回逻辑：入口页（entry）是一级界面，但此前全站的"返回"都指向
              backToMap（地图）—— 进入地图之后没有任何一条路能回到主页。
              这颗按钮随 HUD 全站可见（地图 / 答题 / 报告 / 上传 / 群体画像都渲染它），
              任何页面都能一键回主页。 */}
          {onGoEntry && (
            /* ★ 10-15：从 11px 小字换成 40px 大按钮。原热区只有 39×17，
               压在动漫天空上既看不清也点不中。 */
            <NavButton onClick={onGoEntry} icon="◄" title="回到站点主页（入口页）">
              主页
            </NavButton>
          )}

          {/* ★ 10-15：这颗也从 11px 小字换成大按钮 —— 它和「主页」是同级动作
              （一个是回入口页、一个是回入场），两个长不一样会让人以为
              其中一个更次要。 */}
          <NavButton onClick={backToIntro} icon="◄" title="回到入场画面">
            终端
          </NavButton>

          {/* ★ 10-14：窄屏隐藏这行长标题。
              它只是"身份标识"，不是可操作项；但在 390px 下它会把
              「◄ 主页 / ◄ 终端 / 这条 / 待采集」挤成两行，顶栏从 64 涨到 130+。
              隐藏它，顶栏只留真正有用的两颗按钮和一个状态。 */}
          <span
            className="term-mono text-[11px] hidden sm:inline"
            style={{ color: TERMINAL.inkDim }}
          >
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

        {/* 第二行：属性双向条。
            ★ 10-15：用户「上面那一排东西可以修改一下，那些小字也可以把它删掉了，没什么用」。
            实测确认了这句判断：**空态下这八列全是占位块**（5px 的矮条 + 一根零线）
            加八个 11px 短标签（学/社/运/美/夜/计/尝/抗）—— 它们要表达的
            "这里将来会长数据"完全由下面那行提示说清了，八列纯属噪音。
            ⇒ 空态**整排不渲染**，只留一行带玻璃底的提示；有数据时才长出来。 */}
        <div className="mt-2 sm:mt-3 flex items-start gap-2 flex-wrap">
          {model.started &&
            model.rows.map((r) => (
            <div
              key={r.key}
              className="flex flex-col items-center"
              title={`${r.label} ${signed(r.value)}`}
            >
              {/* 上半区：正条从零线往上长。
                  还没数据时给一个矮占位块 —— 空着的话，八个槽位看起来像"没渲染出来"，
                  而这块矮条能表达"这里将来会长出高度"。
                  ★ 10-14：占位块改用 slotEmpty（原用 line，对比 1.44 ≈ 看不见）。 */}
              <div style={{ height: HUD_HALF, display: 'flex', alignItems: 'flex-end' }}>
                {model.started ? (
                  r.positive && (
                    <div style={{ width: 12, height: r.height, background: TERMINAL.cyan }} />
                  )
                ) : (
                  <div style={{ width: 12, height: 5, background: TERMINAL.slotEmpty }} />
                )}
              </div>

              {/* 零线。不画出来就分不清上下哪边是正。
                  ★ 10-14：未开始时也用 slotEmpty，让"八个槽位"这件事可见 */}
              <div
                style={{
                  height: 1,
                  width: 16,
                  background: model.started ? TERMINAL.inkDim : TERMINAL.slotEmpty,
                }}
              />

              {/* 下半区：负条从零线往下长 */}
              <div style={{ height: HUD_HALF, display: 'flex', alignItems: 'flex-start' }}>
                {model.started && !r.positive && (
                  <div style={{ width: 12, height: r.height, background: TERMINAL.amber }} />
                )}
              </div>

              {/* ★ 10-14：字号 9px → 11px。9px 的中文在 1080p 上只有约 9 个物理像素高，
                  笔画糊成一团（实测这一行是全站最小的字）。 */}
              <span className="term-mono mt-1" style={{ fontSize: 11, color: TERMINAL.inkDim }}>
                {r.short}
              </span>
            </div>
          ))}

          <div
            className={
              model.started
                ? 'ml-3 mt-0.5 term-mono text-[11px] leading-5 hidden sm:block'
                : 'mt-1 inline-block rounded-sm px-3 py-1.5 text-[12px] leading-5'
            }
            style={{
              color: TERMINAL.inkSoft,
              // ★ 10-15：空态提示原来是**裸字压在天空上** —— 用户反馈
              //   "有一些字体跟背景融合在一起了，很透明的，看不清"。
              //   给它一条玻璃底，成本近乎零，但这行字立刻从画面里站出来。
              ...(model.started
                ? null
                : { background: 'rgba(255,255,255,0.86)', border: `1px solid ${TERMINAL.line}` }),
            }}
          >
            {model.started ? (
              <>
                {/* 强项：有任何非零项就显示（值可能为负，比如只去过食堂时最强的是美食 +4，没问题） */}
                <div style={{ color: TERMINAL.cyan }}>
                  ↑ {model.top.label} {signed(model.top.value)}
                </div>
                {/* 弱项：**只在真有负值时才显示**。
                    只去过图书馆（学术 +4）时，若照旧渲染「↓ 夜猫程度 0」，
                    这句话既没信息量，又会让人以为"夜猫被扣过" —— 它只是没被碰过。
                    见 hudModel.js 里 touched 的说明。 */}
                {model.bottom.value < 0 && (
                  <div style={{ color: TERMINAL.amber }}>
                    ↓ {model.bottom.label} {signed(model.bottom.value)}
                  </div>
                )}
              </>
            ) : (
              <span style={{ color: TERMINAL.inkDim }}>
                答完一轮题，或去地图上走一段 —— 这里会开始长数据
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
