# 👁️ GazeGuard
Your videos, finally loyal enough to wait for you — without paying Chrome's "developer tax"

![GitHub stars](https://img.shields.io/github/stars/yourusername/GazeGuard?style=social)
![GitHub forks](https://img.shields.io/github/forks/yourusername/GazeGuard?style=social)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

## 📜 Introduction
**GazeGuard** is your personal video babysitter. It watches your face so your videos don't have to watch themselves. The moment you look away, step out, or get ambushed by a family member — it pauses. The moment you return — it resumes. Like magic, except it's just TensorFlow.js running in your browser tab.

Why pay $5 to the Chrome Web Store gatekeepers when you can deploy this extension yourself in under 5 minutes? That's a whole $5 you could put toward the snacks you'll now never miss during your lecture.

---

## ✨ Features
✅ **Auto-pause & auto-resume** — video freezes the moment your face disappears  
✅ **Countdown overlay** — a 3…2…1 warning before pausing, because surprises aren't always fun  
✅ **Works on YouTube, Netflix, Hotstar & Amazon Prime Video** — covers basically your whole procrastination ecosystem  
✅ **Powered by TensorFlow.js BlazeFace** — real ML, no Chrome flags, no nonsense  
✅ **Live camera preview** in the popup, so you can confirm it actually sees you  
✅ **Session stats** — track how many times it saved you from missing something important  
✅ **100% local** — your face never leaves your browser. Not even a little bit.  
✅ **FREE to use** (take THAT, Chrome Web Store!)

---

## 🚀 Installation Guide for the Chrome Store Rebels

### **Step 1: Download the Extension**
Already saved $5! That's like a full samosa plate at the canteen!

### **Step 2: Load It Like a Digital Outlaw**
1. Open **Chrome** (yes, the one you're already using to watch lectures at 2x speed)
2. Navigate to `chrome://extensions/`
3. Toggle on **"Developer Mode"** in the top right corner (the REAL developer mode, not the $5 version)
4. Click **"Load unpacked"**
5. Select the extracted **GazeGuard** folder

🎉 **Congratulations!** You've successfully circumvented Big Tech's toll booth!

---

### **Step 3: Grant Camera Permission**
1. Navigate to **YouTube, Netflix, Hotstar, or Prime Video**
2. Start playing any video
3. Chrome will ask for **camera access** — click **Allow**
4. Enjoy a smug sense of security knowing your video will wait for you

> **No API key needed.** No external servers. No sign-ups. Just your webcam and a machine learning model that runs entirely in your tab.

---

## 🔧 How to Use
1. Open any supported platform and **start a video**
2. GazeGuard silently watches via your webcam
3. **Look away** or step out — the countdown begins: 3…2…1…
4. Video **pauses automatically** with a notification overlay
5. **Look back at the screen** — video resumes instantly
6. Watch the stats in your popup grow as GazeGuard saves you from rewinding for the hundredth time

---

## ⚙️ Settings (Click the 👁️ Icon in Your Toolbar)

| Setting | What It Does |
|---|---|
| **Enable / Disable** | Master toggle to turn GazeGuard on or off |
| **Pause Delay** | How long (1–10s) your face must be absent before pausing |
| **Countdown Overlay** | Show a visible timer before pausing |
| **Auto-Resume** | Resume automatically when face is detected, or require a manual click |
| **Only While Playing** | Skip triggering if you've already manually paused |

---

## 🧠 How It Works

```
Webcam (320×240)
    ↓
TensorFlow.js BlazeFace ML Model
    ↓
Face detected? ──── YES ──→ Reset timer │ Resume if paused
    │
    NO
    ↓
Miss streak ≥ 4 frames?
    ↓
Start countdown (configurable)
    ↓
PAUSE VIDEO + Show overlay
    ↓
Face detected again? ──→ Auto-resume ✓
```

**Detection fallback chain** (in order of accuracy):
1. 🧠 **TensorFlow.js BlazeFace** — ML model, most accurate, works everywhere
2. 🔍 **Native FaceDetector API** — browser built-in, if available
3. 🎨 **Skin-tone pixel heuristic** — always available, always watching

---

## 🧩 Why This Is Better Than Any Paid Alternative
✅ **$5 richer** — buy yourself a good chai instead  
✅ **Full control** — modify the code, change the delay, add platforms  
✅ **Privacy first** — your face never leaves your browser tab  
✅ **No subscription** — it doesn't expire, throttle, or nag you  
✅ **Tech cred** — casually say *"Oh, I just load my ML extensions from source"* and watch people's expressions  

---

## 🛠️ Project Structure

```
gaze-guard/
├── manifest.json     Extension config (MV3)
├── content.js        Face detection + video control logic
├── popup.html        Settings popup UI
├── popup.js          Live status + settings logic
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

Want to tweak it?
- **`content.js`** → Detection logic, video selectors, overlay UI
- **`popup.html / popup.js`** → The settings panel and live status
- **`manifest.json`** → Add more platforms, change permissions (**don't break this one**)

---

## 🌐 Supported Platforms

| Platform | Status |
|---|---|
| YouTube | ✅ Fully supported |
| Netflix | ✅ Fully supported |
| Hotstar / Disney+ | ✅ Fully supported |
| Amazon Prime Video | ✅ Fully supported |
| Others (Twitch, Coursera…) | 🔜 Coming soon |

---

## ⚠️ Troubleshooting

### ❓ **Q: The video isn't pausing when I look away!**
✅ **A:** Make sure camera permission is granted for the site. Click the 🔒 icon in the address bar → Camera → Allow, then refresh the page.

### ❓ **Q: It pauses too quickly / too slowly!**
✅ **A:** Adjust the **Pause Delay** slider in the popup. Bump it up if it's triggering too fast.

### ❓ **Q: It keeps pausing even though I'm looking at the screen!**
✅ **A:** Your room might be too dark, or you're too close/far from the camera. Try better lighting. The model works best with your face clearly visible and reasonably lit.

### ❓ **Q: Chrome is warning me about developer mode extensions!**
✅ **A:** That's just Chrome trying to shame you into paying the $5. **Stand strong.**

### ❓ **Q: The popup says "Heuristic" instead of "BlazeFace"!**
✅ **A:** The TensorFlow.js CDN might be blocked on your network. The extension falls back to a skin-tone heuristic — still works, just slightly less precise.

---

## 🤝 Contributing
Pull requests are welcome! For major changes, please open an issue first.  
Or don't, and surprise us. **We love surprises.**

---

## 📄 License
**MIT** — Because we're not monsters who charge $5 for the privilege of not missing the important parts.

---

## 🙏 Acknowledgments
- **TensorFlow.js & BlazeFace** for the ML brain that makes this actually work
- **Chrome** for the browser (but not for the developer fee)
- **Every lecture you've missed the punchline of** for the inspiration

<p align="center">
  Made with 😤 by someone who was tired of rewinding the same 30 seconds
</p>

<p align="center">
  <a href="https://github.com/yourusername/GazeGuard/issues">Report Bug</a> •
  <a href="https://github.com/yourusername/GazeGuard/issues">Request Feature</a>
</p>
