import catalog from '../data/musicCatalog.json' with {type:'json'};
export function motionAllowed({ hidden=false, reduced=false, compact=false, paused=false }={}) {
  return !hidden && !reduced && !compact && !paused;
}
export const AMBIENT_TRACKS = catalog.tracks;
// Page context only: answers, scores and personal data never select the mood.
export const MUSIC_SCENES = {
  welcome:{title:'轻快启程',tracks:['heiyao-sunlight','happy-moments','heiyao-comedy']},
  focus:{title:'安静专注',tracks:['heiyao-dawn','synthwave4k','heiyao-bamboo']},
  reflection:{title:'温暖回望',tracks:['vaporware','heiyao-bamboo','heiyao-dawn']},
  explore:{title:'活力探索',tracks:['lofi-jam','heiyao-comedy','happy-beat']},
  'story-start':{title:'晚风开场',tracks:['heiyao-sunlight','happy-moments']},
  'story-workshop':{title:'忙着救场',tracks:['heiyao-comedy','happy-beat','lofi-jam']},
  'story-library':{title:'窗边与书页',tracks:['heiyao-bamboo','heiyao-dawn']},
  'story-friends':{title:'朋友来搭把手',tracks:['lofi-jam','heiyao-comedy']},
  'story-rain':{title:'雨落下来了',tracks:['lofi-jam','heiyao-dawn','heiyao-bamboo']},
  'story-indoor':{title:'白墙亮起',tracks:['vaporware','heiyao-dawn']},
  'story-corridor':{title:'雨棚下的电影',tracks:['heiyao-bamboo','lofi-jam']},
  'story-live':{title:'今晚先来点声音',tracks:['heiyao-comedy','lofi-jam','happy-beat']},
  'story-ticket':{title:'把下一次留好',tracks:['heiyao-dawn','happy-moments']},
};
export function musicScene(stage){
  if(Object.hasOwn(MUSIC_SCENES,stage))return stage;
  if(stage==='story')return 'story-start';
  if(['quiz','gate','upload','cohort'].includes(stage))return 'focus';
  if(stage==='report')return 'reflection';
  if(stage==='map')return 'explore';
  return 'welcome';
}
export function sceneTrackIndex(stage){
  return sceneTrackIndices(stage)[0];
}
export function sceneTrackIndices(stage){
  const indices=MUSIC_SCENES[musicScene(stage)].tracks.map(id=>AMBIENT_TRACKS.findIndex(track=>track.id===id)).filter(index=>index>=0);
  return indices.length?indices:[0];
}
export function nextSceneTrackIndex(index,stage){const pool=sceneTrackIndices(stage);return pool[(pool.indexOf(index)+1)%pool.length];}
export const AMBIENT_TRACK = AMBIENT_TRACKS[sceneTrackIndex('entry')].file;
export const AMBIENT_VOLUME = 0.18;
export function playbackVolume(index,volume){const rms=AMBIENT_TRACKS[index]?.decodedRms||.085;return Math.min(.5,Math.max(0,volume))*Math.min(1,.085/rms);}
export function nextTrackIndex(index,mode='cycle',random=Math.random){
  if(mode==='single')return index;
  if(mode==='shuffle')return (index+1+Math.min(AMBIENT_TRACKS.length-2,Math.max(0,Math.floor(random()*(AMBIENT_TRACKS.length-1)))))%AMBIENT_TRACKS.length;
  return (index+1)%AMBIENT_TRACKS.length;
}
