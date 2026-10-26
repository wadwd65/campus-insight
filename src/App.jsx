import {dayView} from './lib/campusDay.js';
import { readSurveyReportSnapshot, saveSurveyReport, clearSurveyReport, validSurveyAnswers } from './lib/surveyReportSession.js';
import { cleanDaySurveyContext } from './lib/daySurveyBridge.js';
import {cleanStoryReflection} from './lib/campusStory.js';
/**
 * Application flow: home → personal assessment or circle collection → explained results.
 * Optional campus actions share the base-attribute ledger with assessment.
 * Baseline loads early; chart-heavy views remain lazy. 3D stays an external link.
 */

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import SurveyForm from './components/SurveyForm.jsx';
import UploadPanel from './components/UploadPanel.jsx';
import QuizGate from './components/QuizGate.jsx';
import HubHud from './components/HubHud.jsx';
import IndustrialBackdrop from './components/IndustrialBackdrop.jsx';
import ExperienceSettings,{useExperience} from './components/ExperienceSettings.jsx';
import IntroScene from './scenes/IntroScene.jsx';
import MapScene from './scenes/MapScene.jsx';
import EntryScene from './scenes/EntryScene.jsx';
import { AccountProvider, useAccount } from './lib/accounts.jsx';
import ReportCircleSubmission from './components/ReportCircleSubmission.jsx';
import { clearAccountDrafts } from './lib/surveyDraft.js';
import { readSiteRoute } from './lib/siteNavigation.js';
import GettingStartedGuide from './components/GettingStartedGuide.jsx';
import { buildReport } from './lib/results.js';
import { slotsForPercents } from './lib/campusJourney.js';
import ProductFooter from './components/ProductFooter.jsx';
import './novice-experience.css';

/** 粒子层懒加载：@tsparticles 单独成 chunk，不拖首屏（与入场页同一份配置） */
import { loadBaseline, loadSampleCohort } from './data/loadSample.js';
import { useGameStore } from './store/useGameStore.js';
import { QUESTIONS, vectorOf } from './lib/surveySchema.js';

import { buildEggQuip } from './lib/egg.js';
import { buildProfileCsv, downloadText, makeProfileId } from './lib/exportProfile.js';

const ReportView = lazy(() => import('./components/ReportView.jsx'));
const CohortPage = lazy(() => import('./components/CohortPage.jsx'));
const CircleWorkspace = lazy(() => import('./components/CircleWorkspace.jsx'));
const DeploymentHelp = lazy(() => import('./components/DeploymentHelp.jsx'));
const CampusStory = lazy(() => import('./components/CampusStory.jsx'));
const CampusDay = lazy(() => import('./components/CampusDay.jsx'));
const CampusDayResult = lazy(() => import('./components/CampusDay.jsx').then(module=>({default:module.CampusDayResult}))); 

export default function App() {
  const isIntro=useGameStore(s=>s.scene==='intro');
  return <AccountProvider><ExperienceSettings companion={!isIntro}><CampusApp /></ExperienceSettings></AccountProvider>;
}

