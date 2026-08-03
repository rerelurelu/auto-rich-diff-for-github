/**
 * 差分ページに常駐して、Markdown ファイルの表示を rich diff へ揃える。
 *
 * 切り替えの判断そのものは diff-toggle.js が持つ。ここが受け持つのは
 * chrome.* API との連携と、DOM の変化を監視して適用するタイミングの制御。
 *
 * diff-toggle.js は manifest.json の content_scripts でこのファイルより先に読み込まれ、
 * globalThis.autoRichDiff に API を置く。
 */

const { applyMode, countModes, isDiffPagePath } = autoRichDiff;

/** DOM の変化が落ち着くまでの待ち時間 (ms)。差分の遅延読み込み中に何度も走らせないため。 */
const DEBOUNCE_MS = 250;

/** 差分の遅延読み込みを取りこぼさないよう、開いた直後はしばらく定期的に試す。 */
const POLL_INTERVAL_MS = 500;
const POLL_COUNT = 24;

/**
 * 設定の現在値。読み込む前は何もしないよう false から始める。
 * chrome.storage.sync.get は拡張プロセスとの往復なので、監視やポーリングのたびに
 * 読み直さず、storage.onChanged で追従する。
 */
let alwaysRich = false;

/**
 * 自動適用済みのボタン。
 * ユーザーが手動で source に戻した表示を拡張が再び rich に切り替え直さないように、
 * 自動適用は 1 つのボタンにつき 1 回だけ行う。
 * @type {WeakSet<HTMLElement>}
 */
const autoApplied = new WeakSet();

/**
 * @template {unknown[]} A
 * @param {(...args: A) => void} fn
 * @param {number} ms
 * @returns {(...args: A) => void}
 */
const debounce = (fn, ms) => {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

const applyIfEnabled = () => {
  if (!alwaysRich || !isDiffPagePath(location.pathname)) return;
  applyMode(document, 'rich', { alreadyApplied: autoApplied });
};

/**
 * 適用中に observer.disconnect() を挟むと、止めている間に起きた DOM の変更が捨てられる。
 * 差分の描画がその隙に終わると二度と発火しなくなるため、ここでは監視を止めない。
 * 自分のクリックで再び呼ばれても、autoApplied に入ったボタンは押さないので収束する。
 */
const scheduleApply = debounce(applyIfEnabled, DEBOUNCE_MS);

new MutationObserver(scheduleApply).observe(document.body, { childList: true, subtree: true });

// MutationObserver だけでは、差分の描画が始まる前と後で変更が途切れると取りこぼす。
// 開いた直後の 12 秒間は定期的にも試す。
let remainingPolls = POLL_COUNT;
const pollTimer = setInterval(() => {
  remainingPolls -= 1;
  if (remainingPolls <= 0) clearInterval(pollTimer);
  applyIfEnabled();
}, POLL_INTERVAL_MS);

chrome.storage.sync.get({ alwaysRich: true }).then((stored) => {
  alwaysRich = stored.alwaysRich === true;
  applyIfEnabled();
});

// 設定を切り替えたとき、開いているページにその場で反映する。
// 開いている全タブの content script が受け取るので、ポップアップからの明示的な指示は要らない。
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || changes.alwaysRich === undefined) return;

  alwaysRich = changes.alwaysRich.newValue === true;
  if (!alwaysRich || !isDiffPagePath(location.pathname)) return;

  // 設定を入れ直したときは、一度自動適用したファイルも改めて rich にする。
  applyMode(document, 'rich');
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  /** @type {ExtensionMessage} */
  const request = message;

  if (request?.type !== 'apply' && request?.type !== 'status') return false;

  if (!isDiffPagePath(location.pathname)) {
    sendResponse({ ok: false, reason: 'not-a-diff-page' });
    return false;
  }

  const counts = request.type === 'status' ? countModes(document) : applyMode(document, request.mode);
  sendResponse({ ok: true, rich: counts.rich, source: counts.source });
  return false;
});
