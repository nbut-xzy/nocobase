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

export class PluginOnlyofficeServer extends Plugin {
  async afterAdd() {}

  async beforeLoad() {}

  async load() {
    await this.importCollections(path.resolve(__dirname, 'collections'));

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

    this.app.acl.allow('onlyofficeSettings', 'get', 'loggedIn');

    // ---- onlyoffice resource (getKey + callback) ----

    this.app.resourceManager.define({
      name: 'onlyoffice',
      actions: {
        async getKey(ctx, next) {
          const { fileUrl, collectionName, recordId, preScript, postScript } = ctx.action?.params?.values || {};

          if (!fileUrl) {
            ctx.throw(400, ctx.t('fileUrl is required for key generation'));
            return;
          }

          // Validate file table if collectionName is provided
          if (collectionName) {
            const collection = ctx.db.getCollection(collectionName);
            if (!collection) {
              ctx.throw(400, ctx.t('File collection not found'));
              return;
            }
            if (collection.options.template !== 'file') {
              ctx.throw(400, ctx.t('Collection must be a file table (template: file)'));
              return;
            }
          }

          const repo = ctx.db.getRepository('onlyofficeDocumentKeys');
          let record = await repo.findOne({ filter: { fileUrl } });

          const updateValues: Record<string, any> = {};
          if (collectionName !== undefined) updateValues.collectionName = collectionName || null;
          if (recordId !== undefined) updateValues.recordId = recordId || null;
          if (preScript !== undefined) updateValues.preScript = preScript || null;
          if (postScript !== undefined) updateValues.postScript = postScript || null;

          if (record) {
            // Update block config on each getKey call (config may have changed)
            await repo.update({ values: updateValues, filter: { id: record.id } });
          } else {
            const newKey = crypto.randomUUID();
            await repo.create({ values: { fileUrl, docKey: newKey, ...updateValues } });
            record = await repo.findOne({ filter: { fileUrl } });
          }

          ctx.body = { key: record.docKey };
          await next();
        },

        async callback(ctx, next) {
          const plugin = ctx.app.pm.get('onlyoffice') as PluginOnlyofficeServer;

          try {
            // Step 0: JWT validation (if configured)
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
                const decoded = jwt.verify(token, jwtSecret);
                // OnlyOffice JWT payload structure: { payload: { key, status, ... } }
                // The decoded result can be used for cross-validation if needed.
                ctx.logger?.info?.('[OnlyOffice callback] JWT verified', { payload: decoded });
              } catch (err) {
                ctx.status = 401;
                ctx.body = { error: 1, message: 'JWT validation failed' };
                return;
              }
            }

            // Step 1: Parse request body
            const body = (ctx.request as any).body || {};
            const { key, status, url, changesurl } = body;

            if (!key) {
              ctx.body = { error: 1, message: 'key is required' };
              return;
            }

            // Step 2: Look up document key record
            const keysRepo = ctx.db.getRepository('onlyofficeDocumentKeys');
            const keyRecord = await keysRepo.findOne({ filter: { docKey: key } });

            if (!keyRecord) {
              ctx.logger?.warn?.(`[OnlyOffice callback] Document key not found: ${key}`);
              ctx.body = { error: 0 };
              return;
            }

            const { collectionName, recordId, preScript, postScript } = keyRecord;

            // Step 3: Validate collection and find file record
            let fileRecord = null;
            if (collectionName) {
              const collection = ctx.db.getCollection(collectionName);
              if (!collection || collection.options.template !== 'file') {
                ctx.logger?.warn?.(`[OnlyOffice callback] Invalid collection: ${collectionName}`);
              } else if (recordId) {
                const fileRepo = ctx.db.getRepository(collectionName);
                fileRecord = await fileRepo.findOne({ filter: { id: recordId } });
              }
            }

            // Step 4: Execute pre-script
            if (preScript) {
              try {
                runCallbackScript(preScript, {
                  callbackBody: body,
                  fileRecord: fileRecord?.toJSON?.() ?? fileRecord,
                  collectionName: collectionName || '',
                  recordId: recordId || null,
                });
              } catch (err: any) {
                ctx.logger?.error?.(`[OnlyOffice callback] preScript error: ${err.message}`);
              }
            }

            // Step 5: Handle status-based actions
            const shouldSave = (status === 2 || status === 6) && url;
            const shouldUpdateKey = status === 2;

            if (shouldSave && fileRecord && collectionName) {
              try {
                await plugin.saveFileFromCallback(ctx, url, fileRecord, collectionName);
                ctx.logger?.info?.(`[OnlyOffice callback] File saved for status=${status}, key=${key}`);
              } catch (err: any) {
                ctx.logger?.error?.(`[OnlyOffice callback] File save error: ${err.message}`);
              }
            }

            if (shouldUpdateKey) {
              const newKey = crypto.randomUUID();
              await keysRepo.update({
                values: { docKey: newKey },
                filter: { id: keyRecord.id },
              });
              ctx.logger?.info?.(
                `[OnlyOffice callback] Key updated for status=${status}, oldKey=${key}, newKey=${newKey}`,
              );
            }

            if (status === 3 || status === 7) {
              ctx.logger?.error?.(`[OnlyOffice callback] Error status=${status} received for key=${key}`, body);
            }

            // Step 6: Execute post-script
            if (postScript) {
              try {
                runCallbackScript(postScript, {
                  callbackBody: body,
                  fileRecord: fileRecord?.toJSON?.() ?? fileRecord,
                  collectionName: collectionName || '',
                  recordId: recordId || null,
                });
              } catch (err: any) {
                ctx.logger?.error?.(`[OnlyOffice callback] postScript error: ${err.message}`);
              }
            }
          } catch (err: any) {
            ctx.logger?.error?.(`[OnlyOffice callback] Unexpected error: ${err.message}`);
          }

          // Step 7: Always return {error: 0} to prevent OnlyOffice retry loops
          ctx.body = { error: 0 };
          await next();
        },
      },
    });

    this.app.acl.allow('onlyoffice', 'getKey', 'loggedIn');
    this.app.acl.allow('onlyoffice', 'callback');
  }

  /**
   * Download edited file from OnlyOffice callback URL and save to storage.
   * Does NOT overwrite the original file — uploads a new file and updates
   * the existing record's metadata to point to the new file.
   */
  async saveFileFromCallback(ctx: any, downloadUrl: string, fileRecord: any, collectionName: string) {
    const fileManagerPlugin = this.app.pm.get('file-manager') as any;
    if (!fileManagerPlugin?.uploadFile) {
      throw new Error('[OnlyOffice] file-manager plugin not available');
    }

    // 1. Download the edited file from OnlyOffice callback URL
    const response = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
    });
    const contentType = response.headers['content-type'] || fileRecord.mimetype || 'application/octet-stream';

    const tempFilePath = path.join(
      os.tmpdir(),
      `onlyoffice-callback-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await fs.writeFile(tempFilePath, response.data as Buffer);

    try {
      // 2. Get storage name and subPath from the original record
      const storageName = fileRecord.storageId
        ? undefined // will be resolved from storageId
        : undefined;

      // Resolve storage by the file record's storageId
      let storageNameResolved: string | undefined;
      if (fileRecord.storageId) {
        const storagesRepo = ctx.db.getRepository('storages');
        const storage = await storagesRepo.findOne({
          filter: { id: fileRecord.storageId },
        });
        storageNameResolved = storage?.name;
      }

      // 3. Upload new file to the same storage
      const fileData = await fileManagerPlugin.uploadFile({
        storageName: storageNameResolved,
        filePath: tempFilePath,
      });

      // 4. Update the existing file record with new file metadata
      const fileRepo = ctx.db.getRepository(collectionName);
      await fileRepo.update({
        values: {
          filename: fileData.filename,
          path: fileData.path,
          size: fileData.size,
          mimetype: fileData.mimetype || contentType,
          meta: {
            ...(fileRecord.meta || {}),
            onlyofficeLastSaved: new Date().toISOString(),
          },
        },
        filter: { id: fileRecord.id },
      });

      // Note: url field is auto-computed by the file-manager's afterFind hook.
      // The original physical file remains in storage (not deleted).
    } finally {
      // 5. Clean up temp file
      await fs.rm(tempFilePath, { force: true });
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
