import { sendNotification, isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from "@tauri-apps/plugin-autostart";
import { getCurrentWindow, UserAttentionType } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

const appWindow = getCurrentWindow();

// ── State ──────────────────────────────────────────────────────────────
let running = false;
let countdownId = null;
let sessionId = null;
let blinkId = null;
let reminderCount = 0;
let sessionSeconds = 0;
let secondsLeft = 0;
const CIRCUMFERENCE = 2 * Math.PI * 52; // r=52

// ── Render ─────────────────────────────────────────────────────────────
document.getElementById("app").innerHTML = `
  <div class="titlebar" data-tauri-drag-region>
    <span class="titlebar-title" data-tauri-drag-region>👁️ Blink Reminder</span>
    <button class="titlebar-close" id="close-btn" title="Close">✕</button>
  </div>

  <div class="app">

    <div class="ring-wrap">
      <div class="ring-container">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="6"/>
          <circle id="progress-arc" cx="60" cy="60" r="52" fill="none"
            stroke="#1D9E75" stroke-width="6"
            stroke-dasharray="${CIRCUMFERENCE}"
            stroke-dashoffset="${CIRCUMFERENCE}"
            stroke-linecap="round"
            style="transition: stroke-dashoffset .8s linear"/>
        </svg>
        <div class="ring-text">
          <span class="ring-time" id="ring-time">—</span>
          <span class="ring-label" id="ring-label">paused</span>
        </div>
      </div>
      <div class="ring-subtitle">Next blink reminder</div>
    </div>

    <div class="status-pill">
      <div class="status-dot" id="status-dot"></div>
      <span class="status-pill-text" id="status-text">Session not started</span>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Reminders today</div>
        <div class="stat-value" id="stat-count">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Session time</div>
        <div class="stat-value" id="stat-session">0:00</div>
      </div>
    </div>

    <div class="settings">
      <div class="settings-header">Settings</div>
      <div class="setting-row">
        <label>Remind every</label>
        <input type="range" id="interval-slider" min="1" max="30" value="20" step="1" />
        <span class="val" id="interval-val">20 min</span>
      </div>
      <div class="setting-row">
        <label>Blinks per reminder</label>
        <input type="range" id="blinks-slider" min="3" max="20" value="10" step="1" />
        <span class="val" id="blinks-val">10</span>
      </div>
    </div>

    <div class="toggle-row">
      <div>
        <div class="toggle-label">Launch at login</div>
        <div class="toggle-sub">Start automatically with your computer</div>
      </div>
      <label class="toggle">
        <input type="checkbox" id="autostart-toggle" />
        <span class="toggle-slider"></span>
      </label>
    </div>

    <div class="actions">
      <button class="btn-primary" id="start-btn">Start session</button>
      <button class="btn-secondary" id="test-btn">Test reminder</button>
    </div>

  </div>

  <!-- Full-screen blink overlay -->
  <div class="blink-overlay" id="blink-overlay">
    <span class="blink-eye">👁️</span>
    <div class="blink-title">Time to blink!</div>
    <div class="blink-sub">Slowly close and open your eyes</div>
    <div class="blink-num" id="blink-num">10</div>
    <button class="blink-btn" id="blink-done-btn">Done blinking ✓</button>
  </div>
`;

// ── DOM refs ───────────────────────────────────────────────────────────
const startBtn = document.getElementById("start-btn");
const testBtn = document.getElementById("test-btn");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const ringTime = document.getElementById("ring-time");
const ringLabel = document.getElementById("ring-label");
const progressArc = document.getElementById("progress-arc");
const statCount = document.getElementById("stat-count");
const statSession = document.getElementById("stat-session");
const overlay = document.getElementById("blink-overlay");
const blinkNum = document.getElementById("blink-num");
const intervalSlider = document.getElementById("interval-slider");
const blinkSlider = document.getElementById("blinks-slider");
const autostartToggle = document.getElementById("autostart-toggle");
const closeBtn = document.getElementById("close-btn");

// ── Helpers ────────────────────────────────────────────────────────────
const getInterval = () => parseInt(intervalSlider.value) * 60;
const getBlinks = () => parseInt(blinkSlider.value);

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function updateRing(left, total) {
  const pct = total > 0 ? left / total : 0;
  progressArc.style.strokeDashoffset = CIRCUMFERENCE * (1 - pct);
  ringTime.textContent = formatTime(left);
}

// ── Session control ────────────────────────────────────────────────────
function startSession() {
  running = true;
  startBtn.textContent = "Stop session";
  startBtn.classList.add("stop");
  statusDot.classList.add("active");
  statusText.textContent = "Active — watching your eyes";
  ringLabel.textContent = "until reminder";
  startCountdown();
  sessionId = setInterval(() => {
    sessionSeconds++;
    statSession.textContent = formatTime(sessionSeconds);
  }, 1000);
}

function stopSession() {
  running = false;
  startBtn.textContent = "Start session";
  startBtn.classList.remove("stop");
  statusDot.classList.remove("active");
  statusText.textContent = "Session not started";
  ringTime.textContent = "—";
  ringLabel.textContent = "paused";
  progressArc.style.strokeDashoffset = CIRCUMFERENCE;
  clearInterval(countdownId);
  clearInterval(sessionId);
}

function startCountdown() {
  clearInterval(countdownId);
  const total = getInterval();
  secondsLeft = total;
  updateRing(secondsLeft, total);
  countdownId = setInterval(() => {
    secondsLeft--;
    updateRing(secondsLeft, total);
    if (secondsLeft <= 0) {
      clearInterval(countdownId);
      triggerReminder();
    }
  }, 1000);
}

function playChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 1.2);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.15); // A5
    gain2.gain.setValueAtTime(0.25, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 1.5);
  } catch (e) {
    // Graceful fallback if audio is not permitted
  }
}

