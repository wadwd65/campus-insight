import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useAccount } from '../lib/accounts.jsx';
import { MATRIX_VERSION } from '../lib/surveySchema.js';
import { AnswerReview } from './CircleAnswers.jsx';
import { buildCircleCsv } from '../lib/circleExport.js';
import { downloadText } from '../lib/exportProfile.js';
import { chooseCircle, filterCircleMembers, invitationLink } from '../lib/siteNavigation.js';
import { readSurveyDraft } from '../lib/surveyDraft.js';
import CircleAuth from './CircleAuth.jsx';
import './circles.css';
import './circle-guidance.css';
const CohortPage = lazy(() => import('./CohortPage.jsx'));
const time = value => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '尚未提交';

function OwnSubmission({ circle, account, busy, run, reload, onStartQuiz, setNotice }) {
  const draft = readSurveyDraft(undefined, `${account.user.id}:${circle.id}`);
  return <div className="circle-own"><div className="circle-section-heading"><div><h3>{circle.submission ? '我的答卷已收到' : draft ? '上次的填写进度还在' : '下一步：填写十道选择题'}</h3><p>{circle.submission ? `已提交 · ${time(circle.submission.submittedAt)} · 第 ${circle.submission.revision} 次提交（保留最新一份）` : draft ? '继续后会回到上次停下的题目；核对并确认提交后，管理员才能看到。' : '每题选择一个符合你的选项。填完后先核对，再决定是否交给管理员。'}</p></div><button disabled={busy} className={circle.role === 'member' ? 'circle-primary' : ''} onClick={() => onStartQuiz({ id: circle.id, name: circle.name, userId: account.user.id })}>{draft ? '继续填写 →' : circle.submission ? '重新填报十题' : circle.role === 'admin' ? '我也填写一份 →' : '开始填写 →'}</button></div>
    {!circle.submission && <p className="circle-fine">可以中途暂停；草稿仅保存在当前浏览器标签页，请勿清理浏览器数据。</p>}
    {circle.role === 'member' && <button className="circle-text-button" disabled={busy} onClick={() => { window.location.hash = '#/'; }}>{circle.submission ? '回到首页' : '稍后填写，先回首页'}</button>}
    {circle.submission && <><details><summary>查看我已经交出的十题答案</summary><AnswerReview answers={circle.submission.answers} /></details><details className="circle-secondary-tools"><summary>保存副本或撤回答卷</summary><button className="circle-text-button" onClick={() => { downloadText('campus-insight-我的已交答卷.csv', buildCircleCsv([{ id: account.user.id, displayName: account.user.displayName, submission: circle.submission }])); setNotice('已生成你的答卷文件，请在浏览器下载列表中查看。'); }}>下载我的已交答卷 ↓</button><details><summary>我想撤回这份答卷</summary><p>撤回后会从圈内当前列表与汇总移除，管理员已保存的副本无法一并撤回。之后可以重新填写。</p><button className="circle-danger-action" disabled={busy} onClick={() => run(async () => { await account.request(`/circles/${circle.id}/submissions`, { method: 'DELETE' }); await reload(circle.id); setNotice('答卷已撤回，已从本圈当前列表与汇总中移除。你可以重新填写。'); })}>确认撤回我的答卷</button></details></details></>}
  </div>;
}

function CircleSteps({ admin = false, submitted = false, hasMembers = false }) {
  const steps = admin
    ? [{ title: '圈子已建好', text: '你是这个圈子的管理员。', done: true }, { title: '邀请大家加入', text: '生成邀请，再把链接发给成员。', done: hasMembers }, { title: '查看收到的答卷', text: '成员确认提交后，这里会更新。', done: submitted }]
    : [{ title: '已经加入', text: '确认上方圈子名称是否正确。', done: true }, { title: '填写并核对十题', text: '可以暂停，答案不会自动交出。', done: submitted }, { title: '确认后交给管理员', text: '勾选共享同意，再点击提交。', done: submitted }];
  return <ol className="circle-guide-steps" aria-label={admin ? '管理员操作步骤' : '成员填报步骤'}>{steps.map((step, index) => <li key={step.title} className={step.done ? 'is-complete' : ''}><span className="circle-step-number" aria-hidden="true">{step.done ? '✓' : index + 1}</span><div><strong>{step.title}</strong><small>{step.text}</small></div></li>)}</ol>;
}

