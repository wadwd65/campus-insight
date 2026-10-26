/** Main flow: understand the sample, then choose personal assessment or circle collection. */
import { lazy, Suspense, useEffect, useRef } from 'react';
import Mascot from '../components/Mascot.jsx';
import LandingContent from '../components/LandingContent.jsx';
import SceneOrnaments from '../components/SceneOrnaments.jsx';
import { bindScenePointer } from '../lib/scenePointer.js';
const Atmosphere = lazy(() => import('../components/Atmosphere.jsx'));

export default function EntryScene({ baseline, onGoQuiz, onGoUpload, onGoMap, onGoCircles, onPreviewSample, sampleBusy, sampleError, accountLabel, onReplayIntro, eggQuip, eggAction }) {
  const sceneRef = useRef(null);
  useEffect(() => bindScenePointer(sceneRef.current), []);
  return <div ref={sceneRef} className="entry-page landing-page">
    <div className="entry-sky" aria-hidden="true" />
    <SceneOrnaments variant="landing" />
    <Suspense fallback={null}><Atmosphere variant="plain" zIndex={0} /></Suspense>
    <LandingContent baseline={baseline} onGoQuiz={onGoQuiz} onGoUpload={onGoUpload} onGoMap={onGoMap} onGoCircles={onGoCircles} onPreviewSample={onPreviewSample} sampleBusy={sampleBusy} sampleError={sampleError} accountLabel={accountLabel} onReplayIntro={onReplayIntro} />
    <Mascot src={`${import.meta.env.BASE_URL}art/mascot.webp`} quip={eggQuip?.text ?? null} onQuipAction={eggAction?.run} actionLabel={eggAction?.label} />
  </div>;
}
