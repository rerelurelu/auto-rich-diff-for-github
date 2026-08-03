# Auto Rich Diff for GitHub

GitHub のプルリクエスト差分で、Markdown ファイル (`.md` / `.mdx` / `.markdown`) をまとめて rich diff に切り替える Chrome 拡張。

diff の描画そのものは GitHub の機能を使う。この拡張がやるのは、GitHub が各ファイルに出している rich / source の切り替えボタンを、Markdown に限って押すこと。

## できること

拡張アイコンをクリックするとポップアップが開く。

| 操作 | 動き |
| --- | --- |
| 常に rich diff で開く | 差分ページを開いたとき自動で切り替える。初期値はオン |
| このページの表示 (Source / Rich) | 開いているページの Markdown をまとめて切り替える。再読み込みは要らない |

`package.json` や `.yml` にも rich diff ボタンは出るが、切り替えるのは Markdown だけ。

自動での切り替えは 1 つのボタンにつき 1 回しか行わない。開いた直後に rich へ揃えたあと手動で source に戻しても、拡張が再び rich にすることはない。

## インストール

1. Chrome で `chrome://extensions` を開く
2. 右上の「デベロッパー モード」をオンにする
3. 「パッケージ化されていない拡張機能を読み込む」でこのディレクトリを選ぶ

すでに開いているプルリクエストのタブは、読み込み後に再読み込みする。

表示言語は Chrome の表示言語 (`chrome://settings/languages`) に従い、英語と日本語を用意している。

## 開発

ビルド手順はない。`src/` をそのまま Chrome が読む。開発用の依存は型チェックとテストのためだけに入っている。

```sh
bun install
bun test           # DOM を操作する処理の単体テスト
bun run typecheck  # JSDoc の型注釈を tsc --checkJs で検証する
bun run icons      # icons/*.svg から PNG を書き出す
bun run package    # テストと型チェックを通してから dist/ に提出用の ZIP を作る
```

| ファイル | 役割 |
| --- | --- |
| `manifest.json` | Manifest V3 の宣言 |
| `src/diff-toggle.js` | 切り替えボタンの特定とクリック。`chrome.*` に依存しない |
| `src/content.js` | DOM の変化を監視し、`chrome.storage` の設定に従って適用する |
| `src/popup.html` / `src/popup.js` | ポップアップの UI |
| `src/types.d.ts` | ファイル間で受け渡す値の型宣言。実行には使わない |
| `_locales/<言語>/messages.json` | 表示文言 |
| `icons/*.svg` | アイコンの原本。PNG はここから書き出す |

`diff-toggle.js` は `Document` を引数で受け取り `chrome.*` に触れないため、ブラウザ外でテストできる。`content.js` 側の監視タイミングと `chrome.storage` 連携には自動テストがなく、実際に拡張を読み込んで確認する。

型は TypeScript ではなく JSDoc で書く。ストアに提出する ZIP の中身とリポジトリのソースを一致させ、トランスパイル後のコードを審査に出さないため。

GitHub 側の変更で動かなくなったときは、`src/diff-toggle.js` 冒頭の `RICH_LABEL` / `SOURCE_LABEL` / `FILE_CONTAINER` を確認する。新旧 2 種類の差分 UI をどう見分けているか、なぜ MutationObserver を止めないかといった判断は、各ファイルのコメントに書いてある。

## ライセンス

[MIT](LICENSE)
