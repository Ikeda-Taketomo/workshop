export const XP_PER_FOCUS = 50;
export const XP_PER_LEVEL = 100;

export const BADGES = Object.freeze([
  { id: "first-focus", label: "初回完了", description: "はじめてのポモドーロを完了" },
  { id: "streak-3", label: "3日連続", description: "3日連続で集中セッションを完了" },
  { id: "week-10", label: "今週10回完了", description: "1週間で10回のポモドーロを完了" },
]);

function toValidDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayKey(date) {
  const normalized = startOfDay(date);
  return `${normalized.getFullYear()}-${String(normalized.getMonth() + 1).padStart(2, "0")}-${String(normalized.getDate()).padStart(2, "0")}`;
}

function startOfWeek(date) {
  const start = startOfDay(date);
  const diff = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - diff);
  return start;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function summarizePeriod(completions, attempts, startDate) {
  const completedSessions = completions.filter(({ completedAt }) => completedAt >= startDate);
  const startedSessions = attempts.filter(({ startedAt }) => startedAt >= startDate);
  const completedCount = completedSessions.length;
  const completionRate = startedSessions.length === 0
    ? 0
    : Math.min(100, Math.round((completedCount / startedSessions.length) * 100));
  const averageFocusMinutes = completedCount === 0
    ? 0
    : Math.round(completedSessions.reduce((total, session) => total + session.durationSeconds, 0) / completedCount / 60);

  return {
    completedCount,
    completionRate,
    averageFocusMinutes,
  };
}

export function calculateLevel(xp) {
  const safeXp = Math.max(0, Number(xp) || 0);
  const level = Math.floor(safeXp / XP_PER_LEVEL) + 1;
  const currentLevelXp = safeXp % XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL - currentLevelXp || XP_PER_LEVEL;

  return {
    level,
    currentLevelXp,
    xpToNextLevel,
    progressPercent: Math.round((currentLevelXp / XP_PER_LEVEL) * 100),
  };
}

export function calculateStreakDays(history, now = new Date()) {
  const focusDays = [...new Set(
    history
      .filter((session) => session.mode === "focus")
      .map((session) => toValidDate(session.completedAt))
      .filter(Boolean)
      .map(dayKey),
  )].sort();

  if (focusDays.length === 0) {
    return 0;
  }

  const today = startOfDay(now);
  const latest = startOfDay(new Date(focusDays.at(-1)));
  const latestGap = Math.round((today - latest) / 86400000);

  if (latestGap > 1) {
    return 0;
  }

  let streak = 1;
  for (let index = focusDays.length - 1; index > 0; index -= 1) {
    const current = startOfDay(new Date(focusDays[index]));
    const previous = startOfDay(new Date(focusDays[index - 1]));
    if (Math.round((current - previous) / 86400000) !== 1) {
      break;
    }
    streak += 1;
  }

  return streak;
}

export function summarizeGamification(history, attempts, now = new Date()) {
  const focusCompletions = history
    .filter((session) => session.mode === "focus")
    .map((session) => ({
      completedAt: toValidDate(session.completedAt),
      durationSeconds: Number(session.durationSeconds) || Number(session.durationMinutes) * 60 || 0,
    }))
    .filter((session) => session.completedAt);
  const focusAttempts = attempts
    .map((attempt) => ({
      startedAt: toValidDate(attempt.startedAt),
      mode: attempt.mode,
    }))
    .filter((attempt) => attempt.mode === "focus" && attempt.startedAt);
  const xp = focusCompletions.length * XP_PER_FOCUS;
  const level = calculateLevel(xp);
  const streakDays = calculateStreakDays(history, now);
  const weekly = summarizePeriod(focusCompletions, focusAttempts, startOfWeek(now));
  const monthly = summarizePeriod(focusCompletions, focusAttempts, startOfMonth(now));
  const badges = BADGES.filter((badge) => {
    switch (badge.id) {
      case "first-focus":
        return focusCompletions.length >= 1;
      case "streak-3":
        return streakDays >= 3;
      case "week-10":
        return weekly.completedCount >= 10;
      default:
        return false;
    }
  });

  return {
    xp,
    level,
    streakDays,
    badges,
    weekly,
    monthly,
  };
}

export function compareAchievements(previousSummary, nextSummary) {
  const previousLevel = previousSummary?.level?.level ?? 1;
  if (nextSummary.level.level > previousLevel) {
    return {
      type: "level",
      message: `レベル${nextSummary.level.level}に到達しました！`,
    };
  }

  const previousBadges = new Set((previousSummary?.badges ?? []).map((badge) => badge.id));
  const unlockedBadge = nextSummary.badges.find((badge) => !previousBadges.has(badge.id));
  if (unlockedBadge) {
    return {
      type: "badge",
      message: `バッジ獲得: ${unlockedBadge.label}`,
    };
  }

  return null;
}
