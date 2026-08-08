import React, { useCallback, useMemo, useState } from 'react';
import { Button, Modal, Space, Tooltip, Typography, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { BarcodeOptions, isQrFormat } from '../../constants';
import { downloadPng, downloadSvg, renderBarcode } from '../barcode/encoders';
import { useT } from '../locale';

export interface BarcodeViewProps {
  value: any;
  options: BarcodeOptions;
  /** Rendered when the value cannot be encoded and `fallbackToText` is on. */
  fallback?: React.ReactNode;
  /** Base name used for the downloaded file. */
  filename?: string;
}

const svgBoxStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  lineHeight: 0,
  maxWidth: '100%',
};

/**
 * Renders a single field value as a barcode / QR code.
 *
 * The SVG is produced locally by `renderBarcode`; this component only deals
 * with presentation, the invalid-value fallback, and the preview modal.
 */
export const BarcodeView: React.FC<BarcodeViewProps> = (props) => {
  const { value, options, fallback, filename } = props;
  const t = useT();
  const [previewOpen, setPreviewOpen] = useState(false);

  const text = value === null || value === undefined ? '' : String(value);
  const result = useMemo(() => renderBarcode(text, options), [text, options]);

  const openPreview = useCallback(
    (e: React.MouseEvent) => {
      // Never let the click bubble up to the row / link "open record" handler.
      e.stopPropagation();
      e.preventDefault();
      setPreviewOpen(true);
    },
    [],
  );

  const baseName = useMemo(() => {
    const raw = `${filename || 'barcode'}-${text}`;
    // Strip characters that are illegal in file names on Windows / macOS.
    return raw.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 80) || 'barcode';
  }, [filename, text]);

  const handleDownloadSvg = useCallback(() => {
    try {
      downloadSvg(result.svg, baseName);
    } catch (e: any) {
      message.error(e?.message || String(e));
    }
  }, [result.svg, baseName]);

  const handleDownloadPng = useCallback(async () => {
    try {
      await downloadPng(result.svg, baseName, result.width, result.height);
    } catch (e: any) {
      message.error(e?.message || String(e));
    }
  }, [result.svg, result.width, result.height, baseName]);

  /* ---------------- invalid value ---------------- */
  if (!result.ok) {
    const original = fallback ?? <span>{text}</span>;
    if (options.fallbackToText) {
      // Show the original text, and explain on hover why no barcode appeared.
      return (
        <Tooltip title={`${t('Cannot be encoded as')} ${options.format}: ${result.error || ''}`}>
          <span style={{ borderBottom: '1px dashed #d9d9d9' }}>{original}</span>
        </Tooltip>
      );
    }
    return (
      <Typography.Text type="danger" title={result.error}>
        {t('Invalid barcode value')}
      </Typography.Text>
    );
  }

  /* ---------------- valid barcode ---------------- */
  const symbol = (
    <span
      style={{
        ...svgBoxStyle,
        cursor: options.clickToPreview ? 'zoom-in' : 'default',
      }}
      onClick={options.clickToPreview ? openPreview : undefined}
      // The SVG string is generated locally by jsbarcode / qrcode-generator
      // from the field value; it never contains user-authored markup.
      dangerouslySetInnerHTML={{ __html: result.svg }}
    />
  );

  const withText =
    options.originalTextMode === 'none' ? (
      symbol
    ) : options.originalTextMode === 'inline' ? (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {symbol}
        <span>{text}</span>
      </span>
    ) : (
      <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
        {symbol}
        <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.65)' }}>{text}</span>
      </span>
    );

  if (!options.clickToPreview) {
    return withText;
  }

  return (
    <>
      {withText}
      <Modal
        open={previewOpen}
        title={isQrFormat(options.format) ? t('QR code preview') : t('Barcode preview')}
        onCancel={(e) => {
          (e as any)?.stopPropagation?.();
          setPreviewOpen(false);
        }}
        footer={
          options.downloadable ? (
            <Space>
              <Button icon={<DownloadOutlined />} onClick={handleDownloadSvg}>
                SVG
              </Button>
              <Button icon={<DownloadOutlined />} type="primary" onClick={handleDownloadPng}>
                PNG
              </Button>
            </Space>
          ) : null
        }
        width={640}
        destroyOnClose
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            padding: '16px 0',
            background: '#fff',
          }}
        >
          <div
            style={{ maxWidth: '100%', lineHeight: 0 }}
            dangerouslySetInnerHTML={{
              __html: result.svg.replace(
                /^<svg /,
                `<svg style="max-width:100%;height:auto;width:${Math.min(560, result.width * 3)}px" `,
              ),
            }}
          />
          <Typography.Text copyable style={{ wordBreak: 'break-all', textAlign: 'center' }}>
            {text}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {options.format}
            {isQrFormat(options.format) ? ` · ${options.qrErrorLevel}` : ''}
          </Typography.Text>
        </div>
      </Modal>
    </>
  );
};

export default BarcodeView;
