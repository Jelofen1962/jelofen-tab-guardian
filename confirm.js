/*
╭──────────────────────────────────────────────────────────────╮
│  JTG  |  JELOFEN'S TAB GUARDIAN                               │
│  Crafted by : Jelofen The Dev                                 │
│  Telegram   : https://t.me/Jelofen1962                        │
│  Contact    : +989035361164                                   │
╰──────────────────────────────────────────────────────────────╯
*/
'use strict';

const params = new URLSearchParams(location.search);
const tabId = Number(params.get('tabId'));
document.getElementById('tabTitle').textContent = params.get('title') || 'Selected tab';

document.getElementById('cancel').addEventListener('click', () => window.close());
document.getElementById('confirm').addEventListener('click', async () => {
  if (Number.isInteger(tabId) && tabId > 0) {
    await chrome.runtime.sendMessage({ type: 'jtg-allow-close', tabId });
    await chrome.tabs.remove(tabId).catch(() => {});
  }
  window.close();
});
