/** Only page names and circle IDs are remembered; invitations stay in memory. */
export function readSiteRoute(hash = '') {
  const match = /^#\/join\/([A-Za-z0-9_-]{12,100})$/.exec(hash);
  if (match) return { stage: 'circles', invite: match[1] };
  const stage = hash.replace(/^#\//, '');
  return { stage: ['circles', 'upload', 'map'].includes(stage) ? stage : 'entry', invite: '' };
}
export function invitationLink(token, href) {
  if (!/^[A-Za-z0-9_-]{12,100}$/.test(token)) throw new Error('邀请码格式不正确');
  const url = new URL(href);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('当前地址不能生成邀请链接');
  url.search = ''; url.hash = `/join/${token}`;
  return url.href;
}
export function initialScene() {
  if (typeof window === 'undefined') return 'intro';
  try {
    return readSiteRoute(window.location.hash).stage !== 'entry' || window.sessionStorage.getItem('campus:intro-seen') === '1' ? 'hub' : 'intro';
  } catch { return 'intro'; }
}
export function chooseCircle(circles, remembered) {
  return circles.find(c => c.id === remembered)?.id || circles[0]?.id || null;
}
export function filterCircleMembers(members, query, state = 'all') {
  const term = query.trim().toLocaleLowerCase();
  return members.filter(m => (!term || m.displayName.toLocaleLowerCase().includes(term)) && (state === 'all' || Boolean(m.submission) === (state === 'submitted')));
}
