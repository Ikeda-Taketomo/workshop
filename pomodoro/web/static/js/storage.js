import { DEFAULT_SETTINGS, validateSettings } from "./timer.js";

const KEYS = Object.freeze({
  settings: "pomodoro.settings",
  stats: "pomodoro.stats",
  tasks: "pomodoro.tasks",
  history: "pomodoro.history",
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
    theme: settings.theme,
    sounds: {
      start: settings.sounds.start,
      end: settings.sounds.end,
      tick: settings.sounds.tick,
    },
  };
}

function minutesToSettings(minutes) {
  return {
    focus: { durationSeconds: minutes.focus * 60 },
    shortBreak: { durationSeconds: minutes.shortBreak * 60 },
    longBreak: { durationSeconds: minutes.longBreak * 60 },
    longBreakInterval: minutes.longBreakInterval,
    theme: minutes.theme,
    sounds: {
      start: minutes.sounds.start,
      end: minutes.sounds.end,
      tick: minutes.sounds.tick,
    },
  };
}

function normalizeSavedSettings(saved) {
  if (!saved || typeof saved !== "object") {
    return null;
  }

  return {
    focus: Number(saved.focus),
    shortBreak: Number(saved.shortBreak),
    longBreak: Number(saved.longBreak),
    longBreakInterval: Number(saved.longBreakInterval),
    theme: typeof saved.theme === "string" ? saved.theme : DEFAULT_SETTINGS.theme,
    sounds: {
      start: typeof saved.sounds?.start === "boolean" ? saved.sounds.start : DEFAULT_SETTINGS.sounds.start,
      end: typeof saved.sounds?.end === "boolean" ? saved.sounds.end : DEFAULT_SETTINGS.sounds.end,
      tick: typeof saved.sounds?.tick === "boolean" ? saved.sounds.tick : DEFAULT_SETTINGS.sounds.tick,
    },
  };
}

export function createStorageRepository(storage) {
  return {
    loadSettings() {
      const saved = readJson(storage, KEYS.settings, null);
      const normalized = normalizeSavedSettings(saved);
      return normalized && validateSettings(normalized) ? minutesToSettings(normalized) : DEFAULT_SETTINGS;
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
  };
}