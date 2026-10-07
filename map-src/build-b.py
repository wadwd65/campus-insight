import io, sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))

shell = io.open('shell-b.html', encoding='utf-8').read()
body  = io.open('sample-b-body.js', encoding='utf-8').read()

assert '/*BODY*/' in shell, 'shell-b.html 缺 /*BODY*/ 占位'
out = shell.replace('/*BODY*/', body)

io.open('sample-b.html', 'w', encoding='utf-8').write(out)
print('sample-b.html', len(out.encode('utf-8')), '字节')
