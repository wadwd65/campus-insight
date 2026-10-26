// Entry for an offline DOM regression harness; never imported by the app.
export {createRoot} from 'react-dom/client';
export {act,createElement,useEffect} from 'react';
export {default as CampusTheatre} from '../src/components/CampusTheatre.jsx';
export {default as CampusKeepsake} from '../src/components/CampusKeepsake.jsx';
export {default as SurveyForm} from '../src/components/SurveyForm.jsx';
export {THEATRE_SCENES,keepsakeSvg,keepsakeMoments} from '../src/lib/campusMoments.js';
export {JOURNEY_QUESTIONS as QUESTIONS} from '../src/lib/surveyJourney.js';
export {previewAnswers} from '../src/lib/previewProfiles.js';
export {default as ExperienceSettings} from '../src/components/ExperienceSettings.jsx';
export {useExperience} from '../src/components/ExperienceSettings.jsx';
export {default as IndustrialBackdrop} from '../src/components/IndustrialBackdrop.jsx';
export {default as CampusFieldLog} from '../src/components/CampusFieldLog.jsx';
export {default as CampusCompanion} from '../src/components/CampusCompanion.jsx';
export {default as CampusStory} from '../src/components/CampusStory.jsx';
export {default as CampusStoryEntry} from '../src/components/CampusStoryEntry.jsx';
export {default as StoryAtmosphere,StoryStage} from '../src/components/StoryAtmosphere.jsx';

export {default as JourneyContinuity} from '../src/components/JourneyContinuity.jsx';
export {default as MapScene} from '../src/scenes/MapScene.jsx';
export {default as LandingContent} from '../src/components/LandingContent.jsx';
export {default as App} from '../src/App.jsx';
export {useGameStore} from '../src/store/useGameStore.js';

export {default as CampusDay,CampusDayResult} from '../src/components/CampusDay.jsx';
export {default as CampusDayEntry} from '../src/components/CampusDayEntry.jsx';

export {renderToStaticMarkup} from 'react-dom/server';
export {default as CampusMapArt} from '../src/components/CampusMapArt.jsx';
