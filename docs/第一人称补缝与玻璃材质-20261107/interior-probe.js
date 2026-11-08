(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(6000);
  const cands = [...document.querySelectorAll('a,button,[role=button]')]
    .filter(e => /图书馆|自习室|食堂|进去坐|进入/.test(e.textContent || ''))
    .map(e => ({ tag: e.tagName, id: e.id, txt: (e.textContent || '').trim().slice(0, 24) }));
  let clicked = null;
  const btn = [...document.querySelectorAll('a,button')].find(e => (e.textContent || '').includes('图书馆') && !e.textContent.includes('晴缘湖畔'));
  if (btn) { btn.click(); clicked = (btn.textContent || '').trim().slice(0, 24); }
  else { const w = document.getElementById('walk-inspect'); if (w) { w.click(); clicked = 'walk-inspect'; } }
  await wait(3500);
  const r = document.getElementById('runtime');
  return JSON.stringify({ candidates: cands.slice(0, 10), clicked, mode: r && r.dataset.playMode, personView: r && r.dataset.personView });
})()
