const STOPS = ['早课开场', '空堂去处', '午饭时间', '课后邀约', '天气转场', '临时插曲', '动一动', '傍晚烟火', '一日收尾', '留个纪念'];

export default function CampusDayTimeline({ progress, view, onRewind }) {
  const current = Math.min(9, progress.history.length - (view.pending ? 1 : 0));
  return <nav className="day-timeline" aria-label="校园一天的十站进度">
    <ol>{STOPS.map((label, index) => {
      const done = index < progress.history.length;
      const active = !view.complete && index === current;
      const content = <><span>{done ? '✓' : String(index + 1).padStart(2, '0')}</span><b>{label}</b></>;
      return <li key={label} className={`${done ? 'is-done' : ''} ${active ? 'is-current' : ''}`} aria-current={active ? 'step' : undefined}>
        {done ? <button type="button" onClick={() => onRewind(index)} aria-label={`回看第${index + 1}站，${label}，可确认后改选`}>{content}</button> : <div>{content}</div>}
      </li>;
    })}</ol>
  </nav>;
}
