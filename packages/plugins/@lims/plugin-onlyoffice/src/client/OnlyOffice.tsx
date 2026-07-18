/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DocumentEditor } from '@onlyoffice/document-editor-react';
import { observer, useField, useFieldSchema } from '@formily/react';
import { useAPIClient, useBlockHeight, useCollectionRecordData } from '@nocobase/client';
import { useFlowContext } from '@nocobase/flow-engine';
import { Card, Spin, message } from 'antd';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ONLYOFFICE_CALLBACK_ACTION, resolveDocType } from '../constants';

export const OnlyOffice: any = observer(
  (props: any) => {
    const field = useField();
    const fieldSchema = useFieldSchema();
    const { t } = useTranslation();
    const api = useAPIClient();
    const height = useBlockHeight();
    const ctx = useFlowContext();
    const componentProps = { ...props, ...(field.componentProps || {}) };
    const {
      fileUrl,
      mode = 'edit',
      title: docTitle,
      documentServerUrl,
      callbackUrl,
      lang,
      preScript,
      postScript,
      relationKeyField,
    } = componentProps;

    const [globalSettings, setGlobalSettings] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [resolvedFileUrl, setResolvedFileUrl] = useState('');
    const [resolvedCbUrl, setResolvedCbUrl] = useState('');
    const [resolving, setResolving] = useState(true);
    const [docKey, setDocKey] = useState('');

    const collectionRecordData = useCollectionRecordData();
    const record = ctx.record || collectionRecordData;

    useEffect(() => {
      let active = true;
      async function resolveTemplates() {
        const apiOrigin = (() => {
          try {
            return new URL(api.axios.defaults.baseURL).origin;
          } catch {
            return '';
          }
        })();
        const toAbsolute = (u: string) => {
          if (!u || /^https?:\/\//i.test(u) || !apiOrigin) return u;
          return u.startsWith('/') ? `${apiOrigin}${u}` : `${apiOrigin}/${u}`;
        };
        try {
          const rawUrl = fileUrl || record?.url || '';
          const urlResolved =
            typeof rawUrl === 'string' ? await ctx.liquid.renderWithFullContext(rawUrl, ctx) : rawUrl || '';
          const cbRaw = callbackUrl || `${api.axios.defaults.baseURL}${ONLYOFFICE_CALLBACK_ACTION}`;
          const cbResolved =
            typeof cbRaw === 'string' ? await ctx.liquid.renderWithFullContext(cbRaw, ctx) : cbRaw || '';
          if (active) {
            setResolvedFileUrl(toAbsolute(urlResolved || ''));
            setResolvedCbUrl(cbResolved || '');
          }
        } catch {
          if (active) {
            setResolvedFileUrl(toAbsolute(fileUrl || ''));
            setResolvedCbUrl(callbackUrl || `${api.axios.defaults.baseURL}${ONLYOFFICE_CALLBACK_ACTION}`);
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
    }, [fileUrl, callbackUrl, ctx]);

    // 打开文档：getKey → 冲突检测 → bind（如需要）
    useEffect(() => {
      if (!resolvedFileUrl) return;
      let active = true;

      async function openDocument() {
        try {
          const decoratorProps = fieldSchema['x-decorator-props'] || {};
          const collectionName = (ctx as any).collection?.name || decoratorProps.collection || null;
          const blockUid = fieldSchema['x-uid'];

          // Step 1: 查询是否已有 key
          const getKeyRes: any = await api.request({
            url: 'onlyoffice:getKey',
            method: 'post',
            data: { fileUrl: resolvedFileUrl },
          });
          const data = getKeyRes?.data?.data;

          if (data && data.key) {
            // 已存在 — 检查是否属于当前区块
            if (data.uiSchemaBlockUid && data.uiSchemaBlockUid !== blockUid) {
              message.error(t('File is being edited in another block'));
              return;
            }
            // 同一区块，直接使用已有 key
            if (active) {
              setDocKey(data.key);
            }
          } else {
            // 不存在 — 创建绑定
            const bindRes: any = await api.request({
              url: 'onlyoffice:bind',
              method: 'post',
              data: {
                fileUrl: resolvedFileUrl,
                uiSchemaBlockUid: blockUid,
                recordId: record?.id || null,
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

    const { documentType: resolvedDocType, fileType: resolvedFileType } = resolveDocType(resolvedFileUrl);

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
