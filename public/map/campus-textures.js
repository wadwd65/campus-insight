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
/* 10-28：窗带贴图。立面几何上是一整块玻璃面（拆窗格会把三角形翻倍），
   窗的节奏交给这张贴图 —— 竖梃 + 中横档 + 斜向反光，远看就是一排窗。 */
export function windowBandTexture(c,w,h){
  /* 10-28：四种窗做法，用 ?win=1..4 切换，共用同一块玻璃面的几何。
     1 细梃通窗（当前）  2 深凹窗（上沿内阴影最重）  3 木梃暖窗  4 现代三分格 */
  const scheme = Number((typeof location !== 'undefined' && new URLSearchParams(location.search).get('win')) || 2);

  /* 5 号方案：磨砂玻璃（窗玻璃本身的质感，与界面玻璃拟态无关）。
     磨砂的视觉本质是"背后的东西被抹开"——所以不画清晰的窗格，
     改成奶白基底 + 被晕开的天空/树影 + 细颗粒，只留极淡的竖梃虚影。 */
  if (scheme === 5) {
    let seed = 20261029;
    const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const base = c.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, '#c9dbe6'); base.addColorStop(.52, '#d6e0d2'); base.addColorStop(1, '#bccfb8');
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      const x = rnd() * w, y = h * (.5 + rnd() * .5), r = w * (.05 + rnd() * .09);
      const rg = c.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(104,136,110,0.28)'); rg.addColorStop(1, 'rgba(112,142,116,0)');
      c.fillStyle = rg; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 2400; i++) {
      c.fillStyle = i % 2 ? 'rgba(255,255,255,0.14)' : 'rgba(118,132,122,0.05)';
      c.fillRect(rnd() * w, rnd() * h, 1.6, 1.6);
    }
    /* 竖梃虚影：磨砂让硬边变软，只留一条淡影 */
    for (let i = 0; i <= 6; i++) {
      const x = i * w / 6;
      c.fillStyle = 'rgba(146,164,156,0.55)'; c.fillRect(x - 2.8, 0, 5.6, h);
    }
    c.fillStyle = 'rgba(255,255,255,0.30)'; c.fillRect(0, h * .52, w, 2.4);
    /* 斜向柔光，避免整面死板 */
    c.save(); c.globalAlpha = .18; c.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) {
      c.beginPath(); c.moveTo(-w * .1 + i * w * .34, 0); c.lineTo(w * .12 + i * w * .34, 0);
      c.lineTo(-w * .06 + i * w * .34, h); c.lineTo(-w * .28 + i * w * .34, h); c.closePath(); c.fill();
    }
    c.restore();
    return;
  }

  const glassTop = scheme === 3 ? '#7d8d86' : scheme >= 4 ? '#3a4640' : '#65725c';
  const glassMid = scheme === 3 ? '#5c7268' : scheme >= 4 ? '#2b352f' : '#46543f';
  const glassBot = scheme === 3 ? '#3d5045' : scheme >= 4 ? '#1e2621' : '#2f3a2b';
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, glassTop); g.addColorStop(.42, glassMid); g.addColorStop(1, glassBot);
  c.fillStyle = g; c.fillRect(0, 0, w, h);

  /* 天空反光：所有方案都保留，木梃方案更明显一些 */
  c.save(); c.globalAlpha = scheme === 3 ? .26 : .16; c.fillStyle = '#dfe8e0';
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.moveTo(-w * .2 + i * w * .3, 0); c.lineTo(w * .08 + i * w * .3, 0);
    c.lineTo(-w * .07 + i * w * .3, h); c.lineTo(-w * .35 + i * w * .3, h);
    c.closePath(); c.fill();
  }
  c.restore();

  /* 上沿内阴影：越"深"的方案越重，这是凹窗最关键的线索 */
  const shade = [0.10, 0.30, 0.16, 0.24][scheme - 1] || 0.1;
  const sg = c.createLinearGradient(0, 0, 0, h * .34);
  sg.addColorStop(0, `rgba(12,18,14,${shade})`); sg.addColorStop(1, 'rgba(12,18,14,0)');
  c.fillStyle = sg; c.fillRect(0, 0, w, h * .34);

  const mull = [8, 5, 6, 3][scheme - 1] || 8;
  const frameCol = scheme === 3 ? '#d9c3a2' : scheme === 2 ? '#8d9488' : '#e7e4d6';
  const edgeCol  = scheme === 3 ? '#8a6f4d' : scheme === 2 ? '#4a5246' : '#5f6a58';
  const frameW   = scheme === 3 ? 5 : scheme === 4 ? 2.6 : 3.4;

  for (let i = 0; i <= mull; i++) {
    const x = i * w / mull;
    c.fillStyle = frameCol; c.fillRect(x - frameW / 2, 0, frameW, h);
    c.fillStyle = edgeCol;  c.fillRect(x + frameW / 2, 0, 1.2, h);
  }
  /* 横档：3 号方案一道偏下，4 号两道 */
  const bars = scheme === 4 ? [.36, .68] : [scheme === 3 ? .62 : .54];
  for (const t of bars) {
    c.fillStyle = frameCol; c.fillRect(0, h * t, w, scheme === 3 ? 3.6 : 2.4);
    c.fillStyle = edgeCol;  c.fillRect(0, h * t + (scheme === 3 ? 3.6 : 2.4), w, 1.2);
  }
  /* 下沿窗台亮线 */
  c.fillStyle = scheme === 3 ? '#f0e6d2' : '#b9c2b2';
  c.fillRect(0, h - 2.6, w, 2.6);
}

export function roofMetalTexture(c,w,h){c.fillStyle='#7d8e8c';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=64)for(let x=0;x<w;x+=64){c.strokeStyle='#d7e2d81f';c.lineWidth=1;c.strokeRect(x,y,64,64);}c.fillStyle='#e8ece5';c.fillRect(w*.87,0,w*.13,h);}
export function pavingTexture(c,w,h){c.fillStyle='#c9c8bb';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=12)for(let x=0;x<w;x+=24){c.fillStyle=`rgba(247,245,231,${.12+(x*7+y*11)%5*.025})`;c.fillRect(x+(y%24?12:0),y,23.5,11.5);c.strokeStyle='#8e968b55';c.lineWidth=.45;c.strokeRect(x+(y%24?12:0),y,24,12);}}

