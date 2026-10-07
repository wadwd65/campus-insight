# -*- coding: utf-8 -*-
"""拼装「公寓原型两版对比」单文件。
只取 01-core（基础/光照/相机/色板C）+ 03-roof（贴图函数）+ 02-facade（faceBox/aWindow）
+ 05-apartment（公寓工厂）+ 06-apt-main（两版场景），
**不取 04-assembly**（避免 campus 顶层重名）。
"""
import io, os, subprocess, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))

shell = io.open('shell-a.html', encoding='utf-8').read()
lib   = io.open('three-packed.js', encoding='utf-8').read()

parts = [
    'tower-01-core.js',
    'tower-02-facade.js',
    'tower-03-roof.js',
    'tower-05-apartment.js',
    'tower-06-apt-main.js',
]

# ── 语法预检：每个部件单独 node --check（先包一层，避免顶层 var 报错）──
NODE = r"C:\Users\123\.workbuddy\binaries\node\versions\22.22.2-3\node.exe"
ok = True
for p in parts:
    src = io.open(p, encoding='utf-8').read()
    tmp = '__chk_' + p
    io.open(tmp, 'w', encoding='utf-8').write(src)
    r = subprocess.run([NODE, '--check', tmp], capture_output=True, text=True)
    if r.returncode != 0:
        print('!! 语法错 %s\n%s' % (p, r.stderr[:800]))
        ok = False
    os.remove(tmp)
if not ok:
    print('语法预检未过，中止。')
    sys.exit(1)
print('语法预检 %d/%d 通过' % (len(parts), len(parts)))

# ── ★★★ v21 新增：色号 lint（防"0x6A5F48 写成 0x6A5F४8"这类静默错误）──
# 起因：v21 连续两次把色号误打成混入天城文数字的形式，肉眼在编辑器里看不出，
# JS 会解析成畸形值 ⇒ 颜色静默出错、且 node --check 照样通过。
import subprocess as _sp
_r = _sp.run([sys.executable, 'color-lint.py'] + parts, capture_output=True, text=True)
print(_r.stdout.strip())
if _r.returncode != 0:
    print('!! 色号 lint 未过，中止。')
    sys.exit(3)

# ── 顶层重名检查（记忆里的坑：顶层重名会静默覆盖）──
import re
decl = {}
pat = re.compile(r'^(?:var|function)\s+([A-Za-z_$][\w$]*)', re.M)
for p in parts:
    src = io.open(p, encoding='utf-8').read()
    for m in pat.finditer(src):
        nm = m.group(1)
        decl.setdefault(nm, []).append(p)
dups = {k: v for k, v in decl.items() if len(v) > 1}
if dups:
    print('!! 顶层重名 %d 处：' % len(dups))
    for k, v in dups.items():
        print('   %-16s %s' % (k, v))
    sys.exit(2)
print('顶层重名 0 处')

body = '\n'.join(io.open(p, encoding='utf-8').read() for p in parts)
marker = '</body>'
assert marker in shell, 'shell-a.html 缺 </body>'
out = shell.replace(marker,
    '<script>\n' + lib + '\n</script>\n<script>\n' + body + '\n</script>\n' + marker)
io.open('apt.html', 'w', encoding='utf-8').write(out)
print('apt.html %d 字节' % len(out.encode('utf-8')))
print('parts: ' + ', '.join(parts))
