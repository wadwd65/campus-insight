# -*- coding: utf-8 -*-
"""拼装 40 栋批量场景 batch.html。

★ 与 build-tower.py / build-apt.py 的关键差别：
  `tower-04-assembly.js` 里**既有要复用的函数**（makeTower / skyBridge），
  **又有顶层会自己执行的校园装配**（`var campus = new THREE.Group()` 之后
  那一大段，会往场景里塞一整套实验楼）。
  整文件引进来 ⇒ 批次场景会被污染的旧校园覆盖。
  ⇒ 正解：**按函数边界抽取**——从 `function makeTower` 起、到 `var campus` 前止。

  ★ 抽取必须**自证**（本项目纪律：闸门不能依赖会漂移的常量）：
    断言① 抽出来的片段含 `function makeTower` 与 `function skyBridge`
    断言② 抽出来的片段**不含** `var campus` / `scene.add(`
    断言③ 抽取起止行都定位成功（否则直接中止，不用"猜一个范围"）
"""
import io, os, re, subprocess, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))

shell = io.open('shell-a.html', encoding='utf-8').read()
lib = io.open('three-packed.js', encoding='utf-8').read()

# ── ① 从 04-assembly 抽取「楼体套件」────────────────────────────────
asm = io.open('tower-04-assembly.js', encoding='utf-8').read().split('\n')

def find_line(pat, src, what):
    for i, ln in enumerate(src):
        if re.match(pat, ln):
            return i
    print('!! 抽取失败：找不到 %s（模式 %s）' % (what, pat))
    sys.exit(1)

i0 = find_line(r'^function makeTower\b', asm, 'makeTower 起点')
i1 = find_line(r'^var campus\s*=', asm, 'campus 起点（抽取终点）')
assert i1 > i0, '抽取范围反向（%d > %d）' % (i0, i1)
kit = '\n'.join(asm[i0:i1])

# 断言① 该有的在里面
for need in ['function makeTower', 'function skyBridge']:
    assert need in kit, '抽取片段缺少 %s' % need
# 断言② 不该有的不在里面（这是防"污染批次场景"的核心断言）
for forbid in ['var campus', 'scene.add(']:
    assert forbid not in kit, '抽取片段**不该**含 %r，但它含有 ⇒ 边界找错了' % forbid
    if forbid in kit:
        sys.exit(1)
print('抽取楼体套件：行 %d~%d（%d 行），含 makeTower + skyBridge，不含 campus ✓'
      % (i0 + 1, i1, i1 - i0))

io.open('__towerkit.js', 'w', encoding='utf-8').write(kit)

# ── ② 部件清单 ──────────────────────────────────────────────────────
parts = [
    'tower-01-core.js',
    'tower-02-facade.js',
    'tower-03-roof.js',
    '__towerkit.js',            # ← 抽取出来的 makeTower / skyBridge
    'tower-05-apartment.js',
    'tower-07-prototypes.js',
    'tower-09-apt-cluster.js',   # ← 学生公寓组团（L/U 形连体板楼 + 内院 + 连廊）
    'tower-08-batch-main.js',
]

NODE = r"C:\Users\123\.workbuddy\binaries\node\versions\22.22.2-3\node.exe"

# ── ③ 语法预检 ──────────────────────────────────────────────────────
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

# ── ④ 色号 lint（防"色号被非 ASCII 字符静默写坏"）──────────────────
_r = subprocess.run([sys.executable, 'color-lint.py'] + parts, capture_output=True, text=True)
print(_r.stdout.strip())
if _r.returncode != 0:
    print('!! 色号 lint 未过，中止。')
    sys.exit(3)

# ── ⑤ 顶层重名（本项目铁律：顶层重名会**静默覆盖**）────────────────
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
        print('   %-16s %s' % (k, v))
    sys.exit(2)
print('顶层重名 0 处')

# ── ⑥ 组装 ──────────────────────────────────────────────────────────
body = '\n'.join(io.open(p, encoding='utf-8').read() for p in parts)
marker = '</body>'
assert marker in shell, 'shell-a.html 缺 </body>'
out = shell.replace(marker,
    '<script>\n' + lib + '\n</script>\n<script>\n' + body + '\n</script>\n' + marker)
io.open('batch.html', 'w', encoding='utf-8').write(out)
print('batch.html %d 字节' % len(out.encode('utf-8')))
print('parts: ' + ', '.join(parts))
