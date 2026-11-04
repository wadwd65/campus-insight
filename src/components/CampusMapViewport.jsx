import { useLayoutEffect, useRef, useState } from 'react';

export default function CampusMapViewport({ children, focusPoint, label = '校园地图' }) {
  const [zoom, setZoom] = useState(1);
  const viewport = useRef(null);
  const previousZoom = useRef(zoom);
  const [focusX, focusY] = focusPoint;

  function centerOnCurrent() {
    const element = viewport.current;
    if (!element) return;
    element.scrollTo({
      left: element.scrollWidth * focusX / 100 - element.clientWidth / 2,
      top: element.scrollHeight * focusY / 100 - element.clientHeight / 2,
      behavior: 'instant',
    });
  }

  useLayoutEffect(() => {
    if (zoom > 1 || previousZoom.current !== zoom) centerOnCurrent();
    previousZoom.current = zoom;
  }, [zoom, focusX, focusY]);

  return <div className={`campus-map-viewport${zoom > 1 ? ' is-zoomed' : ''}`} style={{ '--map-zoom': zoom }}>
    <div className="campus-map-toolbar" aria-label={`${label}缩放控制`}>
      <span>{label} <small>{Math.round(zoom * 100)}%</small></span>
      <div>
        <button type="button" aria-label="缩小校园地图" disabled={zoom === 1} onClick={() => setZoom(value => value - .5)}>−</button>
        <button type="button" aria-label="放大校园地图" disabled={zoom === 2} onClick={() => setZoom(value => value + .5)}>＋</button>
        <button type="button" className="campus-map-locate" onClick={centerOnCurrent}>定位当前</button>
      </div>
    </div>
    <div ref={viewport} className="campus-map-scroll" tabIndex={0} role="region" aria-label={`${label}，放大后可滚动查看`}>
      {children}
    </div>
    <p className="campus-map-zoom-note">{zoom > 1 ? '滑动或滚动查看其他区域，点击“定位当前”回到落脚点。' : '可放大查看建筑和路线。查看地图不会消耗时段或精力。'}</p>
  </div>;
}
