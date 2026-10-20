import { useEffect, useRef, useState } from 'react';

const LETTERS = [
  '如果今天没有特别的事发生，也可以把风吹过校园的那一刻，算作一件好事。',
  '图书馆最后一排、食堂靠窗的位置，也许都会记得你曾经坐过。',
  '有些路只是从宿舍到教室，走着走着，却成了以后最想念的一段。',
  '不必把四个时段都安排得很满。给喜欢的事留一点位置，就很好。',
];

export default function CampusNote({ inline = false }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const trigger = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    window.addEventListener('keydown', close, true);
    return () => window.removeEventListener('keydown', close, true);
  }, [open]);
  return <div className={`campus-note${inline ? ' campus-note--inline' : ''}`}>
    <button ref={trigger} className="campus-note-trigger" type="button" aria-label="打开校园来信" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <svg width="22" height="22" viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="m3 12 22-8-8 22-4-10-10-4Zm10 4L25 4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg><span>校园来信</span>
    </button>
    {open && <section className="campus-note-paper" aria-label="一封校园来信">
      <div className="campus-note-top"><span>CAMPUS POST</span><button type="button" aria-label="收起校园来信" onClick={() => { setOpen(false); trigger.current?.focus(); }}>×</button></div>
      <h2>留给路过的你</h2><p key={index} aria-live="polite">{LETTERS[index]}</p>
      <div className="campus-note-bottom"><span>{String(index + 1).padStart(2, '0')} / {String(LETTERS.length).padStart(2, '0')}</span><button type="button" onClick={() => setIndex((index + 1) % LETTERS.length)}>再读一张 ↗</button></div>
    </section>}
  </div>;
}
