/**
 * 产品策略阈值 —— 集中一处（任务书 P4#8 / P4#2 / P4#4）。
 *
 * ⚠️ **这些不是统计学硬性标准，是本产品的策略选择。**
 *    例如"少于 8 人不说'分歧最大'"—— 8 这个数不是算出来的，是拍的：
 *    3 个人的"分歧"没有意义，50 个人的"分歧"很可信，中间那条线划在哪是产品决定。
 *    把它们集中在这里有两条好处：
 *      ① 改一处就全站生效，不会出现"上传页说 5 人算少、班级页说 8 人算少"；
 *      ② 评审时能一眼看到"这个产品在哪儿设了谨慎边界"，而不是散在组件里。
 *
 * 用过它们的地方：surveyClean.js（质量报告）、UploadPanel.jsx（警告）、
 * cohort.js（小样本谨慎提示）、CohortPage.jsx。
 */

export const THRESHOLDS = {
  // ── 上传文件（P4#2）────────────────────────────────────────────
  /**
   * 文件大小上限。5MB ≈ 十几万行问卷 —— 一个班的问卷不会超过几千行，
   * 留足余量。设它是为了在**读取前**就挡住超大文件：`file.text()` 会把整个
   * 文件读进内存，一个误选的视频文件足以让页面卡死。
   */
  maxFileBytes: 5 * 1024 * 1024,
  maxFileLabel: '5 MB',
  maxBatchBytes: 10 * 1024 * 1024,
  maxBatchLabel: '10 MB',

  // ── 数据质量（P4#4）────────────────────────────────────────────
  /** 剔除比例超过这个值：说明文件本身可能有问题，弹出确认而不是直接出图。 */
  maxDropRatioForConfirm: 0.3,
  /** 有效记录少于这个数：提示"样本偏少，结论仅供参考"。 */
  minRecordsForWarning: 12,
  /** 少于这个数：**不给任何群体结论**（分歧、类型分布都不说），只展示原始分布。 */
  minRecordsForCohort: 5,

  // ── 群体统计（P4#8，与 cohort.js 原有行为对齐）──────────────────
  /** 少于这个数不说"分歧最大"（原 cohort.js 里硬编码的 8）。 */
  minRecordsForDivergence: 8,
  /** IQR 达到这个值才算"分歧明显"（原 cohort.js / cohortSummary.js 硬编码的 24）。 */
  divergentIqr: 24,
  /** 一类占比达到这个值才算"倾向集中"（原 cohortSummary.js 硬编码的 40）。 */
  concentratedPct: 40,
};

/**
 * 上传文件大小检查（读取前调用）。
 *
 * @param {{size:number, name?:string}} file
 * @returns {{ok:boolean, message?:string}}
 */
export function checkFileSize(file) {
  if (!file || typeof file.size !== 'number') return { ok: true };
  if (file.size > THRESHOLDS.maxFileBytes) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return {
      ok: false,
      message: `这个文件有 ${mb} MB，超过了 ${THRESHOLDS.maxFileLabel} 的上限。`
        + '问卷 CSV 通常只有几百 KB —— 确认一下是不是选错了文件。',
    };
  }
  return { ok: true };
}

/**
 * 数据质量 → 是否需要用户在出图前确认（P4#4）。
 *
 * @param {{inputCount:number, keptCount:number, droppedCount:number}} report
 * @returns {{needConfirm:boolean, level:'ok'|'warn'|'block', message:string}}
 */
export function assessQuality(report) {
  const { inputCount = 0, keptCount = 0, droppedCount = 0 } = report ?? {};
  const dropRatio = inputCount ? droppedCount / inputCount : 0;

  if (keptCount < THRESHOLDS.minRecordsForCohort) {
    return {
      needConfirm: true,
      level: 'block',
      message: `只有 ${keptCount} 条可用数据 —— 人数太少，这个规模看不出稳定的群体特征，`
        + '出图的意义不大。建议补齐数据后重传；如果只是想看看流程，也可以继续。',
    };
  }
  if (dropRatio > THRESHOLDS.maxDropRatioForConfirm) {
    return {
      needConfirm: true,
      level: 'warn',
      message: `有 ${droppedCount} 条（${Math.round(dropRatio * 100)}%）被剔除，比例偏高。`
        + '常见原因是这份 CSV 的选项文字与当前问卷版本不一致（比如改过题目表述）。'
        + '建议先看下面的剔除明细核对；确认无误也可以继续。',
    };
  }
  if (keptCount < THRESHOLDS.minRecordsForWarning) {
    return {
      needConfirm: false,
      level: 'warn',
      message: `可用数据 ${keptCount} 条，样本偏少 —— 结论仅供参考，不宜当作稳定规律。`,
    };
  }
  return { needConfirm: false, level: 'ok', message: '' };
}