function AdminMembers({ circle, members, busy, run, account, reload, setNotice }) {
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('all');
  const visible = filterCircleMembers(members, query, filter);
  const validMembers = members.filter(m => m.submission?.matrixVersion === MATRIX_VERSION);
  return <section className="circle-card circle-admin-members" aria-labelledby="circle-members-title"><div className="circle-section-heading"><div><p className="circle-eyebrow">收到的每一份记录</p><h2 id="circle-members-title">成员与答卷</h2></div><span className="circle-count">{members.length} 位成员</span></div>
    <div className="circle-response-tools"><label className="circle-search"><span>搜索成员</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="按显示名称查找" maxLength={40} /></label><label><span>填报状态</span><select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">全部成员</option><option value="submitted">已提交</option><option value="pending">未提交</option></select></label></div>
    <p className="circle-fine" role="status">显示 {visible.length} / {members.length} 人 · 管理员也计入成员总数</p>
    <details className="circle-export"><summary>可选：下载答卷，保存到电脑</summary><p className="circle-fine">文件包含已提交者的显示名称、原始答案、提交时间和次数，请妥善保存。每人只导出当前题库版本的最新答卷；用于离线统计，不迁移账号或邀请码。搜索和筛选不会减少下载范围。</p><button disabled={!validMembers.length} onClick={() => { downloadText('campus-insight-圈子原始答卷.csv', buildCircleCsv(members)); setNotice('已生成本圈最新答卷文件。请在浏览器下载列表查看并妥善保存。'); }}>下载全部 {validMembers.length} 份答卷（CSV）↓</button>{!validMembers.length && <p className="circle-fine">收到当前版本的答卷后，下载按钮才会开启。</p>}</details>
    <div className="circle-member-list">{!visible.length && <div className="circle-filter-empty"><h3>没有符合条件的成员</h3><p>换个名字，或查看全部填报状态。</p><button onClick={() => { setQuery(''); setFilter('all'); }}>清除筛选</button></div>}{visible.map(m => <article key={m.id} className="circle-member"><div className="circle-member-heading"><span className="circle-avatar" aria-hidden="true">{Array.from(m.displayName)[0]}</span><div><h3>{m.displayName} <small>{m.role === 'admin' ? '管理员' : '成员'}</small></h3><p>{m.submission ? `${time(m.submission.submittedAt)} · 第 ${m.submission.revision} 次提交` : '等待这位成员留下记录'}</p></div><span className={`circle-state${m.submission ? ' is-submitted' : ''}`}>{m.submission ? '已提交' : '未提交'}</span></div>{m.submission && <details><summary>查看原始答卷</summary><AnswerReview answers={m.submission.answers} /></details>}{m.role === 'member' && <details><summary className="circle-muted">移除成员</summary><p>移除 {m.displayName} 后，其答卷也会从本圈删除。对方的账号不受影响。</p><button disabled={busy} onClick={() => run(async () => { await account.request(`/circles/${circle.id}/members/${m.id}`, { method: 'DELETE' }); await reload(circle.id); setNotice('已移除该成员及其本圈答卷。'); })}>确认移除 {m.displayName}</button></details>}</article>)}</div>
  </section>;
}

