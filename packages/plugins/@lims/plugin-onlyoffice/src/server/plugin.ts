/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { InstallOptions, Plugin } from '@nocobase/server';
import path from 'path';
import fs from 'node:fs/promises';
import os from 'node:os';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { runCallbackScript } from './callbackScriptRunner';

/**
 * 从请求上下文获取完整的 origin（scheme + host + port）。
 * 优先取反向代理头（x-forwarded-proto / x-forwarded-host），
 * 兼容 Koa 原生的 ctx.protocol / ctx.host。
 */
function getRequestOrigin(ctx: any): string {
  const protocol = ctx.headers?.['x-forwarded-proto'] || ctx.protocol || ctx.request?.protocol || 'http';
  const host = ctx.headers?.['x-forwarded-host'] || ctx.host || ctx.request?.host || '';
  return host ? `${protocol}://${host}` : '';
}

/**
 * 将相对 URL 补全为带 origin 的完整 URL。
 */
function resolveFullUrl(fileUrl: string, ctx: any): string {
  if (!fileUrl || /^https?:\/\//i.test(fileUrl)) {
    return fileUrl;
  }
  const origin = getRequestOrigin(ctx);
  if (!origin) {
    return fileUrl;
  }
  return fileUrl.startsWith('/') ? `${origin}${fileUrl}` : `${origin}/${fileUrl}`;
}

export class PluginOnlyofficeServer extends Plugin {
  async afterAdd() {}

  async beforeLoad() {}

