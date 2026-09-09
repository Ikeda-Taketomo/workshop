export const DEFAULT_SETTINGS = Object.freeze({
  focus: { durationSeconds: 25 * 60 },
  shortBreak: { durationSeconds: 5 * 60 },
  longBreak: { durationSeconds: 15 * 60 },
  longBreakInterval: 4,
});

export const MODES = Object.freeze(["focus", "shortBreak", "longBreak"]);

export function createInitialState(settings = DEFAULT_SETTINGS) {
  return {
    mode: "focus",
    isRunning: false,
    startedAtMs: null,
    remainingSeconds: settings.focus.durationSeconds,
    completedFocusCount: 0,
    totalFocusSeconds: 0,
  };
}

export function calculateRemainingSeconds(durationSeconds, startedAtMs, nowMs) {
  return Math.max(0, durationSeconds - Math.floor((nowMs - startedAtMs) / 1000));
}

export function formatSeconds(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutesPart = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secondsPart = (seconds % 60).toString().padStart(2, "0");

  return `${minutesPart}:${secondsPart}`;
}

export function calculateProgressDegrees(remainingSeconds, durationSeconds) {
  if (durationSeconds <= 0) {
    return 0;
  }

  const clampedRemainingSeconds = Math.max(0, Math.min(durationSeconds, remainingSeconds));
  return (clampedRemainingSeconds / durationSeconds) * 360;
}

export function calculateTimerHue(remainingSeconds, durationSeconds) {
  if (durationSeconds <= 0) {
    return 6;
  }

  const clampedRemainingSeconds = Math.max(0, Math.min(durationSeconds, remainingSeconds));
  const elapsedRatio = 1 - (clampedRemainingSeconds / durationSeconds);

  if (elapsedRatio <= 0.5) {
    return Math.round(210 - (160 * (elapsedRatio / 0.5)));
  }

  return Math.round(50 - (44 * ((elapsedRatio - 0.5) / 0.5)));
}

export function startTimer(state, nowMs) {
  return {
    ...state,
    isRunning: true,
    startedAtMs: nowMs,
  };
}

export function pauseTimer(state, nowMs) {
  if (!state.isRunning || state.startedAtMs === null) {
    return state;
  }

  return {
    ...state,
    isRunning: false,
    startedAtMs: null,
    remainingSeconds: calculateRemainingSeconds(
      state.remainingSeconds,
      state.startedAtMs,
      nowMs,
    ),
  };
}

export function resetTimer(state, settings = DEFAULT_SETTINGS) {
  return {
    ...state,
    isRunning: false,
    startedAtMs: null,
    remainingSeconds: settings[state.mode].durationSeconds,
  };
}

export function setMode(state, mode, settings = DEFAULT_SETTINGS) {
  if (!MODES.includes(mode)) {
    return state;
  }

  return resetTimer({ ...state, mode }, settings);
}

export function nextMode(mode, completedFocusCount, settings = DEFAULT_SETTINGS) {
  if (mode === "focus") {
    return completedFocusCount % settings.longBreakInterval === 0
      ? "longBreak"
      : "shortBreak";
  }

  return "focus";
}

export function completeSession(state, settings = DEFAULT_SETTINGS) {
  const completedFocusCount = state.mode === "focus"
    ? state.completedFocusCount + 1
    : state.completedFocusCount;
  const totalFocusSeconds = state.mode === "focus"
    ? state.totalFocusSeconds + settings.focus.durationSeconds
    : state.totalFocusSeconds;
  const mode = nextMode(state.mode, completedFocusCount, settings);

  return {
    ...state,
    mode,
    isRunning: false,
    startedAtMs: null,
    remainingSeconds: settings[mode].durationSeconds,
    completedFocusCount,
    totalFocusSeconds,
  };
}

export function validateSettings(rawSettings) {
  const values = {
    focus: Number(rawSettings.focus),
    shortBreak: Number(rawSettings.shortBreak),
    longBreak: Number(rawSettings.longBreak),
    longBreakInterval: Number(rawSettings.longBreakInterval),
  };

  const ranges = {
    focus: [1, 180],
    shortBreak: [1, 60],
    longBreak: [1, 60],
    longBreakInterval: [1, 12],
  };

  for (const [key, value] of Object.entries(values)) {
    const [minimum, maximum] = ranges[key];
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      return false;
    }
  }

  return true;
}