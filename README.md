# 👁️ GazeGuard v2 – Auto Pause Videos

Automatically pauses videos on YouTube, Netflix, Hotstar, and Amazon Prime Video when you look away. Uses **TensorFlow.js BlazeFace** ML model — runs 100% in your browser, no data leaves your device.

---

## 🚀 Installation

1. Download and **unzip** this folder
2. Open Chrome → `chrome://extensions/`
3. Enable **Developer Mode** (top-right toggle)
4. Click **"Load unpacked"** → select the `gaze-guard` folder
5. The 👁️ icon appears in your toolbar

> **No flags needed!** v2 uses TensorFlow.js BlazeFace which works without any Chrome flags.

---

## ✨ What's New in v2

| Feature | v1 | v2 |
|---|---|---|
| Face detection | Native API (needs flags) | TF.js BlazeFace ML model ✓ |
| Countdown before pause | ❌ | ✓ Live countdown overlay |
| Auto-resume | ✓ | ✓ Configurable toggle |
| Camera preview in popup | ❌ | ✓ Live preview |
| Session stats | ❌ | ✓ Pauses + time saved |
| Skin-tone heuristic fallback | Basic | Improved multi-tone |
| SPA navigation handling | ❌ | ✓ YouTube/Netflix |
| Warmup period | ❌ | ✓ Avoids false triggers |
| Consecutive frame smoothing | ❌ | ✓ No jitter |

---

## ⚙️ Settings

- **Enable/Disable** — Master toggle
- **Pause delay** — 1–10 seconds before pause triggers
- **Countdown overlay** — Shows a timer before pausing
- **Auto-resume** — Resume when face returns (or require manual click)
- **Only while playing** — Don't trigger if video is already paused

---

## 🧠 How It Works

```
Webcam (320×240) → TF.js BlazeFace model → Face detected?
    YES → reset timer, resume if paused
    NO  → miss streak++ → after N misses → start countdown → pause
```

**Fallback chain:**
1. TensorFlow.js BlazeFace (primary — most accurate)
2. Native `FaceDetector` API (if available)
3. Skin-tone pixel heuristic (always available)

---

## 🔒 Privacy

All processing is local. The webcam feed never leaves your browser tab.

---

## 📁 Files

```
gaze-guard/
├── manifest.json   Chrome MV3 config
├── content.js      Face detection + video control
├── popup.html      Settings popup UI
├── popup.js        Popup logic + live status
├── README.md
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```