function CampusApp() {
  const account = useAccount();
  const {setMusicScene,setCompanionEgg}=useExperience();
  const [circleContext, setCircleContext] = useState(null);
  const scene = useGameStore((s) => s.scene);
  const applyChoice = useGameStore((s) => s.applyChoice);
  const resetPlayer = useGameStore((s) => s.resetPlayer);

  // ★ 默认就是地图。这是本次改版的核心一行 ——
  // 改版前这里写的是 'welcome'，于是答题成了门。
  // map | gate | quiz | report | upload | cohort
  // ★ 10-07 作品重心修正：默认落地页由「行动地图」改为「入口页」——
  //   一级入口是测评与上传，地图降为附加体验（见 EntryScene 顶部说明）。
  const [stage, setStage] = useState(() => readSiteRoute(typeof window === 'undefined' ? '' : window.location.hash).stage);
  useEffect(()=>{setMusicScene(scene==='intro'?'intro':stage.startsWith('day')?'day':stage);},[scene,stage,setMusicScene]);
  const [pendingInvite, setPendingInvite] = useState(() => readSiteRoute(typeof window === 'undefined' ? '' : window.location.hash).invite);
  const [dayRun,setDayRun]=useState(null);
  const [surveyDayContext,setSurveyDayContext]=useState(null);
  const [reportDayContext,setReportDayContext]=useState(null);
  function startDay(){setDayRun(null);setFromCohort(false);setStage('day');}
  function finishDay(progress){if(!dayView(progress).complete)return;setDayRun(progress);setStage('day-report');}
  const storyOrigin=useRef('entry');
  const [storyEpisodeId,setStoryEpisodeId]=useState(null),[storyContext,setStoryContext]=useState(null);
  function openStory(origin='entry',episodeId='screening'){storyOrigin.current=origin;setStoryEpisodeId(episodeId);setStage('story');}
  useEffect(() => {
    const navigate = () => {
      const route = readSiteRoute(window.location.hash);
      if (route.invite) {
        setPendingInvite(route.invite);
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/circles`);
      }
      setStage(route.stage);
      useGameStore.getState().enter();
    };
    if (readSiteRoute(window.location.hash).invite) navigate();
    window.addEventListener('popstate', navigate);
    window.addEventListener('hashchange', navigate);
    return () => { window.removeEventListener('popstate', navigate); window.removeEventListener('hashchange', navigate); };
  }, []);
  useEffect(() => {
    if (scene === 'intro') return;
    // Reports and in-progress answers remain memory-only; refreshing returns to a safe page.
    const page = ['circles', 'upload', 'map', 'story', 'day'].includes(stage) ? stage : ['day-report'].includes(stage)?'day':stage === 'entry' ? '' : circleContext ? 'circles' : '';
    const hash = page ? `#/${page}` : '';
    if (window.location.hash !== hash) window.history.pushState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
  }, [stage, scene]);
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, [stage, scene]);
  const [baseline, setBaseline] = useState(null);
  const [answers, setAnswers] = useState(null);
  const [cohort, setCohort] = useState(null); // 真入口最近一次上传的可用记录
  const [cohortSource, setCohortSource] = useState('csv');
  const [sampleBusy, setSampleBusy] = useState(false);
  const [sampleError, setSampleError] = useState('');
  const sampleRequest = useRef(0);
  const sampleLock = useRef(false);
  useEffect(() => {
    sampleRequest.current++;
    sampleLock.current = false;
    setSampleBusy(false); setSampleError('');
  }, [stage, account.user?.id]);
  useEffect(() => () => { sampleRequest.current++; }, []);
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
  const [previousAccount, setPreviousAccount] = useState(undefined);
  useEffect(() => {
    if (!['ready', 'offline'].includes(account.status)) return;
    const id = account.user?.id || null;
    if (previousAccount === id) return;
    if (previousAccount !== undefined && previousAccount !== id) {
      if (previousAccount) clearAccountDrafts(previousAccount);
      clearSurveyReport(undefined, previousAccount);
      setDayRun(null); setSurveyDayContext(null); setReportDayContext(null); setCircleContext(null); setStoryContext(null); setAnswers(null); setCohort(null); setQuizSnapshot(null); setMapRun(false); resetPlayer();
      setStage(current => ['day-report'].includes(current)?'day':['quiz', 'report', 'cohort'].includes(current) ? 'circles' : current);
    }
    const snapshot = readSurveyReportSnapshot(undefined, id);
    const restored = snapshot?.answers;
    if (restored) {
      setSurveyDayContext(snapshot.dayContext);
      setReportDayContext(snapshot.dayContext);
      setAnswers(restored); setMapRun(false); resetPlayer();
      for (const q of QUESTIONS) applyChoice({ id: `${q.field}=${restored[q.field]}`, label: q.text, delta: vectorOf(q.field, restored[q.field]) });
      setQuizSnapshot({ ...useGameStore.getState().player.attributes });
    }
    setPreviousAccount(id);
  }, [account.user?.id, account.status]);

  // ── ★ 10-17 夜：立绘彩蛋的数据来源 ──────────────────────────────
  //   60 秒内点立绘 10 次 ⇒ 小人歪头 + 气泡里给一句"专属数据解读"。
  //   趣评走的是 buildReport / buildReportFromAttributes，与报告页**同一套计算**，
  //   数字取自 percents（基准人群分位）—— 不是写死的一句漂亮话
  //   （详见 lib/egg.js 的三条规矩）。
  //   两条来路与报告页保持一致：问卷路线读 answers，地图路线读账本。
  const eggQuip = useMemo(
    () =>
      buildEggQuip({
        answers: mapRun ? undefined : answers,
        attributes: player.attributes,
        baseline,
      }),
    [answers, mapRun, player.attributes, baseline],
  );

  //   按钮必须是**真能按**的（彩蛋是"功能露出"，不是装饰）：
  //   · 有作答 ⇒ 导出一份档案 CSV（格式与上传入口同构，见 exportProfile.js）
  //   · 还没答 ⇒ 把人送去答题，而不是给一个按了没反应的按钮
  const hasAnswers = Boolean(answers && Object.keys(answers).length);
  const eggAction = useMemo(
    () =>
      mapRun ? {label:'查看行动报告 →',kind:'navigate',run:()=>setStage('report')} : hasAnswers
        ? {
            label: '下载我的档案 ↓',kind:'download',
            run: () => {
              const id = makeProfileId();
              downloadText(`campus-insight-档案-${id}.csv`, buildProfileCsv(answers, { id }));
            },
          }
        : { label: '先答十题 →',kind:'navigate', run: startQuiz },
    [mapRun,hasAnswers,answers],
  );
  useEffect(()=>{
    setCompanionEgg({quip:eggQuip?.text||null,action:eggAction,scope:account.user?.id||'anonymous'});
    return ()=>setCompanionEgg(null);
  },[eggQuip,eggAction,account.user?.id,setCompanionEgg]);

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

  function goEntry() {
    setFromCohort(false);
    setStage('entry');
  }

  function startQuiz(context) {
    setSurveyDayContext(cleanDaySurveyContext(context?.dayProgress));
    setStoryContext(cleanStoryReflection(context));
    setCircleContext(null);
    setFromCohort(false);
    setStage('quiz');
  }

  async function previewSample() {
    if (sampleLock.current) return;
    const request = ++sampleRequest.current;
    sampleLock.current = true;
    setSampleBusy(true); setSampleError('');
    try {
      const sample = await loadSampleCohort();
      if (request !== sampleRequest.current) return;
      setCircleContext(null); setFromCohort(false);
      setCohort(sample.records); setCohortSource('sample'); setStage('cohort');
    } catch {
      if (request === sampleRequest.current) setSampleError('暂时没能打开示例。请检查网络后再点一次，也可以先开始个人测评。');
    } finally {
      if (request === sampleRequest.current) { sampleLock.current = false; setSampleBusy(false); }
    }
  }

  // 彻底重来：清账本、清作答、回地图。
  // 它对应 HUD 上的「重来」——那是"我不想保留这一轮了"，语义与 backToMap 不同。
  //
  // ★ 10-14 审查修复（任务书 P5#2「重来后所有相关状态是否正确清空」）：
  //   原来漏清了 `cohort`（上一次上传的班级数据）与 `error`（基准加载失败的残留）。
  //   `cohort` 留着不会立刻显示错内容（stage 回地图了），但用户之后再点上传、
  //   或界面某处读到它，就会拿到"上一轮的数据"——这种残留最难查，因为它不报错。
  function restart() {
    setSurveyDayContext(null);
    setReportDayContext(null);
    setStoryContext(null);
    setCircleContext(null);
    resetPlayer();
    setAnswers(null);
    clearSurveyReport(undefined, account.user?.id);
    setQuizSnapshot(null); // ★ B+C：快照不清，"复测"会拿着上一轮的基线
    setFromCohort(false);
    setMapRun(false);
    setCohort(null);   // ★ 新增：清掉上一轮上传的班级数据
    setError(null);    // ★ 新增：清掉上一次加载失败的残留
    setName('');
    setStage('map');
  }

  function finishQuiz(a,context,dayContext=null) {
    a = validSurveyAnswers(a);
    if (!a) return;
    const cleanDay=cleanDaySurveyContext(dayContext);
    setSurveyDayContext(cleanDay);
    setReportDayContext(cleanDay);
    saveSurveyReport(a, undefined, account.user?.id, cleanDay);
    setStoryContext(cleanStoryReflection(context));
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
    setQuizSnapshot({ ...useGameStore.getState().player.attributes });

    // ★ v30：问卷决定「今天有几个时段」。
    //   用 percent 而不是账本值 —— 账本是可正可负的累加数，没有固定上限，
    //   拿它做阈值会随"去过几个地点"而漂移；percent 相对基准人群算，稳定 0~100。
    //   sport ≥65 → 5 个时段，≤35 → 3 个，其余 4 个。算不出（无基线）时保持默认 4。
    const slots = slotsForPercents(buildReport(a, baseline)?.percents);
    if (slots) useGameStore.getState().setSlotsPerDay(slots);

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
  if (scene === 'intro') return <IntroScene baseline={baseline}
    onEnter={() => { goEntry(); useGameStore.getState().enter(); }} />;

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
        <div className="flex-1 w-full">
          <EntryScene
            baseline={baseline}
            onReplayIntro={() => useGameStore.getState().backToIntro()}
            onGoQuiz={startQuiz}
            onOpenReport={answers ? () => { setMapRun(false); setStage('report'); } : undefined}
            onStartDay={startDay}
            onGoCircles={() => setStage('circles')}
            accountLabel={account.user ? `${account.user.displayName} · 我的圈子` : '登录 / 我的圈子'}
            onGoUpload={() => setStage('upload')}
            onPreviewSample={previewSample}
            sampleBusy={sampleBusy}
            sampleError={sampleError}
            onGoMap={() => setStage('map')}
            onGoStory={episodeId => openStory('entry',episodeId)}
            eggQuip={eggQuip}
            eggAction={eggAction}
          />
        </div>
      </div>
    );
  }

  if (['day','day-report'].includes(stage)) {
    return <div className="min-h-full flex flex-col term-enter stage-day"><IndustrialBackdrop/><HubHud compact statusLabel="可选探索 · 地图一天" onGoEntry={goEntry} onGoCircles={()=>setStage('circles')} accountLabel={account.user?`${account.user.displayName} · 我的圈子`:'登录 / 我的圈子'}/><main className="day-page-main"><Suspense fallback={<Hint text="正在展开今天的地图…"/>}>{stage==='day-report'&&dayRun?<CampusDayResult progress={dayRun} onBack={startDay} onGoQuiz={()=>startQuiz({dayProgress:dayRun})}/>:<CampusDay key={account.user?.id||'guest'} scope={account.user?.id||'guest'} onExit={goEntry} onGoQuiz={progress=>startQuiz({dayProgress:progress})} onComplete={finishDay}/>}</Suspense></main><ProductFooter/></div>;
  }

  if (stage === 'map') {
    return (
      <div className="min-h-full flex flex-col term-enter">
        {/* ★ 10-15：地图页补上天空与立绘。
            此前 App 有**三个独立 return**，而天空只挂在默认分支上 ——
            地图页与入口页因此完全没有背景层（指标里 5-map 没有天空层溢出，就是证据）。
            地图页改成浅色之后，这个缺口才暴露出来：它是"浅底但没有天空"的一页，
            与另三页气质割裂。 */}
        <IndustrialBackdrop />
        <HubHud onRestart={restart} onGoEntry={goEntry} onGoCircles={() => setStage('circles')} accountLabel={account.user ? `${account.user.displayName} · 我的圈子` : '登录 / 我的圈子'} help={<GettingStartedGuide onStartPersonal={startQuiz} onOpenCircles={() => setStage('circles')} />} compact statusLabel="行动地图" />
        <main className="flex-1 w-full">
          {/* 基准数据还没到也不拦着 —— 地图不依赖基准人群，它只写账本 */}
          <MapScene storyContext={storyContext} onGoStory={episodeId=>openStory('map',episodeId)}
            guide={null}
            onGoReport={() => {
              setMapRun(true);
              setStage('report');
            }}
            onGoQuiz={() => { setCircleContext(null); setFromCohort(false); setStage('gate'); }}
            onUpload={() => setStage('upload')}
            onGoEntry={goEntry}
          />
        </main>
      </div>
    );
  }

  return (
    <div className={`min-h-full flex flex-col term-enter stage-${stage}`}>
      <IndustrialBackdrop />
      <HubHud compact statusLabel={{ circles: '我的圈子', quiz: '问卷测评', gate: '准备作答', upload: '数据导入', cohort: '群体分析', report: '档案已生成', story: '校园小剧场' }[stage]} onRestart={restart} onGoEntry={goEntry} onGoCircles={() => setStage('circles')} accountLabel={account.user ? `${account.user.displayName} · 我的圈子` : '登录 / 我的圈子'} help={stage !== 'circles' ? <GettingStartedGuide context={circleContext ? 'circles' : 'home'} onStartPersonal={startQuiz} onOpenCircles={() => setStage('circles')} /> : null} />
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
            : `app-content flex-1 w-full max-w-5xl mx-auto px-6 ${stage === 'circles' ? 'app-circles py-8' : stage === 'quiz' ? 'py-6' : 'py-12'}`
        }
      >
        {stage === 'story' ? <Suspense fallback={<Hint text="正在接上这段故事…" />}><CampusStory onStartDay={startDay} initialEpisode={storyEpisodeId} key={account.user?.id||'guest'} scope={account.user?.id||'guest'} onBack={()=>setStage(storyOrigin.current==='report'&&(answers||mapRun)?'report':storyOrigin.current==='map'?'map':'entry')} onGoQuiz={startQuiz}/></Suspense> : stage === 'circles' ? (
          <Suspense fallback={<Hint text="正在打开圈子…" />}><div className="circle-workspace"><div className="novice-help-strip"><span>不确定下一步？可以先看指引，也可以直接操作。</span><GettingStartedGuide autoShow context="circles" onStartPersonal={startQuiz} onOpenCircles={() => setStage('circles')} /></div><CircleWorkspace key={account.user?.id || 'guest'} pendingInvite={pendingInvite} onInviteHandled={() => setPendingInvite('')} baseline={baseline} onSkip={startQuiz} onPreviewSample={previewSample} sampleBusy={sampleBusy} sampleError={sampleError} onStartQuiz={context => { setCircleContext(context); setAnswers(null); setFromCohort(false); setMapRun(false); setStage('quiz'); }} /><DeploymentHelp /></div></Suspense>
        ) : error ? (
          <ErrorBlock message={error} onRetry={loadBaselineData} onBack={goEntry} />
        ) : !baseline ? (
          <Hint text="正在加载基准人群数据…" />
        ) : stage === 'gate' ? (
          /* 答题入口面板：点「答 10 题」不再直接落到第一题。
             用户原话「答题应该是一个功能，而不是点进去就是答题」。 */
          <QuizGate onStart={() => setStage('quiz')} onBack={() => fromCohort ? setStage('cohort') : backToMap()} backLabel={fromCohort ? '班级画像' : '校园地图'} />
        ) : stage === 'quiz' ? (
          <><SurveyForm dayContext={surveyDayContext} storyContext={storyContext} key={circleContext ? `${circleContext.userId}:${circleContext.id}` : 'guest'} draftScope={circleContext ? `${circleContext.userId}:${circleContext.id}` : ''} contextLabel={circleContext ? `正在为「${circleContext.name}」填报；完成后需确认提交。` : ''} onComplete={finishQuiz} onPause={circleContext ? () => setStage('circles') : goEntry} onCancel={() => setStage(circleContext ? 'circles' : fromCohort ? 'cohort' : 'entry')} /></>
        ) : stage === 'report' && (answers || mapRun) ? (
          <Suspense fallback={<Hint text="正在生成你的报告…" />}>
            <ReportView
              key={JSON.stringify([answers, mapRun])}
              storyContext={storyContext}
              onApplyAnswers={mapRun ? undefined : next => finishQuiz(next, storyContext, reportDayContext)}
              dayContext={reportDayContext}
              onGoStory={episodeId => openStory('report',episodeId)}
              answers={answers}
              attributes={mapRun ? player.attributes : undefined}
              // ★ B+C：轨迹**两种路径都传**。
              //   问卷的每一题也会 applyChoice 进账本（见 finishQuiz），
              //   所以 trail 里本来就有作答记录 —— 以前只在 mapRun 时传，
              //   结果是问卷路径的报告看不到自己刚答了 10 题。
              trail={mapRun ? player.trail : player.trail.filter(entry => !entry.at)}
              baseline={baseline}
              name={name}
              quizSnapshot={quizSnapshot}
              onGoMap={mapRun ? undefined : goMapFromReport}
              onRestart={() => { restart(); setStage('quiz'); }}
              onBackToMap={backToMap}
              submissionPanel={!mapRun && account.user ? <ReportCircleSubmission key={`${account.user.id}:${JSON.stringify(answers)}`} account={account} context={circleContext} answers={answers} onBack={() => setStage('circles')} /> : null}
            />
          </Suspense>
        ) : stage === 'upload' ? (
          <UploadPanel
            onReady={(r) => {
              setCohort(r.records);
              setCohortSource(r.source === 'sample' ? 'sample' : 'csv');
              setStage('cohort');
            }}
            onBack={goEntry}
          />
        ) : stage === 'cohort' && cohort ? (
          <Suspense fallback={<Hint text="正在算这个班的画像…" />}>
            <CohortPage
              records={cohort}
              baseline={baseline}
              ownAnswers={cohortSource === 'sample' ? undefined : answers}
              source={cohortSource}
              onUpload={() => setStage('upload')}
              onGoQuiz={() => {
                setCircleContext(null);
                setFromCohort(true);
                setStage('gate');
              }}
              onRestart={goEntry}
            />
          </Suspense>
        ) : (
          /* Incomplete state returns to the primary entry without clearing saved progress. */
          <FallbackToHome onBack={goEntry} />
        )}
      </main>

      <ProductFooter />
    </div>
  );
}

