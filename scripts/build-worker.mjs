import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, sep } from 'node:path';

const output = 'dist/client';
// Manifest IDs resolve against the origin, even when the manifest lives under a project path.
const manifestPath = join(output, 'manifest.webmanifest');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.id = process.env.VITE_BASE_PATH || '/';
manifest.related_applications[0].id = manifest.id;
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

const files = (await readdir(output, { recursive: true, withFileTypes: true }))
  .filter(entry => entry.isFile() && !['og.png', 'sw.js'].includes(entry.name))
  .map(entry => join(entry.parentPath, entry.name).slice(output.length + 1).split(sep).join('/'))
  .sort();
const template = await readFile(new URL('./worker.js', import.meta.url), 'utf8');
const hash = createHash('sha256').update(template);
for (const file of files) hash.update(file).update(await readFile(join(output, file)));
const urls = files.map(file => file === 'index.html' ? './' : './' + file);
await writeFile(join(output, 'sw.js'), template
  .replace('__REVISION__', hash.digest('hex').slice(0, 16))
  .replace('__FILES__', JSON.stringify(urls)));
