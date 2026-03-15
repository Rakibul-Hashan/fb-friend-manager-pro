/**
 * delay.js — Human-like timing engine
 *
 * Real humans don't wait exactly N seconds.
 * They hesitate, get distracted, read, move the mouse.
 * This engine simulates that unpredictability using:
 *   1. Box-Muller Gaussian distribution for base delays
 *   2. Occasional "distraction" spikes (5–20s)
 *   3. Micro-jitter for sub-second randomness
 */

/**
 * Box-Muller transform to generate normally distributed random number
 * Mean = 0, Std Dev = 1
 */
function gaussianRandom() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Generate a human-like delay between minMs and maxMs
 * Occasionally spikes to simulate distraction
 *
 * @param {number} minMs - Minimum delay in ms (e.g. 3000)
 * @param {number} maxMs - Maximum delay in ms (e.g. 12000)
 * @param {number} jitter - ±ms random jitter added on top
 * @returns {number} delay in ms
 */
export function humanDelay(minMs = 3000, maxMs = 12000, jitter = 2000) {
  const range = maxMs - minMs;
  const mid = minMs + range / 2;
  const stdDev = range / 6; // 99.7% of values within [min, max]

  // Gaussian sample clamped to [min, max]
  let base = mid + gaussianRandom() * stdDev;
  base = Math.max(minMs, Math.min(maxMs, base));

  // Add micro-jitter
  const microJitter = (Math.random() * 2 - 1) * jitter;
  base += microJitter;
  base = Math.max(minMs, base);

  // 8% chance of a "distraction spike" (5–20 extra seconds)
  if (Math.random() < 0.08) {
    base += 5000 + Math.random() * 15000;
  }

  return Math.round(base);
}

/**
 * Async sleep for exactly `ms` milliseconds
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sleep for a human-like delay and return how long we waited
 */
export async function humanSleep(minMs = 3000, maxMs = 12000, jitter = 2000) {
  const delay = humanDelay(minMs, maxMs, jitter);
  await sleep(delay);
  return delay;
}

/**
 * Short micro-pause simulating reading/hesitation (500ms–1.5s)
 */
export async function microPause() {
  await sleep(500 + Math.random() * 1000);
}

/**
 * Simulate reading time based on content length
 * ~200 words per minute average human reading speed
 * @param {number} wordCount
 */
export async function simulateReadingTime(wordCount = 5) {
  const readingSpeedWPM = 180 + Math.random() * 60; // 180–240 wpm
  const readingTimeMs = (wordCount / readingSpeedWPM) * 60 * 1000;
  await sleep(readingTimeMs);
}
