# -*- coding: utf-8 -*-
"""拼装「完整校园地图」campus.html。

与 build-batch.py 的差别：
  · 多引入三层：tower-10（平面图数据）/ tower-11（地形层）/ tower-12（装配层）
  · **没有逐栋取景** —— 整个校园同屏，相机是透视相机（见 tower-12）
  · 其余四道闸门完全一致（抽取自证 / 语法 / 色号 lint / 顶层重名）
"""
import io, os, re, subprocess, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))

shell = io.open('shell-a.html', encoding='utf-8').read()
lib = io.open('three-packed.js', encoding='utf-8').read()

# ── ① 从 04-assembly 抽取「楼体套件」（与 build-batch 同一套自证断言）──
asm = io.open('tower-04-assembly.js', encoding='utf-8').read().split('\n')

def find_line(pat, src, what):
    for i, ln in enumerate(src):
        if re.match(pat, ln):
            return i
    print('!! 抽取失败：找不到 %s（模式 %s）' % (what, pat))
    sys.exit(1)

i0 = find_line(r'^function makeTower\b', asm, 'makeTower 起点')
i1 = find_line(r'^var campus\s*=', asm, 'campus 起点（抽取终点）')
assert i1 > i0, '抽取范围反向'
kit = '\n'.join(asm[i0:i1])
for need in ['function makeTower', 'function skyBridge']:
    assert need in kit, '抽取片段缺少 %s' % need
for forbid in ['var campus', 'scene.add(']:
    assert forbid not in kit, '抽取片段不该含 %r ⇒ 边界找错了' % forbid
print('抽取楼体套件：行 %d~%d（%d 行）✓' % (i0 + 1, i1, i1 - i0))
io.open('__towerkit.js', 'w', encoding='utf-8').write(kit)

# ── ② 部件清单 ────────────────────────────────────────────────────
parts = [
    'tower-01-core.js',
    'tower-02-facade.js',
    'tower-03-roof.js',
    '__towerkit.js',
    'tower-05-apartment.js',
    'tower-07-prototypes.js',
    'tower-09-apt-cluster.js',
    'tower-08-batch-main.js',       # 提供 BAT_DEFS / PAL / batWithAptPal / 渲染循环
    'tower-10-campus.js',           # 平面图读数 + 换算 + 摆放表
    'tower-11-campus-terrain.js',   # 地面 / 湖 / 田径场 / 道路
    'tower-12-campus-main.js',      # 绿化 / 建筑摆放 / 天空 / 相机
    'tower-14-look.js',             # 现代观感层（ACES / 光照 / 雾 / 天空 / 暗角）
]
# ★ 10-07：tower-13（KayKit 真人资产层）与 tower-14（ACES 观感层）已从 parts 移除。
#   用户裁决：KayKit 楼"忒丑"，回到程序化版本；保留 tower-11 的湖镜像修复等真 bug 修复。
#   两个文件保留在磁盘上，需要时一行即可恢复。
LEGACY_PARTS = ['tower-13-loader.js', 'tower-13-assets.js', 'tower-13-realart.js', 'tower-14-look.js']
# 纯数据文件：base64 里会出现"0x+字母"假命中，色号 lint 跳过
LINT_SKIP = {'tower-13-assets.js'}

NODE = r"C:\Users\123\.workbuddy\binaries\node\versions\22.22.2-6\node.exe"

# ── ③ 语法预检 ────────────────────────────────────────────────────
ok = True
for p in parts:
    src = io.open(p, encoding='utf-8').read()
    tmp = '__chk_' + os.path.basename(p)
    io.open(tmp, 'w', encoding='utf-8').write(src)
    r = subprocess.run([NODE, '--check', tmp], capture_output=True, text=True)
    if r.returncode != 0:
        print('!! 语法错 %s\n%s' % (p, r.stderr[:900]))
        ok = False
    os.remove(tmp)
if not ok:
    print('语法预检未过，中止。')
    sys.exit(1)
print('语法预检 %d/%d 通过' % (len(parts), len(parts)))

# ── ④ 色号 lint ───────────────────────────────────────────────────
_r = subprocess.run([sys.executable, 'color-lint.py'] + [p for p in parts if p not in LINT_SKIP], capture_output=True, text=True)
print(_r.stdout.strip())
if _r.returncode != 0:
    print('!! 色号 lint 未过，中止。')
    sys.exit(3)

# ── ⑤ 顶层重名 ───────────────────────────────────────────────────
decl = {}
pat = re.compile(r'^(?:var|function)\s+([A-Za-z_$][\w$]*)', re.M)
for p in parts:
    src = io.open(p, encoding='utf-8').read()
    for m in pat.finditer(src):
        decl.setdefault(m.group(1), []).append(p)
dups = {k: v for k, v in decl.items() if len(v) > 1}
if dups:
    print('!! 顶层重名 %d 处：' % len(dups))
    for k, v in dups.items():
        print('   %-18s %s' % (k, v))
    sys.exit(2)
print('顶层重名 0 处')

