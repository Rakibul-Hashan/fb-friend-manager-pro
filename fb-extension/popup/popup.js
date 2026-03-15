/**
 * popup.js v2 — uses chrome.scripting.executeScript via service worker.
 * NO direct message passing to content scripts.
 */
'use strict';

const $ = (id) => document.getElementById(id);

const DEFAULTS = {
  dailyLimit:20, minDelay:3000, maxDelay:12000, jitterRange:2000,
  actionsTodayCount:0, lastResetDate:null,
  autoPauseOnWarning:true, autoPauseOnCaptcha:true,
  randomScrollBetweenActions:true,
  isRunning:false, isPaused:false, pauseReason:null,
  whitelist:[], blacklist:[], actionLog:[],
  stats:{ totalSent:0, totalAccepted:0, totalWithdrawn:0, totalSkipped:0 },
  customSelectors:{}, pendingOperation:null,
};

// ── Storage ───────────────────────────────────────────────────

function sGet(keys) {
  return new Promise((res) =>
    chrome.storage.local.get(keys||null, (r) => res({ ...DEFAULTS, ...r }))
  );
}
function sSet(data) {
  return new Promise((res) => chrome.storage.local.set(data, res));
}

// ── Init ──────────────────────────────────────────────────────

async function init() {
  bindTabNav();
  bindEvents();
  await refreshAll();
  setInterval(refreshAll, 4000);
  // Also listen for storage changes (runner updates stats)
  chrome.storage.onChanged.addListener(() => refreshAll());
}

async function refreshAll() {
  await Promise.all([refreshQuota(), refreshStats(), refreshSelectors(), checkRunState()]);
  await refreshTabStatus();
}

// ── Tab status ────────────────────────────────────────────────

async function refreshTabStatus() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'GET_TAB' }, (resp) => {
      void chrome.runtime.lastError;
      const tab = resp?.tab;
      if (tab) {
        $('tabStatus').textContent = '✓ ' + (tab.url?.replace(/https?:\/\/(www\.)?/,'').split('/')[0]||'facebook.com');
        $('tabStatus').style.color = 'var(--green)';
      } else {
        $('tabStatus').textContent = '⚠ Open facebook.com first';
        $('tabStatus').style.color = 'var(--amber)';
      }
      resolve();
    });
  });
}

// ── Quota ─────────────────────────────────────────────────────

async function refreshQuota() {
  const d = await sGet(['actionsTodayCount','lastResetDate','dailyLimit']);
  const today = new Date().toISOString().slice(0,10);
  const used  = d.lastResetDate === today ? (d.actionsTodayCount||0) : 0;
  const limit = d.dailyLimit||20;
  const pct   = Math.min(100, Math.round(used/limit*100));
  $('quotaUsed').textContent  = used;
  $('quotaLimit').textContent = limit;
  $('quotaFill').style.width  = pct + '%';
  $('quotaFill').classList.toggle('near-limit', pct >= 80);
  const m = new Date(); m.setHours(24,0,0,0);
  $('quotaReset').textContent = 'at ' + m.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
}

// ── Stats ─────────────────────────────────────────────────────

async function refreshStats() {
  const d = await sGet('stats');
  const s = d.stats||{};
  $('stSent').textContent      = s.totalSent      ||0;
  $('stAccepted').textContent  = s.totalAccepted  ||0;
  $('stWithdrawn').textContent = s.totalWithdrawn ||0;
  $('stSkipped').textContent   = s.totalSkipped   ||0;
}

// ── Selectors display ─────────────────────────────────────────

async function refreshSelectors() {
  const d = await sGet('customSelectors');
  const sels = d.customSelectors||{};
  updateSelDisplay('Send',     sels.send);
  updateSelDisplay('Accept',   sels.accept);
  updateSelDisplay('Withdraw', sels.withdraw);
}

function updateSelDisplay(cap, sel) {
  const lc = cap.toLowerCase();
  const sdEl  = $('sd' + cap);
  const pvEl  = $('selPreview' + cap);

  if (sel) {
    sdEl.textContent = sel;
    sdEl.classList.remove('empty');
    pvEl.textContent = '✓ ' + sel;
    pvEl.className   = 'op-sel-preview has-sel';
  } else {
    sdEl.textContent = 'Not set';
    sdEl.classList.add('empty');
    pvEl.textContent = '⚠ No selector — click 🎯 Pick first';
    pvEl.className   = 'op-sel-preview no-sel';
  }
}

// ── Run state ─────────────────────────────────────────────────

async function checkRunState() {
  const d = await sGet(['isRunning','pendingOperation','isPaused','pauseReason']);
  if (d.isRunning && d.pendingOperation) {
    const labels = { send:'Sending requests…', accept:'Accepting requests…', withdraw:'Withdrawing requests…' };
    $('runningLabel').textContent = labels[d.pendingOperation]||'Running…';
    $('runningBlock').classList.remove('hidden');
    setStatus('running','Running');
  } else if (d.isPaused) {
    $('runningBlock').classList.add('hidden');
    setStatus('paused','Paused');
  } else {
    $('runningBlock').classList.add('hidden');
    setStatus('idle','Idle');
  }
}

function setStatus(state, label) {
  $('statusDot').className  = 'status-dot ' + state;
  $('statusText').textContent = label;
}

