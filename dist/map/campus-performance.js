// Measures actual rendered animation-frame intervals. Idle water redraws never
// become a fabricated low FPS reading, and this meter schedules no callbacks.
export function createFrameMeter(windowMs=1000){
  let started=null,last=null,intervals=[];
  return {
    reset(){started=last=null;intervals=[];},
    frame(time,active){
      if(!active){this.reset();return null;}
      if(last===null){started=last=time;return null;}
      const dt=time-last;last=time;if(dt<=0)return null;intervals.push(dt);
      const elapsed=time-started;if(elapsed<windowMs)return null;
      const sorted=[...intervals].sort((a,b)=>a-b),stats={fps:intervals.length*1000/elapsed,p95:sorted[Math.ceil(sorted.length*.95)-1],frames:intervals.length,elapsed,suspectedThrottle:intervals.filter(ms=>ms>=850&&ms<=1150).length>=intervals.length*.8};
      started=time;intervals=[];return stats;
    },
  };
}
