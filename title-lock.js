/*
╭──────────────────────────────────────────────────────────────╮
│  JTG  |  JELOFEN'S TAB GUARDIAN                               │
│  Crafted by : Jelofen The Dev                                 │
│  Telegram   : https://t.me/Jelofen1962                        │
│  Contact    : +989035361164                                   │
╰──────────────────────────────────────────────────────────────╯
*/
(() => {
  'use strict';

  if (globalThis.__JTG_TITLE_LOCK_INSTALLED) return;
  globalThis.__JTG_TITLE_LOCK_INSTALLED = true;

  const PREFIX = '🔒 ';
  let locked = false;
  let lastBaseTitle = '';
  let lastRenderedTitle = null;
  let applying = false;
  let approvedClose = false;
  let nativeCompanionMode = false;

  // Chromium's native beforeunload dialog is the only available pre-close
  // confirmation for normal web tabs. The browser controls the dialog text.
  window.addEventListener('beforeunload', event => {
    if (!locked || approvedClose || nativeCompanionMode) return;
    event.preventDefault();
    event.returnValue = '';
  }, true);

  function stripPrefix(title) {
    return String(title || '').replace(/^🔒\s*/, '');
  }

  function renderTitle() {
    if (!document.title) return;
    const next = locked && lastBaseTitle ? PREFIX + stripPrefix(lastBaseTitle) : stripPrefix(lastBaseTitle);
    if (document.title !== next) {
      applying = true;
      lastRenderedTitle = next;
      document.title = next;
      queueMicrotask(() => { applying = false; });
    } else {
      lastRenderedTitle = document.title;
    }
  }

  function syncFromDocument() {
    const current = document.title;
    if (!current || applying || current === lastRenderedTitle) return;
    lastBaseTitle = stripPrefix(current);
    renderTitle();
  }

  const observer = new MutationObserver(syncFromDocument);
  function startObserving() {
    if (document.documentElement) {
      observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
      syncFromDocument();
    }
  }

  if (document.documentElement) startObserving();
  else new MutationObserver(() => {
    if (document.documentElement) {
      startObserving();
      observer.disconnect();
    }
  }).observe(document, { childList: true, subtree: true });

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === 'jtg-approved-close') {
      approvedClose = true;
      return;
    }
    if (message?.type !== 'jtg-lock-state') return;
    locked = Boolean(message.locked);
    nativeCompanionMode = Boolean(message.nativeCompanionMode);
    if (document.title) lastBaseTitle = stripPrefix(document.title);
    renderTitle();
  });

  chrome.runtime.sendMessage({ type: 'jtg-get-lock-state' })
    .then(state => {
      locked = Boolean(state?.locked);
      nativeCompanionMode = Boolean(state?.nativeCompanionMode);
      if (document.title) lastBaseTitle = stripPrefix(document.title);
      renderTitle();
    })
    .catch(() => {});
})();
