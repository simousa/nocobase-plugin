import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Input, Spin, Tooltip } from 'antd';
import { ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { REFRESH_EVENT } from '../captcha-state';

export interface CaptchaBoxTexts {
  placeholder: string;
  clickToRefresh: string;
  loadFailed: string;
}

/**
 * Page-layout config delivered by the server (`captcha:getPublicConfig.box`).
 *
 * - `layoutAuto`: when true, the display box matches the captcha image's
 *   original size (zero scaling) and the input box takes the remaining
 *   width. Heights follow the image height.
 * - `inputRatio`: when manual, input box width as a % of the container
 *   (10-99); the display box gets the rest.
 * - `inputHeight` / `displayHeight`: independent pixel heights (manual mode).
 * - `imageWidth` / `imageHeight`: the generated image's dimensions, used to
 *   size the display box in auto mode.
 */
export interface BoxSizeConfig {
  layoutAuto?: boolean;
  inputRatio?: number;
  inputHeight?: number;
  displayHeight?: number;
  imageWidth?: number;
  imageHeight?: number;
}

export interface CaptchaBoxProps {
  /** APIClient-compatible object: request(config) → Promise<AxiosResponse> */
  api: { request: (config: any) => Promise<any> };
  texts: CaptchaBoxTexts;
  onChange: (cred: { id: string; code: string }) => void;
  /** Autofocus the input (used inside the modal) */
  autoFocus?: boolean;
  onPressEnter?: () => void;
  /** Page-layout config (auto-fit / ratio + heights + image dimensions). */
  boxConfig?: BoxSizeConfig;
}

function clampInt(v: any, min: number, max: number, dflt: number): number {
  const n = Number(v);
  if (Number.isNaN(n)) return dflt;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Resolve the input/display box styles from the server-provided layout config.
 *
 * Auto mode: display box = exact image size (no scaling); input box takes the
 *   remaining width (flex:1); both heights = image height.
 * Manual mode: container width splits by `inputRatio : (100 - inputRatio)`;
 *   heights are independent; the image scales to fit its (possibly smaller) box.
 */
function resolveBoxStyles(box: BoxSizeConfig | undefined): {
  input: React.CSSProperties;
  display: React.CSSProperties;
} {
  if (!box) {
    // No config — sensible adaptive defaults.
    return {
      input: { flex: 1, minWidth: 0, height: 40 },
      display: { flex: '0 0 120px', width: 120, height: 40 },
    };
  }

  const imgW = clampInt(box.imageWidth, 40, 800, 150);
  const imgH = clampInt(box.imageHeight, 20, 400, 50);

  if (box.layoutAuto !== false) {
    // Auto-fit: display box exactly matches the image (zero scaling);
    // input takes the remaining width and matches the image height.
    return {
      input: { flex: 1, minWidth: 0, height: imgH },
      display: { flex: `0 0 ${imgW}px`, width: imgW, height: imgH },
    };
  }

  // Manual: width split by ratio, heights independent.
  const ratio = clampInt(box.inputRatio, 10, 90, 60);
  const inH = clampInt(box.inputHeight, 20, 200, 40);
  const dispH = clampInt(box.displayHeight, 30, 300, 44);
  return {
    input: { flex: `${ratio} 1 0`, minWidth: 0, height: inH },
    display: { flex: `${100 - ratio} 1 0`, minWidth: 0, height: dispH },
  };
}

/**
 * Captcha image + input. Click the image (or the refresh icon) to get a new
 * captcha. Verification is case-insensitive (handled server-side).
 */
export function CaptchaBox(props: CaptchaBoxProps) {
  const { api, texts, onChange, autoFocus, onPressEnter, boxConfig } = props;
  const [image, setImage] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [code, setCode] = useState('');
  const idRef = useRef<string>('');
  const mountedRef = useRef(true);

  const { input: inputStyle, display: displayStyle } = resolveBoxStyles(boxConfig);

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
        style={inputStyle}
      />
      <Tooltip title={texts.clickToRefresh}>
        <div
          onClick={() => !loading && refresh()}
          style={{
            ...displayStyle,
            cursor: 'pointer',
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
            <img src={image} alt="captcha" style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }} draggable={false} />
          )}
        </div>
      </Tooltip>
    </div>
  );
}

export default CaptchaBox;
