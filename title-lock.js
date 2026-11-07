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

  // The controller remains available in this document so the background
  // worker can lock/unlock it dynamically without reloading the page.
  if (globalThis.__JTG_TITLE_LOCK_INSTALLED) return;
  globalThis.__JTG_TITLE_LOCK_INSTALLED = true;

  const PREFIX = '🔒 ';
  let locked = false;
  let nativeCompanionMode = false;
  let approvedClose = false;
  let observer = null;
  let beforeUnloadAttached = false;

  function stripPrefix(value) {
    return String(value || '').replace(/^(?:🔒\s*)+/, '');
  }

  function setDocumentTitle(value) {
    if (document.title === value) return;
    document.title = value;
  }

  function onBeforeUnload(event) {
    if (!locked || approvedClose || nativeCompanionMode) return;
    event.preventDefault();
    // Chromium controls the native prompt text. A user gesture may be required
    // before the browser is willing to display the prompt.
    event.returnValue = '';
  }

  function syncBeforeUnloadHandler() {
    const shouldAttach = locked && !nativeCompanionMode;
    if (shouldAttach && !beforeUnloadAttached) {
      window.addEventListener('beforeunload', onBeforeUnload);
      beforeUnloadAttached = true;
    } else if (!shouldAttach && beforeUnloadAttached) {
      window.removeEventListener('beforeunload', onBeforeUnload);
      beforeUnloadAttached = false;
    }
  }

  function markTitleIfNeeded() {
    if (!locked || !document.title) return;
    const cleanTitle = stripPrefix(document.title);
    if (document.title !== PREFIX + cleanTitle) setDocumentTitle(PREFIX + cleanTitle);
  }

  function onTitleMutation() {
    if (!locked || !document.title) return;
    // Page scripts may overwrite document.title. Re-apply the marker only while
    // this host is locked; when unlocked the observer is disconnected entirely.
    markTitleIfNeeded();
  }

  function attachTitleObserver() {
    if (observer) return;
    observer = new MutationObserver(() => {
      if (!locked) return;
      if (!document.documentElement) return;
      // If the script is injected at document_start, wait for <html> to exist
      // before observing it. The same observer can safely perform this handoff.
      observer.disconnect();
      observer = new MutationObserver(onTitleMutation);
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true
      });
      markTitleIfNeeded();
    });

    if (document.documentElement) {
      observer.disconnect();
      observer = new MutationObserver(onTitleMutation);
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true
      });
      markTitleIfNeeded();
    } else {
      observer.observe(document, { childList: true, subtree: true });
    }
  }

  function detachTitleObserver() {
    if (!observer) return;
    observer.disconnect();
    observer = null;
  }

  function updateState(nextState) {
    const nextLocked = Boolean(nextState?.locked);
    nativeCompanionMode = Boolean(nextState?.nativeCompanionMode);

    if (nextLocked) {
      locked = true;
      attachTitleObserver();
      markTitleIfNeeded();
    } else {
      locked = false;
      detachTitleObserver();
      // Restore the unmodified title immediately. No beforeunload listener or
      // title observer remains active for an unlocked website.
      setDocumentTitle(stripPrefix(document.title));
    }

    syncBeforeUnloadHandler();
  }

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === 'jtg-approved-close') {
      approvedClose = true;
      return;
    }
    if (message?.type === 'jtg-lock-state') updateState(message);
  });

  chrome.runtime.sendMessage({ type: 'jtg-get-lock-state' })
    .then(state => updateState(state))
    .catch(() => updateState({ locked: false, nativeCompanionMode: false }));
})();