/** A safe way back to the main task when a page has no report data yet. */
function FallbackToHome({ onBack }) {
  return (
    <div className="max-w-md mx-auto py-16 text-center">
      <p className="text-sm text-[var(--ink-soft)] mb-5">这一步还没有准备好，回到首页重新选择即可。</p>
      <button
        type="button"
        onClick={onBack}
        className="term-mono text-[12px] px-6 py-3 rounded-sm transition-colors"
        style={{ border: '1px solid var(--line)', color: 'var(--ink-soft)' }}
      >
        ← 回到首页
      </button>
    </div>
  );
}

function Hint({ text }) {
  return <div className="novice-loading" role="status" aria-live="polite"><span className="ui-spinner" aria-hidden="true" /><p>{text}</p><small>请稍等，不用重复点击。</small></div>;
}

/**
 * 基准数据加载失败。
 *
 * ★ 10-14 审查修复（任务书 P5#2）：原来这里只显示一条错误，**没有任何出路** ——
 *   用户只能刷新浏览器。现在给一个「重新加载」按钮，直接重跑 loadBaselineData()。
 *   （底层 loadBaseline 也修了：失败后会清掉 pending，否则重试只会拿到同一个 rejected promise。）
 */
export function ErrorBlock({ message, onRetry, onBack }) {
  const [retrying, setRetrying] = useState(false);
  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-6 py-8">
        <p className="text-base font-medium mb-2">基准数据没能加载</p>
        <p className="text-sm text-[var(--ink-soft)] leading-6">页面需要的数据暂时没有准备好。请先检查网络，再试一次；这不会替你填写或提交答卷。</p>
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
          {onBack && <button type="button" className="novice-secondary" onClick={onBack}>先回主页</button>}
        </div>
        <p className="novice-support-copy">仍然打不开？请把下面的问题详情提供给网站管理员。</p>
        <details className="novice-error-detail"><summary>查看问题详情</summary><p>{message}</p><p>网站管理员排查：确认 public/data/ 下的基准文件没有被删，并检查文件访问是否正常。</p></details>
      </div>
    </div>
  );
}
