/**
 * picker.js — Visual selector picker
 * Injected on-demand via chrome.scripting.executeScript.
 * Shows a floating panel on the FB page, user clicks any element,
 * we capture the best unique selector and save it to storage.
 */
(function () {
  'use strict';

  const PANEL_ID  = 'fbpro-picker-panel';
  const OVERLAY_ID = 'fbpro-picker-highlight';

  // Remove any existing instance
  document.getElementById(PANEL_ID)?.remove();
  document.getElementById(OVERLAY_ID)?.remove();

  let pickerMode = null;
  let isActive   = false;
  let lastTarget = null;

  const OP_LABELS = {
    send:     'Add Friend / Send Request',
    accept:   'Accept Friend Request',
    withdraw: 'Cancel / Withdraw Request',
    decline:  'Decline / Delete Request',
  };

  // ── Build floating highlight box ────────────────────────────

  const highlight = document.createElement('div');
  highlight.id = OVERLAY_ID;
  Object.assign(highlight.style, {
    position: 'fixed', pointerEvents: 'none', zIndex: '2147483646',
    outline: '2px solid #4f8ef7', background: 'rgba(79,142,247,0.12)',
    borderRadius: '4px', transition: 'all 0.08s', display: 'none',
  });
  document.body.appendChild(highlight);

  // ── Build floating panel ────────────────────────────────────

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div id="fbpro-p-header">
      <span id="fbpro-p-dot"></span>
      <span id="fbpro-p-title">FB Friend Manager</span>
      <button id="fbpro-p-close">✕</button>
    </div>
    <div id="fbpro-p-body">
      <div id="fbpro-p-mode"></div>
      <div id="fbpro-p-instruction">Hover over any button on this page, then <strong>click it</strong> to capture its selector.</div>
      <div id="fbpro-p-preview-wrap">
        <div id="fbpro-p-preview-label">Hovering:</div>
        <code id="fbpro-p-preview">—</code>
      </div>
      <div id="fbpro-p-status"></div>
      <div id="fbpro-p-btns">
        <button id="fbpro-p-confirm" style="display:none">✓ Use This Selector</button>
        <button id="fbpro-p-cancel">Cancel</button>
      </div>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    #fbpro-picker-panel {
      position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
      width: 300px; background: #13161c; border: 1px solid #2e3447;
      border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      font-family: -apple-system, sans-serif; font-size: 13px; color: #e8eaf0;
      overflow: hidden;
    }
    #fbpro-p-header {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px; background: #0d0f13; border-bottom: 1px solid #252938;
    }
    #fbpro-p-dot {
      width: 8px; height: 8px; border-radius: 50%; background: #4f8ef7;
      box-shadow: 0 0 8px #4f8ef7; flex-shrink: 0;
      animation: fbpro-pulse 1.2s infinite;
    }
    @keyframes fbpro-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
    #fbpro-p-title { font-weight: 700; font-size: 12px; flex: 1; }
    #fbpro-p-close {
      background: none; border: none; color: #4a5268; cursor: pointer;
      font-size: 14px; padding: 0 2px; line-height: 1;
    }
    #fbpro-p-close:hover { color: #ef4444; }
    #fbpro-p-body { padding: 12px 14px; }
    #fbpro-p-mode {
      font-size: 10px; text-transform: uppercase; letter-spacing: .1em;
      color: #4f8ef7; margin-bottom: 8px; font-weight: 700;
    }
    #fbpro-p-instruction {
      font-size: 12px; color: #8892a4; line-height: 1.5; margin-bottom: 10px;
    }
    #fbpro-p-preview-wrap {
      background: #0d0f13; border: 1px solid #252938; border-radius: 6px;
      padding: 8px 10px; margin-bottom: 10px;
    }
    #fbpro-p-preview-label { font-size: 9px; color: #4a5268; text-transform: uppercase; letter-spacing:.08em; margin-bottom:4px; }
    #fbpro-p-preview {
      display: block; font-size: 11px; color: #22c55e; word-break: break-all;
      font-family: monospace; max-height: 60px; overflow-y: auto;
    }
    #fbpro-p-status {
      font-size: 11px; min-height: 18px; margin-bottom: 8px; color: #22c55e; font-weight:600;
    }
    #fbpro-p-btns { display: flex; gap: 8px; }
    #fbpro-p-confirm {
      flex: 1; background: #22c55e; color: #0d0f13; border: none;
      border-radius: 6px; padding: 7px 12px; font-size: 12px; font-weight: 700;
      cursor: pointer; transition: opacity .2s;
    }
    #fbpro-p-confirm:hover { opacity: .85; }
    #fbpro-p-cancel {
      background: #1a1e27; color: #8892a4; border: 1px solid #252938;
      border-radius: 6px; padding: 7px 12px; font-size: 12px; cursor: pointer;
    }
    #fbpro-p-cancel:hover { border-color: #ef4444; color: #ef4444; }
  `;
  document.head.appendChild(style);
  document.body.appendChild(panel);

  // ── Selector generation ─────────────────────────────────────

  function getBestSelector(el) {
    // Priority 1: aria-label (most stable across FB updates)
    const ariaLabel = el.getAttribute('aria-label') ||
                      el.closest('[aria-label]')?.getAttribute('aria-label');
    if (ariaLabel) return `[aria-label="${ariaLabel}"]`;

    // Priority 2: data-testid
    const testId = el.getAttribute('data-testid') ||
                   el.closest('[data-testid]')?.getAttribute('data-testid');
    if (testId) return `[data-testid="${testId}"]`;

    // Priority 3: role + text content
    const role = el.getAttribute('role');
    const text = el.innerText?.trim().slice(0, 30);
    if (role && text) return `[role="${role}"]`; // broad but usable

    // Priority 4: id
    if (el.id) return `#${el.id}`;

    // Priority 5: tag + first meaningful class
    const classes = [...el.classList].filter(c => c.length > 2 && !c.match(/^[a-z0-9]{6,}$/i));
    if (classes.length) return `${el.tagName.toLowerCase()}.${classes[0]}`;

    // Fallback: tag name
    return el.tagName.toLowerCase();
  }

  function countMatches(selector) {
    try { return document.querySelectorAll(selector).length; }
    catch { return 0; }
  }

  function getSelectorInfo(el) {
    const sel   = getBestSelector(el);
    const count = countMatches(sel);
    return { selector: sel, count };
  }

  // ── Wire up ─────────────────────────────────────────────────

  chrome.storage.local.get(['pickerMode'], ({ pickerMode: mode }) => {
    pickerMode = mode || 'send';
    document.getElementById('fbpro-p-mode').textContent =
      'Picking for: ' + (OP_LABELS[pickerMode] || pickerMode);
    isActive = true;
    attachListeners();
  });

  let pendingSelector = null;

  function attachListeners() {
    document.addEventListener('mouseover', onHover, true);
    document.addEventListener('click',     onClick, true);
  }

  function detachListeners() {
    document.removeEventListener('mouseover', onHover, true);
    document.removeEventListener('click',     onClick, true);
    isActive = false;
    highlight.style.display = 'none';
  }

  function onHover(e) {
    if (!isActive) return;
    const el = e.target;
    if (el.closest('#' + PANEL_ID)) return;
    lastTarget = el;

    const rect = el.getBoundingClientRect();
    Object.assign(highlight.style, {
      display: 'block',
      top:    rect.top    + 'px',
      left:   rect.left   + 'px',
      width:  rect.width  + 'px',
      height: rect.height + 'px',
    });

    const { selector, count } = getSelectorInfo(el);
    document.getElementById('fbpro-p-preview').textContent =
      selector + `  (${count} match${count !== 1 ? 'es' : ''})`;
  }

  function onClick(e) {
    if (!isActive) return;
    const el = e.target;
    if (el.closest('#' + PANEL_ID)) return;

    e.preventDefault();
    e.stopPropagation();

    const { selector, count } = getSelectorInfo(el);
    pendingSelector = selector;

    document.getElementById('fbpro-p-preview').textContent =
      selector + `  (${count} match${count !== 1 ? 'es' : ''})`;
    document.getElementById('fbpro-p-preview-label').textContent = 'Selected:';
    document.getElementById('fbpro-p-status').textContent =
      count > 0 ? `✓ Found ${count} button${count !== 1 ? 's' : ''} with this selector` : '⚠ No matches found — try a parent element';
    document.getElementById('fbpro-p-status').style.color = count > 0 ? '#22c55e' : '#f59e0b';
    document.getElementById('fbpro-p-confirm').style.display = 'block';

    highlight.style.outline = '2px solid #22c55e';
    highlight.style.background = 'rgba(34,197,94,0.12)';
    detachListeners();
  }

  // Confirm button
  document.getElementById('fbpro-p-confirm').addEventListener('click', () => {
    if (!pendingSelector) return;
    chrome.storage.local.get(['customSelectors'], ({ customSelectors }) => {
      const sels = customSelectors || {};
      sels[pickerMode] = pendingSelector;
      chrome.storage.local.set({ customSelectors: sels }, () => {
        document.getElementById('fbpro-p-status').textContent = '✓ Selector saved!';
        document.getElementById('fbpro-p-instruction').textContent =
          'Selector saved. You can now run the operation from the extension popup.';
        document.getElementById('fbpro-p-confirm').style.display = 'none';
        setTimeout(cleanup, 2000);
      });
    });
  });

  // Cancel / close
  document.getElementById('fbpro-p-cancel').addEventListener('click', cleanup);
  document.getElementById('fbpro-p-close').addEventListener('click', cleanup);

  function cleanup() {
    detachListeners();
    panel.remove();
    style.remove();
    highlight.remove();
    chrome.storage.local.remove(['pickerMode']);
  }
})();
