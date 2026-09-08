import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../css/style.css", import.meta.url), "utf8");

test("UI contains the timer controls and progress areas", () => {
  for (const selector of [
    'id="timer-display"',
    'id="timer-ring"',
    'id="start-button"',
    'id="reset-button"',
    'id="completed-count"',
    'id="focus-duration"',
  ]) {
    assert.match(html, new RegExp(selector));
  }
});

test("UI includes accessible status and mode controls", () => {
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /data-mode="focus"/);
  assert.match(html, /data-mode="shortBreak"/);
  assert.match(html, /data-mode="longBreak"/);
});

test("styles define the timer ring and responsive layout", () => {
  assert.match(css, /conic-gradient/);
  assert.match(css, /@media \(max-width: 480px\)/);
});