"""Archive only declared release files, then verify CRC and byte identity. Never archive env files."""
import hashlib
import json
from pathlib import Path
import re
import sys
import zipfile

source = Path(sys.argv[1]).resolve()
output = Path(sys.argv[2]).resolve()
if '--manifest' in sys.argv:
    manifest = json.loads((source / 'release-manifest.json').read_text(encoding='utf-8'))
    names = [item['path'] for item in manifest['files']] + ['package.json', '启动说明.md', 'release-manifest.json']
else:
    names = [item.relative_to(source).as_posix() for item in source.rglob('*') if item.is_file()]
names = sorted(set(names))
for name in names:
    target = (source / name).resolve()
    if not target.is_relative_to(source) or not target.is_file():
        raise RuntimeError('Invalid release path')
    if any(part.startswith('.env') and part != '.env.example' or part in ('node_modules', '.shots-before', '.campus-data') for part in Path(name).parts) or '.sqlite' in target.name or target.name == 'setup-key.txt':
        raise RuntimeError('Private file in release manifest')
    if target.suffix in ('.js', '.mjs', '.json', '.css', '.html') and re.search(rb'sk-[A-Za-z0-9_-]{20,}', target.read_bytes()):
        raise RuntimeError('Possible credential in release; contents redacted')
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in names:
        archive.write(source / name, name)
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    assert sorted(archive.namelist()) == names
    for name in names:
        assert archive.read(name) == (source / name).read_bytes(), name
record = {'file': output.name, 'files': len(names), 'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'crc': 'passed', 'byteIdentity': 'passed'}
output.with_suffix('.zip.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(record, ensure_ascii=False))
