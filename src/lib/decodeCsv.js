/** Decode locally without turning malformed bytes into silent replacement characters. */
export function decodeCsvBytes(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const starts = (...values) => values.every((value, index) => bytes[index] === value);
  if (starts(0x50, 0x4b, 0x03, 0x04) || starts(0xd0, 0xcf, 0x11, 0xe0)) {
    throw new Error('这是 Excel 工作簿，不是 CSV。请在 Excel 中选择「另存为 → CSV UTF-8（逗号分隔）」后再导入。');
  }
  if (starts(0x25, 0x50, 0x44, 0x46)) {
    throw new Error('你选择的是 PDF。这里需要问卷 CSV 文件，可以先下载模拟班级 CSV 查看格式。');
  }
  let encoding = starts(0xff, 0xfe) ? 'UTF-16LE' : starts(0xfe, 0xff) ? 'UTF-16BE' : 'UTF-8';
  let text;
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    if (encoding !== 'UTF-8') throw new Error('文件编码不完整，请重新另存为 CSV UTF-8 后再导入。');
    try {
      text = new TextDecoder('gb18030', { fatal: true }).decode(bytes);
      encoding = 'GB18030 / GBK';
    } catch {
      throw new Error('无法识别文件的中文编码，请另存为 CSV UTF-8（逗号分隔）后再导入。');
    }
  }
  if (text.includes('\0') || text.includes('\uFFFD')) {
    throw new Error('文件中含有无法识别的字符，请确认它是 CSV，并重新另存为 CSV UTF-8 后再导入。');
  }
  return { text, encoding };
}
