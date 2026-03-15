/**
 * detector.js — Facebook warning/detection signal monitor
 *
 * Watches the DOM for:
 *   - CAPTCHA challenges
 *   - "You're going too fast" warnings
 *   - Account restriction / checkpoint notices
 *   - Temporary blocks on friend requests
 *   - Login redirects (session expired)
 */

export const DetectionType = {
  NONE: 'none',
  CAPTCHA: 'captcha',
  RATE_LIMIT_WARNING: 'rate_limit_warning',
  ACCOUNT_CHECKPOINT: 'account_checkpoint',
  FRIEND_REQUEST_BLOCK: 'friend_request_block',
  SESSION_EXPIRED: 'session_expired',
  GENERIC_WARNING: 'generic_warning',
};

/**
 * Warning text patterns to look for in the page
 */
const WARNING_PATTERNS = [
  { pattern: /you.?re moving too fast/i,         type: DetectionType.RATE_LIMIT_WARNING },
  { pattern: /slow down/i,                        type: DetectionType.RATE_LIMIT_WARNING },
  { pattern: /captcha/i,                          type: DetectionType.CAPTCHA },
  { pattern: /security check/i,                  type: DetectionType.CAPTCHA },
  { pattern: /confirm you.?re not a robot/i,      type: DetectionType.CAPTCHA },
  { pattern: /your account has been temporarily/i, type: DetectionType.ACCOUNT_CHECKPOINT },
  { pattern: /we.?ve limited some features/i,     type: DetectionType.ACCOUNT_CHECKPOINT },
  { pattern: /account.?restricted/i,              type: DetectionType.ACCOUNT_CHECKPOINT },
  { pattern: /friend request.?(block|limit|can.?t)/i, type: DetectionType.FRIEND_REQUEST_BLOCK },
  { pattern: /you.?ve reached the (limit|maximum)/i,  type: DetectionType.FRIEND_REQUEST_BLOCK },
  { pattern: /can.?t send friend request/i,        type: DetectionType.FRIEND_REQUEST_BLOCK },
  { pattern: /checkpoint/i,                       type: DetectionType.ACCOUNT_CHECKPOINT },
  { pattern: /verify your identity/i,             type: DetectionType.ACCOUNT_CHECKPOINT },
];

/**
 * URL patterns that indicate we've been redirected to a warning page
 */
const WARNING_URLS = [
  /facebook\.com\/checkpoint/,
  /facebook\.com\/login/,
  /facebook\.com\/help\/contact/,
  /facebook\.com\/recover/,
];

/**
 * Scan the current page for any detection signals
 * @returns {{ detected: boolean, type: string, message: string }}
 */
export function scanPageForWarnings() {
  // Check URL first (cheapest check)
  const url = window.location.href;
  for (const urlPattern of WARNING_URLS) {
    if (urlPattern.test(url)) {
      if (/login/.test(url)) {
        return {
          detected: true,
          type: DetectionType.SESSION_EXPIRED,
          message: 'Session expired — Facebook redirected to login.',
        };
      }
      return {
        detected: true,
        type: DetectionType.ACCOUNT_CHECKPOINT,
        message: `Account checkpoint detected at: ${url}`,
      };
    }
  }

  // Check for CAPTCHA iframes
  const captchaIframes = document.querySelectorAll(
    'iframe[src*="captcha"], iframe[src*="recaptcha"], iframe[title*="challenge"]'
  );
  if (captchaIframes.length > 0) {
    return {
      detected: true,
      type: DetectionType.CAPTCHA,
      message: 'CAPTCHA challenge detected on page.',
    };
  }

  // Check visible text content
  const bodyText = document.body?.innerText || '';

  for (const { pattern, type } of WARNING_PATTERNS) {
    if (pattern.test(bodyText)) {
      return {
        detected: true,
        type,
        message: `Warning pattern matched: "${pattern.source}"`,
      };
    }
  }

  // Check for specific FB error dialogs / modals
  const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
  for (const dialog of dialogs) {
    const text = dialog.innerText || '';
    for (const { pattern, type } of WARNING_PATTERNS) {
      if (pattern.test(text)) {
        return {
          detected: true,
          type,
          message: `Warning in dialog: "${text.slice(0, 100)}"`,
        };
      }
    }
  }

  return { detected: false, type: DetectionType.NONE, message: '' };
}

/**
 * Check if Facebook's request block counter is showing
 * (e.g., "You have X pending friend requests" near limit)
 * @returns {boolean}
 */
export function isPendingRequestLimitNear() {
  const text = document.body?.innerText || '';
  const match = text.match(/(\d+)\s+pending\s+friend\s+request/i);
  if (match) {
    const count = parseInt(match[1], 10);
    return count >= 900; // FB hard limit is ~1000
  }
  return false;
}
