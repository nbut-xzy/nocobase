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
import { Card, Spin, message } from 'antd';
import React, { useEffect, useState } from 'react';
import { CollectionBlockModel, BlockSceneEnum, TextAreaWithContextSelector } from '@nocobase/client-v2';
import { tExpr, useT } from '../locale';
import { ONLYOFFICE_CALLBACK_ACTION, resolveDocType } from '../../constants';

const onlyofficeCardClass = css`
  & > .ant-card-body {
    padding: 0 !important;
  }
`;

interface OnlyOfficeEditorProps {
  uid: string;
  fileUrl?: string;
  mode?: string;
  title?: string;
  documentServerUrl?: string;
  callbackUrl?: string;
  lang?: string;
  height?: string;
  preScript?: string;
  postScript?: string;
  relationKeyField?: string;
  collectionName?: string | null;
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
  const rawCbUrl = props.callbackUrl || `${ctx.api.axios.defaults.baseURL}${ONLYOFFICE_CALLBACK_ACTION}`;

  // 解析模板变量（fileUrl/callbackUrl 支持 {{ ctx.record.xxx }}），并将相对路径补全为绝对路径
  useEffect(() => {
    let active = true;
    async function resolveTemplates() {
      const apiOrigin = (() => {
        try {
          return new URL(ctx.api.axios.defaults.baseURL).origin;
        } catch {
          return '';
        }
      })();
      const toAbsolute = (u: string) => {
        if (!u || /^https?:\/\//i.test(u) || !apiOrigin) return u;
        return u.startsWith('/') ? `${apiOrigin}${u}` : `${apiOrigin}/${u}`;
      };
      try {
        const record = ctx.record;
        const rawUrl = props.fileUrl || record?.url || '';
        const urlResolved =
          typeof rawUrl === 'string' ? await ctx.liquid.renderWithFullContext(rawUrl, ctx) : rawUrl || '';
        const cbResolved =
          typeof rawCbUrl === 'string' ? await ctx.liquid.renderWithFullContext(rawCbUrl, ctx) : rawCbUrl || '';
        if (active) {
          setResolvedFileUrl(toAbsolute(urlResolved || ''));
          setResolvedCbUrl(cbResolved || '');
        }
      } catch {
        if (active) {
          setResolvedFileUrl(toAbsolute(props.fileUrl || ''));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.fileUrl, rawCbUrl, ctx]);

  // 打开文档：getKey → 冲突检测 → bind（如需要）
  useEffect(() => {
    if (!resolvedFileUrl) return;
    let active = true;

    async function openDocument() {
      try {
        const collectionName = props.collectionName ?? null;

        // Step 1: 查询是否已有 key
        const getKeyRes = await ctx.api.request({
          url: 'onlyoffice:getKey',
          method: 'post',
          data: { fileUrl: resolvedFileUrl },
        });
        const data = getKeyRes?.data?.data;

        if (data && data.key) {
          // 已存在 — 检查是否属于当前区块
          if (data.uiSchemaBlockUid && data.uiSchemaBlockUid !== props.uid) {
            message.error(t('File is being edited in another block'));
            return;
          }
          // 同一区块，直接使用已有 key
          if (active) {
            setDocKey(data.key);
          }
        } else {
          // 不存在 — 创建绑定
          const bindRes = await ctx.api.request({
            url: 'onlyoffice:bind',
            method: 'post',
            data: {
              fileUrl: resolvedFileUrl,
              uiSchemaBlockUid: props.uid,
              recordId: ctx.record?.id || null,
              collectionName,
            },
          });
          if (active && bindRes?.data?.data?.key) {
            setDocKey(bindRes.data.data.key);
          }
        }
      } catch (err: any) {
        if (err?.response?.status === 401 || err?.response?.status === 403) throw err;
        if (active) setDocKey(encodeURIComponent(resolvedFileUrl));
      }
    }

    openDocument();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedFileUrl, ctx.api]);

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

  const { documentType: resolvedDocType, fileType: resolvedFileType } = resolveDocType(resolvedFileUrl);

  const record = ctx.record;
  const resolvedTitle = props.title || record?.title || 'Document';

  const config: Config = {
    document: {
      fileType: resolvedFileType as FileType,
      key: docKey,
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

/**
 * 计算"文件引用字段"的可选项：
 * 过滤当前 collection 中 interface === 'obo'（belongsTo）且目标表 template === 'file' 的字段
 */
function computeRelationKeyFieldOptions(ctx: any): { label: string; value: string }[] {
  const collection = ctx.model?.context?.collection;
  if (!collection) return [];
  const fields = collection.getFields();
  return fields
    .filter((f: any) => {
      const iface = f.interface || f.options?.interface;
      if (iface !== 'obo') return false;
      const targetCol = f.targetCollection;
      return targetCol?.template === 'file' || targetCol?.options?.template === 'file';
    })
    .map((f: any) => ({
      label: f.uiSchema?.title || f.name,
      value: f.name,
    }));
}

export class OnlyOfficeBlockModel extends CollectionBlockModel {
  static scene = BlockSceneEnum.one;
  collectionRequired = false;

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

    // ctx.record meta
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
    const params = this.getResourceSettingsInitParams();
    const collectionName = params?.collectionName || null;
    return <OnlyOfficeEditor uid={this.uid} collectionName={collectionName} {...this.props} />;
  }
}

OnlyOfficeBlockModel.registerFlow({
  key: 'onlyofficeBlockSettings',
  title: tExpr('OnlyOffice block setting'),
  sort: 500,
  steps: {
    editOnlyOffice: {
      title: tExpr('Edit OnlyOffice'),
      uiSchema(ctx) {
        const t = ctx.t;
        const relationKeyFieldOptions = computeRelationKeyFieldOptions(ctx);
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
              placeholder: ONLYOFFICE_CALLBACK_ACTION,
            },
            description: t('If empty, the auto-generated callback URL will be used'),
          },
          relationKeyField: {
            title: t('File Reference Field'),
            type: 'string',
            'x-component': 'Select',
            'x-decorator': 'FormItem',
            required: true,
            'x-component-props': {
              placeholder: t('Select a belongsTo field targeting a file table'),
              options: relationKeyFieldOptions,
            },
            description: t('Updated with the edited file after OnlyOffice saves'),
          },
          preScript: {
            title: t('Pre-callback Script'),
            type: 'string',
            'x-decorator': 'FormItem',
            'x-component': 'Input.TextArea',
            'x-component-props': {
              rows: 4,
              placeholder:
                '// Runs before file save\n// Access: callbackBody, originalRecord, collectionName, recordId, relationKeyField',
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
              placeholder:
                '// Runs after file save\n// Access: callbackBody, originalRecord, collectionName, recordId, relationKeyField',
            },
            description: t('Simple JavaScript code executed after the callback is processed'),
          },
        };
      },
      async handler(ctx, params) {
        const { fileUrl, mode, title, documentServerUrl, callbackUrl, preScript, postScript, relationKeyField } =
          params;

        // 1. 更新 flow engine 内部状态（组件渲染用）
        ctx.model.setProps({
          fileUrl,
          mode,
          title,
          documentServerUrl,
          callbackUrl,
          preScript,
          postScript,
          relationKeyField,
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
