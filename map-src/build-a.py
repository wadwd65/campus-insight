# -*- coding: utf-8 -*-
"""拼装样张 A：干净壳 + three.js + body"""
shell = open('shell-a.html', encoding='utf-8').read()
lib = open('three-packed.js', encoding='utf-8').read()
body = open('sample-a-body.js', encoding='utf-8').read()

marker = '</body>'
assert marker in shell
out = shell.replace(marker,
    '<script>\n' + lib + '\n</script>\n<script>\n' + body + '\n</script>\n' + marker)
open('sample-a.html', 'w', encoding='utf-8').write(out)
print('sample-a.html %d 字节' % len(out))
