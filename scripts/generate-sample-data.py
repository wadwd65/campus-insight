# -*- coding: utf-8 -*-
"""生成方向 C 的示例学习记录数据。

为什么要用脚本生成，而不是手写 CSV：
    示例数据必须让「四个故事」真实存在于数字里（见 docs/开发任务表-方向C.md 第三节）。
    手写 200 多行没法保证数学时长真的占 45%、英语正确率真的掉 11 个百分点。
    用固定随机种子生成 + 自动校验，改一个参数就能重算，过程可复现。

用法：
    python scripts/generate-sample-data.py            # 生成 CSV
    python scripts/generate-sample-data.py --verify   # 只打印统计校验，不写文件

输出：
    public/data/学习记录示例.csv
"""

from __future__ import annotations

import argparse
import csv
import os
import random
from datetime import date, timedelta

# ---------------------------------------------------------------- 可调参数

SEED = 20260914          # 固定种子，保证每次生成结果完全一致
START = date(2026, 3, 1)  # 数据起始日
DAYS = 80                # 时间跨度
CHANGE_DAY = 45          # 第几天起：英语正确率开始下滑、数学同步加时（1 起算）
NO_RECORD_PROB = 0.06    # 有约 6% 的日子完全没有记录（真实场景里必然存在）

OUT_PATH = os.path.join("public", "data", "学习记录示例.csv")

# 时段系数：同一个人上午的状态最好，下午最差。
# 这是「故事 3」在数据里的实现方式，也是数学被判为低效的间接原因。
SLOT_FACTOR = {"上午": 1.10, "下午": 0.93, "晚上": 1.00}
SLOT_WINDOW = {  # 分钟数区间，与数据契约里的时段定义对齐
    "上午": (450, 690),    # 07:30 ~ 11:30
    "下午": (840, 1050),   # 14:00 ~ 17:30
    "晚上": (1140, 1350),  # 19:00 ~ 22:30
}

# sessions = 每天出现该科的概率，(前期, 后期)
# minutes  = 单次时长区间，(前期, 后期)
# slot_mix = 该科更可能被安排在哪个时段
# qpm      = 每分钟大约做几道题（各科题型不同，题量口径要像真的）
SUBJECTS = {
    "数学": dict(sessions=(0.95, 1.30), minutes=((75, 100), (85, 115)),
                 slot_mix={"上午": 0.20, "下午": 0.55, "晚上": 0.25}, qpm=0.22),
    "英语": dict(sessions=(0.85, 0.85), minutes=((40, 65), (40, 65)),
                 slot_mix={"上午": 0.40, "下午": 0.15, "晚上": 0.45}, qpm=0.62),
    "专业课": dict(sessions=(0.55, 0.55), minutes=((95, 125), (115, 150)),
                   slot_mix={"上午": 0.45, "下午": 0.30, "晚上": 0.25}, qpm=0.11),
    "政治": dict(sessions=(0.35, 0.35), minutes=((40, 65), (40, 65)),
                 slot_mix={"上午": 0.10, "下午": 0.20, "晚上": 0.70}, qpm=0.55),
}


# ---------------------------------------------------------------- 核心模型

def base_accuracy(subject: str, day_no: int) -> float:
    """某科在第 day_no 天的基准正确率（时段系数会在此基础上再乘一次）。"""
    if subject == "英语":
        # 故事 2：第 CHANGE_DAY 天起连续下滑 11 个百分点，滑完维持在低位。
        # 用 2 天走完，形状是「英语从分项练习切成整套真题」那种跳水：
        # 一是真实（切题型就会掉分），二是过渡段够窄，起点才检测得准。
        if day_no < CHANGE_DAY:
            return 0.775
        k = min(1.0, (day_no - CHANGE_DAY + 1) / 2.0)
        return 0.775 - 0.110 * k
    if subject == "专业课":
        # 故事 4 的反例：全程缓慢爬升，时长涨、正确率也涨
        k = (day_no - 1) / (DAYS - 1)
        return 0.560 + 0.160 * k
    if subject == "数学":
        # 故事 1：基准就是全场最低
        return 0.665 if day_no < CHANGE_DAY else 0.645
    return 0.730  # 政治


def _n_sessions(rnd: random.Random, expected: float) -> int:
    """按期望值抽当天该科的学习次数（0 或 1，期望 > 1 时可能到 2）。"""
    n = int(expected)
    if rnd.random() < expected - n:
        n += 1
    return n


def _pick_slot(rnd: random.Random, mix: dict) -> str:
    r, acc = rnd.random(), 0.0
    for slot, w in mix.items():
        acc += w
        if r <= acc:
            return slot
    return "晚上"


def _pick_start(rnd: random.Random, slot: str, used: set) -> str | None:
    """在时段窗口内取一个不重复的开始时间，返回 HH:MM。"""
    lo, hi = SLOT_WINDOW[slot]
    for _ in range(24):
        m = rnd.randrange(lo, hi, 5)
        if m not in used:
            used.add(m)
            return f"{m // 60:02d}:{m % 60:02d}"
    for m in range(lo, hi, 5):  # 极端情况下顺序找一个空位
        if m not in used:
            used.add(m)
            return f"{m // 60:02d}:{m % 60:02d}"
    return None


