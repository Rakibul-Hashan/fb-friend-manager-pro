/**
 * runner.js — On-demand bulk operation runner
 * Injected via chrome.scripting.executeScript — no pre-loading needed.
 * Reads pendingOperation + customSelectors from storage, then runs.
 */
(function () {
  'use strict';

  if (window.__fbproRunnerActive) {
    console.log('[FBPro] Runner already active, skipping.');
    return;
  }
  window.__fbproRunnerActive = true;

  // ── Storage helpers ──────────────────────────────────────────

  const DEFAULTS = {
    dailyLimit: 20, minDelay: 3000, maxDelay: 12000, jitterRange: 2000,
    actionsTodayCount: 0, lastResetDate: null,
    autoPauseOnWarning: true, autoPauseOnCaptcha: true,
    simulateMouseMovement: true, randomScrollBetweenActions: true,
    isRunning: false, isPaused: false, pauseReason: null,
    whitelist: [], blacklist: [], actionLog: [],
    stats: { totalSent: 0, totalAccepted: 0, totalWithdrawn: 0, totalSkipped: 0 },
    customSelectors: {},
    pendingOperation: null,
  };

  function getAll() {
    return new Promise((res) =>
      chrome.storage.local.get(null, (r) => res({ ...DEFAULTS, ...r }))
    );
  }
  function save(data) {
    return new Promise((res) => chrome.storage.local.set(data, res));
  }
  async function appendLog(entry) {
    const d = await getAll();
    const logs = Array.isArray(d.actionLog) ? d.actionLog : [];
    logs.push({ ...entry, ts: new Date().toISOString() });
    await save({ actionLog: logs.slice(-200) });
  }
  async function incStat(key) {
    const d = await getAll();
    const s = { ...DEFAULTS.stats, ...(d.stats || {}) };
    s[key] = (s[key] || 0) + 1;
    await save({ stats: s });
  }
  async function resetDailyIfNeeded() {
    const d = await getAll();
    const today = new Date().toISOString().slice(0, 10);
    if (d.lastResetDate !== today) { await save({ actionsTodayCount: 0, lastResetDate: today }); return 0; }
    return d.actionsTodayCount || 0;
  }

  // ── Timing ───────────────────────────────────────────────────

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function humanMs(min, max, jitter) {
    min = min||3000; max = max||12000; jitter = jitter||2000;
    let u=0,v=0; while(!u)u=Math.random(); while(!v)v=Math.random();
    const g = Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
    let d = (min+(max-min)/2) + g*((max-min)/6);
    d = Math.max(min, Math.min(max,d)) + (Math.random()*2-1)*jitter;
    if (Math.random()<0.08) d += 5000+Math.random()*15000;
    return Math.round(Math.max(min,d));
  }

  const humanSleep = (min,max,jitter) => sleep(humanMs(min,max,jitter));
  const micro = () => sleep(400 + Math.random()*800);

  // ── Mouse ────────────────────────────────────────────────────

  async function realClick(el) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width/2 + (Math.random()-.5)*4;
    const y = r.top  + r.height/2 + (Math.random()-.5)*4;
    const ev = { bubbles:true, cancelable:true, clientX:x, clientY:y };
    el.dispatchEvent(new MouseEvent('mouseenter', ev));
    await sleep(40 + Math.random()*60);
    el.dispatchEvent(new MouseEvent('mousedown', { ...ev, button:0 }));
    await sleep(50 + Math.random()*80);
    el.dispatchEvent(new MouseEvent('mouseup',   { ...ev, button:0 }));
    el.dispatchEvent(new MouseEvent('click',     { ...ev, button:0 }));
    el.click(); // belt and suspenders
  }

  async function randScroll() {
    const dir = Math.random()>.3 ? 1 : -1;
    const amt = 100+Math.random()*250;
    for (let i=0;i<8;i++) { window.scrollBy({top:dir*amt/8}); await sleep(25+Math.random()*20); }
  }

  // ── Safety ───────────────────────────────────────────────────

  const WARN_RE = [
    /you.?re moving too fast/i, /slow down/i, /captcha/i,
    /security check/i, /account has been temporarily/i,
    /we.?ve limited some features/i, /you.?ve reached the (limit|maximum)/i,
    /can.?t send friend request/i, /checkpoint/i, /verify your identity/i,
  ];

  function danger() {
    const url = window.location.href;
    if (/facebook\.com\/login/.test(url))      return 'Session expired (login redirect)';
    if (/facebook\.com\/checkpoint/.test(url)) return 'Account checkpoint detected';
    if (document.querySelector('iframe[src*="captcha"]')) return 'CAPTCHA detected';
    const text = document.body?.innerText||'';
    for (const r of WARN_RE) if (r.test(text)) return 'FB warning: '+r.source;
    return null;
  }

  async function pause(reason) {
    await save({ isPaused:true, pauseReason:reason, isRunning:false, pendingOperation:null });
    try {
      chrome.notifications.create({
        type:'basic', iconUrl:chrome.runtime.getURL('assets/icons/icon48.png'),
        title:'⚠️ FB Friend Manager — AUTO PAUSED', message:reason, priority:2,
      });
    } catch(_) {}
  }

  async function canContinue(s) {
    const d = danger();
    if (d) {
      if (s.autoPauseOnWarning||s.autoPauseOnCaptcha) {
        await pause(d);
        await appendLog({ type:'SAFETY_PAUSE', message:d, level:'critical' });
      }
      return false;
    }
    const count = await resetDailyIfNeeded();
    if (count >= s.dailyLimit) {
      await appendLog({ type:'LIMIT', message:'Daily limit reached', level:'warn' });
      return false;
    }
    // Check stop flag
    const fresh = await getAll();
    if (!fresh.isRunning || fresh.pendingOperation === null) return false;
    return true;
  }

  async function recordAction() {
    const c = await resetDailyIfNeeded();
    await save({ actionsTodayCount: c+1 });
  }

  // ── Progress overlay (tiny floating badge on FB page) ────────

  function showBadge(text) {
    let b = document.getElementById('fbpro-badge');
    if (!b) {
      b = document.createElement('div');
      b.id = 'fbpro-badge';
      Object.assign(b.style, {
        position:'fixed', bottom:'80px', right:'20px', zIndex:'2147483647',
        background:'#13161c', border:'1px solid #4f8ef7', borderRadius:'8px',
        padding:'8px 14px', fontSize:'12px', color:'#e8eaf0',
        fontFamily:'monospace', boxShadow:'0 4px 20px rgba(0,0,0,.5)',
        maxWidth:'260px', transition:'all .2s',
      });
      document.body.appendChild(b);
    }
    b.textContent = text;
  }

  function removeBadge() {
    document.getElementById('fbpro-badge')?.remove();
  }

  // ── Helpers ───────────────────────────────────────────────────

  async function isAllowed(uid, s) {
    if (!uid) return true;
    if ((s.blacklist||[]).includes(uid)) return false;
    if ((s.whitelist||[]).length>0 && !(s.whitelist||[]).includes(uid)) return false;
    return true;
  }

  function getUid(el) {
    const a = el&&(el.closest('a[href]')||el.querySelector('a[href]'));
    if (!a) return null;
    const m = a.href.match(/(?:profile\.php\?id=|facebook\.com\/)([a-zA-Z0-9._-]+)/);
    return m ? m[1] : null;
  }

  function getName(el) {
    const s = el?.querySelectorAll?.('span[dir="auto"]');
    if (s&&s.length) return s[0].innerText.trim();
    return el?.querySelector?.('a')?.innerText?.trim()||'Unknown';
  }

  // ── OPERATIONS ────────────────────────────────────────────────

  async function opSend(s, sels) {
    const sel = sels.send;
    if (!sel) { await appendLog({type:'ERROR',message:'No selector for Send — use 🎯 Pick first',level:'critical'}); return; }
    const btns = Array.from(document.querySelectorAll(sel));
    await appendLog({type:'OP_START',message:`Send: found ${btns.length} buttons with "${sel}"`,level:'info'});
    if (!btns.length) { showBadge(`⚠️ No buttons found with:\n"${sel}"\n\nTry 🎯 Pick again.`); return; }
    let sent=0, skipped=0;
    for (const btn of btns) {
      if (!(await canContinue(s))) break;
      const card = btn.closest('[data-visualcompletion]')||btn.parentElement;
      const uid  = getUid(card||btn);
      const name = getName(card||btn);
      if (!(await isAllowed(uid,s))) {
        skipped++; await incStat('totalSkipped');
        await appendLog({type:'SKIPPED',message:`Skipped ${name}`,level:'info'});
        continue;
      }
      btn.scrollIntoView({behavior:'smooth',block:'center'});
      await micro();
      if (s.randomScrollBetweenActions&&Math.random()>.6) await randScroll();
      await realClick(btn);
      await sleep(700);
      // Accept any confirmation dialog
      const confirm = document.querySelector('[aria-label="Confirm"],[aria-label="Send request"]');
      if (confirm) { await sleep(300); await realClick(confirm); }
      sent++;
      await recordAction(); await incStat('totalSent');
      await appendLog({type:'SENT',message:`→ ${name}`,level:'success'});
      showBadge(`📤 Sending…\n${sent} sent · ${skipped} skipped`);
      await humanSleep(s.minDelay,s.maxDelay,s.jitterRange);
    }
    showBadge(`✅ Done — Sent: ${sent}, Skipped: ${skipped}`);
    setTimeout(removeBadge, 4000);
    await appendLog({type:'OP_END',message:`Sent:${sent} Skip:${skipped}`,level:'info'});
  }

  async function opAccept(s, sels) {
    const sel = sels.accept;
    if (!sel) { await appendLog({type:'ERROR',message:'No selector for Accept — use 🎯 Pick first',level:'critical'}); return; }
    const btns = Array.from(document.querySelectorAll(sel));
    await appendLog({type:'OP_START',message:`Accept: found ${btns.length} buttons with "${sel}"`,level:'info'});
    if (!btns.length) { showBadge(`⚠️ No buttons found with:\n"${sel}"\n\nTry 🎯 Pick again.`); return; }
    let accepted=0, declined=0;
    for (const btn of btns) {
      if (!(await canContinue(s))) break;
      const card = btn.closest('li')||btn.parentElement;
      const uid  = getUid(card||btn);
      const name = getName(card||btn);
      if (!(await isAllowed(uid,s))) {
        declined++;
        await appendLog({type:'DECLINED',message:`Skipped ${name}`,level:'info'});
        continue;
      }
      btn.scrollIntoView({behavior:'smooth',block:'center'});
      await micro();
      await realClick(btn);
      accepted++;
      await recordAction(); await incStat('totalAccepted');
      await appendLog({type:'ACCEPTED',message:`✓ ${name}`,level:'success'});
      showBadge(`✅ Accepting…\n${accepted} accepted`);
      await humanSleep(s.minDelay,s.maxDelay,s.jitterRange);
    }
    showBadge(`✅ Done — Accepted: ${accepted}`);
    setTimeout(removeBadge, 4000);
    await appendLog({type:'OP_END',message:`Accepted:${accepted}`,level:'info'});
  }

  async function opWithdraw(s, sels) {
    const sel = sels.withdraw;
    if (!sel) { await appendLog({type:'ERROR',message:'No selector for Withdraw — use 🎯 Pick first',level:'critical'}); return; }
    const btns = Array.from(document.querySelectorAll(sel));
    await appendLog({type:'OP_START',message:`Withdraw: found ${btns.length} buttons with "${sel}"`,level:'info'});
    if (!btns.length) { showBadge(`⚠️ No buttons found with:\n"${sel}"\n\nTry 🎯 Pick again.`); return; }
    let withdrawn=0;
    for (const btn of btns) {
      if (!(await canContinue(s))) break;
      const card = btn.closest('li')||btn.parentElement;
      const name = getName(card||btn);
      btn.scrollIntoView({behavior:'smooth',block:'center'});
      await micro();
      await realClick(btn);
      await sleep(500);
      const confirm = document.querySelector('[aria-label="Confirm"]');
      if (confirm) { await sleep(300); await realClick(confirm); }
      withdrawn++;
      await recordAction(); await incStat('totalWithdrawn');
      await appendLog({type:'WITHDRAWN',message:`✗ ${name}`,level:'info'});
      showBadge(`🔄 Withdrawing…\n${withdrawn} withdrawn`);
      await humanSleep(s.minDelay,s.maxDelay,s.jitterRange);
    }
    showBadge(`✅ Done — Withdrawn: ${withdrawn}`);
    setTimeout(removeBadge, 4000);
    await appendLog({type:'OP_END',message:`Withdrawn:${withdrawn}`,level:'info'});
  }

  // ── BOOT ──────────────────────────────────────────────────────

  async function main() {
    const s = await getAll();
    const op  = s.pendingOperation;
    const sels = s.customSelectors || {};

    if (!op) {
      window.__fbproRunnerActive = false;
      return;
    }

    await save({ isRunning: true });
    showBadge('🚀 Starting…');

    try {
      if (op === 'send')     await opSend(s, sels);
      else if (op === 'accept')   await opAccept(s, sels);
      else if (op === 'withdraw') await opWithdraw(s, sels);
    } catch (err) {
      await appendLog({ type:'ERROR', message: err.message, level:'critical' });
      showBadge('❌ Error: ' + err.message);
      setTimeout(removeBadge, 5000);
    } finally {
      await save({ isRunning: false, pendingOperation: null });
      window.__fbproRunnerActive = false;
    }
  }

  main();
  console.log('[FBPro] Runner injected ✓');
})();
