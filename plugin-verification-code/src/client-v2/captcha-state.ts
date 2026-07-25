/**
 * Shared captcha credential state between the injected inline widget
 * and the API request interceptor.
 */

export interface CaptchaCredential {
  id: string;
  code: string;
}

export const REFRESH_EVENT = 'simo-captcha:refresh';

let current: CaptchaCredential | null = null;

export const captchaState = {
  set(cred: CaptchaCredential | null) {
    current = cred;
  },
  /** Read current credential (does not clear — cleared on response). */
  peek(): CaptchaCredential | null {
    if (current && current.id && current.code && current.code.trim()) {
      return { id: current.id, code: current.code.trim() };
    }
    return null;
  },
  clear() {
    current = null;
  },
};

/** Ask every mounted captcha widget to fetch a fresh captcha. */
export function requestCaptchaRefresh() {
  try {
    window.dispatchEvent(new CustomEvent(REFRESH_EVENT));
  } catch (e) {
    // ignore
  }
}
