import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateProgressDegrees,
  DEFAULT_SETTINGS,
  calculateRemainingSeconds,
  calculateTimerHue,
  completeSession,
  createInitialState,
  formatSeconds,
  nextMode,
  pauseTimer,
  resetTimer,
  setMode,
  startTimer,
  validateSettings,
} from "./timer.js";

const initialState = createInitialState();

test("calculateRemainingSeconds uses elapsed time instead of interval count", () => {
  assert.equal(calculateRemainingSeconds(1500, 1000, 91000), 1410);
  assert.equal(calculateRemainingSeconds(1500, 1000, 2000000), 0);
});

test("formatSeconds returns a zero-padded minute and second value", () => {
  assert.equal(formatSeconds(1500), "25:00");
  assert.equal(formatSeconds(65), "01:05");
  assert.equal(formatSeconds(-1), "00:00");
});

test("calculateProgressDegrees returns the remaining arc of the timer ring", () => {
  assert.equal(calculateProgressDegrees(1500, 1500), 360);
  assert.equal(calculateProgressDegrees(750, 1500), 180);
  assert.equal(calculateProgressDegrees(-10, 1500), 0);
});

test("calculateTimerHue shifts from blue to yellow to red over time", () => {
  assert.equal(calculateTimerHue(1500, 1500), 210);
  assert.equal(calculateTimerHue(1125, 1500), 130);
  assert.equal(calculateTimerHue(750, 1500), 50);
  assert.equal(calculateTimerHue(375, 1500), 28);
  assert.equal(calculateTimerHue(0, 1500), 6);
});

test("startTimer marks the timer as running at the supplied time", () => {
  assert.deepEqual(startTimer(initialState, 1234), {
    ...initialState,
    isRunning: true,
    startedAtMs: 1234,
  });
});

test("pauseTimer stores the elapsed remaining time", () => {
  const runningState = startTimer(initialState, 1000);

  assert.deepEqual(pauseTimer(runningState, 91000), {
    ...initialState,
    isRunning: false,
    startedAtMs: null,
    remainingSeconds: 1410,
  });
});

test("pauseTimer does not change an already paused timer", () => {
  assert.deepEqual(pauseTimer(initialState, 1000), initialState);
});

test("resetTimer returns the current mode to its configured duration", () => {
  const runningState = {
    ...startTimer(initialState, 1000),
    remainingSeconds: 10,
  };

  assert.deepEqual(resetTimer(runningState), initialState);
});

test("nextMode selects short and long breaks at the configured interval", () => {
  assert.equal(nextMode("focus", 1), "shortBreak");
  assert.equal(nextMode("focus", 4), "longBreak");
  assert.equal(nextMode("shortBreak", 1), "focus");
  assert.equal(nextMode("longBreak", 4), "focus");
});

test("setMode resets the timer to the selected mode", () => {
  const runningState = startTimer(initialState, 1000);

  assert.deepEqual(setMode(runningState, "shortBreak"), {
    ...initialState,
    mode: "shortBreak",
    remainingSeconds: DEFAULT_SETTINGS.shortBreak.durationSeconds,
  });
});

test("completeSession advances to a short break and records focus time", () => {
  assert.deepEqual(completeSession(initialState), {
    ...initialState,
    mode: "shortBreak",
    remainingSeconds: DEFAULT_SETTINGS.shortBreak.durationSeconds,
    completedFocusCount: 1,
    totalFocusSeconds: DEFAULT_SETTINGS.focus.durationSeconds,
  });
});

test("completeSession advances to a long break on the configured interval", () => {
  const state = { ...initialState, completedFocusCount: 3 };

  assert.equal(completeSession(state).mode, "longBreak");
});

test("validateSettings accepts values in range and rejects invalid values", () => {
  assert.equal(validateSettings({
    focus: 25,
    shortBreak: 5,
    longBreak: 15,
    longBreakInterval: 4,
    theme: "dark",
    sounds: { start: true, end: false, tick: true },
  }), true);
  assert.equal(validateSettings({
    focus: 20,
    shortBreak: 5,
    longBreak: 15,
    longBreakInterval: 4,
    theme: "dark",
    sounds: { start: true, end: false, tick: true },
  }), false);
  assert.equal(validateSettings({
    focus: 25,
    shortBreak: 5,
    longBreak: 15,
    longBreakInterval: 4,
    theme: "sepia",
    sounds: { start: true, end: false, tick: true },
  }), false);
  assert.equal(validateSettings({
    focus: 25,
    shortBreak: 5,
    longBreak: 15,
    longBreakInterval: 4,
    theme: "light",
    sounds: { start: true, end: "no", tick: true },
  }), false);
});