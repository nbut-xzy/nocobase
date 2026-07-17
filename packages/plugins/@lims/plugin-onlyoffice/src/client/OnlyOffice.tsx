/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DocumentEditor } from '@onlyoffice/document-editor-react';
import { observer, useField } from '@formily/react';
import { useAPIClient, useBlockHeight } from '@nocobase/client';
import { useFlowContext } from '@nocobase/flow-engine';
import { Card, Spin } from 'antd';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const EXT_TO_DOC_TYPE: Record<string, { documentType: string; fileType: string }> = {
  doc: { documentType: 'word', fileType: 'doc' },
  docx: { documentType: 'word', fileType: 'docx' },
  docm: { documentType: 'word', fileType: 'docm' },
  dot: { documentType: 'word', fileType: 'dot' },
  dotx: { documentType: 'word', fileType: 'dotx' },
  dotm: { documentType: 'word', fileType: 'dotm' },
  odt: { documentType: 'word', fileType: 'odt' },
  ott: { documentType: 'word', fileType: 'ott' },
  rtf: { documentType: 'word', fileType: 'rtf' },
  txt: { documentType: 'word', fileType: 'txt' },
  htm: { documentType: 'word', fileType: 'htm' },
  html: { documentType: 'word', fileType: 'html' },
  mht: { documentType: 'word', fileType: 'mht' },
  mhtml: { documentType: 'word', fileType: 'mhtml' },
  epub: { documentType: 'word', fileType: 'epub' },
  fb2: { documentType: 'word', fileType: 'fb2' },
  fodt: { documentType: 'word', fileType: 'fodt' },
  stw: { documentType: 'word', fileType: 'stw' },
  sxw: { documentType: 'word', fileType: 'sxw' },
  wps: { documentType: 'word', fileType: 'wps' },
  wpt: { documentType: 'word', fileType: 'wpt' },
  pages: { documentType: 'word', fileType: 'pages' },
  md: { documentType: 'word', fileType: 'md' },
  xls: { documentType: 'cell', fileType: 'xls' },
  xlsx: { documentType: 'cell', fileType: 'xlsx' },
  xlsm: { documentType: 'cell', fileType: 'xlsm' },
  xlt: { documentType: 'cell', fileType: 'xlt' },
  xltx: { documentType: 'cell', fileType: 'xltx' },
  xltm: { documentType: 'cell', fileType: 'xltm' },
  csv: { documentType: 'cell', fileType: 'csv' },
  ods: { documentType: 'cell', fileType: 'ods' },
  ots: { documentType: 'cell', fileType: 'ots' },
  fods: { documentType: 'cell', fileType: 'fods' },
  sxc: { documentType: 'cell', fileType: 'sxc' },
  et: { documentType: 'cell', fileType: 'et' },
  ett: { documentType: 'cell', fileType: 'ett' },
  ppt: { documentType: 'slide', fileType: 'ppt' },
  pptx: { documentType: 'slide', fileType: 'pptx' },
  pptm: { documentType: 'slide', fileType: 'pptm' },
  pps: { documentType: 'slide', fileType: 'pps' },
  ppsx: { documentType: 'slide', fileType: 'ppsx' },
  ppsm: { documentType: 'slide', fileType: 'ppsm' },
  pot: { documentType: 'slide', fileType: 'pot' },
  potx: { documentType: 'slide', fileType: 'potx' },
  potm: { documentType: 'slide', fileType: 'potm' },
  odp: { documentType: 'slide', fileType: 'odp' },
  otp: { documentType: 'slide', fileType: 'otp' },
  fodp: { documentType: 'slide', fileType: 'fodp' },
  sxi: { documentType: 'slide', fileType: 'sxi' },
  dps: { documentType: 'slide', fileType: 'dps' },
  dpt: { documentType: 'slide', fileType: 'dpt' },
  pdf: { documentType: 'pdf', fileType: 'pdf' },
  djvu: { documentType: 'pdf', fileType: 'djvu' },
  xps: { documentType: 'pdf', fileType: 'xps' },
  oxps: { documentType: 'pdf', fileType: 'oxps' },
};

function detectFromUrl(url: string): { documentType: string; fileType: string } | null {
  if (!url) return null;
  const cleaned = url.split('?')[0].split('#')[0];
  const ext = cleaned.split('.').pop()?.toLowerCase();
  return ext && EXT_TO_DOC_TYPE[ext] ? EXT_TO_DOC_TYPE[ext] : null;
}

