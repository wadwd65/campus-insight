import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { rememberGettingStarted, shouldOfferGettingStarted } from '../lib/gettingStarted.js';
import './GettingStartedGuide.css';

function GuideIllustration({ circle }) {
  return <svg className="getting-started-illustration" viewBox="0 0 240 156" fill="none" aria-hidden="true">
    <circle cx="147" cy="67" r="54" fill="#e1efe9" />
    <circle cx="199" cy="31" r="13" fill="#ebcb8a" opacity=".8" />
    <path d="M14 136h214M37 145h167" stroke="#91ad9a" opacity=".5" />
    <path d="M23 132V80l27-15 27 15v52M32 91h9m13 0h9M32 104h9m13 0h9M45 117v15M179 131V88h36v43m-27-33h6m7 0h6m-19 13h6m7 0h6" stroke="#6d9983" strokeWidth="1.5" />
    <rect x="105" y="24" width="82" height="113" rx="7" fill="#d4e3d6" stroke="#90af98" transform="rotate(8 105 24)" />
    <rect x="89" y="18" width="82" height="113" rx="7" fill="#fffdf5" stroke="#90af98" transform="rotate(-6 89 18)" />
    {circle ? <><circle cx="113" cy="56" r="9" fill="#bed8c8" /><circle cx="144" cy="56" r="9" fill="#dfc89d" /><path d="M99 83c1-17 27-17 28 0m4 0c1-17 25-17 26 0" stroke="#39775d" strokeWidth="2" strokeLinecap="round" /><path d="m112 96 11 10 21-23" stroke="#39775d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></> : <><path d="m128 43 21 13-4 23-25 8-17-18 6-20 19-6Z" fill="#e5eee2" stroke="#51876b" strokeWidth="1.4" /><path d="m128 43-8 44m-17-18 46-13m-40-7 36 30" stroke="#51876b" opacity=".4" /><path d="m107 104 37-4m-36 12 26-3" stroke="#9fb5a0" strokeWidth="2" strokeLinecap="round" /></>}
    <path d="M51 37v10m-5-5h10M204 67v8m-4-4h8" stroke="#ab8c50" strokeLinecap="round" />
    <path d="m26 61 7-9 7 9" stroke="#91ad9a" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

const STEP_LABELS = ['选一个用途', '看懂怎么用', '准备开始'];

/**
 * Render near the page's main actions or in a toolbar. The callbacks only navigate;
 * this guide never creates an account, fills answers, or sends a submission.
 * autoShow should be enabled after the opening animation, on a safe landing page.
 */
export default function GettingStartedGuide({
  autoShow = false,
  context = 'home',
  onStartPersonal,
  onOpenCircles,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState(context === 'circles' ? 'circles' : 'personal');
  const offered = useRef(false);
  const dialog = useRef(null);
  const heading = useRef(null);
  const content = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const circle = goal === 'circles';

  useEffect(() => {
    if (autoShow && !offered.current && shouldOfferGettingStarted()) {
      offered.current = true;
      setGoal(context === 'circles' ? 'circles' : 'personal');
      setStep(0);
      setOpen(true);
    }
  }, [autoShow, context]);

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const previousFocus = document.activeElement;
    element.showModal();
    return () => {
      if (element.open) element.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      if (content.current) content.current.scrollTop = 0;
      heading.current?.focus({ preventScroll: true });
    }
  }, [open, step]);

  function showGuide() {
    offered.current = true;
    setGoal(context === 'circles' ? 'circles' : 'personal');
    setStep(0);
    setOpen(true);
  }

  function dismiss(outcome = 'skipped') {
    rememberGettingStarted(outcome);
    setOpen(false);
  }

  function start() {
    dismiss('completed');
    if (circle) onOpenCircles?.();
    else onStartPersonal?.();
  }

  const titles = ['第一次来？我们陪你走一遍', circle ? '登录和注册，选对一个就好' : '按自己的日常，选最接近的答案', circle ? '进入圈子，一起记录日常' : '现在，开始认识你的校园日常'];
  const descriptions = ['先选你今天想做的事。不确定也没关系，之后可以随时换。', circle ? '已有账号就登录；第一次使用这个网站，再注册。' : '个人测评一共 10 道选择题，不需要注册账号。', circle ? '这里只带你打开账号页面，加入和提交都由你自己确认。' : '这里只打开答题页面，不会替你填写或提交任何内容。'];

  return <>
    <button type="button" className={`getting-started-trigger ${className}`.trim()} onClick={showGuide} aria-haspopup="dialog">
      <span className="getting-started-help-icon" aria-hidden="true">?</span>使用帮助
    </button>
    {open && typeof document !== 'undefined' && createPortal(
      <dialog ref={dialog} className="getting-started-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}
        onCancel={event => { event.preventDefault(); dismiss(); }}>
        <div className="getting-started-panel">
          <div className="getting-started-topline"><span><span aria-hidden="true">✦</span> 新手指引 · 随时可以离开</span><button type="button" onClick={() => dismiss()}>跳过引导 <span aria-hidden="true">×</span></button></div>
          <div className="getting-started-content" ref={content}>
            <ol className="getting-started-progress" aria-label="引导进度">
              {STEP_LABELS.map((label, index) => <li key={label} aria-current={index === step ? 'step' : undefined} className={index <= step ? 'is-reached' : ''}><span aria-hidden="true">{index < step ? '✓' : index + 1}</span><span>{label}</span></li>)}
            </ol>
            <div className="getting-started-intro"><div><p className="getting-started-kicker">第 {step + 1} 步 / 共 3 步</p><h2 id={titleId} ref={heading} tabIndex={-1}>{titles[step]}</h2><p id={descriptionId}>{descriptions[step]}</p></div><GuideIllustration circle={circle} /></div>

            {step === 0 && <fieldset className="getting-started-choices"><legend className="getting-started-sr-only">选择你想做的事</legend>
              <label className={`getting-started-choice ${!circle ? 'is-selected' : ''}`}><input type="radio" name={`${titleId}-goal`} value="personal" checked={!circle} onChange={() => setGoal('personal')} /><span className="getting-started-choice-copy"><strong>我想看看自己的画像 <em>推荐先体验</em></strong><span>答 10 道选择题，查看自己的校园生活报告。</span><small>不用登录 · 个人体验不会交给圈子管理员</small></span></label>
              <label className={`getting-started-choice ${circle ? 'is-selected' : ''}`}><input type="radio" name={`${titleId}-goal`} value="circles" checked={circle} onChange={() => setGoal('circles')} /><span className="getting-started-choice-copy"><strong>我要填报 / 收集答卷</strong><span>成员使用邀请加入，管理员可以创建圈子。</span><small>需要账号 · 提交前会说明谁能看到答卷</small></span></label>
            </fieldset>}

            {step === 1 && <ol className="getting-started-instructions">{(circle ? [
              ['已有账号？点「登录」', '填写之前注册的账号和密码，不用重新注册。'],
              ['第一次来？点「注册」', '受邀成员准备邀请链接或邀请码；想组织收卷，选择创建自己的圈子。两种方式都由你自设6～12位密码。'],
              ['成员填报，管理员收集', '管理员可以创建圈子并发送邀请。成员提交前会再次确认，管理员只能看到已提交给本圈的答卷。'],
            ] : [
              ['每题点选一个答案', '按照自己的日常选择，没有标准答案，也不用输入长文字。'],
              ['点「下一题」继续', '想改答案时可以回到上一题；全部答完后再生成报告。'],
              ['报告出来后慢慢看', '结果用于了解日常倾向；对照数据是模拟基准，不代表真实大学生排名。'],
            ]).map(([title, text], index) => <li key={title}><span aria-hidden="true">{index + 1}</span><div><strong>{title}</strong><p>{text}</p></div></li>)}</ol>}

            {step === 2 && <div className="getting-started-ready"><span className="getting-started-ready-icon" aria-hidden="true">✓</span><div><h3>{circle ? '下一站：登录 / 注册' : '下一站：个人测评'}</h3><p>{circle ? '已有账号直接登录。成员没有收到邀请，可以先联系管理员；管理员登录后可创建圈子，再邀请成员。' : '不想登录也能完整体验。你的选择由你决定，之后也可以再修改。'}</p></div></div>}

            <div className="getting-started-note"><span aria-hidden="true">i</span><p>{step === 0 ? '跳过只会关闭这份指引，所有功能仍可使用。以后点「使用帮助」就能重看。' : circle && step === 1 ? '账号和密码请自己保存；当前没有邮件找回。不确定时，可以先跳过指引，联系管理员。' : '不用一次学会所有功能。你可以随时跳过指引，再从「使用帮助」重新查看。'}</p></div>
          </div>
          <div className="getting-started-footer"><span className="getting-started-footer-hint">{step === 0 ? '按你的需要选择即可' : '慢慢来，每一步都可以返回'}</span><div>{step > 0 && <button type="button" className="getting-started-secondary" onClick={() => setStep(step - 1)}>上一步</button>}{step < 2 ? <button type="button" className="getting-started-primary" onClick={() => setStep(step + 1)}>下一步 <span aria-hidden="true">→</span></button> : <button type="button" className="getting-started-primary" onClick={start}>{circle ? '打开登录 / 注册' : '开始个人测评'} <span aria-hidden="true">→</span></button>}</div></div>
        </div>
      </dialog>, document.body)}
  </>;
}
