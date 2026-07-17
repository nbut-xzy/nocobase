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

export class PluginOnlyofficeServer extends Plugin {
  async afterAdd() {}

  async beforeLoad() {}

  async load() {
    await this.importCollections(path.resolve(__dirname, 'collections'));

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

    this.app.resourceManager.define({
      name: 'onlyoffice',
      actions: {
        async getKey(ctx, next) {
          const { fileUrl } = ctx.action?.params?.values || {};
          if (!fileUrl) {
            ctx.throw(400, 'fileUrl is required');
          }

          const repo = ctx.db.getRepository('onlyofficeDocumentKeys');
          let record = await repo.findOne({ filter: { fileUrl } });
          if (!record) {
            const newKey = crypto.randomUUID();
            record = await repo.create({ values: { fileUrl, docKey: newKey } });
          }

          ctx.body = { key: record.docKey };
          await next();
        },
      },
    });

    this.app.acl.allow('onlyoffice', 'getKey', 'loggedIn');
  }

  async install(options?: InstallOptions) {}

  async afterEnable() {}

  async afterDisable() {}

  async remove() {}
}

export default PluginOnlyofficeServer;
