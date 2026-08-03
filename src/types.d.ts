/**
 * src/diff-toggle.js が globalThis に公開する API の型。
 *
 * content_scripts に指定した JS は ES module として評価されず export が書けないため、
 * ファイル間の受け渡しはグローバル変数で行う。その型をここで宣言する。
 * 拡張の実行には使わないファイルなので、配布用の ZIP に含める必要はない。
 */

type DiffMode = 'rich' | 'source';

/** Markdown ファイルが今どちらの表示になっているかの内訳。 */
type ModeCounts = {
  rich: number;
  source: number;
};

/** applyMode の結果。rich と source は適用後の内訳。 */
type ApplyResult = ModeCounts & {
  switched: number;
  markdownFiles: number;
};

/** ポップアップと content script の間でやり取りするメッセージ。 */
type ExtensionMessage = { type: 'apply'; mode: DiffMode } | { type: 'status' };

type ExtensionResponse = ({ ok: true } & ModeCounts) | { ok: false; reason: string };

declare var autoRichDiff: {
  applyMode(
    doc: Document,
    mode: DiffMode,
    options?: { alreadyApplied?: WeakSet<HTMLElement> },
  ): ApplyResult;
  countModes(doc: Document): ModeCounts;
  filePathOf(element: Element): string | null;
  isDiffPagePath(pathname: string): boolean;
  labelOf(element: Element): string;
  stripBidiMarks(text: string | null | undefined): string;
};
