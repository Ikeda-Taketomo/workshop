import {
  DEFAULT_SETTINGS,
  calculateRemainingSeconds,
  completeSession,
  createInitialState,
  formatSeconds,
  pauseTimer,
  resetTimer,
  setMode,
  startTimer,
  validateSettings,
} from "./timer.js";
import { createStorageRepository } from "./storage.js";

const MODE_LABELS = {
  focus: "作業中",
  shortBreak: "短い休憩",
  longBreak: "長い休憩",
};

const repository = createStorageRepository(window.localStorage);
let settings = DEFAULT_SETTINGS;
let state = createInitialState(settings);
let intervalId = null;
let tasks = [];
let history = [];
let activeTaskId = null;
let audioContext = null;

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) {
    audioContext = new AudioContextClass();
  }
  return audioContext;
}

function playTone(frequency, durationMs, oscillatorType, gainValue) {
  const context = getAudioContext();
  if (!context) return;

  if (context.state === "suspended") {
    context.resume().catch(() => {});
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = oscillatorType;
  oscillator.frequency.value = frequency;
  gain.gain.value = gainValue;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + durationMs / 1000);
}

function playSound(kind) {
  if (!settings.sounds[kind]) return;

  const sounds = {
    start: () => playTone(880, 90, "sine", 0.035),
    end: () => playTone(660, 220, "triangle", 0.045),
    tick: () => playTone(520, 30, "square", 0.012),
  };

  sounds[kind]?.();
}

function getRemainingSeconds(nowMs = Date.now()) {
  if (!state.isRunning || state.startedAtMs === null) {
    return state.remainingSeconds;
  }

  return calculateRemainingSeconds(state.remainingSeconds, state.startedAtMs, nowMs);
}

function updateTimerRing(remainingSeconds) {
  const ring = document.querySelector("#timer-ring");
  const duration = settings[state.mode].durationSeconds;
  const progress = duration === 0 ? 0 : (1 - remainingSeconds / duration) * 360;

  ring?.style.setProperty("--progress", `${Math.max(0, Math.min(360, progress))}deg`);
}

function render() {
  const remainingSeconds = getRemainingSeconds();
  const timerDisplay = document.querySelector("#timer-display");
  const modeLabel = document.querySelector("#mode-label");
  const status = document.querySelector("#timer-status");
  const startButton = document.querySelector("#start-button");
  const completedCount = document.querySelector("#completed-count");
  const focusDuration = document.querySelector("#focus-duration");
  const taskList = document.querySelector("#task-list");
  const historyList = document.querySelector("#session-history");

  if (timerDisplay) timerDisplay.textContent = formatSeconds(remainingSeconds);
  if (modeLabel) modeLabel.textContent = MODE_LABELS[state.mode];
  if (status) status.textContent = state.isRunning ? "実行中" : "停止中";
  if (startButton) startButton.textContent = state.isRunning ? "一時停止" : "開始";
  if (completedCount) completedCount.textContent = String(state.completedFocusCount);
  if (focusDuration) {
    const totalMinutes = Math.floor(state.totalFocusSeconds / 60);
    focusDuration.textContent = `${Math.floor(totalMinutes / 60)}時間${String(totalMinutes % 60).padStart(2, "0")}分`;
  }

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === state.mode);
    button.disabled = state.isRunning;
  });
  updateTimerRing(remainingSeconds);
  renderTasks(taskList);
  renderHistory(historyList);
}

function renderTasks(taskList) {
  if (!taskList) return;
  taskList.replaceChildren();

  tasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = `task-item${task.completed ? " is-complete" : ""}`;
    const label = document.createElement("span");
    label.textContent = task.title;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = task.completed ? "未完了に戻す" : "完了";
    button.addEventListener("click", () => {
      task.completed = !task.completed;
      repository.saveTasks(tasks);
      render();
    });
    item.append(label, button);
    item.addEventListener("click", (event) => {
      if (event.target !== button) {
        activeTaskId = task.id;
        render();
      }
    });
    if (task.id === activeTaskId) item.setAttribute("aria-current", "true");
    taskList.append(item);
  });
}

function renderHistory(historyList) {
  if (!historyList) return;
  historyList.replaceChildren();

  history.slice().reverse().slice(0, 10).forEach((session) => {
    const item = document.createElement("li");
    item.className = "history-item";
    item.textContent = `${MODE_LABELS[session.mode]}・${session.durationMinutes}分・${new Date(session.completedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`;
    historyList.append(item);
  });
}

function persistState() {
  repository.saveStats({
    completedFocusCount: state.completedFocusCount,
    totalFocusSeconds: state.totalFocusSeconds,
  });
}

function notifyCompletion(mode) {
  playSound("end");
  document.title = `${MODE_LABELS[mode]}が完了しました | ポモドーロタイマー`;
  if ("vibrate" in navigator) navigator.vibrate([120, 80, 120]);
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("ポモドーロタイマー", { body: `${MODE_LABELS[mode]}が完了しました。` });
  }
}