  async load() {
    // ---- onlyofficeSettings resource (singleton get/set) ----

    this.app.resourceManager.define({
      name: 'onlyofficeSettings',
      actions: {
        async get(ctx, next) {
          const repo = ctx.db.getRepository('onlyofficeSettings');
          const record = await repo.findOne();
          ctx.body = record?.toJSON() ?? {};
          await next();
        },
        async set(ctx, next) {
          const repo = ctx.db.getRepository('onlyofficeSettings');
          const values = ctx.action?.params?.values;
          const existing = await repo.findOne();
          if (existing) {
            await repo.update({ values, filter: { id: existing.id } });
          } else {
            await repo.create({ values });
          }
          ctx.body = { ok: true };
          await next();
        },
      },
    });

    this.app.acl.registerSnippet({
      name: 'pm.onlyoffice.configuration',
      actions: ['onlyofficeSettings:*'],
    });

    // ---- onlyoffice resource (getKey + bind + callback) ----

    const plugin = this;

    this.app.resourceManager.define({
      name: 'onlyoffice',
      actions: {
        async getKey(ctx, next) {
          const { fileUrl: rawFileUrl } = ctx.action?.params?.values || {};

          if (!rawFileUrl) {
            ctx.throw(400, ctx.t('fileUrl is required for key generation'));
            return;
          }

          const fileUrl = resolveFullUrl(rawFileUrl, ctx);
          const lockKey = `onlyoffice:${fileUrl}`;

          ctx.logger?.info?.(`[OnlyOffice getKey] Acquiring lock for fileUrl=${fileUrl}`);
          const result = await plugin.app.lockManager.runExclusive(
            lockKey,
            async () => {
              ctx.logger?.info?.(`[OnlyOffice getKey] Inside lock, fileUrl=${fileUrl}`);
              const repo = ctx.db.getRepository('onlyofficeDocumentKeys');
              const record = await repo.findOne({ filter: { fileUrl } });
              ctx.logger?.info?.(
                `[OnlyOffice getKey] findOne result: record=${JSON.stringify(
                  record?.toJSON?.() ?? record,
                )}, exists=${!!record}`,
              );

              if (record) {
                return {
                  key: record.docKey,
                  fileUrl,
                  uiSchemaBlockUid: record.uiSchemaBlockUid,
                  recordId: record.recordId,
                };
              }
              return null;
            },
            10000,
          );
          ctx.logger?.info?.(`[OnlyOffice getKey] Lock resolved: ${JSON.stringify(result)}`);

          ctx.body = result;
          await next();
        },

        async bind(ctx, next) {
          const { fileUrl, uiSchemaBlockUid, recordId, collectionName } = ctx.action?.params?.values || {};
          ctx.logger?.info?.(
            `[OnlyOffice bind] fileUrl=${fileUrl}, uiSchemaBlockUid=${uiSchemaBlockUid}, recordId=${recordId}, collectionName=${collectionName}`,
          );

          if (!fileUrl || !uiSchemaBlockUid) {
            ctx.throw(400, ctx.t('fileUrl and uiSchemaBlockUid are required'));
            return;
          }

          const lockKey = `onlyoffice:${fileUrl}`;
          ctx.logger?.info?.(`[OnlyOffice bind] Acquiring lock for fileUrl=${fileUrl}`);
          let result;
          try {
            result = await plugin.app.lockManager.runExclusive(
              lockKey,
              async () => {
                ctx.logger?.info?.(
                  `[OnlyOffice bind] Inside lock, fileUrl=${fileUrl}, uiSchemaBlockUid=${uiSchemaBlockUid}, recordId=${recordId}, collectionName=${collectionName}`,
                );
                const repo = ctx.db.getRepository('onlyofficeDocumentKeys');
                ctx.logger?.info?.(`[OnlyOffice bind] About to findOne for fileUrl=${fileUrl}`);
                let record = await repo.findOne({ filter: { fileUrl } });
                ctx.logger?.info?.(
                  `[OnlyOffice bind] findOne result: record=${JSON.stringify(
                    record?.toJSON?.() ?? record,
                  )}, exists=${!!record}`,
                );

                if (record) {
                  ctx.logger?.info?.(
                    `[OnlyOffice bind] Existing record found: docKey=${record.docKey}, uiSchemaBlockUid=${record.uiSchemaBlockUid}, comparing with input uiSchemaBlockUid=${uiSchemaBlockUid}`,
                  );
                  // 如果已有绑定记录，检查 uiSchemaBlockUid 是否一致
                  if (record.uiSchemaBlockUid !== uiSchemaBlockUid) {
                    ctx.logger?.warn?.(
                      `[OnlyOffice bind] Block mismatch: existing=${record.uiSchemaBlockUid} !== input=${uiSchemaBlockUid}, throwing 409`,
                    );
                    ctx.throw(409, ctx.t('fileUrl is already bound to a different block'));
                    return;
                  }
                  ctx.logger?.info?.(`[OnlyOffice bind] Block matched, returning existing record key=${record.docKey}`);
                } else {
                  ctx.logger?.info?.(`[OnlyOffice bind] No existing record, creating new key for fileUrl=${fileUrl}`);
                  const newKey = crypto.randomUUID();
                  ctx.logger?.info?.(`[OnlyOffice bind] Generated newKey=${newKey}, about to create record`);
                  await repo.create({
                    values: { fileUrl, docKey: newKey, uiSchemaBlockUid, collectionName, recordId },
                  });
                  ctx.logger?.info?.(`[OnlyOffice bind] Record created, re-fetching to confirm`);
                  record = await repo.findOne({ filter: { fileUrl } });
                  ctx.logger?.info?.(
                    `[OnlyOffice bind] Re-fetch result: record=${JSON.stringify(
                      record?.toJSON?.() ?? record,
                    )}, docKey=${record?.docKey}`,
                  );
                }

                const returnValue = { key: record.docKey, fileUrl, uiSchemaBlockUid: record.uiSchemaBlockUid };
                ctx.logger?.info?.(`[OnlyOffice bind] Returning from lock callback: ${JSON.stringify(returnValue)}`);
                return returnValue;
              },
              10000,
            );
            ctx.logger?.info?.(`[OnlyOffice bind] Lock resolved: ${JSON.stringify(result)}`);
          } catch (err: any) {
            ctx.logger?.error?.(`[OnlyOffice bind] Lock failed: ${err.message}`, {
              stack: err.stack,
              fileUrl,
              uiSchemaBlockUid,
              recordId,
              collectionName,
            });
            throw err;
          }

          ctx.body = result;
          await next();
        },

        async callback(ctx, next) {
          ctx.withoutDataWrapping = true;
          try {
            // Step 0: JWT 鉴权（若配置）
            const settingsRepo = ctx.db.getRepository('onlyofficeSettings');
            const settings = await settingsRepo.findOne();
            const jwtSecret = settings?.jwtSecret;

            if (jwtSecret) {
              const authHeader = ctx.request.headers.authorization;
              if (!authHeader || !authHeader.startsWith('Bearer ')) {
                ctx.status = 401;
                ctx.body = { error: 1, message: 'JWT validation failed: missing authorization header' };
                return;
              }
              const token = authHeader.slice(7);
              try {
                jwt.verify(token, jwtSecret);
              } catch {
                ctx.status = 401;
                ctx.body = { error: 1, message: 'JWT validation failed' };
                return;
              }
            }

            // Step 1: 解析请求体
            const body = (ctx.request as any).body || {};
            const { key, status, url } = body;

            if (!key) {
              ctx.body = { error: 1, message: 'key is required' };
              return;
            }

            // Step 2: 通过 docKey 查找绑定记录
            const keysRepo = ctx.db.getRepository('onlyofficeDocumentKeys');
            const keyRecord = await keysRepo.findOne({ filter: { docKey: key } });

            if (!keyRecord) {
              ctx.logger?.warn?.(`[OnlyOffice callback] Document key not found: ${key}`);
              ctx.body = { error: 0 };
              return;
            }

            const { fileUrl, uiSchemaBlockUid, collectionName, recordId } = keyRecord;

            // Step 3: 从 flowModels 读取回调配置（v2 区块配置存储在 flowModels 的 stepParams 中）
            const flowModelsRepo = ctx.db.getRepository('flowModels');
            const flowModel = await flowModelsRepo.findOne({ filterByTk: uiSchemaBlockUid });
            const blockOptions = flowModel?.options || {};
            const onlyofficeSettings = blockOptions?.stepParams?.onlyofficeBlockSettings?.editOnlyOffice || {};
            const { preScript, postScript, relationKeyField } = onlyofficeSettings;

            // Step 4: 查询原始记录
            let originalRecord = null;
            if (collectionName && recordId) {
              const collection = ctx.db.getCollection(collectionName);
              if (collection) {
                const recordRepo = ctx.db.getRepository(collectionName);
                originalRecord = await recordRepo.findOne({ filterByTk: recordId });
              }
            }

            // Step 5: 执行 preScript
            if (preScript) {
              try {
                runCallbackScript(preScript, {
                  callbackBody: body,
                  originalRecord: originalRecord?.toJSON?.() ?? originalRecord,
                  collectionName: collectionName || '',
                  recordId: recordId || null,
                  relationKeyField: relationKeyField || null,
                });
              } catch (err: any) {
                ctx.logger?.error?.(`[OnlyOffice callback] preScript error: ${err.message}`);
              }
            }

            // Step 6: 保存文件并更新原始记录（status=2 表示保存完成）
            if (status === 2 && url) {
              if (relationKeyField && collectionName && recordId && originalRecord) {
                try {
                  await plugin.saveFileAndUpdateRecord(
                    ctx,
                    url,
                    collectionName,
                    recordId,
                    relationKeyField,
                    originalRecord,
                  );
                  ctx.logger?.info?.(`[OnlyOffice callback] File saved for key=${key}`);
                } catch (err: any) {
                  ctx.logger?.error?.(`[OnlyOffice callback] File save error: ${err.message}`);
                }
              }

              // 删除绑定记录（下次 getKey 返回 null，自然触发重新 bind）
              await keysRepo.destroy({ filter: { id: keyRecord.id } });
              ctx.logger?.info?.(`[OnlyOffice callback] Bind record deleted for key=${key}`);
            }

            if (status === 3 || status === 7) {
              ctx.logger?.error?.(`[OnlyOffice callback] Error status=${status} received for key=${key}`, body);
            }

            // Step 7: 执行 postScript
            if (postScript) {
              try {
                runCallbackScript(postScript, {
                  callbackBody: body,
                  originalRecord: originalRecord?.toJSON?.() ?? originalRecord,
                  collectionName: collectionName || '',
                  recordId: recordId || null,
                  relationKeyField: relationKeyField || null,
                });
              } catch (err: any) {
                ctx.logger?.error?.(`[OnlyOffice callback] postScript error: ${err.message}`);
              }
            }
          } catch (err: any) {
            ctx.logger?.error?.(`[OnlyOffice callback] Unexpected error: ${err.message}`);
          }

          // Step 8: 始终返回 {error: 0}，防止 OnlyOffice 重试循环
          ctx.body = { error: 0 };
          await next();
        },
      },
    });

    this.app.acl.allow('onlyoffice', 'getKey', 'loggedIn');
    this.app.acl.allow('onlyoffice', 'bind', 'loggedIn');
    this.app.acl.allow('onlyoffice', 'callback');
  }

