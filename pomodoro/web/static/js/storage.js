import { DEFAULT_SETTINGS, validateSettings } from "./timer.js";

const KEYS = Object.freeze({
  settings: "pomodoro.settings",
  stats: "pomodoro.stats",
  tasks: "pomodoro.tasks",
  history: "pomodoro.history",
  activity: "pomodoro.activity",
});

const defaultStats = Object.freeze({
  completedFocusCount: 0,
  totalFocusSeconds: 0,
});

function readJson(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function settingsToMinutes(settings) {
  return {
    focus: Math.floor(settings.focus.durationSeconds / 60),
    shortBreak: Math.floor(settings.shortBreak.durationSeconds / 60),
    longBreak: Math.floor(settings.longBreak.durationSeconds / 60),
    longBreakInterval: settings.longBreakInterval,
  };
}

function minutesToSettings(minutes) {
  return {
    focus: { durationSeconds: minutes.focus * 60 },
    shortBreak: { durationSeconds: minutes.shortBreak * 60 },
    longBreak: { durationSeconds: minutes.longBreak * 60 },
    longBreakInterval: minutes.longBreakInterval,
  };
}

export function createStorageRepository(storage) {
  return {
    loadSettings() {
      const saved = readJson(storage, KEYS.settings, null);
      return saved && validateSettings(saved) ? minutesToSettings(saved) : DEFAULT_SETTINGS;
    },
    saveSettings(settings) {
      storage.setItem(KEYS.settings, JSON.stringify(settingsToMinutes(settings)));
    },
    loadStats() {
      const saved = readJson(storage, KEYS.stats, defaultStats);
      return {
        completedFocusCount: Number.isInteger(saved.completedFocusCount) ? saved.completedFocusCount : 0,
        totalFocusSeconds: Number.isInteger(saved.totalFocusSeconds) ? saved.totalFocusSeconds : 0,
      };
    },
    saveStats(stats) {
      storage.setItem(KEYS.stats, JSON.stringify(stats));
    },
    loadTasks() {
      const tasks = readJson(storage, KEYS.tasks, []);
      return Array.isArray(tasks) ? tasks : [];
    },
    saveTasks(tasks) {
      storage.setItem(KEYS.tasks, JSON.stringify(tasks));
    },
    loadHistory() {
      const history = readJson(storage, KEYS.history, []);
      return Array.isArray(history) ? history : [];
    },
    saveHistory(history) {
      storage.setItem(KEYS.history, JSON.stringify(history));
    },
    loadActivityLog() {
      const activity = readJson(storage, KEYS.activity, []);
      return Array.isArray(activity) ? activity : [];
    },
    saveActivityLog(activity) {
      storage.setItem(KEYS.activity, JSON.stringify(activity));
    },
  };
}