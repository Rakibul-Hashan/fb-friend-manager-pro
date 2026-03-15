/**
 * fb-actions.js — Self-contained content script (NO ES module imports)
 * MV3 content scripts cannot use import/export. All utils are inlined.
 */

(function () {
  'use strict';
  if (window.__fbFriendProLoaded) return;
  window.__fbFriendProLoaded = true;

  // ── Storage ──────────────────────────────────────────────────

  const DEFAULT_SETTINGS = {
    dailyLimit: 20, minDelay: 3000, maxDelay: 12000, jitterRange: 2000,
    actionsTodayCount: 0, lastResetDate: null,
    autoPauseOnWarning: true, autoPauseOnCaptcha: true,
    simulateMouseMovement: true, randomScrollBetweenActions: true,
    isRunning: false, currentOperation: null, isPaused: false, pauseReason: null,
    whitelist: [], blacklist: [], actionLog: [],
    stats: { totalSent: 0, totalAccepted: 0, totalWithdrawn: 0, totalSkipped: 0 },
  };

  function getStorage(keys) {
    return new Promise((res, rej) =>
      chrome.storage.local.get(keys || null, (r) =>
        chrome.runtime.lastError ? rej(new Error(chrome.runtime.lastError.message))
                                 : res({ ...DEFAULT_SETTINGS, ...r })
      )
    );
  }

  function setStorage(data) {
    return new Promise((res, rej) =>
      chrome.storage.local.set(data, () =>
        chrome.runtime.lastError ? rej(new Error(chrome.runtime.lastError.message)) : res()
      )
    );
  }

  async function appendLog(entry) {
    const d = await getStorage('actionLog');
    const logs = Array.isArray(d.actionLog) ? d.actionLog : [];
    logs.push({ ...entry, timestamp: new Date().toISOString() });
    await setStorage({ actionLog: logs.slice(-200) });
  }

  async function incrementStat(key) {
    const d = await getStorage('stats');
    const stats = { ...DEFAULT_SETTINGS.stats, ...(d.stats || {}) };
    stats[key] = (stats[key] || 0) + 1;
    await setStorage({ stats });
  }

  async function resetDailyIfNeeded() {
    const d = await getStorage(['lastResetDate', 'actionsTodayCount']);
    const today = new Date().toISOString().slice(0, 10);
    if (d.lastResetDate !== today) { await setStorage({ actionsTodayCount: 0, lastResetDate: today }); return 0; }
    return d.actionsTodayCount || 0;
  }

  // ── Timing ───────────────────────────────────────────────────

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function humanDelayMs(min, max, jitter) {
    min = min || 3000; max = max || 12000; jitter = jitter || 2000;
    const mid = min + (max - min) / 2;
    let u = 0, v = 0;
    while (!u) u = Math.random(); while (!v) v = Math.random();
    const g = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    let d = mid + g * ((max - min) / 6);
    d = Math.max(min, Math.min(max, d)) + (Math.random() * 2 - 1) * jitter;
    if (Math.random() < 0.08) d += 5000 + Math.random() * 15000;
    return Math.round(Math.max(min, d));
  }

  async function humanSleep(min, max, jitter) { await sleep(humanDelayMs(min, max, jitter)); }
  async function microPause() { await sleep(500 + Math.random() * 900); }

  // ── Mouse ────────────────────────────────────────────────────

  async function humanClick(el) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2 + (Math.random() - 0.5) * 4;
    const y = r.top + r.height / 2 + (Math.random() - 0.5) * 4;
    const ev = { bubbles: true, cancelable: true, clientX: x, clientY: y };
    el.dispatchEvent(new MouseEvent('mouseenter', ev));
    await sleep(40 + Math.random() * 60);
    el.dispatchEvent(new MouseEvent('mousedown', { ...ev, button: 0 }));
    await sleep(60 + Math.random() * 80);
    el.dispatchEvent(new MouseEvent('mouseup', { ...ev, button: 0 }));
    el.dispatchEvent(new MouseEvent('click', { ...ev, button: 0 }));
  }

  async function simulateMoveTo(el) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const tx = r.left + r.width * (0.3 + Math.random() * 0.4);
    const ty = r.top + r.height * (0.3 + Math.random() * 0.4);
    const sx = window.innerWidth * (0.2 + Math.random() * 0.6);
    const sy = window.innerHeight * (0.2 + Math.random() * 0.6);
    const cpx = (sx + tx) / 2 + (Math.random() - 0.5) * 200;
    const cpy = (sy + ty) / 2 + (Math.random() - 0.5) * 200;
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      document.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true,
        clientX: Math.round((1-t)**2 * sx + 2*(1-t)*t * cpx + t**2 * tx),
        clientY: Math.round((1-t)**2 * sy + 2*(1-t)*t * cpy + t**2 * ty),
      }));
      await sleep(20 + Math.random() * 10);
    }
  }

  async function randomScroll() {
    const dir = Math.random() > 0.3 ? 1 : -1;
    const amt = 100 + Math.random() * 300;
    for (let i = 0; i < 10; i++) {
      window.scrollBy({ top: dir * amt / 10 });
      await sleep(30 + Math.random() * 20);
    }
  }

  // ── Detection ────────────────────────────────────────────────

  const WARN_PATTERNS = [
    /you.?re moving too fast/i, /slow down/i, /captcha/i, /security check/i,
    /confirm you.?re not a robot/i, /account has been temporarily/i,
    /we.?ve limited some features/i, /account.?restricted/i,
    /you.?ve reached the (limit|maximum)/i, /can.?t send friend request/i,
    /checkpoint/i, /verify your identity/i,
  ];

  function scanWarnings() {
    const url = window.location.href;
    if (/facebook\.com\/login/.test(url))      return { detected: true, msg: 'Session expired (login redirect)' };
    if (/facebook\.com\/checkpoint/.test(url)) return { detected: true, msg: 'Account checkpoint detected' };
    if (document.querySelector('iframe[src*="captcha"]')) return { detected: true, msg: 'CAPTCHA detected' };
    const text = document.body?.innerText || '';
    for (const p of WARN_PATTERNS) if (p.test(text)) return { detected: true, msg: `Warning: ${p.source}` };
    return { detected: false };
  }

  // ── Rate limiting ─────────────────────────────────────────────

  async function checkLimit() {
    const s = await getStorage();
    if (s.isPaused) return { ok: false, reason: 'paused' };
    const count = await resetDailyIfNeeded();
    if (count >= s.dailyLimit) return { ok: false, reason: 'daily_limit_reached' };
    return { ok: true };
  }

  async function recordAction() {
    const count = await resetDailyIfNeeded();
    await setStorage({ actionsTodayCount: count + 1 });
  }

  async function emergencyPause(reason) {
    await setStorage({ isPaused: true, pauseReason: reason, isRunning: false });
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('assets/icons/icon48.png'),
        title: '⚠️ FB Friend Manager — AUTO PAUSED',
        message: reason,
        priority: 2,
      });
    } catch (_) {}
  }

  // ── Helpers ───────────────────────────────────────────────────

  async function isAllowed(userId) {
    if (!userId) return true;
    const { whitelist, blacklist } = await getStorage(['whitelist', 'blacklist']);
    if ((blacklist || []).includes(userId)) return false;
    if ((whitelist || []).length > 0 && !(whitelist || []).includes(userId)) return false;
    return true;
  }

  function getName(el) {
    const spans = el && el.querySelectorAll('span[dir="auto"]');
    if (spans && spans.length) return spans[0].innerText.trim();
    const a = el && el.querySelector('a');
    return (a && a.innerText.trim()) || 'Unknown';
  }

  function getUserId(el) {
    const a = el && (el.closest('a[href]') || el.querySelector('a[href]'));
    if (!a) return null;
    const m = a.href.match(/(?:profile\.php\?id=|facebook\.com\/)([a-zA-Z0-9._-]+)/);
    return m ? m[1] : null;
  }

  async function safetyGate(s) {
    if (stopRequested) return false;
    const w = scanWarnings();
    if (w.detected) {
      if (s.autoPauseOnWarning || s.autoPauseOnCaptcha) {
        await emergencyPause(w.msg);
        await appendLog({ type: 'SAFETY_PAUSE', message: w.msg, level: 'critical' });
      }
      return false;
    }
    const lim = await checkLimit();
    if (!lim.ok) { await appendLog({ type: 'LIMIT', message: lim.reason, level: 'warn' }); return false; }
    return true;
  }

  function pushProgress(data) {
    try { chrome.runtime.sendMessage({ type: 'PROGRESS_UPDATE', ...data }); } catch (_) {}
  }

  // ── SELECTORS ─────────────────────────────────────────────────
  // FB changes these. aria-label is most stable. Update if broken.

  const SEL = {
    addFriend:    '[aria-label="Add friend"]',
    confirm:      '[aria-label="Confirm"]',
    deleteReq:    '[aria-label="Delete request"]',
    cancelReq:    '[aria-label="Cancel request"]',
  };

  // ── State ─────────────────────────────────────────────────────

  let operationActive = false;
  let stopRequested   = false;

  // ── SEND ──────────────────────────────────────────────────────

  async function opSend() {
    if (operationActive) return { ok: false, message: 'Already running.' };
    operationActive = true; stopRequested = false;
    const s = await getStorage();
    let sent = 0, skipped = 0;
    await appendLog({ type: 'OP_START', message: 'Send started', level: 'info' });
    if (s.randomScrollBetweenActions) await randomScroll();
    await microPause();

    const btns = Array.from(document.querySelectorAll(SEL.addFriend));
    if (!btns.length) {
      await appendLog({ type: 'INFO', message: 'No "Add friend" buttons found on this page. Navigate to People You May Know first.', level: 'warn' });
    }

    for (const btn of btns) {
      if (stopRequested) break;
      if (!(await safetyGate(s))) break;
      const card = btn.closest('[data-visualcompletion]') || btn.parentElement;
      const uid  = getUserId(card || btn);
      const name = getName(card || btn);
      if (!(await isAllowed(uid))) {
        skipped++; await incrementStat('totalSkipped');
        await appendLog({ type: 'SKIPPED', message: `Skipped ${name}`, level: 'info' });
        continue;
      }
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await microPause();
      if (s.simulateMouseMovement) await simulateMoveTo(btn);
      if (s.randomScrollBetweenActions && Math.random() > 0.5) await randomScroll();
      await humanClick(btn);
      await sleep(700);
      const cf = document.querySelector(SEL.confirm);
      if (cf) await humanClick(cf);
      sent++;
      await recordAction(); await incrementStat('totalSent');
      await appendLog({ type: 'SENT', message: `Sent to ${name}`, level: 'success' });
      pushProgress({ sent, skipped });
      await humanSleep(s.minDelay, s.maxDelay, s.jitterRange);
    }

    operationActive = false;
    await appendLog({ type: 'OP_END', message: `Sent:${sent} Skipped:${skipped}`, level: 'info' });
    return { ok: true, sent, skipped };
  }

  // ── ACCEPT ────────────────────────────────────────────────────

  async function opAccept(opts) {
    if (operationActive) return { ok: false, message: 'Already running.' };
    operationActive = true; stopRequested = false; opts = opts || {};
    const s = await getStorage();
    let accepted = 0, declined = 0;
    await appendLog({ type: 'OP_START', message: 'Accept started', level: 'info' });

    const btns = Array.from(document.querySelectorAll(SEL.confirm));
    if (!btns.length) await appendLog({ type: 'INFO', message: 'No incoming requests found. Navigate to facebook.com/friends/requests', level: 'warn' });

    for (const btn of btns) {
      if (stopRequested) break;
      if (!(await safetyGate(s))) break;
      const card = btn.closest('li') || btn.parentElement;
      const uid  = getUserId(card || btn);
      const name = getName(card || btn);
      if (!(await isAllowed(uid))) {
        if (opts.declineBlacklisted) {
          const d = card?.querySelector(SEL.deleteReq);
          if (d) { await humanClick(d); declined++; }
        }
        continue;
      }
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await microPause();
      if (s.simulateMouseMovement) await simulateMoveTo(btn);
      await humanClick(btn);
      accepted++;
      await recordAction(); await incrementStat('totalAccepted');
      await appendLog({ type: 'ACCEPTED', message: `Accepted ${name}`, level: 'success' });
      pushProgress({ accepted, declined });
      await humanSleep(s.minDelay, s.maxDelay, s.jitterRange);
    }

    operationActive = false;
    await appendLog({ type: 'OP_END', message: `Accepted:${accepted}`, level: 'info' });
    return { ok: true, accepted, declined };
  }

  // ── WITHDRAW ──────────────────────────────────────────────────

  async function opWithdraw() {
    if (operationActive) return { ok: false, message: 'Already running.' };
    operationActive = true; stopRequested = false;
    const s = await getStorage();
    let withdrawn = 0;
    await appendLog({ type: 'OP_START', message: 'Withdraw started', level: 'info' });

    const btns = Array.from(document.querySelectorAll(SEL.cancelReq));
    if (!btns.length) await appendLog({ type: 'INFO', message: 'No cancel buttons found. Navigate to facebook.com/friends/sent', level: 'warn' });

    for (const btn of btns) {
      if (stopRequested) break;
      if (!(await safetyGate(s))) break;
      const card = btn.closest('li') || btn.parentElement;
      const name = getName(card || btn);
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await microPause();
      if (s.simulateMouseMovement) await simulateMoveTo(btn);
      await humanClick(btn);
      await sleep(500);
      const cf = document.querySelector(SEL.confirm);
      if (cf) await humanClick(cf);
      withdrawn++;
      await recordAction(); await incrementStat('totalWithdrawn');
      await appendLog({ type: 'WITHDRAWN', message: `Withdrew from ${name}`, level: 'info' });
      pushProgress({ withdrawn });
      await humanSleep(s.minDelay, s.maxDelay, s.jitterRange);
    }

    operationActive = false;
    await appendLog({ type: 'OP_END', message: `Withdrawn:${withdrawn}`, level: 'info' });
    return { ok: true, withdrawn };
  }

  // ── MESSAGE LISTENER ──────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'PING') {
      sendResponse({ alive: true, url: window.location.href });
      return false;
    }
    if (msg.action === 'START_SEND') {
      opSend(msg.options).then(sendResponse).catch((e) => sendResponse({ ok: false, message: e.message }));
      return true;
    }
    if (msg.action === 'START_ACCEPT') {
      opAccept(msg.options).then(sendResponse).catch((e) => sendResponse({ ok: false, message: e.message }));
      return true;
    }
    if (msg.action === 'START_WITHDRAW') {
      opWithdraw().then(sendResponse).catch((e) => sendResponse({ ok: false, message: e.message }));
      return true;
    }
    if (msg.action === 'STOP_OPERATION') {
      stopRequested = true; operationActive = false;
      setStorage({ isRunning: false, currentOperation: null });
      sendResponse({ ok: true });
      return false;
    }
    sendResponse({ ok: false, message: 'Unknown action' });
    return false;
  });

  console.log('[FB Friend Manager Pro] Content script loaded ✓');
})();
