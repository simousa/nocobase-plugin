import crypto from 'crypto';
import { createLocalCaptcha, createLocalMathCaptcha } from './local-captcha';

// svg-captcha is a pure-JS, fully local, open-source captcha generator.
// It never calls any third-party API. If it cannot be resolved for some
// reason, we fall back to the built-in zero-dependency generator.
let svgCaptcha: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  svgCaptcha = require('svg-captcha');
} catch (err) {
  svgCaptcha = null;
}

export const SIMILAR_CHARS = '0oO1ilIJ9gq';

export interface CaptchaGenerateSettings {
  captchaType?: string; // characters | math
  length?: number;
  charPreset?: string; // alphanumeric | letters | digits
  excludeSimilar?: boolean;
  mathOperator?: string;
  mathMin?: number;
  mathMax?: number;
  noise?: number;
  color?: boolean;
  background?: string;
  width?: number;
  height?: number;
  fontSize?: number;
  expiresIn?: number; // seconds
}

interface StoreEntry {
  answer: string;
  expiresAt: number;
}

interface CacheLike {
  get<T>(key: string): Promise<T>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
}

function clamp(v: any, min: number, max: number, dflt: number): number {
  const n = Number(v);
  if (Number.isNaN(n)) return dflt;
  return Math.min(max, Math.max(min, Math.round(n)));
}

const CHAR_PRESETS: Record<string, string> = {
  digits: '0123456789',
  letters: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  alphanumeric: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
};

export class CaptchaService {
  private cache: CacheLike;
  private memoryStore = new Map<string, StoreEntry>();
  private rateMap = new Map<string, number[]>();

  constructor(private logger?: any) {}

  setCache(cache: CacheLike) {
    this.cache = cache;
  }

  get usingSvgCaptcha() {
    return !!svgCaptcha;
  }

  /** Sanitize raw settings into safe generation params. */
  normalize(settings: CaptchaGenerateSettings) {
    const charPreset = ['alphanumeric', 'letters', 'digits'].includes(settings.charPreset || '')
      ? settings.charPreset
      : 'alphanumeric';
    return {
      captchaType: settings.captchaType === 'math' ? 'math' : 'characters',
      length: clamp(settings.length, 4, 8, 4),
      charPreset,
      excludeSimilar: settings.excludeSimilar !== false,
      mathOperator: ['+', '-', '+-'].includes(settings.mathOperator || '') ? settings.mathOperator : '+-',
      mathMin: clamp(settings.mathMin, 0, 99, 1),
      mathMax: clamp(settings.mathMax, 1, 99, 20),
      noise: clamp(settings.noise, 0, 10, 3),
      color: settings.color !== false,
      background: typeof settings.background === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(settings.background)
        ? settings.background
        : '#f2f3f5',
      width: clamp(settings.width, 80, 400, 150),
      height: clamp(settings.height, 30, 160, 50),
      fontSize: clamp(settings.fontSize, 20, 120, 50),
      expiresIn: clamp(settings.expiresIn, 30, 3600, 300),
    };
  }

  /** Generate the captcha image without storing (used by admin preview). */
  render(settings: CaptchaGenerateSettings): { text: string; svg: string } {
    const opts = this.normalize(settings);
    const ignoreChars = opts.excludeSimilar ? SIMILAR_CHARS : '';

    if (svgCaptcha) {
      if (opts.captchaType === 'math') {
        const r = svgCaptcha.createMathExpr({
          mathMin: opts.mathMin,
          mathMax: opts.mathMax,
          mathOperator: opts.mathOperator,
          noise: opts.noise,
          color: opts.color,
          // svg-captcha forces color=true whenever a background is set, so
          // drop the background when colorful characters are disabled.
          background: opts.color ? opts.background : undefined,
          width: opts.width,
          height: opts.height,
          fontSize: opts.fontSize,
        });
        return { text: String(r.text), svg: r.data };
      }
      const r = svgCaptcha.create({
        size: opts.length,
        charPreset: CHAR_PRESETS[opts.charPreset] || CHAR_PRESETS.alphanumeric,
        ignoreChars,
        noise: opts.noise,
        color: opts.color,
        background: opts.color ? opts.background : undefined,
        width: opts.width,
        height: opts.height,
        fontSize: opts.fontSize,
      });
      return { text: String(r.text), svg: r.data };
    }

    // Fallback: built-in zero-dependency generator
    const common = {
      size: opts.length,
      charPreset: opts.charPreset,
      ignoreChars,
      noise: opts.noise,
      color: opts.color,
      background: opts.color ? opts.background : undefined,
      width: opts.width,
      height: opts.height,
      fontSize: opts.fontSize,
    };
    const r =
      opts.captchaType === 'math'
        ? createLocalMathCaptcha({ ...common, mathMin: opts.mathMin, mathMax: opts.mathMax, mathOperator: opts.mathOperator })
        : createLocalCaptcha(common);
    return { text: r.text, svg: r.data };
  }

