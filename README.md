<!--
╭──────────────────────────────────────────────────────────────╮
│  JTG  |  JELOFEN'S TAB GUARDIAN                               │
│  Crafted by : Jelofen The Dev                                 │
│  Telegram   : https://t.me/Jelofen1962                        │
│  Contact    : +989035361164                                   │
╰──────────────────────────────────────────────────────────────╯
-->

<div align="center">
  <img src="https://img.icons8.com/?size=100&id=Ex69XW1yBKo2&format=png&color=000000" width="76" height="76" alt="JTG logo">
  <h1>JTG — Jelofen's Tab Guardian</h1>
  <p><strong>A lightweight, bilingual tab-locking extension for Google Chrome and Microsoft Edge.</strong></p>
  <p>
    <a href="https://github.com/Jelofen1962/jelofen-tab-guardian/releases/latest"><img src="https://img.shields.io/github/v/release/Jelofen1962/jelofen-tab-guardian?display_name=tag&style=flat-square" alt="Latest release"></a>
    <a href="https://github.com/Jelofen1962/jelofen-tab-guardian/actions/workflows/build-crx.yml"><img src="https://img.shields.io/github/actions/workflow/status/Jelofen1962/jelofen-tab-guardian/build-crx.yml?branch=main&style=flat-square&label=release%20build" alt="Release build"></a>
    <img src="https://img.shields.io/badge/Manifest-V3-111111?style=flat-square" alt="Manifest V3">
    <img src="https://img.shields.io/badge/Chrome-Edge-111111?style=flat-square" alt="Chrome and Edge">
    <img src="https://img.shields.io/badge/UI-English%20%2F%20Persian-111111?style=flat-square" alt="English and Persian UI">
  </p>
  <p>
    <a href="https://github.com/Jelofen1962/jelofen-tab-guardian/releases/latest">Latest release</a>
    ·
    <a href="https://github.com/Jelofen1962/jelofen-tab-guardian/issues">Report a problem</a>
    ·
    <a href="https://t.me/Jelofen1962">Contact the developer</a>
  </p>
</div>

---

## Overview

JTG helps prevent accidental tab closures by applying persistent lock rules to websites. A locked page displays a `🔒` marker at the beginning of its browser-tab title and registers a page-level unload confirmation where Chromium permits it. Unlocking a website immediately removes the marker and detaches JTG's page-level confirmation handler.

The extension includes a compact monochrome interface, Persian right-to-left (RTL) and English left-to-right (LTR) layouts, saved per-host rules, optional global auto-locking, and GitHub release update checks. An optional Windows companion provides a best-effort confirmation layer for native browser tab-strip close controls.

> **Browser limitation:** Chrome and Edge do not expose an extension API that can cancel every native tab-strip close action. The extension's `beforeunload` guard is subject to Chromium's user-activation and browser rules. The Windows companion is an optional operating-system-level workaround, not a guaranteed browser integration.

## At a glance

| Capability | Details |
|---|---|
| Browser support | Chromium-based Google Chrome and Microsoft Edge |
| Extension platform | Manifest V3 |
| Lock rules | Global default plus persistent per-host overrides |
| Unlocked behavior | No JTG `beforeunload` prompt; title marker removed |
| Locked behavior | `🔒` title marker and native unload confirmation where supported |
| Languages | Persian (RTL) and English (LTR) |
| Typography | Prefers the locally installed Vazirmatn font, with system sans-serif fallbacks |
| Update checks | GitHub Releases on startup, every six hours, and on demand |
| Windows companion | Optional Windows x64 helper; best-effort tab-strip interception |
| Data handling | Settings remain in local extension storage; no analytics service |

## Features

### Dynamic site locking

- **Lock the current website:** Apply a custom rule to the active tab's hostname.
- **Unlock the current website:** Remove the close-confirmation handler and title marker immediately.
- **Global auto-lock:** Choose whether websites are locked by default, including newly opened web pages.
- **Per-site overrides:** A saved site rule takes precedence over the global default. This supports both explicitly locked sites and explicitly unlocked exceptions.
- **Use global setting:** Delete a site's custom rule and let it inherit the global setting again.
- **Persistent storage:** Global preferences, language, Windows companion mode, update preferences, and hostname rules are stored with `chrome.storage.local` and survive browser restarts and extension updates that retain the same extension identity.

