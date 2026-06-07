// GazeGuard Popup v2

const masterToggle   = document.getElementById('masterToggle');
const toggleLbl      = document.getElementById('toggle-lbl');
const sDot           = document.getElementById('s-dot');
const sText          = document.getElementById('s-text');
const sBadge         = document.getElementById('s-badge');
const threshSlider   = document.getElementById('threshSlider');
const threshVal      = document.getElementById('threshVal');
const optCountdown   = document.getElementById('opt-countdown');
const optAutoResume  = document.getElementById('opt-autoResume');
const optPlayingOnly = document.getElementById('opt-playingOnly');
const statPauses     = document.getElementById('stat-pauses');
const statSaved      = document.getElementById('stat-saved');
const resetStatsBtn  = document.getElementById('resetStatsBtn');
const camPreview     = document.getElementById('cam-preview');
const faceDot        = document.getElementById('face-dot');
const faceLabel      = document.getElementById('face-label');

// ── Load & apply saved settings ──────────────────────────────
chrome.storage.sync.get({
  enabled: true, threshold: 3000,
  countdown: true, autoResume: true, pauseOnlyWhenPlaying: true
}, (cfg) => {
  masterToggle.checked   = cfg.enabled;
  threshSlider.value     = cfg.threshold / 1000;
  threshVal.textContent  = `${cfg.threshold / 1000}s`;
  optCountdown.checked   = cfg.countdown;
  optAutoResume.checked  = cfg.autoResume;
  optPlayingOnly.checked = cfg.pauseOnlyWhenPlaying;
  updateMasterUI(cfg.enabled);
});

// ── Persist changes ──────────────────────────────────────────
masterToggle.addEventListener('change', () => {
  const v = masterToggle.checked;
  chrome.storage.sync.set({ enabled: v });
  updateMasterUI(v);
});

threshSlider.addEventListener('input', () => {
  const s = parseFloat(threshSlider.value);
  threshVal.textContent = `${s}s`;
  chrome.storage.sync.set({ threshold: s * 1000 });
});

optCountdown.addEventListener('change',   () => chrome.storage.sync.set({ countdown: optCountdown.checked }));
optAutoResume.addEventListener('change',  () => chrome.storage.sync.set({ autoResume: optAutoResume.checked }));
optPlayingOnly.addEventListener('change', () => chrome.storage.sync.set({ pauseOnlyWhenPlaying: optPlayingOnly.checked }));

resetStatsBtn.addEventListener('click', () => {
  chrome.storage.local.set({ stats: { totalPauses: 0, totalSavedMs: 0 } });
  statPauses.textContent = '0';
  statSaved.textContent  = '0m';
});

// ── Live camera preview ──────────────────────────────────────
async function startPreview() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 160 }, height: { ideal: 120 } },
      audio: false
    });
    camPreview.srcObject = stream;
    // Stop preview stream when popup closes
    window.addEventListener('beforeunload', () => stream.getTracks().forEach(t => t.stop()), { once: true });
  } catch {
    camPreview.style.display = 'none';
  }
}
startPreview();

// ── Poll content script status ───────────────────────────────
function fmtTime(ms) {
  if (ms < 60000) return `${Math.round(ms/1000)}s`;
  const m = Math.floor(ms / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m/60)}h ${m%60}m`;
}

function pollStatus() {
  chrome.storage.local.get(['status', 'stats', 'lastEvent'], (d) => {
    // Stats
    if (d.stats) {
      statPauses.textContent = d.stats.totalPauses;
      statSaved.textContent  = fmtTime(d.stats.totalSavedMs);
    }

    // Status
    const st = d.status;
    if (!masterToggle.checked) {
      setStatus('off', 'GazeGuard is disabled', 'OFF', false);
      setFace(null);
      return;
    }
    if (!st) {
      setStatus('active', 'Initializing — loading model…', 'Loading', false);
      return;
    }

    // Badge
    sBadge.textContent  = st.usingFallback ? 'Heuristic' : 'BlazeFace';
    sBadge.className    = 's-badge ' + (st.usingFallback ? 'fb' : 'ml');

    if (st.pausedByUs) {
      setStatus('paused', 'Video paused by GazeGuard', 'Paused', false);
      setFace(false);
    } else if (st.isAway) {
      setStatus('away', 'Face not detected — counting down…', 'Away', true);
      setFace(false);
    } else if (st.faceFound) {
      setStatus('active', 'Face detected — watching', 'Active', true);
      setFace(true);
    } else {
      setStatus('active', 'Watching for your face…', 'Active', true);
      setFace(null);
    }
  });
}

function setStatus(mode, text, badge, pulse) {
  sText.textContent = text;
  sDot.className = 's-dot ' + (
    mode === 'paused' ? 'paused' :
    mode === 'away'   ? 'away'   :
    mode === 'off'    ? 'off'    : 'active'
  );
}

function setFace(found) {
  if (found === null) {
    faceDot.textContent   = '⚪';
    faceLabel.textContent = 'Scanning…';
    faceLabel.style.color = '';
  } else if (found) {
    faceDot.textContent   = '🟢';
    faceLabel.textContent = 'Face detected';
    faceLabel.style.color = '#34d399';
  } else {
    faceDot.textContent   = '🔴';
    faceLabel.textContent = 'No face detected';
    faceLabel.style.color = '#f87171';
  }
}

function updateMasterUI(on) {
  toggleLbl.textContent = on ? 'ON' : 'OFF';
  if (!on) {
    setStatus('off', 'GazeGuard is disabled', 'OFF', false);
    setFace(null);
  }
}

setInterval(pollStatus, 800);
pollStatus();