// ── Blink reminder ─────────────────────────────────────────────────────
async function triggerReminder() {
  reminderCount++;
  statCount.textContent = reminderCount;

  // 1. Force the app to the front, unminimize, focus, and pin on top
  try {
    await invoke("force_focus");
  } catch (e) {
    console.error("force_focus invoke error:", e);
  }

  try {
    await appWindow.setVisibleOnAllWorkspaces(true);
    await appWindow.unminimize();
    await appWindow.show();
    await appWindow.center();
    await appWindow.setAlwaysOnTop(true);
    await appWindow.setFocus();
    await appWindow.requestUserAttention(UserAttentionType.Critical);
  } catch (e) {
    console.error("Window focus error:", e);
  }

  // 2. Play gentle attention chime
  playChime();

  // 3. Native OS notification
  try {
    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === "granted";
    }
    if (permissionGranted) {
      sendNotification({
        title: "👁️ Blink reminder",
        body: `Blink slowly ${getBlinks()} times to refresh your eyes.`,
      });
    }
  } catch (e) {
    console.error("Notification error:", e);
  }

  // 4. In-app overlay + countdown
  let count = getBlinks();
  blinkNum.textContent = count;
  overlay.classList.add("show");
  clearInterval(blinkId);
  blinkId = setInterval(() => {
    count--;
    blinkNum.textContent = Math.max(0, count);
    if (count <= 0) clearInterval(blinkId);
  }, 1000);
}

async function dismissReminder() {
  clearInterval(blinkId);
  overlay.classList.remove("show");

  // Release always-on-top so the window behaves normally again
  try {
    await invoke("release_focus");
  } catch (e) {}
  try {
    await appWindow.setAlwaysOnTop(false);
    await appWindow.setVisibleOnAllWorkspaces(false);
  } catch (e) {}

  if (running) startCountdown();
}

// ── Event listeners ────────────────────────────────────────────────────
startBtn.addEventListener("click", () => (running ? stopSession() : startSession()));
testBtn.addEventListener("click", () => triggerReminder());
document.getElementById("blink-done-btn").addEventListener("click", dismissReminder);
closeBtn.addEventListener("click", () => appWindow.hide()); // hide to tray, not quit

intervalSlider.addEventListener("input", () => {
  document.getElementById("interval-val").textContent = intervalSlider.value + " min";
  if (running) startCountdown();
});

blinkSlider.addEventListener("input", () => {
  document.getElementById("blinks-val").textContent = blinkSlider.value;
});

// ── Autostart ──────────────────────────────────────────────────────────
isAutostartEnabled()
  .then((enabled) => { autostartToggle.checked = enabled; })
  .catch(() => {});

autostartToggle.addEventListener("change", async () => {
  try {
    if (autostartToggle.checked) await enableAutostart();
    else await disableAutostart();
  } catch (e) {
    console.error("Autostart error:", e);
  }
});
