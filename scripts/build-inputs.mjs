import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const MAP_INPUTS = ['map-src/web', 'map-src/campus-layout.json', 'map-src/building-reference.json', 'map-src/three-packed.js'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function filesIn(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? filesIn(path.join(directory, entry.name)) : entry.isFile() ? [path.join(directory, entry.name)] : []);
}

/** Preserve the v53.1 hash algorithm; expose its exact inputs for comparison. */
export function collectBuildInputs(root) {
  const sourceFiles = ['src', 'server', 'public', 'scripts', 'map-src/web'].flatMap(directory => filesIn(path.join(root, directory)));
  for (const input of MAP_INPUTS.slice(1)) sourceFiles.push(path.join(root, input));
  for (const name of ['package.json', 'package-lock.json', 'vite.config.js', 'index.html']) sourceFiles.push(path.join(root, name));
  const relative = file => path.relative(root, file).split(path.sep).join('/');
  sourceFiles.sort((a, b) => relative(a) < relative(b) ? -1 : relative(a) > relative(b) ? 1 : 0);
  const hash = createHash('sha256');
  const files = sourceFiles.map(file => {
    const name = relative(file), raw = fs.readFileSync(file);
    const bytes = /\.(?:jsx?|mjs|cjs|json|css|html|svg|csv|md)$/.test(file) ? Buffer.from(raw.toString('utf8').replace(/\r\n/g, '\n')) : raw;
    hash.update(name).update('\0').update(bytes).update('\0');
    return { path: name, bytes: bytes.length, sha256: digest(bytes) };
  });
  return { algorithm: 'campus-source-v1', sourceSha256: hash.digest('hex'), files };
}

export function compareBuildInputs(expected, actual) {
  function entries(manifest) {
    if (manifest?.algorithm !== 'campus-source-v1' || !Array.isArray(manifest.files) || manifest.files.length > 20000) throw new Error('构建输入清单格式无效');
    const map = new Map();
    for (const file of manifest.files) {
      if (typeof file.path !== 'string' || !/^[^\\:\x00-\x1f]+$/.test(file.path) || file.path.startsWith('/') || file.path.split('/').some(part => !part || part === '.' || part === '..') || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || map.has(file.path)) throw new Error('构建输入清单含无效或重复文件');
      map.set(file.path, file);
    }
    return map;
  }
  const left = entries(expected), right = entries(actual);
  return {
    missing: [...left.keys()].filter(name => !right.has(name)).sort(),
    extra: [...right.keys()].filter(name => !left.has(name)).sort(),
    changed: [...left.keys()].filter(name => right.has(name) && (left.get(name).sha256 !== right.get(name).sha256 || left.get(name).bytes !== right.get(name).bytes)).sort(),
  };
}
