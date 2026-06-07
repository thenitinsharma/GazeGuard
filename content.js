// ═══════════════════════════════════════════════════════════════
//  GazeGuard v2  –  Content Script
//  Robust face-detection auto-pause for YouTube / Netflix /
//  Hotstar / Amazon Prime using TensorFlow.js BlazeFace model
// ═══════════════════════════════════════════════════════════════

(function () {
  if (window.__gazeGuardActive) return;
  window.__gazeGuardActive = true;

  // ── CONSTANTS ────────────────────────────────────────────────
  const POLL_MS          = 400;   // detection interval
  const WARMUP_MS        = 2500;  // ignore detections during model warmup
  const CONSEC_MISS      = 4;     // consecutive misses before counting as "away"
  const CONSEC_HIT       = 2;     // consecutive hits before counting as "present"
  const CDN_TFJS         = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js';
  const CDN_BLAZE        = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.1.0/dist/blazeface.min.js';

  // ── STATE ────────────────────────────────────────────────────
  let cfg = { enabled: true, threshold: 3000, countdown: true, autoResume: true, pauseOnlyWhenPlaying: true };
  let model         = null;
  let camStream     = null;
  let camVideo      = null;
  let canvas        = null;
  let ctx           = null;
  let pollTimer     = null;
  let countdownTimer= null;
  let overlayEl     = null;
  let styleEl       = null;
  let pausedByUs    = false;
  let isAway        = false;
  let initialized   = false;
  let warmupDone    = false;
  let missStreak    = 0;
  let hitStreak     = 0;
  let countdownSec  = 0;
  let totalPauses   = 0;
  let totalSavedMs  = 0;
  let pauseStartMs  = 0;
  let usingFallback = false;

  // ── LOAD CONFIG ──────────────────────────────────────────────
  chrome.storage.sync.get(cfg, (saved) => {
    cfg = { ...cfg, ...saved };
    if (cfg.enabled) boot();
  });

  chrome.storage.onChanged.addListener((changes) => {
    for (const [k, v] of Object.entries(changes)) cfg[k] = v.newValue;
    if (changes.enabled) {
      changes.enabled.newValue ? boot() : shutdown();
    }
  });

  // ══════════════════════════════════════════════════════════════
  //  PLATFORM VIDEO FINDER
  //  Waits for an actually-playing video; handles SPA navigation
  // ══════════════════════════════════════════════════════════════
  function findPlayingVideo() {
    const all = [...document.querySelectorAll('video')];
    // Prefer a video that is actively playing and has duration
    return (
      all.find(v => !v.paused && v.readyState >= 3 && v.duration > 5) ||
      all.find(v => v.readyState >= 2 && v.duration > 5) ||
      all.find(v => v.duration > 0) ||
      null
    );
  }

  // Re-check video every time we need it (handles Netflix/YouTube SPA nav)
  function getVideo() { return findPlayingVideo(); }

  // ══════════════════════════════════════════════════════════════
  //  MODEL LOADING  (TF.js BlazeFace via CDN)
  // ══════════════════════════════════════════════════════════════
  function loadScript(src) {
    return new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  async function loadModel() {
    try {
      await loadScript(CDN_TFJS);
      await loadScript(CDN_BLAZE);
      // blazeface is exposed as window.blazeface
      if (typeof blazeface === 'undefined') throw new Error('blazeface not found');
      model = await blazeface.load();
      console.log('[GazeGuard] BlazeFace model loaded ✓');
      return true;
    } catch (e) {
      console.warn('[GazeGuard] BlazeFace load failed, using fallback:', e.message);
      usingFallback = true;
      return true; // continue with fallback
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  CAMERA
  // ══════════════════════════════════════════════════════════════
  async function startCamera() {
    try {
      camStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
        audio: false
      });
      camVideo = document.createElement('video');
      camVideo.srcObject = camStream;
      camVideo.muted = true;
      camVideo.setAttribute('playsinline', '');
      await camVideo.play();
      canvas = document.createElement('canvas');
      canvas.width = 320; canvas.height = 240;
      ctx = canvas.getContext('2d', { willReadFrequently: true });
      return true;
    } catch (e) {
      console.warn('[GazeGuard] Camera error:', e.message);
      return false;
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  FACE DETECTION
  // ══════════════════════════════════════════════════════════════
  let _prevPixels = null;

  async function detectFace() {
    if (!ctx || !camVideo || camVideo.readyState < 2) return null; // null = unknown

    ctx.drawImage(camVideo, 0, 0, 320, 240);

    // ── BlazeFace (preferred) ─────────────────────────────────
    if (model && !usingFallback) {
      try {
        const preds = await model.estimateFaces(canvas, false /* returnTensors */);
        return preds.length > 0;
      } catch { /* fall through to heuristic */ }
    }

    // ── Native FaceDetector API ───────────────────────────────
    if (!usingFallback && 'FaceDetector' in window) {
      try {
        if (!window._ggFD) window._ggFD = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
        const faces = await window._ggFD.detect(canvas);
        return faces.length > 0;
      } catch { usingFallback = true; }
    }

    // ── Pixel-diff heuristic fallback ─────────────────────────
    return skinHeuristic();
  }

  function skinHeuristic() {
    // Sample a grid of points in the upper-center "face zone"
    const imageData = ctx.getImageData(96, 20, 128, 160); // center column, upper portion
    const d = imageData.data;
    let skinPixels = 0, totalPixels = 0, motionDiff = 0;

    for (let i = 0; i < d.length; i += 16) { // sample every 4th pixel
      const r = d[i], g = d[i+1], b = d[i+2];
      totalPixels++;
      // Skin tone detection: broad range covering various skin tones
      if (r > 60 && g > 30 && b > 15 &&
          r > b && r > g &&
          Math.abs(r - g) > 10 &&
          r - b > 10 && r < 255 &&
          (r + g + b) > 100) {
        skinPixels++;
      }
      // Motion diff
      if (_prevPixels) motionDiff += Math.abs(r - _prevPixels[i]) + Math.abs(g - _prevPixels[i+1]);
    }

    _prevPixels = new Uint8ClampedArray(d);
    const skinRatio  = skinPixels / totalPixels;
    const motionAvg  = _prevPixels ? motionDiff / totalPixels : 999;

    // Need skin ratio > 8% OR recent motion (someone still present but moved)
    return skinRatio > 0.08;
  }

  // ══════════════════════════════════════════════════════════════
  //  OVERLAY UI
  // ══════════════════════════════════════════════════════════════
  function injectStyles() {
    if (styleEl) return;
    styleEl = document.createElement('style');
    styleEl.textContent = `
      #gg-overlay {
        position: fixed; bottom: 28px; right: 28px;
        z-index: 2147483647;
        font-family: -apple-system, 'Segoe UI', system-ui, sans-serif;
        pointer-events: none;
      }
      #gg-overlay * { box-sizing: border-box; }
      .gg-card {
        pointer-events: all;
        display: flex; align-items: center; gap: 12px;
        background: rgba(8, 8, 18, 0.93);
        backdrop-filter: blur(16px) saturate(180%);
        -webkit-backdrop-filter: blur(16px) saturate(180%);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 18px;
        padding: 14px 18px;
        box-shadow: 0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
        color: #fff;
        min-width: 280px;
        animation: gg-in 0.35s cubic-bezier(.22,1,.36,1) forwards;
        transform-origin: bottom right;
      }
      .gg-card.gg-out { animation: gg-out 0.25s ease-in forwards; }
      @keyframes gg-in {
        from { opacity:0; transform: scale(0.88) translateY(16px); }
        to   { opacity:1; transform: scale(1) translateY(0); }
      }
      @keyframes gg-out {
        from { opacity:1; transform: scale(1) translateY(0); }
        to   { opacity:0; transform: scale(0.9) translateY(10px); }
      }
      .gg-eye {
        width: 40px; height: 40px; flex-shrink: 0;
        background: linear-gradient(135deg, #6d28d9, #a855f7);
        border-radius: 12px;
        display: flex; align-items: center; justify-content: center;
        font-size: 20px;
        box-shadow: 0 4px 14px rgba(168,85,247,0.45);
        animation: gg-eye-pulse 2s ease-in-out infinite;
      }
      @keyframes gg-eye-pulse {
        0%,100% { box-shadow: 0 4px 14px rgba(168,85,247,0.45); }
        50%      { box-shadow: 0 4px 22px rgba(168,85,247,0.75); }
      }
      .gg-info { flex: 1; min-width: 0; }
      .gg-title {
        font-size: 12px; font-weight: 700;
        background: linear-gradient(90deg, #c4b5fd, #a78bfa);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 3px;
      }
      .gg-msg { font-size: 12.5px; color: rgba(255,255,255,0.7); }
      .gg-cd {
        font-size: 22px; font-weight: 800;
        color: #f87171; line-height: 1;
        min-width: 28px; text-align: center;
      }
      .gg-cd.paused { color: #facc15; font-size: 16px; }
      .gg-btn {
        background: linear-gradient(135deg, #7c3aed, #a855f7);
        color: #fff; border: none;
        border-radius: 10px; padding: 8px 14px;
        font-size: 12px; font-weight: 600; cursor: pointer;
        white-space: nowrap; font-family: inherit;
        transition: transform 0.15s, box-shadow 0.15s;
        box-shadow: 0 4px 12px rgba(139,92,246,0.4);
      }
      .gg-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(139,92,246,0.6); }
      .gg-btn:active { transform: translateY(0); }

      /* Countdown warning ring */
      #gg-countdown-ring {
        position: fixed; bottom: 0; right: 0;
        width: 100vw; height: 4px;
        z-index: 2147483646;
        background: transparent;
        pointer-events: none;
      }
      #gg-countdown-bar {
        height: 100%; width: 100%;
        background: linear-gradient(90deg, #7c3aed, #f87171);
        transform-origin: left;
        transform: scaleX(1);
        transition: transform linear;
      }
    `;
    document.head.appendChild(styleEl);
  }

  function showOverlay(mode) {
    // mode: 'countdown' | 'paused'
    injectStyles();
    removeOverlay(true); // remove without animation to re-create

    overlayEl = document.createElement('div');
    overlayEl.id = 'gg-overlay';

    if (mode === 'countdown') {
      countdownSec = Math.round(cfg.threshold / 1000);
      overlayEl.innerHTML = `
        <div class="gg-card" id="gg-card">
          <div class="gg-eye">👁️</div>
          <div class="gg-info">
            <div class="gg-title">GazeGuard</div>
            <div class="gg-msg">Face not detected — pausing in…</div>
          </div>
          <div class="gg-cd" id="gg-cd-num">${countdownSec}</div>
        </div>
      `;
    } else {
      overlayEl.innerHTML = `
        <div class="gg-card" id="gg-card">
          <div class="gg-eye">⏸</div>
          <div class="gg-info">
            <div class="gg-title">GazeGuard</div>
            <div class="gg-msg" id="gg-pause-msg">Video paused — look at screen to resume</div>
          </div>
          <button class="gg-btn" id="gg-resume-btn">▶ Resume</button>
        </div>
      `;
    }

    document.body.appendChild(overlayEl);
    document.getElementById('gg-resume-btn')?.addEventListener('click', manualResume);
  }

  function updateCountdown(n) {
    const el = document.getElementById('gg-cd-num');
    if (el) el.textContent = n;
  }

  function removeOverlay(instant = false) {
    if (!overlayEl) return;
    if (instant) { overlayEl.remove(); overlayEl = null; return; }
    const card = overlayEl.querySelector('#gg-card');
    if (card) {
      card.classList.add('gg-out');
      setTimeout(() => { overlayEl?.remove(); overlayEl = null; }, 260);
    } else { overlayEl.remove(); overlayEl = null; }
  }

  function updatePauseMsg(msg) {
    const el = document.getElementById('gg-pause-msg');
    if (el) el.textContent = msg;
  }

  // ══════════════════════════════════════════════════════════════
  //  VIDEO CONTROLS
  // ══════════════════════════════════════════════════════════════
  function pauseVideo() {
    const vid = getVideo();
    if (!vid || vid.paused) return;
    vid.pause();
    pausedByUs = true;
    pauseStartMs = Date.now();
    totalPauses++;
    showOverlay('paused');
    saveStats();
    // Notify popup
    chrome.storage.local.set({ lastEvent: { type: 'paused', ts: Date.now() } });
  }

  function resumeVideo(reason = 'face') {
    const vid = getVideo();
    if (vid?.paused && pausedByUs) {
      vid.play().catch(() => {});
      if (pauseStartMs) totalSavedMs += Date.now() - pauseStartMs;
      pauseStartMs = 0;
    }
    pausedByUs = false;
    isAway = false;
    missStreak = 0;
    removeOverlay();
    saveStats();
    chrome.storage.local.set({ lastEvent: { type: 'resumed', reason, ts: Date.now() } });
  }

  function manualResume() {
    clearCountdown();
    resumeVideo('manual');
  }

  // ══════════════════════════════════════════════════════════════
  //  COUNTDOWN LOGIC
  // ══════════════════════════════════════════════════════════════
  function startCountdown(onEnd) {
    clearCountdown();
    if (!cfg.countdown) { onEnd(); return; }
    countdownSec = Math.round(cfg.threshold / 1000);
    showOverlay('countdown');
    updateCountdown(countdownSec);
    countdownTimer = setInterval(() => {
      countdownSec--;
      updateCountdown(countdownSec);
      if (countdownSec <= 0) {
        clearCountdown();
        onEnd();
      }
    }, 1000);
  }

  function clearCountdown() {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    if (overlayEl && document.getElementById('gg-cd-num')) {
      removeOverlay();
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  MAIN DETECTION LOOP
  // ══════════════════════════════════════════════════════════════
  async function runDetection() {
    if (!cfg.enabled || !warmupDone) return;

    const vid = getVideo();

    // Only act if there's something to pause/resume
    if (cfg.pauseOnlyWhenPlaying && !vid) {
      missStreak = 0; // reset so we don't fire when navigating
      return;
    }

    const faceFound = await detectFace();
    if (faceFound === null) return; // camera not ready

    if (faceFound) {
      hitStreak++;
      missStreak = 0;

      if (hitStreak >= CONSEC_HIT && isAway) {
        clearCountdown();
        if (cfg.autoResume) {
          resumeVideo('face');
        } else {
          updatePauseMsg('Face detected — click Resume to continue');
        }
        isAway = false;
      }

      // If we were counting down, cancel it
      if (countdownTimer) {
        clearCountdown();
        removeOverlay();
      }

    } else {
      hitStreak = 0;
      missStreak++;

      if (!isAway && !vid?.paused && missStreak === CONSEC_MISS) {
        // Start the countdown → pause
        isAway = true;
        if (vid && !vid.paused) {
          startCountdown(() => {
            pauseVideo();
          });
        }
      }
    }

    // Update popup status
    if (Math.random() < 0.05) { // 5% of frames to avoid spam
      chrome.storage.local.set({
        status: {
          faceFound: !!faceFound,
          isAway,
          pausedByUs,
          usingFallback,
          totalPauses,
          totalSavedMs
        }
      });
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  STATS
  // ══════════════════════════════════════════════════════════════
  function saveStats() {
    chrome.storage.local.set({ stats: { totalPauses, totalSavedMs } });
  }

  function loadStats() {
    chrome.storage.local.get({ stats: { totalPauses: 0, totalSavedMs: 0 } }, (d) => {
      totalPauses  = d.stats.totalPauses;
      totalSavedMs = d.stats.totalSavedMs;
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  BOOT & SHUTDOWN
  // ══════════════════════════════════════════════════════════════
  async function boot() {
    if (initialized) return;
    initialized = true;
    loadStats();

    const camOk = await startCamera();
    if (!camOk) {
      showPermissionError();
      initialized = false;
      return;
    }

    await loadModel();

    // Warmup delay: let camera auto-adjust exposure / model init
    setTimeout(() => { warmupDone = true; }, WARMUP_MS);

    pollTimer = setInterval(runDetection, POLL_MS);
    console.log('[GazeGuard] v2 active' + (usingFallback ? ' (heuristic fallback)' : ' (BlazeFace)'));
  }

  function shutdown() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    clearCountdown();
    camStream?.getTracks().forEach(t => t.stop());
    camStream = null; camVideo = null;
    pausedByUs = false; isAway = false;
    missStreak = 0; hitStreak = 0; warmupDone = false; initialized = false;
    removeOverlay(true);
    chrome.storage.local.set({ status: null });
  }

  function showPermissionError() {
    injectStyles();
    const b = document.createElement('div');
    b.style.cssText = `position:fixed;top:20px;right:20px;z-index:2147483647;
      background:linear-gradient(135deg,#7f1d1d,#991b1b);color:#fecaca;
      padding:14px 18px;border-radius:14px;font-family:sans-serif;
      font-size:13px;max-width:300px;border:1px solid rgba(255,100,100,0.3);
      box-shadow:0 8px 32px rgba(0,0,0,0.5);line-height:1.5;`;
    b.innerHTML = `<strong style="display:block;margin-bottom:4px">👁️ GazeGuard — Camera Required</strong>
      Please allow camera access so GazeGuard can detect when you look away.
      Click the 🔒 icon in the address bar → Camera → Allow, then refresh.`;
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 8000);
  }

  window.addEventListener('beforeunload', shutdown);

  // Handle YouTube/Netflix SPA navigation
  let _lastUrl = location.href;
  setInterval(() => {
    if (location.href !== _lastUrl) {
      _lastUrl = location.href;
      // Reset streak when page changes
      missStreak = 0; hitStreak = 0; isAway = false;
      if (pausedByUs) { pausedByUs = false; removeOverlay(true); }
    }
  }, 1000);

})();
