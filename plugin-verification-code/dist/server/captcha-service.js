/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var captcha_service_exports = {};
__export(captcha_service_exports, {
  CaptchaService: () => CaptchaService,
  SIMILAR_CHARS: () => SIMILAR_CHARS
});
module.exports = __toCommonJS(captcha_service_exports);
var import_crypto = __toESM(require("crypto"));
var import_local_captcha = require("./local-captcha");
let svgCaptcha = null;
try {
  svgCaptcha = require("svg-captcha");
} catch (err) {
  svgCaptcha = null;
}
const SIMILAR_CHARS = "0oO1ilIJ9gq";
function clamp(v, min, max, dflt) {
  const n = Number(v);
  if (Number.isNaN(n)) return dflt;
  return Math.min(max, Math.max(min, Math.round(n)));
}
const CHAR_PRESETS = {
  digits: "0123456789",
  letters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  alphanumeric: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
};
class CaptchaService {
  constructor(logger) {
    this.logger = logger;
  }
  cache;
  memoryStore = /* @__PURE__ */ new Map();
  rateMap = /* @__PURE__ */ new Map();
  setCache(cache) {
    this.cache = cache;
  }
  get usingSvgCaptcha() {
    return !!svgCaptcha;
  }
  /** Sanitize raw settings into safe generation params. */
  normalize(settings) {
    const charPreset = ["alphanumeric", "letters", "digits"].includes(settings.charPreset || "") ? settings.charPreset : "alphanumeric";
    return {
      captchaType: settings.captchaType === "math" ? "math" : "characters",
      length: clamp(settings.length, 4, 8, 4),
      charPreset,
      excludeSimilar: settings.excludeSimilar !== false,
      mathOperator: ["+", "-", "+-"].includes(settings.mathOperator || "") ? settings.mathOperator : "+-",
      mathMin: clamp(settings.mathMin, 0, 99, 1),
      mathMax: clamp(settings.mathMax, 1, 99, 20),
      noise: clamp(settings.noise, 0, 10, 3),
      color: settings.color !== false,
      background: typeof settings.background === "string" && /^#[0-9a-fA-F]{3,8}$/.test(settings.background) ? settings.background : "#f2f3f5",
      width: clamp(settings.width, 80, 400, 150),
      height: clamp(settings.height, 30, 160, 50),
      fontSize: clamp(settings.fontSize, 20, 120, 50),
      expiresIn: clamp(settings.expiresIn, 30, 3600, 300)
    };
  }
  /** Generate the captcha image without storing (used by admin preview). */
  render(settings) {
    const opts = this.normalize(settings);
    const ignoreChars = opts.excludeSimilar ? SIMILAR_CHARS : "";
    if (svgCaptcha) {
      if (opts.captchaType === "math") {
        const r3 = svgCaptcha.createMathExpr({
          mathMin: opts.mathMin,
          mathMax: opts.mathMax,
          mathOperator: opts.mathOperator,
          noise: opts.noise,
          color: opts.color,
          // svg-captcha forces color=true whenever a background is set, so
          // drop the background when colorful characters are disabled.
          background: opts.color ? opts.background : void 0,
          width: opts.width,
          height: opts.height,
          fontSize: opts.fontSize
        });
        return { text: String(r3.text), svg: r3.data };
      }
      const r2 = svgCaptcha.create({
        size: opts.length,
        charPreset: CHAR_PRESETS[opts.charPreset] || CHAR_PRESETS.alphanumeric,
        ignoreChars,
        noise: opts.noise,
        color: opts.color,
        background: opts.color ? opts.background : void 0,
        width: opts.width,
        height: opts.height,
        fontSize: opts.fontSize
      });
      return { text: String(r2.text), svg: r2.data };
    }
    const common = {
      size: opts.length,
      charPreset: opts.charPreset,
      ignoreChars,
      noise: opts.noise,
      color: opts.color,
      background: opts.color ? opts.background : void 0,
      width: opts.width,
      height: opts.height,
      fontSize: opts.fontSize
    };
    const r = opts.captchaType === "math" ? (0, import_local_captcha.createLocalMathCaptcha)({ ...common, mathMin: opts.mathMin, mathMax: opts.mathMax, mathOperator: opts.mathOperator }) : (0, import_local_captcha.createLocalCaptcha)(common);
    return { text: r.text, svg: r.data };
  }
  /** Generate + store, returns payload for the client (answer never leaves the server). */
  async generate(settings) {
    const opts = this.normalize(settings);
    const { text, svg } = this.render(settings);
    const id = import_crypto.default.randomUUID();
    const entry = {
      // Case-insensitive comparison — store lowercased
      answer: text.trim().toLowerCase(),
      expiresAt: Date.now() + opts.expiresIn * 1e3
    };
    await this.storeSet(id, entry, opts.expiresIn * 1e3);
    return {
      id,
      image: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
      expiresIn: opts.expiresIn
    };
  }
  /**
   * Verify a captcha answer. The captcha is one-time: it is deleted on the
   * first verification attempt no matter the outcome.
   */
  async verify(id, code) {
    if (!id || typeof id !== "string" || id.length > 64 || !code || typeof code !== "string" || code.length > 32) {
      return { ok: false, reason: "invalid" };
    }
    const entry = await this.storeGet(id);
    await this.storeDel(id);
    if (!entry) {
      return { ok: false, reason: "expired" };
    }
    if (Date.now() > entry.expiresAt) {
      return { ok: false, reason: "expired" };
    }
    const expected = entry.answer;
    const actual = String(code).trim().toLowerCase();
    if (expected.length === actual.length && import_crypto.default.timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) {
      return { ok: true };
    }
    return { ok: false, reason: "invalid" };
  }
  /** Simple sliding-window rate limit per key (e.g. client IP). */
  checkRateLimit(key, limitPerMinute) {
    const limit = clamp(limitPerMinute, 1, 6e3, 30);
    const now = Date.now();
    const windowMs = 60 * 1e3;
    let arr = this.rateMap.get(key) || [];
    arr = arr.filter((t) => now - t < windowMs);
    if (arr.length >= limit) {
      this.rateMap.set(key, arr);
      return false;
    }
    arr.push(now);
    this.rateMap.set(key, arr);
    if (this.rateMap.size > 1e4) {
      const cutoff = now - windowMs;
      for (const [k, v] of this.rateMap) {
        if (!v.length || v[v.length - 1] < cutoff) this.rateMap.delete(k);
      }
    }
    return true;
  }
  async storeSet(id, entry, ttlMs) {
    var _a, _b;
    if (this.cache) {
      try {
        await this.cache.set(id, entry, ttlMs);
        return;
      } catch (err) {
        (_b = (_a = this.logger) == null ? void 0 : _a.warn) == null ? void 0 : _b.call(_a, `[verification-code] cache set failed, falling back to memory: ${err}`);
      }
    }
    this.memoryStore.set(id, entry);
    this.gcMemory();
  }
  async storeGet(id) {
    var _a, _b;
    if (this.cache) {
      try {
        const v = await this.cache.get(id);
        if (v) return v;
      } catch (err) {
        (_b = (_a = this.logger) == null ? void 0 : _a.warn) == null ? void 0 : _b.call(_a, `[verification-code] cache get failed: ${err}`);
      }
    }
    return this.memoryStore.get(id);
  }
  async storeDel(id) {
    if (this.cache) {
      try {
        await this.cache.del(id);
      } catch (err) {
      }
    }
    this.memoryStore.delete(id);
  }
  gcMemory() {
    if (this.memoryStore.size <= 5e3) return;
    const now = Date.now();
    for (const [k, v] of this.memoryStore) {
      if (v.expiresAt < now) this.memoryStore.delete(k);
    }
    while (this.memoryStore.size > 5e3) {
      const first = this.memoryStore.keys().next().value;
      if (first === void 0) break;
      this.memoryStore.delete(first);
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CaptchaService,
  SIMILAR_CHARS
});
