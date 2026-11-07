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
const UPDATE_INFO_KEY = 'jtgUpdateInfo';
const UPDATE_ALARM = 'jtg-periodic-update-check';
const CONTEXT_MENU_ID = 'jtg-close-confirmed';
const GITHUB_RELEASE_API = 'https://api.github.com/repos/Jelofen1962/jelofen-tab-guardian/releases/latest';
const GITHUB_RELEASE_PAGE = 'https://github.com/Jelofen1962/jelofen-tab-guardian/releases/latest';

const DEFAULT_SETTINGS = Object.freeze({
  globalAutoLock: false,
  siteRules: {},
  language: 'fa',
  nativeCompanionMode: false,
  autoCheckUpdates: true
});

function isWebUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

function getHost(url) {
  if (!isWebUrl(url)) return '';
  try { return new URL(url).hostname.toLowerCase(); }
  catch { return ''; }
}

function compareVersions(left, right) {
  const a = String(left).replace(/^v/i, '').split('.').map(part => Number.parseInt(part, 10) || 0);
  const b = String(right).replace(/^v/i, '').split('.').map(part => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference !== 0) return difference > 0 ? 1 : -1;
  }
  return 0;
}

async function getSettings() {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  const saved = data[SETTINGS_KEY] || {};
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    siteRules: saved.siteRules && typeof saved.siteRules === 'object' && !Array.isArray(saved.siteRules)
      ? saved.siteRules
      : {}
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

async function applyLockStateToTab(tab) {
  if (!tab?.id || !isWebUrl(tab.url)) return;
  const state = await getLockState(tab.url);

  // Inject the controller only for tabs that are currently locked. If a tab was
  // locked earlier, its existing controller receives the unlocked state below
  // and detaches its event listeners and MutationObserver.
  if (state.locked) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['title-lock.js'],
      injectImmediately: true
    }).catch(() => {});
  }

  await chrome.tabs.sendMessage(tab.id, { type: 'jtg-lock-state', ...state }).catch(() => {});
}

async function broadcastLockStates() {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map(tab => applyLockStateToTab(tab)));
}

async function configureUpdateAlarm() {
  const settings = await getSettings();
  await chrome.alarms.clear(UPDATE_ALARM);
  if (settings.autoCheckUpdates) {
    await chrome.alarms.create(UPDATE_ALARM, { periodInMinutes: 360 });
  }
}

async function checkForUpdates() {
  const currentVersion = chrome.runtime.getManifest().version;
  const response = await fetch(GITHUB_RELEASE_API, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`);

  const release = await response.json();
  const latestVersion = String(release.tag_name || '').replace(/^v/i, '');
  if (!/^\d+(\.\d+){1,3}$/.test(latestVersion)) {
    throw new Error('The latest GitHub release does not have a valid version tag.');
  }

  const packageAsset = Array.isArray(release.assets)
    ? release.assets.find(asset => String(asset.name || '').toLowerCase().endsWith('.zip'))
    : null;
  const updateInfo = {
    currentVersion,
    latestVersion,
    updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
    releaseUrl: release.html_url || GITHUB_RELEASE_PAGE,
    downloadUrl: packageAsset?.browser_download_url || null,
    releaseName: release.name || `JTG v${latestVersion}`,
    checkedAt: Date.now(),
    error: ''
  };

  await chrome.storage.local.set({ [UPDATE_INFO_KEY]: updateInfo });
  return updateInfo;
}

async function storeUpdateCheckError(error) {
  const currentVersion = chrome.runtime.getManifest().version;
  const existing = (await chrome.storage.local.get(UPDATE_INFO_KEY))[UPDATE_INFO_KEY] || {};
  const updateInfo = {
    ...existing,
    currentVersion,
    checkedAt: Date.now(),
    error: String(error?.message || error || 'Update check failed.')
  };
  await chrome.storage.local.set({ [UPDATE_INFO_KEY]: updateInfo });
  return updateInfo;
}

async function setUpdateBadge(updateInfo) {
  const available = Boolean(updateInfo?.updateAvailable);
  await chrome.action.setBadgeBackgroundColor({ color: '#111111' }).catch(() => {});
  await chrome.action.setBadgeText({ text: available ? 'NEW' : '' }).catch(() => {});
}

async function runUpdateCheck() {
  try {
    const updateInfo = await checkForUpdates();
    await setUpdateBadge(updateInfo);
    return updateInfo;
  } catch (error) {
    console.warn('JTG update check failed:', error);
    const updateInfo = await storeUpdateCheckError(error);
    await setUpdateBadge(updateInfo);
    return updateInfo;
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  // Migrate settings without discarding previously saved site-specific rules.
  const settings = await getSettings();
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  await configureUpdateAlarm();

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'JTG: close this tab with confirmation',
      contexts: ['page', 'frame']
    });
  });

  await broadcastLockStates();
  if (settings.autoCheckUpdates) await runUpdateCheck();
});

chrome.runtime.onStartup.addListener(async () => {
  const settings = await getSettings();
  await broadcastLockStates();
  if (settings.autoCheckUpdates) await runUpdateCheck();
});

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== UPDATE_ALARM) return;
  const settings = await getSettings();
  if (settings.autoCheckUpdates) await runUpdateCheck();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    applyLockStateToTab(tab).catch(error => console.warn('JTG tab state update failed:', error));
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'jtg-get-lock-state') {
    getLockState(sender.tab?.url || '')
      .then(sendResponse)
      .catch(() => sendResponse({ locked: false, host: '', mode: 'unsupported', nativeCompanionMode: false }));
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

  if (message?.type === 'jtg-check-updates') {
    runUpdateCheck().then(sendResponse).catch(() => sendResponse({ error: 'Update check failed.' }));
    return true;
  }

  return false;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  if (changes[SETTINGS_KEY]) {
    broadcastLockStates().catch(error => console.warn('JTG lock refresh failed:', error));
    configureUpdateAlarm().catch(error => console.warn('JTG update alarm setup failed:', error));
  }
  if (changes[UPDATE_INFO_KEY]) {
    setUpdateBadge(changes[UPDATE_INFO_KEY].newValue).catch(error => console.warn('JTG update badge failed:', error));
  }
});

// JTG never closes and reopens a tab to simulate a confirmation. Locked pages
// use beforeunload where Chromium permits it; the Windows companion is the
// optional best-effort route for native tab-strip close-button clicks.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !tab?.id) return;
  const title = encodeURIComponent(tab.title || tab.url || 'Selected tab');
  const confirmUrl = chrome.runtime.getURL(`confirm.html?tabId=${tab.id}&title=${title}`);
  chrome.tabs.create({ url: confirmUrl, active: true });
});
