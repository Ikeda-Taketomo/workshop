import test from "node:test";
import assert from "node:assert/strict";
import {
  BADGES,
  XP_PER_FOCUS,
  calculateLevel,
  calculateStreakDays,
  compareAchievements,
  summarizeGamification,
} from "./gamification.js";

test("calculateLevel converts XP into level progress", () => {
  assert.deepEqual(calculateLevel(150), {
    level: 2,
    currentLevelXp: 50,
    xpToNextLevel: 50,
    progressPercent: 50,
  });
});

test("calculateStreakDays counts consecutive focus days and resets after a gap", () => {
  const history = [
    { mode: "focus", completedAt: "2026-09-07T09:00:00.000Z" },
    { mode: "focus", completedAt: "2026-09-08T09:00:00.000Z" },
    { mode: "focus", completedAt: "2026-09-09T09:00:00.000Z" },
  ];

  assert.equal(calculateStreakDays(history, new Date("2026-09-09T12:00:00.000Z")), 3);
  assert.equal(calculateStreakDays(history, new Date("2026-09-12T12:00:00.000Z")), 0);
});

test("summarizeGamification returns XP, badges, weekly and monthly stats", () => {
  const completionDates = [
    "2026-09-08T09:00:00.000Z",
    "2026-09-08T13:00:00.000Z",
    "2026-09-08T17:00:00.000Z",
    "2026-09-09T09:00:00.000Z",
    "2026-09-09T13:00:00.000Z",
    "2026-09-09T17:00:00.000Z",
    "2026-09-10T09:00:00.000Z",
    "2026-09-10T11:00:00.000Z",
    "2026-09-10T14:00:00.000Z",
    "2026-09-10T17:00:00.000Z",
  ];
  const history = completionDates.map((completedAt) => ({
    mode: "focus",
    completedAt,
    durationSeconds: 1500,
  }));
  const attemptDates = [
    "2026-09-08T08:30:00.000Z",
    "2026-09-08T10:30:00.000Z",
    "2026-09-08T12:30:00.000Z",
    "2026-09-08T14:30:00.000Z",
    "2026-09-09T08:30:00.000Z",
    "2026-09-09T10:30:00.000Z",
    "2026-09-09T12:30:00.000Z",
    "2026-09-09T14:30:00.000Z",
    "2026-09-10T08:30:00.000Z",
    "2026-09-10T10:30:00.000Z",
    "2026-09-10T12:30:00.000Z",
    "2026-09-10T14:30:00.000Z",
  ];
  const attempts = attemptDates.map((startedAt) => ({
    mode: "focus",
    startedAt,
  }));

  const summary = summarizeGamification(history, attempts, new Date("2026-09-10T12:00:00.000Z"));

  assert.equal(summary.xp, 10 * XP_PER_FOCUS);
  assert.equal(summary.level.level, 6);
  assert.equal(summary.streakDays, 3);
  assert.deepEqual(summary.badges.map((badge) => badge.id), BADGES.map((badge) => badge.id));
  assert.deepEqual(summary.weekly, {
    completedCount: 10,
    completionRate: 83,
    averageFocusMinutes: 25,
  });
  assert.deepEqual(summary.monthly, {
    completedCount: 10,
    completionRate: 83,
    averageFocusMinutes: 25,
  });
});

test("compareAchievements prioritizes level ups before badge unlocks", () => {
  const previousSummary = { level: { level: 1 }, badges: [] };
  const nextSummary = { level: { level: 2 }, badges: [BADGES[0]] };

  assert.deepEqual(compareAchievements(previousSummary, nextSummary), {
    type: "level",
    message: "レベル2に到達しました！",
  });
});
