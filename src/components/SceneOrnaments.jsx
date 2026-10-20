/** Native vector motifs: an open book, an orbit, and small compass stars. */
export default function SceneOrnaments({ variant = 'opening' }) {
  return <div className={`scene-ornaments scene-ornaments--${variant}`} aria-hidden="true">
    <svg className="scene-ornament ornament-book" viewBox="0 0 160 160" fill="none">
      <circle cx="80" cy="80" r="65" stroke="currentColor" strokeDasharray="1 9" />
      <path d="M24 109V55c22-4 39 0 56 12 17-12 34-16 56-12v54c-22-4-39 0-56 12-17-12-34-16-56-12Z" stroke="currentColor" />
      <path d="M80 67v54M37 70c11 0 20 3 29 8m-29 7c11 0 20 3 29 8m28-15c9-5 18-8 29-8m-29 23c9-5 18-8 29-8M80 17v18m-9-9h18" stroke="currentColor" />
      <circle cx="136" cy="32" r="3" fill="currentColor" stroke="none" />
    </svg>
    <svg className="scene-ornament ornament-orbit" viewBox="0 0 180 180" fill="none">
      <circle cx="90" cy="90" r="60" stroke="currentColor" strokeDasharray="3 8" />
      <ellipse cx="90" cy="90" rx="81" ry="29" transform="rotate(-35 90 90)" stroke="currentColor" />
      <path d="m90 61 11 18 18 11-18 11-11 18-11-18-18-11 18-11Z" stroke="currentColor" />
      <circle cx="150" cy="48" r="4" fill="currentColor" stroke="none" />
      <path d="M20 134h15m-7.5-7.5v15" stroke="currentColor" />
    </svg>
    <svg className="scene-ornament ornament-star" viewBox="0 0 64 64" fill="none">
      <path d="m32 4 6 22 22 6-22 6-6 22-6-22-22-6 22-6Z" stroke="currentColor" />
      <circle cx="32" cy="32" r="3" fill="currentColor" stroke="none" />
    </svg>
    <svg className="scene-ornament ornament-trail" viewBox="0 0 180 84" fill="none">
      <path d="m8 65 52-39 51 24 60-40" stroke="currentColor" strokeDasharray="2 6" />
      {[[8,65],[60,26],[111,50],[171,10]].map(([x,y]) => <path key={x} d={`m${x} ${y-5} 5 5-5 5-5-5Z`} stroke="currentColor" />)}
    </svg>
    <span className="scene-corner scene-corner--tl" />
    <span className="scene-corner scene-corner--br" />
  </div>;
}
