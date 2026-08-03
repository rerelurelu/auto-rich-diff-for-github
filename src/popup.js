/**
 * ポップアップの UI。
 *
 * 「常に rich diff で開く」は chrome.storage に保存するだけで、
 * 開いているページへの反映は content script が storage.onChanged で受け取って行う。
 * 下段のセグメントは、いま開いているページの Markdown だけをその場で切り替える。
 *
 * 状態を伝える文は、操作できないときだけ出す。切り替えられる状態なら、
 * セグメントのどちらが選ばれているかが現在の表示そのものを表す。
 */

const alwaysRichSwitch = /** @type {HTMLInputElement} */ (document.querySelector('#always-rich'));
const modeRadios = /** @type {HTMLInputElement[]} */ ([...document.querySelectorAll('input[name="page-mode"]')]);
const statusLine = /** @type {HTMLElement} */ (document.querySelector('#status'));

/**
 * data-i18n を持つ要素のテキストを、Chrome の表示言語に合わせて差し替える。
 * HTML には _locales の既定ロケールと同じ文言を書いてあるので、
 * 未対応の言語ではそのまま英語が残る。
 */
const applyTranslations = () => {
  document.documentElement.lang = chrome.i18n.getUILanguage();

  for (const element of document.querySelectorAll('[data-i18n]')) {
    const key = /** @type {HTMLElement} */ (element).dataset.i18n;
    const message = key === undefined ? '' : chrome.i18n.getMessage(key);
    if (message) element.textContent = message;
  }
};

/**
 * @param {string} key _locales のメッセージキー
 * @param {string[]} [substitutions] メッセージ内のプレースホルダに入れる値
 */
const showStatus = (key, substitutions) => {
  statusLine.textContent = chrome.i18n.getMessage(key, substitutions);
};

/**
 * ページの Markdown が今どうなっているかを表す文のキーと値を返す。
 * セグメントの選択状態だけでは、どちらが選ばれているか読み取りにくいため文でも示す。
 *
 * @param {ModeCounts} counts
 * @returns {[string, string[]]}
 */
const describe = ({ rich, source }) => {
  if (source === 0) return ['showingRich', [String(rich)]];
  if (rich === 0) return ['showingSource', [String(source)]];
  return ['showingMixed', [String(rich), String(source)]];
};

/** @returns {Promise<chrome.tabs.Tab | undefined>} */
const activeTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
};

/**
 * content script にメッセージを送る。応答がなければ undefined。
 * @param {number} tabId
 * @param {ExtensionMessage} message
 * @returns {Promise<ExtensionResponse | undefined>}
 */
const send = async (tabId, message) => {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // content script が注入されていないタブでは接続に失敗する。
    return undefined;
  }
};

/**
 * 切り替えられない理由を、開いているページから判断する。
 *
 * content script が応答しない原因は、GitHub 以外のページを見ているか、
 * 拡張を入れ直したあとまだ再読み込みしていないかのどちらか。URL を見れば区別できる。
 *
 * @param {string | undefined} tabUrl
 * @returns {string} _locales のメッセージキー
 */
const describeUnavailable = (tabUrl) => {
  const url = tabUrl?.startsWith('https://github.com/') ? new URL(tabUrl) : null;
  if (!url) return 'notGitHub';
  if (!autoRichDiff.isDiffPagePath(url.pathname)) return 'notDiffPage';
  return 'needsReload';
};

/**
 * セグメントの選択状態をページの状態に合わせる。
 * rich と source が混ざっているときは、どちらも選ばない。
 * @param {ModeCounts} counts
 */
const selectMode = ({ rich, source }) => {
  for (const radio of modeRadios) {
    radio.checked = (radio.value === 'rich' && source === 0) || (radio.value === 'source' && rich === 0);
  }
};

/** @param {boolean} enabled */
const setEnabled = (enabled) => {
  for (const radio of modeRadios) radio.disabled = !enabled;
};

/** ページ側の状態を読み、セグメントに反映する。 */
const syncFromPage = async () => {
  const tab = await activeTab();
  const status = tab?.id === undefined ? undefined : await send(tab.id, { type: 'status' });

  if (!status?.ok) {
    setEnabled(false);
    showStatus(describeUnavailable(tab?.url));
    return;
  }
  if (status.rich + status.source === 0) {
    setEnabled(false);
    showStatus('noMarkdown');
    return;
  }

  setEnabled(true);
  selectMode(status);
  showStatus(...describe(status));
};

const init = async () => {
  applyTranslations();

  const { alwaysRich } = await chrome.storage.sync.get({ alwaysRich: true });
  alwaysRichSwitch.checked = alwaysRich === true;

  await syncFromPage();

  alwaysRichSwitch.addEventListener('change', async () => {
    await chrome.storage.sync.set({ alwaysRich: alwaysRichSwitch.checked });
    if (!alwaysRichSwitch.checked) return;

    // content script が storage.onChanged を受けてページを切り替えるので、その結果を読み直す。
    setTimeout(syncFromPage, 100);
  });

  for (const radio of modeRadios) {
    radio.addEventListener('change', async () => {
      const tab = await activeTab();
      const result = tab?.id === undefined
        ? undefined
        : await send(tab.id, { type: 'apply', mode: /** @type {DiffMode} */ (radio.value) });

      if (!result?.ok) {
        showStatus('switchFailed');
        return;
      }
      selectMode(result);
      showStatus(...describe(result));
    });
  }
};

init();
