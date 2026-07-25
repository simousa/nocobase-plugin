/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var local_captcha_exports = {};
__export(local_captcha_exports, {
  createLocalCaptcha: () => createLocalCaptcha,
  createLocalMathCaptcha: () => createLocalMathCaptcha
});
module.exports = __toCommonJS(local_captcha_exports);
const DIGITS = "0123456789";
const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randColor(colorful) {
  if (colorful) {
    const h = randInt(0, 360);
    return `hsl(${h},${randInt(55, 85)}%,${randInt(30, 50)}%)`;
  }
  const v = randInt(30, 90);
  return `rgb(${v},${v},${v})`;
}
function buildCharset(charPreset, ignoreChars) {
  let chars;
  switch (charPreset) {
    case "digits":
      chars = DIGITS;
      break;
    case "letters":
      chars = LETTERS;
      break;
    default:
      chars = DIGITS + LETTERS;
  }
  if (ignoreChars) {
    chars = chars.split("").filter((c) => !ignoreChars.includes(c)).join("");
  }
  return chars || DIGITS + LETTERS;
}
function noisePath(width, height, colorful) {
  const start = `${randInt(0, width / 3)} ${randInt(5, height - 5)}`;
  const mid1 = `${randInt(width / 4, width * 2 / 3)} ${randInt(5, height - 5)}`;
  const mid2 = `${randInt(width / 3, width * 3 / 4)} ${randInt(5, height - 5)}`;
  const end = `${randInt(width * 2 / 3, width)} ${randInt(5, height - 5)}`;
  return `<path d="M${start} C${mid1},${mid2},${end}" stroke="${randColor(colorful)}" fill="none" stroke-width="${randInt(1, 2)}" opacity="0.6"/>`;
}
function renderSvg(text, opts) {
  const { width, height, fontSize, noise, color, background } = opts;
  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
  );
  if (background) {
    parts.push(`<rect width="100%" height="100%" fill="${background}"/>`);
  }
  for (let i = 0; i < Math.ceil(noise / 2); i++) {
    parts.push(noisePath(width, height, color));
  }
  const cell = width / (text.length + 1);
  for (let i = 0; i < text.length; i++) {
    const x = cell * (i + 0.7) + randInt(-4, 4);
    const y = height / 2 + fontSize / 3 + randInt(-5, 5);
    const rotate = randInt(-28, 28);
    const skew = randInt(-12, 12);
    const scale = (randInt(85, 112) / 100).toFixed(2);
    parts.push(
      `<text x="0" y="0" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="bold" fill="${randColor(color)}" transform="translate(${x},${y}) rotate(${rotate}) skewX(${skew}) scale(${scale})" text-anchor="middle">${escapeXml(text[i])}</text>`
    );
  }
  for (let i = 0; i < Math.floor(noise / 2) + noise % 2; i++) {
    parts.push(noisePath(width, height, color));
  }
  for (let i = 0; i < noise * 3; i++) {
    parts.push(
      `<circle cx="${randInt(0, width)}" cy="${randInt(0, height)}" r="${randInt(1, 2)}" fill="${randColor(color)}" opacity="0.5"/>`
    );
  }
  parts.push("</svg>");
  return parts.join("");
}
function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function normalizeOptions(options) {
  return {
    size: options.size ?? 4,
    charPreset: options.charPreset ?? "alphanumeric",
    ignoreChars: options.ignoreChars ?? "",
    noise: options.noise ?? 3,
    color: options.color ?? true,
    background: options.background ?? "#f2f3f5",
    width: options.width ?? 150,
    height: options.height ?? 50,
    fontSize: options.fontSize ?? 50
  };
}
function createLocalCaptcha(options) {
  const opts = normalizeOptions(options);
  const charset = buildCharset(opts.charPreset, opts.ignoreChars);
  let text = "";
  for (let i = 0; i < opts.size; i++) {
    text += charset[randInt(0, charset.length - 1)];
  }
  return { text, data: renderSvg(text, opts) };
}
function createLocalMathCaptcha(options) {
  const opts = normalizeOptions(options);
  const min = options.mathMin ?? 1;
  const max = options.mathMax ?? 20;
  const operators = options.mathOperator === "+" ? ["+"] : options.mathOperator === "-" ? ["-"] : ["+", "-"];
  const op = operators[randInt(0, operators.length - 1)];
  let a = randInt(min, max);
  let b = randInt(min, max);
  if (op === "-" && b > a) {
    [a, b] = [b, a];
  }
  const answer = op === "+" ? a + b : a - b;
  const expr = `${a}${op}${b}=?`;
  const svg = renderSvg(expr, { ...opts, fontSize: Math.min(opts.fontSize, Math.floor(opts.width / (expr.length + 1) * 1.6)) });
  return { text: String(answer), data: svg };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createLocalCaptcha,
  createLocalMathCaptcha
});
