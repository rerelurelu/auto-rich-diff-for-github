import { describe, expect, test } from 'bun:test';
import { readdir } from 'node:fs/promises';

/**
 * _locales の中身は Chrome が読むだけで、コードからは文字列キーで引く。
 * キーの綴り違いや訳し忘れは実行時まで気づけないため、ここで突き合わせる。
 */

const root = new URL('../', import.meta.url);

/** @param {string} path */
const readJson = async (path) => await Bun.file(new URL(path, root)).json();

/** @param {string} path */
const readText = async (path) => await Bun.file(new URL(path, root)).text();

const locales = (await readdir(new URL('_locales/', root))).sort();
const manifest = await readJson('manifest.json');
const messagesByLocale = Object.fromEntries(
  await Promise.all(locales.map(async (locale) => [locale, await readJson(`_locales/${locale}/messages.json`)])),
);

const defaultLocale = manifest.default_locale;
const defaultKeys = Object.keys(messagesByLocale[defaultLocale]).sort();

describe('_locales', () => {
  test('manifest の default_locale がロケールとして存在する', () => {
    expect(locales).toContain(defaultLocale);
  });

  test.each(locales)('%s のキーが既定ロケールと一致する', (locale) => {
    expect(Object.keys(messagesByLocale[locale]).sort()).toEqual(defaultKeys);
  });

  test.each(locales)('%s の message が空でない', (locale) => {
    const empty = Object.entries(messagesByLocale[locale])
      .filter(([, entry]) => !entry.message?.trim())
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  test.each(locales)('%s に翻訳者向けの description がある', (locale) => {
    const missing = Object.entries(messagesByLocale[locale])
      .filter(([, entry]) => !entry.description?.trim())
      .map(([key]) => key);
    expect(missing).toEqual([]);
  });
});

describe('メッセージキーの参照', () => {
  test('manifest の __MSG_x__ がすべて定義されている', () => {
    const used = [...JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)].map((match) => match[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const key of used) expect(defaultKeys).toContain(key);
  });

  test('popup.html の data-i18n がすべて定義されている', async () => {
    const html = await readText('src/popup.html');
    const used = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((match) => match[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const key of used) expect(defaultKeys).toContain(key);
  });

  test('popup.js が渡す getMessage のキーがすべて定義されている', async () => {
    const js = await readText('src/popup.js');
    // showStatus('key') と showStatus('key', [...]) の両方からキーを拾う
    const used = [...js.matchAll(/showStatus\('([^']+)'/g)].map((match) => match[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const key of used) expect(defaultKeys).toContain(key);
  });

  test('describe が返すキーがすべて定義されている', async () => {
    const js = await readText('src/popup.js');
    const start = js.indexOf('const describe = ');
    const body = js.slice(start, js.indexOf('};', start));
    const used = [...body.matchAll(/return \['([^']+)'/g)].map((match) => match[1]);

    expect(used).toHaveLength(3);
    for (const key of used) expect(defaultKeys).toContain(key);
  });

  test('describeUnavailable が返すキーがすべて定義されている', async () => {
    const js = await readText('src/popup.js');
    const body = js.slice(js.indexOf('const describeUnavailable'), js.indexOf('/** ページ側の状態を読み'));
    const used = [...body.matchAll(/return '([^']+)'/g)].map((match) => match[1]);
    expect(used.length).toBe(3);
    for (const key of used) expect(defaultKeys).toContain(key);
  });
});
