import React, { useCallback } from 'react';
import { ColorPicker, Space, Switch } from 'antd';
import { connect } from '@formily/react';
import { useT } from '../locale';

export interface BarcodeColorInputProps {
  value?: string;
  onChange?: (value: string) => void;
  /** Show a "transparent" toggle — only meaningful for the background colour. */
  allowTransparent?: boolean;
  disabled?: boolean;
}

/**
 * A hex colour field for the flow-settings form.
 * `transparent` is stored verbatim so it can be handed straight to JsBarcode.
 */
const InnerColorInput: React.FC<BarcodeColorInputProps> = ({ value, onChange, allowTransparent, disabled }) => {
  const t = useT();
  const isTransparent = value === 'transparent';

  const handleColor = useCallback(
    (_: any, hex: string) => {
      onChange?.(hex);
    },
    [onChange],
  );

  const handleTransparent = useCallback(
    (checked: boolean) => {
      onChange?.(checked ? 'transparent' : '#ffffff');
    },
    [onChange],
  );

  return (
    <Space>
      <ColorPicker
        disabled={disabled || isTransparent}
        value={isTransparent ? '#ffffff' : value || '#000000'}
        onChange={handleColor}
        showText
        disabledAlpha
      />
      {allowTransparent ? (
        <Space size={4}>
          <Switch size="small" checked={isTransparent} disabled={disabled} onChange={handleTransparent} />
          <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.65)' }}>{t('Transparent')}</span>
        </Space>
      ) : null}
    </Space>
  );
};

/** Formily-connected version, used as `x-component: 'BarcodeColorInput'`. */
export const BarcodeColorInput = connect(InnerColorInput);

export default BarcodeColorInput;
