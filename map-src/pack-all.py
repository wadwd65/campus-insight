# -*- coding: utf-8 -*-
"""pack-all.py —— 把"晴川学院 · 校园项目"整套打包成一个 zip，交给第三方 AI 复核。

打包原则：
  · **要能看懂 + 能跑起来 + 能复核过程**（比赛评分里"过程可复现"占 25%）
  · 去掉 node_modules / .git / 中间截图（它们只让包变大、不提供信息）
  · 保留：主站源码与构建产物 · 3D 地图与全部验收截图 · 构建管线源码与探针工具 · 记忆与选型文档
"""
import os, zipfile, io, time

ROOT = r"C:\Users\123\WorkBuddy\2026-09-10-15-40-22"
OUT = os.path.join(ROOT, "晴川校园项目_打包_20261007.zip")
TOP = "晴川校园项目_打包"

SKIP_DIRS = {"node_modules", "__pycache__", "dist-ssr", ".smoke-out"}
# 任何以点开头的目录一律不收（= 各类浏览器调试缓存/配置，campus-insight 里那份有 93MB）
def skip_dir(name):
    return name.startswith(".") or name in SKIP_DIRS
# rebuild 目录只收源码/工具，不收中间图
SRC_EXT = {".js", ".mjs", ".cjs", ".py", ".html", ".json", ".md", ".txt", ".npy", ".csv"}
# campus-review 里只保留最终成果与代表性截图（旧迭代图会占 20MB+）
KEEP_IMG = ("campus.html", "campus-green-trees", "modern-", "walled-", "compare-vs-3d",
            "site-mapscene", "site-3dpage", "stage3d", "mobile-map", "flow3-",
            "lake-trace-from-applemap", "lake-fixed", "real-buildings", "sat-buildings-detected")

def want(path, rel):
    # ⚠️ Windows 的 relpath 用反斜杠 ⇒ 必须先归一化，否则 startswith 判断永不成立
    #（首版就因此把 rebuild 里的中间图全收进来了，包从 47MB 涨到 762MB）
    rel = rel.replace("\\", "/")
    parts = rel.split("/")
    for p in parts:
        if p in SKIP_DIRS:
            return False
    ext = os.path.splitext(path)[1].lower()
    if rel.startswith(".workbuddy-gen/rebuild") and ext not in SRC_EXT:
        return False
    if ext in {".log", ".tmp"}:
        return False
    if rel.startswith("map-assets/campus-review") and ext in {".png", ".jpg", ".webp"}:
        return any(k in os.path.basename(rel) for k in KEEP_IMG)
    return True

TREES = [
    ("campus-insight", "campus-insight"),
    ("map-assets/campus-review", "map-assets/campus-review"),
    (".workbuddy-gen/rebuild", "build-src"),
    (".workbuddy/memory", "docs-process/memory"),
    ("vibe-coding-2026", "docs-process/vibe-coding-2026"),
    ("race-materials", "docs-process/race-materials"),
]
FILES = ["校园地图3D.html"]

README = """# 晴川学院 · 校园项目 打包（2026-10-07）

这份包是给"第三方复核"用的：**主站源码 + 3D 校园地图 + 全部验收截图 + 构建管线源码 + 过程记录**。

## 一、里面有什么

| 目录 | 是什么 | 怎么用 |
|---|---|---|
| `campus-insight/` | 主站（React 19 + Vite 8 + Tailwind 4 + three.js 单文件地图） | `npm install` → `npm run dev`（默认 5173）；`npm run check` 跑自检；`npm run build` 出 `dist/` |
| `map-assets/campus-review/` | **3D 校园地图成品**（`campus.html` / `校园地图-3D实景.html`）+ 全部阶段验收截图 | 直接双击 HTML 打开（单文件、零依赖、可离线） |
| `build-src/` | 3D 地图的**构建管线**：`tower-01~15-*.js` 分层源码、`build-campus.py`（8 道构建闸门）、各类探针/量测脚本 | `python build-campus.py` 可重新生成地图；探针脚本可复核布局断言 |
| `docs-process/memory/` | 每日工作记忆（含踩坑、决策、纠正记录） | 想了解"为什么这么做"看这里 |
| `docs-process/vibe-coding-2026/` | 比赛台账与计划 | — |

主站的"3D 实景校园"入口：地图页右栏「▸ 进入 3D 实景校园」（站内 iframe，顶部有返回）。

## 二、这个包**没有**包含什么（如实说明）

1. **没有 node_modules** —— 装依赖请 `npm install`（约 3 分钟）。
2. **没有大模型密钥** —— `.env` 未打包；不配密钥站点也能跑完整流程（走本地兜底总结）。
3. 地图的中间调试截图未收（只收最终验收图），避免几个 GB 的噪音。

## 三、想复核什么，建议这么看

1. **能不能跑**：`campus-insight` 里 `npm install && npm run check && npm run build`。
2. **3D 地图长什么样**：`map-assets/campus-review/` 里 `modern-aerial.png` / `modern-close.png` / `walled-plan.png` 是各阶段俯视与近景；`campus.html` 可交互。
3. **布局是否可信**：`build-src/` 里有 `diag-*.cjs` 系列探针（交叠/压路/越界/压湖）与 `extract-*.py`（从官方卫星影像与地图里抠真实轮廓），可重跑验证。
4. **过程是否诚实**：`docs-process/memory/` 逐日记录了被推翻的方案、失败尝试与纠错（包括我自己的错误）。

> 打包时间：{T}　打包脚本：`{SCRIPT}`（在包的 `build-src/` 里可找到同名脚本的调用方式）
"""

def add_tree(zf, src_dir, dst_dir, stats):
    src_abs = os.path.join(ROOT, src_dir)
    if not os.path.exists(src_abs):
        print("  跳过（不存在）：", src_dir)
        return
    for dirpath, dirnames, filenames in os.walk(src_abs):
        # 无条件筛：os.walk 是从 src_abs 内部开始列的，src_abs 自己的名字不会出现在 dirnames 里，
        # 所以不需要"保护第一层"——上一版就是因为加了保护，把 campus-insight/.workbuddy-gen（93MB 调试缓存）放进来了
        dirnames[:] = [d for d in dirnames if not skip_dir(d)]
        for fn in filenames:
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, ROOT)
            if not want(full, rel):
                continue
            arc = os.path.join(TOP, dst_dir, os.path.relpath(full, src_abs))
            try:
                zf.write(full, arc)
                stats["n"] += 1
                stats["raw"] += os.path.getsize(full)
            except Exception as e:
                print("  写入失败", rel, e)

t0 = time.time()
stats = {"n": 0, "raw": 0}
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
    zf.writestr(os.path.join(TOP, "README-打包说明.md"),
                README.replace("{T}", time.strftime("%Y-%m-%d %H:%M")).replace("{SCRIPT}", "pack-all.py"))
    for src, dst in TREES:
        add_tree(zf, src, dst, stats)
        print("  已收：%s → %s" % (src, dst))
    for f in FILES:
        full = os.path.join(ROOT, f)
        if os.path.exists(full):
            zf.write(full, os.path.join(TOP, f))
            stats["n"] += 1
            stats["raw"] += os.path.getsize(full)

print("\n✅ 打包完成")
print("   文件数 %d　原始合计 %.1f MB" % (stats["n"], stats["raw"] / 1048576))
print("   zip 体积 %.1f MB" % (os.path.getsize(OUT) / 1048576))
print("   输出：%s" % OUT)
print("   耗时 %.1fs" % (time.time() - t0))
