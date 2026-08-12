English | [日本語](README.ja.md)

# Auto Rich Diff for GitHub

A Chrome extension that switches Markdown files (`.md` / `.mdx` / `.markdown`) to GitHub's rich diff view in bulk on pull request diff pages.

GitHub renders the diff itself. This extension only presses the rich / source toggle that GitHub already puts on each file, and only for Markdown.

## What it does

Clicking the toolbar icon opens the popup.

| Control | Behaviour |
| --- | --- |
| Always open in rich diff | Switches Markdown files automatically when a diff page loads. On by default |
| This page (Source / Rich) | Switches every Markdown file on the open page at once. No reload needed |

`package.json` and `.yml` files also have a rich diff button, but only Markdown is switched.

Automatic switching runs once per button. If you let the extension switch a file to rich and then switch it back to source by hand, the extension leaves it that way.

## Installation

[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/auto-rich-diff-for-github/kefpmlmdgmlpemadndmbjfmgibpndeka).

To run this repository instead of the published version:

1. Open `chrome://extensions` in Chrome
2. Turn on "Developer mode" in the top right
3. Choose "Load unpacked" and select this directory

Reload any pull request tabs you already had open.

The interface follows your Chrome display language (`chrome://settings/languages`). English and Japanese are included.

## Development

There is no build step. Chrome reads `src/` as it is. The dev dependencies exist only for type checking and tests.

```sh
bun install
bun test           # unit tests for the DOM logic
bun run typecheck  # verifies the JSDoc annotations with tsc --checkJs
bun run icons      # writes PNGs from icons/*.svg
bun run package    # runs the tests and type check, then builds the store ZIP in dist/
```

| File | Role |
| --- | --- |
| `manifest.json` | Manifest V3 declaration |
| `src/diff-toggle.js` | Finds and clicks the toggle buttons. Does not touch `chrome.*` |
| `src/content.js` | Watches the DOM and applies the setting from `chrome.storage` |
| `src/popup.html` / `src/popup.js` | The popup UI |
| `src/types.d.ts` | Type declarations for values passed between files. Not used at runtime |
| `_locales/<language>/messages.json` | Interface text |
| `icons/*.svg` | Icon sources. The PNGs are written from these |
| `store/` | Chrome Web Store listing text and screenshots |

`diff-toggle.js` takes a `Document` as an argument and never touches `chrome.*`, so it can be tested outside a browser. The timing logic in `content.js` and the `chrome.storage` glue have no automated tests; they are checked by loading the extension.

Types are written as JSDoc rather than TypeScript. This keeps the contents of the ZIP submitted to the store identical to the repository source, so no transpiled code goes to review.

If a change on GitHub's side breaks the extension, start with `RICH_LABEL` / `SOURCE_LABEL` / `FILE_CONTAINER` / `FILE_HEADER` at the top of `src/diff-toggle.js`. The reasoning behind how the two diff UIs are told apart, and why the MutationObserver is never disconnected, is in the comments of each file.

## License

[MIT](LICENSE)
