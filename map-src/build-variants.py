# -*- coding: utf-8 -*-
"""铺装格尺寸的视觉 A/B：同一份源码、只换 CELL_M，产出多个 html 供截图对比。
不修改源文件（在内存里替换），跑完源文件保持原样。

用法: python build-variants.py 4.2 2.1 1.4
"""
import io, os, sys, re
os.chdir(os.path.dirname(os.path.abspath(__file__)))

shell = io.open('shell-a.html', encoding='utf-8').read()
lib = io.open('three-packed.js', encoding='utf-8').read()
parts = ['tower-01-core.js', 'tower-02-facade.js', 'tower-03-roof.js', 'tower-04-assembly.js']
body = '\n'.join(io.open(p, encoding='utf-8').read() for p in parts)

PAT = re.compile(r'(var CELL_M\s*=\s*)[0-9.]+(;\s*/\* 大分格边长)')
assert PAT.search(body), '找不到 CELL_M 声明，检查 tower-04-assembly.js'

marker = '</body>'
for v in sys.argv[1:]:
    b2 = PAT.sub(lambda m: m.group(1) + v + m.group(2), body, count=1)
    out = shell.replace(marker,
        '<script>\n' + lib + '\n</script>\n<script>\n' + b2 + '\n</script>\n' + marker)
    name = 'tower-cell%s.html' % v
    io.open(name, 'w', encoding='utf-8').write(out)
    print('%-26s %7d 字节' % (name, len(out.encode('utf-8'))))

# 复核源文件没被改动
now = '\n'.join(io.open(p, encoding='utf-8').read() for p in parts)
print('源文件 CELL_M =', re.search(r'var CELL_M\s*=\s*([0-9.]+);', now).group(1), '(应保持 2.1)')
