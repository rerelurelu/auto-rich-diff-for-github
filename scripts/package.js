#!/usr/bin/env bun
/**
 * ストアに提出する ZIP を作る。
 *
 * 同梱するファイルは manifest.json からの参照を辿って決める。手で並べると、
 * ファイルを増やしたときに入れ忘れても気づけない。逆にテストや設定ファイルまで
 * 巻き込む事故も防げる。
 *
 * ZIP のルートに manifest.json が来る必要があるため、リポジトリルートで実行する。
 */

import { $ } from 'bun';
import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const OUT_DIR = 'dist';

/** @param {string} path */
const read = (path) => Bun.file(join(root, path));

/**
 * manifest.json から到達できるファイルを集める。
 * @returns {Promise<string[]>}
 */
const collectFiles = async () => {
  const manifest = await read('manifest.json').json();
  const files = new Set(['manifest.json']);

  for (const entry of manifest.content_scripts ?? []) {
    for (const path of entry.js ?? []) files.add(path);
    for (const path of entry.css ?? []) files.add(path);
  }

  for (const path of Object.values(manifest.icons ?? {})) files.add(String(path));
  for (const path of Object.values(manifest.action?.default_icon ?? {})) files.add(String(path));

  const popup = manifest.action?.default_popup;
  if (popup) {
    files.add(popup);

    // ポップアップの HTML が読み込むスクリプトとスタイルも同梱する
    const html = await read(popup).text();
    const referenced = [
      ...html.matchAll(/<script[^>]+src="([^"]+)"/g),
      ...html.matchAll(/<link[^>]+href="([^"]+)"/g),
    ];
    for (const [, src] of referenced) {
      if (src.startsWith('http')) continue;
      files.add(join(dirname(popup), src));
    }
  }

  if (manifest.default_locale) {
    for (const locale of await readdir(join(root, '_locales'))) {
      files.add(`_locales/${locale}/messages.json`);
    }
  }

  return [...files].sort();
};

const files = await collectFiles();

const missing = [];
for (const path of files) {
  if (!(await read(path).exists())) missing.push(path);
}
if (missing.length > 0) {
  console.error('manifest.json が参照しているファイルが見つからない:');
  for (const path of missing) console.error(`  ${path}`);
  process.exit(1);
}

const { version } = await read('manifest.json').json();
const zipPath = `${OUT_DIR}/auto-rich-diff-for-github-${version}.zip`;

await $`mkdir -p ${OUT_DIR}`.cwd(root);
await $`rm -f ${zipPath}`.cwd(root).nothrow();

// -X: macOS の拡張属性を入れない。入れると審査で不明なファイルとして扱われることがある
await $`zip -X -q ${zipPath} ${files}`.cwd(root);

const size = (await read(zipPath).size) / 1024;
console.log(`${zipPath}  (${size.toFixed(1)} KB)`);
for (const path of files) console.log(`  ${path}`);
