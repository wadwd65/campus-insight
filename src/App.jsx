/**
 * 应用外壳。
 *
 * ── 2026-09-20 改版：地图升为主界面，答题降为子入口 ─────────────────
 *
 * 改版前是「入场 → Welcome（正中一个大蓝按钮「开始 10 题」）→ 答题 → 结果」。
 * 那个结构把**答题当成了门**，地图反而是旁边一条次按钮。
 * 用户指出来这是反的：「**地图是第一界面，答题是他的子端口，而不是主端口**」。
 *
 * 理由站得住：地图是可反复走的、有空间感的、有即时反馈的；
 * 答题是一次性的。可反复的那个才该是家，一次性的那个该是家中的一个功能。
 *
 * 新结构：
 *   入场 → 地图（默认界面，深色场景层）
 *          ├─ 01 生成档案（走过地方之后可用）→ 报告
 *          ├─ 02 答 10 题 → 答题入口面板 → 问卷 → 报告
 *          └─ 03 上传班级 CSV → 群体画像
 *
 * 另外新加了 `gate` 这一站（答题入口面板）——
 * 点「答 10 题」不再直接落到第一题。见 QuizGate.jsx 的说明。
 *
 * 四条沿用至今的安排：
 *   1. **带 ECharts 的两页单独分包**（结果页、群体画像页）。首屏因此只剩
 *      React + 表单 —— 评委点开链接的第一眼不该在等图表库下载。
 *   2. **基准数据进页面就开始加载**（不等用户点「进入」）。看入场动画的这几秒里
 *      它早就准备好了，出结果不该让人等。真入口也用它，所以基准只下载一次。
 *   3. **两个入口共用 `answers`**。在真入口里点「先答一轮」，答完会**回到群体画像**
 *      而不是跳去个人报告 —— 用户的目标是"看谁和我最像"，不该被带走。
 *   4. **答题结果同时写进终端账本**（useGameStore）。问卷的每道题本来就带 8 维增量向量，
 *      是现成的真实数据源；写进去之后 HUD 立刻有数据可看，
 *      而且"问卷"和"地图"从此进的是同一本账 —— 档案页不必关心数据从哪来。
 */

import { lazy, Suspense, useEffect, useState } from 'react';
import SurveyForm from './components/SurveyForm.jsx';
import UploadPanel from './components/UploadPanel.jsx';
import QuizGate from './components/QuizGate.jsx';
import HubHud from './components/HubHud.jsx';
import GeometricBackdrop from './components/GeometricBackdrop.jsx';
import SkyBackdrop from './components/SkyBackdrop.jsx';
import Mascot from './components/Mascot.jsx';
import { MonoTag } from './components/TermHead.jsx';
import IntroScene from './scenes/IntroScene.jsx';
import MapScene from './scenes/MapScene.jsx';
import EntryScene from './scenes/EntryScene.jsx';
import { loadBaseline } from './data/loadSample.js';
import { useGameStore } from './store/useGameStore.js';
import { QUESTIONS, vectorOf } from './lib/surveySchema.js';
import { cleanName } from './lib/text.js';

const ReportView = lazy(() => import('./components/ReportView.jsx'));
const CohortPage = lazy(() => import('./components/CohortPage.jsx'));

