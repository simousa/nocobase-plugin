import { Verification } from '@nocobase/plugin-verification';

const PLUGIN_NAME = '@simo/plugin-verification-code';

/**
 * Image-captcha verifier for the official `@nocobase/plugin-verification`
 * registry. It appears as the "图片验证码" option under the "添加" dropdown on
 * the `/admin/settings/verification` page.
 *
 * The actual bot-guard protection (intercepting sign-in / sign-up / forgot /
 * public-form submissions) is enforced by a resource-manager middleware in the
 * plugin (see plugin.ts). This class makes the type a first-class verifier so
 * it is also usable by the verification plugin's own verification flow.
 */
export class ImageCaptchaVerification extends Verification {
  async verify({ resource, action, userId, boundInfo, verifyParams }: any) {
    const plugin: any = this.ctx.app.pm.get(PLUGIN_NAME);
    const id = verifyParams?.captchaId || this.ctx.get?.('x-captcha-id');
    const code = verifyParams?.captchaCode || this.ctx.get?.('x-captcha-code');

    if (!id || !code) {
      return this.ctx.throw(400, this.ctx.t('Please complete the captcha verification', { ns: PLUGIN_NAME }), {
        code: 'CAPTCHA_REQUIRED',
      });
    }

    const result = await plugin.service.verify(String(id), String(code));
    if (!result.ok) {
      const message =
        result.reason === 'expired'
          ? this.ctx.t('The captcha has expired, please refresh it and try again', { ns: PLUGIN_NAME })
          : this.ctx.t('Incorrect captcha, please try again', { ns: PLUGIN_NAME });
      return this.ctx.throw(400, message, { code: 'CAPTCHA_INVALID' });
    }
    return { verified: true };
  }
}

export default ImageCaptchaVerification;
