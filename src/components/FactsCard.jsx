/**
 * 人群冷知识卡。
 *
 * 两句话分别来自**最极端的那个维度**和**与它方向相反的那个次极端维度** ——
 * 算法在 results.js 的 factsOf 里，这里只负责排版。
 *
 * 数据用结构化字段（label / pct / high / copy）自己拼句子，
 * **不去解析 results.js 给出的整句 text** —— 那种做法一旦上游改了句式就会静默失效。
 * text 字段是留给纯文本场景的（自检输出、导出报告、喂大模型）。
 *
 * 数字加粗是刻意的：整句话的说服力全在那个百分比上，
 * 它必须一眼可见。
 */

import { BRAND } from '../lib/theme.js';
import TermPanel from './TermPanel.jsx';
import { monoTag } from '../lib/surface.js';

export default function FactsCard({ facts }) {
  return (
    <ul className="space-y-3">
      {facts.lines.map((line, i) => (
        <li key={line.key}>
          {/* 与欢迎页的三条入口、报告页的其它块同一种容器 ——
              切角面板是内容区的基本单位，这里不再另创一种卡片 */}
          <TermPanel hoverable style={{ padding: '14px 16px' }} className="group">
            <div className="flex gap-3">
              <span
                className="shrink-0"
                style={{
                  ...monoTag({ fontSize: 11 }),
                  color: 'var(--ink-soft)',
                  lineHeight: '22px',
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <p className="text-sm leading-6 text-[var(--ink)]">
                <span className="text-[var(--ink-soft)]">在「{line.label}」上，你</span>
                <span className="text-[var(--ink-soft)]">{line.high ? '超过' : '低于'}</span>
                <span className="font-semibold tabular-nums" style={{ color: BRAND }}>
                  {line.high ? line.pct : 100 - line.pct}%
                </span>
                <span className="text-[var(--ink-soft)]">的大学生</span>
                <span className="text-[var(--ink-soft)]"> —— </span>
                {line.copy}
              </p>
            </div>
          </TermPanel>
        </li>
      ))}
    </ul>
  );
}