def generate() -> list[dict]:
    rnd = random.Random(SEED)
    rows: list[dict] = []

    for i in range(DAYS):
        day_no = i + 1
        d = START + timedelta(days=i)
        if rnd.random() < NO_RECORD_PROB:
            continue  # 这天完全没学，后面统计时按「有记录的天数」算日均

        phase = 0 if day_no < CHANGE_DAY else 1
        used: set = set()

        for subject, cfg in SUBJECTS.items():
            for _ in range(_n_sessions(rnd, cfg["sessions"][phase])):
                slot = _pick_slot(rnd, cfg["slot_mix"])
                start = _pick_start(rnd, slot, used)
                if start is None:
                    continue

                minutes = rnd.randint(*cfg["minutes"][phase])
                qpm = cfg["qpm"] * rnd.uniform(0.85, 1.15)
                questions = max(1, round(minutes * qpm))

                acc = base_accuracy(subject, day_no) * SLOT_FACTOR[slot]
                acc += rnd.gauss(0, 0.05)
                acc = min(0.95, max(0.30, acc))
                correct = max(0, min(questions, round(questions * acc)))

                rows.append({
                    "日期": d.isoformat(),
                    "开始时间": start,
                    "科目": subject,
                    "时长_分钟": minutes,
                    "完成题量": questions,
                    "正确数": correct,
                })

    rows.sort(key=lambda r: (r["日期"], r["开始时间"]))
    return rows


# ---------------------------------------------------------------- 统计校验

def _slot_of(t: str) -> str:
    h = int(t[:2])
    return "上午" if h < 12 else ("下午" if h < 18 else "晚上")


def _acc(rows: list[dict]) -> float:
    q = sum(r["完成题量"] for r in rows)
    return sum(r["正确数"] for r in rows) / q if q else 0.0


def _daily_series(rows: list[dict], subject: str) -> list[tuple[date, float]]:
    by_day: dict[date, list[dict]] = {}
    for r in rows:
        if r["科目"] == subject:
            by_day.setdefault(date.fromisoformat(r["日期"]), []).append(r)
    return sorted((d, _acc(v)) for d, v in by_day.items())


def _moving_average(series: list[tuple[date, float]], window: int = 7, centered: bool = True):
    """滑动平均。

    centered=True 取「前 3 天 + 当天 + 后 3 天」，时间戳打在正中间，
    曲线不会有滞后。仅有滞后版（只看过去）才会把转折点整体往后拖。
    边界处自动缩短窗口，不让两端被丢掉。
    """
    half = window // 2
    out = []
    for i in range(len(series)):
        if centered:
            lo, hi = max(0, i - half), min(len(series), i + half + 1)
        else:
            lo, hi = max(0, i - window + 1), i + 1
        chunk = series[lo:hi]
        out.append((series[i][0], sum(v for _, v in chunk) / len(chunk)))
    return out


def _sse(vals: list[float]) -> float:
    """一段数内部离均差平方和：越小说明这一段越像「平稳的一条水平线」。"""
    if not vals:
        return 0.0
    m = sum(vals) / len(vals)
    return sum((v - m) ** 2 for v in vals)


def detect_change_point(series: list[tuple[date, float]], window: int = 7, min_seg: int = 10):
    """在 7 日滑动平均上找转折点。

    做法：把序列在每个可能的位置切成前后两段，算「两段内部方差之和」，
    取最小的那个切点。两段各自越平、切点越准 —— 这就是水平位移型转折的标准找法。

    为什么不用「跌破某条阈值」：滑动平均本身滞后，等它跌破阈值时，
    跌幅已经走完大半，测到的是终点而不是起点。
    """
    ma = _moving_average(series, window)
    vals = [v for _, v in ma]
    if len(vals) < min_seg * 2:
        return None, ma
    best_i, best_sse = None, None
    for i in range(min_seg, len(vals) - min_seg + 1):
        sse = _sse(vals[:i]) + _sse(vals[i:])
        if best_sse is None or sse < best_sse:
            best_sse, best_i = sse, i
    return (ma[best_i][0], ma) if best_i is not None else (None, ma)