# ── ⑤-b 局部变量遮蔽（10-06 新增）────────────────────────────────
# 事故：campGround() 里 `var cu = ..., cv = rnd(...)` 把外层的 canvas 对象
# 覆盖成一个数字 ⇒ map.image 是 Number ⇒ 贴图上传失败 ⇒ 整张地面全黑。
# 顶层重名闸门抓不到这一类（都在函数内部），必须单独扫：
#   在同一个函数体内，某标识符既被"声明为对象类"（canvas/ctx/texture…），
#   又被"二次 var 声明且初值是 rnd()/数字表达式"。
import collections
SHADOW_PAT = re.compile(
    r'var\s+([A-Za-z_$][\w$]*)\s*=\s*(?:document\.createElement|new\s+THREE\.|[A-Za-z_$][\w$]*\.getContext)')
REASSIGN_PAT = re.compile(r'var\s+([A-Za-z_$][\w$]*)\s*=\s*(?:rnd\s*\(|Math\.|[\d.]+\s*;|\d+\s*$)')
bad_shadow = collections.defaultdict(list)
for p in parts:
    src = io.open(p, encoding='utf-8').read()
    # 按函数粗切：以 "function xxx(" 到下一个顶层 function/var 之前
    chunks = re.split(r'\nfunction\s+[A-Za-z_$][\w$]*\s*\(', src)
    for ci, ch in enumerate(chunks[1:], 1):
        # 只把"确为对象/上下文类"的声明当锚点，排除单字母循环变量
        objs = set(n for n in SHADOW_PAT.findall(ch) if len(n) >= 3)
        if not objs:
            continue
        for m in REASSIGN_PAT.finditer(ch):
            name = m.group(1)
            if name in objs:
                bad_shadow[name].append('%s (第%d个函数块)' % (p, ci))
if bad_shadow:
    print('!! 局部变量遮蔽 %d 处（会静默毁掉贴图/上下文）:' % len(bad_shadow))
    for k, v in sorted(bad_shadow.items()):
        print('   %-14s %s' % (k, v))
    sys.exit(4)
print('局部变量遮蔽 0 处')

# ── ⑤-c ASI 静默失效（10-06 新增）────────────────────────────────
# 事故：批量重写 `CAMP_STAGE.add(city())` → `(function(g){...})(city())` 时
# 漏掉了行尾分号。**JS 靠 ASI 补救**，于是下一行被解析成
# `(...)  (function(g){...})` 的函数调用 ⇒ 运行时 TypeError，
# 而 node --check **查不出来**（语法仍合法）。
# 判据：形如 `})(xxx())` 开头、且去掉行尾注释后不以 `;` 结尾的行。
asi_bad = []
for p in parts:
    for ln, line in enumerate(io.open(p, encoding='utf-8').read().split('\n'), 1):
        code = line.split('//')[0].rstrip()
        if code.endswith('/*') or not code.strip():
            continue
        if re.search(r'\}\)\s*\([^()]*\(\)\)\s*$', code) and not code.endswith(';'):
            asi_bad.append('%s:%d  %s' % (p, ln, code.strip()[:60]))
if asi_bad:
    print('!! ASI 隐患 %d 处（缺分号，JS 会把下一行当成函数调用）:' % len(asi_bad))
    for x in asi_bad:
        print('   ' + x)
    sys.exit(5)
print('ASI 隐患 0 处')

# ── ⑤-d 同一对象的坐标必须单一真源（10-06 新增）────────────────────
# 事故 1：田径场有**三份坐标** —— CAMP_TRACK(px,py) / CAMP_PLACE 的 track 记录 /
#   BAT_DEFS 里 makeCourtField(108, 66)。改 CAMP_TRACK 完全不生效（探针实测中心仍在 100,66）。
# 事故 2：campAptLinks 硬编码 `['apt-c2', 37, 64]`，而建筑已被推到 px47/py62
#   ⇒ 连廊落在 x36.4/y63.9~90.1，与公寓（y55.9~152.5）完全错位，读作"凭空一段墙"。
# 判据：① CAMP_PLACE 里不得再出现由别处已渲染的对象（track）；
#       ② 依赖建筑落位的构件必须用 Box3 实测，禁止硬编码坐标字面量。
src_all = '\n'.join(io.open(p, encoding='utf-8').read() for p in parts)
single_src = []
if re.search(r"\{ id: 'track'", src_all):
    single_src.append("CAMP_PLACE 仍含 track 记录（campTrack 已渲染它 ⇒ 重复且坐标打架）")
for p in parts:
    src = io.open(p, encoding='utf-8').read()
    if 'campAptLinks' in src:
        # 只扫**代码行**：剔除块注释与行注释后再匹配，避免命中注释里的示例文本
        code = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
        code = re.sub(r'//.*$', '', code, flags=re.M)
        if re.search(r"\['apt-c\d',\s*-?\d", code):
            single_src.append('%s 里 campAptLinks 仍硬编码公寓坐标（应改为 Box3 实测）' % p)
if single_src:
    print('!! 坐标多真源 %d 处:' % len(single_src))
    for x in single_src:
        print('   ' + x)
    sys.exit(6)
print('坐标多真源 0 处')



# ── ⑥ 组装 ────────────────────────────────────────────────────────
body = '\n'.join(io.open(p, encoding='utf-8').read() for p in parts)
marker = '</body>'
assert marker in shell, 'shell-a.html 缺 </body>'
out = shell.replace(marker,
    '<script>\n' + lib + '\n</script>\n<script>\n' + body + '\n</script>\n' + marker)
out = out.replace('<title>', '<title>完整校园 · ', 1)
io.open('campus.html', 'w', encoding='utf-8').write(out)
print('campus.html %d 字节' % len(out.encode('utf-8')))
print('parts: %d 个' % len(parts))
