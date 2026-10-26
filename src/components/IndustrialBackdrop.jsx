import {memo,useId} from 'react';
import {useExperience} from './ExperienceSettings.jsx';

function IndustrialBackdrop(){
  const {moving}=useExperience(),id=useId().replace(/:/g,'');
  return <div className={`industrial-backdrop ${moving?'is-moving':'is-still'}`} aria-hidden="true">
    <div className="industrial-haze"/>
    <div className="industrial-plan"><svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"><defs><pattern id={`${id}-grid`} width="80" height="80" patternUnits="userSpaceOnUse"><path d="M80 0H0V80" fill="none" stroke="#6a7882" strokeWidth=".65" opacity=".22"/></pattern><pattern id={`${id}-hatch`} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0V12" stroke="#b38b50" opacity=".24" strokeWidth="3"/></pattern></defs>
      <rect width="1600" height="1000" fill={`url(#${id}-grid)`}/>
      <g fill="none" stroke="#74838c" strokeWidth="1.2" opacity=".32"><path d="M910 115h430v162h-86v94h-272v-94h-72Z"/><path d="M935 142h380v108h-88v95h-220v-95h-72Z"/><path d="M1020 112v260m160-260v260m165-175h125v410H925v250H650"/><rect x="1060" y="445" width="255" height="166"/><rect x="1080" y="465" width="215" height="126"/><ellipse cx="1300" cy="795" rx="165" ry="105"/><ellipse cx="1300" cy="795" rx="142" ry="82"/><path d="M1135 795h330m-165-105v210M95 205h270v110H95Zm18 16h80v75h-80Zm100 0h133v75H213ZM110 650h210v155H110Z"/>
      <path d="M760 0v1000M0 760h1600" strokeDasharray="3 9"/><circle cx="760" cy="760" r="140"/><circle cx="760" cy="760" r="149" strokeDasharray="1 18"/></g>
      <g fill="#6d7d87" opacity=".4" fontFamily="monospace" fontSize="11" letterSpacing="3"><text x="935" y="96">01 / LEARNING BLOCK</text><text x="1060" y="431">02 / COMMON GROUND</text><text x="1130" y="936">03 / AFTER HOURS</text><text x="114" y="840">CAMPUS / FIELD NOTES</text></g>
      <g fill={`url(#${id}-hatch)`}><path d="M1395 90h64v220h-64Z"/><path d="M100 880h260v35H100Z"/></g>
      <g fill="none" stroke="#ad824b" strokeWidth="2" opacity=".45"><path d="M972 106h-26v26m400 228v26h-26M1123 780v30m-15-15h30M347 195h28v28"/></g>
    </svg></div>
    <div className="industrial-drift"><svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="#9c7c53" opacity=".25"><path d="m1030 20 410 240-260 450Z"/><path d="m970 40 400 234-256 449Z"/><circle cx="1370" cy="760" r="200"/><path d="m100 960 180-210 150 210Z"/></g><path d="M1060 80 1420 286 1200 635Z" fill="#c8c1b0" opacity=".08"/><path d="M119 150h120m-60-60v120" stroke="#748b98" opacity=".25"/></svg></div>
  </div>;
}
export default memo(IndustrialBackdrop);
