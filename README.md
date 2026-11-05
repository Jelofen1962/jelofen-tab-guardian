<!--
╭──────────────────────────────────────────────────────────────╮
│  JTG  |  JELOFEN'S TAB GUARDIAN                               │
│  Crafted by : Jelofen The Dev                                 │
│  Telegram   : https://t.me/Jelofen1962                        │
│  Contact    : +989035361164                                   │
╰──────────────────────────────────────────────────────────────╯
-->

# JTG - Jelofen's Tab Guardian

A minimal black-and-white Manifest V3 extension for Chrome and Microsoft Edge. JTG marks locked web tabs with a `🔒` prefix in the tab title, remembers global and per-site locking preferences, and automatically reopens individually closed locked tabs when the browser is still running.

**Crafted by:** Jelofen The Dev 

The requested Icons8 image is used as the clickable logo in the extension popup. If the image host is unavailable, the popup falls back to the bundled JTG icon. Chrome and Edge require toolbar / manifest icons to be packaged as local files, so the existing local icons remain in use for the browser toolbar.

## Features

- **Current tab:** Shows the active tab title, hostname, and effective lock status.
- **Global auto-lock:** Choose whether all websites are locked by default.
- **Saved per-site rules:** Set a separate locked or unlocked state for each hostname. A custom site rule overrides the global default and remains saved in local extension storage.
- **Lock marker:** Adds `🔒` to the beginning of a locked page's document title, which appears at the start of the browser tab label. The marker is removed when that site is unlocked.
- **Recovery:** If a locked tab is individually closed, JTG recreates it at its previous position when possible.
- **Persian / English UI:** Toggle between Persian RTL and English LTR. The language choice is saved.
- **Confirmed close:** A JTG item in the page context menu opens a confirmation screen for closing the current tab.
- **No external services:** Settings stay in `chrome.storage.local`; there is no analytics or remote server.

## Lock behavior

A website is identified by its exact hostname. For example, `shop.example.com` and `www.example.com` have separate rules. The effective lock is determined in this order:

1. If a custom rule exists for the hostname, use that locked/unlocked value.
2. Otherwise, use the global **Auto-lock all websites** setting.

Click **Use global setting** on the current tab to remove its custom rule and make it inherit the global default again.

## Important browser limitation

Chrome and Edge do not expose an extension API that can veto every native close action. JTG cannot guarantee blocking the tab-strip X, middle-click, native `Ctrl+W`, native tab context-menu actions, or browser exit before the browser closes the tab. Instead, it detects individual tab removal and immediately recreates a locked tab. Whole-window/browser shutdown is left to the browser's own session restore behavior. A hard browser or computer crash may occur before the latest tab state has been saved.

The lock marker changes the page's document title, not its favicon or the browser's built-in tab-lock state. Some restricted browser pages (such as `chrome://`, `edge://`, extension pages, and certain protected pages) cannot be marked or locked by this extension.

## Install unpacked

1. Extract the project archive.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the project folder containing `manifest.json`.
5. Pin JTG to the toolbar for quick access.

## Build a CRX with GitHub Actions

1. Create a GitHub repository and upload the project files.
2. Push to `main` / `master`, or open **Actions** and manually run **Build JTG Chrome/Edge CRX**.
3. Open the completed workflow run and download the `jtg-jelofens-tab-guardian` artifact.
4. The artifact contains the `.crx` package and a source ZIP.

For a stable extension ID across builds, create a private PEM signing key and add its base64-encoded contents as the repository Actions secret `CRX_PRIVATE_KEY_BASE64`. The workflow uses this key to sign the CRX but **never uploads the private key**. Without that secret, each workflow run generates a new signing identity, so the extension ID changes between builds. Keep your signing key in a secure backup; never commit it to GitHub.

## Permissions

- `tabs`: read tab titles and URLs, and recreate protected tabs.
- `storage`: save global settings, language choice, per-site rules, and tab recovery data.
- `contextMenus`: provide the JTG confirmed-close page action.
- `sessions`: restore a recently closed tab from the browser's recent session list.
- `scripting` and HTTP/HTTPS host access: apply the title marker to already-open pages when the extension is installed or its settings change.

The extension uses a content script on HTTP and HTTPS pages to add or remove the title prefix. It does not collect browsing data or send it off-device.
