# -*- coding: utf-8 -*-
"""生成「大学平行宇宙」的基准问卷数据（模拟）。

用途：给「你超过了 82% 的大学生」这句话提供真实出处，而不是随口编的数字。

设计要点（详见 docs/设计-01-问题与映射矩阵.md 第七节）：

  1. 只生成「原始作答」，不生成算好的属性值。
     属性交给前端用同一套映射矩阵去算 —— 这样评委本人的结果与基准人群
     走的是同一条计算路径，「百分位」是算出来的而不是查表来的，口径必然一致。

  2. 按 6 种人群亚型采样，而不是每题独立均匀随机。
     独立随机会让 2000 人在属性空间里挤成一团正态云，人人都接近 50 分位，
     「百分位」这个数就彻底失去意义。

  3. 选项池从 src/data/matrix.json 读取，与前端共用同一份定义，不在这里重抄。
     重抄一份的后果是：改了前端忘了改这里，生成的数据里出现矩阵里没有的选项，
     而那种错误在图表上看不出来。

⚠️ 这是模拟数据，不是真实调查结果。README / 页面 / 技术文档三处都要声明。
"""

from __future__ import annotations

import argparse
import csv
import json
import random
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MATRIX_PATH = ROOT / "src" / "data" / "matrix.json"
OUT_PATH = ROOT / "public" / "data" / "问卷基准数据.csv"

SEED = 20260914
DEFAULT_N = 2000

# ── 人群亚型 ──────────────────────────────────────────────────────────────
# bias: {问题id: {选项文本: 权重}}，未列出的选项权重为 1.0。
# 权重只影响采样倾向，不参与属性计算 —— 属性永远由 matrix.json 决定。
ARCHETYPES: list[dict] = [
    {
        "name": "学霸型",
        "share": 0.20,
        "bias": {
            "Q1": {"图书馆自习室": 12, "宿舍床上": 2, "操场跑道": 1, "食堂窗口": 1, "网吧": 0.2},
            "Q2": {"提前两周就复习完了": 10, "死磕课本": 8, "刷往年题": 5, "组团开黑边复习": 1, "临时抱佛脚": 0.3},
            "Q3": {"从不": 6, "偶尔": 4, "一周三五次": 1.5, "天天吃": 0.5},
            "Q4": {"辩论队": 6, "摄影社": 3, "志愿者协会": 3, "乐队": 2, "电竞社": 0.5},
            "Q5": {"靠奖学金过日子": 8, "家里定时打钱": 3, "兼职自力更生": 1.5, "月初土豪，月底吃土": 0.5},
            "Q6": {"图书馆那张常坐的座位": 8, "什么也没带走，但也没白来": 2, "宿舍的那群人": 1.5, "操场的那圈跑道": 1, "食堂的那个窗口": 1},
        },
    },
    {
        "name": "社交型",
        "share": 0.22,
        "bias": {
            "Q1": {"食堂窗口": 6, "网吧": 4, "操场跑道": 3, "宿舍床上": 3, "图书馆自习室": 1},
            "Q2": {"组团开黑边复习": 8, "临时抱佛脚": 4, "刷往年题": 2, "死磕课本": 1.5, "提前两周就复习完了": 1},
            "Q3": {"天天吃": 6, "一周三五次": 5, "偶尔": 2, "从不": 0.8},
            "Q4": {"乐队": 6, "志愿者协会": 5, "辩论队": 4, "电竞社": 3, "摄影社": 2},
            "Q5": {"月初土豪，月底吃土": 7, "兼职自力更生": 3, "家里定时打钱": 3, "靠奖学金过日子": 1},
            "Q6": {"宿舍的那群人": 8, "食堂的那个窗口": 5, "操场的那圈跑道": 3, "图书馆那张常坐的座位": 1.5, "什么也没带走，但也没白来": 1.5},
        },
    },
    {
        "name": "运动型",
        "share": 0.12,
        "bias": {
            "Q1": {"操场跑道": 12, "食堂窗口": 2, "宿舍床上": 1.5, "图书馆自习室": 1, "网吧": 0.3},
            "Q2": {"刷往年题": 5, "死磕课本": 4, "提前两周就复习完了": 3, "组团开黑边复习": 2, "临时抱佛脚": 1.5},
            "Q3": {"偶尔": 5, "一周三五次": 4, "从不": 3, "天天吃": 1.5},
            "Q4": {"志愿者协会": 6, "摄影社": 4, "辩论队": 3, "乐队": 2.5, "电竞社": 1},
            "Q5": {"兼职自力更生": 6, "家里定时打钱": 4, "靠奖学金过日子": 2, "月初土豪，月底吃土": 1.5},
            "Q6": {"操场的那圈跑道": 12, "什么也没带走，但也没白来": 3, "宿舍的那群人": 2, "图书馆那张常坐的座位": 1.5, "食堂的那个窗口": 1},
        },
    },
    {
        "name": "夜猫型",
        "share": 0.18,
        "bias": {
            "Q1": {"网吧": 10, "宿舍床上": 5, "食堂窗口": 2, "操场跑道": 1.5, "图书馆自习室": 1},
            "Q2": {"临时抱佛脚": 10, "组团开黑边复习": 6, "刷往年题": 3, "死磕课本": 1.5, "提前两周就复习完了": 0.5},
            "Q3": {"天天吃": 9, "一周三五次": 4, "偶尔": 1.5, "从不": 0.3},
            "Q4": {"电竞社": 10, "乐队": 5, "摄影社": 2.5, "志愿者协会": 1.5, "辩论队": 1.5},
            "Q5": {"月初土豪，月底吃土": 7, "兼职自力更生": 3, "家里定时打钱": 3, "靠奖学金过日子": 0.8},
            "Q6": {"宿舍的那群人": 5, "什么也没带走，但也没白来": 4, "食堂的那个窗口": 3, "操场的那圈跑道": 1.5, "图书馆那张常坐的座位": 1},
        },
    },
    {
        "name": "干饭型",
        "share": 0.16,
        "bias": {
            "Q1": {"食堂窗口": 12, "宿舍床上": 3, "网吧": 2, "操场跑道": 1.5, "图书馆自习室": 1},
            "Q2": {"组团开黑边复习": 6, "刷往年题": 4, "临时抱佛脚": 4, "死磕课本": 2, "提前两周就复习完了": 1.5},
            "Q3": {"天天吃": 12, "一周三五次": 5, "偶尔": 1, "从不": 0.3},
            "Q4": {"乐队": 5, "摄影社": 4, "志愿者协会": 4, "电竞社": 3, "辩论队": 2},
            "Q5": {"月初土豪，月底吃土": 6, "家里定时打钱": 4, "兼职自力更生": 3, "靠奖学金过日子": 1.5},
            "Q6": {"食堂的那个窗口": 12, "宿舍的那群人": 4, "什么也没带走，但也没白来": 2, "操场的那圈跑道": 1.5, "图书馆那张常坐的座位": 1},
        },
    },
    {
        "name": "均衡型",
        "share": 0.12,
        "bias": {},  # 全 1.0，均匀分布
    },
]


