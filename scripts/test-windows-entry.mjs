import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Optional extracted-package path lets release verification exercise the delivered bytes too.
const source = path.resolve(process.argv[2] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
for (const name of ['配置并启动.cmd', '启动网站.cmd']) {
  const bytes = fs.readFileSync(path.join(source, 'deploy', name));
  assert.ok(bytes.includes(Buffer.from('\r\n')), `${name}: missing CRLF`);
  assert.ok(!/(?<!\r)\n/.test(bytes.toString('utf8')), `${name}: bare LF`);
}
if (process.platform !== 'win32') {
  console.log('Windows entry line endings verified; real cmd.exe execution skipped on this platform.');
  process.exit(0);
}
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'campus-cmd-entry-'));
const root = path.join(temporary, '新用户部署 (有空格)');
const files = ['deploy/配置并启动.cmd', 'scripts/configure-deployment.mjs', 'server/deployment-config.mjs', 'server/config.mjs', 'server/data-path.mjs'];
for (const name of files) { const output = path.join(root, name); fs.mkdirSync(path.dirname(output), { recursive: true }); fs.copyFileSync(path.join(source, name), output); }
try {
  const child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `""${path.join(root, 'deploy/配置并启动.cmd')}""`], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, windowsVerbatimArguments: true });
  const answers = ['1', 'Launcher test', '1', '5195', '.campus-data', '1', 'NO'];
  let index = 0, output = '';
  const timer = setTimeout(() => child.kill(), 15000);
  child.stdout.on('data', bytes => {
    const text = bytes.toString('utf8'); output += text;
    if (text.endsWith('：') && index < answers.length) {
      child.stdin.write(answers[index++] + '\r\n');
      if (index === answers.length) child.stdin.end('\r\n');
    }
  });
  child.stderr.on('data', bytes => { output += bytes.toString('utf8'); });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  clearTimeout(timer);
  assert.equal(index, 7, output);
  assert.equal(code, 0, output);
  assert.ok(!output.includes('not recognized as an internal or external command'), output);
  assert.ok(!fs.existsSync(path.join(root, '.env.local')), 'Cancel must leave no configuration.');
  console.log('Windows real batch launcher: Chinese/spaced path → 7 prompts → cancel without changes passed.');
} finally {
  const relative = path.relative(os.tmpdir(), temporary);
  if (!relative.startsWith('campus-cmd-entry-') || relative.includes(path.sep)) throw new Error('Unexpected temporary path');
  fs.rmSync(temporary, { recursive: true });
}
