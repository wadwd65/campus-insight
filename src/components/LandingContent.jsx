import { useState } from 'react';
import { readSurveyDraft } from '../lib/surveyDraft.js';
import { QUESTIONS } from '../lib/surveySchema.js';
import { PLACES } from '../data/mapPlaces.js';
import ProfilePreview from './ProfilePreview.jsx';
import CampusNote from './CampusNote.jsx';

function Mark() {
  return <svg viewBox="0 0 40 40" role="img" aria-label="终端纹章"><path d="M20 2 36 11v18L20 38 4 29V11Z" fill="none" stroke="currentColor"/><path d="m20 10 9 10-9 10-9-10Z" fill="currentColor"/><path d="M20 2v8m16 19-9-5M4 29l9-5" stroke="currentColor"/></svg>;
}

export default function LandingContent({ baseline, onGoQuiz, onGoMap, onGoUpload, onReplayIntro, intro = false }) {
  const [draft] = useState(() => readSurveyDraft());
  const canResume = Boolean(draft && (draft.index > 0 || Object.keys(draft.answers).length));
  return <div className="landing-shell">
    <header className="landing-header"><div className="landing-brand"><Mark /><span><b>你的大学平行宇宙</b><small>CAMPUS INSIGHT</small></span></div><div className="landing-header-tools">{onReplayIntro && <button type="button" className="landing-replay" onClick={onReplayIntro}>重播入场动画 ↗</button>}<span className="landing-status"><i /> 本地计算 · 无需注册</span></div></header>
    <main className="landing-main">
      <div className="landing-hero">
        <div className="landing-copy">
          <p className="landing-eyebrow"><span /> 个人青春行为图谱 / VOL. 01</p>
          <h1>你的大学生活，<br />是<span>什么画风</span>？</h1>
          <p className="landing-description">有人把图书馆坐成了第二个家，<br className="landing-wide-break" />有人记住校园，靠的是每一家深夜食堂。</p>
          <p className="landing-invitation">回答 {QUESTIONS.length} 道日常选择题，找到你的校园称号，<br className="landing-wide-break" />把那些习以为常的小事，读成一份自己的档案。</p>
          <div className="landing-meta"><span><b>{QUESTIONS.length}</b> 道题</span><span><b>1</b> 分钟左右</span><span>没有标准答案</span></div>
        </div>
        <ProfilePreview baseline={baseline} />
      </div>
      <div className="landing-actions">
        <button type="button" className="landing-action landing-action-primary" onClick={onGoQuiz}><span className="landing-action-number">01 / ASSESSMENT</span><span className="landing-action-title">{canResume ? '继续测评，接着写我的档案' : '开始测评，生成我的档案'} <i aria-hidden="true">↗</i></span><span className="landing-action-note">{canResume ? `上次停在第 ${draft.index + 1} / ${QUESTIONS.length} 题 · 保留已选答案` : '零准备 · 不需要上传文件'}{intro ? ' · 或按 Enter 开始' : ''}</span></button>
        <button type="button" className="landing-action landing-action-secondary" onClick={onGoMap}><span className="landing-action-number">02 / CAMPUS WALK</span><span className="landing-action-title">先去校园里走走 <i aria-hidden="true">↗</i></span><span className="landing-action-note">{PLACES.length} 个地点 · 用四个时段，走出另一份画像</span></button>
      </div>
      <section className="landing-classroom" aria-label="班级画像入口">
        <div className="landing-classroom-copy"><span className="landing-action-number">FOR YOUR CLASS</span><h2>也想看看，整个班的画风？</h2><p>支持多份 CSV 一起导入；没有文件，也能先试用模拟班级。</p></div>
        <button type="button" onClick={onGoUpload}>上传 CSV，看看整个班的画像 <span aria-hidden="true">→</span></button>
      </section>
      <div className="landing-tools"><span>从自己的日常，到校园里的更多可能。</span><a className="desktop-3d-link" href={`${import.meta.env.BASE_URL}map/校园地图-3D实景.html`}>艺术化 3D 校园 · 转动看看 ↗</a></div>
    </main>
    <footer className="landing-footer"><span>数据 → 图表 → 个性化解读</span><details><summary>关于数据与隐私</summary><p>问卷与 CSV 在本机计算；配置在线模型后，仅发送报告摘要生成解读，不发送原始文件。没有模型时使用本地规则解读。基准为 2000 条模拟记录，曲线与时间分配为规则推算，不是心理评估或未来预测。</p></details><CampusNote inline /><span>每一种日常，都值得被看见。</span></footer>
  </div>;
}
