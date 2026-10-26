import { useEffect, useState } from 'react';
import { useAccount } from '../lib/accounts.jsx';

function ArchiveIllustration() {
  return <svg className="auth-illustration" viewBox="0 0 420 225" fill="none" aria-hidden="true">
    <circle cx="215" cy="115" r="96" stroke="currentColor" opacity=".12" /><circle cx="215" cy="115" r="70" stroke="currentColor" opacity=".12" />
    <path d="M20 186h380M42 202h327" stroke="currentColor" opacity=".18" />
    <path d="M65 180V92l45-25 45 25v88M75 104h70M84 116v18m22-18v18m22-18v18M86 146v34m42-34v34" stroke="currentColor" strokeWidth="1.5" opacity=".5" />
    <path d="M280 181V107h63v74m-52-61h9m14 0h9m-32 17h9m14 0h9m-32 17h9m14 0h9" stroke="currentColor" opacity=".45" />
    <rect x="167" y="43" width="112" height="146" rx="5" fill="#e7ebdc" stroke="#94af9b" transform="rotate(8 167 43)" />
    <rect x="151" y="36" width="112" height="146" rx="5" fill="#fffdf5" stroke="#9db7a2" transform="rotate(-7 151 36)" />
    <path d="M171 66l54-7m-50 71 53-7m-50 21 53-7m-51 20 33-4" stroke="#aab9a1" strokeWidth="2" />
    <path d="m200 78 21 12-2 23-24 10-20-16 6-22 19-7Z" stroke="#327766" strokeWidth="1.4" /><path d="m200 78-5 45m-20-16 46-17m-40-5 38 28" stroke="#327766" opacity=".3" />
    <circle cx="331" cy="55" r="11" fill="#d7b77e" opacity=".65" /><path d="M365 83v12m-6-6h12M124 36v8m-4-4h8" stroke="#a88049" />
  </svg>;
}

