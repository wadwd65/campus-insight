/** The opening film comes first; the interactive landing page follows. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore.js';
import { QUESTIONS } from '../lib/surveySchema.js';
import { LIGHT, preferCalm } from '../lib/terminalTheme.js';
import { SCENE_LAYERS, buildFloaters, buildLightRain, pickSceneBudget } from '../lib/introLayers.js';
import { startPush } from '../lib/introPush.js';
import { bindScenePointer } from '../lib/scenePointer.js';
import SceneOrnaments from '../components/SceneOrnaments.jsx';
import CampusNote from '../components/CampusNote.jsx';

export const OPENING_DURATION_MS = 6800;
const EXIT_MS = 520;
const at = (ms) => ({ animationDelay: `${ms}ms` });

export default function IntroScene({ baseline, onEnter }) {
  const enter = useGameStore((s) => s.enter);
  const calm = useMemo(() => preferCalm(), []);
  const budget = useMemo(() => calm ? { floaters: 0, rain: 0 } : pickSceneBudget(), [calm]);
  const floaters = useMemo(() => buildFloaters(budget.floaters), [budget]);
  const rain = useMemo(() => buildLightRain(budget.rain), [budget]);
  const stageRef = useRef(null);
  const sceneRef = useRef(null);
  const exitTimer = useRef(null);
  const finished = useRef(false);
  const [leaving, setLeaving] = useState(false);
  const [filmDone, setFilmDone] = useState(false);
  const [illuminated, setIlluminated] = useState(false);
  const complete = useRef(onEnter ?? enter);
  complete.current = onEnter ?? enter;

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    if (calm) { complete.current(); return; }
    setLeaving(true);
    exitTimer.current = window.setTimeout(() => complete.current(), EXIT_MS);
  }, [calm]);

  useEffect(() => {
    if (calm) return;
    return startPush(stageRef.current, OPENING_DURATION_MS, { onDone: () => setFilmDone(true) });
  }, [calm]);
  useEffect(() => () => window.clearTimeout(exitTimer.current), []);
  useEffect(() => bindScenePointer(sceneRef.current), []);

  useEffect(() => {
    function onKey(event) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key !== 'Enter' && event.key !== 'Escape') return;
      if (event.key === 'Enter' && event.target instanceof HTMLElement && event.target.closest('button, a, input, select, textarea')) return;
      event.preventDefault();
      finish();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  return <div ref={sceneRef} className={`cinematic-intro${leaving ? ' is-leaving' : ''}${calm ? ' is-calm' : ''}${illuminated ? ' is-illuminated' : ''}`} style={{ background: LIGHT.mist, color: LIGHT.ink, '--opening-duration': `${OPENING_DURATION_MS}ms` }}>
    <div className="intro-stage" ref={stageRef} style={{ '--push': 0 }} aria-hidden="true">
      {SCENE_LAYERS.map((layer) => <div key={layer.id} className={`intro-layer intro-layer-enter${layer.id === 'front' ? ' intro-layer-front' : ''}`} style={{ backgroundImage: `url(${import.meta.env.BASE_URL}art/${layer.asset})`, animationDelay: `${layer.depth * 160}ms`, transform: `scale(calc(1 + ${layer.zoom - 1} * var(--push))) translateX(calc(${layer.drift * (layer.depth % 2 === 0 ? 1 : -1)}px * var(--push)))` }} />)}
      <div className="absolute inset-0">{rain.map((r) => <span key={r.key} className="intro-rain" style={{ left: r.left, width: r.thickness, height: r.length, opacity: r.opacity, animationDuration: r.duration, animationDelay: r.delay, rotate: `${r.tilt}deg` }} />)}</div>
      <div className="absolute inset-0">{floaters.map((f) => <span key={f.key} className={`intro-floater${f.toRight ? '' : ' intro-floater-rev'}`} style={{ left: f.left, top: f.top, width: f.size, height: f.size, opacity: f.opacity, animationDuration: f.duration, animationDelay: f.delay, '--bob': `${f.bob}px`, '--spin': f.spin }}><span aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M2 17C-1 4 8 0 18 2c1 10-3 19-16 15Z" fill="currentColor" /></svg></span></span>)}</div>
    </div>
    <div className="intro-scrim" aria-hidden="true" />
    <div className="intro-title-scrim" aria-hidden="true" />
    <SceneOrnaments />
    <CampusNote />
    <header className="cinematic-header"><span>CAMPUS INSIGHT <small>OPENING / 01</small></span><button type="button" onClick={finish} disabled={leaving}>跳过动画 <span aria-hidden="true">↗</span></button></header>
    <main className="cinematic-center">
      <div className="intro-line cinematic-crest" style={at(450)}><Crest illuminated={illuminated} onToggle={() => setIlluminated((value) => !value)} /></div>
      <p className="intro-line cinematic-eyebrow" style={at(850)}>校园生活档案 · 个人记录与圈子收卷</p>
      <h1 className="intro-line intro-serif intro-glow" style={at(1400)}>你的大学<span>平行宇宙</span></h1>
      <p className="intro-line cinematic-subtitle" style={at(2300)}>每一种日常，都通向一个不同的你。</p>
      <p className="intro-line cinematic-meta" style={at(2900)}>{QUESTIONS.length} 道日常选择题 <span>一份属于你的校园档案</span></p>
    </main>
    <footer className="cinematic-footer">
      <div className="cinematic-caption"><span>{calm ? '已按系统设置减少动态效果' : filmDone ? '序章已就绪 · 点击进入首页' : '序章 · 正在走进你的校园'}</span><small>{baseline ? `${baseline.size} 条模拟基准记录已就绪` : '基准为模拟数据 · 非真实调查'}</small></div>
      <button type="button" className="cinematic-enter" onClick={finish} disabled={leaving}>进入首页 <span aria-hidden="true">→</span><small>或按 Enter</small></button>
      {!calm && <div className="cinematic-progress" aria-hidden="true"><span /></div>}
    </footer>
  </div>;
}

function Crest({ illuminated, onToggle }) {
  return <button type="button" className="crest-trigger" aria-label="点亮入场纹章" aria-pressed={illuminated} onClick={onToggle}>
    <span className="crest-halo" aria-hidden="true" />
    <svg width="104" height="104" viewBox="0 0 120 120" role="img" aria-label="终端纹章">
    <polygon points="60,4 108,32 108,88 60,116 12,88 12,32" fill="none" stroke="currentColor" strokeWidth=".8" opacity=".35" />
    <polygon points="60,20 96,40 96,80 60,100 24,80 24,40" fill="none" stroke="currentColor" strokeWidth=".8" opacity=".7" />
    <polygon className="crest-core" points="60,46 74,60 60,74 46,60" fill="currentColor" opacity=".85" />
    <circle className="term-orbit" cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth=".6" strokeDasharray="2 7" opacity=".45" />
    <path className="crest-rays" d="M60 0v12m0 96v12M0 60h12m96 0h12M17 17l8 8m70 70 8 8M17 103l8-8m70-70 8-8" stroke="currentColor" strokeWidth=".8" />
    </svg>
    <span className="crest-tooltip" aria-hidden="true">{illuminated ? '旅程已点亮' : '点亮这段旅程'}</span>
  </button>;
}

export const INTRO_FORBIDDEN_ASSETS = ['student-academic.webp', 'student-sporty.webp'];
export const INTRO_REQUIRED_ASSETS = SCENE_LAYERS.map((layer) => layer.asset);
export const INTRO_PALETTE_KEYS = Object.keys(LIGHT);