export default function App() {
  const scene = useGameStore((s) => s.scene);
  const applyChoice = useGameStore((s) => s.applyChoice);
  const resetPlayer = useGameStore((s) => s.resetPlayer);

  // ★ 默认就是地图。这是本次改版的核心一行 ——
  // 改版前这里写的是 'welcome'，于是答题成了门。
  // map | gate | quiz | report | upload | cohort
  // ★ 10-07 作品重心修正：默认落地页由「行动地图」改为「入口页」——
  //   一级入口是测评与上传，地图降为附加体验（见 EntryScene 顶部说明）。
  const [stage, setStage] = useState('entry');
  const [baseline, setBaseline] = useState(null);
  const [answers, setAnswers] = useState(null);
  const [cohort, setCohort] = useState(null); // 真入口最近一次上传的可用记录
  const [fromCohort, setFromCohort] = useState(false); // 答题是为了回到群体画像
  const [name, setName] = useState('');
  const [error, setError] = useState(null);

  // 报告有两条来路：问卷（answers）与地图（账本里的 attributes）。
  // 这里用一个标记记住"这份报告是从地图来的"，因为两者的数据形状不同 ——
  // 地图没有 answers，只有一本累加的账。见 results.js 的 buildReportFromAttributes。
  const [mapRun, setMapRun] = useState(false);
  const player = useGameStore((s) => s.player);

  // ★ 10-14 B+C：问卷算完时的属性快照。
  //   它是「复测」这一半的基线 —— 玩家接着去地图上走一遍，
  //   地图的增量会叠在这本账上，于是报告页可以并排显示
  //   「问卷算出的你」和「地图走出来的你」。
  //   放在 App 而不是 store：它是一次性的历史快照，不该被后续行动改写
  //   （store 里的 player.attributes 是"当前值"，语义不同）。
  const [quizSnapshot, setQuizSnapshot] = useState(null);

  // ★ B+C：只有**从问卷直接来**的报告才显示「去地图复测」按钮。
  //   已经走过地图的报告再给一个"去地图"是循环邀请（点了又会回到同一页）。
  //   判据用 mapRun 而不是 quizSnapshot：复测之后 mapRun 仍为 true，正好不再显示。

  // 基准数据在**入场动画播放时就已经开始下载**：等用户点「进入终端」时它多半已就绪，
  // 所以这个 effect 不能挪到 hub 分支里去 —— 那样就会白白等一次网络往返。
  //
  // ★ 10-14 审查修复（任务书 P5#2「数据加载失败后能否重试」）：
  //   原实现把这个请求写在 useEffect 里就跑一次，失败就永远停在错误页 ——
  //   用户唯一的出路是刷新浏览器（而入口页的措辞是"回地图"，回不去）。
  //   现在抽成可重入的 loadBaselineData()，错误页上给一个「重新加载」按钮。
  function loadBaselineData() {
    setError(null);
    setBaseline(null);
    loadBaseline()
      .then((d) => setBaseline(d.baseline))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadBaselineData();
    // loadBaseline 自带缓存（cache/pending），effect 不会重复发请求
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ★ 回到地图 —— 这是全站的"回首页"。
  // 注意它**不清空账本**（restart 才清）：从报告页按返回、从上传页按返回，
  // 玩家走过的地方应该还在，否则"回去再走一段"这件事就没法做了。
  function backToMap() {
    setFromCohort(false);
    setStage('map');
  }

  // 彻底重来：清账本、清作答、回地图。
  // 它对应 HUD 上的「重来」——那是"我不想保留这一轮了"，语义与 backToMap 不同。
  //
  // ★ 10-14 审查修复（任务书 P5#2「重来后所有相关状态是否正确清空」）：
  //   原来漏清了 `cohort`（上一次上传的班级数据）与 `error`（基准加载失败的残留）。
  //   `cohort` 留着不会立刻显示错内容（stage 回地图了），但用户之后再点上传、
  //   或界面某处读到它，就会拿到"上一轮的数据"——这种残留最难查，因为它不报错。
  function restart() {
    resetPlayer();
    setAnswers(null);
    setQuizSnapshot(null); // ★ B+C：快照不清，"复测"会拿着上一轮的基线
    setFromCohort(false);
    setMapRun(false);
    setCohort(null);   // ★ 新增：清掉上一轮上传的班级数据
    setError(null);    // ★ 新增：清掉上一次加载失败的残留
    setName('');
    setStage('map');
  }

  function finishQuiz(a) {
    setAnswers(a);
    setMapRun(false); // 走问卷这条路，报告就读 answers，不读地图的账

    // 把这一轮作答的增量写进终端账本。
    // 先清空再写：重答一次应该得到一份新账，而不是在上一次的基础上继续累加。
    resetPlayer();
    for (const q of QUESTIONS) {
      const vec = vectorOf(q.field, a[q.field]);
      if (vec) applyChoice({ id: `${q.field}=${a[q.field]}`, label: q.text, delta: vec });
    }

    // ★ B+C：把这一轮作答算出的属性存成快照，供"复测"对比用。
    //   必须在 applyChoice 全部跑完之后取，否则拿到的是空账。
    setQuizSnapshot({ ...player.attributes });

    if (fromCohort) {
      setFromCohort(false);
      setStage('cohort');
    } else {
      setStage('report');
    }
  }

  // ★ B+C（C1）：从问卷报告去地图"复测"。
  //   刻意**不清账本、不清 answers、不清 quizSnapshot** ——
  //   地图的每一步都会叠在问卷算出的属性上，这样走完才能对比"两次测量"。
  //   这也解释了为什么不复用 backToMap()：那个函数的语义是"回去看看"，
  //   而这里是"接着走一段，用来验证前一次测量"。
  function goMapFromReport() {
    setMapRun(true);
    setStage('map');
  }

  // 入场场景独立成屏：它不依赖基准数据，也不依赖账本，不该被上面的加载态卡住。
  if (scene === 'intro') return <IntroScene />;

  // ── 场景层：地图 ──
  // 它是**深色满宽**的仪表盘，不该塞进下面那个浅色内容容器
  // （max-w-5xl + 白底内边距）里 —— 那样会得到"浅色页面里嵌一块深色"，
  // 也就是这个项目一直在避免的拼接感。
  // ── 入口页（10-07 新增，作品重心修正）：一级入口 = 测评 / 上传
  // 3D 实景校园不进这里，也不做站内场景 —— 它只是入口页上的一个外链（附加展示）。
  if (stage === 'entry') {
    // 入口页自带页头（见 EntryScene）—— 不套 HubHud：
    // 它上面的属性条在"还没走过任何地方"时是一条空状态，读起来像报错。
    return (
      <div className="min-h-full flex flex-col term-enter">
        <main className="flex-1 w-full">
          <EntryScene
            onGoQuiz={() => setStage('quiz')}
            onGoUpload={() => setStage('upload')}
            onGoMap={() => setStage('map')}
          />
        </main>
      </div>
    );
  }

  if (stage === 'map') {
    return (
      <div className="min-h-full flex flex-col term-enter">
        {/* ★ 10-15：地图页补上天空与立绘。
            此前 App 有**三个独立 return**，而天空只挂在默认分支上 ——
            地图页与入口页因此完全没有背景层（指标里 5-map 没有天空层溢出，就是证据）。
            地图页改成浅色之后，这个缺口才暴露出来：它是"浅底但没有天空"的一页，
            与另三页气质割裂。 */}
        <SkyBackdrop />
        <HubHud onRestart={restart} onGoEntry={() => setStage('entry')} />
        <main className="flex-1 w-full">
          {/* 基准数据还没到也不拦着 —— 地图不依赖基准人群，它只写账本 */}
          <MapScene
            onGoReport={() => {
              setMapRun(true);
              setStage('report');
            }}
            onGoQuiz={() => setStage('gate')}
            onUpload={() => setStage('upload')}
            onGoEntry={() => setStage('entry')}
          />
        </main>
        <Mascot src={`${import.meta.env.BASE_URL}art/mascot.webp`} />
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col term-enter">
      {/* ★ 10-14：几何装饰层（参考《明日方舟》SideStory「众生行记」的界面语言）。
          放在最外层、fixed 定位、pointer-events:none ——
          它必须在地图页也可见（地图自己有背景，但那页更需要"坐标系"的感觉），
          又不能挡掉任何一次点击。入场页不挂它（那页是场景层，不是数据层）。 */}
      {/* ★ 10-14 v2：两层背景。
            ① ark-sky —— 顶部一层通透的蓝紫光（众生行记"避开深色、用亮度造神圣感"）
            ② GeometricBackdrop —— 螺旋 / 圆环 / 制图线 / 几何色块 */}
      <div className="ark-sky" aria-hidden="true" />
      <GeometricBackdrop variant="page" />
      {/* ★ 10-15：天空提到**全站**，不再只挂答题页。
          用户这次明确「重做的是全部网站的 UI」——
          背景是整站的地基，只挂一页会让各页变成不同气质。
          它 fixed 铺满、z-index:-1、pointer-events:none，所有内容压在它之上。
          ⚠️ 与几何层互斥（见 index.css 的 :has() 规则）：
             有天空时几何自动让位 —— 两套装饰叠在一起是"一张照片 + 一堆线"。 */}
      <SkyBackdrop />
      {/* ★ 10-15：立绘小人常驻全站（用户：「除了那个动开场动画那里」）。
          入场页是 early return，天然不经过这里 —— 正好符合"除了开场动画"。
          入口页由 EntryScene 自带一份，不在这里重复挂（同页会出现两个）。
          z-index 在天空之上、内容之下由 .mascot 自身控制，pointer-events 只留可点区。 */}
      <Mascot src={`${import.meta.env.BASE_URL}art/mascot.webp`} />

      <HubHud onRestart={restart} onGoEntry={() => setStage('entry')} />
      {/* 深色 HUD → 浅色正文的过渡带。见 index.css 的 .term-seam 说明：
          不加它，这条边界就是一条硬切的黑白线。 */}
      <div className="term-seam" aria-hidden="true" />

      {/* ★ 10-17：档案页自己控宽。
          全站其它页用 max-w-5xl + px-6 py-12，但档案页的"纸面"必须通栏 ——
          否则纸张只占中间 976px，两侧露出页面底色，看起来像"纸贴在一块板上"。
          所以这一页把 main 的宽度/padding 交给 .archive 自己处理。 */}
      <main
        className={
          stage === 'report'
            ? 'flex-1 w-full'
            : 'flex-1 w-full max-w-5xl mx-auto px-6 py-12'
        }
      >
        {error ? (
          <ErrorBlock message={error} onRetry={loadBaselineData} />
        ) : !baseline ? (
          <Hint text="正在加载基准人群数据…" />
        ) : stage === 'gate' ? (
          /* 答题入口面板：点「答 10 题」不再直接落到第一题。
             用户原话「答题应该是一个功能，而不是点进去就是答题」。 */
          <QuizGate onStart={() => setStage('quiz')} onBack={backToMap} />
        ) : stage === 'quiz' ? (
          <SurveyForm onComplete={finishQuiz} onCancel={() => setStage('gate')} />
        ) : stage === 'report' && (answers || mapRun) ? (
          <Suspense fallback={<Hint text="正在生成你的报告…" />}>
            <ReportView
              answers={answers}
              attributes={mapRun ? player.attributes : undefined}
              // ★ B+C：轨迹**两种路径都传**。
              //   问卷的每一题也会 applyChoice 进账本（见 finishQuiz），
              //   所以 trail 里本来就有作答记录 —— 以前只在 mapRun 时传，
              //   结果是问卷路径的报告看不到自己刚答了 10 题。
              trail={player.trail}
              baseline={baseline}
              name={name}
              quizSnapshot={quizSnapshot}
              onGoMap={mapRun ? undefined : goMapFromReport}
              onRestart={restart}
              onBackToMap={backToMap}
            />
          </Suspense>
        ) : stage === 'upload' ? (
          <UploadPanel
            onReady={(r) => {
              setCohort(r.records);
              setStage('cohort');
            }}
            onBack={backToMap}
          />
        ) : stage === 'cohort' && cohort ? (
          <Suspense fallback={<Hint text="正在算这个班的画像…" />}>
            <CohortPage
              records={cohort}
              baseline={baseline}
              ownAnswers={answers}
              onGoQuiz={() => {
                setFromCohort(true);
                setStage('gate');
              }}
              onRestart={restart}
            />
          </Suspense>
        ) : (
          /* 兜底不再是 Welcome —— 那条"两条并列的路"的版式整个删掉了。
             任何没被上面接住的状态都回地图。 */
          <FallbackToMap onBack={backToMap} />
        )}
      </main>

      <footer
        className="border-t"
        style={{
          // ★ 10-15：页脚原来用 --surface（#fbfdfe，近乎不透明的白）。
          //   它在纯白页面上没问题；压在**有云的天空**上时，
          //   云从底下一透，那段说明文字就成了"和背景融在一起"的典型。
          //   改成 0.94 的白玻璃 + 一条冷色顶边 —— 仍然是"说明区"的轻量感，
          //   但它有自己的底了。
          background: 'rgba(255, 255, 255, 0.94)',
          borderTopColor: 'rgba(21, 107, 122, 0.18)',
        }}
      >
        <div className="max-w-5xl mx-auto px-6 py-4 space-y-2">
          {/* 两条声明各占一行。原先挤成一行时，"PRIVACY //" 后面跟了 40 多个字，
              等宽小标的作用就没了 —— 它本来是用来分隔和指路的，
              被正文淹没之后只剩噪音。

              ★ 10-13 审查修复：原文写「只把算好的百分比与称号发给模型服务」，
              与 buildSummary.js 的实际发送内容不符（实际还发了题面原话、时间分配、
              四年曲线、冷知识、关键词）。这里按 buildSummary 的白名单（SUMMARY_FIELD_KEYS）
              逐类如实列明，声明与代码从此对得上。 */}
          <div className="flex gap-3">
            <MonoTag style={{ minWidth: 76, flexShrink: 0 }}>PRIVACY&nbsp;//</MonoTag>
            <span className="text-xs text-[var(--ink-soft)] leading-5">
              你的选择与上传的文件只在浏览器里计算。开启大模型解读时，只把报告里已算好的这几类数据
              —— 每道题的选项、九项人群位置、时间分配、四年曲线、称号与冷知识 ——
              发给模型服务来写那段话；原始文件与其它身份信息一律不发送
            </span>
          </div>
          <div className="flex gap-3">
            <MonoTag style={{ minWidth: 76, flexShrink: 0 }}>SIMULATED&nbsp;//</MonoTag>
            <span className="text-xs text-[var(--ink-soft)] leading-5">
              基准人群与示例班级数据为模拟生成，非真实调查结果
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * 兜底：任何没能匹配上的 stage 都回地图。
 *
 * 为什么不保留旧的 Welcome 当兜底：
 * 那个组件就是"两条并列的路"的版式本身，而这一版要删的正是它。
 * 留一个改过用途的 Welcome 会让人以为"首页还在"，下次改版又会绕回来。
 */
function FallbackToMap({ onBack }) {
  return (
    <div className="max-w-md mx-auto py-16 text-center">
      <p className="text-sm text-[var(--ink-soft)] mb-5">这里没有内容，回地图吧。</p>
      <button
        type="button"
        onClick={onBack}
        className="term-mono text-[12px] px-6 py-3 rounded-sm transition-colors"
        style={{ border: '1px solid var(--line)', color: 'var(--ink-soft)' }}
      >
        ← 回到地图
      </button>
    </div>
  );
}

function Hint({ text }) {
  return <p className="text-center text-sm text-[var(--ink-soft)] py-20">{text}</p>;
}

/**
 * 基准数据加载失败。
 *
 * ★ 10-14 审查修复（任务书 P5#2）：原来这里只显示一条错误，**没有任何出路** ——
 *   用户只能刷新浏览器。现在给一个「重新加载」按钮，直接重跑 loadBaselineData()。
 *   （底层 loadBaseline 也修了：失败后会清掉 pending，否则重试只会拿到同一个 rejected promise。）
 */
export function ErrorBlock({ message, onRetry }) {
  const [retrying, setRetrying] = useState(false);
  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-6 py-8">
        <p className="text-base font-medium mb-2">基准数据没能加载</p>
        <p className="text-sm text-[var(--ink-soft)] leading-6">{message}</p>
        <div className="flex items-center gap-3 mt-5">
          <button
            type="button"
            disabled={retrying}
            onClick={() => {
              setRetrying(true);
              onRetry?.();
              // 让按钮有个短暂的反馈；真正的加载态由上层 !baseline 分支负责显示
              setTimeout(() => setRetrying(false), 800);
            }}
            className="px-4 py-2 text-sm text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ background: '#9a3412' }}
          >
            {retrying ? '正在重试…' : '重新加载'}
          </button>
          <span className="text-xs text-[var(--ink-soft)]">
            若一直失败，确认 public/data/ 下的基准文件在仓库里没被删。
          </span>
        </div>
      </div>
    </div>
  );
}
