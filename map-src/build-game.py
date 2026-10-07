# -*- coding: utf-8 -*-
"""build-game.py —— 生成「晴川 · 一日行动」可玩原型 campus-game.html
   与 build-campus.py 的差别：外壳换成 shell-game.html（HUD），
   parts 末尾追加 tower-15-game.js（游戏层）。其余闸门完全一致。"""
import io, os, re, subprocess, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))

shell = io.open('shell-game.html', encoding='utf-8').read()
lib = io.open('three-packed.js', encoding='utf-8').read()

asm = io.open('tower-04-assembly.js', encoding='utf-8').read().split('\n')
def find_line(pat, src, what):
    for i, ln in enumerate(src):
        if re.match(pat, ln): return i
    print('!! 抽取失败：', what); sys.exit(1)
i0 = find_line(r'^function makeTower\b', asm, 'makeTower')
i1 = find_line(r'^var campus\s*=', asm, 'campus')
kit = '\n'.join(asm[i0:i1])
for need in ['function makeTower', 'function skyBridge']:
    assert need in kit
for forbid in ['var campus', 'scene.add(']:
    assert forbid not in kit
io.open('__towerkit.js', 'w', encoding='utf-8').write(kit)

parts = [
    'tower-01-core.js', 'tower-02-facade.js', 'tower-03-roof.js', '__towerkit.js',
    'tower-05-apartment.js', 'tower-07-prototypes.js', 'tower-09-apt-cluster.js',
    'tower-08-batch-main.js', 'tower-10-campus.js', 'tower-11-campus-terrain.js',
    'tower-12-campus-main.js', 'tower-14-look.js', 'tower-15-game.js',
]
NODE = r"C:/Users/123/.workbuddy/binaries/node/versions/22.22.2-6/node.exe"
for p in parts:
    src = io.open(p, encoding='utf-8').read()
    tmp = '__chk_' + os.path.basename(p)
    io.open(tmp, 'w', encoding='utf-8').write(src)
    r = subprocess.run([NODE, '--check', tmp], capture_output=True, text=True)
    if r.returncode != 0:
        print('!! 语法错 %s\n%s' % (p, r.stderr[:800])); sys.exit(1)
    os.remove(tmp)
print('语法预检 %d/%d 通过' % (len(parts), len(parts)))

decl = {}
pat = re.compile(r'^(?:var|function)\s+([A-Za-z_$][\w$]*)', re.M)
for p in parts:
    for m in pat.finditer(io.open(p, encoding='utf-8').read()):
        decl.setdefault(m.group(1), []).append(p)
dups = {k: v for k, v in decl.items() if len(v) > 1}
if dups:
    print('!! 顶层重名：', dups); sys.exit(2)
print('顶层重名 0 处')

body = '\n'.join(io.open(p, encoding='utf-8').read() for p in parts)
marker = '</body>'
assert marker in shell
out = shell.replace(marker, '<script>\n' + lib + '\n</script>\n<script>\n' + body + '\n</script>\n' + marker)
io.open('campus-game.html', 'w', encoding='utf-8').write(out)
print('campus-game.html %d 字节' % len(out.encode('utf-8')))