### Dynamic page controller

JTG injects its page controller into web tabs that are currently locked. When a site becomes unlocked, the controller:

1. Removes its `beforeunload` event listener.
2. Disconnects its document-title `MutationObserver`.
3. Removes the `🔒` prefix from the page title.
4. Stops applying lock behavior until the site is locked again.

Chromium does not provide an API for forcibly unloading JavaScript that has already been injected into a document. For this reason, an already-injected controller remains dormant in that page until navigation or tab closure; its active protection listeners and observer are detached when unlocked.

### Close confirmation

- **Locked pages:** Use the browser's native leave-site prompt when `beforeunload` is honored by Chromium.
- **Unlocked pages:** JTG does not register a `beforeunload` handler, so JTG itself does not ask for confirmation when an unlocked page closes.
- **Confirmed-close menu:** The JTG page context-menu item opens a dedicated confirmation page before requesting the tab closure.
- **No close-and-reopen behavior:** JTG does not close a tab and then recreate it as a substitute for a confirmation prompt.

Chromium may suppress `beforeunload` prompts in some situations, including pages without qualifying user activation. The prompt can also appear for reloads or navigation, not only for tab closure.

### Windows companion (optional)

The `windows-guard/` project contains a Windows x64 helper that attempts to detect Chrome and Edge tab-strip close targets through Windows UI Automation and intercept supported mouse and keyboard actions before replaying them after confirmation.

The companion is a **best-effort workaround**. Its detection can be affected by browser UI updates, display scaling, vertical-tab layouts, title-bar settings, accessibility-tree changes, remote desktop sessions, and other Windows configurations. It cannot protect against browser crashes, operating-system shutdown, Task Manager termination, or every possible close route.

The companion uses the `🔒` prefix in each tab's accessible title as its lock signal. It therefore attempts to intercept the close button only for locked tabs; `Ctrl+W` and `Ctrl+F4` are checked against the selected tab, while window-close shortcuts are checked when the window contains at least one locked tab. If a browser build does not expose the title marker through Windows UI Automation, detection may not work for that tab. To avoid duplicate prompts, run `JTG.TabCloseGuard.exe` and enable **Windows companion mode** in the extension. Disable that setting when the helper is not running so locked pages can use the normal page-level confirmation again.

### GitHub update checks

- Checks the repository's latest published GitHub Release when the browser starts.
- Checks again every six hours while automatic update checks are enabled.
- Provides a manual **Check now** action in the extension popup.
- Displays the installed version and latest release version, with a link to the release page when an update is available.
- Adds a `NEW` badge to the JTG toolbar icon when a newer release is detected.

JTG does **not** silently download or install its own CRX. Chromium restricts silent self-installation for manually installed extensions. When an update is found, review the GitHub Release and install the new CRX using the browser's supported installation method. The update checker is a notification mechanism, not a forced-update or remote-code mechanism.

## User interface

The popup uses a minimal black-and-white visual system and supports:

- Current tab title, hostname, open-tab count, and effective lock state.
- Per-site lock toggle and a **Use global setting** reset action.
- Global auto-lock switch.
- A saved list of custom hostname rules that can be changed or removed.
- Windows companion mode switch.
- Automatic and manual GitHub update checks.
- Persian RTL / English LTR language toggle.

The stylesheet prioritizes **Vazirmatn**. If Vazirmatn is not installed on the operating system, the browser uses the listed system sans-serif fallback fonts.

## Installation

### Load the extension for development

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the repository directory containing `manifest.json`.
6. Pin JTG to the browser toolbar for convenient access.

After changing extension source files, return to the extensions page and select **Reload**. A page controller that is already running in an open tab may need that tab to be refreshed before testing changes to the controller source.

### Install a packaged release