def load_matrix() -> dict:
    return json.loads(MATRIX_PATH.read_text(encoding="utf-8"))


def option_index(matrix: dict) -> dict[str, list[str]]:
    """{问题id: [选项文本, ...]}"""
    return {q["id"]: [o["text"] for o in q["options"]] for q in matrix["questions"]}


def sample_rows(matrix: dict, n: int, seed: int) -> list[dict]:
    rnd = random.Random(seed)
    opts = option_index(matrix)
    shares = [a["share"] for a in ARCHETYPES]

    rows: list[dict] = []
    for i in range(1, n + 1):
        arch = rnd.choices(ARCHETYPES, weights=shares)[0]
        row: dict = {"编号": f"S{i:04d}"}
        for q in matrix["questions"]:
            texts = opts[q["id"]]
            weights = [arch["bias"].get(q["id"], {}).get(t, 1.0) for t in texts]
            row[q["field"]] = rnd.choices(texts, weights=weights)[0]
        row["_archetype"] = arch["name"]
        rows.append(row)
    return rows


def attribute_values(matrix: dict, row: dict) -> dict[str, int]:
    """把一次作答换算成 8 维原始分。派生属性在此一并算出。"""
    vals: dict[str, int] = defaultdict(int)
    for q in matrix["questions"]:
        chosen = row[q["field"]]
        for opt in q["options"]:
            if opt["text"] == chosen:
                for k, v in opt["vec"].items():
                    vals[k] += v
                break
        else:
            raise KeyError(f"选项「{chosen}」在 {q['id']} 的矩阵里不存在 —— 选项池漂移了")
    for d in matrix.get("derived", []):
        vals[d["key"]] = sum(int(c) * vals.get(k, 0) for k, c in d["formula"].items())
    return dict(vals)


def percentile(sorted_vals: list[int], p: float) -> int:
    if not sorted_vals:
        return 0
    k = (len(sorted_vals) - 1) * p / 100.0
    lo, hi = int(k), min(int(k) + 1, len(sorted_vals) - 1)
    return round(sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * (k - lo))


