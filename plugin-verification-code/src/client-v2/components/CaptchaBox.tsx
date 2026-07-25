import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Input, Spin, Tooltip } from 'antd';
import { ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { REFRESH_EVENT } from '../captcha-state';

export interface CaptchaBoxTexts {
  placeholder: string;
  clickToRefresh: string;
  loadFailed: string;
}

export interface CaptchaBoxProps {
  /** APIClient-compatible object: request(config) → Promise<AxiosResponse> */
  api: { request: (config: any) => Promise<any> };
  texts: CaptchaBoxTexts;
  onChange: (cred: { id: string; code: string }) => void;
  /** Autofocus the input (used inside the modal) */
  autoFocus?: boolean;
  onPressEnter?: () => void;
}

/**
 * Captcha image + input. Click the image (or the refresh icon) to get a new
 * captcha. Verification is case-insensitive (handled server-side).
 */
export function CaptchaBox(props: CaptchaBoxProps) {
  const { api, texts, onChange, autoFocus, onPressEnter } = props;
  const [image, setImage] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [code, setCode] = useState('');
  const idRef = useRef<string>('');
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await api.request({ url: 'captcha:generate', method: 'get' });
      const data = res?.data?.data;
      if (!mountedRef.current) return;
      if (data?.id && data?.image) {
        idRef.current = data.id;
        setImage(data.image);
        setCode('');
        onChange({ id: data.id, code: '' });
      } else {
        setFailed(true);
      }
    } catch (err) {
      if (mountedRef.current) setFailed(true);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    const handler = () => refresh();
    window.addEventListener(REFRESH_EVENT, handler);
    return () => {
      mountedRef.current = false;
      window.removeEventListener(REFRESH_EVENT, handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
      <Input
        size="large"
        prefix={<SafetyCertificateOutlined style={{ color: 'rgba(0,0,0,0.25)' }} />}
        placeholder={texts.placeholder}
        value={code}
        autoFocus={autoFocus}
        allowClear
        maxLength={16}
        onChange={(e) => {
          const v = e.target.value;
          setCode(v);
          onChange({ id: idRef.current, code: v });
        }}
        onPressEnter={onPressEnter}
        style={{ flex: 1, minWidth: 0 }}
      />
      <Tooltip title={texts.clickToRefresh}>
        <div
          onClick={() => !loading && refresh()}
          style={{
            cursor: 'pointer',
            height: 40,
            minWidth: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #d9d9d9',
            borderRadius: 6,
            overflow: 'hidden',
            background: '#fafafa',
            userSelect: 'none',
          }}
        >
          {loading ? (
            <Spin size="small" />
          ) : failed ? (
            <span style={{ fontSize: 12, color: '#999', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 8px' }}>
              <ReloadOutlined /> {texts.loadFailed}
            </span>
          ) : (
            <img src={image} alt="captcha" style={{ height: '100%', display: 'block' }} draggable={false} />
          )}
        </div>
      </Tooltip>
    </div>
  );
}

export default CaptchaBox;
