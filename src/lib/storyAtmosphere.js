/** Presentation derives from fictional plot choices only, never survey answers. */
const SCENES={
  campus:{label:'操场边 · 晚风开场',mood:'campus',weather:'dry',musicScene:'story-start'},
  workshop:{label:'社团柜 · 灯光亮起',mood:'workshop',weather:'dry',musicScene:'story-workshop'},
  library:{label:'图书馆 · 一扇新窗口',mood:'library',weather:'dry',musicScene:'story-library'},
  social:{label:'群聊 · 有人回应了',mood:'social',weather:'dry',musicScene:'story-friends'},
  rain:{label:'操场入口 · 第一滴雨',mood:'rain',weather:'rain',musicScene:'story-rain'},
  indoor:{label:'白墙影院 · 投影开场',mood:'indoor',weather:'window',musicScene:'story-indoor'},
  corridor:{label:'连廊 · 雨声陪着放映',mood:'corridor',weather:'rain',musicScene:'story-corridor'},
  live:{label:'临时小舞台 · 把声音留下',mood:'live',weather:'window',musicScene:'story-live'},
  ticket:{label:'收起幕布 · 留好下一张票',mood:'ticket',weather:'window',musicScene:'story-ticket'},
};
export const STORY_CHOICE_EFFECTS={
  equipment:'blueprint',venue:'windows',friends:'messages',
  adapter:'projector',speaker:'sound',room:'windows',canopy:'canopy',tech:'signal',guitar:'notes',
  indoor:'projector',corridor:'canopy',live:'notes',ticket:'tickets',broadcast:'messages',small:'seats',
};
const EXTRA_EFFECTS={l_tag:'windows',l_receipt:'tickets',l_group:'messages',l_verify:'signal',l_runner:'messages',l_call:'sound',l_time:'blueprint',l_detail:'signal',l_wait:'windows',l_counter:'seats',l_meet:'messages',l_notice:'tickets',l_update:'messages',l_note:'tickets',r_check:'blueprint',r_owner:'messages',r_guide:'windows',r_tools:'signal',r_labels:'tickets',r_borrow:'sound',r_record:'messages',r_test:'sound',r_manual:'blueprint',r_revive:'notes',r_manual_end:'tickets',r_exhibit:'windows',r_steps:'blueprint',r_story:'tickets',b_field:'sound',b_message:'messages',b_page:'tickets',b_court:'sound',b_wind:'signal',b_mix:'notes',b_letter:'tickets',b_record:'sound',b_read:'notes',b_soundwalk:'sound',b_letter_end:'tickets',b_live:'notes',b_replay:'signal',b_thanks:'messages'};
export function storyAtmosphere(view){
  let scene='campus';const id=view.last?.choice.id;
  if(view.episode.id!=='screening'){
    scene=view.node?.scene||({lost:'library',repair:'workshop',radio:'live'}[view.episode.id]);
    const effect=(view.pending||view.ending)?(EXTRA_EFFECTS[id]||'none'):'none';
    return {...SCENES[scene],label:`${view.episode.title} · ${view.pending?view.last.place:view.node?.place||view.ending.title}`,effect,eventKey:view.episode.id+':'+view.steps.map(step=>step.choice.id).join('/')+':'+effect,episodeId:view.episode.id,title:view.episode.title,ending:!!view.ending};
  }
  const plan=[...view.flags].find(flag=>flag.startsWith('plan:'))?.slice(5);
  if(plan)scene={whitewall:'indoor',corridor:'corridor',live:'live',ticket:'ticket'}[plan];
  else if(!view.pending&&view.nodeId==='rain')scene='rain';
  else if(view.pending)scene={equipment:'workshop',venue:'library',friends:'social',adapter:'workshop',speaker:'workshop',room:'library',canopy:'library',tech:'social',guitar:'social'}[id]||'campus';
  else scene={equipment:'workshop',venue:'library',friends:'social'}[view.nodeId]||'campus';
  const effect=view.pending||view.ending?STORY_CHOICE_EFFECTS[id]||'none':scene==='rain'?'rain':'none';
  return {...SCENES[scene],effect,eventKey:view.steps.map(step=>step.choice.id).join('/')+':'+effect,ending:!!view.ending};
}
