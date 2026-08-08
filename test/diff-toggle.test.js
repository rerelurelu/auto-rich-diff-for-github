import { describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';

// content_scripts に指定する JS は export を書けないため、diff-toggle.js は
// globalThis.autoRichDiff に API を置く。ここでは import の副作用として受け取る。
import '../src/diff-toggle.js';

const { applyMode, countModes, filePathOf, isDiffPagePath, labelOf, stripBidiMarks } = autoRichDiff;

/** GitHub がファイル名の前後に入れる左横書き制御文字 (U+200E)。 */
const LRM = '‎';

/**
 * 新 UI の 1 ファイル分。rich と source が別ボタンで、ラベルは aria-labelledby の参照先にある。
 * クラス名のハッシュ部分は実物と同じ形にしてある。
 * @param {string} path
 * @param {boolean} showingRich いま rich diff を表示しているか
 * @param {string} [body] 差分本文に入れる HTML
 * @returns {string}
 */
const newUiFile = (path, showingRich, body = '') => {
  const id = `diff-${path.replace(/\W/g, '')}`;
  return `
    <div id="${id}">
      <div class="Diff-module__diffHeaderWrapper__UgUyv">
        <div class="DiffFileHeader-module__diff-file-header__UuNN4">
          <a href="#${id}">${LRM}${path}${LRM}</a>
          <ul>
            <li><button data-name="${path}:source" aria-pressed="${!showingRich}" aria-labelledby="${id}-src"></button></li>
            <li><button data-name="${path}:rich" aria-pressed="${showingRich}" aria-labelledby="${id}-rich"></button></li>
          </ul>
        </div>
      </div>
      <div class="markdown-body">${body}</div>
    </div>
    <span id="${id}-src" hidden>Display the source diff</span>
    <span id="${id}-rich" hidden>Display the rich diff</span>
  `;
};

/**
 * 旧 UI の 1 ファイル分。1 つのボタンが交互に切り替わり、aria-pressed は持たない。
 * @param {string} path
 * @param {boolean} showingRich
 * @param {string} [body] 差分本文に入れる HTML
 * @returns {string}
 */
const oldUiFile = (path, showingRich, body = '') => `
  <div class="file" data-tagsearch-path="${path}">
    <div class="file-header">
      <a data-name="${path}:toggle"
         aria-label="${showingRich ? 'Display the source diff' : 'Display the rich diff'}"></a>
    </div>
    <div class="js-file-content">${body}</div>
  </div>
`;

/**
 * @param {string} html
 * @returns {{ doc: Document, clicked: string[] }} clicked にはクリックされた要素の data-name が入る
 */
const render = (html) => {
  const window = new Window({ url: 'https://github.com/owner/repo/pull/1/changes' });
  window.document.body.innerHTML = html;
  const doc = /** @type {Document} */ (/** @type {unknown} */ (window.document));

  /** @type {string[]} */
  const clicked = [];
  for (const element of doc.querySelectorAll('[data-name]')) {
    element.addEventListener('click', () => clicked.push(element.getAttribute('data-name') ?? ''));
  }
  return { doc, clicked };
};

describe('stripBidiMarks', () => {
  test('ファイル名を囲む制御文字を取り除く', () => {
    expect(stripBidiMarks(`${LRM}docs/README.md${LRM}`)).toBe('docs/README.md');
  });

  test('null と undefined は空文字にする', () => {
    expect(stripBidiMarks(null)).toBe('');
    expect(stripBidiMarks(undefined)).toBe('');
  });
});

describe('labelOf', () => {
  test('aria-labelledby の参照先からラベルを読む', () => {
    const { doc } = render(newUiFile('README.md', false));
    const button = /** @type {HTMLElement} */ (doc.querySelector('[data-name="README.md:rich"]'));
    expect(labelOf(button)).toBe('Display the rich diff');
  });

  test('aria-label があればそちらを使う', () => {
    const { doc } = render(oldUiFile('README.md', false));
    const button = /** @type {HTMLElement} */ (doc.querySelector('[data-name="README.md:toggle"]'));
    expect(labelOf(button)).toBe('Display the rich diff');
  });
});

describe('filePathOf', () => {
  test('新 UI ではファイル名リンクから取り、制御文字を落とす', () => {
    const { doc } = render(newUiFile('docs/guide.mdx', false));
    const button = /** @type {HTMLElement} */ (doc.querySelector('[data-name="docs/guide.mdx:rich"]'));
    expect(filePathOf(button)).toBe('docs/guide.mdx');
  });

  test('旧 UI では data-tagsearch-path から取る', () => {
    const { doc } = render(oldUiFile('docs/guide.md', false));
    const button = /** @type {HTMLElement} */ (doc.querySelector('[data-name="docs/guide.md:toggle"]'));
    expect(filePathOf(button)).toBe('docs/guide.md');
  });

  test('差分の外にある要素では null を返す', () => {
    const { doc } = render('<button data-name="stray"></button>');
    const button = /** @type {HTMLElement} */ (doc.querySelector('[data-name="stray"]'));
    expect(filePathOf(button)).toBeNull();
  });
});

describe('applyMode (新 UI)', () => {
  test('source 表示の Markdown を rich に切り替える', () => {
    const { doc, clicked } = render(newUiFile('README.md', false));
    expect(applyMode(doc, 'rich')).toEqual({ switched: 1, markdownFiles: 1, rich: 1, source: 0 });
    expect(clicked).toEqual(['README.md:rich']);
  });

  test('既に rich のときは押さない', () => {
    const { doc, clicked } = render(newUiFile('README.md', true));
    expect(applyMode(doc, 'rich')).toEqual({ switched: 0, markdownFiles: 1, rich: 1, source: 0 });
    expect(clicked).toEqual([]);
  });

  test('rich 表示の Markdown を source に戻す', () => {
    const { doc, clicked } = render(newUiFile('README.md', true));
    expect(applyMode(doc, 'source')).toEqual({ switched: 1, markdownFiles: 1, rich: 0, source: 1 });
    expect(clicked).toEqual(['README.md:source']);
  });

  test('Markdown 以外は rich diff ボタンがあっても触らない', () => {
    const { doc, clicked } = render(
      newUiFile('package.json', false) + newUiFile('.github/workflows/ci.yml', false) + newUiFile('README.md', false),
    );
    expect(applyMode(doc, 'rich')).toEqual({ switched: 1, markdownFiles: 1, rich: 1, source: 0 });
    expect(clicked).toEqual(['README.md:rich']);
  });

  test('.md .mdx .markdown をすべて対象にする', () => {
    const { doc, clicked } = render(
      newUiFile('a.md', false) + newUiFile('b.mdx', false) + newUiFile('c.markdown', false),
    );
    expect(applyMode(doc, 'rich')).toEqual({ switched: 3, markdownFiles: 3, rich: 3, source: 0 });
    expect(clicked).toEqual(['a.md:rich', 'b.mdx:rich', 'c.markdown:rich']);
  });
});

describe('applyMode (旧 UI)', () => {
  test('aria-pressed がなくてもラベルだけで切り替えられる', () => {
    const { doc, clicked } = render(oldUiFile('README.md', false));
    expect(applyMode(doc, 'rich')).toEqual({ switched: 1, markdownFiles: 1, rich: 1, source: 0 });
    expect(clicked).toEqual(['README.md:toggle']);
  });

  test('既に rich ならボタンのラベルが source 側なので押さない', () => {
    const { doc, clicked } = render(oldUiFile('README.md', true));
    expect(applyMode(doc, 'rich')).toEqual({ switched: 0, markdownFiles: 0, rich: 0, source: 0 });
    expect(clicked).toEqual([]);
  });
});

describe('差分本文に仕込まれた要素', () => {
  // GitHub の Markdown サニタイザは a 要素の title 属性を通すため、
  // 本文まで探索するとプルリクエストの作成者が用意したリンクを押してしまう。
  const injected = '<a data-name="injected" title="Display the rich diff" href="https://example.com/"></a>';

  test('新 UI では押さないし数にも入れない', () => {
    const { doc, clicked } = render(newUiFile('README.md', false, injected));
    expect(applyMode(doc, 'rich')).toEqual({ switched: 1, markdownFiles: 1, rich: 1, source: 0 });
    expect(clicked).toEqual(['README.md:rich']);
    expect(countModes(doc)).toEqual({ rich: 0, source: 1 });
  });

  test('旧 UI でも押さない', () => {
    const { doc, clicked } = render(oldUiFile('README.md', false, injected));
    expect(applyMode(doc, 'rich')).toEqual({ switched: 1, markdownFiles: 1, rich: 1, source: 0 });
    expect(clicked).toEqual(['README.md:toggle']);
  });

  test('ヘッダーの外にある切り替えボタンは見つけない', () => {
    const { doc, clicked } = render(`
      <div class="file" data-tagsearch-path="README.md">
        <a data-name="outside" aria-label="Display the rich diff"></a>
      </div>
    `);
    expect(applyMode(doc, 'rich')).toEqual({ switched: 0, markdownFiles: 0, rich: 0, source: 0 });
    expect(clicked).toEqual([]);
  });
});

describe('applyMode の alreadyApplied', () => {
  test('渡したボタンは 2 回目以降スキップする', () => {
    const { doc, clicked } = render(newUiFile('README.md', false));
    /** @type {WeakSet<HTMLElement>} */
    const alreadyApplied = new WeakSet();

    expect(applyMode(doc, 'rich', { alreadyApplied })).toEqual({ switched: 1, markdownFiles: 1, rich: 1, source: 0 });
    // GitHub 側の再描画を待たずに再実行しても、二重にクリックしない
    expect(applyMode(doc, 'rich', { alreadyApplied })).toEqual({ switched: 0, markdownFiles: 1, rich: 1, source: 0 });
    expect(clicked).toEqual(['README.md:rich']);
  });

  test('渡さなければ状態だけで判断する', () => {
    const { doc, clicked } = render(newUiFile('README.md', false));
    applyMode(doc, 'rich');
    // aria-pressed を更新しないまま呼ぶと再度押される。手動実行はユーザー操作が起点なので許容する。
    applyMode(doc, 'rich');
    expect(clicked).toHaveLength(2);
  });
});

describe('countModes', () => {
  test('新 UI では aria-pressed を見て数える', () => {
    const { doc } = render(newUiFile('a.md', true) + newUiFile('b.md', false) + newUiFile('c.md', false));
    expect(countModes(doc)).toEqual({ rich: 1, source: 2 });
  });

  test('旧 UI ではボタンのラベルの逆が今の表示になる', () => {
    const { doc } = render(oldUiFile('a.md', true) + oldUiFile('b.md', false));
    expect(countModes(doc)).toEqual({ rich: 1, source: 1 });
  });

  test('Markdown 以外は数に入れない', () => {
    const { doc } = render(newUiFile('package.json', true) + newUiFile('README.md', true));
    expect(countModes(doc)).toEqual({ rich: 1, source: 0 });
  });

  test('Markdown がなければ両方 0', () => {
    const { doc } = render(newUiFile('package.json', false));
    expect(countModes(doc)).toEqual({ rich: 0, source: 0 });
  });
});

describe('isDiffPagePath', () => {
  test.each([
    ['/owner/repo/pull/12/files', true],
    ['/owner/repo/pull/12/changes', true],
    ['/owner/repo/pull/12/changes#diff-abc', true],
    ['/owner/repo/pull/12', false],
    ['/owner/repo/pull/12/commits', false],
    ['/owner/repo/compare/main...topic', false],
    ['/owner/repo/blob/main/README.md', false],
  ])('%s → %p', (pathname, expected) => {
    expect(isDiffPagePath(pathname)).toBe(expected);
  });
});
