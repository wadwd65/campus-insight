(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(5500);
  const sel = document.getElementById('place-picker');
  let hit = null;
  if (sel) for (const o of sel.options) { if ((o.textContent || '').includes('图书馆（晴缘湖畔）')) { hit = o.value; break; } }
  if (!hit && sel) for (const o of sel.options) { if ((o.textContent || '').includes('图书馆')) { hit = o.value; break; } }
  if (sel && hit) { sel.value = hit; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  await wait(3800);
  return JSON.stringify({ focused: hit, mode: window.__campus ? 'ok' : 'no campus' });
})()
