import { useEffect, useRef, useState } from 'react';
import { CircleSubmission } from './CircleSubmission.jsx';
import { QUESTIONS } from '../lib/surveySchema.js';
import { saveSurveyDraft } from '../lib/surveyDraft.js';

/** Personal and circle questionnaires share the same explicit submission step. */
export default function ReportCircleSubmission({ account, context, answers, onBack }) {
  const owner = useRef(account.user.id);
  const [circles, setCircles] = useState(context ? [context] : []);
  const [selected, setSelected] = useState(context?.id || '');
  const [status, setStatus] = useState(context ? 'ready' : 'loading');
  const [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const [destination, setDestination] = useState(null);
  const [name, setName] = useState(''), [creating, setCreating] = useState(false);
  const active = useRef(true), createLock = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (context) return;
    let current = true;
    setStatus('loading'); setError('');
    account.request('/circles').then(result => {
      if (!current) return;
      setCircles(result.circles);
      setSelected(result.circles.length === 1 ? result.circles[0].id : '');
      setStatus('ready');
    }).catch(cause => { if (current) { setStatus('error'); setError(cause.message); } });
    return () => { current = false; };
  }, [account.request, context, attempt]);

  function confirm(circle) {
    const target = { id: circle.id, name: circle.name, userId: owner.current };
    saveSurveyDraft(QUESTIONS.length - 1, answers, undefined, `${target.userId}:${target.id}`);
    try { window.sessionStorage.setItem(`campus:circle:${target.userId}`, target.id); } catch { /* Optional. */ }
    setDestination(target);
  }
  async function create(event) {
    event.preventDefault();
    if (createLock.current || !name.trim()) return;
    createLock.current = true; setCreating(true); setError('');
    try {
      const circle = await account.request('/circles', { method: 'POST', body: { name: name.trim() } });
      if (active.current) { setCircles([circle]); setSelected(circle.id); confirm(circle); }
    } catch (cause) { if (active.current) setError(cause.message); }
    finally { createLock.current = false; if (active.current) setCreating(false); }
  }
  if (account.user?.id !== owner.current) return null;
  const circle = circles.find(item => item.id === selected);
  return <section className="circle-workspace report-circle-submit" aria-label="将我的档案提交到圈子">
    {destination ? <CircleSubmission key={destination.id} account={account} context={destination} answers={answers} onBack={onBack} /> : <>
      <h2>档案已生成，现在可以提交到圈子</h2>
      <p>管理员也可以提交自己的答卷。直接使用刚才的十题答案，不用重新填写。</p>
      {status === 'loading' ? <p role="status">正在查找你创建或加入的圈子…</p> : status === 'error' ? <><p className="circle-error" role="alert">{error}</p><button onClick={() => setAttempt(value => value + 1)}>重新查找圈子</button></> : circles.length ? <>
        {circles.length > 1 ? <label>这份答卷交到哪个圈子？<select value={selected} onChange={event => setSelected(event.target.value)}><option value="">请选择一个圈子</option>{circles.map(item => <option key={item.id} value={item.id}>{item.name}{item.role === 'admin' ? '（我管理的）' : ''}</option>)}</select></label> : <p>提交到：<strong>{circle?.name}</strong></p>}
        <button type="button" className="circle-primary report-submit-button" disabled={!circle} onClick={() => confirm(circle)}>提交到我的圈子 →</button>
        <p className="circle-fine">点击后先核对共享范围，勾选同意再确认。尚未确认时不会交出答卷。</p>
      </> : <form className="circle-form" onSubmit={create}>
        <p>你还没有圈子。可以在这里创建一个，再提交刚才的答案。</p>
        <label>给圈子起个名字<input value={name} onChange={event => setName(event.target.value)} maxLength={40} required placeholder="例如：我的班级" disabled={creating} /></label>
        <button className="circle-primary" disabled={creating || !name.trim() || Boolean(error)}>{creating ? '正在创建…' : '创建圈子，继续提交 →'}</button>
        {error && <div className="circle-error" role="alert"><p>{error}</p><p>请先重新查找圈子，核对刚才是否已创建成功。</p><button type="button" onClick={() => setAttempt(value => value + 1)}>重新查找圈子</button></div>}
        <p className="circle-fine">如果你要填报别人的圈子，请先保存这份个人报告，再用对方的邀请链接加入。</p>
      </form>}
    </>}
  </section>;
}
