import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {EGG_CLICKS,EGG_WINDOW_MS,EGG_GREET,EGG_NO_DATA} from '../lib/egg.js';
import {clampCompanionPosition,readCompanionPosition,restoreCompanionPosition,saveCompanionPosition,clearCompanionPosition} from '../lib/companionPosition.js';
const LINES=['我回来了。这一站，按你的真实日常选就好。','答题没有标准答案；想改主意，可以回上一题。','可以先暂停，进度暂存在当前标签页。','音乐在上方曲库里。想安静一点，也随时能关。'];
const DAY_LINES=['先点地图或行动卡预览，确认之后才出发。','带来的工具、伞和同伴，会影响后面的去处。','想改路线，可以在下方退回一个决定。','地图一天不用加入圈子；正式填报再去班级/社团工具。'];
const usePlacementEffect=typeof window==='undefined'?useEffect:useLayoutEffect;
function storage(){try{return window.localStorage;}catch{return null;}}
function viewport(){return {width:window.innerWidth,height:window.innerHeight};}
function sizeOf(element){const box=element.getBoundingClientRect();return {width:Math.max(box.width,Math.min(138,window.innerWidth-16)),height:box.height};}

export default function CampusCompanion({moving=false,notice,eggData=null,mode='entry'}){
  const [folded,setFolded]=useState(false),[step,setStep]=useState(0),[broken,setBroken]=useState(false),[showLine,setShowLine]=useState(false),[localBeat,setLocalBeat]=useState(0),[dismissedNotice,setDismissedNotice]=useState(null);
  const [position,setPosition]=useState(null),[dragging,setDragging]=useState(false),[bubblePosition,setBubblePosition]=useState(null),[viewportRevision,setViewportRevision]=useState(0);
  const [eggOpen,setEggOpen]=useState(false),[actionDone,setActionDone]=useState(false),[actionError,setActionError]=useState(false);
  const container=useRef(null),message=useRef(null),gesture=useRef(null),currentPosition=useRef(null),suppressClick=useRef(false),stamps=useRef([]);
  const foldedState=useRef(false);foldedState.current=folded;
  const noticeActive=Boolean(notice&&notice.id!==dismissedNotice),line=noticeActive?notice.text:(mode==='day'?DAY_LINES:LINES)[step%LINES.length];

  function place(next,persist=false){
    if(!container.current)return;
    const view=viewport(),size=sizeOf(container.current),safe=clampCompanionPosition(next,view,size);
    currentPosition.current=safe;setPosition(safe);
    if(persist)saveCompanionPosition(storage(),safe,view,size);
  }
  function finishDrag(event,cancelled=false){
    const active=gesture.current;
    if(!active||(event&&event.pointerId!==active.id))return;
    gesture.current=null;setDragging(false);
    suppressClick.current=cancelled||active.moved;
    try{active.target.releasePointerCapture?.(active.id);}catch{/* Capture may already be released. */}
    if(active.moved&&currentPosition.current&&container.current)saveCompanionPosition(storage(),currentPosition.current,viewport(),sizeOf(container.current));
  }
  usePlacementEffect(()=>{
    const saved=readCompanionPosition(storage()),restored=restoreCompanionPosition(saved,viewport(),sizeOf(container.current));
    if(restored){currentPosition.current=restored;setPosition(restored);}
    const resize=()=>{finishDrag(null,true);if(currentPosition.current){if(foldedState.current)setPosition(clampCompanionPosition(currentPosition.current,viewport(),sizeOf(container.current)));else place(currentPosition.current,true);}setViewportRevision(v=>v+1);};
    const cancel=()=>finishDrag(null,true);
    window.addEventListener('resize',resize);window.addEventListener('blur',cancel);
    return ()=>{window.removeEventListener('resize',resize);window.removeEventListener('blur',cancel);const active=gesture.current;gesture.current=null;try{active?.target.releasePointerCapture?.(active.id);}catch{}};
  },[]);
  useEffect(()=>{stamps.current=[];setEggOpen(false);setActionDone(false);setActionError(false);},[eggData]);
  usePlacementEffect(()=>{if(currentPosition.current){if(folded)setPosition(clampCompanionPosition(currentPosition.current,viewport(),sizeOf(container.current)));else place(currentPosition.current,true);}},[folded]);
  usePlacementEffect(()=>{
    if(folded||!message.current||!container.current)return;
    const anchor=container.current.getBoundingClientRect(),box=message.current.getBoundingClientRect(),view=viewport();
    const width=box.width||205,height=box.height||(eggOpen?240:110);
    const preferred=anchor.left>=width+18?anchor.left-width-10:anchor.right+10;
    const x=Math.max(8,Math.min(view.width-width-8,preferred)),y=Math.max(8,Math.min(view.height-height-8,anchor.top+20));
    setBubblePosition({x,y});
  },[position,folded,eggOpen,showLine,noticeActive,notice,localBeat,eggData,viewportRevision,actionDone,actionError]);

  function startDrag(event){
    if(event.isPrimary===false||(event.button!==undefined&&event.button!==0)||gesture.current)return;
    const box=container.current.getBoundingClientRect();
    suppressClick.current=false;
    gesture.current={id:event.pointerId,target:event.currentTarget,startX:event.clientX,startY:event.clientY,x:box.left,y:box.top,moved:false};
    try{event.currentTarget.setPointerCapture?.(event.pointerId);}catch{/* Pointer events still work without capture. */}
  }
  function moveDrag(event){
    const active=gesture.current;if(!active||active.id!==event.pointerId)return;
    const dx=event.clientX-active.startX,dy=event.clientY-active.startY;
    if(!active.moved&&Math.hypot(dx,dy)<6)return;
    active.moved=true;setDragging(true);event.preventDefault();place({x:active.x+dx,y:active.y+dy});
  }
  function resetPosition(){finishDrag(null,true);currentPosition.current=null;setPosition(null);clearCompanionPosition(storage());}
  function moveWithKeys(event){
    if(event.key==='Home'){event.preventDefault();resetPosition();return;}
    const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    if(!direction)return;
    event.preventDefault();const box=container.current.getBoundingClientRect(),distance=event.shiftKey?40:16;
    place({x:box.left+direction[0]*distance,y:box.top+direction[1]*distance},true);
  }
  function poke(event){
    const ignored=suppressClick.current;suppressClick.current=false;
    if(ignored&&event.detail!==0)return;
    const now=Date.now();stamps.current=[...stamps.current,now].filter(time=>now-time<EGG_WINDOW_MS);
    if(stamps.current.length>=EGG_CLICKS){stamps.current=[];setEggOpen(true);setActionDone(false);setActionError(false);}
    setStep(v=>v+1);setShowLine(true);setLocalBeat(v=>v+1);setDismissedNotice(notice?.id);
  }
  function closeMessage(){setShowLine(false);setEggOpen(false);setDismissedNotice(notice?.id);}
  function runEggAction(){
    try{eggData?.action?.run();if(eggData?.action?.kind==='download')setActionDone(true);setActionError(false);}
    catch{setActionError(true);}
  }
  const dragEvents={onPointerDown:startDrag,onPointerMove:moveDrag,onPointerUp:finishDrag,onPointerCancel:event=>finishDrag(event,true),onLostPointerCapture:event=>finishDrag(event,true)};
  return <aside ref={container} className={`campus-companion ${moving?'is-moving':'is-still'} ${folded?'is-folded':''} ${dragging?'is-dragging':''} ${position?'has-position':''}`} style={position?{left:position.x,top:position.y,right:'auto',bottom:'auto'}:undefined} aria-label="校园同行小人">
    {folded?<button type="button" className="companion-reopen" onClick={()=>setFolded(false)}>打开同行小人 ↗</button>:<>
      <div className="companion-tools"><button type="button" className="companion-drag" {...dragEvents} onKeyDown={moveWithKeys} aria-label="移动小人：拖动或用方向键，Home归位" title="按住立绘拖动；也可用方向键微调">↔ 移动</button><button type="button" className="companion-reset" onClick={resetPosition} aria-label="小人回到原位">归位</button><button type="button" className="companion-hide" onClick={()=>{closeMessage();setFolded(true);}} aria-label="收起同行小人">收起 −</button></div>
      <button type="button" className="companion-hit" {...dragEvents} onClick={poke} aria-label="和同行小人打个招呼" title="按住拖动换位置；点一点，或许有惊喜">
        <span className="companion-breath"><span className={`companion-pose ${eggOpen?'is-egg':''}`} key={`${notice?.id||0}-${localBeat}`}>
          {broken?<span className="companion-fallback" aria-hidden="true">✦</span>:<img src={`${import.meta.env.BASE_URL}art/mascot.webp`} alt="" width="152" height="520" draggable="false" onError={()=>setBroken(true)}/>}
        </span></span><span className="companion-name">同行 / FIELD GUIDE</span>
      </button>
      {(eggOpen||noticeActive||showLine)&&<div ref={message} className={`companion-message ${eggOpen?'companion-egg':''}`} style={bubblePosition?{left:bubblePosition.x,top:bubblePosition.y,right:'auto',bottom:'auto',transform:'none'}:undefined}><strong>{eggOpen?'发现隐藏彩蛋':'校园同行'}</strong>
        {eggOpen?<><p role="status">{EGG_GREET}</p><p className="companion-egg-quip">{eggData?.quip||EGG_NO_DATA}</p>{eggData?.action&&<button type="button" className="companion-egg-action" onClick={runEggAction}>{actionDone?'已下载档案 ↓':eggData.action.label}</button>}{actionError&&<p role="alert">刚才没能完成，请再试一次。</p>}</>:<p role={showLine&&!noticeActive?'status':undefined} aria-live={showLine&&!noticeActive?'polite':'off'}>{line}</p>}
        <button type="button" className="companion-dismiss" aria-label="关闭同行提示" onClick={closeMessage}>×</button></div>}
    </>}
  </aside>;
}
