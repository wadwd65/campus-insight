(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(5500);
  const sel = document.getElementById('place-picker');
  if (sel) { const o = [...sel.options].find(x => x.value === 'lib'); if (o) { sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); } }
  await wait(3200);
  const zi = document.getElementById('zoom-in');
  for (let i = 0; i < 8; i++) { if (zi) zi.click(); await wait(380); }
  await wait(2600);
  return JSON.stringify({ zoomed: 8 });
})()
