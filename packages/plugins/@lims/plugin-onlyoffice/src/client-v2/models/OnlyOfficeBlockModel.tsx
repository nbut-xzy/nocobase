/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DocumentEditor } from '@onlyoffice/document-editor-react';
import type { Config } from '@onlyoffice/doceditor-types';
import { observer, useFlowContext } from '@nocobase/flow-engine';
import { css } from '@emotion/css';
import { Card, Spin } from 'antd';
import React, { useEffect, useState } from 'react';
import { BlockModel } from '@nocobase/client-v2';
import { tExpr, useT } from '../locale';

const onlyofficeCardClass = css`
  & > .ant-card-body {
    padding: 0 !important;
  }
`;

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

interface OnlyOfficeEditorProps {
  uid: string;
  fileUrl?: string;
  documentType?: string;
  fileType?: string;
  mode?: string;
  title?: string;
  fileKey?: string;
  documentServerUrl?: string;
  callbackUrl?: string;
  lang?: string;
  height?: string;
}

const OnlyOfficeEditor = observer((props: OnlyOfficeEditorProps) => {
  const ctx = useFlowContext();
  const t = useT();
  const [globalSettings, setGlobalSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function fetchSettings() {
      try {
        const res = await ctx.api.request({ url: 'onlyofficeSettings:get', method: 'get' });
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
  }, [ctx.api]);

  const serverUrl = props.documentServerUrl || globalSettings.documentServerUrl;
  const cbUrl = props.callbackUrl || globalSettings.callbackUrl;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <Spin />
      </div>
    );
  }

  if (!serverUrl) {
    return (
      <Card>{t('Please configure the OnlyOffice Document Server URL in plugin settings or block settings.')}</Card>
    );
  }

  if (!props.fileUrl) {
    return <Card>{t('Please provide a file URL.')}</Card>;
  }

  const detected = detectFromUrl(props.fileUrl);

  const resolvedDocType = props.documentType || detected?.documentType || 'word';

  const resolvedFileType =
    props.fileType ||
    detected?.fileType ||
    (resolvedDocType === 'word'
      ? 'docx'
      : resolvedDocType === 'cell'
        ? 'xlsx'
        : resolvedDocType === 'slide'
          ? 'pptx'
          : 'pdf');

  const fileKey = props.fileKey
    ? `${props.fileKey}_${Date.now()}`
    : `${encodeURIComponent(props.fileUrl)}_${Date.now()}`;

  const config: Config = {
    document: {
      fileType: resolvedFileType,
      key: fileKey,
      title: props.title || 'Document',
      url: props.fileUrl,
    },
    documentType: resolvedDocType as Config['documentType'],
    editorConfig: {
      callbackUrl: cbUrl || '',
      mode: (props.mode as 'edit' | 'view') || 'edit',
      lang: props.lang || (ctx.locale?.startsWith('zh') ? 'zh' : 'en'),
      user: {
        id: String(ctx.viewer?.id || 'anonymous'),
        name: ctx.viewer?.nickname || 'User',
      },
    },
  };

  return (
    <DocumentEditor
      id={`onlyoffice-${props.uid}`}
      documentServerUrl={serverUrl}
      config={config}
      height={props.height || '100%'}
      onLoadComponentError={(code, desc) => console.error(`[OnlyOffice] ${code}: ${desc}`)}
    />
  );
});

OnlyOfficeEditor.displayName = 'OnlyOfficeEditor';

export class OnlyOfficeBlockModel extends BlockModel {
  onInit(options: any): void {
    super.onInit(options);
    this.setDecoratorProps({
      className: [this.decoratorProps.className, onlyofficeCardClass].filter(Boolean).join(' '),
    });
  }

  renderComponent() {
    return <OnlyOfficeEditor uid={this.uid} {...this.props} />;
  }
}

OnlyOfficeBlockModel.registerFlow({
  key: 'onlyofficeBlockSettings',
  title: tExpr('OnlyOffice block setting'),
  on: 'beforeRender',
  steps: {
    editOnlyOffice: {
      title: tExpr('Edit OnlyOffice'),
      uiSchema(ctx) {
        const t = ctx.t;
        return {
          fileUrl: {
            title: t('File URL'),
            type: 'string',
            'x-decorator': 'FormItem',
            'x-component': 'Input',
            required: true,
            description: t('Where the OnlyOffice server can download the document file'),
          },
          mode: {
            title: t('Mode'),
            'x-component': 'Radio.Group',
            'x-decorator': 'FormItem',
            required: true,
            default: 'edit',
            enum: [
              { value: 'edit', label: t('Edit') },
              { value: 'view', label: t('View') },
            ],
          },
          title: {
            title: t('Document Title'),
            type: 'string',
            'x-decorator': 'FormItem',
            'x-component': 'Input',
          },
          fileKey: {
            title: t('File Key'),
            type: 'string',
            'x-decorator': 'FormItem',
            'x-component': 'Input',
            description: t('Optional unique key for identifying the document'),
          },
          documentServerUrl: {
            title: t('Document Server URL (optional)'),
            type: 'string',
            'x-decorator': 'FormItem',
            'x-component': 'Input',
            description: t('If empty, the global default will be used'),
          },
          callbackUrl: {
            title: t('Callback URL (optional)'),
            type: 'string',
            'x-decorator': 'FormItem',
            'x-component': 'Input',
            description: t('If empty, the global default will be used'),
          },
        };
      },
      async handler(ctx, params) {
        const { fileUrl, mode, title, fileKey, documentServerUrl, callbackUrl } = params;
        const detected = detectFromUrl(fileUrl);
        const documentType = params.documentType || detected?.documentType || 'word';
        const fileType =
          params.fileType ||
          detected?.fileType ||
          (documentType === 'word'
            ? 'docx'
            : documentType === 'cell'
              ? 'xlsx'
              : documentType === 'slide'
                ? 'pptx'
                : 'pdf');
        ctx.model.setProps({
          fileUrl,
          documentType,
          fileType,
          mode,
          title,
          fileKey,
          documentServerUrl,
          callbackUrl,
        });
      },
    },
  },
});

OnlyOfficeBlockModel.define({
  label: tExpr('OnlyOffice'),
  group: 'otherBlocks',
});
