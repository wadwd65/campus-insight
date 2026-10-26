import CampusDayEntry from './CampusDayEntry.jsx';
import { useState } from 'react';
import AccountButton from './AccountButton.jsx';
import { readSurveyDraft } from '../lib/surveyDraft.js';
import { QUESTIONS } from '../lib/surveySchema.js';
import { PLACES } from '../data/mapPlaces.js';
import ProfilePreview from './ProfilePreview.jsx';
import CampusStoryEntry from './CampusStoryEntry.jsx';
import ProductFooter from './ProductFooter.jsx';
import GettingStartedGuide from './GettingStartedGuide.jsx';
import { useAccount } from '../lib/accounts.jsx';

function Mark() {
  return <svg viewBox="0 0 40 40" role="img" aria-label="终端纹章"><path d="M20 2 36 11v18L20 38 4 29V11Z" fill="none" stroke="currentColor"/><path d="m20 10 9 10-9 10-9-10Z" fill="currentColor"/><path d="M20 2v8m16 19-9-5M4 29l9-5" stroke="currentColor"/></svg>;
}

export default function LandingContent({ baseline, onGoQuiz, onOpenReport, onStartDay=onGoQuiz, onGoStory, onGoMap, onGoUpload, onGoCircles, onPreviewSample, sampleBusy = false, sampleError = '', accountLabel = '登录 / 我的圈子', onReplayIntro, intro = false }) {
  const [draft] = useState(() => readSurveyDraft());
  const account = useAccount();
  const previewOnly = account?.status === 'offline' && account.serviceError?.kind === 'unavailable';
  const canResume = Boolean(draft && (draft.index > 0 || Object.keys(draft.answers).length));
  return <div className="landing-shell">
    <header className="landing-header"><div className="landing-brand"><Mark /><span><b>校园行迹</b><small>从真实回答，认识你的校园日常</small></span></div><div className="landing-header-tools"><span className="landing-status"><i /> 问卷调查 · 个人解读 · 圈子汇总</span>{onGoCircles && <AccountButton label={previewOnly ? '圈子服务说明' : accountLabel} onClick={onGoCircles} />}</div></header>
    <main className="landing-main">
      {previewOnly && <aside className="site-preview-notice" role="status"><strong>当前为公开体验版</strong><p>可体验个人测评、模拟班级与地图。这个地址暂未开通在线账号和真实收卷，请勿把它当作成员填报地址。</p></aside>}
      <section className="novice-home-welcome" aria-label="第一次使用指引"><div><span className="novice-welcome-symbol" aria-hidden="true">✦</span><p><strong>第一次来？先回答自己的校园日常。</strong><span>十道问卷，完成后直接生成个人解读和图表。不用先注册，也不用先玩地图。</span></p></div><GettingStartedGuide context="home" onStartPersonal={onGoQuiz} onOpenCircles={onGoCircles} /></section>
      <div className="landing-hero">
        <div className="landing-copy">
          <p className="landing-eyebrow"><span /> FIELD NOTES / 记录你经过的大学</p>
          <h1>你的大学，<br />藏在日常的<span>选择里。</span></h1>
          <p className="landing-description">下课后去哪儿、熬夜为了什么、最想留下哪段记忆？从十个真实回答，读懂你自己的校园生活。</p>
          <p className="landing-invitation">问卷是起点。可以直接填写，也可以先在地图里作选择，带出对应的问卷建议；核对后，统一生成个人解读、雷达图和计算依据。<span className="landing-organizer-note"><br />需要班级或社团收卷时，再加入圈子，确认后提交同一份答卷。</span></p>
          <div className="landing-meta"><span><b>10</b> 道问卷</span><span>约 <b>3–5</b> 分钟</span><span>填完直接查看个人结果</span></div>
          <p className="landing-computation-note">图表和规则解读在本机生成，无需接入 AI 服务。</p>
        </div>
        <ProfilePreview baseline={baseline} />
      </div>
      <div className="landing-actions">
        <button type="button" className="landing-action landing-action-primary" onClick={onGoQuiz}><span className="landing-action-number">从这里开始 / QUESTIONNAIRE FIRST</span><span className="landing-action-title">{canResume ? `继续填写问卷 · 第 ${draft.index + 1} 题` : '填写校园问卷，生成我的档案'} <i aria-hidden="true">↗</i></span><span className="landing-action-note">无需注册 · 十题真实回答 · 直接生成解读与图表 · 可暂停</span></button>
        <button type="button" className="landing-action landing-action-secondary landing-game-survey" onClick={onStartDay}><span className="landing-action-number">用情境来回答 / PLAY & REVIEW</span><span className="landing-action-title">先在地图里选择，再带入问卷 <i aria-hidden="true">↗</i></span><span className="landing-action-note">行动影响问卷建议 · 可核对改答 · 最后生成同一份个人档案</span></button>
        {onOpenReport && <button type="button" className="landing-action landing-action-secondary landing-saved-report" onClick={onOpenReport}><span className="landing-action-number">已经填好了 / MY REPORT</span><span className="landing-action-title">查看刚才的个人档案 <i aria-hidden="true">↗</i></span><span className="landing-action-note">返回首页或刷新后，在本标签页继续查看 · 不自动交卷</span></button>}
      </div>
      <section className="landing-classroom" aria-label="已有文件分析入口">
        <div className="landing-classroom-copy"><span className="landing-action-number">一起填写 / COLLECT & READ</span><h2>班级 / 社团工具（可选）</h2><p>管理员创建圈子、邀请成员。成员填写同一套校园问卷，明确同意后才提交；管理员查看已交答卷与汇总。小游戏的选择可以带出问卷建议，成员核对、补充并明确同意后，才成为提交的答卷。</p></div>
        <div className="landing-circle-actions">{onGoCircles&&<div className="landing-organizer-entry"><button type="button" onClick={onGoCircles}>{previewOnly?'了解圈子填报与部署':'进入圈子，填写或收集答卷'} <span aria-hidden="true">→</span></button><p>{previewOnly?'当前地址暂未开通账号服务；可先体验下方模拟汇总。':'管理员直接收卷、查看原始答案和汇总；成员明确同意后才提交。'}</p></div>}<button type="button" onClick={onGoUpload}>导入已有 CSV <span aria-hidden="true">→</span></button>{onPreviewSample && <div className="landing-sample-entry landing-classroom-sample"><button type="button" onClick={onPreviewSample} disabled={sampleBusy}>{sampleBusy ? <><span className="ui-spinner" /> 正在打开示例…</> : <>先看 48 人模拟班级 <span aria-hidden="true">→</span></>}</button><p>无需账号或文件 · 查看完整汇总 · 不创建真实圈子</p>{sampleError && <p className="landing-sample-error" role="alert">{sampleError}</p>}</div>}</div>
      </section>
      <section className="landing-method" aria-label="结果怎么看"><div><span>01 / ANSWERS FIRST</span><h3>回答十个真实日常</h3><p>五个章节，从课堂到课余。没有标准答案，选最接近自己的情况。</p></div><div><span>02 / CLEAR RULES</span><h3>立即看结果，追到依据</h3><p>个人解读和图表来自同一份回答。可以改答并重算整份报告。</p></div><div><span>03 / KEEP EXPLORING</span><h3>把档案带进校园</h3><p>地图行动能带入问卷，核对后形成同一份档案；有收卷需要，再确认提交给圈子。</p></div></section>
      <details className="landing-explore"><summary><span><b>也可以从情境出发，再回来完成问卷</b><small>可选地图一天 · 自由行动地图 · 3D 参观 · 校园小剧场</small></span><span className="explore-plus" aria-hidden="true">＋</span></summary><div className="landing-explore-content"><CampusDayEntry key={account?.user?.id||'guest'} scope={account?.user?.id||'guest'} onStart={onStartDay} /><div className="landing-explore-links"><button type="button" className="landing-action landing-action-secondary" onClick={onGoMap}><span className="landing-action-number">ACTION MAP</span><span className="landing-action-title">行动地图，安排我的一天 <i aria-hidden="true">↗</i></span><span className="landing-action-note">{PLACES.length} 个地点 · 四个时段 · 选择会写入行动记录</span></button><a className="landing-action landing-action-visit desktop-3d-link" href={`${import.meta.env.BASE_URL}map/校园地图-3D实景.html`} target="_blank" rel="noopener noreferrer"><span className="landing-action-number">FREE EXPLORATION</span><span className="landing-action-title">3D 校园，自由参观 <i aria-hidden="true">↗</i></span><span className="landing-action-note">小车驾驶 · 实体人物 · 屋顶二段跳<br />独立参观，新标签页打开；不改变答卷</span></a><p>3D 自由参观适合电脑；手机可体验行动地图。地图一天可带入问卷核对；3D 参观独立保留。</p></div><CampusStoryEntry compact scope={account?.user?.id||'guest'} onOpen={onGoStory}/></div></details>
      <div className="landing-tools"><span>情境选择 → 问卷核对 → 个人解读 → 圈子汇总</span>{onReplayIntro && <button type="button" onClick={onReplayIntro}>重播入场动画 ↗</button>}</div>
    </main>
    <ProductFooter />
  </div>;
}
