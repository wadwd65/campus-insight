import { useState } from 'react';
import AccountButton from './AccountButton.jsx';
import { readSurveyDraft } from '../lib/surveyDraft.js';
import { QUESTIONS } from '../lib/surveySchema.js';
import { PLACES } from '../data/mapPlaces.js';
import ProfilePreview from './ProfilePreview.jsx';
import CampusTheatre from './CampusTheatre.jsx';
import ProductFooter from './ProductFooter.jsx';
import GettingStartedGuide from './GettingStartedGuide.jsx';
import { useAccount } from '../lib/accounts.jsx';

function Mark() {
  return <svg viewBox="0 0 40 40" role="img" aria-label="终端纹章"><path d="M20 2 36 11v18L20 38 4 29V11Z" fill="none" stroke="currentColor"/><path d="m20 10 9 10-9 10-9-10Z" fill="currentColor"/><path d="M20 2v8m16 19-9-5M4 29l9-5" stroke="currentColor"/></svg>;
}

export default function LandingContent({ baseline, onGoQuiz, onGoMap, onGoUpload, onGoCircles, onPreviewSample, sampleBusy = false, sampleError = '', accountLabel = '登录 / 我的圈子', onReplayIntro, intro = false }) {
  const [draft] = useState(() => readSurveyDraft());
  const account = useAccount();
  const previewOnly = account?.status === 'offline' && account.serviceError?.kind === 'unavailable';
  const canResume = Boolean(draft && (draft.index > 0 || Object.keys(draft.answers).length));
  return <div className="landing-shell">
    <header className="landing-header"><div className="landing-brand"><Mark /><span><b>你的大学平行宇宙</b><small>CAMPUS INSIGHT · 校园生活档案</small></span></div><div className="landing-header-tools"><span className="landing-status"><i /> 个人记录 · 圈子收卷</span>{onGoCircles && <AccountButton label={previewOnly ? '圈子服务说明' : accountLabel} onClick={onGoCircles} />}</div></header>
    <main className="landing-main">
      {previewOnly && <aside className="site-preview-notice" role="status"><strong>当前为公开体验版</strong><p>可体验个人测评、模拟班级与地图。这个地址暂未开通在线账号和真实收卷，请勿把它当作成员填报地址。</p></aside>}
      <section className="novice-home-welcome" aria-label="第一次使用指引"><div><span className="novice-welcome-symbol" aria-hidden="true">✦</span><p><strong>第一次来？先选一幕，看看你的校园日常。</strong><span>点右侧小剧场就能试玩。要填报或收卷，随时进入「我的圈子」。</span></p></div><GettingStartedGuide context="home" onStartPersonal={onGoQuiz} onOpenCircles={onGoCircles} /></section>
      <div className="landing-hero">
        <div className="landing-copy">
          <p className="landing-eyebrow"><span /> 你的大学，有自己的过法</p>
          <h1>同样的大学，<br />不一样的<span>过法。</span></h1>
          <p className="landing-description">校园生活，按你的方式发生。</p>
          <p className="landing-invitation">先玩三段日常，再用 {QUESTIONS.length} 个选择写下自己的故事。<span className="landing-organizer-note"><br />也能邀请同学进入圈子，一起记录、不必来回传文件。</span></p>
          <div className="landing-meta"><span><b>{QUESTIONS.length}</b> 道题</span><span>约 <b>2</b> 分钟</span><span>没有标准答案</span></div>
          <p className="landing-computation-note">画像数字由规则计算，每个选项都有来处。</p>
        </div>
        <CampusTheatre onStart={onGoQuiz} />
      </div>
      <div className="landing-actions">
        <button type="button" className="landing-action landing-action-primary" onClick={onGoQuiz}><span className="landing-action-number">自己体验 / PERSONAL ARCHIVE</span><span className="landing-action-title">{canResume ? '继续测评，接着写我的档案' : '开始测评，写我的校园故事'} <i aria-hidden="true">↗</i></span><span className="landing-action-note">{canResume ? `上次停在第 ${draft.index + 1} / ${QUESTIONS.length} 题 · 已选答案还在` : '无需注册 · 每题选一个答案，再点「下一题」'}{intro ? ' · 或按 Enter 开始' : ''}</span></button>
        {onGoCircles && <button type="button" className="landing-action landing-action-secondary" onClick={onGoCircles}><span className="landing-action-number">一起填报 / CAMPUS CIRCLES</span><span className="landing-action-title">{previewOnly ? '了解圈子填报与部署' : '进入圈子，填写或收集答卷'} <i aria-hidden="true">↗</i></span><span className="landing-action-note">{previewOnly ? <>当前地址暂未开通 · 点击查看说明<br />可先从上方体验模拟班级汇总</> : <>成员用邀请加入 · 确认后收卷<br />需要当前网站开通账号服务</>}</span></button>}
        {onGoMap && <button type="button" className="landing-action landing-action-secondary" onClick={onGoMap}><span className="landing-action-number">行动地图 / ACTION MAP</span><span className="landing-action-title">安排我的一天 <i aria-hidden="true">↗</i></span><span className="landing-action-note">{PLACES.length} 个地点 · 四个时段 · 每次选择写入画像</span></button>}
      </div>
      <section className="landing-classroom" aria-label="已有文件分析入口">
        <div className="landing-classroom-copy"><span className="landing-action-number">已有问卷 / IMPORT & READ</span><h2>已经收好了 CSV？直接看汇总。</h2><p>在浏览器内分析已有答卷，也可先用模拟班级试一遍。文件导入不会创建在线圈子。</p></div>
        <div className="landing-circle-actions"><button type="button" onClick={onGoUpload}>导入已有 CSV <span aria-hidden="true">→</span></button>{onPreviewSample && <div className="landing-sample-entry landing-classroom-sample"><button type="button" onClick={onPreviewSample} disabled={sampleBusy}>{sampleBusy ? <><span className="ui-spinner" /> 正在打开示例…</> : <>先看 48 人模拟班级 <span aria-hidden="true">→</span></>}</button><p>无需账号或文件 · 查看完整汇总 · 不创建真实圈子</p>{sampleError && <p className="landing-sample-error" role="alert">{sampleError}</p>}</div>}</div>
      </section>
      <section className="landing-method" aria-label="结果怎么看"><div><span>01 / ANSWERS FIRST</span><h3>先看大家怎么选</h3><p>直接统计每题选项人数，保留原始语境。</p></div><div><span>02 / CLEAR RULES</span><h3>每一个数字都有来处</h3><p>查看选项贡献，临时换答案做比较。</p></div><div><span>03 / KNOW THE LIMITS</span><h3>解释生活，不给人定性</h3><p>模拟基准明确标注，小样本仅展示答案统计。</p></div></section>
      <details className="landing-explore"><summary><span><b>换一种方式，发现校园</b><small>行动地图 · 3D 自由参观 · 个人档案示例</small></span><span className="explore-plus" aria-hidden="true">＋</span></summary><div className="landing-explore-content"><div className="landing-explore-links"><button type="button" className="landing-action landing-action-secondary" onClick={onGoMap}><span className="landing-action-number">ACTION MAP</span><span className="landing-action-title">行动地图，安排我的一天 <i aria-hidden="true">↗</i></span><span className="landing-action-note">{PLACES.length} 个地点 · 四个时段 · 选择会写入画像</span></button><a className="landing-action landing-action-visit desktop-3d-link" href={`${import.meta.env.BASE_URL}map/校园地图-3D实景.html`} target="_blank" rel="noopener noreferrer"><span className="landing-action-number">FREE EXPLORATION</span><span className="landing-action-title">3D 校园，自由参观 <i aria-hidden="true">↗</i></span><span className="landing-action-note">小车驾驶 · 实体人物 · 屋顶二段跳<br />独立参观，新标签页打开；不改变画像</span></a><p>3D 自由参观适合电脑；手机可体验行动地图。</p></div><ProfilePreview baseline={baseline} /></div></details>
      <div className="landing-tools"><span>十题记录日常 · 圈子直接收卷 · 每个结果可解释</span>{onReplayIntro && <button type="button" onClick={onReplayIntro}>重播入场动画 ↗</button>}</div>
    </main>
    <ProductFooter />
  </div>;
}
