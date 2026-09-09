import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("./app.js", import.meta.url), "utf8");

test("app connects the main timer controls", () => {
  assert.match(app, /#start-button/);
  assert.match(app, /#reset-button/);
  assert.match(app, /toggleTimer/);
  assert.match(app, /resetCurrentTimer/);
});

test("app renders modes, progress, gamification, and automatic session completion", () => {
  assert.match(app, /data-mode/);
  assert.match(app, /#completed-count/);
  assert.match(app, /#xp-value/);
  assert.match(app, /#streak-value/);
  assert.match(app, /summarizeGamification/);
  assert.match(app, /completeSession/);
  assert.match(app, /setInterval\(tick,\s*1000\)/);
});

test("app connects persistence, settings, tasks, history, activity logs, and notifications", () => {
  for (const expected of [
    "createStorageRepository",
    "saveSettings",
    "loadSettings",
    "saveActivityLog",
    "loadActivityLog",
    "task-form",
    "session-history",
    "Notification.requestPermission",
  ]) {
    assert.match(app, new RegExp(expected.replace(/[.]/g, "\\.")));
  }
});