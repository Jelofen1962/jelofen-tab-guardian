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
const CACHE_KEY = 'jtgTabCache';
const CONTEXT_MENU_ID = 'jtg-close-confirmed';
const intentionalCloseIds = new Set();

const DEFAULT_SETTINGS = Object.freeze({
  globalAutoLock: false,
  siteRules: {},
  language: 'fa'
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
  if (!host) return { locked: false, host: '', mode: 'unsupported' };
  if (Object.prototype.hasOwnProperty.call(settings.siteRules, host)) {
    return { locked: Boolean(settings.siteRules[host]), host, mode: 'site' };
  }
  return { locked: Boolean(settings.globalAutoLock), host, mode: 'global' };
}

async function readCache() {
  const data = await chrome.storage.local.get(CACHE_KEY);
  return data[CACHE_KEY] || {};
}

async function writeTab(tab) {
  if (!tab || !Number.isInteger(tab.id) || !isWebUrl(tab.url)) return;
  const cache = await readCache();
  cache[String(tab.id)] = {
    url: tab.url,
    title: tab.title || tab.url,
    windowId: tab.windowId,
    index: tab.index,
    pinned: Boolean(tab.pinned),
    updatedAt: Date.now()
  };
  await chrome.storage.local.set({ [CACHE_KEY]: cache });
}

async function broadcastLockStates() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id || !isWebUrl(tab.url)) continue;
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['title-lock.js'] }).catch(() => {});
    const state = await getLockState(tab.url);
    chrome.tabs.sendMessage(tab.id, { type: 'jtg-lock-state', ...state }).catch(() => {});
    await writeTab(tab);
  }
}

async function removeCachedTab(tabId) {
  const cache = await readCache();
  delete cache[String(tabId)];
  await chrome.storage.local.set({ [CACHE_KEY]: cache });
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

  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    await writeTab(tab);
    if (tab.id && isWebUrl(tab.url)) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['title-lock.js'] }).catch(() => {});
      const state = await getLockState(tab.url);
      chrome.tabs.sendMessage(tab.id, { type: 'jtg-lock-state', ...state }).catch(() => {});
    }
  }
});

chrome.runtime.onStartup.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) await writeTab(tab);
  await broadcastLockStates();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'jtg-get-lock-state') {
    getLockState(sender.tab?.url || '').then(sendResponse).catch(() => sendResponse({ locked: false, host: '', mode: 'unsupported' }));
    return true;
  }

  if (message?.type === 'jtg-allow-close' && Number.isInteger(message.tabId)) {
    intentionalCloseIds.add(message.tabId);
    sendResponse({ ok: true });
    return false;
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

chrome.tabs.onCreated.addListener(tab => { writeTab(tab).catch(() => {}); });

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.title || changeInfo.status === 'complete') {
    writeTab(tab).catch(() => {});
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab) await writeTab(tab);
});

chrome.tabs.onMoved.addListener(async tabId => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab) await writeTab(tab);
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  const cache = await readCache();
  const previous = cache[String(tabId)];
  delete cache[String(tabId)];
  await chrome.storage.local.set({ [CACHE_KEY]: cache });

  if (intentionalCloseIds.has(tabId)) {
    intentionalCloseIds.delete(tabId);
    return;
  }

  // Whole-window/browser shutdown is left to the browser's own session restore.
  if (removeInfo.isWindowClosing || !previous || !isWebUrl(previous.url)) return;

  const lockState = await getLockState(previous.url);
  if (!lockState.locked) return;

  try {
    const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
    const targetWindow = windows.find(window => window.id === previous.windowId);
    const createOptions = {
      url: previous.url,
      active: true,
      pinned: previous.pinned
    };
    if (targetWindow) {
      createOptions.windowId = previous.windowId;
      createOptions.index = Math.max(0, Math.min(previous.index || 0, targetWindow.tabs?.length || 0));
    }

    const restored = await chrome.tabs.create(createOptions);
    await writeTab(restored);
  } catch (error) {
    console.warn('JTG could not recover a locked tab:', error);
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !tab?.id) return;
  const title = encodeURIComponent(tab.title || tab.url || 'Selected tab');
  const confirmUrl = chrome.runtime.getURL(`confirm.html?tabId=${tab.id}&title=${title}`);
  chrome.tabs.create({ url: confirmUrl, active: true });
});
