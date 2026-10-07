# -*- coding: utf-8 -*-
"""拼装 v12「构造级」实验楼：干净壳 + three.js + 四个部件文件"""
import io, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))

shell = io.open('shell-a.html', encoding='utf-8').read()
lib   = io.open('three-packed.js', encoding='utf-8').read()

parts = ['tower-01-core.js', 'tower-02-facade.js', 'tower-03-roof.js', 'tower-04-assembly.js']
body = '\n'.join(io.open(p, encoding='utf-8').read() for p in parts)

marker = '</body>'
assert marker in shell, 'shell-a.html 缺 </body>'
assert 'THREE' in lib, 'three 库异常'

# 语法预检：每个部件单独 node --check
out = shell.replace(marker,
    '<script>\n' + lib + '\n</script>\n<script>\n' + body + '\n</script>\n' + marker)
io.open('tower.html', 'w', encoding='utf-8').write(out)

print('tower.html %d 字节' % len(out.encode('utf-8')))
print('parts: ' + ', '.join(parts))
