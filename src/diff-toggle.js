/**
 * GitHub の差分ページから rich / source の切り替えボタンを探し、指定した表示形式へ揃える。
 *
 * chrome.* API には触れず、DOM だけを引数で受け取る。ブラウザ外でも Document さえ用意すればテストできる。
 *
 * content_scripts に指定した JS は ES module として評価されないため export が書けない。
 * かわりに globalThis へ公開する。テストからは import の副作用としてこれを受け取る。
 * ページ側の JavaScript とは isolated world で分離されているので、名前は衝突しない。
 *
 * GitHub には差分ビューが 2 種類ある。どちらにも対応する。
 *
 * 新 UI (/pull/N/changes):
 *   rich と source が別々のボタンとして並ぶセグメントコントロール。
 *   ボタンのラベルは aria-labelledby が指すツールチップ要素に入っていて、
 *   選択状態は aria-pressed で表される。クリックしても要素は作り直されず、
 *   aria-pressed だけが入れ替わる。
 *
 * 旧 UI (/pull/N/files):
 *   1 つのボタンが押すたびに rich <-> source を切り替える。aria-pressed は持たず、
 *   代わりに aria-label が "Display the rich diff" / "Display the source diff" に入れ替わる。
 *
 * どちらも「押すと rich になるボタン」のラベルが "Display the rich diff" である点は
 * 共通なので、ラベルで対象を選び、aria-pressed があれば押す前に状態を見る、という扱いにする。
 */

