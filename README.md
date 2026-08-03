# Auto Rich Diff for GitHub

GitHub のプルリクエスト差分ページで、Markdown ファイル (`.md` / `.mdx` / `.markdown`) の表示を rich diff または source diff に一括で切り替える Chrome 拡張。

diff の描画そのものは GitHub の機能をそのまま使う。この拡張がやるのは、GitHub が各ファイルに出している rich / source の切り替えボタンを、Markdown ファイルに限ってまとめて押すことだけ。

## できること

拡張アイコンのポップアップに 2 つのスイッチがある。

| 操作 | 動き |
| --- | --- |
| 常に rich diff で開く（スイッチ） | 差分ページを開いたとき、Markdown を自動で rich diff にする。初期値はオン |
| このページの表示（Source / Rich） | 開いているページの Markdown をまとめて切り替える。ページの再読み込みは要らない |

下段をスイッチではなくセグメントにしているのは、rich と source が対等な二択で、スイッチの「有効/無効」という意味に合わないため。ファイルごとに個別に切り替えて rich と source が混ざっている場合は、どちらも選択されていない状態で表示する。

状態を伝える文は、操作できないときだけ出す。選べる状態なら、どちらが選ばれているかが現在の表示そのものを表すため。

GitHub 側の既定表示は source diff なので、自動で切り替えるのは rich への一方向だけ。source で読みたいときは下段のスイッチを使う。

対象は Markdown のみ。`package.json` や `.yml` にも rich diff ボタンは出るが、これらは切り替えない。

新 UI (`/pull/N/changes`) で動作を確認済み。旧 UI (`/pull/N/files`) 向けのコードも入れてあるが、新 UI が有効なアカウントでは `/files` が `/changes` にリダイレクトされるため未検証。

自動適用は 1 つのボタンにつき 1 回だけ行う。ページを開いた直後に rich へ揃えたあと、手動で source に戻しても、拡張が再び rich にすることはない。ただし「常に rich diff で開く」をオフからオンにしたときは、そのページ全体をもう一度 rich にする。

## インストール

1. Chrome で `chrome://extensions` を開く
2. 右上の「デベロッパー モード」をオンにする
3. 「パッケージ化されていない拡張機能を読み込む」でこのディレクトリを選ぶ

既に開いているプルリクエストのタブがある場合は、読み込み後に再読み込みする。

## 構成

| ファイル | 役割 |
| --- | --- |
| `manifest.json` | Manifest V3 の宣言。`https://github.com/*` に content script を注入する |
| `_locales/<言語>/messages.json` | 表示文言。en と ja がある |
| `icons/*.svg` | アイコンの原本。PNG はここから書き出す |
| `scripts/build-icons.sh` | SVG から PNG を書き出す |
| `src/diff-toggle.js` | 切り替えボタンの特定とクリック。`chrome.*` に依存しない |
| `src/content.js` | DOM の変化を監視し、`chrome.storage` の設定に従って適用する |
| `src/popup.html` / `src/popup.js` | 2 つのスイッチの UI |
| `src/types.d.ts` | ファイル間で受け渡す値の型宣言。実行には使わない |
| `test/diff-toggle.test.js` | `diff-toggle.js` の単体テスト |
| `test/locales.test.js` | ロケール間のキーの一致と、コードから参照しているキーの存在を確認する |

設定値は `chrome.storage.sync` の `alwaysRich` に真偽値として保存する。未設定のときは `true` として扱う。

### ファイル間の受け渡しにグローバル変数を使う理由

`content_scripts` に指定した JS は ES module として評価されないため、`import` / `export` を書けない。`diff-toggle.js` は `globalThis.autoRichDiff` に API を置き、`content.js` はそれを読む。両者は `manifest.json` の `js` 配列の順に評価される。テストからは `import` の副作用としてグローバルを受け取る。

動的 `import()` でローダーを噛ませる書き方も試したが、GitHub 上では読み込まれなかった。content script は isolated world で動くものの、動的 import はページ側の CSP の影響を受けるため。

## 開発

ビルド手順はない。`src/` をそのまま Chrome が読む。開発用の依存は型チェックとテストのためだけに入っている。

```sh
bun install
bun test        # diff-toggle.js の単体テスト (happy-dom で DOM を組み立てる)
bun run typecheck  # JSDoc の型注釈を tsc --checkJs で検証する
```

型は TypeScript のファイルではなく JSDoc で書く。ストアに提出する ZIP の中身とリポジトリのソースを一致させ、トランスパイル後のコードを審査に出さないため。

