/** One compositor update per pointer frame; no React renders or idle RAF loop. */
export function bindScenePointer(element) {
  if (!element || typeof window === 'undefined') return () => {};
  const fine = window.matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let latest = null;
  const enabled = () => fine.matches && !reduced.matches;

  function reset() {
    window.cancelAnimationFrame(frame);
    frame = 0;
    latest = null;
    element.removeAttribute('data-pointer-active');
    element.style.setProperty('--pointer-dx', '0px');
    element.style.setProperty('--pointer-dy', '0px');
    element.style.setProperty('--pointer-rx', '0deg');
    element.style.setProperty('--pointer-ry', '0deg');
  }

  function paint() {
    frame = 0;
    if (!latest || !enabled()) return;
    const rect = element.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, latest.x - rect.left));
    const y = Math.max(0, Math.min(rect.height, latest.y - rect.top));
    const dx = rect.width ? x / rect.width * 2 - 1 : 0;
    const dy = rect.height ? y / rect.height * 2 - 1 : 0;
    element.style.setProperty('--pointer-dx', `${(dx * 12).toFixed(2)}px`);
    element.style.setProperty('--pointer-dy', `${(dy * 10).toFixed(2)}px`);
    element.style.setProperty('--pointer-rx', `${(-dy * 5).toFixed(2)}deg`);
    element.style.setProperty('--pointer-ry', `${(dx * 6).toFixed(2)}deg`);
    element.setAttribute('data-pointer-active', 'true');
  }

  function move(event) {
    if (!enabled() || event.pointerType !== 'mouse') return;
    latest = { x: event.clientX, y: event.clientY };
    if (!frame) frame = window.requestAnimationFrame(paint);
  }
  function visibility() { if (document.hidden) reset(); }

  element.addEventListener('pointermove', move, { passive: true });
  element.addEventListener('pointerleave', reset);
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', visibility);
  fine.addEventListener('change', reset);
  reduced.addEventListener('change', reset);
  return () => {
    reset();
    element.removeEventListener('pointermove', move);
    element.removeEventListener('pointerleave', reset);
    window.removeEventListener('blur', reset);
    document.removeEventListener('visibilitychange', visibility);
    fine.removeEventListener('change', reset);
    reduced.removeEventListener('change', reset);
  };
}
