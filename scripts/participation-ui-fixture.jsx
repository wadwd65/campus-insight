// Entry for an offline DOM regression harness; never imported by the app.
export {createRoot} from 'react-dom/client';
export {act,createElement} from 'react';
export {default as CampusTheatre} from '../src/components/CampusTheatre.jsx';
export {default as CampusKeepsake} from '../src/components/CampusKeepsake.jsx';
export {default as SurveyForm} from '../src/components/SurveyForm.jsx';
export {THEATRE_SCENES,keepsakeSvg,keepsakeMoments} from '../src/lib/campusMoments.js';
export {QUESTIONS} from '../src/lib/surveySchema.js';
export {previewAnswers} from '../src/lib/previewProfiles.js';
