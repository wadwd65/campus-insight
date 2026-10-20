import { CAMPUS_POSITIONS } from '../lib/campusJourney.js';

/** A quiet, code-native illustrated map. All interactive pins are HTML buttons. */
export default function CampusMapArt({ journey }) {
  return <svg viewBox="0 0 1000 640" preserveAspectRatio="none" className="campus-map-art" aria-hidden="true" fill="none">
    <rect width="1000" height="640" fill="#eef0de" />
    <path d="M0 0h540l-60 250L0 310Z" fill="#e2e9d2" /><path d="m540 0 460 0v470l-360-15-170-205Z" fill="#e0ead8" />
    <path d="M0 310 480 250l160 205 360 15v170H0Z" fill="#efe8ce" />
    <path d="M485-30c-65 150-12 228-37 335S430 540 525 680M-30 310c245-70 350 20 510-12s335-130 550-43" stroke="#d6d3bb" strokeWidth="29" />
    <path d="M485-30c-65 150-12 228-37 335S430 540 525 680M-30 310c245-70 350 20 510-12s335-130 550-43" stroke="#faf7e8" strokeWidth="21" />
    <path d="M120 100 420 100M760 140l90 120M140 410l280 30M550 510l300 40" stroke="#faf7e8" strokeWidth="12" strokeLinecap="round" />
    <path d="M650 340c30-32 118-27 145 8s-5 111-62 120-118-20-109-60 8-47 26-68Z" fill="#aecdc6" stroke="#92b9b0" strokeWidth="3" />
    <path d="m652 389 35-5m40 38 35-5m-57-57 26-3" stroke="#e5f1dc" strokeWidth="3" strokeLinecap="round" />
    <rect x="620" y="100" width="190" height="105" rx="50" fill="#bfd0a5" stroke="#93b18c" strokeWidth="3" />
    <rect x="638" y="116" width="155" height="73" rx="35" stroke="#f8f6de" strokeWidth="3" />
    <path d="M690 120v65m-40-32h130" stroke="#f8f6de" strokeWidth="2" />
    {Object.entries(CAMPUS_POSITIONS).filter(([id])=>!['lake','court','field','station'].includes(id)).map(([id,[x,y]],i)=><g key={id} transform={`translate(${x*10-30} ${y*6.4-18})`}>
      <rect x="5" y="7" width="64" height="36" rx="3" fill="#809179" opacity=".15" />
      <rect width="64" height="36" rx="3" fill={i%2?'#d7c9ab':'#bdcbb0'} stroke="#899b7d" strokeWidth="1.2" />
      <path d="M0 9h64M12 9v26m20-26v26m20-26v26" stroke="#f1f0d8" strokeWidth="2" />
    </g>)}
    {[[62,90],[118,175],[560,90],[910,85],[890,335],[570,375],[74,370],[274,390],[610,580],[917,575],[290,570],[60,570],[540,210],[924,190],[282,65]].map(([x,y],i)=><g key={x}>
      <ellipse cx={x+4} cy={y+9} rx="15" ry="9" fill="#8caa8433" /><circle cx={x} cy={y} r={i%2?13:17} fill={i%3?'#afc6a0':'#9db995'} stroke="#8ba780" strokeWidth="1" /><path d={`M${x} ${y+2}v18`} stroke="#8b9d74" strokeWidth="2" />
    </g>)}
    <g stroke="#7f9478" strokeWidth="1.3"><path d="M935 38v48m-12-31 12-17 12 17"/><circle cx="935" cy="62" r="27" opacity=".4"/></g>
    <text x="934" y="24" textAnchor="middle" fill="#667e60" fontSize="12">N</text>
    {journey.visits.length>1 && <polyline points={journey.visits.map((visit)=>{const [x,y]=CAMPUS_POSITIONS[visit.id];return `${x*10},${y*6.4}`;}).join(' ')} stroke="#967552" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity=".8" />}
  </svg>;
}
