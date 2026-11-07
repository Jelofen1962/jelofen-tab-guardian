/*
╭──────────────────────────────────────────────────────────────╮
│  JTG  |  JELOFEN'S TAB GUARDIAN                               │
│  Crafted by : Jelofen The Dev                                 │
│  Telegram   : https://t.me/Jelofen1962                        │
│  Contact    : +989035361164                                   │
╰──────────────────────────────────────────────────────────────╯
*/
'use strict';

const SETTINGS_KEY = 'jtgSettings';
const CONTEXT_MENU_ID = 'jtg-close-confirmed';

const DEFAULT_SETTINGS = Object.freeze({
  globalAutoLock: false,
  siteRules: {},
  language: 'fa',
  nativeCompanionMode: false
});

function isWebUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

function getHost(url) {
  if (!isWebUrl(url)) return '';
  try { return new URL(url).hostname.toLowerCase(); }
  catch { return ''; }
}

async function getSettings() {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  const saved = data[SETTINGS_KEY] || {};
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    siteRules: saved.siteRules && typeof saved.siteRules === 'object' ? saved.siteRules : {}
  };
}

async function getLockState(url) {
  const settings = await getSettings();
  const host = getHost(url);
  const nativeCompanionMode = Boolean(settings.nativeCompanionMode);
  if (!host) return { locked: false, host: '', mode: 'unsupported', nativeCompanionMode };
  if (Object.prototype.hasOwnProperty.call(settings.siteRules, host)) {
    return { locked: Boolean(settings.siteRules[host]), host, mode: 'site', nativeCompanionMode };
  }
  return { locked: Boolean(settings.globalAutoLock), host, mode: 'global', nativeCompanionMode };
}

async function broadcastLockStates() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id || !isWebUrl(tab.url)) continue;
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['title-lock.js'] }).catch(() => {});
    const state = await getLockState(tab.url);
    chrome.tabs.sendMessage(tab.id, { type: 'jtg-lock-state', ...state }).catch(() => {});
  }
}


chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(SETTINGS_KEY);
  if (!current[SETTINGS_KEY]) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: { ...DEFAULT_SETTINGS } });
  }

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'JTG: close this tab with confirmation',
      contexts: ['page', 'frame']
    });
  });

  await broadcastLockStates();
});

chrome.runtime.onStartup.addListener(async () => {
  await broadcastLockStates();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'jtg-get-lock-state') {
    getLockState(sender.tab?.url || '').then(sendResponse).catch(() => sendResponse({ locked: false, host: '', mode: 'unsupported' }));
    return true;
  }

  if (message?.type === 'jtg-allow-close' && Number.isInteger(message.tabId)) {
    chrome.tabs.sendMessage(message.tabId, { type: 'jtg-approved-close' })
      .catch(() => {})
      .finally(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === 'jtg-refresh-rules') {
    broadcastLockStates().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }

  return false;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[SETTINGS_KEY]) {
    broadcastLockStates().catch(error => console.warn('JTG lock refresh failed:', error));
  }
});

// JTG now asks before a locked page unloads. It intentionally does not
// recreate a tab after it closes, avoiding the close-then-reopen behavior.

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !tab?.id) return;
  const title = encodeURIComponent(tab.title || tab.url || 'Selected tab');
  const confirmUrl = chrome.runtime.getURL(`confirm.html?tabId=${tab.id}&title=${title}`);
  chrome.tabs.create({ url: confirmUrl, active: true });
});
