import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { CaptchaBox } from './components/CaptchaBox';
import { captchaState, requestCaptchaRefresh } from './captcha-state';
import { openCaptchaModal } from './captcha-modal';

type TFunc = (key: string) => string;

interface PublicConfig {
  signIn: boolean;
  signUp: boolean;
  lostPassword: boolean;
  publicForms: boolean;
}

/** API urls that require captcha and their scene keys. */
const URL_RULES: Array<{ match: RegExp; scene: keyof PublicConfig }> = [
  { match: /auth:signIn(\?|$)/, scene: 'signIn' },
  { match: /auth:signUp(\?|$)/, scene: 'signUp' },
  { match: /auth:lostPassword(\?|$)/, scene: 'lostPassword' },
  // Public-form submissions use the collection resource name, e.g.
  // `users:publicSubmit` (NOT `publicForms:publicSubmit` — the public-forms
  // plugin rewrites the action server-side). Match any `<resource>:publicSubmit`.
  { match: /:publicSubmit(\?|$)/, scene: 'publicForms' },
];

/** Auth pages that get an inline captcha widget injected into the form. */
const PAGE_RULES: Array<{ test: (pathname: string) => boolean; scene: keyof PublicConfig }> = [
  { test: (p) => /\/signin\/?$/.test(p), scene: 'signIn' },
  { test: (p) => /\/signup\/?$/.test(p), scene: 'signUp' },
  { test: (p) => /\/forgot-password\/?$/.test(p), scene: 'lostPassword' },
];

const CONTAINER_ID = 'simo-captcha-inline-box';

export function setupCaptchaGuard(app: any, t: TFunc) {
  const api = app.apiClient;
  let publicConfig: PublicConfig | null = null;
  let fetching: Promise<PublicConfig | null> | null = null;

  const fetchConfig = (): Promise<PublicConfig | null> => {
    if (publicConfig) return Promise.resolve(publicConfig);
    if (!fetching) {
      fetching = api
        .request({ url: 'captcha:getPublicConfig', method: 'get' })
        .then((res: any) => {
          publicConfig = res?.data?.data || null;
          return publicConfig;
        })
        .catch(() => {
          fetching = null;
          return null;
        });
    }
    return fetching;
  };

  const texts = () => ({
    title: t('Security verification'),
    ok: t('Verify'),
    cancel: t('Cancel'),
    placeholder: t('Enter captcha'),
    clickToRefresh: t('Click to refresh'),
    loadFailed: t('Load failed, click to retry'),
    required: t('Please complete the captcha verification'),
  });

  // ---------------------------------------------------------------
  // 1) Request interceptor: attach captcha credential to protected calls.
  //    Uses the inline widget's value when present, otherwise opens a
  //    modal dialog (public form submissions, fallback for auth pages).
  // ---------------------------------------------------------------
  api.axios.interceptors.request.use(async (config: any) => {
    const url = config?.url || '';
    const rule = URL_RULES.find((r) => r.match.test(url));
    if (!rule) return config;
    const cfg = await fetchConfig();
    if (!cfg || !cfg[rule.scene]) return config;

    let cred = captchaState.peek();
    if (!cred) {
      // No inline widget value — ask via modal (e.g. public form submit)
      cred = await openCaptchaModal({ api, texts: texts() });
    }
    config.headers = config.headers || {};
    config.headers['X-Captcha-Id'] = cred.id;
    config.headers['X-Captcha-Code'] = cred.code;
    return config;
  });

  // ---------------------------------------------------------------
  // 2) Response interceptor: a captcha is one-time on the server, so
  //    after any protected request completes (success or failure) the
  //    stale credential must be dropped and the widget refreshed.
  // ---------------------------------------------------------------
  api.axios.interceptors.response.use(
    (response: any) => {
      const url = response?.config?.url || '';
      if (URL_RULES.some((r) => r.match.test(url))) {
        captchaState.clear();
        requestCaptchaRefresh();
      }
      return response;
    },
    (error: any) => {
      const url = error?.config?.url || '';
      if (URL_RULES.some((r) => r.match.test(url))) {
        captchaState.clear();
        requestCaptchaRefresh();
      }
      return Promise.reject(error);
    },
  );

  // ---------------------------------------------------------------
  // 3) Inline widget injection on auth pages (signin/signup/forgot).
  //    Pure DOM + isolated React root — no app Provider involved.
  // ---------------------------------------------------------------
  let mounted: { container: HTMLElement; root: Root } | null = null;
  let scheduling = false;

  const unmountIfDetached = () => {
    if (mounted && !mounted.container.isConnected) {
      const stale = mounted;
      mounted = null;
      captchaState.clear();
      try {
        stale.root.unmount();
      } catch (e) {
        // ignore
      }
    }
  };

  const findAnchor = (): HTMLElement | null => {
    // The submit button on auth pages is the primary block button
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button.ant-btn-primary'));
    const btn =
      buttons.find((b) => b.getAttribute('type') === 'submit') ||
      buttons.find((b) => b.offsetWidth >= 180) ||
      buttons[buttons.length - 1];
    if (!btn) return null;
    return (btn.closest('.ant-form-item') as HTMLElement) || btn;
  };

  const inject = async () => {
    const pathname = window.location.pathname || '';
    const page = PAGE_RULES.find((r) => r.test(pathname));
    unmountIfDetached();
    if (!page) return;
    const cfg = await fetchConfig();
    if (!cfg || !cfg[page.scene]) return;
    if (mounted && mounted.container.isConnected) return;
    if (document.getElementById(CONTAINER_ID)) return;

    const anchor = findAnchor();
    if (!anchor || !anchor.parentElement) return;

    const container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.style.marginBottom = '16px';
    anchor.parentElement.insertBefore(container, anchor);

    const root = createRoot(container);
    const tx = texts();
    root.render(
      <CaptchaBox
        api={api}
        texts={{ placeholder: tx.placeholder, clickToRefresh: tx.clickToRefresh, loadFailed: tx.loadFailed }}
        onChange={(cred) => captchaState.set(cred)}
      />,
    );
    mounted = { container, root };
  };

  const schedule = () => {
    if (scheduling) return;
    scheduling = true;
    setTimeout(() => {
      scheduling = false;
      inject();
    }, 150);
  };

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      const target = m.target as HTMLElement;
      // Ignore mutations inside our own widget
      if (target && target.closest && target.closest(`#${CONTAINER_ID}`)) continue;
      schedule();
      return;
    }
  });

  const start = () => {
    if (!document.body) return;
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}