def verify(rows: list[dict]) -> bool:
    total_min = sum(r["时长_分钟"] for r in rows)
    days = sorted({r["日期"] for r in rows})
    print(f"总行数 {len(rows)}　跨度 {days[0]} ~ {days[-1]}（共 {len(days)} 天有记录）")
    print(f"总时长 {total_min} 分钟 = {total_min / 60:.1f} 小时　"
          f"日均（有记录日）{total_min / len(days):.0f} 分钟\n")

    # 故事 1：数学时长占比最高、正确率最低
    print("【分科】")
    by_sub: dict[str, list[dict]] = {}
    for r in rows:
        by_sub.setdefault(r["科目"], []).append(r)
    rank = []
    for s, v in by_sub.items():
        m = sum(r["时长_分钟"] for r in v)
        a = _acc(v)
        rank.append((s, m, m / total_min, a, len(v)))
    for s, m, share, a, n in sorted(rank, key=lambda x: -x[2]):
        print(f"  {s:<4} 次数 {n:>3}　时长 {m:>5} 分（{share:5.1%}）　正确率 {a:6.2%}")

    top_share = max(rank, key=lambda x: x[2])
    worst_acc = min(rank, key=lambda x: x[3])
    ok1 = top_share[0] == "数学" and worst_acc[0] == "数学" and 0.40 <= top_share[2] <= 0.50
    print(f"  → 故事 1（数学时长最高 {top_share[2]:.1%} 且正确率最低 {worst_acc[3]:.1%}）："
          f"{'通过' if ok1 else '不通过'}\n")

    # 故事 2：英语从某天起下滑约 11 个百分点
    eng = _daily_series(rows, "英语")
    cp, ma = detect_change_point(eng)
    offset = (cp - date.fromisoformat(rows[0]["日期"])).days + 1 if cp else None
    pre = [r for r in eng if (r[0] - date.fromisoformat(rows[0]["日期"])).days + 1 < CHANGE_DAY]
    post = [r for r in eng if (r[0] - date.fromisoformat(rows[0]["日期"])).days + 1 >= CHANGE_DAY]
    drop = _acc([x for x in by_sub["英语"] if x["日期"] < (cp or date.max).isoformat()])
    rise = _acc([x for x in by_sub["英语"] if x["日期"] >= (cp or date.max).isoformat()])
    ok2 = cp is not None and abs(offset - CHANGE_DAY) <= 3 and 0.08 <= drop - rise <= 0.15
    print(f"【故事 2 · 英语下滑】检测到的起点 {cp}（第 {offset} 天，设定第 {CHANGE_DAY} 天）")
    print(f"  该点前正确率 {drop:.2%}　该点后 {rise:.2%}　落差 {drop - rise:.2%}"
          f"　→ {'通过' if ok2 else '不通过'}\n")

    # 故事 3：上午明显高于下午
    print("【时段】")
    by_slot: dict[str, list[dict]] = {}
    for r in rows:
        by_slot.setdefault(_slot_of(r["开始时间"]), []).append(r)
    for s in ("上午", "下午", "晚上"):
        v = by_slot.get(s, [])
        if not v:
            continue
        m = sum(r["时长_分钟"] for r in v)
        print(f"  {s} 次数 {len(v):>3}　时长 {m:>5} 分（{m / total_min:5.1%}）　正确率 {_acc(v):6.2%}")
    ok3 = _acc(by_slot["上午"]) - _acc(by_slot["下午"]) >= 0.08
    print(f"  → 故事 3（上午高出下午 {_acc(by_slot['上午']) - _acc(by_slot['下午']):.2%}）："
          f"{'通过' if ok3 else '不通过'}\n")

    # 故事 4：反例——时长在涨、正确率也在涨
    mid = date.fromisoformat(rows[0]["日期"]) + timedelta(days=DAYS // 2)
    print("【故事 4 · 反例】前后半程对比")
    ok4 = False
    for s, v in by_sub.items():
        a = [r for r in v if r["日期"] < mid.isoformat()]
        b = [r for r in v if r["日期"] >= mid.isoformat()]
        if not a or not b:
            continue
        ma_, mb = sum(r["时长_分钟"] for r in a) / len(a), sum(r["时长_分钟"] for r in b) / len(b)
        aa, ab = _acc(a), _acc(b)
        flag = ""
        if mb > ma_ and ab > aa:
            flag = "　← 时长与正确率同涨（反例成立）"
            ok4 = True
        print(f"  {s:<4} 单次时长 {ma_:5.0f} → {mb:5.0f} 分　正确率 {aa:6.2%} → {ab:6.2%}{flag}")
    print(f"  → 故事 4：{'通过' if ok4 else '不通过'}\n")

    # 附加：数学是不是被排在下午
    math_slot: dict[str, int] = {}
    for r in by_sub["数学"]:
        math_slot[_slot_of(r["开始时间"])] = math_slot.get(_slot_of(r["开始时间"]), 0) + r["时长_分钟"]
    mt = sum(math_slot.values())
    print("【数学的时段分布】" + "　".join(f"{k} {v / mt:.0%}" for k, v in sorted(math_slot.items())))

    passed = all([ok1, ok2, ok3, ok4])
    print(f"\n=== 四个故事自检：{'全部通过' if passed else '存在不通过项'} ===")
    return passed


# ---------------------------------------------------------------- 入口

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--verify", action="store_true", help="只打印统计校验，不写文件")
    args = ap.parse_args()

    rows = generate()
    if not args.verify:
        os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
        with open(OUT_PATH, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=["日期", "开始时间", "科目", "时长_分钟", "完成题量", "正确数"])
            w.writeheader()
            w.writerows(rows)
        print(f"已写入 {OUT_PATH}（{len(rows)} 行）\n")

    verify(rows)


if __name__ == "__main__":
    main()
