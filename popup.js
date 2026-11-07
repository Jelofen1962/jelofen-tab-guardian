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
const DEFAULT_SETTINGS = {
  globalAutoLock: false,
  siteRules: {},
  language: 'fa',
  nativeCompanionMode: false,
  autoCheckUpdates: true
};

const GITHUB_RELEASE_PAGE = 'https://github.com/Jelofen1962/jelofen-tab-guardian/releases/latest';
const I18N = {
  fa: {
    subtitle: 'محافظ تب‌های مرورگر', currentTab: 'تب فعلی', openTabs: 'تب باز',
    locked: 'قفل‌شده', unlocked: 'بدون قفل', fromGlobal: 'پیروی از تنظیم سراسری',
    customRule: 'قانون اختصاصی این سایت', useGlobal: 'استفاده از تنظیم سراسری',
    globalTitle: 'قفل خودکار همه سایت‌ها', globalDesc: 'تب‌های وب به‌صورت پیش‌فرض قفل شوند.',
    savedRules: 'قوانین ذخیره‌شده', noRules: 'هنوز قانون اختصاصی ثبت نشده است.',
    restoreLast: 'بازیابی آخرین تب بسته‌شده',
    companionTitle: 'حالت ابزار ویندوز', companionDesc: 'هنگام اجرای ابزار ویندوز روشن کنید؛ ابزار فقط تب‌هایی را که نشانگر 🔒 دارند محافظت می‌کند.',
    limitation: 'ابزار ویندوز کلیک روی × و میانبرها را فقط برای تب‌های قفل‌شده و دارای نشانگر 🔒 بررسی می‌کند. بدون آن، تأیید بستن تابع محدودیت‌های Chromium است.',
    unsupported: 'این صفحه قابل قفل‌گذاری نیست.',
    lock: 'قفل کن', unlock: 'بازکردن قفل', removeRule: 'حذف قانون اختصاصی',
    restoreNone: 'تب بسته‌شده‌ای برای بازیابی پیدا نشد.', restoreDone: 'تب بازیابی شد.',
    tabTitleFallback: 'بدون عنوان', lockedVerb: 'قفل', unlockedVerb: 'باز',
    updateTitle: 'به‌روزرسانی JTG', currentVersion: 'نسخه نصب‌شده',
    autoUpdateTitle: 'بررسی خودکار به‌روزرسانی', autoUpdateDesc: 'هر ۶ ساعت و هنگام شروع مرورگر، انتشارهای GitHub بررسی شوند.',
    checkUpdates: 'بررسی اکنون', checkingUpdates: 'در حال بررسی…',
    updateCurrent: 'نسخه شما به‌روز است.', updateAvailable: 'نسخه جدید موجود است: ',
    updateOpen: 'مشاهده و دریافت نسخه جدید', updateFailed: 'بررسی به‌روزرسانی انجام نشد. اتصال GitHub را بررسی کنید.',
    updateNever: 'هنوز بررسی نشده است.', lastChecked: 'آخرین بررسی: ',
    updateNote: 'نصب خودکار خارج از فروشگاه مرورگر پشتیبانی نمی‌شود؛ برای نصب نسخه جدید باید فایل CRX را از انتشار GitHub دریافت کنید.',
    releaseUnavailable: 'اطلاعات نسخه در دسترس نیست.'
  },
  en: {
    subtitle: 'A calm layer of tab protection', currentTab: 'CURRENT TAB', openTabs: 'open tabs',
    locked: 'LOCKED', unlocked: 'UNLOCKED', fromGlobal: 'Following global setting',
    customRule: 'Custom rule for this site', useGlobal: 'Use global setting',
    globalTitle: 'Auto-lock all websites', globalDesc: 'Lock web tabs by default, including new tabs.',
    savedRules: 'SAVED SITE RULES', noRules: 'No custom site rules yet.',
    restoreLast: 'Restore last closed tab',
    companionTitle: 'Windows companion mode', companionDesc: 'Enable while the Windows helper is running; it protects tabs whose titles carry the 🔒 marker.',
    limitation: 'The Windows companion checks tab-strip X clicks and shortcuts only for locked tabs marked with 🔒. Without it, native confirmation depends on Chromium page restrictions.',
    unsupported: 'This page cannot be locked.',
    lock: 'Lock site', unlock: 'Unlock site', removeRule: 'Remove custom rule',
    restoreNone: 'No recently closed tab was found.', restoreDone: 'Tab restored.',
    tabTitleFallback: 'Untitled tab', lockedVerb: 'Locked', unlockedVerb: 'Unlocked',
    updateTitle: 'JTG updates', currentVersion: 'Installed version',
    autoUpdateTitle: 'Check for updates automatically', autoUpdateDesc: 'Check GitHub releases every 6 hours and when the browser starts.',
    checkUpdates: 'Check now', checkingUpdates: 'Checking…',
    updateCurrent: 'You are using the latest version.', updateAvailable: 'A newer version is available: ',
    updateOpen: 'View and download update', updateFailed: 'Update check failed. Check your connection to GitHub.',
    updateNever: 'No update check has run yet.', lastChecked: 'Last checked: ',
    updateNote: 'Chromium does not allow silent self-installation for manually installed extensions. Download the CRX from the GitHub release to update.',
    releaseUnavailable: 'Release information is unavailable.'
  }
};

