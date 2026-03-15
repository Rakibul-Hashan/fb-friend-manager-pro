/**
 * limiter.js — Daily & session rate limiter
 *
 * Enforces:
 *   - Daily action cap (resets at midnight local time)
 *   - Session burst cap (max actions per continuous run)
 *   - Cooldown enforcement between bursts
 */

import { getStorage, setStorage, resetDailyCounterIfNeeded } from './storage.js';

export const LimitStatus = {
  OK: 'ok',
  DAILY_LIMIT_REACHED: 'daily_limit_reached',
  SESSION_BURST_LIMIT_REACHED: 'session_burst_limit_reached',
  PAUSED: 'paused',
  NOT_RUNNING: 'not_running',
};

/**
 * Check if the bot is allowed to perform the next action.
 * Returns a { status, remaining } object.
 */
export async function checkLimit() {
  const settings = await getStorage();

  if (!settings.isRunning) {
    return { status: LimitStatus.NOT_RUNNING, remaining: 0 };
  }

  if (settings.isPaused) {
    return { status: LimitStatus.PAUSED, remaining: 0, reason: settings.pauseReason };
  }

  // Reset daily counter if a new day started
  const todayCount = await resetDailyCounterIfNeeded();

  if (todayCount >= settings.dailyLimit) {
    return {
      status: LimitStatus.DAILY_LIMIT_REACHED,
      remaining: 0,
      resetAt: getNextMidnight(),
    };
  }

  return {
    status: LimitStatus.OK,
    remaining: settings.dailyLimit - todayCount,
  };
}

/**
 * Record that one action was performed.
 * Increments the daily counter.
 */
export async function recordAction() {
  const todayCount = await resetDailyCounterIfNeeded();
  await setStorage({ actionsTodayCount: todayCount + 1 });
}

/**
 * Trigger an emergency pause (e.g., CAPTCHA or warning detected)
 */
export async function triggerEmergencyPause(reason = 'Unknown safety trigger') {
  await setStorage({
    isPaused: true,
    pauseReason: reason,
    isRunning: false,
  });

  // Notify user
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '../assets/icons/icon48.png',
    title: '⚠️ FB Friend Manager — AUTO PAUSED',
    message: `Paused: ${reason}. Review your account before resuming.`,
    priority: 2,
  });
}

/**
 * Resume from pause
 */
export async function resumeFromPause() {
  await setStorage({
    isPaused: false,
    pauseReason: null,
    isRunning: true,
  });
}

/**
 * Get the timestamp of the next local midnight (for UI countdown)
 */
function getNextMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.toISOString();
}

/**
 * Get a human-readable remaining quota summary
 */
export async function getQuotaSummary() {
  const settings = await getStorage();
  const todayCount = await resetDailyCounterIfNeeded();
  return {
    used: todayCount,
    limit: settings.dailyLimit,
    remaining: Math.max(0, settings.dailyLimit - todayCount),
    percentage: Math.min(100, Math.round((todayCount / settings.dailyLimit) * 100)),
    resetsAt: getNextMidnight(),
  };
}
