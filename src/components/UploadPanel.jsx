/**
 * 真入口的上传面板（任务 T-21）。
 *
 * 这个组件最重要的性质：**它一行解析逻辑都没有。**
 * 解析走 parseCsv.js，校验清洗走 surveyClean.js —— 与 2000 人基准数据完全同一条路径。
 * 这一点是它可信的全部理由：如果上传的文件走另一套宽松的解析，
 * 「同一个班的画像」与「基准人群的分布」就会建立在两套口径上，而差值没有任何意义。
 *
 * 三个体验上的决定：
 *
 *   1. **示例数据走完全相同的那条路**（fetch 同一个 CSV → 同样的解析函数）。
 *      不做「示例走捷径」：捷径意味着示例永远能过、真文件永远在踩坑，
 *      而评委用来试的第一份数据恰恰是示例。
 *
 *   2. **剔除的每一行都要说清在哪、为什么。** 只报「有 3 条数据格式错误」，
 *      用户做不了任何事；报出「第 12 行「宵夜频率」的值「每天都吃」不在该题的选项里」，
 *      他改完就能重传。
 *
 *   3. **一次文件选择只读一遍。** 文件文本读进来后解析结果留在内存，
 *      点「看画像」时不再重新解析 —— 否则用户会看到两次加载，还会怀疑两次结果是否一致。
 */

import { useRef, useState } from 'react';
import { parseCsvText } from '../lib/parseCsv.js';
import { cleanSurveyRows } from '../lib/surveyClean.js';
import { REQUIRED_COLUMNS } from '../lib/surveySchema.js';
import { checkFileSize, assessQuality, THRESHOLDS } from '../lib/thresholds.js';
import { BRAND } from '../lib/theme.js';
import TermPanel from './TermPanel.jsx';
import { MonoTag, SectionHead } from './TermHead.jsx';
import NavButton from './NavButton.jsx';
import { mergeCsvTexts } from '../lib/exportProfile.js';
import { decodeCsvBytes } from '../lib/decodeCsv.js';

const SAMPLE_FILE = '示例-班级问卷.csv';

