/**
 * storage.js — Typed Chrome Storage wrapper
 * Provides get/set/clear with defaults and JSON safety.
 */

export const DEFAULT_SETTINGS = {
  // Rate limiting
  dailyLimit: 20,
  sessionBurstLimit: 5,
  minDelay: 3000,       // ms
  maxDelay: 12000,      // ms
  jitterRange: 2000,    // ±ms added to simulate human irregularity

  // Session tracking
  actionsTodayCount: 0,
  lastResetDate: null,  // ISO date string

  // Safety
  autoPauseOnWarning: true,
  autoPauseOnCaptcha: true,
  simulateMouseMovement: true,
  randomScrollBetweenActions: true,

  // Operation state
  isRunning: false,
  currentOperation: null, // 'send' | 'accept' | 'withdraw' | null
  isPaused: false,
  pauseReason: null,

  // Whitelist / Blacklist
  whitelist: [],  // user IDs to never touch
  blacklist: [],  // user IDs to never send to

  // Logs (last 200 entries)
  actionLog: [],

  // Stats
  stats: {
    totalSent: 0,
    totalAccepted: 0,
    totalWithdrawn: 0,
    totalSkipped: 0,
    bannedWarnings: 0,
  },
};

/** Read one or all keys from chrome.storage.local */
export async function getStorage(keys = null) {
  return new Promise((resolve, reject) => {
    const query = keys
      ? Array.isArray(keys)
        ? keys
        : [keys]
      : null;

    chrome.storage.local.get(query, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        // Merge with defaults so callers always get full shape
        resolve({ ...DEFAULT_SETTINGS, ...result });
      }
    });
  });
}

/** Write key-value pairs to chrome.storage.local */
export async function setStorage(data) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/** Clear specific keys or entire storage */
export async function clearStorage(keys = null) {
  return new Promise((resolve, reject) => {
    if (keys) {
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    } else {
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    }
  });
}

/** Append a log entry; trims to last 200 */
export async function appendLog(entry) {
  const { actionLog } = await getStorage('actionLog');
  const logs = Array.isArray(actionLog) ? actionLog : [];
  logs.push({ ...entry, timestamp: new Date().toISOString() });
  const trimmed = logs.slice(-200);
  await setStorage({ actionLog: trimmed });
}

/** Increment a stat counter */
export async function incrementStat(key) {
  const { stats } = await getStorage('stats');
  const updated = { ...DEFAULT_SETTINGS.stats, ...stats };
  updated[key] = (updated[key] || 0) + 1;
  await setStorage({ stats: updated });
}

/** Reset daily counter if date has changed */
export async function resetDailyCounterIfNeeded() {
  const { lastResetDate, actionsTodayCount } = await getStorage([
    'lastResetDate',
    'actionsTodayCount',
  ]);
  const today = new Date().toISOString().slice(0, 10);
  if (lastResetDate !== today) {
    await setStorage({ actionsTodayCount: 0, lastResetDate: today });
    return 0;
  }
  return actionsTodayCount || 0;
}