def verify(matrix: dict, rows: list[dict]) -> bool:
    ok = True
    n = len(rows)

    print(f"总行数：{n}")

    # ── 1. 亚型占比 ──
    print("\n【亚型占比】设定 → 实际")
    counts = Counter(r["_archetype"] for r in rows)
    for a in ARCHETYPES:
        actual = counts.get(a["name"], 0) / n
        diff = abs(actual - a["share"])
        flag = "✓" if diff <= 0.035 else "✗"
        if diff > 0.035:
            ok = False
        print(f"  {flag} {a['name']:<4} {a['share'] * 100:5.1f}% → {actual * 100:5.1f}%")

    # ── 2. 每题选项分布：不能有选项为 0 ──
    print("\n【选项覆盖】出现次数最少的选项")
    for q in matrix["questions"]:
        c = Counter(r[q["field"]] for r in rows)
        texts = [o["text"] for o in q["options"]]
        missing = [t for t in texts if c.get(t, 0) == 0]
        least = min(texts, key=lambda t: c.get(t, 0))
        share = c.get(least, 0) / n
        flag = "✓" if not missing and share >= 0.004 else "✗"
        if flag == "✗":
            ok = False
        note = f"  缺：{missing}" if missing else ""
        print(f"  {flag} {q['id']} 最少「{least}」{c.get(least, 0)} 次（{share * 100:.2f}%）{note}")

    # ── 3. 属性分布：必须有长尾，否则百分位无意义 ──
    print("\n【属性分布】供前端对账（同一份 CSV、同一套矩阵，两边算出的分位数应当一致）")
    attr_keys = [a["key"] for a in matrix["attributes"]] + [d["key"] for d in matrix.get("derived", [])]
    series: dict[str, list[int]] = defaultdict(list)
    for r in rows:
        for k, v in attribute_values(matrix, r).items():
            series[k].append(v)

    print(f"  {'属性':<12}{'min':>5}{'p10':>5}{'p25':>5}{'p50':>5}{'p75':>5}{'p90':>5}{'max':>5}{'p90-p10':>9}")
    for k in attr_keys:
        vals = sorted(series[k])
        p10, p90 = percentile(vals, 10), percentile(vals, 90)
        span = p90 - p10
        flag = "✓" if span >= 3 else "✗"
        if span < 3:
            ok = False
        print(f"  {flag} {k:<12}{vals[0]:>5}{p10:>5}{percentile(vals, 25):>5}{percentile(vals, 50):>5}"
              f"{percentile(vals, 75):>5}{p90:>5}{vals[-1]:>5}{span:>9}")

    # ── 4. 选项文本是否全部落在矩阵内 ──
    print("\n【矩阵一致性】CSV 里的每个选项都能在矩阵里找到")
    try:
        for r in rows:
            attribute_values(matrix, r)
        print("  ✓ 全部命中，无漂移")
    except KeyError as e:
        ok = False
        print(f"  ✗ {e}")

    return ok


def write_csv(matrix: dict, rows: list[dict]) -> None:
    fields = ["编号"] + [q["field"] for q in matrix["questions"]]
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    # utf-8-sig：带 BOM，模拟真实用户从 Excel 导出的文件；解析层必须能吃下它
    with OUT_PATH.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def main() -> int:
    ap = argparse.ArgumentParser(description="生成基准问卷数据（模拟）")
    ap.add_argument("-n", "--count", type=int, default=DEFAULT_N, help=f"行数，默认 {DEFAULT_N}")
    ap.add_argument("--seed", type=int, default=SEED, help=f"随机种子，默认 {SEED}")
    ap.add_argument("--verify", action="store_true", help="生成前先跑自检")
    args = ap.parse_args()

    if not MATRIX_PATH.exists():
        print(f"找不到 {MATRIX_PATH}", file=sys.stderr)
        return 2

    matrix = load_matrix()
    rows = sample_rows(matrix, args.count, args.seed)

    ok = True
    if args.verify:
        ok = verify(matrix, rows)
        print()

    write_csv(matrix, rows)
    size = OUT_PATH.stat().st_size
    print(f"已写入 {OUT_PATH}")
    print(f"  {len(rows)} 行 · {size / 1024:.1f} KB · 编码 utf-8-sig（带 BOM）")

    if args.verify and not ok:
        print("\n⚠️ 自检未全通过 —— 需要回去调整型权重或矩阵，不是调阈值")
        return 1
    if args.verify:
        print("\n✓ 自检全通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