1. Open the [latest GitHub Release](https://github.com/Jelofen1962/jelofen-tab-guardian/releases/latest).
2. Download the versioned `.crx` asset.
3. Follow the installation method permitted by your browser and device policy. Some Chrome and Edge configurations restrict installing CRX files from outside their extension stores; in those environments, use **Load unpacked** for development or distribute through the relevant extension store or enterprise policy.

## Usage

### Lock or unlock the current site

1. Open the website you want to manage.
2. Select the JTG toolbar icon.
3. Use the current-tab switch to lock or unlock that hostname.
4. The lock marker and close-confirmation behavior update without requiring a page reload in normal supported pages.

### Understand rule precedence

JTG uses the exact hostname as the rule key. For example, `shop.example.com` and `www.example.com` are separate hosts.

The effective state is resolved in this order:

1. **Custom site rule:** If one exists, its `true` or `false` value wins.
2. **Global auto-lock:** If no custom rule exists, JTG uses the global default.

A custom `false` rule is an explicit unlocked exception, even when global auto-lock is enabled. Select **Use global setting** to delete that exception and inherit the global default again.

### Configure the Windows companion

1. Build or obtain `JTG.TabCloseGuard.exe` using the instructions below.
2. Start the helper as your normal Windows user.
3. Open the JTG popup and enable **Windows companion mode**.
4. To return to page-level confirmation, turn Windows companion mode off before exiting the helper.

The helper's tray menu provides protection controls and access to its diagnostic log. It filters its tab-close targets using the `🔒` marker, so an unlocked tab is not intentionally intercepted. The log is stored at:

```text
%LOCALAPPDATA%\JTG\TabCloseGuard.log
```

## Build the Windows companion locally

Requirements: Windows x64 and the .NET 8 SDK.

From the repository root, run PowerShell:

```powershell
dotnet publish .\windows-guard\JTG.TabCloseGuard.csproj `
  --configuration Release `
  --runtime win-x64 `
  --self-contained true `
  -p:PublishSingleFile=true `
  -p:IncludeNativeLibrariesForSelfExtract=true `
  --output .\windows-guard\publish
```

Start the helper:

```powershell
.\windows-guard\publish\JTG.TabCloseGuard.exe
```

The GitHub Actions workflow compiles the Windows companion as a validation step, but it does not upload or publish a Windows binary. Its only release asset is the versioned CRX. Build the helper locally using the command above when you need the executable.

## GitHub Releases and CRX signing

The workflow at `.github/workflows/build-crx.yml`:

1. Runs on pushes to `main` or `master`, and supports manual dispatch.
2. Compiles the Windows companion on a Windows runner as a source-validation step, without uploading its binary.
3. Reads the extension version directly from `manifest.json`.
4. Validates the manifest and required extension files.
5. Packages a Chrome-compatible `.crx` file.
6. Creates or updates the matching versioned GitHub Release and uploads **only the CRX asset**.

The release tag and asset name follow the manifest version. For example, version `1.4.0` produces tag `v1.4.0` and asset `JTG-Jelofens-Tab-Guardian-v1.4.0.crx`.

### Keep the extension ID stable

For repeatable CRX identity, configure a repository Actions secret named `CRX_PRIVATE_KEY_BASE64` containing the base64-encoded bytes of the extension's private PEM signing key.

Generate the secret value in PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes(".\your-extension-key.pem"))
```

Add the output in **GitHub → Settings → Secrets and variables → Actions → New repository secret**.

The workflow uses this secret only for packaging and does not upload the PEM file. Keep the original key backed up securely and never commit it to the repository. If the secret is omitted, each build can use a newly generated signing identity, which can change the extension ID and prevent a packaged update from being recognized as the same extension.

### Publish a new version

1. Update `version` in `manifest.json` using a valid dotted numeric version, such as `1.4.1`.
2. Commit and push to `main` or `master`.
3. Review the **Release JTG Chrome / Edge CRX** workflow run.
4. Open the matching GitHub Release and verify the versioned `.crx` asset.

The extension's update checker reads the latest published release from the same GitHub repository.

## Permissions and data handling

| Permission | Why JTG uses it |
|---|---|
| `tabs` | Read active tab URL/title and support the explicit confirmed-close action. |
| `storage` | Persist global preferences, per-host rules, language, companion mode, and update status. |
| `contextMenus` | Add the JTG confirmed-close page context-menu item. |
| `sessions` | Offer restoration of the most recently closed tab. |
| `scripting` | Inject the page controller into currently locked HTTP/HTTPS tabs. |
| `alarms` | Schedule periodic GitHub release checks. |
| HTTP/HTTPS host access | Apply lock behavior to websites managed by the user. |
| `https://api.github.com/*` | Read public release metadata for the update checker. |
| `https://img.icons8.com/*` | Display the linked Icons8 logo in the popup; a bundled icon is used as a fallback. |

