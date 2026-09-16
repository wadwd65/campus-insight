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
            "Q7": {"提前十分钟到，坐前排": 10, "卡着铃声冲进去，坐最后一排": 3, "让室友帮忙占座，自己慢慢来": 2, "选了，但没去过几次": 0.5, "早上根本没课，我的课都在下午": 1},
            "Q8": {"器械区随便练练，练完就走": 4, "跑道上，一个人戴着耳机跑": 3, "羽毛球乒乓球，约人打": 2, "球场，组队打一场": 2, "看台或树下，看别人动": 1.5},
            "Q9": {"睡一觉，第二天照常": 8, "给家里打个电话": 6, "去操场跑到没力气": 3, "拉朋友出去吃一顿": 2, "开黑到凌晨，把气打出去": 0.8},
            "Q10": {"课件、板书、PPT 截图": 12, "风景和现场：演出、展览、天空": 3, "吃的：外卖、食堂、探店": 2, "和朋友：合影、表情包、抓拍": 1.5, "运动记录、跑步路线、装备": 1.5},
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
            "Q7": {"让室友帮忙占座，自己慢慢来": 8, "卡着铃声冲进去，坐最后一排": 5, "提前十分钟到，坐前排": 3, "选了，但没去过几次": 3, "早上根本没课，我的课都在下午": 3},
            "Q8": {"球场，组队打一场": 8, "羽毛球乒乓球，约人打": 8, "看台或树下，看别人动": 4, "跑道上，一个人戴着耳机跑": 2, "器械区随便练练，练完就走": 1.5},
            "Q9": {"拉朋友出去吃一顿": 9, "给家里打个电话": 6, "开黑到凌晨，把气打出去": 5, "睡一觉，第二天照常": 3, "去操场跑到没力气": 2},
            "Q10": {"和朋友：合影、表情包、抓拍": 12, "吃的：外卖、食堂、探店": 5, "风景和现场：演出、展览、天空": 3, "运动记录、跑步路线、装备": 2, "课件、板书、PPT 截图": 1},
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
            "Q7": {"提前十分钟到，坐前排": 6, "卡着铃声冲进去，坐最后一排": 5, "让室友帮忙占座，自己慢慢来": 3, "早上根本没课，我的课都在下午": 2, "选了，但没去过几次": 1.5},
            "Q8": {"跑道上，一个人戴着耳机跑": 12, "球场，组队打一场": 10, "器械区随便练练，练完就走": 6, "羽毛球乒乓球，约人打": 4, "看台或树下，看别人动": 0.5},
            "Q9": {"去操场跑到没力气": 10, "睡一觉，第二天照常": 4, "拉朋友出去吃一顿": 3, "给家里打个电话": 3, "开黑到凌晨，把气打出去": 2},
            "Q10": {"运动记录、跑步路线、装备": 12, "风景和现场：演出、展览、天空": 4, "和朋友：合影、表情包、抓拍": 3, "吃的：外卖、食堂、探店": 2, "课件、板书、PPT 截图": 1.5},
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
            "Q7": {"早上根本没课，我的课都在下午": 10, "选了，但没去过几次": 9, "卡着铃声冲进去，坐最后一排": 6, "让室友帮忙占座，自己慢慢来": 4, "提前十分钟到，坐前排": 0.8},
            "Q8": {"看台或树下，看别人动": 6, "球场，组队打一场": 3, "器械区随便练练，练完就走": 2, "跑道上，一个人戴着耳机跑": 2, "羽毛球乒乓球，约人打": 2},
            "Q9": {"开黑到凌晨，把气打出去": 10, "拉朋友出去吃一顿": 4, "给家里打个电话": 3, "睡一觉，第二天照常": 2, "去操场跑到没力气": 1.5},
            "Q10": {"和朋友：合影、表情包、抓拍": 5, "吃的：外卖、食堂、探店": 5, "风景和现场：演出、展览、天空": 4, "运动记录、跑步路线、装备": 3, "课件、板书、PPT 截图": 2},
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
            "Q7": {"卡着铃声冲进去，坐最后一排": 7, "让室友帮忙占座，自己慢慢来": 4, "提前十分钟到，坐前排": 4, "选了，但没去过几次": 3, "早上根本没课，我的课都在下午": 3},
            "Q8": {"看台或树下，看别人动": 7, "羽毛球乒乓球，约人打": 4, "球场，组队打一场": 3, "器械区随便练练，练完就走": 2, "跑道上，一个人戴着耳机跑": 1.5},
            "Q9": {"拉朋友出去吃一顿": 12, "给家里打个电话": 5, "开黑到凌晨，把气打出去": 4, "睡一觉，第二天照常": 3, "去操场跑到没力气": 1},
            "Q10": {"吃的：外卖、食堂、探店": 12, "和朋友：合影、表情包、抓拍": 5, "风景和现场：演出、展览、天空": 3, "运动记录、跑步路线、装备": 1.5, "课件、板书、PPT 截图": 1},
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


