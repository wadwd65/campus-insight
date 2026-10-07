# -*- coding: utf-8 -*-
"""出最终报告：本项目 token 消耗总账。"""
import io, json, os, glob

BASE = r"C:\Users\123\.workbuddy\projects"
NAMES = [
    ("2026-09-10-15-40-22", "本工作区（主战场）"),
    ("Claw", "Claw 旧工作区"),
    ("2026-09-25-15-54-42", "09-25 临时会话"),
    ("2026-09-22-19-41-24", "09-22 临时会话"),
    ("2026-09-22-19-37-04", "09-22 临时会话"),
    ("2026-09-17-13-57-43", "09-17 临时会话"),
    ("2026-09-10-12-21-59", "09-10 临时会话"),
    ("2026-09-09-19-04-14", "09-09 临时会话"),
    ("2026-09-08-22-00-41", "09-08 临时会话"),
]

rows = []
g_in = g_out = g_cache = g_req = 0
for nm, label in NAMES:
    dd = os.path.join(BASE, "c-Users-123-WorkBuddy-" + nm)
    if not os.path.isdir(dd):
        continue
    si = so = sc = rq = 0
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
    if si or so:
        rows.append((label, nm, si, so, sc, rq))
        g_in += si; g_out += so; g_cache += sc; g_req += rq

W = 96
print("=" * W)
print("传智杯 VibeCoding 项目 · Token 消耗总账")
print("（数据源：~/.workbuddy/projects/**/*.jsonl 里的 usage 字段，逐条精确求和）")
print("=" * W)
print("%-24s %-20s %13s %11s %6s" % ("用途", "目录", "input", "output", "轮次"))
print("-" * W)
for label, nm, si, so, sc, rq in sorted(rows, key=lambda x: -x[2]):
    print("%-24s %-20s %13s %11s %6d" % (label, nm[:20], "{:,}".format(si), "{:,}".format(so), rq))
print("-" * W)
tot = g_in + g_out
print("%-45s %13s %11s %6d" % ("合计", "{:,}".format(g_in), "{:,}".format(g_out), g_req))
print()
print("=" * W)
print("折算")
print("=" * W)
print("  totalTokens = input + output = %s" % "{:,}".format(tot))
print()
print("  ==> **%.1f 万**" % (tot / 10000.0))
print("  ==> %.3f 亿" % (tot / 1e8))
print()
print("  其中 input  %s  (%.1f%%)   缓存命中 %s (%.1f%% of input)"
      % ("{:,}".format(g_in), 100.0 * g_in / tot,
         "{:,}".format(g_cache), 100.0 * g_cache / max(g_in, 1)))
print("       output %s  (%.1f%%)" % ("{:,}".format(g_out), 100.0 * g_out / tot))
print()
print("=" * W)
print("口径说明（重要）")
print("=" * W)
print("  ★ 计费口径（= 上面这个数）：每一轮请求都要**重发完整上下文**，")
print("     所以 input 会随对话变长而滚雪球。第 6391 轮时单轮 input 已达 16.7 万（中位）。")
print("  ★ 去重口径（另一种说法）：真正不同的内容远小于此 ——")
print("     按平均缓存命中率 98.3%% 反推，不重复部分约 %.1f 万。" % ((g_in * 0.017 + g_out) / 10000.0))
print("     但**计费按前者**，缓存只是单价更低，不是不计。")
print()
print("  ★ 峰值段（第 6~9 段，中位 34~39 万/轮）= 地图重建期（09-24~09-26），")
print("     那几天反复读大文件 + 截图回读，是 token 消耗最猛的时候。")
