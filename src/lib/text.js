/**
 * 通用文本清洗 —— CSV 解析与问卷校验共用。
 *
 * 为什么单独抽一个文件：
 *   这两个模块都要处理「从 Excel 导出的脏文本」，规则完全一样。
 *   各写一份的后果是：哪天补上「去全角空格」，只改了一处，
 *   另一处就安静地留下一堆带 \u3000 的选项文本，表现为「明明选了却说不认识这个选项」。
 *
 *   与 schema 同理：口径只写一处。
 */

/**
 * 表头清洗：去 BOM、去全角空格、折叠连续空白、去首尾。
 *
 * BOM 必须处理：Excel 导出的 CSV 几乎一定带 BOM，不处理会让「日期」变成「\uFEFF日期」，
 * 于是所有必需列全被判成缺失 —— 这是这类工具最常见的第一次翻车。
 */
export function normalizeHeader(name) {
  return String(name ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u3000\s]+/g, ' ')
    .trim();
}

/**
 * 单元格清洗：去首尾空白与全角空格。
 *
 * 全角空格（\u3000）要从中间也换掉：中文输入法下打出的空格宽度不同但肉眼难辨，
 * 用户看到的选项名和程序看到的不是同一个字符串。
 */
export function normalizeCell(value) {
  return String(value ?? '')
    .replace(/\u3000/g, ' ')
    .trim();
}
