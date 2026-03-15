

<div align="center">

<img src="assets/icons/icon128.png" alt="FB Friend Manager Pro" width="80" height="80"/>

# FB Friend Manager Pro

**Smarter Facebook friend requests — without the risk.**

Automate bulk friend request sending, accepting, and withdrawing with
Gaussian-distributed timing, Bézier mouse simulation, and a visual selector
picker that adapts to Facebook DOM changes automatically.

[![Version](https://img.shields.io/github/v/release/Rakibul-Hashan/fb-friend-manager-pro?color=14b8a6&label=version&style=flat-square)](https://github.com/Rakibul-Hashan/fb-friend-manager-pro/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/Rakibul-Hashan/fb-friend-manager-pro/total?color=14b8a6&style=flat-square)](https://github.com/Rakibul-Hashan/fb-friend-manager-pro/releases)
[![License](https://img.shields.io/github/license/Rakibul-Hashan/fb-friend-manager-pro?color=eab308&style=flat-square)](LICENSE)
[![Chrome](https://img.shields.io/badge/Chrome-Manifest%20V3-14b8a6?style=flat-square&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)

[**⬇ Download Latest**](https://github.com/Rakibul-Hashan/fb-friend-manager-pro/releases/latest/download/fb-friend-manager-pro.zip)
&nbsp;·&nbsp;
[**🌐 Landing Page**](https://Rakibul-Hashan.github.io/fb-friend-manager-pro)
&nbsp;·&nbsp;
[**☕ Buy Me a Coffee**](https://www.buymeacoffee.com/rakibulhashanrabbi)
&nbsp;·&nbsp;
[**🐛 Report a Bug**](https://github.com/Rakibul-Hashan/fb-friend-manager-pro/issues)

</div>

---

> ⚠️ **Disclaimer:** Automating actions on Facebook may violate their
> [Terms of Service (Section 3.2)](https://www.facebook.com/terms.php).
> This tool is provided for **educational purposes only**. Use at your own
> risk. The author takes no responsibility for account restrictions or bans.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎯 **Visual Selector Picker** | Click any button on Facebook — the extension captures its most stable selector automatically. Survives FB DOM updates. |
| 📤 **Bulk Send Requests** | Auto-send friend requests on the Suggestions page with human-like behavior |
| ✅ **Bulk Accept Requests** | Accept all incoming requests in one click, with blacklist filtering |
| 🔄 **Auto-Withdraw Sent** | Cancel old pending requests to stay under Facebook's ~1000 limit |
| ⏱ **Gaussian Timing Engine** | Delays follow a normal distribution — not uniform random — with 8% distraction spikes |
| 🖱 **Bézier Mouse Simulation** | Cursor paths follow quadratic Bézier curves with randomized control points |
| 🛡 **Auto-Pause Safety** | Monitors 15+ warning patterns: CAPTCHA, rate-limit notices, checkpoint redirects |
| 📋 **Whitelist / Blacklist** | Whitelist-only mode or permanent per-user skip/decline rules |
| 📊 **Activity Log** | Color-coded log of last 200 actions — stored 100% locally |
| 🔁 **Daily Auto-Reset** | Action counter resets at local midnight via Chrome Alarms API |

---

## 🚀 Installation

> No Chrome Web Store required. Installs in under 2 minutes.

**Step 1 — Download**

Download the latest release ZIP:

```
https://github.com/Rakibul-Hashan/fb-friend-manager-pro/releases/latest/download/fb-friend-manager-pro.zip
```

Or click the badge at the top of this page.

**Step 2 — Extract**

Extract the ZIP to a permanent folder on your computer (don't delete it after installing).

**Step 3 — Load in Chrome**

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the extracted `fb-extension/` folder

The extension icon will appear in your Chrome toolbar.

---

## 🎯 Usage Guide

### First-Time Setup: Pick Your Selectors

This is the most important step. Because Facebook changes its DOM frequently,
the extension uses a **visual picker** instead of hardcoded selectors.

**For Bulk Send:**
1. Open `https://www.facebook.com/friends/suggestions`
2. Click the extension icon → go to the **Selectors** tab
3. Click **🎯 Pick** next to "Send Request Button"
4. A floating panel appears on the Facebook page
5. Hover over the **Add Friend** button to highlight it, then **click it**
6. Confirm with **"✓ Use This Selector"**

**For Bulk Accept:**
1. Open `https://www.facebook.com/friends/requests`
2. Repeat the Pick process for the **Confirm** button

**For Auto-Withdraw:**
1. Open `https://www.facebook.com/friends/sent`
2. Repeat the Pick process for the **Cancel request** button

### Running an Operation

1. Navigate to the correct Facebook page (see table below)
2. Click the extension icon → **Operations** tab
3. Click **▶ Run** on the desired operation
4. Switch to the Facebook tab — watch the live progress badge

| Operation | Navigate to first |
|---|---|
| Bulk Send | `facebook.com/friends/suggestions` |
| Bulk Accept | `facebook.com/friends/requests` |
| Auto-Withdraw | `facebook.com/friends/sent` |

### Updating Selectors After a Facebook Update

If Facebook updates its layout and buttons stop being found:

1. Go to the **Selectors** tab in the extension
2. Click **Clear** on the broken selector
3. Click **🎯 Pick** and repeat the picker process on the updated page

---

## 🛡 Anti-Ban Architecture

The extension uses **5 independent layers** to stay under Facebook's detection:

```
Layer 1 — Timing
  ├─ Gaussian-distributed delays (not uniform random)
  ├─ Standard deviation = (max - min) / 6 → 99.7% within bounds
  └─ 8% chance of a 5–20s "distraction spike"

Layer 2 — Mouse Behavior
  ├─ Quadratic Bézier paths between cursor positions
  ├─ Randomized control points (never straight lines)
  └─ Full mouseenter → mousemove → mousedown → mouseup → click sequence

Layer 3 — Session Behavior
  ├─ Random scroll between actions (simulates reading)
  └─ Micro-pauses (400–1300ms) before each interaction

Layer 4 — Volume Control
  ├─ Hard daily cap (default: 20 actions/day)
  ├─ Configurable min/max delay (default: 3–12 seconds)
  └─ Auto-reset at local midnight via Chrome Alarms

Layer 5 — Real-time Detection
  ├─ Scans 15+ Facebook warning text patterns
  ├─ Monitors for CAPTCHA iframes
  ├─ Watches URL for /checkpoint and /login redirects
  └─ Emergency pause + Chrome notification on any trigger
```

**Recommended safe settings:**

| Setting | Value |
|---|---|
| Daily limit | 15–20 (never exceed 30) |
| Min delay | 3–5 seconds |
| Max delay | 10–15 seconds |
| Auto-pause on CAPTCHA | ✅ Always on |
| Auto-pause on warning | ✅ Always on |

---

## 🏗 Project Structure

```
fb-extension/
├── manifest.json                  # Manifest V3, scoped to facebook.com only
│
├── background/
│   └── service-worker.js          # Thin orchestrator: alarms, tab finding, script injection
│
├── content/
│   ├── picker.js                  # Visual selector picker (injected on demand)
│   └── runner.js                  # Bulk operation runner (injected on demand)
│
├── popup/
│   ├── popup.html                 # Extension UI shell
│   ├── popup.css                  # Dark/light UI styles
│   └── popup.js                   # Controller: settings, selectors, operations, logs
│
├── utils/                         # Reference implementations (not imported at runtime)
│   ├── storage.js                 # Chrome storage wrapper + defaults
│   ├── delay.js                   # Gaussian timing engine
│   ├── mouse.js                   # Bézier mouse simulation
│   ├── limiter.js                 # Rate limiter / daily cap
│   └── detector.js                # Warning pattern scanner
│
└── assets/
    └── icons/                     # 16, 48, 128px extension icons
```

### Architecture Decision: Why `executeScript` instead of content scripts?

Previous versions used persistent content scripts with message passing. This caused
the notorious `"Receiving end does not exist"` error whenever:

- The Facebook tab was reloaded
- The tab was newly opened
- The service worker restarted

**v2.0 solution:** The service worker uses `chrome.scripting.executeScript` to inject
`runner.js` and `picker.js` directly into the active tab **at the moment they're needed**.
No pre-loading, no message passing, no connection errors.

---

## ⚙️ Configuration Reference

All settings are stored in `chrome.storage.local` and editable via the **Settings** tab.

| Setting | Default | Description |
|---|---|---|
| `dailyLimit` | `20` | Max actions per day across all operations |
| `minDelay` | `3000` ms | Minimum delay between actions |
| `maxDelay` | `12000` ms | Maximum delay between actions |
| `jitterRange` | `2000` ms | ±ms of additional random jitter |
| `autoPauseOnCaptcha` | `true` | Stop immediately if CAPTCHA detected |
| `autoPauseOnWarning` | `true` | Stop on any Facebook warning pattern |
| `randomScrollBetweenActions` | `true` | Randomly scroll to simulate reading |
| `whitelist` | `[]` | If non-empty, only process these user IDs |
| `blacklist` | `[]` | Never process these user IDs |

---

## 🔧 Development

**Prerequisites:** Chrome browser, no build tools required.

```bash
# Clone the repository
git clone https://github.com/Rakibul-Hashan/fb-friend-manager-pro.git
cd fb-friend-manager-pro

# Load in Chrome
# 1. Open chrome://extensions
# 2. Enable Developer mode
# 3. Load Unpacked → select fb-extension/

# After making changes to any file:
# Go to chrome://extensions → click the refresh icon on the extension
```

**Making a release:**

```bash
cd fb-extension
zip -r ../fb-friend-manager-pro.zip . -x "*.DS_Store" -x "*/.git/*"
# Upload fb-friend-manager-pro.zip as a release asset on GitHub
```

The landing page's download button uses the GitHub Releases API and will
automatically pick up the new version within minutes of publishing.

---

## 📋 Changelog

### v2.0.0 — March 2026
**Major rewrite — eliminates all connection errors**

- ✨ Visual Selector Picker — click any button on Facebook to capture its selector
- ✨ `executeScript` injection architecture — no more "Receiving end does not exist"
- ✨ Live progress badge rendered directly on the Facebook page
- ✨ Thin service worker — all heavy logic in injected scripts
- 🐛 Fixed: ES module `import` in content scripts (not supported in MV3)
- 🐛 Fixed: `"type": "module"` in service worker caused silent failures
- 🐛 Fixed: buttons permanently disabled on ping failure

### v1.1.0 — February 2026
**Stability fixes**

- Rewrote `fb-actions.js` as self-contained IIFE (no ES imports)
- Removed `"type": "module"` from manifest and service worker
- Buttons now show warning instead of being disabled on ping failure
- Added page-specific navigation hints in popup

### v1.0.0 — January 2026
**Initial release**

- Bulk send, accept, and auto-withdraw friend requests
- Gaussian timing engine with distraction spikes
- Bézier curve mouse movement simulation
- 15+ Facebook warning pattern scanner
- Daily counter with auto-reset at midnight
- Whitelist and blacklist filtering
- Dark UI popup with quota bar, stats, and activity log

---

## 🤝 Contributing

Contributions are welcome. Please open an issue before submitting a large PR.

**Most wanted contributions:**
- Updated Facebook selectors when FB changes its DOM
- Additional warning pattern detection
- Browser support beyond Chrome (Firefox MV3 / Edge)
- Automated selector testing

---

## ☕ Support

If this tool saves you time, consider buying me a coffee:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-eab308?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/rakibulhashanrabbi)

Completely optional — the extension is and always will be free.

---

## 📄 License

[MIT](LICENSE) — free to use, modify, and distribute.

---

<div align="center">

Made with ♥ and open source

**[⬇ Download](https://github.com/Rakibul-Hashan/fb-friend-manager-pro/releases/latest/download/fb-friend-manager-pro.zip)** &nbsp;·&nbsp; **[🌐 Website](https://Rakibul-Hashan.github.io/fb-friend-manager-pro)** &nbsp;·&nbsp; **[☕ Coffee](https://www.buymeacoffee.com/rakibulhashanrabbi)**

</div>
