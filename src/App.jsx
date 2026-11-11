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
import { clearAccountDrafts, clearSurveyDraft, readSurveyDraft, saveSurveyDraft } from './lib/surveyDraft.js';
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
  const [cohort, setCohort] = useState(null);
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
  const [fromCohort, setFromCohort] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [mapRun, setMapRun] = useState(false);
  const player = useGameStore((s) => s.player);
  const [quizSnapshot, setQuizSnapshot] = useState(null);
  const [previousAccount, setPreviousAccount] = useState(undefined);
  const [pendingGuestReport, setPendingGuestReport] = useState(null);

  useEffect(() => {
    if (!['ready', 'offline'].includes(account.status)) return;
    const id = account.user?.id || null;
    if (previousAccount === id) return;
    if (previousAccount !== undefined && previousAccount !== id) {
      const guestSnapshot = previousAccount === null && id ? readSurveyReportSnapshot(undefined, null) : null;
      if (previousAccount) clearAccountDrafts(previousAccount);
      else clearSurveyDraft();
      clearSurveyReport(undefined, previousAccount);
      setPendingGuestReport(guestSnapshot ? { targetUserId: id, answers: guestSnapshot.answers, dayContext: guestSnapshot.dayContext } : null);
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

  const activeGuestCarryover = pendingGuestReport && account.user?.id && pendingGuestReport.targetUserId === account.user.id ? pendingGuestReport : null;
  function carryoverGuestReport() {
    if (!activeGuestCarryover) return;
    const { answers: guestAnswers, dayContext } = activeGuestCarryover;
    setPendingGuestReport(null);
    finishQuiz(guestAnswers, null, dayContext);
  }
  function dismissGuestReport() {
    setPendingGuestReport(null);
  }

  const eggQuip = useMemo(
    () =>
      buildEggQuip({
        answers: mapRun ? undefined : answers,
        attributes: player.attributes,
        baseline,
      }),
    [answers, mapRun, player.attributes, baseline],
  );

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

  function loadBaselineData() {
    setError(null);
    setBaseline(null);
    loadBaseline()
      .then((d) => setBaseline(d.baseline))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadBaselineData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function backToMap() {
    setFromCohort(false);
    setStage('map');
  }

  function goEntry() {
    setFromCohort(false);
    setStage('entry');
  }

  function startQuiz(context) {
    const scope = account.user?.id || '';
    const draft = readSurveyDraft(undefined, scope);
    const nextDayContext = cleanDaySurveyContext(context?.dayProgress) || cleanDaySurveyContext(draft?.dayContext);
    const completedAnswers = validSurveyAnswers(answers);
    const suggestionOnlyDraft = Array.isArray(draft?.confirmedFields) && draft.confirmedFields.length === 0 && Object.keys(draft.answers).length > 0;
    // A completed questionnaire clears its draft. Re-entering from the map must
    // carry those deliberate answers forward, without replacing a newer draft.
    if (nextDayContext && completedAnswers && (!draft || suggestionOnlyDraft)) {
      saveSurveyDraft(0, completedAnswers, undefined, scope, null, nextDayContext, Object.keys(completedAnswers));
    }
    setSurveyDayContext(nextDayContext);
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

  function restart() {
    setPendingGuestReport(null);
    setSurveyDayContext(null);
    setReportDayContext(null);
    setStoryContext(null);
    setCircleContext(null);
    resetPlayer();
    setAnswers(null);
    clearSurveyReport(undefined, account.user?.id);
    setQuizSnapshot(null);
    setFromCohort(false);
    setMapRun(false);
    setCohort(null);
    setError(null);
    setName('');
    setStage('map');
  }

  function finishQuiz(a,context,dayContext=null) {
    a = validSurveyAnswers(a);
    if (!a) return;
    setPendingGuestReport(null);
    const cleanDay=cleanDaySurveyContext(dayContext);
    setSurveyDayContext(cleanDay);
    setReportDayContext(cleanDay);
    saveSurveyReport(a, undefined, account.user?.id, cleanDay);
    setStoryContext(cleanStoryReflection(context));
    setAnswers(a);
    setMapRun(false);

    resetPlayer();
    for (const q of QUESTIONS) {
      const vec = vectorOf(q.field, a[q.field]);
      if (vec) applyChoice({ id: `${q.field}=${a[q.field]}`, label: q.text, delta: vec });
    }

    setQuizSnapshot({ ...useGameStore.getState().player.attributes });

    const slots = slotsForPercents(buildReport(a, baseline)?.percents);
    if (slots) useGameStore.getState().setSlotsPerDay(slots);

    if (fromCohort) {
      setFromCohort(false);
      setStage('cohort');
    } else {
      setStage('report');
    }
  }

  function goMapFromReport() {
    setMapRun(true);
    setStage('map');
  }

  if (scene === 'intro') return <IntroScene baseline={baseline}
    onEnter={() => { goEntry(); useGameStore.getState().enter(); }} />;

  if (stage === 'entry') {
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
            accountLabel={account.user ? `${account.user.displayName} · 我的圈子` : '登录 / 注册'}
            onGoUpload={() => setStage('upload')}
            onPreviewSample={previewSample}
            sampleBusy={sampleBusy}
            sampleError={sampleError}
            onGoMap={() => setStage('map')}
            onGoStory={episodeId => openStory('entry',episodeId)}
            eggQuip={eggQuip}
            eggAction={eggAction}
            pendingGuestReport={activeGuestCarryover}
            onCarryoverGuestReport={carryoverGuestReport}
            onDismissGuestReport={dismissGuestReport}
          />
        </div>
      </div>
    );
  }

  if (['day','day-report'].includes(stage)) {
    return <div className="min-h-full flex flex-col term-enter stage-day"><IndustrialBackdrop/><HubHud compact statusLabel="可选探索 · 地图一天" onGoEntry={goEntry} onGoCircles={()=>setStage('circles')} accountLabel={account.user?`${account.user.displayName} · 我的圈子`:'登录 / 注册'}/><main className="day-page-main"><Suspense fallback={<Hint text="正在展开今天的地图…"/>}>{stage==='day-report'&&dayRun?<CampusDayResult progress={dayRun} onBack={startDay} onGoQuiz={()=>startQuiz({dayProgress:dayRun})}/>:<CampusDay key={account.user?.id||'guest'} scope={account.user?.id||'guest'} onExit={goEntry} onGoQuiz={progress=>startQuiz({dayProgress:progress})} onComplete={finishDay}/>}</Suspense></main><ProductFooter/></div>;
  }

  if (stage === 'map') {
    return (
      <div className="min-h-full flex flex-col term-enter">
        <IndustrialBackdrop />
        <HubHud onRestart={restart} onGoEntry={goEntry} onGoCircles={() => setStage('circles')} accountLabel={account.user ? `${account.user.displayName} · 我的圈子` : '登录 / 注册'} help={<GettingStartedGuide onStartPersonal={startQuiz} onOpenCircles={() => setStage('circles')} />} compact statusLabel="行动地图" />
        <main className="flex-1 w-full">
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
      <HubHud compact statusLabel={{ circles: '我的圈子', quiz: '问卷测评', gate: '准备作答', upload: '数据导入', cohort: '群体分析', report: '档案已生成', story: '校园小剧场' }[stage]} onRestart={restart} onGoEntry={goEntry} onGoCircles={() => setStage('circles')} accountLabel={account.user ? `${account.user.displayName} · 我的圈子` : '登录 / 注册'} help={stage !== 'circles' ? <GettingStartedGuide context={circleContext ? 'circles' : 'home'} onStartPersonal={startQuiz} onOpenCircles={() => setStage('circles')} /> : null} />
      <div className="term-seam" aria-hidden="true" />

      <main
        className={
          stage === 'report'
            ? 'flex-1 w-full'
            : `app-content flex-1 w-full max-w-5xl mx-auto px-6 ${stage === 'circles' ? 'app-circles py-8' : stage === 'quiz' ? 'py-6' : 'py-12'}`
        }
      >
        {activeGuestCarryover && (
          <section className="guest-report-carryover" role="region" aria-label="承接登录前的访客答卷">
            <div>
              <strong>发现你登录前刚完成的十题个人答卷</strong>
              <p>是否把刚才这份访客答卷带入当前账号（{account.user.displayName}）？带入后可直接查看个人报告，或在核对并明确同意后提交到圈子；不会自动交卷。</p>
            </div>
            <div className="guest-report-carryover-actions">
              <button type="button" className="carryover-confirm" onClick={carryoverGuestReport}>带入刚才这份答卷 →</button>
              <button type="button" className="carryover-dismiss" onClick={dismissGuestReport}>不带入，重新填写</button>
            </div>
          </section>
        )}
        {stage === 'story' ? <Suspense fallback={<Hint text="正在接上这段故事…" />}><CampusStory onStartDay={startDay} initialEpisode={storyEpisodeId} key={account.user?.id||'guest'} scope={account.user?.id||'guest'} onBack={()=>setStage(storyOrigin.current==='report'&&(answers||mapRun)?'report':storyOrigin.current==='map'?'map':'entry')} onGoQuiz={startQuiz}/></Suspense> : stage === 'circles' ? (
          <Suspense fallback={<Hint text="正在打开圈子…" />}><div className="circle-workspace"><div className={account.user ? "novice-help-strip" : "circle-auth-help"}>{account.user && <span>不确定下一步？可以先看指引，也可以直接操作。</span>}<GettingStartedGuide autoShow={Boolean(account.user)} context="circles" onStartPersonal={startQuiz} onOpenCircles={() => setStage('circles')} /></div><CircleWorkspace key={account.user?.id || 'guest'} pendingInvite={pendingInvite} onInviteHandled={() => setPendingInvite('')} baseline={baseline} onSkip={startQuiz} onPreviewSample={previewSample} sampleBusy={sampleBusy} sampleError={sampleError} onStartQuiz={context => { setCircleContext(context); setAnswers(null); setFromCohort(false); setMapRun(false); setStage('quiz'); }} /><DeploymentHelp /></div></Suspense>
        ) : error ? (
          <ErrorBlock message={error} onRetry={loadBaselineData} onBack={goEntry} />
        ) : !baseline ? (
          <Hint text="正在加载基准人群数据…" />
        ) : stage === 'gate' ? (
          <QuizGate onStart={() => setStage('quiz')} onBack={() => fromCohort ? setStage('cohort') : backToMap()} backLabel={fromCohort ? '班级画像' : '校园地图'} />
        ) : stage === 'quiz' ? (
          <><SurveyForm dayContext={surveyDayContext} storyContext={storyContext} key={circleContext ? `${circleContext.userId}:${circleContext.id}` : (account.user?.id || 'guest')} draftScope={circleContext ? `${circleContext.userId}:${circleContext.id}` : (account.user?.id || '')} contextLabel={circleContext ? `正在为「${circleContext.name}」填报；完成后需确认提交。` : ''} onComplete={finishQuiz} onPause={circleContext ? () => setStage('circles') : goEntry} onCancel={() => setStage(circleContext ? 'circles' : fromCohort ? 'cohort' : 'entry')} /></>
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
              trail={mapRun ? player.trail : player.trail.filter(entry => !entry.at)}
              baseline={baseline}
              name={name}
              quizSnapshot={quizSnapshot}
              onStartDay={mapRun ? undefined : startDay}
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
              ownAnswers={answers}
              onOpenReport={answers ? () => { setMapRun(false); setStage('report'); } : undefined}
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
          <FallbackToHome onBack={goEntry} />
        )}
      </main>

      <ProductFooter />
    </div>
  );
}

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