  /** Generate + store, returns payload for the client (answer never leaves the server). */
  async generate(settings: CaptchaGenerateSettings) {
    const opts = this.normalize(settings);
    const { text, svg } = this.render(settings);
    const id = crypto.randomUUID();
    const entry: StoreEntry = {
      // Case-insensitive comparison — store lowercased
      answer: text.trim().toLowerCase(),
      expiresAt: Date.now() + opts.expiresIn * 1000,
    };
    await this.storeSet(id, entry, opts.expiresIn * 1000);
    return {
      id,
      image: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
      expiresIn: opts.expiresIn,
    };
  }

  /**
   * Verify a captcha answer. The captcha is one-time: it is deleted on the
   * first verification attempt no matter the outcome.
   */
  async verify(id: string, code: string): Promise<{ ok: boolean; reason?: 'invalid' | 'expired' }> {
    if (!id || typeof id !== 'string' || id.length > 64 || !code || typeof code !== 'string' || code.length > 32) {
      return { ok: false, reason: 'invalid' };
    }
    const entry = await this.storeGet(id);
    // one-time use: always delete first
    await this.storeDel(id);
    if (!entry) {
      return { ok: false, reason: 'expired' };
    }
    if (Date.now() > entry.expiresAt) {
      return { ok: false, reason: 'expired' };
    }
    const expected = entry.answer;
    const actual = String(code).trim().toLowerCase();
    if (
      expected.length === actual.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
    ) {
      return { ok: true };
    }
    return { ok: false, reason: 'invalid' };
  }

  /** Simple sliding-window rate limit per key (e.g. client IP). */
  checkRateLimit(key: string, limitPerMinute: number): boolean {
    const limit = clamp(limitPerMinute, 1, 6000, 30);
    const now = Date.now();
    const windowMs = 60 * 1000;
    let arr = this.rateMap.get(key) || [];
    arr = arr.filter((t) => now - t < windowMs);
    if (arr.length >= limit) {
      this.rateMap.set(key, arr);
      return false;
    }
    arr.push(now);
    this.rateMap.set(key, arr);
    // prevent unbounded growth
    if (this.rateMap.size > 10000) {
      const cutoff = now - windowMs;
      for (const [k, v] of this.rateMap) {
        if (!v.length || v[v.length - 1] < cutoff) this.rateMap.delete(k);
      }
    }
    return true;
  }

  private async storeSet(id: string, entry: StoreEntry, ttlMs: number) {
    if (this.cache) {
      try {
        await this.cache.set(id, entry, ttlMs);
        return;
      } catch (err) {
        this.logger?.warn?.(`[verification-code] cache set failed, falling back to memory: ${err}`);
      }
    }
    this.memoryStore.set(id, entry);
    this.gcMemory();
  }

  private async storeGet(id: string): Promise<StoreEntry | undefined> {
    if (this.cache) {
      try {
        const v = await this.cache.get<StoreEntry>(id);
        if (v) return v;
      } catch (err) {
        this.logger?.warn?.(`[verification-code] cache get failed: ${err}`);
      }
    }
    return this.memoryStore.get(id);
  }

  private async storeDel(id: string) {
    if (this.cache) {
      try {
        await this.cache.del(id);
      } catch (err) {
        // ignore
      }
    }
    this.memoryStore.delete(id);
  }

  private gcMemory() {
    if (this.memoryStore.size <= 5000) return;
    const now = Date.now();
    for (const [k, v] of this.memoryStore) {
      if (v.expiresAt < now) this.memoryStore.delete(k);
    }
    // still too large — drop oldest entries
    while (this.memoryStore.size > 5000) {
      const first = this.memoryStore.keys().next().value;
      if (first === undefined) break;
      this.memoryStore.delete(first);
    }
  }
}
