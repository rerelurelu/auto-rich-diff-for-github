# Chrome ウェブストアの掲載情報

提出フォームに入力する内容の控え。更新のたびにここを直してから貼り付ける。

## 基本情報

| 項目 | 値 |
| --- | --- |
| アイテム名 | `manifest.json` の `__MSG_extName__` から入る（Auto Rich Diff for GitHub） |
| 簡単な説明 | `manifest.json` の `__MSG_extDescription__` から入る |
| カテゴリ | デベロッパー ツール |
| 言語 | 英語、日本語 |
| 公開範囲 | 公開 |

## 詳細な説明（英語）

Auto Rich Diff for GitHub switches Markdown files (`.md`, `.mdx`, `.markdown`) to
GitHub's rich diff view in bulk when you open a pull request diff.

GitHub renders the diff itself. This extension only presses the rich / source
toggle that GitHub already puts on each file, and only for Markdown.

Features:

- Turn on "Always open in rich diff" and every Markdown file switches
  automatically when the diff page loads.
- Switch the whole page between Source and Rich from the popup. No page reload.
- Files that are not Markdown are left alone, even when they have a rich diff
  button.

Automatic switching runs once per button. If you switch a file back to the
source diff by hand, the extension leaves it that way.

The extension reads nothing but the diff page you have open, sends no data
anywhere, and stores a single on/off setting.

Source code: https://github.com/rerelurelu/auto-rich-diff-for-github

## 詳細な説明（日本語）

Auto Rich Diff for GitHub は、GitHub のプルリクエスト差分を開いたとき、Markdown
ファイル (`.md` / `.mdx` / `.markdown`) をまとめて rich diff に切り替える拡張です。

diff の描画そのものは GitHub の機能を使います。この拡張がやるのは、GitHub が各
ファイルに出している rich / source の切り替えボタンを、Markdown に限って押すこと
です。

できること:

- 「常に rich diff で開く」をオンにすると、差分ページを開いたときに Markdown が
  自動で切り替わります。
- ポップアップから、開いているページ全体を Source と Rich で切り替えられます。
  ページの再読み込みは要りません。
- Markdown 以外のファイルは、rich diff ボタンがあっても触りません。

自動での切り替えは 1 つのボタンにつき 1 回だけです。手動で source に戻したファイル
を、拡張が再び rich にすることはありません。

読み取るのは開いている差分ページだけで、どこにもデータを送らず、保存するのは
オン / オフの設定 1 個だけです。

ソースコード: https://github.com/rerelurelu/auto-rich-diff-for-github

## 単一用途の説明

Switching Markdown files to GitHub's rich diff view on pull request diff pages.
The extension has one job: pressing the rich / source toggle GitHub renders for
each Markdown file in a pull request diff.

## 権限の正当性

**storage**

Stores one boolean setting: whether to switch Markdown files to the rich diff
automatically when a diff page opens. Nothing else is stored, and the value never
leaves the browser.

**activeTab**

The popup needs to know whether the tab you are looking at is a pull request diff
page, so it can enable or disable the Source / Rich control and report how many
Markdown files are on the page. Access is limited to the tab that is active when
you click the toolbar icon.

**リモートコードの使用**

No. All code is contained in the uploaded package.

## データ使用

「ユーザーデータを収集しない」を選ぶ。以下の 3 つの証明にチェックする。

- ユーザーデータの取り扱いがデベロッパー プログラム ポリシーに準拠している
- 承認済みの用途以外でユーザーデータを販売・譲渡しない
- 信用調査や融資目的でユーザーデータを使用しない

## スクリーンショット

`store/01-diff-page.png` と `store/02-popup.png`。どちらも 1280×800。
