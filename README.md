<!--
╭──────────────────────────────────────────────────────────────╮
│  JTG  |  JELOFEN'S TAB GUARDIAN                               │
│  Crafted by : Jelofen The Dev                                 │
│  Telegram   : https://t.me/Jelofen1962                        │
│  Contact    : +989035361164                                   │
╰──────────────────────────────────────────────────────────────╯
-->

# JTG - Jelofen's Tab Guardian

**Version:** 1.3.0

A minimal black-and-white Manifest V3 extension for Chrome and Microsoft Edge. JTG marks locked web tabs with a `🔒` prefix in the tab title, remembers global and per-site locking preferences, and asks for confirmation before a locked page is unloaded using Chromium's native leave-site dialog.

**Crafted by:** Jelofen The Dev  
**Telegram:** [t.me/Jelofen1962](https://t.me/Jelofen1962)  
**Contact:** +989035361164  
**Logo source:** [Icons8 logo PNG](https://img.icons8.com/?size=100&id=Ex69XW1yBKo2&format=png&color=000000)

## What changed in v1.3.0

- Added an optional **Windows companion** under `windows-guard/` that uses Windows UI Automation and low-level mouse/keyboard hooks to catch Chrome/Edge tab-strip close-button clicks and common close shortcuts.
- When it catches a tab close-button click, it swallows the original click and asks **Stay / Close tab**. If approved, it replays the original mouse click at the same screen position, so clicking the X on a background tab still targets that background tab.
- The Windows helper also attempts to catch middle-clicks on tabs, `Ctrl+W`, `Ctrl+F4`, `Ctrl+Shift+W`, and `Alt+F4`.
- Added a **Windows companion mode** switch in the extension. Enable it while the Windows helper is running to suppress page-level `beforeunload` prompts and avoid two confirmation dialogs for one close action.
- Added a Windows x64 GitHub Actions build that produces a self-contained helper ZIP in a separate artifact.
- The extension's existing `beforeunload` guard remains in place for supported web pages and keyboard-driven close attempts.

## Extension features

- **Current tab:** Shows the active tab title, hostname, and effective lock status.
- **Global auto-lock:** Choose whether all websites are locked by default.
- **Saved per-site rules:** Set a separate locked or unlocked state for each hostname. A custom site rule overrides the global default and remains saved in local extension storage.
- **Lock marker:** Adds `🔒` to the beginning of a locked page's document title, which appears at the start of the browser tab label. The marker is removed when that site is unlocked.
- **Browser confirmation:** A locked page registers a `beforeunload` handler. When Chromium permits the prompt, choosing **Stay** keeps the tab open and choosing **Leave** closes it. The same handler can run on reload or navigation too.
- **Windows tab-strip X guard:** The separate companion attempts to intercept the native tab close-button click before Chromium receives it.
- **Persian / English UI:** Toggle between Persian RTL and English LTR. The language choice is saved.
- **Confirmed close:** A JTG item in the page context menu opens a confirmation screen for closing the current tab.
- **No external services:** Extension settings stay in `chrome.storage.local`; there is no analytics or remote server.

## Important: why the Windows companion is separate

Chrome and Edge do **not** expose a supported extension API that lets an extension cancel the native tab-strip X click. `chrome.tabs.onRemoved` runs only after the tab is already gone, and `beforeunload` can be suppressed by Chromium (for example, when a page has not received user activation). This is why a normal extension cannot guarantee a prompt for every X click, especially on an inactive tab.

The optional Windows helper uses operating-system mouse/keyboard interception plus the browser's Windows UI Automation tree to identify tab close-button hit areas. This is a **best-effort workaround**, not a browser-supported integration. It can be affected by Chrome/Edge UI changes, browser language, unusual scaling, vertical-tabs layouts, custom title-bar modes, remote desktop, or accessibility-tree differences. It has not been tested on every browser build or Windows configuration. If it does not detect the X on a particular setup, the diagnostic log can help identify the issue.

**Scope of the Windows helper:** while it is running and enabled, it asks before closing **any** Chrome/Edge tab using the detected tab-strip X or supported close shortcut, regardless of JTG's per-site lock rule. It currently does not read JTG's site rules.

**Important setup to avoid duplicate prompts:** start `JTG.TabCloseGuard.exe`, open the JTG extension popup, and turn on **Windows companion mode**. That setting disables the page-level `beforeunload` prompt so the Windows helper can provide one consistent confirmation for the detected mouse and keyboard close actions. Turn the setting back off when you exit the helper; otherwise browser-level page confirmation remains disabled while the helper is not running.

The helper is Windows x64 only. It cannot prevent browser crashes, OS shutdown, Task Manager termination, or every possible close route. Run it as your normal user; it does not request administrator privileges.

## Run the Windows companion

### Build locally

Install the .NET 8 SDK on Windows, then open PowerShell in the project root and run:

```powershell
dotnet publish .\windows-guard\JTG.TabCloseGuard.csproj `
  --configuration Release `
  --runtime win-x64 `
  --self-contained true `
  -p:PublishSingleFile=true `
  -p:IncludeNativeLibrariesForSelfExtract=true `
  --output .\windows-guard\publish
```

Run:

```powershell
.\windows-guard\publish\JTG.TabCloseGuard.exe
```

A shield icon appears in the Windows system tray. Right-click it to pause protection, open the diagnostic log, or exit. Double-click the tray icon to see the current detection count. Then turn on **Windows companion mode** in the JTG extension popup. The helper also confirms `Ctrl+W`, `Ctrl+F4`, `Ctrl+Shift+W`, and `Alt+F4` while it is enabled.

The diagnostic log is saved to:

```text
%LOCALAPPDATA%\JTG\TabCloseGuard.log
```

### Download a prebuilt helper from GitHub Actions

1. Push the project to GitHub.
2. Open **Actions** and run **Build JTG Extension and Windows Companion** (or push to `main` / `master`).
3. Download the artifact named `jtg-windows-tab-close-guard-win-x64`.
4. Extract the ZIP and run `JTG.TabCloseGuard.exe`.

A separate artifact named `jtg-chrome-edge-extension` contains the `.crx` and extension source ZIP.

## Install the extension unpacked

1. Extract the project archive.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the project folder containing `manifest.json`.
5. Pin JTG to the toolbar for quick access.

## Build a CRX with GitHub Actions

1. Create a GitHub repository and upload the project files.
2. Push to `main` / `master`, or manually run **Build JTG Extension and Windows Companion** from **Actions**.
3. Download the `jtg-chrome-edge-extension` artifact.
4. The artifact contains the `.crx` package and a source ZIP.

For a stable extension ID across builds, create a private PEM signing key and add its base64-encoded contents as the repository Actions secret `CRX_PRIVATE_KEY_BASE64`. The workflow uses this key to sign the CRX but **never uploads the private key**. Without that secret, each workflow run generates a new signing identity, so the extension ID changes between builds. Keep your signing key in a secure backup; never commit it to GitHub.

## Lock behavior

A website is identified by its exact hostname. For example, `shop.example.com` and `www.example.com` have separate rules. The effective lock is determined in this order:

1. If a custom rule exists for the hostname, use that locked/unlocked value.
2. Otherwise, use the global **Auto-lock all websites** setting.

Click **Use global setting** on the current tab to remove its custom rule and make it inherit the global default again.

## Permissions

- `tabs`: read tab titles and URLs, and support the explicit confirmation-page close action.
- `storage`: save global settings, language choice, and per-site rules.
- `contextMenus`: provide the JTG confirmed-close page action.
- `sessions`: restore a recently closed tab from the browser's recent session list.
- `scripting` and HTTP/HTTPS host access: apply the title marker to already-open pages when the extension is installed or its settings change.

The extension uses a content script on HTTP and HTTPS pages to add or remove the title prefix and register the page-level close guard. It does not collect browsing data or send it off-device.