  /**
   * 从 OnlyOffice 回调 URL 下载编辑后的文件，在目标文件表中创建新记录，
   * 并将原始记录的文件引用字段指向新文件记录。
   */
  async saveFileAndUpdateRecord(
    ctx: any,
    downloadUrl: string,
    collectionName: string,
    recordId: number | string,
    relationKeyField: string,
    originalRecord: any,
  ) {
    const fileManagerPlugin = this.app.pm.get('file-manager') as any;
    if (!fileManagerPlugin?.createFileRecord) {
      throw new Error('[OnlyOffice] file-manager plugin not available');
    }

    // Step 1: 解析 relationKeyField → 找到目标文件表
    const fieldsRepo = ctx.db.getRepository('fields');
    const fieldRecord = await fieldsRepo.findOne({
      filter: { collectionName, name: relationKeyField },
    });
    if (!fieldRecord) {
      throw new Error(`[OnlyOffice] Field "${relationKeyField}" not found in collection "${collectionName}"`);
    }

    const targetField = ctx.db.getCollection(collectionName).getField(relationKeyField);
    const targetCollectionName = targetField?.options?.target || fieldRecord?.options?.target;
    if (!targetCollectionName) {
      throw new Error(`[OnlyOffice] No target collection for field "${relationKeyField}"`);
    }

    const targetCollection = ctx.db.getCollection(targetCollectionName);
    if (!targetCollection || targetCollection.options.template !== 'file') {
      throw new Error(`[OnlyOffice] Target collection "${targetCollectionName}" must be a file table (template: file)`);
    }

    // Step 2: 从原始记录中获取关联的原文件 title 和 extname，用于新文件命名
    let originalTitle = '';
    let originalExt = '';
    try {
      const originalFileId = originalRecord?.[targetField.options?.foreignKey];
      if (originalFileId) {
        const targetRepo = ctx.db.getRepository(targetCollectionName);
        const originalFile = await targetRepo.findOne({ filterByTk: originalFileId });
        originalTitle = originalFile?.title || '';
        originalExt = originalFile?.extname || '';
        ctx.logger?.info?.(
          `[OnlyOffice callback] Original file: title="${originalTitle}", ext="${originalExt}", id=${originalFileId}`,
        );
      }
    } catch (err: any) {
      ctx.logger?.warn?.(`[OnlyOffice callback] Failed to fetch original file info: ${err.message}`);
    }

    // Step 3: 下载编辑后的文件，在唯一临时目录中用原始文件名保存
    const response = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
    });

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'onlyoffice-callback-'));
    const tempFileName = originalExt ? `${originalTitle || 'document'}${originalExt}` : originalTitle || 'document';
    const tempFilePath = path.join(tempDir, tempFileName);
    await fs.writeFile(tempFilePath, new Uint8Array(response.data as ArrayBuffer));

    try {
      // Step 4: 在目标文件表中创建新文件记录（originalname 取自 tempFilePath，自动推导 title/filename）
      const newFileRecord = await fileManagerPlugin.createFileRecord({
        collectionName: targetCollectionName,
        filePath: tempFilePath,
      });

      // Step 5: 更新原始记录的文件引用字段
      const originalRepo = ctx.db.getRepository(collectionName);
      await originalRepo.update({
        values: { [relationKeyField]: newFileRecord.id },
        filter: { id: recordId },
      });
    } finally {
      // Step 6: 清理临时目录
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  async install(options?: InstallOptions) {}

  async afterEnable() {}

  async afterDisable() {}

  async beforeRemove() {
    const collectionNames = ['onlyofficeSettings', 'onlyofficeDocumentKeys'];
    for (const name of collectionNames) {
      const collection = this.db.getCollection(name);
      if (collection) {
        await collection.removeFromDb();
      }
    }
  }

  async remove() {}
}

export default PluginOnlyofficeServer;
