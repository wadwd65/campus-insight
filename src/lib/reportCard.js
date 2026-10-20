/** A local, portable PNG. All values come from the displayed report. No network API. */
export function reportIdentity(answers, attributes, name = '') {
  const seed = JSON.stringify(attributes ?? answers ?? {}) + name + (attributes ? 'map' : 'quiz');
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  const code = (hash >>> 0).toString(36).toUpperCase().padStart(7, '0');
  return `CI-${code.slice(0, 3)}-${code.slice(3)}`;
}

function wrap(ctx, text, x, y, maxWidth, lineHeight) {
  let line = '';
  let row = y;
  for (const character of text) {
    if (ctx.measureText(line + character).width > maxWidth && line) {
      ctx.fillText(line, x, row);
      line = '';
      row += lineHeight;
    }
    line += character;
  }
  if (line) ctx.fillText(line, x, row);
  return row + lineHeight;
}

export async function createReportCard(report, { id, closing }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('此浏览器暂不支持生成图片，请使用文字版。');
  const font = (size, weight = 400) => { ctx.font = `${weight} ${size}px "Microsoft YaHei", "PingFang SC", sans-serif`; };
  ctx.fillStyle = '#f5f2e7';
  ctx.fillRect(0, 0, 1080, 1350);
  const sky = ctx.createLinearGradient(0, 0, 1080, 600);
  sky.addColorStop(0, '#dae7dc'); sky.addColorStop(.7, '#eef0de'); sky.addColorStop(1, '#f5f2e7');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 1080, 570);
  // Quiet architectural lines echo the site's archive identity without embedding assets.
  ctx.strokeStyle = '#849d8a35'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(940, 60, 340, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(940, 60, 290, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#356454'; font(24, 600); ctx.fillText('CAMPUS INSIGHT  /  你的大学平行宇宙', 80, 88);
  ctx.fillStyle = '#718172'; font(18); ctx.fillText(id, 80, 125);
  font(20); ctx.fillText('这一次，你的校园称号是', 80, 210);
  ctx.fillStyle = '#234c3c';
  font(report.facts.title.length > 10 ? 62 : 74, 700);
  const afterTitle = wrap(ctx, report.facts.title, 80, 300, 920, 88);
  ctx.fillStyle = '#546a5c'; font(27);
  wrap(ctx, closing, 82, Math.max(404, afterTitle + 23), 890, 44);
  ctx.strokeStyle = '#a8b6a2'; ctx.beginPath(); ctx.moveTo(80, 510); ctx.lineTo(1000, 510); ctx.stroke();
  const center = [540, 739];
  const point = (i, ratio) => {
    const angle = -Math.PI / 2 + Math.PI * 2 * i / report.radar.length;
    return [center[0] + Math.cos(angle) * 142 * ratio, center[1] + Math.sin(angle) * 142 * ratio];
  };
  const polygon = (points) => { ctx.beginPath(); points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.closePath(); };
  for (const ratio of [1, .75, .5, .25]) {
    polygon(report.radar.map((_, i) => point(i, ratio)));
    ctx.strokeStyle = '#c5d1bf'; ctx.stroke();
  }
  report.radar.forEach((_, i) => { const [x,y] = point(i, 1); ctx.beginPath(); ctx.moveTo(...center); ctx.lineTo(x,y); ctx.stroke(); });
  polygon(report.radar.map((d, i) => point(i, d.value / 100)));
  ctx.fillStyle = '#3f817647'; ctx.fill(); ctx.strokeStyle = '#2e7464'; ctx.lineWidth = 3; ctx.stroke();
  ctx.textAlign = 'center';
  report.radar.forEach((d, i) => {
    const [x, y] = point(i, 1.45);
    ctx.fillStyle = '#566b5a'; font(22); ctx.fillText(d.axis, x, y);
    ctx.fillStyle = '#235e4b'; font(28, 600); ctx.fillText(String(d.value), x, y + 34);
    const [px,py] = point(i, d.value / 100); ctx.beginPath(); ctx.arc(px,py,5,0,Math.PI*2); ctx.fill();
  });
  ctx.fillStyle = '#6f7a68'; font(18); ctx.fillText('数值为模拟基准中的百分位，不代表能力分数', 540, 987);
  const top = [...report.radar].sort((a,b) => b.value - a.value).slice(0,3);
  top.forEach((d, i) => {
    const x = 80 + i * 312;
    ctx.fillStyle = '#e5e9da'; ctx.fillRect(x, 1022, 296, 106);
    ctx.fillStyle = '#596e5c'; font(20); ctx.fillText(d.axis, x + 148, 1060);
    ctx.fillStyle = '#285d4b'; font(26, 600); ctx.fillText(`第 ${d.value} 百分位`, x + 148, 1100);
  });
  ctx.textAlign = 'left'; ctx.fillStyle = '#7b806e'; font(19);
  ctx.fillText('基于 2000 条模拟基准记录 · 问卷与地图均按既定规则推算', 80, 1200);
  ctx.fillText('用于校园生活探索，非心理评估、真实排名或未来预测。', 80, 1235);
  ctx.strokeStyle = '#c8cfbc'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(80, 1270); ctx.lineTo(1000,1270); ctx.stroke();
  ctx.fillStyle = '#3b6857'; font(18); ctx.fillText('每一种日常，都值得被看见。', 80, 1310);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('图片生成失败，请使用文字版。')), 'image/png'));
}

export async function downloadReportCard(report, options) {
  const blob = await createReportCard(report, options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `campus-insight-${options.id}.png`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
