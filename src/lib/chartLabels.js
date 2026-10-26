const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));

/** A radar event contains the whole vector, not one percentage. */
export function radarTooltip(data, params) {
  const values = Array.isArray(params?.value) ? params.value : [];
  return [escapeHtml(params?.name), ...data.map((item, index) => `${escapeHtml(item.axis)}：第 ${Number.isFinite(values[index]) ? values[index] : item.value} 百分位`), '模拟基准中的相对位置 · 各项不相加'].join('<br/>');
}

/** Reuse the rounded, drift-corrected input; ECharts' percent can round it again. */
export const timeShareLabel = params => `${params.name}\n${params.value}%`;
export const timeShareTooltip = params => `${escapeHtml(params.name)}　${params.value}%（规则估算）`;