JTG stores its preferences locally through `chrome.storage.local`. It does not send tab URLs, page titles, or browsing history to a JTG server. The update checker contacts GitHub to retrieve public release metadata; opening a release page or downloading its CRX is initiated by the user.

## Troubleshooting

| Issue | What to check |
|---|---|
| A locked tab does not show `🔒` | Confirm the hostname is locked, then refresh the page and reopen the popup. Some browser-internal and restricted pages cannot be scripted. |
| An unlocked tab still shows `🔒` | Reopen the JTG popup to refresh state. If the page title is controlled by a framework, refresh the page after unlocking. |
| No native leave-site prompt appears | Chromium may require prior user interaction with the page and may suppress prompts in some contexts. Use the Windows companion for its supported native tab-strip interception. |
| The same site behaves differently on `www` and non-`www` | Rules are keyed by exact hostname. Add or remove a rule for each hostname as needed. |
| Update check fails | Check internet access, GitHub availability, and whether the API rate limit has been reached. Manual checks use the public GitHub Releases API. |
| Packaged update changes the extension ID | Confirm the same `CRX_PRIVATE_KEY_BASE64` secret is configured and that the original PEM key has not changed. |
| Windows helper misses a tab close button | Review `%LOCALAPPDATA%\JTG\TabCloseGuard.log`; browser layout, scaling, and UI Automation changes can affect detection. |

## Project structure

```text
jelofen-tab-guardian/
├── .github/
│   └── workflows/
│       └── build-crx.yml
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── windows-guard/
│   ├── JTG.TabCloseGuard.csproj
│   ├── Program.cs
│   ├── app.manifest
│   └── build.ps1
├── background.js
├── confirm.html
├── confirm.js
├── manifest.json
├── popup.html
├── popup.js
├── title-lock.js
└── ui.css
```

## Changelog

### v1.4.0

- Made lock behavior dynamic: unlocking a site immediately detaches JTG's unload-confirmation handler and title observer, and removes the lock marker.
- Made the Windows companion lock-aware by using the tab's `🔒` accessible title marker to filter tab-strip clicks and supported close shortcuts.
- Changed the background worker to inject the page controller only into tabs that are currently locked.
- Preserved existing per-host rules during settings migration and extension updates.
- Added scheduled and manual GitHub latest-release checks, with an update notice and release link in the popup.
- Added the Vazirmatn-first font stack and refined the update controls for both RTL and LTR layouts.
- Kept the GitHub release workflow focused on publishing a versioned CRX asset only.

### v1.3.0

- Introduced the optional Windows tab-strip close guard companion.
- Added Windows companion mode to prevent duplicate page-level and helper confirmation prompts.
- Added versioned CRX publishing through GitHub Actions.

## Developer

<div align="center">
  <strong>Jelofen The Dev</strong><br>
  <a href="https://t.me/Jelofen1962">Telegram: @Jelofen1962</a><br>
  Contact: <a href="tel:+989035361164">+989035361164</a>
</div>

**Logo credit:** [Icons8](https://img.icons8.com/?size=100&id=Ex69XW1yBKo2&format=png&color=000000)

---

<div align="center">
  <sub>JTG — Jelofen's Tab Guardian · Crafted by Jelofen The Dev</sub>
</div>
