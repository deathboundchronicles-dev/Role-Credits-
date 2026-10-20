import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
let html = (await readFile(resolve(root, 'index.html'), 'utf8')).replace(/\r\n/g, '\n');
for (const [name, files, wrapper] of [
  ['runtime', ['app/stable-ui.js', 'app/homebrew.js'], 'script'],
  ['library-style', ['app/homebrew.css'], 'style'],
  ['library-ui', ['app/homebrew-ui.js'], '']
]) {
  const start = `<!-- rc:${name}:start -->`, end = `<!-- rc:${name}:end -->`;
  const scriptStart = `/* rc:${name}:start */`, scriptEnd = `/* rc:${name}:end */`;
  const opening = wrapper ? start : scriptStart, closing = wrapper ? end : scriptEnd;
  const contents = (await Promise.all(files.map(file => readFile(resolve(root, file), 'utf8')))).join('\n');
  const replacement = `${opening}\n${wrapper ? `<${wrapper}>\n` : ''}${contents}\n${wrapper ? `</${wrapper}>\n` : ''}${closing}`;
  const first = html.indexOf(opening), last = html.indexOf(closing, first);
  if (first < 0 || last < 0) throw new Error(`Missing ${name} bundle markers in canonical index.html`);
  html = html.slice(0, first) + replacement + html.slice(last + closing.length);
}
for (const file of ['index.html', 'Role_Credits_Studio_Standalone.html', 'android/app/src/main/assets/index.html']) {
  const path = resolve(root, file);
  const current = await readFile(path, 'utf8').catch(() => '');
  if (check && current !== html) throw new Error(`${file} is out of sync. Run node scripts/sync-app.mjs`);
  if (!check && current !== html) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, html); }
}
console.log(check ? 'Canonical, Windows, and Android HTML match the source modules.' : 'Synchronized canonical, Windows, and Android HTML.');
