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

test("app renders modes, progress, and automatic session completion", () => {
  assert.match(app, /data-mode/);
  assert.match(app, /#completed-count/);
  assert.match(app, /completeSession/);
  assert.match(app, /calculateProgressDegrees/);
  assert.match(app, /calculateTimerHue/);
  assert.match(app, /setInterval\(tick,\s*1000\)/);
});

test("app connects persistence, settings, tasks, history, and notifications", () => {
  for (const expected of [
    "createStorageRepository",
    "saveSettings",
    "loadSettings",
    "task-form",
    "session-history",
    "Notification.requestPermission",
  ]) {
    assert.match(app, new RegExp(expected.replace(/[.]/g, "\\.")));
  }
});

test("app only toggles the focus ambience class while the focus timer is running", () => {
  assert.match(app, /is-focus-running/);
  assert.doesNotMatch(app, /classList\.toggle\("is-focus"/);
});