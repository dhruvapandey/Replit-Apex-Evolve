import { createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { ZipArchive } from 'archiver';

const target = process.argv[2];
const configurations = {
  itch: {
    source: 'dist-itch',
    output: 'release/itch/apex-evolve-beta.zip',
    maxFiles: 1000,
    maxBytes: 500 * 1024 * 1024,
  },
  crazygames: {
    source: 'dist-crazygames',
    output: 'release/crazygames/apex-evolve-crazygames.zip',
    maxFiles: 1500,
    maxBytes: 250 * 1024 * 1024,
  },
};

const configuration = configurations[target];
if (!configuration) {
  throw new Error('Usage: node scripts/package-web-release.mjs <itch|crazygames>');
}

async function inventory(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...await inventory(absolute));
    else results.push({ absolute, size: (await stat(absolute)).size });
  }
  return results;
}

const indexPath = path.join(configuration.source, 'index.html');
const indexHtml = await readFile(indexPath, 'utf8');
if (/(?:src|href)="\/(?!\/)/.test(indexHtml)) {
  throw new Error(`${target} build contains absolute asset paths`);
}

const files = await inventory(configuration.source);
const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
if (files.length > configuration.maxFiles) {
  throw new Error(`${target} build exceeds ${configuration.maxFiles} files`);
}
if (totalBytes > configuration.maxBytes) {
  throw new Error(`${target} build exceeds ${configuration.maxBytes} bytes`);
}

await mkdir(path.dirname(configuration.output), { recursive: true });
await new Promise((resolve, reject) => {
  const output = createWriteStream(configuration.output);
  const archive = new ZipArchive({ zlib: { level: 9 } });
  output.on('close', resolve);
  output.on('error', reject);
  archive.on('error', reject);
  archive.pipe(output);
  archive.directory(configuration.source, false);
  void archive.finalize();
});

console.log(JSON.stringify({
  target,
  artifact: configuration.output,
  files: files.length,
  uncompressedBytes: totalBytes,
}, null, 2));