export default function CircleAuth({ pendingInvite = '', onInviteHandled, onSkip, onPreviewSample, sampleBusy = false, sampleError = '' }) {
  const account = useAccount();
  const [mode, setMode] = useState(pendingInvite ? 'register' : 'login');
  const [registrationMode, setRegistrationMode] = useState(pendingInvite ? 'join' : 'create');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [showPassword, setShowPassword] = useState(false);
  const [fieldError, setFieldError] = useState(null);
  const [previewFailure, setPreviewFailure] = useState('');
  const actualMode = mode;
  const registering = actualMode !== 'login';
  function changeMode(next) { if (busy || sampleBusy) return; setMode(next); setError(''); setFieldError(null); setShowPassword(false); }
  useEffect(() => { if (pendingInvite) { setMode('register'); setRegistrationMode('join'); setError(''); setFieldError(null); } }, [pendingInvite]);
  async function submit(event) {
    event.preventDefault(); setError(''); setFieldError(null);
    if (busy || sampleBusy || !account) return;
    const element = event.currentTarget;
    const form = new FormData(element);
    const reject = (field, message) => { setFieldError({ field, message }); element.elements.namedItem(field)?.focus(); };
    const username = String(form.get('username') || '').trim();
    const password = String(form.get('password') || '');
    if (!username) return reject('username', registering ? '先给自己设置一个账号名，例如 xiaolin01。' : '请输入你注册时设置的账号名。');
    if (!/^[a-zA-Z0-9_.@-]{3,40}$/.test(username)) return reject('username', '账号用 3～40 位字母、数字或 _.@-，例如 xiaolin01。');
    if (!password) return reject('password', registering ? '请设置一个 6～12 位密码，并自己保存。' : '请输入这个账号的密码。');
    if (registering && (password.length < 6 || password.length > 12)) return reject('password', '密码需为 6–12 位，纯数字也可以。');
    if (password.length > 128) return reject('password', '密码太长了，请检查是否粘贴了其他内容。');
    if (registering && registrationMode === 'join' && !String(form.get('invite') || '').trim()) return reject('invite', '请粘贴管理员发来的邀请码，或直接打开邀请链接。');
    form.set('username', username);
    if (form.has('invite')) form.set('invite', String(form.get('invite')).trim());
    if (registering) form.set('registrationMode', registrationMode);
    setBusy(true);
    try {
      await account.request(`/${actualMode}`, { method: 'POST', body: Object.fromEntries(form) });
      if (actualMode === 'register') onInviteHandled?.();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  const previewSample = onPreviewSample && <div className="circle-sample-preview"><strong>想先看看收卷后的样子？</strong><p>可以先看一份模拟结果，了解圈子汇总能做什么。</p><button type="button" disabled={busy || sampleBusy} onClick={async () => { if (busy || sampleBusy) return; setPreviewFailure(''); try { await onPreviewSample(); } catch { setPreviewFailure('模拟示例暂时没能打开，请稍后再试。'); } }}>{sampleBusy ? <><span className="ui-spinner" /> 正在打开模拟示例…</> : '先看收卷后的模拟示例'}</button><p className="circle-sample-disclosure">仅展示合成示例，不是本站成员的在线答卷。你也可以直接注册，创建自己的圈子。</p>{(sampleError || previewFailure) && <p role="alert" className="circle-error">{sampleError || previewFailure}</p>}</div>;
  if (account?.status === 'loading') return <section className="circle-card circle-service-loading"><p role="status"><span className="ui-spinner" /> 正在连接账号服务…</p><p>不用等待连接，也可以先体验个人测评或查看模拟结果。</p>{onSkip && <button type="button" disabled={sampleBusy} onClick={onSkip}>先体验个人测评</button>}{previewSample}</section>;
  if (!account || account.status === 'offline') return <section className="circle-card circle-offline"><p className="circle-eyebrow">圈子连接状态</p><h1>{account?.serviceError?.kind === 'unavailable' ? '这个地址暂不提供在线圈子' : '暂时无法确认圈子连接'}</h1><p role="alert">{account?.serviceError?.message || '暂时无法连接账号服务，可能是网络或服务异常。请重新连接，或向网站管理员确认可用网址。'}</p><p>个人测评和模拟示例仍可尝试。真实填报需要可用的账号服务，模拟示例不会代替真实收卷。</p><div className="circle-actions"><button disabled={sampleBusy || !account?.refresh} onClick={account?.refresh}>重新连接</button>{onSkip && <button disabled={sampleBusy} onClick={onSkip}>先体验个人测评</button>}</div>{previewSample}</section>;
  return <div className="circle-auth-grid">
    <section className="circle-intro">
      <p className="circle-eyebrow"><span className="circle-dot" /> CAMPUS CIRCLES / 校园里的我们</p>
      <h1>每一种日常，<br />都值得被<span>看见。</span></h1>
      <p className="auth-lead">从一个人的校园档案，<br className="auth-desktop-break" />到一群人的生活切面。</p>
      <ArchiveIllustration />
      <ol className="auth-steps"><li><b>01</b><span><strong>自己建圈，或受邀加入</strong><small>每个人都能成为自己圈子的管理员。</small></span></li><li><b>02</b><span><strong>十道选择，留下一份日常</strong><small>没有标准答案，提交前由你确认。</small></span></li><li><b>03</b><span><strong>汇成画像，理解彼此的不同</strong><small>管理员直接查看答卷与汇总，无需收文件。</small></span></li></ol>
    </section>
    <section className="circle-card auth-panel" aria-labelledby="auth-title">
      <div className="auth-panel-top"><span className="auth-mark" aria-hidden="true">◎</span><span>校园生活档案<small>CAMPUS INSIGHT · 你的大学平行宇宙</small></span></div>
      <div className="auth-tabs" role="group" aria-label="账号入口"><button type="button" aria-pressed={mode === 'login'} disabled={busy || sampleBusy} onClick={() => changeMode('login')}>登录</button><button type="button" aria-pressed={mode === 'register'} disabled={busy || sampleBusy} onClick={() => changeMode('register')}>注册</button></div>
      <p className="circle-eyebrow">{registering ? 'CREATE ACCOUNT / 欢迎加入' : 'WELCOME BACK / 好久不见'}</p>
      <h2 id="auth-title">{registering ? '注册账号' : '账号登录'}</h2>
      <p className="auth-caption">{registering ? '自己设置账号和密码。每个人都可以创建圈子，管理自己收集的答卷。' : '已有账号直接登录。第一次来？切到“注册”，就能创建自己的圈子。'}</p>
      {registering && <fieldset className="auth-register-choice"><legend>你想怎样开始？</legend><label><input type="radio" name="registration-choice" checked={registrationMode === 'create'} disabled={busy} onChange={() => { setRegistrationMode('create'); setError(''); setFieldError(null); onInviteHandled?.(); }} /><span>创建圈子，我当管理员</span></label><label><input type="radio" name="registration-choice" checked={registrationMode === 'join'} disabled={busy} onChange={() => { setRegistrationMode('join'); setError(''); setFieldError(null); }} /><span>使用邀请，加入已有圈子</span></label></fieldset>}
      {pendingInvite && <p className="circle-notice">邀请已带入。{registering ? '已有账号？切到「登录」即可，无需重新注册。' : '登录后确认加入，无需重新粘贴。'}</p>}
      <form key={actualMode} onSubmit={submit} onInput={() => { if (fieldError) setFieldError(null); if (error) setError(''); }} className="circle-form" aria-labelledby="auth-title" aria-busy={busy} noValidate>
        <label>账号<input name="username" required minLength={3} maxLength={40} pattern="[a-zA-Z0-9_.@-]+" autoComplete="username" placeholder={registering ? '例如 xiaolin01' : '输入注册时设置的账号'} spellCheck={false} aria-invalid={fieldError?.field === 'username' || undefined} aria-describedby={fieldError?.field === 'username' ? 'auth-field-error' : registering ? 'auth-username-help' : undefined} />{registering && <small id="auth-username-help" className="auth-input-help">用 3～40 位字母或数字起个账号名，之后用它登录。</small>}</label>
        <div className="auth-password-field"><label htmlFor="circle-auth-password">密码{registering && <small>（6～12 位）</small>}</label><span className="auth-password"><input id="circle-auth-password" name="password" type={showPassword ? 'text' : 'password'} required minLength={registering ? 6 : 1} maxLength={registering ? 12 : 128} autoComplete={registering ? 'new-password' : 'current-password'} placeholder={registering ? '6～12 位，数字或字母都可以' : '输入你的密码'} aria-invalid={fieldError?.field === 'password' || undefined} aria-describedby={fieldError?.field === 'password' ? 'auth-field-error' : undefined} /><button type="button" aria-label={showPassword ? '隐藏密码' : '显示密码'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? '隐藏' : '显示'}</button></span></div>
        {registering && registrationMode === 'join' && (pendingInvite ? <input name="invite" type="hidden" value={pendingInvite} /> : <label>邀请码<input name="invite" required autoComplete="off" maxLength={100} spellCheck={false} placeholder="粘贴管理员给你的邀请码" aria-invalid={fieldError?.field === 'invite' || undefined} aria-describedby={fieldError?.field === 'invite' ? 'auth-field-error' : undefined} /></label>)}
        {registering && registrationMode === 'create' && <label>圈子名称（选填）<input name="circleName" maxLength={40} placeholder="例如：我的班级。不填会自动起名" /></label>}
        {registering && <details className="auth-optional-name"><summary>设置显示名称（选填）</summary><label>显示名称<input name="displayName" maxLength={40} autoComplete="nickname" placeholder="不填时使用账号名" /></label></details>}
        {registering && <p className="circle-fine auth-password-help">请保存账号和密码，当前暂不支持邮件找回。</p>}
        {error && <p role="alert" className="circle-error">{error}</p>}
        {fieldError && <p id="auth-field-error" role="alert" className="auth-input-error">{fieldError.message}</p>}
        <button className="circle-primary auth-submit" disabled={busy || sampleBusy}>{busy ? <><span className="ui-spinner" /> 正在处理…</> : registering ? registrationMode === 'create' ? '注册并创建我的圈子' : '注册并加入圈子' : '登录账号'}</button>
      </form>
      {onSkip && <div className="auth-skip-panel"><button type="button" className="auth-skip-button" disabled={busy || sampleBusy} onClick={onSkip}>暂不登录，先体验个人测评 →</button><p>个人体验不用账号，也不会交给圈子管理员。</p></div>}
      {previewSample}
      <p className="auth-privacy"><span aria-hidden="true">◇</span> 只有你和本圈管理员能看到你提交的答卷。其他成员无法查看。</p>
      <p className="auth-guest-note">自己建圈不用邀请码。加入别人的圈子，请使用对方的邀请。</p>
    </section>
  </div>;
}
