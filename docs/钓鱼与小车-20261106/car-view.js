/* 进小车 → 切跟车（第三人称）视角，用于真读小车外观 */
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(4500);
  const rt = document.getElementById('runtime');
  const d = document.getElementById('drive-toggle');
  if (d) d.click();
  await wait(1600);
  const v = document.getElementById('view-toggle');
  if (v) v.click();
  await wait(2200);
  return JSON.stringify({
    mode: rt.dataset.playMode,
    personView: rt.dataset.personView,
    drove: !!d, toggled: !!v,
  });
})()
