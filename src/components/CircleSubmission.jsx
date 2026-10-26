import { useRef, useState } from 'react';
import { MATRIX_VERSION, QUESTIONS, isKnownOption } from '../lib/surveySchema.js';
import { AnswerReview } from './CircleAnswers.jsx';
import { clearSurveyDraft } from '../lib/surveyDraft.js';
import './circles.css';
import './circle-guidance.css';
const time = value => new Date(value).toLocaleString('zh-CN', { hour12: false });

export function CircleSubmission({ account, context, answers, onBack }) {
  const [agreed, setAgreed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(null);
  const submitting = useRef(false);
  const validIdentity = account.user?.id === context.userId;
  const completed = QUESTIONS.filter(q => isKnownOption(q.field, answers?.[q.field])).length;
  const complete = completed === QUESTIONS.length;

  async function submit() {
    if (submitting.current || !agreed || !validIdentity || !complete || saved) return;
    submitting.current = true;
    setBusy(true); setError('');
    try {
      const result = await account.request(`/circles/${context.id}/submissions`, { method: 'POST', body: { answers, matrixVersion: MATRIX_VERSION, consent: 'circle-raw-v1', expectedUserId: context.userId } });
      clearSurveyDraft(undefined, `${context.userId}:${context.id}`);
      setSaved(result.submission);
    } catch (e) { setError(e.message); }
    finally { submitting.current = false; setBusy(false); }
  }

  return <section className={`circle-submission circle-workspace${saved ? ' is-saved' : ''}`} aria-label="提交圈子答卷">
    <div className="circle-review-heading"><span className="circle-review-icon" aria-hidden="true">{saved ? '✓' : '3'}</span><div><p className="circle-eyebrow">{context.name} · {saved ? '提交完成' : '最后一步：核对并提交'}</p><h2>{saved ? '提交成功，已保存到圈子' : '十题已填完，还差你的确认'}</h2></div></div>
    {saved ? <>
      <p role="status" className="circle-review-result">已保存到「{context.name}」<br />{time(saved.submittedAt)} · 第 {saved.revision} 次提交</p>
      <p>这次填报已经完成，不需要再传文件。返回圈子后，可以查看已交答案，也可以撤回或重新填报。</p>
      <details className="circle-review-answers"><summary>看看刚刚交出的十题答案</summary><AnswerReview answers={answers} /></details>
      <div className="circle-actions"><button className="circle-primary" onClick={onBack}>完成，返回我的圈子 →</button></div>
    </> : <>
      <p>先确认下面的圈子和账号，再核对答案。只有勾选同意并点击绿色按钮，答卷才会交给管理员。</p>
      <dl className="circle-review-destination"><div><dt>交给哪个圈子</dt><dd>{context.name}</dd></div><div><dt>以谁的身份提交</dt><dd>{account.user?.displayName || '尚未登录'}</dd></div></dl>
      <details className="circle-review-answers"><summary>① 展开核对十题答案 · 已填写 {completed}/{QUESTIONS.length} 题</summary><AnswerReview answers={answers} /><p className="circle-fine">想修改答案？先选“稍后提交”，回圈子点击“继续填写”，再用答题页的“上一题”修改。</p></details>
      <div className="circle-sharing-note"><h3>② 提交后，谁能看见什么？</h3><p>本圈管理员能看到<strong>你的显示名称、完整十题原始答案和提交时间</strong>，并将答卷用于圈子汇总。其他普通成员看不到你的答卷。</p><p>答卷会保存在当前网站。再次提交会替换你在本圈的上一份答卷；你可以回圈子撤回，管理员已经保存的副本无法一并撤回。</p></div>
      {!validIdentity && <p role="alert" className="circle-error">当前登录账号与答题时不同。请返回圈子，使用正确账号重新进入填写，避免交到别人的账号下。</p>}
      {!complete && <p role="alert" className="circle-error">还有答案未完成或无法识别。请先返回圈子继续填写，完成全部十题后再提交。</p>}
      <label className="circle-consent"><input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} disabled={busy || !validIdentity || !complete} /><span>我已了解以上共享范围，同意把本轮答卷提交给「{context.name}」的管理员。</span></label>
      {error && <div role="alert" className="circle-error"><strong>暂时没能确认提交成功</strong><p>{error}</p><p>网络中断时，答卷可能已经保存。请先回圈子查看提交状态；尚未收到时，再从“继续填写”进入提交，无需重新答十题。</p></div>}
      <div className="circle-actions circle-submit-actions">{error ? <button className="circle-primary" onClick={onBack}>先回圈子，核对提交结果 →</button> : <><button className="circle-primary" disabled={!agreed || busy || !validIdentity || !complete} onClick={submit}>{busy ? '正在提交，请稍候…' : '③ 确认提交到圈子'}</button><button disabled={busy} onClick={onBack}>{!validIdentity || !complete ? '返回圈子，继续填写' : '稍后提交，返回圈子'}</button></>}</div>
      {!agreed && validIdentity && complete && <p className="circle-fine circle-consent-help">想现在提交？请先勾选上方的同意框。也可以稍后再决定。</p>}
      <p className="circle-fine">选择“稍后提交”不会共享答案。草稿仅在当前浏览器标签页保存；稍后回到同一圈子，点击“继续填写”即可。</p>
    </>}
  </section>;
}