export const OnlyOffice: any = observer(
  (props: any) => {
    const field = useField();
    const { t } = useTranslation();
    const api = useAPIClient();
    const height = useBlockHeight();
    const ctx = useFlowContext();
    const componentProps = { ...props, ...(field.componentProps || {}) };
    const {
      fileUrl,
      documentType,
      fileType,
      mode = 'edit',
      title: docTitle,
      documentServerUrl,
      callbackUrl,
      lang,
    } = componentProps;

    const [globalSettings, setGlobalSettings] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [resolvedFileUrl, setResolvedFileUrl] = useState('');
    const [resolvedCbUrl, setResolvedCbUrl] = useState('');
    const [resolving, setResolving] = useState(true);
    const [docKey, setDocKey] = useState('');

    const record = ctx.record;

    useEffect(() => {
      let active = true;
      async function resolveTemplates() {
        try {
          // fileUrl: 显式配置 > ctx.record.url
          const rawUrl = fileUrl || record?.url || '';
          const urlResolved =
            typeof rawUrl === 'string' ? await ctx.liquid.renderWithFullContext(rawUrl, ctx) : rawUrl || '';
          const cbRaw = callbackUrl || globalSettings.callbackUrl;
          const cbResolved =
            typeof cbRaw === 'string' ? await ctx.liquid.renderWithFullContext(cbRaw, ctx) : cbRaw || '';
          if (active) {
            setResolvedFileUrl(urlResolved || '');
            setResolvedCbUrl(cbResolved || '');
          }
        } catch {
          if (active) {
            setResolvedFileUrl(fileUrl || '');
            setResolvedCbUrl(callbackUrl || globalSettings.callbackUrl || '');
          }
        } finally {
          if (active) setResolving(false);
        }
      }
      resolveTemplates();
      return () => {
        active = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fileUrl, callbackUrl, globalSettings.callbackUrl, ctx]);

    useEffect(() => {
      if (!resolvedFileUrl) return;
      let active = true;
      async function fetchKey() {
        try {
          const res: any = await api.request({
            url: 'onlyoffice:getKey',
            method: 'post',
            data: { fileUrl: resolvedFileUrl },
          });
          if (active && res?.data?.data?.key) {
            setDocKey(res.data.data.key);
          }
        } catch {
          if (active) setDocKey(encodeURIComponent(resolvedFileUrl));
        }
      }
      fetchKey();
      return () => {
        active = false;
      };
    }, [resolvedFileUrl, api]);

    useEffect(() => {
      let active = true;
      async function fetchSettings() {
        try {
          const res: any = await api.request({ url: 'onlyofficeSettings:get', method: 'get' });
          if (active && res?.data?.data) {
            setGlobalSettings(res.data.data);
          }
        } catch {
          // Global settings not available, use local only
        } finally {
          if (active) setLoading(false);
        }
      }
      fetchSettings();
      return () => {
        active = false;
      };
    }, [api]);

    const serverUrl = documentServerUrl || globalSettings.documentServerUrl;
    const cbUrl = callbackUrl || globalSettings.callbackUrl;

    if (loading || resolving) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: height || 200 }}>
          <Spin />
        </div>
      );
    }

    if (!serverUrl) {
      return (
        <Card style={{ marginBottom: 24 }}>
          {t('Please configure the OnlyOffice Document Server URL in plugin settings or block settings.')}
        </Card>
      );
    }

    if (!resolvedFileUrl) {
      return <Card style={{ marginBottom: 24 }}>{t('Please provide a file URL.')}</Card>;
    }

    const detected = detectFromUrl(resolvedFileUrl);
    const resolvedDocType = documentType || detected?.documentType || 'word';
    const resolvedFileType =
      fileType ||
      detected?.fileType ||
      (resolvedDocType === 'word'
        ? 'docx'
        : resolvedDocType === 'cell'
          ? 'xlsx'
          : resolvedDocType === 'slide'
            ? 'pptx'
            : 'pdf');

    const key = docKey;

    const config: any = {
      document: {
        fileType: resolvedFileType,
        key,
        title: docTitle || record?.title || 'Document',
        url: resolvedFileUrl,
      },
      documentType: resolvedDocType,
      editorConfig: {
        callbackUrl: resolvedCbUrl || '',
        mode: mode,
        lang: lang || 'en',
      },
    };

    return (
      <DocumentEditor
        id={`onlyoffice-${key}`}
        documentServerUrl={serverUrl}
        config={config}
        height={height || '100%'}
        onLoadComponentError={(code: number, desc: string) => console.error(`[OnlyOffice] ${code}: ${desc}`)}
      />
    );
  },
  { displayName: 'OnlyOffice' },
);
