import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Modal } from 'antd';
import { CaptchaBox } from './components/CaptchaBox';
import type { CaptchaCredential } from './captcha-state';

export interface CaptchaModalTexts {
  title: string;
  ok: string;
  cancel: string;
  placeholder: string;
  clickToRefresh: string;
  loadFailed: string;
  required: string;
}

interface ModalDeps {
  api: { request: (config: any) => Promise<any> };
  texts: CaptchaModalTexts;
}

let opening = false;

/**
 * Open a captcha dialog and resolve with the credential once the user
 * confirms. Rejects if the user cancels. Rendered in an isolated React
 * root so it can be triggered from anywhere (e.g. axios interceptors).
 */
export function openCaptchaModal(deps: ModalDeps): Promise<CaptchaCredential> {
  if (opening) {
    return Promise.reject(new Error(deps.texts.required));
  }
  opening = true;
  return new Promise<CaptchaCredential>((resolve, reject) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const cleanup = () => {
      opening = false;
      // Unmount async to let the Modal close animation finish
      setTimeout(() => {
        try {
          root.unmount();
        } catch (e) {
          // ignore
        }
        container.remove();
      }, 300);
    };

    const ModalHost: React.FC = () => {
      const [open, setOpen] = useState(true);
      const [cred, setCred] = useState<CaptchaCredential>({ id: '', code: '' });

      const submit = () => {
        if (!cred.id || !cred.code.trim()) {
          return;
        }
        setOpen(false);
        resolve({ id: cred.id, code: cred.code.trim() });
        cleanup();
      };

      const cancel = () => {
        setOpen(false);
        reject(Object.assign(new Error(deps.texts.required), { code: 'CAPTCHA_CANCELLED' }));
        cleanup();
      };

      return (
        <Modal
          title={deps.texts.title}
          open={open}
          width={380}
          maskClosable={false}
          okText={deps.texts.ok}
          cancelText={deps.texts.cancel}
          okButtonProps={{ disabled: !cred.id || !cred.code.trim() }}
          onOk={submit}
          onCancel={cancel}
          zIndex={2000}
          destroyOnClose
        >
          <div style={{ padding: '12px 0' }}>
            <CaptchaBox
              api={deps.api}
              texts={{
                placeholder: deps.texts.placeholder,
                clickToRefresh: deps.texts.clickToRefresh,
                loadFailed: deps.texts.loadFailed,
              }}
              onChange={setCred}
              autoFocus
              onPressEnter={submit}
            />
          </div>
        </Modal>
      );
    };

    root.render(<ModalHost />);
  });
}
