# -*- coding: utf-8 -*-
"""看 inputTokens 的分布：中位数、分位、以及"为什么这么高"。"""
import io, json, os, statistics

DD = r"C:\Users\123\.workbuddy\projects\c-Users-123-WorkBuddy-2026-09-10-15-40-22"
f = os.path.join(DD, "778b93fb-604c-48ad-8c92-69ed9aee29f5.jsonl")

ins, outs, caches, roots = [], [], [], []
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
        ins.append(u["inputTokens"])
        outs.append(u.get("outputTokens", 0))
        det = u.get("inputTokensDetails")
        if isinstance(det, list) and det and isinstance(det[0], dict):
            caches.append(det[0].get("cached_tokens", 0))
        r = u.get("requests")
        roots.append(r if isinstance(r, int) else 1)

ins.sort()
n = len(ins)
print("inputTokens 分布（n=%d）" % n)
print("  最小      %s" % "{:,}".format(ins[0]))
print("  10%% 分位  %s" % "{:,}".format(ins[n // 10]))
print("  25%% 分位  %s" % "{:,}".format(ins[n // 4]))
print("  中位数    %s" % "{:,}".format(ins[n // 2]))
print("  75%% 分位  %s" % "{:,}".format(ins[3 * n // 4]))
print("  90%% 分位  %s" % "{:,}".format(ins[int(n * 0.9)]))
print("  95%% 分位  %s" % "{:,}".format(ins[int(n * 0.95)]))
print("  最大      %s" % "{:,}".format(ins[-1]))
print("  平均      %s" % "{:,}".format(int(sum(ins) / n)))
print()
print("★ 关键：中位数 %s vs 平均 %s" % ("{:,}".format(ins[n // 2]), "{:,}".format(int(sum(ins) / n))))
print("  若中位数 << 平均 ⇒ 少数超长轮次（如读大文件）拉高了总数")
print()
# 找出最大的 20 轮在干什么
print("最大的 20 轮（按 inputTokens）在做什么：")
rows = []
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
        rows.append((u["inputTokens"], d.get("type"), d.get("name") or "", d.get("timestamp", "")[:19]))
rows.sort(reverse=True)
for it, t, nm, ts in rows[:20]:
    print("   %12s  %-20s %-22s %s" % ("{:,}".format(it), t, nm[:22], ts))
