import {drawDetailedGround,drawFacadeAtlas} from './campus-detail.js';

export function teachingTexture(c,w,h){drawFacadeAtlas(c,w,h);}
export function dormTexture(c,w,h){drawFacadeAtlas(c,w,h,{dorm:true});}
export function roadTexture(c,w,h){
  c.fillStyle='#646969';c.fillRect(0,0,w,h);
  for(let i=0;i<4000;i++){c.fillStyle=i%2?'#ffffff06':'#15212b0a';c.fillRect((i*73%w),(i*127%h),1,1);}
  c.fillStyle='#d2d2bd';c.fillRect(3,0,1.5,h);c.fillRect(w-4.5,0,1.5,h);
  c.fillStyle='#ddc57f';for(let y=16;y<h;y+=64)c.fillRect(w/2-1,y,2,29);
}
export function groundTexture(c,w,h){drawDetailedGround(c,w,h);}
function roundRect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();}
export function trackTexture(c,w,h){
  c.fillStyle='#c8d3ae';c.fillRect(0,0,w,h);roundRect(c,18,12,w-36,h-24,(w-36)/2);c.fillStyle='#b77364';c.fill();
  for(let i=0;i<8;i++){const inset=26+i*7;roundRect(c,inset,inset,w-inset*2,h-inset*2,(w-inset*2)/2);c.strokeStyle='#efdfc8';c.lineWidth=1.5;c.stroke();}
  roundRect(c,83,80,w-166,h-160,(w-166)/2);c.fillStyle='#829e77';c.fill();
  for(let row=0;row<12;row++){c.fillStyle=row%2?'#618b64':'#769b6d';c.fillRect(122,155+row*(h-310)/12,w-244,(h-310)/12);}
  c.strokeStyle='#e4e9d1';c.lineWidth=3;c.strokeRect(122,155,w-244,h-310);c.beginPath();c.moveTo(122,h/2);c.lineTo(w-122,h/2);c.stroke();c.beginPath();c.arc(w/2,h/2,36,0,Math.PI*2);c.stroke();
  for(const side of [-1,1]){const y=side<0?155:h-155,dy=side<0?1:-1;c.strokeRect(w/2-68,Math.min(y,y+dy*67),136,67);c.strokeRect(w/2-32,Math.min(y,y+dy*25),64,25);c.beginPath();c.arc(w/2,y+dy*49,2,0,Math.PI*2);c.fillStyle='#e4e9d1';c.fill();}
}
export function courtTexture(c,w,h){c.fillStyle='#adc3cd';c.fillRect(0,0,w,h);c.fillStyle='#739aab';c.fillRect(35,50,w-70,h-100);c.strokeStyle='#eef0dc';c.lineWidth=2;c.strokeRect(35,50,w-70,h-100);c.strokeRect(56,50,w-112,h-100);c.strokeRect(56,h*.28,w-112,h*.44);c.beginPath();c.moveTo(35,h/2);c.lineTo(w-35,h/2);c.moveTo(w/2,h*.28);c.lineTo(w/2,h*.72);c.stroke();}
export function basketballTexture(c,w,h){
  c.fillStyle='#6d9f77';c.fillRect(0,0,w,h);c.fillStyle='#bd677b';c.fillRect(w*.32,24,w*.36,h*.2);c.fillRect(w*.32,h*.8-24,w*.36,h*.2);c.beginPath();c.arc(w/2,h/2,w*.12,0,Math.PI*2);c.fill();
  c.strokeStyle='#efe9d5';c.lineWidth=2;c.strokeRect(22,24,w-44,h-48);c.beginPath();c.moveTo(22,h/2);c.lineTo(w-22,h/2);c.stroke();
  for(const y of [h*.22,h*.78]){c.beginPath();c.arc(w/2,y,w*.17,0,Math.PI*2);c.stroke();}
  c.strokeRect(w*.32,24,w*.36,h*.2);c.strokeRect(w*.32,h*.8-24,w*.36,h*.2);
}
export function badmintonTexture(c,w,h){c.fillStyle='#93b293';c.fillRect(0,0,w,h);c.strokeStyle='#f0f0d9';c.lineWidth=2;for(let col=0;col<2;col++)for(let row=0;row<2;row++){const x=col*w/2+18,y=row*h/2+24,cw=w/2-36,ch=h/2-48;c.strokeRect(x,y,cw,ch);c.beginPath();c.moveTo(x,y+ch/2);c.lineTo(x+cw,y+ch/2);c.moveTo(x+cw/2,y);c.lineTo(x+cw/2,y+ch);c.stroke();}}
export function libraryStoneTexture(c,w,h){drawFacadeAtlas(c,w,h,{stone:true});}
export function libraryGlassTexture(c,w,h){
  c.fillStyle='#b7beb2';c.fillRect(0,0,w,h);
  const palette=['#bbbdb4','#c6c2b6','#a9b2a9','#d0c9b9','#a2aaa1','#bec3b7'];
  const cw=w/8,ch=h/6;
  for(let row=0;row<6;row++)for(let col=0;col<8;col++){
    const x=col*cw,y=row*ch,index=(col*7+row*11)%palette.length;
    const pane=c.createLinearGradient(x,y,x+cw,y+ch);pane.addColorStop(0,'#e3dfd0');pane.addColorStop(.32,palette[index]);pane.addColorStop(1,'#979f95');c.fillStyle=pane;c.fillRect(x+3,y+4,cw-6,ch-8);
    // Curtains, a dim interior shelf and a pale ceiling reflection, not blue mirror paint.
    c.fillStyle='#69746122';c.fillRect(x+8,y+ch*.68,cw-16,ch*.2);
    if((col+row)%4===0){c.fillStyle='#d7ccb1bb';c.fillRect(x+4,y+5,cw*.31,ch-11);c.fillStyle='#f1e6cb77';c.fillRect(x+cw*.18,y+5,2,ch-11);}
    c.fillStyle='#f5edd12b';c.fillRect(x+6,y+5,cw-12,ch*.12);
    c.fillStyle='#ebe4d0';c.fillRect(x,y,2,h);c.fillStyle='#777e6e55';c.fillRect(x+2,y,1,ch);
  }
  for(let y=0;y<h;y+=ch){c.fillStyle='#d8d1b9';c.fillRect(0,y,w,3);c.fillStyle='#777e6e55';c.fillRect(0,y+3,w,2);}
}
export function waterTexture(c,w,h){
  const g=c.createRadialGradient(w*.52,h*.45,15,w*.52,h*.45,w*.7);g.addColorStop(0,'#497869');g.addColorStop(.55,'#698d7a');g.addColorStop(1,'#a5b59a');c.fillStyle=g;c.fillRect(0,0,w,h);
  for(let i=0;i<70;i++){
    const x=(Math.sin(i*9.73)*.5+.5)*w,y=(Math.sin(i*4.81+2)*.5+.5)*h,length=12+(i*19%65);
    c.strokeStyle=`rgba(234,232,195,${.025+i%4*.012})`;c.lineWidth=1+i%2*.4;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+length*.5,y-2,x+length,y);c.stroke();
  }
  const reflection=c.createRadialGradient(w*.35,h*.25,0,w*.35,h*.25,w*.55);reflection.addColorStop(0,'#dfe6c929');reflection.addColorStop(1,'#dfe6c900');c.fillStyle=reflection;c.fillRect(0,0,w,h);
}
export function timberTexture(c,w,h){c.fillStyle='#b89870';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=16){c.fillStyle=y%32?'#d3b68b':'#c4a47c';c.fillRect(0,y,w,14);c.fillStyle='#796548';c.fillRect(0,y+14,w,2);for(let n=0;n<5;n++){c.strokeStyle='#856b4826';c.beginPath();c.moveTo(0,y+2+n*2);c.bezierCurveTo(w*.3,y+n*2,w*.65,y+7+n,w,y+2+n*2);c.stroke();}}}
export function contactTexture(c,w,h){c.clearRect(0,0,w,h);const g=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'rgba(255,255,255,.85)');g.addColorStop(.5,'rgba(255,255,255,.45)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,w,h);}
export function librarySignTexture(c,w,h){c.fillStyle='#38534e';c.fillRect(0,0,w,h);c.fillStyle='#f6ecd1';c.textAlign='center';c.font='500 42px "Microsoft YaHei",sans-serif';c.fillText('图 书 馆',w/2,52);c.fillStyle='#b8cbb7';c.font='11px sans-serif';c.fillText('LIBRARY · A PLACE TO SLOW DOWN',w/2,77);}
export function roofMetalTexture(c,w,h){c.fillStyle='#7d8e8c';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=64)for(let x=0;x<w;x+=64){c.strokeStyle='#d7e2d81f';c.lineWidth=1;c.strokeRect(x,y,64,64);}c.fillStyle='#e8ece5';c.fillRect(w*.87,0,w*.13,h);}
export function pavingTexture(c,w,h){c.fillStyle='#c9c8bb';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=12)for(let x=0;x<w;x+=24){c.fillStyle=`rgba(247,245,231,${.12+(x*7+y*11)%5*.025})`;c.fillRect(x+(y%24?12:0),y,23.5,11.5);c.strokeStyle='#8e968b55';c.lineWidth=.45;c.strokeRect(x+(y%24?12:0),y,24,12);}}

