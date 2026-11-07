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
const DEFAULT_SETTINGS = { globalAutoLock: false, siteRules: {}, language: 'fa', nativeCompanionMode: false };
const I18N = {
  fa: {
    subtitle: 'محافظ تب‌های مرورگر', currentTab: 'تب فعلی', openTabs: 'تب باز',
    locked: 'قفل‌شده', unlocked: 'بدون قفل', fromGlobal: 'پیروی از تنظیم سراسری',
    customRule: 'قانون اختصاصی این سایت', useGlobal: 'استفاده از تنظیم سراسری',
    globalTitle: 'قفل خودکار همه سایت‌ها', globalDesc: 'تب‌های وب به‌صورت پیش‌فرض قفل شوند.',
    savedRules: 'قوانین ذخیره‌شده', noRules: 'هنوز قانون اختصاصی ثبت نشده است.',
    restoreLast: 'بازیابی آخرین تب بسته‌شده',
    companionTitle: 'حالت ابزار ویندوز', companionDesc: 'فقط وقتی ابزار ویندوز JTG در حال اجراست روشن کنید؛ از نمایش دو پیام تأیید جلوگیری می‌کند.',
    limitation: 'برای گرفتن کلیک روی × و میانبرهای بستن، ابزار Windows را اجرا و حالت ابزار ویندوز را روشن کنید. بدون آن، Ctrl+W از پیام بومی مرورگر استفاده می‌کند.',
    unsupported: 'این صفحه قابل قفل‌گذاری نیست.', loading: 'در حال بررسی…',
    lock: 'قفل کن', unlock: 'بازکردن قفل', removeRule: 'حذف قانون اختصاصی',
    restoreNone: 'تب بسته‌شده‌ای برای بازیابی پیدا نشد.', restoreDone: 'تب بازیابی شد.',
    tabTitleFallback: 'بدون عنوان', lockedVerb: 'قفل', unlockedVerb: 'باز'
  },
  en: {
    subtitle: 'A calm layer of tab protection', currentTab: 'CURRENT TAB', openTabs: 'open tabs',
    locked: 'LOCKED', unlocked: 'UNLOCKED', fromGlobal: 'Following global setting',
    customRule: 'Custom rule for this site', useGlobal: 'Use global setting',
    globalTitle: 'Auto-lock all websites', globalDesc: 'Lock web tabs by default, including new tabs.',
    savedRules: 'SAVED SITE RULES', noRules: 'No custom site rules yet.',
    restoreLast: 'Restore last closed tab',
    companionTitle: 'Windows companion mode', companionDesc: 'Enable only while the JTG Windows helper is running; prevents duplicate confirmation dialogs.',
    limitation: 'To catch the tab-strip X and close shortcuts, run the Windows companion and enable Windows companion mode. Without it, Ctrl+W uses the browser’s native prompt.',
    unsupported: 'This page cannot be locked.', loading: 'Checking current tab…',
    lock: 'Lock site', unlock: 'Unlock site', removeRule: 'Remove custom rule',
    restoreNone: 'No recently closed tab was found.', restoreDone: 'Tab restored.',
    tabTitleFallback: 'Untitled tab', lockedVerb: 'Locked', unlockedVerb: 'Unlocked'
  }
};

const $ = id => document.getElementById(id);

// The requested Icons8 logo is remote; fall back to the bundled icon if it cannot load.
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
  // The background service worker listens for this storage change and refreshes lock markers.
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
  $('currentStatus').textContent = supported ? (locked ? t('locked') : t('unlocked')) : t('unsupported');
  $('currentStatus').classList.toggle('is-locked', locked);
  $('currentStatus').classList.toggle('is-unlocked', supported && !locked);
  $('currentMode').textContent = currentMode() === 'site' ? t('customRule') : t('fromGlobal');
  $('useGlobal').hidden = !supported || currentMode() === 'global';
}

function renderGlobal() {
  const on = Boolean(settings.globalAutoLock);
  $('globalToggle').classList.toggle('is-on', on);
  $('globalToggle').setAttribute('aria-checked', String(on));
  const companion = Boolean(settings.nativeCompanionMode);
  $('nativeModeToggle').classList.toggle('is-on', companion);
  $('nativeModeToggle').setAttribute('aria-checked', String(companion));
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

function render() {
  applyLanguage();
  renderCurrentTab();
  renderGlobal();
  renderRules();
  $('tabCount').textContent = String(window.__jtgTabCount ?? '—');
}

async function init() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const saved = stored[SETTINGS_KEY] || {};
  settings = {
    ...DEFAULT_SETTINGS,
    ...saved,
    siteRules: saved.siteRules && typeof saved.siteRules === 'object' ? { ...saved.siteRules } : {}
  };

  const tabs = await chrome.tabs.query({});
  window.__jtgTabCount = tabs.length;
  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeHost = getHost(activeTab?.url);
  render();
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

$('restoreLast').addEventListener('click', async () => {
  const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 1 });
  const entry = sessions[0];
  const url = entry?.tab?.url || entry?.window?.tabs?.[0]?.url;
  if (isWebUrl(url)) {
    await chrome.tabs.create({ url, active: true });
    $('restoreLast').textContent = t('restoreDone');
  } else {
    $('restoreLast').textContent = t('restoreNone');
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[SETTINGS_KEY]) return;
  const saved = changes[SETTINGS_KEY].newValue || {};
  settings = { ...DEFAULT_SETTINGS, ...saved, siteRules: { ...(saved.siteRules || {}) } };
  render();
});

init().catch(error => {
  console.error('JTG popup initialization failed:', error);
  $('currentTitle').textContent = 'JTG could not load tab details';
});