`diff-toggle.js` は `Document` を引数で受け取り、`chrome.*` API に触れない。このためブラウザ外でテストできる。`content.js` 側の監視タイミングと `chrome.storage` 連携には自動テストがなく、実際に拡張を読み込んで確認する。

## GitHub の DOM への依存

新 UI では、切り替えボタンは Primer の SegmentedControl として描画される。

- ラベルは `aria-labelledby` が指すツールチップ要素の中にあり、`aria-label` 属性は持たない
- 選択状態は `aria-pressed` に入る
- クリックしてもボタン要素は作り直されず、`aria-pressed` だけが入れ替わる
- ファイルパスは `div[id^="diff-"]` の中の `a[href^="#diff-"]` のテキストから取る。前後に双方向制御文字 (U+200E) が付くので取り除く

旧 UI では、1 つのボタンが押すたびに rich と source を切り替え、`aria-label` が `Display the rich diff` / `Display the source diff` に入れ替わる。`aria-pressed` は持たない。ただしこれは未検証の想定であり、実機で確認できていない。

`src/diff-toggle.js` は「押すと rich になるボタンのラベルは `Display the rich diff`」という共通点を使って両方を扱う。GitHub 側の変更で動かなくなった場合、まず `src/diff-toggle.js` 冒頭の `RICH_LABEL` / `SOURCE_LABEL` / `FILE_CONTAINER` を確認する。

## アイコン

ポップアップのセグメント切替と同じ形で、右側 (rich diff) が選ばれている状態を表す。配色は Catppuccin Mocha で、地は Base `#1e1e2e`、選ばれている側は Teal `#94e2d5`。ポップアップの暗い側と同じ色を使う。

原本は SVG で、PNG は `bun run icons` で書き出す。

```sh
bun run icons   # icons/*.svg -> icons/icon{16,32,48,128}.png
```

サイズごとに原本を分けている。`icons/icon.svg` は 48px 以上用で、セグメントの中に本文の行が入る。この行は 32px 以下に縮小すると 1px を割って消えるため、16px と 32px は行を持たない `icons/icon-small.svg` から書き出す。

書き出しには Chrome のヘッドレスモードを使う。Chrome には SVG を任意のサイズで描かせる手段がないため、`width` / `height` の指定どおり 128px で書き出してから `sips` で縮小する。SVG から `width` / `height` を外してウィンドウサイズに合わせる書き方は、Chrome が SVG を単体で開いたときには効かない。

## 表示言語

文言は `_locales/en/messages.json` と `_locales/ja/messages.json` に置く。既定ロケールは `en` で、それ以外の言語の環境では英語を表示する。

切り替えの基準は Chrome の表示言語（`chrome://settings/languages`）で、開いているページの言語でも OS の言語でもない。拡張の中から言語を選ぶ UI は用意していない。

- `manifest.json` では `__MSG_extName__` のように書くと Chrome が置換する。Chrome Web Store の掲載名と説明文もここから引かれる
- HTML には置換の仕組みがないため、`data-i18n="キー"` を振って `src/popup.js` の `applyTranslations` が流し込む。HTML に書いてある文言は既定ロケールと同じもので、未対応言語ではそのまま残る
- セグメントの `Source` と `Rich` は翻訳しない。GitHub 本体のボタンと表記を揃えるため

文言を足すときは、`_locales` の全ロケールに同じキーを足す。`test/locales.test.js` がキーの過不足と、コードから参照しているキーの存在を確認する。

## 適用のタイミング

GitHub の新 UI は差分を遅延読み込みするため、ページを開いた時点では切り替えボタンがまだ存在しない。そのため次の 2 つで拾う。

- `MutationObserver` で `document.body` の変化を監視し、250ms のデバウンスをかけて適用する
- 開いた直後の 12 秒間、500ms ごとにも適用を試す

適用中に `observer.disconnect()` を挟んではいけない。MutationObserver は監視を止めた時点で溜まっていた変更レコードを捨てるため、その隙に差分の描画が終わると二度と発火しなくなる。自分のクリックによる再発火は `autoApplied` の WeakSet が吸収するので、監視を止める必要はない。

## 未対応

- アイコン画像を同梱していないため、ツールバーには既定のアイコンが表示される
- キーボードショートカットはない
- コミット単体の差分ページ (`/commit/<sha>`) やファイル比較ページ (`/compare/...`) は対象外
