# -*- coding: utf-8 -*-
"""统计所有会话的真实 token 消耗（从 jsonl 里的 usage 字段精确求和）。"""
import io, json, os, glob

BASE = r"C:\Users\123\.workbuddy\projects"
NAMES = [
    "c-Users-123-WorkBuddy-2026-09-08-22-00-41",
    "c-Users-123-WorkBuddy-2026-09-09-19-04-14",
    "c-Users-123-WorkBuddy-2026-09-10-12-21-59",
    "c-Users-123-WorkBuddy-2026-09-10-15-40-22",
    "c-Users-123-WorkBuddy-2026-09-17-13-57-43",
    "c-Users-123-WorkBuddy-2026-09-22-19-37-04",
    "c-Users-123-WorkBuddy-2026-09-22-19-41-24",
    "c-Users-123-WorkBuddy-2026-09-25-15-54-42",
    "c-Users-123-WorkBuddy-Claw",
]

g_in = g_out = g_cached = g_reason = g_req = 0
rows = []

for nm in NAMES:
    dd = os.path.join(BASE, nm)
    if not os.path.isdir(dd):
        continue
    si = so = sc = sr = rq = 0
    for f in glob.glob(os.path.join(dd, "*.jsonl")):
        with io.open(f, encoding="utf-8", errors="replace") as fp:
            for line in fp:
                if "inputTokens" not in line:
                    continue
                try:
                    d = json.loads(line)
                except Exception:
                    continue
                pd = d.get("providerData") or {}
                msg = d.get("message") or {}
                u = pd.get("usage") or msg.get("usage")
                if not isinstance(u, dict) or "inputTokens" not in u:
                    continue
                si += u.get("inputTokens", 0)
                so += u.get("outputTokens", 0)
                rq += u.get("requests", 1) or 1
                det = u.get("inputTokensDetails")
                if isinstance(det, list) and det and isinstance(det[0], dict):
                    sc += det[0].get("cached_tokens", 0)
                od = u.get("outputTokensDetails")
                if isinstance(od, dict):
                    sr += od.get("reasoning_tokens", 0)
    if si or so:
        rows.append((nm, si, so, sc, sr, rq))
        g_in += si; g_out += so; g_cached += sc; g_reason += sr; g_req += rq

W = 92
print("=" * W)
print("按会话目录统计（input 为累计值，注意每轮请求都会重发完整上下文）")
print("=" * W)
print("%-44s %12s %11s %6s" % ("会话目录", "input", "output", "轮次"))
print("-" * W)
for nm, si, so, sc, sr, rq in sorted(rows, key=lambda x: -x[1]):
    print("%-44s %12s %11s %6d" % (nm[:44], "{:,}".format(si), "{:,}".format(so), rq))

print()
print("=" * W)
print("总计（本项目 + Claw 旧目录，全部会话）")
print("=" * W)
tot = g_in + g_out
print("  请求轮次               %s" % "{:,}".format(g_req))
print("  累计 inputTokens       %s" % "{:,}".format(g_in))
print("      其中缓存命中        %s   (%.1f%%)" % ("{:,}".format(g_cached), 100.0 * g_cached / max(g_in, 1)))
print("  累计 outputTokens      %s" % "{:,}".format(g_out))
print("      其中思考 tokens     %s" % "{:,}".format(g_reason))
print("  " + "-" * 50)
print("  累计 totalTokens       %s" % "{:,}".format(tot))
print()
print("  ==> %.2f 万" % (tot / 10000.0))
print("  ==> %.4f 亿" % (tot / 1e8))
print()
print("  [A] 真实计费口径（按每轮重发算）= %.1f 万" % (tot / 10000.0))
print("      这是 API 实际处理的量，也是计费依据。")
print("  [B] 去重口径（唯一内容）= 见下：")
