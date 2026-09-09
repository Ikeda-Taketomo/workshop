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
import { compareAchievements, summarizeGamification } from "./gamification.js";
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
let activityLog = [];
let activeTaskId = null;
let feedbackTimeoutId = null;

function getGamificationSummary() {
  return summarizeGamification(history, activityLog, new Date());
}

function showAchievementFeedback(feedback) {
  const container = document.querySelector("#achievement-feedback");
  if (!container || !feedback) return;

  container.hidden = false;
  container.textContent = feedback.message;
  container.dataset.kind = feedback.type;
  window.clearTimeout(feedbackTimeoutId);
  feedbackTimeoutId = window.setTimeout(() => {
    container.hidden = true;
    container.textContent = "";
    delete container.dataset.kind;
  }, 3600);
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
  const summary = getGamificationSummary();

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
  renderGamification(summary);
  renderTasks(taskList);
  renderHistory(historyList);
}

function renderGamification(summary) {
  const xpValue = document.querySelector("#xp-value");
  const levelValue = document.querySelector("#level-value");
  const streakValue = document.querySelector("#streak-value");
  const levelProgressBar = document.querySelector("#level-progress-bar");
  const levelProgressText = document.querySelector("#level-progress-text");
  const badgeList = document.querySelector("#badge-list");
  const weeklyCompleted = document.querySelector("#weekly-completed");
  const weeklyRate = document.querySelector("#weekly-rate");
  const weeklyAverage = document.querySelector("#weekly-average");
  const monthlyCompleted = document.querySelector("#monthly-completed");
  const monthlyRate = document.querySelector("#monthly-rate");
  const monthlyAverage = document.querySelector("#monthly-average");

  if (xpValue) xpValue.textContent = `${summary.xp} XP`;
  if (levelValue) levelValue.textContent = String(summary.level.level);
  if (streakValue) streakValue.textContent = `${summary.streakDays}日`;
  if (levelProgressBar) levelProgressBar.style.width = `${summary.level.progressPercent}%`;
  if (levelProgressText) {
    levelProgressText.textContent = `次のレベルまであと${summary.level.xpToNextLevel} XP`;
  }
  if (weeklyCompleted) weeklyCompleted.textContent = `${summary.weekly.completedCount}回`;
  if (weeklyRate) weeklyRate.textContent = `${summary.weekly.completionRate}%`;
  if (weeklyAverage) weeklyAverage.textContent = `${summary.weekly.averageFocusMinutes}分`;
  if (monthlyCompleted) monthlyCompleted.textContent = `${summary.monthly.completedCount}回`;
  if (monthlyRate) monthlyRate.textContent = `${summary.monthly.completionRate}%`;
  if (monthlyAverage) monthlyAverage.textContent = `${summary.monthly.averageFocusMinutes}分`;

  if (!badgeList) return;
  badgeList.replaceChildren();
  summary.badges.forEach((badge) => {
    const item = document.createElement("li");
    item.className = "badge-item";
    const title = document.createElement("strong");
    title.textContent = badge.label;
    const description = document.createElement("span");
    description.textContent = badge.description;
    item.append(title, description);
    badgeList.append(item);
  });
  if (summary.badges.length === 0) {
    const item = document.createElement("li");
    item.className = "badge-item badge-item-empty";
    item.textContent = "まだバッジはありません";
    badgeList.append(item);
  }
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
    render();
    return;
  }

  stopInterval();
  const completedMode = state.mode;
  const previousSummary = getGamificationSummary();
  state = completeSession({ ...state, remainingSeconds: 0 }, settings);
  history.push({
    id: `session-${Date.now()}`,
    mode: completedMode,
    durationMinutes: Math.floor(settings[completedMode].durationSeconds / 60),
    durationSeconds: settings[completedMode].durationSeconds,
    completedAt: new Date().toISOString(),
    taskId: activeTaskId,
  });
  repository.saveHistory(history);
  persistState();
  const nextSummary = getGamificationSummary();
  showAchievementFeedback(compareAchievements(previousSummary, nextSummary));
  notifyCompletion(completedMode);
  render();
}

function toggleTimer() {
  if (state.isRunning) {
    state = pauseTimer(state, Date.now());
    stopInterval();
  } else {
    if (state.mode === "focus" && state.remainingSeconds === settings.focus.durationSeconds) {
      activityLog.push({
        id: `attempt-${Date.now()}`,
        mode: "focus",
        startedAt: new Date().toISOString(),
      });
      repository.saveActivityLog(activityLog);
    }
    state = startTimer(state, Date.now());
    stopInterval();
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

function saveSettings() {
  const rawSettings = {
    focus: Number(document.querySelector("#focus-duration-input")?.value),
    shortBreak: Number(document.querySelector("#short-break-input")?.value),
    longBreak: Number(document.querySelector("#long-break-input")?.value),
    longBreakInterval: Number(document.querySelector("#long-break-interval-input")?.value),
  };
  const error = document.querySelector("#settings-error");

  if (!validateSettings(rawSettings)) {
    if (error) error.textContent = "1以上の整数で、設定可能な範囲の値を入力してください。";
    return;
  }

  settings = {
    focus: { durationSeconds: rawSettings.focus * 60 },
    shortBreak: { durationSeconds: rawSettings.shortBreak * 60 },
    longBreak: { durationSeconds: rawSettings.longBreak * 60 },
    longBreakInterval: rawSettings.longBreakInterval,
  };
  repository.saveSettings(settings);
  if (error) error.textContent = "保存しました。";
  if (!state.isRunning) state = resetTimer(state, settings);
  render();
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
  const stats = repository.loadStats();
  state = { ...createInitialState(settings), ...stats, remainingSeconds: settings.focus.durationSeconds };
  tasks = repository.loadTasks();
  history = repository.loadHistory();
  activityLog = repository.loadActivityLog();

  const settingValues = {
    "#focus-duration-input": settings.focus.durationSeconds / 60,
    "#short-break-input": settings.shortBreak.durationSeconds / 60,
    "#long-break-input": settings.longBreak.durationSeconds / 60,
    "#long-break-interval-input": settings.longBreakInterval,
  };
  Object.entries(settingValues).forEach(([selector, value]) => {
    const input = document.querySelector(selector);
    if (input) input.value = String(value);
  });

  document.querySelector("#start-button")?.addEventListener("click", toggleTimer);
  document.querySelector("#reset-button")?.addEventListener("click", resetCurrentTimer);
  document.querySelector("#save-settings-button")?.addEventListener("click", saveSettings);
  document.querySelector("#task-form")?.addEventListener("submit", addTask);
  document.querySelector("#notification-button")?.addEventListener("click", enableNotifications);
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", chooseMode);
  });

  render();
});