const $ = id => document.getElementById(id);
const BRAND_LOGO_URL = 'https://img.icons8.com/?size=100&id=Ex69XW1yBKo2&format=png&color=000000';
const brandLogo = $('brandLogo');
if (brandLogo) {
  brandLogo.addEventListener('error', () => {
    brandLogo.onerror = null;
    brandLogo.src = 'icons/icon48.png';
    brandLogo.alt = 'JTG lock icon';
  }, { once: true });
  brandLogo.dataset.source = BRAND_LOGO_URL;
}

let settings = { ...DEFAULT_SETTINGS, siteRules: {} };
let activeTab = null;
let activeHost = '';
let updateInfo = null;
let checkingUpdates = false;

function t(key) { return (I18N[settings.language] || I18N.fa)[key] || key; }
function isWebUrl(url) { return typeof url === 'string' && /^https?:\/\//i.test(url); }
function getHost(url) {
  if (!isWebUrl(url)) return '';
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}
function effectiveLock(host) {
  if (host && Object.prototype.hasOwnProperty.call(settings.siteRules, host)) return Boolean(settings.siteRules[host]);
  return Boolean(settings.globalAutoLock);
}
function currentMode() {
  return activeHost && Object.prototype.hasOwnProperty.call(settings.siteRules, activeHost) ? 'site' : 'global';
}
async function saveSettings() {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

function applyLanguage() {
  const isFa = settings.language === 'fa';
  document.documentElement.lang = isFa ? 'fa' : 'en';
  document.documentElement.dir = isFa ? 'rtl' : 'ltr';
  document.body.dir = isFa ? 'rtl' : 'ltr';
  $('languageToggle').textContent = isFa ? 'EN' : 'فا';
  document.querySelectorAll('[data-i18n]').forEach(node => {
    node.textContent = t(node.dataset.i18n);
  });
}

function renderCurrentTab() {
  const supported = Boolean(activeHost);
  $('currentTitle').textContent = activeTab?.title || t('tabTitleFallback');
  $('currentHost').textContent = activeHost || (activeTab?.url || '—');
  $('currentHost').title = activeTab?.url || '';
  $('unsupportedNote').hidden = supported;
  $('siteLockToggle').disabled = !supported;
  $('useGlobal').disabled = !supported || currentMode() === 'global';

  const locked = supported && effectiveLock(activeHost);
  $('siteLockToggle').classList.toggle('is-on', locked);
  $('siteLockToggle').setAttribute('aria-checked', String(locked));
  $('siteLockToggle').setAttribute('aria-label', locked ? t('unlock') : t('lock'));
  $('currentStatus').textContent = supported ? (locked ? t('locked') : t('unlocked')) : t('unsupported');
  $('currentStatus').classList.toggle('is-locked', locked);
  $('currentStatus').classList.toggle('is-unlocked', supported && !locked);
  $('currentMode').textContent = currentMode() === 'site' ? t('customRule') : t('fromGlobal');
  $('useGlobal').hidden = !supported || currentMode() === 'global';
}

function renderSwitch(buttonId, value, label) {
  const button = $(buttonId);
  button.classList.toggle('is-on', Boolean(value));
  button.setAttribute('aria-checked', String(Boolean(value)));
  if (label) button.setAttribute('aria-label', label);
}

function renderGlobal() {
  renderSwitch('globalToggle', settings.globalAutoLock);
  renderSwitch('nativeModeToggle', settings.nativeCompanionMode);
  renderSwitch('autoUpdateToggle', settings.autoCheckUpdates);
}

function renderRules() {
  const entries = Object.entries(settings.siteRules || {}).sort(([a], [b]) => a.localeCompare(b));
  $('ruleCount').textContent = String(entries.length);
  $('rulesList').replaceChildren();
  $('emptyRules').hidden = entries.length > 0;

  for (const [host, locked] of entries) {
    const row = document.createElement('div');
    row.className = 'rule-row';

    const hostName = document.createElement('span');
    hostName.className = 'rule-host';
    hostName.textContent = host;
    hostName.title = host;

    const stateButton = document.createElement('button');
    stateButton.type = 'button';
    stateButton.className = `rule-state ${locked ? 'is-locked' : 'is-unlocked'}`;
    stateButton.textContent = locked ? t('lockedVerb') : t('unlockedVerb');
    stateButton.setAttribute('aria-label', `${host}: ${locked ? t('lockedVerb') : t('unlockedVerb')}`);
    stateButton.addEventListener('click', async () => {
      settings.siteRules[host] = !Boolean(settings.siteRules[host]);
      await saveSettings();
      render();
    });

    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'remove-rule';
    resetButton.textContent = '×';
    resetButton.title = t('removeRule');
    resetButton.setAttribute('aria-label', `${t('removeRule')}: ${host}`);
    resetButton.addEventListener('click', async () => {
      delete settings.siteRules[host];
      await saveSettings();
      render();
    });

    row.append(hostName, stateButton, resetButton);
    $('rulesList').append(row);
  }
}

function formatCheckTime(timestamp) {
  if (!timestamp) return '';
  const locale = settings.language === 'fa' ? 'fa-IR' : 'en-US';
  try { return new Date(timestamp).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return new Date(timestamp).toLocaleString(); }
}

function renderUpdates() {
  const installedVersion = chrome.runtime.getManifest().version;
  $('installedVersion').textContent = `v${installedVersion}`;
  renderSwitch('autoUpdateToggle', settings.autoCheckUpdates, t('autoUpdateTitle'));

  const status = $('updateStatus');
  const details = $('updateDetails');
  const openButton = $('openUpdate');
  openButton.hidden = true;
  openButton.disabled = false;

  if (checkingUpdates) {
    status.textContent = t('checkingUpdates');
    details.textContent = updateInfo?.checkedAt ? `${t('lastChecked')}${formatCheckTime(updateInfo.checkedAt)}` : '';
    $('checkUpdates').disabled = true;
    $('checkUpdates').textContent = t('checkingUpdates');
    return;
  }

  $('checkUpdates').disabled = false;
  $('checkUpdates').textContent = t('checkUpdates');

  if (!updateInfo) {
    status.textContent = t('updateNever');
    details.textContent = '';
    return;
  }

  if (updateInfo.updateAvailable) {
    status.textContent = `${t('updateAvailable')}v${updateInfo.latestVersion}`;
    openButton.hidden = false;
  } else if (updateInfo.error) {
    status.textContent = t('updateFailed');
  } else {
    status.textContent = t('updateCurrent');
  }

  details.textContent = updateInfo.checkedAt
    ? `${t('lastChecked')}${formatCheckTime(updateInfo.checkedAt)}`
    : t('releaseUnavailable');
}

function render() {
  applyLanguage();
  renderCurrentTab();
  renderGlobal();
  renderRules();
  renderUpdates();
  $('tabCount').textContent = String(window.__jtgTabCount ?? '—');
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const saved = stored[SETTINGS_KEY] || {};
  settings = {
    ...DEFAULT_SETTINGS,
    ...saved,
    siteRules: saved.siteRules && typeof saved.siteRules === 'object' && !Array.isArray(saved.siteRules)
      ? { ...saved.siteRules }
      : {}
  };
}

async function init() {
  const [storedUpdates] = await Promise.all([
    chrome.storage.local.get(UPDATE_INFO_KEY),
    loadSettings()
  ]);
  updateInfo = storedUpdates[UPDATE_INFO_KEY] || null;

  const tabs = await chrome.tabs.query({});
  window.__jtgTabCount = tabs.length;
  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeHost = getHost(activeTab?.url);
  render();
}

async function requestUpdateCheck() {
  checkingUpdates = true;
  renderUpdates();
  try {
    updateInfo = await chrome.runtime.sendMessage({ type: 'jtg-check-updates' });
  } catch (error) {
    updateInfo = {
      ...(updateInfo || {}),
      currentVersion: chrome.runtime.getManifest().version,
      checkedAt: Date.now(),
      error: String(error?.message || error)
    };
  } finally {
    checkingUpdates = false;
    renderUpdates();
  }
}

$('languageToggle').addEventListener('click', async () => {
  settings.language = settings.language === 'fa' ? 'en' : 'fa';
  await saveSettings();
  render();
});

$('globalToggle').addEventListener('click', async () => {
  settings.globalAutoLock = !settings.globalAutoLock;
  await saveSettings();
  render();
});

$('nativeModeToggle').addEventListener('click', async () => {
  settings.nativeCompanionMode = !settings.nativeCompanionMode;
  await saveSettings();
  render();
});

$('siteLockToggle').addEventListener('click', async () => {
  if (!activeHost) return;
  settings.siteRules[activeHost] = !effectiveLock(activeHost);
  await saveSettings();
  render();
});

$('useGlobal').addEventListener('click', async () => {
  if (!activeHost) return;
  delete settings.siteRules[activeHost];
  await saveSettings();
  render();
});

$('autoUpdateToggle').addEventListener('click', async () => {
  settings.autoCheckUpdates = !settings.autoCheckUpdates;
  await saveSettings();
  render();
});

$('checkUpdates').addEventListener('click', requestUpdateCheck);
$('openUpdate').addEventListener('click', () => {
  const url = updateInfo?.releaseUrl || GITHUB_RELEASE_PAGE;
  chrome.tabs.create({ url, active: true });
});

$('restoreLast').addEventListener('click', async () => {
  try {
    const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 1 });
    const entry = sessions[0];
    const url = entry?.tab?.url || entry?.window?.tabs?.[0]?.url;
    if (isWebUrl(url)) {
      await chrome.tabs.create({ url, active: true });
      $('restoreLast').textContent = t('restoreDone');
    } else {
      $('restoreLast').textContent = t('restoreNone');
    }
  } catch (error) {
    console.warn('JTG could not restore the last closed tab:', error);
    $('restoreLast').textContent = t('restoreNone');
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  if (changes[SETTINGS_KEY]) {
    const saved = changes[SETTINGS_KEY].newValue || {};
    settings = {
      ...DEFAULT_SETTINGS,
      ...saved,
      siteRules: saved.siteRules && typeof saved.siteRules === 'object' ? { ...saved.siteRules } : {}
    };
    render();
  }
  if (changes[UPDATE_INFO_KEY]) {
    updateInfo = changes[UPDATE_INFO_KEY].newValue || null;
    renderUpdates();
  }
});

init().catch(error => {
  console.error('JTG popup initialization failed:', error);
  $('currentTitle').textContent = 'JTG could not load tab details';
});