export default function CircleWorkspace({ baseline, onStartQuiz, pendingInvite = '', onInviteHandled, onSkip, onPreviewSample, sampleBusy = false, sampleError = '' }) {
  const account = useAccount();
  const [circles, setCircles] = useState([]), [selected, setSelected] = useState(null);
  const [circle, setCircle] = useState(null), [members, setMembers] = useState([]), [invites, setInvites] = useState([]);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [listed, setListed] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [issued, setIssued] = useState(null), [cohortOpen, setCohortOpen] = useState(false);
  const [openTool, setOpenTool] = useState(''), [manualCopy, setManualCopy] = useState(false), [copyFeedback, setCopyFeedback] = useState('');
  const generation = useRef(0), listGeneration = useRef(0), active = useRef(true), lastLoaded = useRef(0), invitePanel = useRef(null), joinPanel = useRef(null), createPanel = useRef(null), manualLink = useRef(null), actionLock = useRef(false), errorPanel = useRef(null), overviewHeading = useRef(null);
  const storageKey = `campus:circle:${account.user?.id || ''}`;
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [cohortOpen]);
  useEffect(() => {
    if (!circle?.id || document.querySelector('dialog[open]')) return;
    overviewHeading.current?.focus({ preventScroll: true });
    overviewHeading.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [circle?.id]);
  useEffect(() => { active.current = true; return () => { active.current = false; generation.current++; }; }, []);
  async function list() {
    const version = ++listGeneration.current;
    const result = await account.request('/circles');
    if (!active.current || version !== listGeneration.current) return;
    setCircles(result.circles); setListed(true);
    let remembered; try { remembered = window.sessionStorage.getItem(storageKey); } catch { /* Optional. */ }
    setSelected(current => chooseCircle(result.circles, current || remembered));
  }
  async function refreshListAfterWrite() {
    try { await list(); }
    catch {
      if (active.current) setError('刚才的操作已成功，但圈子列表暂时没有更新。请点击“重新加载圈子”查看，不用重复创建或加入。');
    }
  }
  async function refreshInvitesAfterWrite(id) {
    try {
      const result = await account.request(`/circles/${id}/invites`);
      if (active.current) setInvites(result.invites);
      return true;
    } catch { return false; }
  }
  async function load(id, quiet = false) {
    const version = ++generation.current;
    if (!quiet) { setLoading(true); setCircle(null); setMembers([]); setInvites([]); setIssued(null); setManualCopy(false); setCopyFeedback(''); setCohortOpen(false); }
    try {
      const detail = await account.request(`/circles/${id}`);
      const extra = detail.role === 'admin' ? await Promise.all([account.request(`/circles/${id}/members`), account.request(`/circles/${id}/invites`)]) : null;
      if (!active.current || version !== generation.current) return;
      setCircle(detail); setMembers(extra?.[0].members || []); setInvites(extra?.[1].invites || []); lastLoaded.current = Date.now();
      setCircles(current => current.some(c => c.id === detail.id) ? current : [{ id: detail.id, name: detail.name, role: detail.role }, ...current]);
      return true;
    } catch (e) { if (active.current && version === generation.current) setError(e.message); return false; }
    finally { if (active.current && version === generation.current) setLoading(false); }
  }
  useEffect(() => { if (account.user) list().catch(e => { if (active.current) setError(e.message); }); }, [account.user?.id]);
  useEffect(() => {
    if (!selected) return;
    try { window.sessionStorage.setItem(storageKey, selected); } catch { /* Optional. */ }
    load(selected);
  }, [selected]);
  useEffect(() => {
    const refreshVisible = () => {
      if (selected && !busy && document.visibilityState === 'visible' && Date.now() - lastLoaded.current > 15000) load(selected, true);
    };
    window.addEventListener('focus', refreshVisible); document.addEventListener('visibilitychange', refreshVisible);
    return () => { window.removeEventListener('focus', refreshVisible); document.removeEventListener('visibilitychange', refreshVisible); };
  }, [selected, busy]);
  async function run(fn) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true); setError(''); setNotice('');
    try { await fn(); } catch (e) { if (active.current) { setError(e.message); requestAnimationFrame(() => { errorPanel.current?.focus({ preventScroll: true }); errorPanel.current?.scrollIntoView({ block: 'center', behavior: 'instant' }); }); } }
    finally { actionLock.current = false; if (active.current) setBusy(false); }
  }
  function openTask(task) {
    setOpenTool(task);
    const panel = task === 'join' ? joinPanel : createPanel;
    requestAnimationFrame(() => { panel.current?.scrollIntoView({ block: 'center', behavior: 'instant' }); panel.current?.querySelector('input')?.focus({ preventScroll: true }); });
  }
  async function copyInvitation(value, message) {
    try { await navigator.clipboard.writeText(value); setCopyFeedback(message); }
    catch { setManualCopy(true); setCopyFeedback('浏览器未能自动复制。下方已展开邀请链接：点击文字框，全选后复制，再发给成员。'); requestAnimationFrame(() => { manualLink.current?.focus(); manualLink.current?.select(); manualLink.current?.scrollIntoView({ block: 'center', behavior: 'instant' }); }); }
  }
  if (!account.user) return <div className="circle-workspace"><CircleAuth pendingInvite={pendingInvite} onInviteHandled={onInviteHandled} onSkip={onSkip} onPreviewSample={onPreviewSample} sampleBusy={sampleBusy} sampleError={sampleError} /></div>;
  const validMembers = members.filter(m => m.submission?.matrixVersion === MATRIX_VERSION);
  const submitted = members.filter(m => m.submission).length;
  const reload = id => load(id, true);
  if (cohortOpen && circle) return <div className="circle-workspace"><button onClick={() => setCohortOpen(false)}>← 返回 {circle.name}</button><p className="circle-notice">在线圈子：{circle.name} · {validMembers.length} 份当前版本答卷 · 统计来自最近加载的数据。</p><Suspense fallback={<p role="status"><span className="ui-spinner" /> 正在计算圈子画像…</p>}><CohortPage records={validMembers.map(m => ({ ...m.submission.answers, _id: m.id }))} baseline={baseline} source="circle" onUpload={() => setCohortOpen(false)} onRestart={() => setCohortOpen(false)} /></Suspense></div>;
  return <div className="circle-workspace">
    <header className="circle-heading"><div><p className="circle-eyebrow">一起记录校园</p><h1>我的圈子<span className="circle-heading-dot">.</span></h1><p>你好，{account.user.displayName}。{circles.length ? '先确认圈子名称，再按下方提示继续。' : '只想填写问卷？用管理员发来的邀请加入即可。'}</p></div><div className="circle-header-actions"><button disabled={busy} onClick={() => { window.location.hash = '#/'; }}>← 回到首页</button><button className="circle-signout" disabled={busy} onClick={() => run(account.logout)}>退出登录</button></div></header>
    {error && <div ref={errorPanel} tabIndex={-1} role="alert" className="circle-error"><strong>请查看下面的操作提示</strong><p>{error}</p><p>连接问题请先重新加载，核对结果后再操作。若邀请码不可用，请联系发给你的人获取新邀请。</p><button disabled={busy} onClick={() => run(async () => { await list(); if (selected) await reload(selected); })}>重新加载圈子</button></div>}{notice && <p role="status" className="circle-notice">{notice}</p>}
    {pendingInvite && <section className="circle-card circle-pending-invite"><div><p className="circle-eyebrow">收到一份邀请</p><h2>先加入，再填写</h2><p>点击下面的绿色按钮，即可进入邀请对应的圈子。加入不会自动交出任何答卷，原有答卷也不会带入新圈子。</p></div><div className="circle-actions"><button className="circle-primary" disabled={busy} onClick={() => run(async () => { const result = await account.request('/join', { method: 'POST', body: { invite: pendingInvite } }); setSelected(result.circleId); onInviteHandled?.(); setNotice('加入成功。下一步：点击“开始填写”，答完后还需要你核对并确认提交。'); await refreshListAfterWrite(); })}>{busy ? '正在处理…' : '确认加入这个圈子'}</button><button disabled={busy} onClick={() => { onInviteHandled?.(); setNotice('已跳过这次邀请。需要时可以再次打开邀请链接加入。'); }}>暂时不加入</button></div></section>}
    <div className={`circle-layout${circle ? ' circle-selected' : ''}`}>
      <aside className="circle-sidebar"><section className="circle-card"><div className="circle-section-heading"><h2>切换圈子</h2><span className="circle-count">{circles.length}</span></div>{!listed ? <p role="status">正在加载…</p> : !circles.length && <p className="circle-fine">还没有加入圈子。先选择你要做的事。</p>}<nav aria-label="圈子列表">{circles.map(c => <button key={c.id} disabled={busy} aria-current={selected === c.id ? 'page' : undefined} onClick={() => { setError(''); setNotice(''); setSelected(c.id); }}><span>{c.name}</span><small>{c.role === 'admin' ? '管理员' : '成员'}</small></button>)}</nav></section>
        <details ref={joinPanel} className="circle-card circle-sidebar-tool" open={openTool === 'join'} onToggle={event => { if (event.currentTarget.open) setOpenTool('join'); else setOpenTool(current => current === 'join' ? '' : current); }}><summary>我要填报 · 加入圈子</summary><p className="circle-fine">已有邀请链接？直接打开即可。只有邀请码时，把它填在下面。</p><form className="circle-form" onSubmit={event => { event.preventDefault(); const form = event.currentTarget; const invite = new FormData(form).get('invite').trim(); run(async () => { const result = await account.request('/join', { method: 'POST', body: { invite } }); form.reset(); setSelected(result.circleId); setOpenTool(''); setNotice('加入成功。请确认圈子名称，然后点击“开始填写”。提交前还会让你核对。'); await refreshListAfterWrite(); }); }}><label>粘贴管理员给你的邀请码<input name="invite" required maxLength={100} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="长按或右键，选择粘贴" /></label><button className="circle-primary" disabled={busy}>{busy ? '正在处理…' : '确认加入'}</button></form></details>
        <details ref={createPanel} className="circle-card circle-sidebar-tool" open={openTool === 'create'} onToggle={event => { if (event.currentTarget.open) setOpenTool('create'); else setOpenTool(current => current === 'create' ? '' : current); }}><summary>我要收集 · 创建圈子</summary><p className="circle-fine">适合老师、班长或组织者。只填写问卷的同学，请使用上面的“加入圈子”。</p><form className="circle-form" onSubmit={event => { event.preventDefault(); const form = event.currentTarget; const name = new FormData(form).get('name').trim(); run(async () => { const c = await account.request('/circles', { method: 'POST', body: { name } }); form.reset(); setCircles(current => [{ id: c.id, name: c.name, role: c.role }, ...current.filter(item => item.id !== c.id)]); setSelected(c.id); setOpenTool(''); setNotice('圈子已建好。下一步：生成邀请，把链接发给需要填报的人。'); await refreshListAfterWrite(); }); }}><label>给圈子起个名字<input name="name" maxLength={40} required placeholder="例如：2026 级一班" /></label><button disabled={busy}>{busy ? '正在处理…' : '创建圈子，我来收集'}</button></form></details>
        <p className="circle-sidebar-note">每个圈子单独管理。<br />其他成员看不到你的答卷。</p>
      </aside>
      <div className="circle-main" aria-busy={loading}>{loading || !listed ? <section className="circle-card circle-skeleton" role="status"><span className="ui-spinner" /> 正在打开你的圈子…</section> : !circle ? <section className="circle-card circle-empty circle-task-picker"><span aria-hidden="true">◎</span><p className="circle-eyebrow">从你想做的事开始</p><h2>{circles.length ? '选择一个圈子，继续填报' : '你是来填写，还是收集答卷？'}</h2><p>{circles.length ? '点击圈子列表中的名字进入。也可以加入管理员新发来的邀请。' : '填写的人加入已有圈子，组织者创建圈子。选对入口，后面会一步步提示。'}</p><div className="circle-task-options"><button className="circle-primary" disabled={busy} onClick={() => openTask('join')}><strong>我要填写问卷 →</strong><small>我是成员，输入邀请码加入</small></button><button disabled={busy} onClick={() => openTask('create')}><strong>我要收集答卷 →</strong><small>我是组织者，创建并邀请大家</small></button></div><details className="circle-help"><summary>没有邀请码，该怎么办？</summary><p>请向老师、班长或活动组织者索取邀请链接或邀请码。只是想先体验网站，也可以回到首页做个人测评。</p></details><button className="circle-text-button" disabled={busy} onClick={() => { onInviteHandled?.(); window.location.hash = '#/'; }}>暂时跳过，先回首页看看</button></section> : <>
        <section className="circle-card circle-overview"><div className="circle-section-heading"><div><p className="circle-eyebrow">{circle.role === 'admin' ? '管理员工作台 · 你负责收集答卷' : '成员空间 · 只显示你自己的答卷'}</p><h2 ref={overviewHeading} tabIndex={-1} style={{ scrollMarginTop: '110px' }}>{circle.name}</h2><p>{circle.role === 'admin' ? '圈子已建好。把邀请发给成员，收到的答卷会出现在这里。' : '请确认这是你要填报的圈子，再开始填写。加入圈子不会自动提交答案。'}</p></div><button disabled={busy} className="circle-refresh" onClick={() => run(async () => { if (await reload(circle.id)) setNotice('已查看最新数据。只有成员确认提交的答卷，才会出现在这里。'); })}>↻ 查看最新数据</button></div>
          <CircleSteps admin={circle.role === 'admin'} submitted={Boolean(circle.role === 'admin' ? submitted : circle.submission)} hasMembers={members.length > 1} />
          {circle.role === 'admin' && <OwnSubmission {...{ circle, account, busy, run, reload, onStartQuiz, setNotice }} />}
          {circle.role === 'admin' ? <><div className="circle-metrics" aria-label="圈子填报进度"><div><span>圈内成员</span><strong>{members.length}<small>人</small></strong></div><div><span>已收到答卷</span><strong>{submitted}<small>份</small></strong></div><div><span>等待提交</span><strong>{members.length - submitted}<small>人</small></strong></div></div><div className="circle-progress-label"><span>收集进度 · 含管理员本人</span><strong>{members.length ? Math.round(submitted / members.length * 100) : 0}%</strong></div><progress max={members.length || 1} value={submitted} aria-label="已提交答卷占圈内成员比例" /><div className="circle-actions"><button className={!validMembers.length ? 'circle-primary' : ''} disabled={busy} onClick={() => { invitePanel.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); invitePanel.current?.querySelector('input')?.focus({ preventScroll: true }); }}>下一步：邀请成员 →</button><button className={validMembers.length ? 'circle-primary' : ''} disabled={busy || !validMembers.length || !baseline} onClick={() => setCohortOpen(true)}>查看圈子汇总 →</button></div><p className="circle-fine">{!validMembers.length ? '还没有当前版本的答卷：先邀请成员，等他们确认提交后，再点击“查看圈子汇总”。' : !baseline ? '答卷已收到，汇总所需的数据仍在准备。稍后再点“查看圈子汇总”。' : '可以查看每位成员的原始答案，或打开汇总了解整体情况。'} 管理员也计入成员数，自己填报是可选的。</p><details className="circle-help"><summary>不熟悉操作？查看收卷步骤</summary><ol><li>在“邀请成员”里生成邀请，点击“复制邀请链接”。</li><li>把链接发到成员能收到的地方；成员打开后登录或注册，再确认加入。</li><li>提醒成员完成十题，在核对页勾选同意并点击提交。</li><li>回到这里，点击“查看最新数据”。答卷不会因为只答完题就自动交上来。</li></ol><p>无需来回传文件；需要留档时，再展开下方的“下载答卷”。</p></details></> : <><OwnSubmission {...{ circle, account, busy, run, reload, onStartQuiz, setNotice }} /><details className="circle-help"><summary>填写前，看看这三件事</summary><p>十道题都是单选，按你的真实日常选择即可，没有标准答案。填完会先展示你的档案，再由你核对十题、勾选共享同意并点击提交。</p><p>只加入、只答题或只查看档案，都不会自动交给管理员。你也可以选择“稍后提交”。</p></details></>}
        </section>
        {circle.role === 'admin' && <>
          <section className="circle-card circle-invitation-card" ref={invitePanel}><p className="circle-eyebrow">把邀请发给需要填报的人</p><h2>邀请成员</h2><p className="circle-fine">先生成，再复制链接发给成员。邀请只允许加入这个圈子，不会让对方成为管理员。</p><form className="circle-invite-form" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); run(async () => { const issuedInvite = await account.request(`/circles/${circle.id}/invites`, { method: 'POST', body: { maxUses: Number(form.get('maxUses')), hours: Number(form.get('hours')) } }); setIssued(issuedInvite); setManualCopy(false); setCopyFeedback(''); setNotice('邀请已生成，但还没有发出。请点击“复制邀请链接”，再发给需要填报的人。'); if (!await refreshInvitesAfterWrite(circle.id)) setCopyFeedback('这份邀请已经生成，可以继续复制。旧邀请列表暂时未更新，稍后点“查看最新数据”即可，不用再次生成。'); }); }}><label>最多可加入几个人<input name="maxUses" type="number" min={1} max={100} defaultValue={30} required /><small>1～100 人，可按班级人数调整</small></label><label>邀请多久有效<select name="hours" defaultValue="72"><option value="24">1 天</option><option value="72">3 天</option><option value="168">7 天</option></select><small>过期后可以重新生成邀请</small></label><button className={!issued ? 'circle-primary' : ''} disabled={busy}>{busy ? '正在生成…' : issued ? '再生成一份邀请' : '① 生成邀请'}</button></form>
            {issued && <div className="circle-issued"><h3>邀请已准备好，接下来发给成员</h3><label>本次生成的邀请码<input aria-label="本次生成的邀请码" readOnly value={issued.token} onFocus={e => e.target.select()} /></label><div className="circle-actions"><button className="circle-primary" disabled={busy} onClick={() => run(() => copyInvitation(invitationLink(issued.token, window.location.href), '邀请链接已复制。现在打开你常用的聊天工具，粘贴后发给成员即可。'))}>② 复制邀请链接</button><button disabled={busy} onClick={() => run(() => copyInvitation(issued.token, '邀请码已复制。请发给成员，让对方在“加入圈子”中粘贴。'))}>只复制邀请码</button></div>{copyFeedback && <p className="circle-copy-feedback" role="status">{copyFeedback}</p>}<details open={manualCopy} onToggle={event => setManualCopy(event.currentTarget.open)}><summary>复制没反应？在这里手动复制</summary><label>邀请链接（点击后可全选）<input ref={manualLink} aria-label="邀请链接" readOnly value={invitationLink(issued.token, window.location.href)} onFocus={e => e.target.select()} /></label><p>电脑：选中文字后按 Ctrl+C；手机：长按文字框，选择“全选”和“复制”。</p></details><p>有效至 {time(issued.expiresAt)}。请现在保存链接，离开此页后原码不会再次显示；忘记保存时重新生成即可。</p><details className="circle-role-test-help"><summary>自己一个人，怎么试完整的多人流程？</summary><ol><li>先保存当前管理员的账号和密码，再复制邀请链接。</li><li>普通标签页会共用登录身份。请用另一个浏览器打开链接，或者先退出管理员，再用一个新的成员账号注册。</li><li>成员完成十题，核对后勾选共享同意并点击提交。答完题本身不会自动交卷。</li><li>回到管理员使用的浏览器；若已退出，重新登录管理员账号。打开本圈，点击“查看最新数据”，核对成员答卷和汇总。</li></ol><p>已经在本圈的账号不需要再次加入。看到“你已在这个圈子中”时，选择“暂时不加入”，从圈子列表进入即可。</p></details>{['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) && <p className="circle-local-warning"><strong>这份链接暂时只能在本机打开。</strong>要让其他人用手机或电脑填写，请先使用可对外访问的网站地址；可从页面底部“管理员工具：部署、下载与交接”查看说明。</p>}</div>}
            {!!invites.length && <details className="circle-secondary-tools"><summary>管理旧邀请 · 最近 {invites.length} 条</summary><p className="circle-fine">撤销后，尚未加入的人将无法再使用该邀请；已经加入的成员不受影响。</p><ul className="circle-invite-list">{invites.map(i => <li key={i.id}><span>{i.uses}/{i.maxUses} 人已使用 · {i.revoked ? '已撤销' : new Date(i.expiresAt) <= new Date() ? '已过期' : i.uses >= i.maxUses ? '已用完' : `至 ${time(i.expiresAt)}`}</span>{!i.revoked && i.uses < i.maxUses && new Date(i.expiresAt) > new Date() && <button disabled={busy} onClick={() => run(async () => { await account.request(`/circles/${circle.id}/invites/${i.id}`, { method: 'DELETE' }); if (issued?.id === i.id) setIssued(null); setNotice('这份邀请已撤销。已加入的成员不受影响，未加入的人需要新的邀请。'); if (!await refreshInvitesAfterWrite(circle.id)) setError('邀请已撤销成功，但旧邀请列表暂时未更新。请点“重新加载圈子”核对，无需再次撤销。'); })}>撤销邀请</button>}</li>)}</ul></details>}
          </section>
          <AdminMembers key={circle.id} {...{ circle, members, busy, run, account, reload, setNotice }} />
        </>}
        <details className="circle-card circle-security"><summary>账号安全 · 修改密码</summary><form className="circle-form" onSubmit={event => { event.preventDefault(); const form = event.currentTarget; const body = Object.fromEntries(new FormData(form)); run(async () => { await account.request('/password', { method: 'POST', body }); form.reset(); setNotice('密码已更新，其他设备上的旧登录已失效。'); }); }}><label>当前密码<input name="currentPassword" type="password" required minLength={1} maxLength={128} autoComplete="current-password" /></label><label>新密码（6～12 位）<input name="password" type="password" required minLength={6} maxLength={12} autoComplete="new-password" placeholder="6～12 位，数字或字母都可以" /></label><button disabled={busy}>更新密码</button></form></details>
      </>}
      </div>
    </div>
    <p className="circle-storage-note"><span aria-hidden="true">◇</span> 填报仅对你和本圈管理员可见。答卷保存在当前网站，退出登录不会删除。规则画像与模拟基准仅供了解校园生活，不用于心理评估。</p>
  </div>;
}
