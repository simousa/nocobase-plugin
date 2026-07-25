import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'captchaSettings',
  title: 'CAPTCHA Settings',
  fields: [
    // Scenes
    { type: 'boolean', name: 'enableSignIn', defaultValue: false },
    { type: 'boolean', name: 'enableSignUp', defaultValue: false },
    { type: 'boolean', name: 'enableLostPassword', defaultValue: false },
    { type: 'boolean', name: 'enablePublicForms', defaultValue: false },
    // Captcha content
    { type: 'string', name: 'captchaType', defaultValue: 'characters' }, // characters | math
    { type: 'integer', name: 'length', defaultValue: 4 }, // 4-8
    { type: 'string', name: 'charPreset', defaultValue: 'alphanumeric' }, // alphanumeric | letters | digits
    { type: 'boolean', name: 'excludeSimilar', defaultValue: true }, // exclude 0oO1ilI...
    { type: 'string', name: 'mathOperator', defaultValue: '+-' }, // + | - | +-
    { type: 'integer', name: 'mathMin', defaultValue: 1 },
    { type: 'integer', name: 'mathMax', defaultValue: 20 },
    // Appearance
    { type: 'integer', name: 'noise', defaultValue: 3 }, // 0-10 interference lines
    { type: 'boolean', name: 'color', defaultValue: true },
    { type: 'string', name: 'background', defaultValue: '#f2f3f5' },
    { type: 'integer', name: 'width', defaultValue: 150 },
    { type: 'integer', name: 'height', defaultValue: 50 },
    { type: 'integer', name: 'fontSize', defaultValue: 50 },
    // Security
    { type: 'integer', name: 'expiresIn', defaultValue: 300 }, // seconds
    { type: 'integer', name: 'rateLimitPerMinute', defaultValue: 30 }, // per IP
  ],
});