function stopInterval() {
  if (intervalId !== null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
}

function tick() {
  if (getRemainingSeconds() > 0) {
    playSound("tick");
    render();
    return;
  }

  stopInterval();
  const completedMode = state.mode;
  state = completeSession({ ...state, remainingSeconds: 0 }, settings);
  history.push({
    id: `session-${Date.now()}`,
    mode: completedMode,
    durationMinutes: Math.floor(settings[completedMode].durationSeconds / 60),
    completedAt: new Date().toISOString(),
    taskId: activeTaskId,
  });
  repository.saveHistory(history);
  persistState();
  notifyCompletion(completedMode);
  render();
}

function toggleTimer() {
  if (state.isRunning) {
    state = pauseTimer(state, Date.now());
    stopInterval();
  } else {
    state = startTimer(state, Date.now());
    stopInterval();
    playSound("start");
    intervalId = window.setInterval(tick, 1000);
  }

  render();
}

function resetCurrentTimer() {
  stopInterval();
  state = resetTimer(state, settings);
  render();
}

function chooseMode(event) {
  if (state.isRunning) return;
  state = setMode(state, event.currentTarget.dataset.mode, settings);
  render();
}

function setSettingsMessage(message, stateName) {
  const error = document.querySelector("#settings-error");
  if (!error) return;
  error.textContent = message;
  if (stateName) {
    error.dataset.state = stateName;
  } else {
    delete error.dataset.state;
  }
}

function readSettingsForm() {
  return {
    focus: Number(document.querySelector("#focus-duration-input")?.value),
    shortBreak: Number(document.querySelector("#short-break-input")?.value),
    longBreak: Number(document.querySelector("#long-break-input")?.value),
    longBreakInterval: Number(document.querySelector("#long-break-interval-input")?.value),
    theme: document.querySelector("#theme-input")?.value,
    sounds: {
      start: Boolean(document.querySelector("#start-sound-input")?.checked),
      end: Boolean(document.querySelector("#end-sound-input")?.checked),
      tick: Boolean(document.querySelector("#tick-sound-input")?.checked),
    },
  };
}

function toSettings(rawSettings) {
  return {
    focus: { durationSeconds: rawSettings.focus * 60 },
    shortBreak: { durationSeconds: rawSettings.shortBreak * 60 },
    longBreak: { durationSeconds: rawSettings.longBreak * 60 },
    longBreakInterval: rawSettings.longBreakInterval,
    theme: rawSettings.theme,
    sounds: rawSettings.sounds,
  };
}

function applySettings(nextSettings, message = "設定を保存しました。") {
  settings = nextSettings;
  applyTheme(settings.theme);
  repository.saveSettings(settings);
  if (!state.isRunning) {
    state = resetTimer(state, settings);
  }
  setSettingsMessage(message, "success");
  render();
}

function saveSettings() {
  const rawSettings = readSettingsForm();

  if (!validateSettings(rawSettings)) {
    setSettingsMessage("選択肢の中から設定してください。", "error");
    return;
  }

  applySettings(toSettings(rawSettings));
}

function updateSettingsImmediately() {
  const rawSettings = {
    ...readSettingsForm(),
  };

  if (!validateSettings(rawSettings)) {
    setSettingsMessage("選択肢の中から設定してください。", "error");
    return;
  }

  applySettings(toSettings(rawSettings), "設定を更新しました。");
}

function addTask(event) {
  event.preventDefault();
  const input = document.querySelector("#task-input");
  const title = input?.value.trim();
  if (!title) return;

  tasks.push({ id: `task-${Date.now()}`, title, completed: false });
  repository.saveTasks(tasks);
  input.value = "";
  render();
}

async function enableNotifications() {
  if (!("Notification" in window)) return;
  await Notification.requestPermission();
  render();
}

document.addEventListener("DOMContentLoaded", () => {
  settings = repository.loadSettings();
  applyTheme(settings.theme);
  const stats = repository.loadStats();
  state = { ...createInitialState(settings), ...stats, remainingSeconds: settings.focus.durationSeconds };
  tasks = repository.loadTasks();
  history = repository.loadHistory();

  const settingValues = {
    "#focus-duration-input": settings.focus.durationSeconds / 60,
    "#short-break-input": settings.shortBreak.durationSeconds / 60,
    "#long-break-input": settings.longBreak.durationSeconds / 60,
    "#long-break-interval-input": settings.longBreakInterval,
    "#theme-input": settings.theme,
  };
  Object.entries(settingValues).forEach(([selector, value]) => {
    const input = document.querySelector(selector);
    if (input) input.value = String(value);
  });
  const soundValues = {
    "#start-sound-input": settings.sounds.start,
    "#end-sound-input": settings.sounds.end,
    "#tick-sound-input": settings.sounds.tick,
  };
  Object.entries(soundValues).forEach(([selector, value]) => {
    const input = document.querySelector(selector);
    if (input) input.checked = value;
  });

  document.querySelector("#start-button")?.addEventListener("click", toggleTimer);
  document.querySelector("#reset-button")?.addEventListener("click", resetCurrentTimer);
  document.querySelector("#save-settings-button")?.addEventListener("click", saveSettings);
  document.querySelectorAll("[data-setting-control]").forEach((control) => {
    control.addEventListener("change", updateSettingsImmediately);
  });
  document.querySelector("#task-form")?.addEventListener("submit", addTask);
  document.querySelector("#notification-button")?.addEventListener("click", enableNotifications);
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", chooseMode);
  });

  render();
});