def attribute_ranges(matrix: dict, rows: list[dict]) -> dict[str, list[int]]:
    """各维度的 min/max —— 供跨语言对账用。

    为什么用 min/max 而不是均值或分位数：它与插值方式无关。
    JS 端与服务端各算各的，只有 min/max 这种"极值"在两种实现下必然相同，
    换成分位数就会因为插值约定不同而产生永远对不上的小数。
    """
    keys = [a["key"] for a in matrix["attributes"]] + [d["key"] for d in matrix.get("derived", [])]
    vals: dict[str, list[int]] = {k: [] for k in keys}
    for r in rows:
        for k, v in attribute_values(matrix, r).items():
            vals[k].append(v)
    return {k: [min(vs), max(vs)] for k, vs in vals.items()}

def write_csv(matrix: dict, rows: list[dict], out_path) -> None:
    fields = ["编号"] + [q["field"] for q in matrix["questions"]]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # utf-8-sig：带 BOM，模拟真实用户从 Excel 导出的文件；解析层必须能吃下它
    #
    # lineterminator 显式写成 \n 而不是 csv 模块默认的 \r\n：仓库统一 LF（见 .gitattributes），
    # 生成端跟随。否则每次重新生成，git 都会认为文件被改过 —— 那是假差异，
    # 会让人误以为「数据变了」，也会淹没真正的改动。
    with out_path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore", lineterminator="\n")
        w.writeheader()
        w.writerows(rows)


def main() -> int:
    ap = argparse.ArgumentParser(description="生成基准问卷数据（模拟）")
    ap.add_argument("-n", "--count", type=int, default=DEFAULT_N, help=f"行数，默认 {DEFAULT_N}")
    ap.add_argument("--seed", type=int, default=SEED, help=f"随机种子，默认 {SEED}")
    ap.add_argument(
        "--out",
        default=None,
        help="输出路径（默认 public/data/问卷基准数据.csv）。"
        "用于生成真入口的示例班级问卷：同一个生成器 + 不同行数与种子",
    )
    ap.add_argument(
        "--verify",
        action="store_true",
        help="生成前先跑自检。⚠️ 其中的亚型占比容差是按基准数据的行数（2000）设的，"
        "给示例班级问卷（48 行）这类小样本用 --verify 会必然不通过 —— 那是尺度问题，不是数据问题。"
        "小样本真正该守的是「选项零漂移」，那一条由 npm run selftest 的闸门一负责",
    )
    args = ap.parse_args()

    if not MATRIX_PATH.exists():
        print(f"找不到 {MATRIX_PATH}", file=sys.stderr)
        return 2

    out_path = Path(args.out) if args.out else OUT_PATH
    if not out_path.is_absolute():
        out_path = ROOT / out_path

    matrix = load_matrix()
    rows = sample_rows(matrix, args.count, args.seed)

    ok = True
    if args.verify:
        ok = verify(matrix, rows)
        print()


    ranges = attribute_ranges(matrix, rows)
    range_path = ROOT / "public" / "data" / "基准属性范围.json"
    range_path.write_text(json.dumps(ranges, ensure_ascii=False, indent=2), encoding="utf-8")
    write_csv(matrix, rows, out_path)
    size = out_path.stat().st_size
    print(f"已写入 {out_path}")
    print(f"  {len(rows)} 行 · {size / 1024:.1f} KB · 编码 utf-8-sig（带 BOM）")

    if args.verify and not ok:
        print("\n⚠️ 自检未全通过 —— 需要回去调整型权重或矩阵，不是调阈值")
        return 1
    if args.verify:
        print("\n✓ 自检全通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
