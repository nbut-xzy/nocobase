/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DocumentEditor } from '@onlyoffice/document-editor-react';
import type { Config, FileType, Lang } from '@onlyoffice/doceditor-types';
import {
  buildRecordMeta,
  inferRecordRef,
  SingleRecordResource,
  observer,
  useFlowContext,
  type PropertyMetaFactory,
} from '@nocobase/flow-engine';
import { css } from '@emotion/css';
import { Card, Spin } from 'antd';
import React, { useEffect, useState } from 'react';
import { CollectionBlockModel, BlockSceneEnum, TextAreaWithContextSelector } from '@nocobase/client-v2';
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
  documentServerUrl?: string;
  callbackUrl?: string;
  lang?: string;
  height?: string;
  preScript?: string;
  postScript?: string;
}

const OnlyOfficeEditor = observer((props: OnlyOfficeEditorProps) => {
  const ctx = useFlowContext();
  const t = useT();
  const [globalSettings, setGlobalSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [resolvedFileUrl, setResolvedFileUrl] = useState('');
  const [resolvedCbUrl, setResolvedCbUrl] = useState('');
  const [resolving, setResolving] = useState(true);
  const [docKey, setDocKey] = useState('');

  // 获取全局配置
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
  const rawCbUrl = props.callbackUrl || globalSettings.callbackUrl || '/api/onlyoffice:callback';

  // 解析模板变量（fileUrl/callbackUrl 支持 {{ ctx.record.xxx }}）
  useEffect(() => {
    let active = true;
    async function resolveTemplates() {
      try {
        const record = ctx.record;
        // fileUrl: 显式配置 > ctx.record.url
        const rawUrl = props.fileUrl || record?.url || '';
        const urlResolved =
          typeof rawUrl === 'string' ? await ctx.liquid.renderWithFullContext(rawUrl, ctx) : rawUrl || '';
        const cbResolved =
          typeof rawCbUrl === 'string' ? await ctx.liquid.renderWithFullContext(rawCbUrl, ctx) : rawCbUrl || '';
        if (active) {
          setResolvedFileUrl(urlResolved || '');
          setResolvedCbUrl(cbResolved || '');
        }
      } catch {
        if (active) {
          setResolvedFileUrl(props.fileUrl || '');
          setResolvedCbUrl(rawCbUrl || '');
        }
      } finally {
        if (active) setResolving(false);
      }
    }
    resolveTemplates();
    return () => {
      active = false;
    };
  }, [props.fileUrl, rawCbUrl, ctx]);

  // 获取文档 key（同一 fileUrl 返回相同 key）
  useEffect(() => {
    if (!resolvedFileUrl) return;
    let active = true;
    async function fetchKey() {
      try {
        const record = ctx.record;
        const res = await ctx.api.request({
          url: 'onlyoffice:getKey',
          method: 'post',
          data: {
            fileUrl: resolvedFileUrl,
            collectionName: (ctx as any).collectionName || (ctx as any).collection?.name || null,
            recordId: record?.id || null,
            preScript: props.preScript || null,
            postScript: props.postScript || null,
          },
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
  }, [resolvedFileUrl, ctx.api, props.preScript, props.postScript]);

  if (loading || resolving) {
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

  if (!resolvedFileUrl) {
    return <Card>{t('Please provide a file URL.')}</Card>;
  }

  const detected = detectFromUrl(resolvedFileUrl);
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

  const record = ctx.record;
  const resolvedTitle = props.title || record?.title || 'Document';

  const key = docKey;

  const config: Config = {
    document: {
      fileType: resolvedFileType as FileType,
      key,
      title: resolvedTitle,
      url: resolvedFileUrl,
    },
    documentType: resolvedDocType as Config['documentType'],
    editorConfig: {
      callbackUrl: resolvedCbUrl || '',
      mode: (props.mode as 'edit' | 'view') || 'edit',
      lang: (props.lang || (ctx.locale?.startsWith('zh') ? 'zh' : 'en')) as Lang,
      user: {
        id: String((ctx.viewer as unknown as Record<string, unknown>)?.id || 'anonymous'),
        name: String((ctx.viewer as unknown as Record<string, unknown>)?.nickname || 'User'),
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

export class OnlyOfficeBlockModel extends CollectionBlockModel {
  static scene = BlockSceneEnum.one;
  collectionRequired = false; // 支持无集合绑定的独立使用

  createResource(ctx, params) {
    return ctx.createResource(SingleRecordResource);
  }

  getCurrentRecord() {
    return this.resource?.getData?.() || null;
  }

  protected defaultBlockTitle() {
    const params = this.getStepParams('resourceSettings', 'init');
    return params?.dataSourceKey ? super.defaultBlockTitle() : 'OnlyOffice';
  }

  onInit(options: any): void {
    if (!this.getStepParams('resourceSettings', 'init')) {
      this.setStepParams('resourceSettings', 'init', {});
    }
    super.onInit(options);

    this.setDecoratorProps({
      className: [this.decoratorProps.className, onlyofficeCardClass].filter(Boolean).join(' '),
    });

    const model = this;
    const t = (key: string) => model.context.t?.(key) || key;

    // ctx.record meta: same pattern as createPopupMeta — async factory calls buildRecordMeta
    const recordMeta: PropertyMetaFactory = async () => {
      const ctxCollection = model.context.collection || (model.context as any).collection;
      if (ctxCollection?.name) {
        return buildRecordMeta(
          () => ctxCollection,
          t('Current record'),
          (c) => inferRecordRef(c),
        );
      }
      return null;
    };
    recordMeta.title = t('Current record');
    recordMeta.hasChildren = true;

    this.context.defineProperty('record', {
      get: () => this.getCurrentRecord(),
      cache: false,
      meta: recordMeta,
    });

    this.context.defineProperty('onlyoffice', {
      get: () => ({
        get editorId() {
          return `onlyoffice-${this.uid}`;
        },
        get editor() {
          return (window as any).DocEditor?.instances?.[`onlyoffice-${this.uid}`];
        },
        get isReady() {
          return !!(window as any).DocEditor?.instances?.[`onlyoffice-${this.uid}`];
        },
        showMessage(msg: string) {
          const inst = (window as any).DocEditor?.instances?.[`onlyoffice-${this.uid}`];
          inst?.showMessage(msg);
        },
      }),
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
            'x-component': TextAreaWithContextSelector,
            'x-component-props': {
              placeholder: 'http://localhost{{ ctx.record.path }}',
            },
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
            'x-component': TextAreaWithContextSelector,
            'x-component-props': {
              placeholder: '/api/onlyoffice:callback',
            },
            description: t('If empty, the auto-generated callback URL will be used'),
          },
          preScript: {
            title: t('Pre-callback Script'),
            type: 'string',
            'x-decorator': 'FormItem',
            'x-component': 'Input.TextArea',
            'x-component-props': {
              rows: 4,
              placeholder: '// Runs before file save\n// Access: callbackBody, fileRecord, collectionName, recordId',
            },
            description: t('Simple JavaScript code executed before the callback is processed'),
          },
          postScript: {
            title: t('Post-callback Script'),
            type: 'string',
            'x-decorator': 'FormItem',
            'x-component': 'Input.TextArea',
            'x-component-props': {
              rows: 4,
              placeholder: '// Runs after file save\n// Access: callbackBody, fileRecord, collectionName, recordId',
            },
            description: t('Simple JavaScript code executed after the callback is processed'),
          },
        };
      },
      async handler(ctx, params) {
        const { fileUrl, mode, title, documentServerUrl, callbackUrl, preScript, postScript } = params;
        ctx.model.setProps({
          fileUrl,
          mode,
          title,
          documentServerUrl,
          callbackUrl,
          preScript,
          postScript,
        });
      },
    },
  },
});

OnlyOfficeBlockModel.define({
  label: tExpr('OnlyOffice'),
  group: 'otherBlocks',
  searchable: true,
  createModelOptions: {
    use: 'OnlyOfficeBlockModel',
  },
});