export default function UploadPanel({ onReady, onBack }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // {fileName, records, report, details}

  /** 唯一的入口：一段 CSV 文本 → 解析 → 清洗 → 结果或错误。文件与示例都走这里。 */
  function ingest(text, fileName, encodings = []) {
    setError(null);
    setResult(null);

    const parsed = parseCsvText(text, REQUIRED_COLUMNS);
    if (!parsed.ok) {
      setError({ title: '这个文件读不了', message: parsed.errors[0]?.message ?? '未知原因' });
      return;
    }

    const cleaned = cleanSurveyRows(parsed.rows);
    if (!cleaned.ok) {
      setError({
        title: '这个文件里没有一条能用的数据',
        message: cleaned.report.summary,
      });
      return;
    }

    setResult({
      fileName,
      records: cleaned.records,
      report: cleaned.report,
      // 格式告警（PapaParse 报的引号不闭合之类）不阻断，但要显示出来
      warnings: parsed.errors,
      details: cleaned.details,
      encodings,
    });
  }

  /**
   * 读文件。★ 10-17：从「一个文件」扩成「一批文件」。
   *
   * 为什么需要一批：子端导出的档案是**每人一份**（一个人 1 行）。
   * 管理员收齐一个班就是 40 个文件 —— 一次只能传一个的话，这个功能等于不可用。
   *
   * ★ 合并用 `mergeCsvTexts` 而不是直接拼接：每份档案都自带表头，
   *   简单相加会把表头夹进数据中间，parseCsv 会把它们当无效行剔除，
   *   于是"导入 40 份"变成"导入 1 份 + 39 行被丢弃"，**而且不报错**。
   */
  async function readFiles(input) {
    const list = [...(input || [])].filter(Boolean);
    if (!list.length) return;

    // 上限：一个班的规模。防的是"拖进整个文件夹"导致逐份读取卡死。
    if (list.length > 300) {
      setError({ title: '一次最多 300 份', message: `你选了 ${list.length} 个文件。分批导入，结果会累加吗？—— 不会，每次导入是覆盖。请分批后合成一份。` });
      return;
    }

    // ★ 10-14 审查新增（任务书 P4#2）：**读取前**先看大小。
    //   `file.text()` 会把整个文件读进内存，一个误选的视频能直接把页面卡死 ——
    //   所以要在读之前挡，而不是读完再判断。
    for (const f of list) {
      const sizeCheck = checkFileSize(f);
      if (!sizeCheck.ok) {
        setError({ title: '这个文件太大了', message: `${f.name}：${sizeCheck.message}` });
        return;
      }
    }

    if (list.reduce((total, file) => total + file.size, 0) > THRESHOLDS.maxBatchBytes) {
      setError({ title: '这批文件合计太大了', message: `一次导入的文件合计不超过 ${THRESHOLDS.maxBatchLabel}，请先整理为一份问卷 CSV。` });
      return;
    }

    setError(null);
    setBusy(true);
    try {
      // Decode each file separately: a batch can contain mixed Excel encodings.
      const decoded = [];
      for (const file of list) {
        try {
          decoded.push(decodeCsvBytes(await file.arrayBuffer()));
        } catch (err) {
          throw new Error(`${file.name}：${err.message}`);
        }
      }
      const encodings = [...new Set(decoded.map((d) => d.encoding))];
      if (list.length === 1) {
        ingest(decoded[0].text, list[0].name, encodings);
      } else {
        const label =
          list.every((f) => /档案/.test(f.name))
            ? `${list.length} 份同学档案`
            : `${list.length} 个文件合并`;
        ingest(mergeCsvTexts(decoded.map((d) => d.text)), label, encodings);
      }
    } catch (err) {
      setError({ title: '文件未能导入', message: err?.message || '文件可能正在被其他程序占用，或没有读取权限。换一个文件试试。' });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function useSample() {
    setBusy(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/${SAMPLE_FILE}`);
      if (!res.ok) throw new Error(String(res.status));
      ingest(await res.text(), `${SAMPLE_FILE}（模拟数据）`);
    } catch {
      setError({
        title: '示例数据加载失败',
        message: `没能读到 public/data/${SAMPLE_FILE}。若是本地运行，确认这个文件在仓库里没被删。`,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="upload-page data-surface max-w-3xl mx-auto">
      {/* 状态行 —— 与问卷页、报告页同一句式（大写动作 + // + 状态），
          三页连起来看才是一条线，而不是三个互不相干的页面 */}
      <div className="flex items-baseline justify-between gap-3 mb-6">
        <div className="flex items-baseline gap-3">
          {/* 回地图。上传页现在是从地图的入口坞进来的（不是从首页），
              所以"回去"的语义是"回地图"，而不是"回上一页"。
              没有它，用户会卡在这一页 —— 之前只有浏览器后退键可用。 */}
          <NavButton onClick={onBack} icon="←" title="回到站点主页">
              回到首页
            </NavButton>
          <MonoTag>COLLECTING // UPLOAD</MonoTag>
        </div>
        <MonoTag>CSV · 逐行校验</MonoTag>
      </div>

      <SectionHead
        index={1}
        level={1}
        title="看一个班的分布"
        hint="上传一份问卷结果 CSV（每人一行、每道题的作答），就能看到这个群体的画像：五维位置、类型分布、以及班里和你最像的人。"
      />

      <div className="upload-guide">
        <details><summary>CSV 格式要求 · {REQUIRED_COLUMNS.length} 列作答，列序不限</summary><p>列名需要是：<span style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>{REQUIRED_COLUMNS.join(' / ')}</span>（顺序可以不同，多出的列会被忽略）。支持 UTF-8、GBK / GB18030 和带 BOM 的 UTF-16 编码；Excel 工作簿请先另存为 CSV。</p><a href={`${import.meta.env.BASE_URL}data/${SAMPLE_FILE}`} download>下载模拟班级 CSV，查看格式 ↓</a></details>
        <details><summary>怎样收集一个班的答题数据？</summary><ol><li>同学分别完成网站上的十道题。</li><li>在个人报告底部，点击「导出答题数据 CSV」。</li><li>收齐文件后，在这里多选或一起拖入；网站会按列名合并。</li></ol></details>
      </div>

      {!result && (
        <>
          {/* ★ 10-14 美化：原来这块是「一圈灰虚线 + 两行灰字 + 一个紫按钮」，
              拖拽区本身没有任何"这是个投放目标"的暗示 ——
              看起来像一个空的错误提示框。改了三处：
                ① 四角加青色直角括号 —— 这是"取景框/投放区"的通用语言，
                   不用写一行说明，人就知道东西该放这里
                ② 加一枚上传图标（向上箭头 + 托盘）。纯文字的"拖到这里"
                   在扫读时会被当成正文，有个图形才认得出是操作区
                ③ 拖拽悬停时：边框变品牌色 + 底色淡青 + 图标放大，
                   原来的反馈只是边框变色，太轻 */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              readFiles(e.dataTransfer?.files);
            }}
            className="relative overflow-hidden px-6 py-14 text-center transition-all duration-200"
            style={{
              // ★ 10-14 v4：白底虚线框 → **深色光场**（upload-bg.webp 作底）。
              //   以前这是整页最"素"的一块：一圈浅灰虚线 + 两行灰字 + 一个紫按钮，
              //   看起来像一个空的错误提示框，而不是"把文件投放到这里"的入口。
              //   众生行记的做法是给操作区一个发光的暗场；这里照做，文字随之反白。
              clipPath:
                'polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px))',
            }}
          >
            <img
              src={`${import.meta.env.BASE_URL}art/ark/upload-bg.webp`}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover ark-art"
              decoding="async"
            />
            {/* ★ 10-15：从"压暗"改成"提亮"。
                背景换成动漫天空后，深色投放台又是一块黑砖。
                现在用一层白玻璃盖住底图左侧（文字区），右侧留出 upload-bg 的画面。 */}
            <span
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(100deg, rgba(255,255,255,0.93) 0%, rgba(255,255,255,0.86) 48%, rgba(255,255,255,0.28) 100%)',
              }}
            />

            {/* 四角括号 */}
            {[
              { left: 8, top: 8, bl: true, bt: true },
              { right: 8, top: 8, br: true, bt: true },
              { left: 8, bottom: 8, bl: true, bb: true },
              { right: 8, bottom: 8, br: true, bb: true },
            ].map((c, i) => (
              <span
                key={i}
                aria-hidden="true"
                className="absolute w-[14px] h-[14px]"
                style={{
                  left: c.left,
                  right: c.right,
                  top: c.top,
                  bottom: c.bottom,
                  borderLeft: c.bl ? '2px solid' : undefined,
                  borderRight: c.br ? '2px solid' : undefined,
                  borderTop: c.bt ? '2px solid' : undefined,
                  borderBottom: c.bb ? '2px solid' : undefined,
                  borderColor: dragging ? 'var(--ark)' : 'rgba(21,107,122,0.45)',
                }}
              />
            ))}

            <div className="relative">
              <div className="flex justify-center mb-4">
                <UploadGlyph active={dragging} />
              </div>

              <p
                className="text-[15px] font-semibold mb-1"
                style={{ color: busy ? 'var(--ink-mid)' : 'var(--ink-strong)' }}
              >
                {busy ? '正在读取…' : '把 CSV 或同学档案拖到这里'}
              </p>
              <p className="text-xs mb-6" style={{ color: 'var(--ink-mid)' }}>
                可以多选 —— 一次拖进整个班的档案
              </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="ci-lift px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              style={{
                background: 'var(--grad-ark)',
                boxShadow: 'var(--shadow-ark)',
              }}
            >
              选择文件
            </button>
            {/* ★ 10-14：补 aria-label（原来这个 input 没有任何可访问名，
                屏幕阅读器只会读出"按钮"） */}
            <input
              ref={inputRef}
              id="csv-file-input"
              type="file"
              accept=".csv,text/csv"
              multiple
              className="hidden"
              aria-label="上传班级问卷 CSV 文件"
              onChange={(e) => readFiles(e.target.files)}
            />
            <p className="text-xs mt-7" style={{ color: 'var(--ink-mid)' }}>
              没有现成的数据？
              {/* ★ 10-14：这颗按钮实测只有 108×16 —— 它嵌在一行文字里，
                  视觉上是"链接"，但功能上是"换一份数据"的主要出口，
                  手机上 16px 高点不中。给它 24px 的最小热区（不撑视觉，只撑可点范围）。 */}
              <button
                type="button"
                onClick={useSample}
                disabled={busy}
                className="ml-1 inline-flex items-center min-h-[24px] underline decoration-dotted transition-colors"
                style={{ color: 'var(--ark)' }}
              >
                用示例班级问卷试试
              </button>
            </p>
          </div>
          </div>

          <p className="text-xs leading-5 mt-4" style={{ color: 'var(--ink-dim)' }}>
            文件只在你的浏览器里被读取和计算，不会上传到任何服务器。
            单个文件不超过 {THRESHOLDS.maxFileLabel}，每批合计不超过 {THRESHOLDS.maxBatchLabel}。
          </p>
        </>
      )}

      {error && (
        <TermPanel className="mt-6" style={{ padding: '16px 20px', borderColor: '#fecaca' }}>
          <p className="text-sm font-medium text-red-900 mb-1">{error.title}</p>
          <p className="text-sm text-red-800/90 leading-6">{error.message}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs text-red-800/80 underline decoration-dotted mt-3"
          >
            换一个文件
          </button>
        </TermPanel>
      )}

      {result && (
        <ResultCard
          result={result}
          onConfirm={() => onReady(result)}
          onReset={() => setResult(null)}
        />
      )}
    </div>
  );
}

/**
 * 上传区的图标：一支向上的箭头 + 一个托盘。
 *
 * 为什么不用 emoji 或图片：**它要跟着状态变色**。
 * 拖拽悬停时整枚图标换成品牌色并微微放大 —— 图片做不到，
 * 而"颜色 + 位移"这两件事正是"这里可以放"最直接的说明。
 */
function UploadGlyph({ active }) {
  const c = active ? 'var(--accent)' : 'var(--line-strong)';
  return (
    <svg
      width="46"
      height="46"
      viewBox="0 0 48 48"
      aria-hidden="true"
      style={{
        transform: active ? 'translateY(-3px) scale(1.08)' : 'none',
        transition: 'transform 180ms cubic-bezier(0.34, 1.4, 0.64, 1)',
      }}
    >
      <path d="M24 33V13" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <path
        d="M16 21l8-8 8 8"
        fill="none"
        stroke={c}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 30v6a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4v-6"
        fill="none"
        stroke={c}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ResultCard({ result, onConfirm, onReset }) {
  const { fileName, report, warnings, details, records, encodings = [] } = result;
  const dropped = report.droppedCount;
  // ★ 10-14 审查新增（任务书 P4#3/#4）：数据质量评估。
  //   太少的样本 / 太高的剔除比例，不该悄悄出一张看起来很权威的图。
  const quality = assessQuality(report);
  const [confirmed, setConfirmed] = useState(false);

  const LEVEL_STYLE = {
    warn: { border: '#fcd34d', title: '#92400e', body: '#a16207' },
    block: { border: '#fca5a5', title: '#991b1b', body: '#b91c1c' },
  };
  const st = LEVEL_STYLE[quality.level];

  return (
    <TermPanel style={{ padding: '20px 22px' }} tick="accent" shadow="md">
      <MonoTag>{fileName}</MonoTag>
      {encodings.length > 0 && <p className="text-xs mt-2" style={{ color: 'var(--ink-soft)' }}>中文编码已识别：{encodings.join('、')}</p>}

      {/* ★ 10-14 美化：原来"读入 48 条，可用 46 条"是一行 16px 的普通文字 ——
          这份卡片的**结论**和下面的说明文字是同一个字号、同一个颜色，
          扫一眼分不出哪句是重点。这里把两个数提成 26px 的等宽大数字，
          "多少条"变成一眼能读到的东西，说明文字退到次级灰。 */}
      <div className="flex items-end gap-5 mt-3 mb-1">
        <div>
          <p className="term-mono text-[11px] tracking-[0.16em]" style={{ color: 'var(--ink-dim)' }}>
            读入
          </p>
          <p className="ci-stat ci-num" style={{ color: 'var(--ink-strong)' }}>
            {report.inputCount}
            <span className="text-[12px] font-normal ml-1" style={{ color: 'var(--ink-dim)' }}>条</span>
          </p>
        </div>
        <div>
          <p className="term-mono text-[11px] tracking-[0.16em]" style={{ color: 'var(--ink-dim)' }}>
            可用
          </p>
          <p className="ci-stat ci-num" style={{ color: 'var(--accent-deep)' }}>
            {records.length}
            <span className="text-[12px] font-normal ml-1" style={{ color: 'var(--ink-dim)' }}>条</span>
          </p>
        </div>
        {dropped > 0 && (
          <div>
            <p className="term-mono text-[11px] tracking-[0.16em]" style={{ color: 'var(--ink-dim)' }}>
              剔除
            </p>
            <p className="ci-stat ci-num" style={{ color: 'var(--accent-warm)' }}>
              {dropped}
              <span className="text-[12px] font-normal ml-1" style={{ color: 'var(--ink-dim)' }}>条</span>
            </p>
          </div>
        )}
      </div>
      <p className="text-sm leading-6" style={{ color: 'var(--ink-mid)' }}>{report.summary}</p>

      {/* 数据质量明细（任务书 P4#3 要求的完整报告项） */}
      <dl
        className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs"
        style={{ color: 'var(--ink-soft)' }}
      >
        <div className="flex justify-between">
          <dt>原始记录</dt><dd className="tabular-nums">{report.inputCount}</dd>
        </div>
        <div className="flex justify-between">
          <dt>有效记录</dt><dd className="tabular-nums">{records.length}</dd>
        </div>
        <div className="flex justify-between">
          <dt>剔除记录</dt>
          <dd className="tabular-nums">{dropped}（{Math.round((report.dropRatio ?? 0) * 100)}%）</dd>
        </div>
        <div className="flex justify-between">
          <dt>空值单元格</dt><dd className="tabular-nums">{report.missingCells ?? 0}</dd>
        </div>
        <div className="flex justify-between">
          <dt>选项不匹配</dt><dd className="tabular-nums">{report.invalidCells ?? 0}</dd>
        </div>
        <div className="flex justify-between">
          <dt>与他人完全相同</dt><dd className="tabular-nums">{report.duplicateCount ?? 0}</dd>
        </div>
      </dl>
      {report.baseline?.sampleSize && (
        <p className="text-[11px] mt-2 leading-5" style={{ color: 'var(--ink-soft)' }}>
          对比基准：<span className="tabular-nums">{report.baseline.sampleSize}</span> 人
          · 矩阵 v{report.baseline.version} · {report.baseline.source}
        </p>
      )}

      {/* 质量警告（太少 / 剔除太多）——block 级必须显式确认才能继续 */}
      {quality.message && st && (
        <div
          className="mt-3 px-3 py-2 border text-xs leading-5"
          style={{ borderColor: st.border, color: st.body, background: 'transparent' }}
        >
          <strong style={{ color: st.title }}>
            {quality.level === 'block' ? '样本太少：' : '数据质量提醒：'}
          </strong>
          {quality.message}
        </div>
      )}

      {dropped > 0 && details.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs text-[var(--ink-soft)] cursor-pointer">
            看被剔除的行（前 {details.length} 条）
          </summary>
          <ul className="mt-2 space-y-1.5">
            {details.map((d) => (
              <li key={d.line} className="text-xs text-[var(--ink-soft)] leading-5">
                第 {d.line} 行：{d.problems.map((p) => p.message).join('；')}
              </li>
            ))}
          </ul>
        </details>
      )}

      {warnings.length > 0 && (
        <p className="text-xs text-amber-700 mt-3 leading-5">
          另有 {warnings.length} 处格式提醒（不影响出图）：{warnings[0].message}
        </p>
      )}

      <div className="flex items-center gap-3 mt-5 pt-4 border-t border-[var(--line)]">
        {/* needConfirm 时按钮变两步：第一次点击只展开"我确认"提示，不直接出图 */}
        <button
          type="button"
          onClick={() => (quality.needConfirm && !confirmed ? setConfirmed(true) : onConfirm())}
          className="ci-lift px-5 py-2.5 text-sm font-medium text-white"
          style={{
            background:
              quality.needConfirm && !confirmed
                ? 'linear-gradient(100deg, #7f1d1d, #b91c1c)'
                : 'var(--grad-ark)',
            boxShadow:
              quality.needConfirm && !confirmed ? '0 8px 22px -8px rgba(185,28,28,.5)' : 'var(--shadow-ark)',
          }}
        >
          {quality.needConfirm && !confirmed ? '我知道，仍然出图' : '看这个班的画像'}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="text-sm transition-colors"
          style={{ color: 'var(--ink-mid)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-strong)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-mid)')}
        >
          换一个文件
        </button>
      </div>
    </TermPanel>
  );
}
