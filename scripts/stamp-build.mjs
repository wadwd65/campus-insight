import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const digest = value => createHash('sha256').update(value).digest('hex');
function filesIn(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? filesIn(path.join(directory, entry.name)) : entry.isFile() ? [path.join(directory, entry.name)] : []);
}
const mapInputs = ['map-src/web', 'map-src/campus-layout.json', 'map-src/building-reference.json', 'map-src/three-packed.js'];
const sourceFiles = ['src', 'server', 'public', 'scripts', 'map-src/web'].flatMap(directory => filesIn(path.join(root, directory)));
for (const input of mapInputs.slice(1)) sourceFiles.push(path.join(root, input));
for (const name of ['package.json', 'package-lock.json', 'vite.config.js', 'index.html']) sourceFiles.push(path.join(root, name));
const sourceHash = createHash('sha256');
const relativeName = file => path.relative(root, file).split(path.sep).join('/');
for (const file of sourceFiles.sort((a, b) => relativeName(a) < relativeName(b) ? -1 : relativeName(a) > relativeName(b) ? 1 : 0)) {
  sourceHash.update(relativeName(file)).update('\0');
  const bytes = fs.readFileSync(file);
  sourceHash.update(/\.(?:jsx?|mjs|cjs|json|css|html|svg|csv|md)$/.test(file) ? bytes.toString('utf8').replace(/\r\n/g, '\n') : bytes).update('\0');
}
let sourceCommit = null, sourceDirty = null;
try {
  sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  sourceDirty = Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=normal', '--', 'src', 'server', 'public', 'scripts', ...mapInputs, 'package.json', 'package-lock.json', 'vite.config.js', 'index.html'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
} catch { /* A source ZIP can be built without Git; its content hash remains available. */ }
const dist = path.join(root, 'dist');
const artifacts = [path.join(dist, 'index.html'), path.join(dist, 'map/校园地图-3D实景.html'), ...filesIn(path.join(dist, 'assets')).filter(file => /\.(?:js|css)$/.test(file))].sort().map(file => ({ path: '/' + path.relative(dist, file).split(path.sep).join('/'), sha256: digest(fs.readFileSync(file)), bytes: fs.statSync(file).size }));
const edition = JSON.parse(fs.readFileSync(path.join(root, 'public/build-edition.json'), 'utf8'));
edition.build = { sourceCommit, sourceDirty, sourceSha256: sourceHash.digest('hex'), builtAt: new Date().toISOString(), artifacts };
fs.writeFileSync(path.join(dist, 'build-edition.json'), JSON.stringify(edition, null, 2) + '\n');
console.log(`Build identity: ${edition.edition}-${edition.version}; source ${edition.build.sourceSha256.slice(0, 12)}; ${artifacts.length} verified resource digests`);
