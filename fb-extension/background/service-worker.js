/**
 * service-worker.js — Lightweight background worker
 * All heavy lifting is now done by executeScript injection.
 * This handles: alarms, daily reset, tab finding, script injection.
 */
'use strict';

chrome.runtime.onInstalled.addListener(() => {
  scheduleNextReset();
  chrome.storage.local.get(['lastResetDate'], (r) => {
    if (!r.lastResetDate)
      chrome.storage.local.set({ lastResetDate: new Date().toISOString().slice(0,10), actionsTodayCount: 0 });
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.set({ isRunning:false, isPaused:false, pendingOperation:null });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'daily_reset') {
    chrome.storage.local.set({ actionsTodayCount:0, lastResetDate:new Date().toISOString().slice(0,10) });
    scheduleNextReset();
  }
});

function scheduleNextReset() {
  const d = new Date(); d.setHours(24,0,0,0);
  chrome.alarms.create('daily_reset', { when: d.getTime() });
}

// ── Main message handler ─────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  // Popup → inject picker.js into FB tab
  if (msg.action === 'START_PICKER') {
    startPicker(msg.mode).then(sendResponse).catch((e) => sendResponse({ ok:false, error:e.message }));
    return true;
  }

  // Popup → inject runner.js into FB tab
  if (msg.action === 'START_OPERATION') {
    startOperation(msg.operation).then(sendResponse).catch((e) => sendResponse({ ok:false, error:e.message }));
    return true;
  }

  // Popup → stop running operation
  if (msg.action === 'STOP_OPERATION') {
    chrome.storage.local.set({ isRunning:false, pendingOperation:null }, () => sendResponse({ ok:true }));
    return true;
  }

  // Popup → get active FB tab info
  if (msg.action === 'GET_TAB') {
    getActiveFbTab().then((tab) => sendResponse({ tab })).catch(() => sendResponse({ tab:null }));
    return true;
  }
});

async function getActiveFbTab() {
  // Check focused window first
  const active = await chrome.tabs.query({ active:true, currentWindow:true });
  const fb = active.find((t) => /facebook\.com/.test(t.url||''));
  if (fb) return fb;
  // Fallback: any FB tab
  const all = await chrome.tabs.query({ url:['*://*.facebook.com/*','*://web.facebook.com/*'] });
  return all[0]||null;
}

async function startPicker(mode) {
  const tab = await getActiveFbTab();
  if (!tab) return { ok:false, error:'No Facebook tab found. Open facebook.com first.' };
  await chrome.storage.local.set({ pickerMode: mode });
  await chrome.scripting.executeScript({ target:{ tabId:tab.id }, files:['content/picker.js'] });
  return { ok:true, tabId:tab.id };
}

async function startOperation(operation) {
  const tab = await getActiveFbTab();
  if (!tab) return { ok:false, error:'No Facebook tab found. Open facebook.com first.' };
  await chrome.storage.local.set({ pendingOperation:operation, isRunning:true });
  await chrome.scripting.executeScript({ target:{ tabId:tab.id }, files:['content/runner.js'] });
  return { ok:true, tabId:tab.id };
}