// ── Logs ──────────────────────────────────────────────────────

async function refreshLogs() {
  const d = await sGet('actionLog');
  const logs = Array.isArray(d.actionLog) ? d.actionLog : [];
  $('logsCount').textContent = logs.length + ' entries';
  if (!logs.length) { $('logList').innerHTML='<div class="log-empty">No activity yet.</div>'; return; }
  $('logList').innerHTML = [...logs].reverse().slice(0,100).map((e)=>{
    const t = new Date(e.ts||e.timestamp||Date.now()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    return `<div class="log-entry ${e.level||'info'}">
      <span class="log-time">${t}</span>
      <span class="log-type">${e.type}</span>
      <span class="log-msg" title="${e.message||''}">${e.message||e.type}</span>
    </div>`;
  }).join('');
}

// ── Settings load/save ────────────────────────────────────────

async function loadSettings() {
  const s = await sGet();
  $('sDaily').value    = s.dailyLimit||20;
  $('sMinDelay').value = Math.round((s.minDelay||3000)/1000);
  $('sMaxDelay').value = Math.round((s.maxDelay||12000)/1000);
  $('tCaptcha').checked = s.autoPauseOnCaptcha??true;
  $('tWarning').checked = s.autoPauseOnWarning??true;
  $('tScroll').checked  = s.randomScrollBetweenActions??true;
  $('tWhitelist').value = (s.whitelist||[]).join('\n');
  $('tBlacklist').value = (s.blacklist||[]).join('\n');
}

async function saveSettings() {
  const minS = parseInt($('sMinDelay').value,10);
  const maxS = parseInt($('sMaxDelay').value,10);
  if (minS >= maxS) { $('sMaxDelay').style.borderColor='var(--red)'; setTimeout(()=>$('sMaxDelay').style.borderColor='',2000); return; }
  const parse = (raw) => raw.split('\n').map(s=>s.trim()).filter(Boolean);
  await sSet({
    dailyLimit:  parseInt($('sDaily').value,10),
    minDelay:    minS*1000, maxDelay: maxS*1000,
    autoPauseOnCaptcha:          $('tCaptcha').checked,
    autoPauseOnWarning:          $('tWarning').checked,
    randomScrollBetweenActions:  $('tScroll').checked,
    whitelist:   parse($('tWhitelist').value),
    blacklist:   parse($('tBlacklist').value),
  });
  $('saveOk').classList.remove('hidden');
  setTimeout(()=>$('saveOk').classList.add('hidden'),2000);
  await refreshQuota();
}

// ── Picker ────────────────────────────────────────────────────

function startPicker(mode) {
  chrome.runtime.sendMessage({ action:'START_PICKER', mode }, (resp) => {
    void chrome.runtime.lastError;
    if (resp && !resp.ok) {
      alert('⚠️ ' + (resp.error||'Could not start picker'));
    }
    // Popup will close naturally — user is now on FB seeing the picker panel
  });
}

function clearSelector(mode) {
  sGet('customSelectors').then(({customSelectors}) => {
    const sels = customSelectors||{};
    delete sels[mode];
    sSet({ customSelectors: sels }).then(refreshSelectors);
  });
}

// ── Operations ────────────────────────────────────────────────

async function runOperation(op) {
  const d = await sGet(['customSelectors','isRunning']);
  if (d.isRunning) { alert('An operation is already running.'); return; }

  const sels = d.customSelectors||{};
  if (!sels[op]) {
    if (!confirm(`No selector picked for "${op}" yet.\n\nGo to the Selectors tab and click 🎯 Pick first.\n\nRun anyway with fallback selectors?`)) return;
  }

  chrome.runtime.sendMessage({ action:'START_OPERATION', operation:op }, (resp) => {
    void chrome.runtime.lastError;
    if (resp && !resp.ok) alert('⚠️ ' + (resp.error||'Could not start operation'));
    else checkRunState();
  });
}

async function stopOperation() {
  chrome.runtime.sendMessage({ action:'STOP_OPERATION' }, () => void chrome.runtime.lastError);
  await sSet({ isRunning:false, pendingOperation:null });
  checkRunState();
}

// ── Tab nav ───────────────────────────────────────────────────

function bindTabNav() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-'+t)?.classList.add('active');
      if (t==='logs') refreshLogs();
      if (t==='settings') loadSettings();
    });
  });
}

// ── Events ────────────────────────────────────────────────────

function bindEvents() {
  $('btnRunSend').addEventListener('click',     ()=>runOperation('send'));
  $('btnRunAccept').addEventListener('click',   ()=>runOperation('accept'));
  $('btnRunWithdraw').addEventListener('click', ()=>runOperation('withdraw'));
  $('btnStop').addEventListener('click',        stopOperation);
  $('btnSave').addEventListener('click',        saveSettings);
  $('btnClearLogs').addEventListener('click', async ()=>{ await sSet({actionLog:[]}); refreshLogs(); });

  // 🎯 Pick buttons
  document.querySelectorAll('.btn-pick').forEach((btn) => {
    btn.addEventListener('click', () => startPicker(btn.dataset.mode));
  });

  // Clear selector buttons
  document.querySelectorAll('.btn-clear-sel').forEach((btn) => {
    btn.addEventListener('click', () => clearSelector(btn.dataset.mode));
  });
}

// ── Boot ──────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
