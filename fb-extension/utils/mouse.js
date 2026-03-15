/**
 * mouse.js — Human-like mouse movement simulator
 *
 * Dispatches real MouseEvent sequences to fool basic bot detectors.
 * Uses Bézier curve interpolation to simulate natural cursor paths.
 */

/**
 * Generate a quadratic Bézier path between two points
 * @param {Object} start - {x, y}
 * @param {Object} end   - {x, y}
 * @param {number} steps - number of intermediate points
 * @returns {Array<{x, y}>}
 */
function bezierPath(start, end, steps = 20) {
  // Random control point adds natural curve
  const cp = {
    x: (start.x + end.x) / 2 + (Math.random() - 0.5) * 200,
    y: (start.y + end.y) / 2 + (Math.random() - 0.5) * 200,
  };

  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = (1 - t) ** 2 * start.x + 2 * (1 - t) * t * cp.x + t ** 2 * end.x;
    const y = (1 - t) ** 2 * start.y + 2 * (1 - t) * t * cp.y + t ** 2 * end.y;
    points.push({ x: Math.round(x), y: Math.round(y) });
  }
  return points;
}

/**
 * Dispatch a mousemove event at a given position
 */
function dispatchMouseMove(x, y) {
  document.dispatchEvent(
    new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      screenX: x + window.screenX,
      screenY: y + window.screenY,
    })
  );
}

/**
 * Simulate moving the mouse from current position to a target element
 * @param {HTMLElement} targetEl
 * @param {number} durationMs - total animation time
 */
export async function simulateMouseMoveTo(targetEl, durationMs = 600) {
  if (!targetEl) return;

  const rect = targetEl.getBoundingClientRect();
  // Aim slightly off-center, like a real human
  const targetX = rect.left + rect.width * (0.3 + Math.random() * 0.4);
  const targetY = rect.top + rect.height * (0.3 + Math.random() * 0.4);

  // Estimate current position (center of viewport as fallback)
  const startX = window.innerWidth * (0.2 + Math.random() * 0.6);
  const startY = window.innerHeight * (0.2 + Math.random() * 0.6);

  const steps = Math.max(10, Math.round(durationMs / 30));
  const path = bezierPath({ x: startX, y: startY }, { x: targetX, y: targetY }, steps);

  const intervalMs = durationMs / steps;

  for (const point of path) {
    dispatchMouseMove(point.x, point.y);
    await new Promise((r) => setTimeout(r, intervalMs + (Math.random() - 0.5) * 5));
  }
}

/**
 * Simulate a human click on an element:
 *   mouseenter → mousemove (to element) → mousedown → mouseup → click
 * @param {HTMLElement} el
 */
export async function humanClick(el) {
  if (!el) return;

  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2 + (Math.random() - 0.5) * 4;
  const y = rect.top + rect.height / 2 + (Math.random() - 0.5) * 4;

  const eventInit = {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  };

  el.dispatchEvent(new MouseEvent('mouseenter', eventInit));
  await new Promise((r) => setTimeout(r, 30 + Math.random() * 60));
  el.dispatchEvent(new MouseEvent('mousemove', eventInit));
  await new Promise((r) => setTimeout(r, 20 + Math.random() * 40));
  el.dispatchEvent(new MouseEvent('mousedown', { ...eventInit, button: 0 }));
  await new Promise((r) => setTimeout(r, 60 + Math.random() * 80));
  el.dispatchEvent(new MouseEvent('mouseup', { ...eventInit, button: 0 }));
  el.dispatchEvent(new MouseEvent('click', { ...eventInit, button: 0 }));
}

/**
 * Simulate random page scroll to make session look natural
 * @param {number} minPx - minimum scroll distance
 * @param {number} maxPx - maximum scroll distance
 */
export async function randomScroll(minPx = 100, maxPx = 400) {
  const direction = Math.random() > 0.3 ? 1 : -1; // 70% down, 30% up
  const amount = minPx + Math.random() * (maxPx - minPx);
  const steps = 8 + Math.random() * 8;

  for (let i = 0; i < steps; i++) {
    window.scrollBy({
      top: (direction * amount) / steps,
      behavior: 'auto',
    });
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 20));
  }
}
