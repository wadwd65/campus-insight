import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectBuildInputs, MAP_INPUTS } from './build-inputs.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const digest = value => createHash('sha256').update(value).digest('hex');
function filesIn(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? filesIn(path.join(directory, entry.name)) : entry.isFile() ? [path.join(directory, entry.name)] : []);
}
const inputs = collectBuildInputs(root);
let sourceCommit = null, sourceDirty = null;
try {
  sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  sourceDirty = Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=normal', '--', 'src', 'server', 'public', 'scripts', ...MAP_INPUTS, 'package.json', 'package-lock.json', 'vite.config.js', 'index.html'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
} catch { /* A source ZIP can be built without Git; its content hash remains available. */ }
const dist = path.join(root, 'dist');
const artifacts = [path.join(dist, 'index.html'), path.join(dist, 'map/校园地图-3D实景.html'), ...filesIn(path.join(dist, 'assets')).filter(file => /\.(?:js|css)$/.test(file))].sort().map(file => ({ path: '/' + path.relative(dist, file).split(path.sep).join('/'), sha256: digest(fs.readFileSync(file)), bytes: fs.statSync(file).size }));
const edition = JSON.parse(fs.readFileSync(path.join(root, 'public/build-edition.json'), 'utf8'));
const inputBytes = JSON.stringify(inputs, null, 2) + '\n';
fs.writeFileSync(path.join(dist, 'build-inputs.json'), inputBytes);
edition.build = { sourceCommit, sourceDirty, sourceSha256: inputs.sourceSha256, builtAt: new Date().toISOString(), inputsManifest: { path: '/build-inputs.json', sha256: digest(inputBytes), files: inputs.files.length }, artifacts };
fs.writeFileSync(path.join(dist, 'build-edition.json'), JSON.stringify(edition, null, 2) + '\n');
console.log(`Build identity: ${edition.edition}-${edition.version}; source ${edition.build.sourceSha256.slice(0, 12)}; ${artifacts.length} verified resource digests`);