globalThis.autoRichDiff = (() => {
  /** @typedef {'rich' | 'source'} Mode */
  /** @typedef {{ element: HTMLElement, becomes: Mode }} ToggleButton */

  const MARKDOWN_PATH = /\.(md|mdx|markdown)$/i;
  const RICH_LABEL = /display the rich diff/i;
  const SOURCE_LABEL = /display the source diff/i;

  /** ファイル 1 件分の差分を囲む要素。新 UI は div#diff-<sha>、旧 UI は .file[data-tagsearch-path]。 */
  const FILE_CONTAINER = 'div[id^="diff-"], [data-tagsearch-path], .file';

  /**
   * ファイル 1 件分のヘッダー。切り替えボタンはこの中にしか置かれない。
   *
   * 探索範囲をヘッダーに限る理由は、差分本文をクリック対象から外すため。本文には
   * プルリクエストの作成者が書いた内容がレンダリングされる。GitHub の Markdown
   * サニタイザは a 要素の title 属性を通すので、title="Display the rich diff" を
   * 持つリンクを .md ファイルに書いておくと、本文まで探索した場合にこの拡張が
   * それをクリックし、タブが任意の URL へ遷移する。
   *
   * 新 UI のクラス名は CSS Modules のハッシュ付き
   * (DiffFileHeader-module__diff-file-header__UuNN4) なので部分一致で見る。
   * ハッシュは GitHub のデプロイごとに変わるが、その前の部分は残る。
   */
  const FILE_HEADER = '.file-header, [class*="DiffFileHeader-module"], [class*="diffHeaderWrapper"]';

  const DIFF_PAGE_PATH = /^\/[^/]+\/[^/]+\/pull\/\d+\/(files|changes)\b/;

  /**
   * プルリクエストの差分ページかどうか。
   * @param {string} pathname
   * @returns {boolean}
   */
  const isDiffPagePath = (pathname) => DIFF_PAGE_PATH.test(pathname);

  /**
   * GitHub はファイル名を双方向制御文字 (U+200E など) で囲むので取り除く。
   * @param {string | null | undefined} text
   * @returns {string}
   */
  const stripBidiMarks = (text) => (text ?? '').replace(/[‎‏‪-‮⁦-⁩]/g, '').trim();

  /**
   * 要素のラベルを読む。新 UI は aria-labelledby の参照先にラベルを置くため、そこまで辿る。
   * @param {Element} element
   * @returns {string}
   */
  const labelOf = (element) => {
    const direct = element.getAttribute('aria-label') ?? element.getAttribute('title');
    if (direct) return direct;

    const doc = element.ownerDocument;
    return (element.getAttribute('aria-labelledby') ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => doc.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim();
  };

  /**
   * ボタンが属するファイルのパスを返す。特定できない場合は null。
   * @param {Element} element
   * @returns {string | null}
   */
  const filePathOf = (element) => {
    const container = element.closest(FILE_CONTAINER);
    if (!container) return null;

    const fromAttribute = container.getAttribute('data-tagsearch-path') ?? container.getAttribute('data-path');
    if (fromAttribute) return fromAttribute;

    const link = container.querySelector('a[href^="#diff-"], .file-info a[title]');
    return stripBidiMarks(link?.getAttribute('title') ?? link?.textContent) || null;
  };

  /**
   * ボタンが Markdown ファイルのものかどうか。
   * @param {Element} element
   * @returns {boolean}
   */
  const isMarkdownDiff = (element) => {
    const path = filePathOf(element);
    return path !== null && MARKDOWN_PATH.test(path);
  };

  /**
   * rich / source の切り替えボタンを、押したときに何になるかと一緒に返す。
   * @param {Document} doc
   * @returns {ToggleButton[]}
   */
  const findToggleButtons = (doc) => {
    /** 入れ子になったヘッダーに両方のセレクタが当たると同じ要素を 2 回拾うため、要素単位で除く。 */
    const seen = new Set();

    /** @type {ToggleButton[]} */
    const buttons = [];

    for (const header of doc.querySelectorAll(FILE_HEADER)) {
      for (const element of /** @type {HTMLElement[]} */ ([...header.querySelectorAll('button, a')])) {
        if (seen.has(element)) continue;
        seen.add(element);

        const label = labelOf(element);
        if (RICH_LABEL.test(label)) buttons.push({ element, becomes: /** @type {Mode} */ ('rich') });
        else if (SOURCE_LABEL.test(label)) buttons.push({ element, becomes: /** @type {Mode} */ ('source') });
      }
    }

    return buttons;
  };

  /**
   * ボタンから、そのファイルが今どちらで表示されているかを読む。
   * 状態を判断できないボタン（新 UI の選ばれていない方）では null を返す。
   *
   * 新旧 UI の違いはこの関数の中だけに閉じる。
   *
   * @param {HTMLElement} element
   * @param {Mode} becomes このボタンを押すと何になるか
   * @returns {Mode | null}
   */
  const shownModeOf = (element, becomes) => {
    const pressed = element.getAttribute('aria-pressed');

    // 旧 UI は選択状態を持たない。ボタンは「押した後の姿」を指すので、今の表示はその逆。
    if (pressed === null) return becomes === 'rich' ? 'source' : 'rich';

    // 新 UI は 1 ファイルにつき 2 ボタンあり、選ばれている片方だけが今の表示を表す。
    return pressed === 'true' ? becomes : null;
  };

  /**
   * Markdown ファイルが今どちらの表示になっているかを数える。
   * @param {Document} doc
   * @returns {{ rich: number, source: number }}
   */
  const countModes = (doc) => {
    const counts = { rich: 0, source: 0 };

    for (const { element, becomes } of findToggleButtons(doc)) {
      if (!isMarkdownDiff(element)) continue;

      const shown = shownModeOf(element, becomes);
      if (shown !== null) counts[shown] += 1;
    }

    return counts;
  };

  /**
   * Markdown ファイルの表示を mode に揃える。
   *
   * 戻り値の rich と source は適用後の内訳。対象になったファイルは押し終えた時点で
   * すべて mode になっているが、GitHub 側の再描画が終わるまで aria-pressed は古いままなので、
   * 呼び出し直後に countModes で数え直しても正しい値にはならない。
   *
   * @param {Document} doc
   * @param {Mode} mode
   * @param {{ alreadyApplied?: WeakSet<HTMLElement> }} [options]
   *   alreadyApplied を渡すと、そこに入っているボタンは飛ばし、処理したボタンを追加する。
   *   自動適用を 1 つのボタンにつき 1 回だけにするために使う。
   * @returns {{ switched: number, markdownFiles: number, rich: number, source: number }}
   */
  const applyMode = (doc, mode, { alreadyApplied } = {}) => {
    let switched = 0;
    let markdownFiles = 0;

    for (const { element, becomes } of findToggleButtons(doc)) {
      if (becomes !== mode) continue;
      if (!isMarkdownDiff(element)) continue;

      markdownFiles += 1;
      if (alreadyApplied?.has(element)) continue;
      alreadyApplied?.add(element);

      if (shownModeOf(element, becomes) === mode) continue;

      element.click();
      switched += 1;
    }

    return {
      switched,
      markdownFiles,
      rich: mode === 'rich' ? markdownFiles : 0,
      source: mode === 'source' ? markdownFiles : 0,
    };
  };

  return { applyMode, countModes, filePathOf, isDiffPagePath, labelOf, stripBidiMarks };
})();
