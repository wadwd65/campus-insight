# -*- coding: utf-8 -*-
"""校验：统计里是否存在重复计数（同一条 usage 被多次写入）。
判据：若每条 assistant 消息的 usage 唯一，则轮次应接近"真实的模型调用次数"。
     若发现大量重复，说明有多次写入/回滚重放。
"""
import io, json, os, glob

DD = r"C:\Users\123\.workbuddy\projects\c-Users-123-WorkBuddy-2026-09-10-15-40-22"
f = os.path.join(DD, "778b93fb-604c-48ad-8c92-69ed9aee29f5.jsonl")

seen_ids = {}
dup_msg = 0
usage_count = 0
by_type = {}
lines = 0

with io.open(f, encoding="utf-8", errors="replace") as fp:
    for line in fp:
        lines += 1
        if "inputTokens" not in line:
            continue
        try:
            d = json.loads(line)
        except Exception:
            continue
        t = d.get("type", "?")
        by_type[t] = by_type.get(t, 0) + 1
        usage_count += 1
        # 用 id + timestamp 做去重键
        key = (d.get("id"), d.get("timestamp"))
        seen_ids[key] = seen_ids.get(key, 0) + 1

dups = {k: v for k, v in seen_ids.items() if v > 1}
print("文件行数 %d" % lines)
print("含 inputTokens 的行数 %d" % usage_count)
print()
print("按 type 分布：")
for k, v in sorted(by_type.items(), key=lambda x: -x[1]):
    print("   %-26s %d" % (k, v))
print()
print("唯一 (id,timestamp) 键 %d 个，其中重复的 %d 个" % (len(seen_ids), len(dups)))
if dups:
    top = sorted(dups.items(), key=lambda x: -x[1])[:10]
    print("  重复最多的前 10：")
    for (i, ts), c in top:
        print("     x%-4d %s  %s" % (c, i, ts))
    print()
    print("  ★ 说明：同一条 usage 被写了多次 —— 累计值有虚高。")
    print("  ★ 去重后的真实轮次 ≈ %d" % len(seen_ids))
else:
    print("  无重复 ⇒ 累计值是可信的")
