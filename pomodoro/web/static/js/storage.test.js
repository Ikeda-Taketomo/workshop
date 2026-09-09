import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS } from "./timer.js";
import { createStorageRepository } from "./storage.js";

function createFakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("storage saves and loads timer settings", () => {
  const repository = createStorageRepository(createFakeStorage());
  const settings = {
    focus: { durationSeconds: 35 * 60 },
    shortBreak: { durationSeconds: 10 * 60 },
    longBreak: { durationSeconds: 15 * 60 },
    longBreakInterval: 3,
    theme: "focus",
    sounds: { start: false, end: true, tick: true },
  };

  repository.saveSettings(settings);

  assert.deepEqual(repository.loadSettings(), settings);
});

test("storage fills in new defaults for legacy saved settings", () => {
  const repository = createStorageRepository(createFakeStorage({
    "pomodoro.settings": JSON.stringify({
      focus: 25,
      shortBreak: 5,
      longBreak: 15,
      longBreakInterval: 4,
    }),
  }));

  assert.deepEqual(repository.loadSettings(), DEFAULT_SETTINGS);
});

test("storage falls back to defaults for invalid or corrupt settings", () => {
  const repository = createStorageRepository(createFakeStorage({
    "pomodoro.settings": "not-json",
  }));

  assert.deepEqual(repository.loadSettings(), DEFAULT_SETTINGS);
});

test("storage saves stats, tasks, and history", () => {
  const repository = createStorageRepository(createFakeStorage());
  const stats = { completedFocusCount: 2, totalFocusSeconds: 3000 };
  const tasks = [{ id: "task-1", title: "設計" }];
  const history = [{ id: "session-1", mode: "focus" }];

  repository.saveStats(stats);
  repository.saveTasks(tasks);
  repository.saveHistory(history);

  assert.deepEqual(repository.loadStats(), stats);
  assert.deepEqual(repository.loadTasks(), tasks);
  assert.deepEqual(repository.loadHistory(), history);
});