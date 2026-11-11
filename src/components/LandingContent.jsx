import AccountButton from './AccountButton.jsx';
import { readSurveyDraft } from '../lib/surveyDraft.js';
import ProfilePreview from './ProfilePreview.jsx';
import CampusStoryEntry from './CampusStoryEntry.jsx';
import ProductFooter from './ProductFooter.jsx';
import GettingStartedGuide from './GettingStartedGuide.jsx';
import { useAccount } from '../lib/accounts.jsx';
import HomeShowcase, { HomeSectionNav } from './HomeShowcase.jsx';

function Mark() {
  return <svg viewBox="0 0 40 40" role="img" aria-label="终端纹章"><path d="M20 2 36 11v18L20 38 4 29V11Z" fill="none" stroke="currentColor"/><path d="m20 10 9 10-9 10-9-10Z" fill="currentColor"/><path d="M20 2v8m16 19-9-5M4 29l9-5" stroke="currentColor"/></svg>;
}

export default function LandingContent({
  baseline, onGoQuiz, onOpenReport, onStartDay = onGoQuiz, onGoStory,
  onGoUpload, onGoCircles, onPreviewSample, sampleBusy = false, sampleError = '',
  accountLabel = '登录 / 注册', onReplayIntro,
  pendingGuestReport = null, onCarryoverGuestReport, onDismissGuestReport,
}) {
  const account = useAccount();
  const draft = readSurveyDraft(undefined, account?.user?.id || '');
  const previewOnly = account?.status === 'offline' && account.serviceError?.kind === 'unavailable';
  const canResume = Boolean(draft && (draft.index > 0 || Object.keys(draft.answers).length));

  return <div className="landing-shell">
    <header className="landing-header">
      <div className="landing-brand"><Mark /><span><b>校园行迹</b><small>从真实回答，认识你的校园日常</small></span></div>
      <div className="landing-header-tools">
        <a className="landing-3d-entry" href={`${import.meta.env.BASE_URL}map/校园地图-3D实景.html`} target="_blank" rel="noopener noreferrer" title="3D校园自由参观：步行与开车，不改变答卷。建议电脑端打开。">
          <svg className="landing-3d-icon" viewBox="0 0 36 40" fill="none" aria-hidden="true"><path d="m18 2 16 9v18l-16 9L2 29V11Z" fill="currentColor" fillOpacity=".08" stroke="currentColor"/><path d="m2 11 16 9 16-9M18 20v18" stroke="currentColor"/><path d="m18 9 9 5-9 5-9-5Z" fill="currentColor" fillOpacity=".2"/><path d="M8 25v-6m5 9v-6m10 6v-6m5 3v-6" stroke="currentColor" strokeWidth="2"/></svg>
          <span className="landing-3d-copy"><b>3D 校园漫游</b><small>自由参观 · 电脑端</small></span><i aria-hidden="true">↗</i>
        </a>
        {onGoCircles && <AccountButton label={previewOnly ? '圈子服务说明' : accountLabel} onClick={onGoCircles} />}
      </div>
    </header>
    <main className="landing-main">
      {previewOnly && <aside className="site-preview-notice" role="status"><strong>当前为公开体验版</strong><p>可体验个人测评、模拟班级与地图。这个地址暂未开通在线账号和真实收卷，请勿把它当作成员填报地址。</p></aside>}
      {pendingGuestReport && <section className="guest-report-carryover" role="region" aria-label="承接登录前的访客答卷">
        <div><strong>发现你登录前刚完成的十题个人答卷</strong><p>是否把刚才这份访客答卷带入当前账号（{account?.user?.displayName}）？带入后可直接查看个人报告，或在核对并明确同意后提交到圈子。</p></div>
        <div className="guest-report-carryover-actions">
          <button type="button" className="carryover-confirm" onClick={onCarryoverGuestReport}>带入刚才这份答卷 →</button>
          <button type="button" className="carryover-dismiss" onClick={onDismissGuestReport}>不带入，重新填写</button>
        </div>
      </section>}
      <div className="landing-hero">
        <div className="landing-copy">
          <p className="landing-eyebrow"><span /> 第一次来，推荐从十题问卷开始</p>
          <h1>你的大学，<br />藏在日常的<span>选择里。</span></h1>
          <p className="landing-description">先完成十个校园日常选择，<br />再查看属于你的解读与图表。</p>
          <div className="landing-actions">
            <button type="button" className="landing-action landing-action-primary" onClick={onGoQuiz}>
              <span className="landing-action-title"><span>{canResume ? `继续填写问卷 · 第 ${draft.index + 1} 题` : <>填写校园问卷，<span className="landing-action-phrase">生成我的档案</span></>}</span><i aria-hidden="true">↗</i></span>
              <span className="landing-action-note">十题 · 约3–5分钟 · 可暂停</span>
            </button>
            <button type="button" className="landing-action landing-action-secondary landing-game-survey" onClick={onStartDay}>
              <span className="landing-action-title"><span>可选：<span className="landing-action-phrase">先玩校园一天</span></span><i aria-hidden="true">↗</i></span>
              <span className="landing-action-note">玩后核对十题，生成同一份档案</span>
            </button>
            {onOpenReport && <button type="button" className="landing-action landing-action-secondary landing-saved-report" onClick={onOpenReport}>
              <span className="landing-action-title">查看刚才的个人档案 <i aria-hidden="true">↗</i></span>
              <span className="landing-action-note">继续查看或修改本标签页中的回答</span>
            </button>}
          </div>
          <div className="landing-start-help">
            <p>无需注册，填完即可查看和修改自己的报告。</p>
            <GettingStartedGuide context="home" onStartPersonal={onGoQuiz} onOpenCircles={onGoCircles} />
          </div>
        </div>
        <ProfilePreview baseline={baseline} />
      </div>
      <HomeSectionNav />
      <HomeShowcase baseline={baseline} onGoQuiz={onGoQuiz} onStartDay={onStartDay} />
      <details className="landing-explore">
        <summary><span><b>课余校园小剧场</b><small>四段故事 · 独立进度 · 随时回来</small></span><span className="explore-plus" aria-hidden="true">＋</span></summary>
        <div className="landing-explore-content">
          <CampusStoryEntry compact scope={account?.user?.id || 'guest'} onOpen={onGoStory} />
        </div>
      </details>
      <section className="home-circle-section" id="home-circles" tabIndex={-1} aria-labelledby="home-circles-title">
        <div className="home-circle-heading">
          <div className="home-feature-copy">
            <p className="home-section-kicker"><span>03 / 班级与社团</span> 一个人的日常，也能汇成一个集体</p>
            <h2 id="home-circles-title">收齐一群人的回答，<br />从一条邀请开始。</h2>
          </div>
          <p>班会前了解大家的日常，社团活动前看看兴趣分布。管理员创建圈子、邀请成员，成员明确同意后才提交，管理员查看已交答卷与汇总。</p>
        </div>
        <details className="home-circle-guide"><summary>班级或社团怎样收卷？查看四步说明</summary><ol className="home-circle-steps">
          <li><span>01</span><b>管理员建圈</b><p>注册账号，创建班级或社团圈子。</p></li>
          <li><span>02</span><b>成员受邀填写</b><p>通过邀请码加入，完成自己的问卷。</p></li>
          <li><span>03</span><b>核对后再提交</b><p>成员确认分享范围，将答卷交给圈子。</p></li>
          <li><span>04</span><b>汇总与回看</b><p>管理员查看圈内已提交答卷与整体分布。</p></li>
        </ol></details>
        <div className="home-circle-bottom">
          <div className="home-circle-entry">
            {onGoCircles && <button type="button" className="home-solid-action" onClick={onGoCircles}>{previewOnly ? '了解圈子填报与部署' : '进入圈子，填写或收集答卷'} <span aria-hidden="true">↗</span></button>}
            <p>班级 / 社团工具（可选） · 成员仅查看自己的填报</p>
          </div>
          {onPreviewSample && <div className="home-circle-sample">
            <button type="button" className="home-text-action" onClick={onPreviewSample} disabled={sampleBusy}>{sampleBusy ? <><span className="ui-spinner" /> 正在打开示例…</> : <>先看 48 人模拟班级 <span aria-hidden="true">↗</span></>}</button>
            <p>合成示例，不创建真实圈子</p>
            {sampleError && <p className="landing-sample-error" role="alert">{sampleError}</p>}
          </div>}
        </div>
        <details className="home-import-option"><summary>已经有问卷文件？</summary><p>支持按模板整理后的 CSV 文件，可检查数据并分析班级分布。</p><button type="button" className="home-text-action" onClick={onGoUpload}>导入已有 CSV <span aria-hidden="true">↗</span></button></details>
      </section>
      <div className="landing-tools"><span>你的回答，由你决定何时分享。</span>{onReplayIntro && <button type="button" onClick={onReplayIntro}>重播入场动画 ↗</button>}</div>
    </main>
    <ProductFooter />
  </div>;
}
