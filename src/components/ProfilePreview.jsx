import { useEffect, useMemo, useRef, useState } from 'react';
import { PREVIEW_STYLES, buildPreviewReport } from '../lib/previewProfiles.js';

/** Small SVG: the landing page does not need an ECharts instance. */
export function RadarGlyph({ data, className = '', labelPrefix = '示例画像' }) {
  const [values, setValues] = useState(() => data.map((d) => d.value));
  const current = useRef(values);
  useEffect(() => {
    const target = data.map((d) => d.value);
    const start = current.current;
    if (target.every((value, i) => value === start[i])) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || start.length !== target.length) {
      current.current = target;
      setValues(target);
      return;
    }
    let frame;
    const began = performance.now();
    function tick(now) {
      const progress = Math.min(1, (now - began) / 460);
      const eased = 1 - (1 - progress) ** 3;
      const next = target.map((value, i) => start[i] + (value - start[i]) * eased);
      current.current = next;
      setValues(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [data]);
  const point = (i, ratio) => {
    const a = -Math.PI / 2 + i * Math.PI * 2 / data.length;
    return [130 + Math.cos(a) * 72 * ratio, 108 + Math.sin(a) * 72 * ratio];
  };
  const polygon = (r) => data.map((_, i) => point(i, r).join(',')).join(' ');
  return <svg className={className} viewBox="0 0 260 220" role="img" aria-label={`${labelPrefix}：${data.map((d) => `${d.axis}第${d.value}百分位`).join('，')}`}>
    {[1, .75, .5, .25].map((r) => <polygon key={r} points={polygon(r)} fill={r === 1 ? '#e9f1ec' : 'none'} fillOpacity={r === 1 ? '.5' : undefined} stroke="#bed2cd" strokeWidth=".8" />)}
    {data.map((d, i) => <line key={d.key} x1="130" y1="108" x2={point(i, 1)[0]} y2={point(i, 1)[1]} stroke="#bed2cd" strokeWidth=".8" />)}
    <polygon points={data.map((d, i) => point(i, (values[i] ?? d.value) / 100).join(',')).join(' ')} fill="#287a73" fillOpacity=".19" stroke="#1e6a65" strokeWidth="2" />
    {data.map((d, i) => {
      const [x, y] = point(i, 1.3);
      const [px, py] = point(i, (values[i] ?? d.value) / 100);
      return <g key={d.key}><circle cx={px} cy={py} r="3" fill="#1e6a65" stroke="#fffdf6" strokeWidth="1.5" /><text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill="#4c645f" fontSize="10">{d.axis}</text></g>;
    })}
  </svg>;
}

export default function ProfilePreview({ baseline }) {
  const [style, setStyle] = useState(PREVIEW_STYLES[0].id);
  const report = useMemo(() => buildPreviewReport(baseline, style), [baseline, style]);
  return <aside className="profile-preview" aria-label="测评结果示例">
    <div className="preview-tab" aria-hidden="true">YOUR CAMPUS ARCHIVE</div>
    <div className="preview-sheet">
      <div className="preview-topline"><span>做完，你会得到这样一份档案</span><b>示例</b></div>
      <div className="preview-styles" aria-label="切换示例回答">{PREVIEW_STYLES.map((item) => <button key={item.id} type="button" aria-pressed={style === item.id} onClick={() => setStyle(item.id)}>{item.label}</button>)}</div>
      <div className="preview-result" aria-live="polite" aria-busy={!report}>
        <p className="preview-kicker">校园称号 / DESIGNATION</p>
        <p key={style} className="preview-title">{report?.facts.title ?? '你的故事，等你来写'}</p>
        {report ? <><RadarGlyph data={report.radar} className="preview-radar" /><div className="preview-traits">{[...report.radar].sort((a, b) => b.value - a.value).slice(0, 2).map((d) => <span key={d.key}>{d.axis}<b>{d.value}</b><small>百分位</small></span>)}</div></> : <div className="preview-placeholder">正在准备示例画像…</div>}
      </div>
      <p className="preview-disclaimer">示例回答计算所得，非你的结果<br />与 {baseline?.size ?? '—'} 条模拟基准记录比较 · 非能力评分</p>
      <span className="preview-seal" aria-hidden="true">CI<br />ARCHIVE</span>
    </div>
    <p className="preview-caption"><span aria-hidden="true">✦</span> 换一组回答，看看画像怎样变化</p>
  </aside>;
}
