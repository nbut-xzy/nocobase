/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { randomInt } from 'crypto';
import path from 'path';
import { promisify } from 'util';

import { Plugin } from '@nocobase/server';
import { ScopedSequenceField } from './fields/scoped-sequence-field';

const asyncRandomInt = promisify(randomInt);

export class PluginScopedSequenceServer extends Plugin {
  async beforeLoad() {
    // Register the field type
    this.db.registerFieldTypes({
      scopedSequence: ScopedSequenceField,
    });

    // Import system collections
    await this.importCollections(path.resolve(__dirname, 'collections'));
  }

  async load() {
    // ---- Counter key generation on field save ----
    this.db.on('fields.beforeSave', async (field, { transaction }) => {
      if (field.get('type') !== 'scopedSequence') {
        return;
      }
      // scopedSequence fields don't store patterns on the field itself,
      // so we don't need to seed counter rows here. Counters are created
      // lazily on first use in the integer pattern's generate().
    });

    // ---- Cleanup counters and config on field destroy ----
    this.db.on('fields.afterDestroy', async (field, { transaction }) => {
      if (field.get('type') !== 'scopedSequence') {
        return;
      }

      const collectionName = field.get('collectionName');
      const fieldName = field.get('name');

      // Clean up sequence counters
      const sequencesRepo = this.db.getRepository('scopedSequences');
      await sequencesRepo.destroy({
        filter: {
          collection: collectionName,
          field: fieldName,
        },
        transaction,
      });

      // Clean up field config
      const configRepo = this.db.getRepository('scopedSequenceFieldConfig');
      await configRepo.destroy({
        filter: {
          collectionName,
          fieldName,
        },
        transaction,
      });

      // Clean up rules
      const rulesRepo = this.db.getRepository('scopedSequenceRules');
      await rulesRepo.destroy({
        filter: {
          collectionName,
          fieldName,
        },
        transaction,
      });
    });

    // ---- Resource: scopedSequenceFieldConfig ----
    this.app.resourceManager.define({
      name: 'scopedSequenceFieldConfig',
      actions: {
        async get(ctx, next) {
          const { collectionName, fieldName } = ctx.action.params;
          const repo = ctx.db.getRepository('scopedSequenceFieldConfig');
          const record = await repo.findOne({
            filter: { collectionName, fieldName },
          });
          ctx.body = record?.toJSON() ?? null;
          await next();
        },
        async set(ctx, next) {
          const { collectionName, fieldName, scopeField, scopeTargetCollection } =
            ctx.action.params.values || ctx.action.params;
          const repo = ctx.db.getRepository('scopedSequenceFieldConfig');
          const existing = await repo.findOne({
            filter: { collectionName, fieldName },
          });
          if (existing) {
            await repo.update({
              values: { scopeField, scopeTargetCollection },
              filter: { id: existing.id },
            });
          } else {
            await repo.create({
              values: { collectionName, fieldName, scopeField, scopeTargetCollection },
            });
          }
          ctx.body = { ok: true };
          await next();
        },
      },
    });

    // ---- Resource: scopedSequenceRules ----
    this.app.resourceManager.define({
      name: 'scopedSequenceRules',
      actions: {
        async list(ctx, next) {
          const { collectionName, fieldName } = ctx.action.params;
          const repo = ctx.db.getRepository('scopedSequenceRules');
          const records = await repo.find({
            filter: { collectionName, fieldName },
          });
          ctx.body = records;
          await next();
        },
        async create(ctx, next) {
          const repo = ctx.db.getRepository('scopedSequenceRules');
          const values = ctx.action.params.values;
          const instance = await repo.create({ values });
          ctx.body = instance;
          await next();
        },
        async update(ctx, next) {
          const repo = ctx.db.getRepository('scopedSequenceRules');
          const { filterByTk, values } = ctx.action.params;
          const instance = await repo.update({
            values,
            filter: { id: filterByTk },
          });
          ctx.body = instance;
          await next();
        },
        async destroy(ctx, next) {
          const repo = ctx.db.getRepository('scopedSequenceRules');
          const { filterByTk } = ctx.action.params;
          await repo.destroy({
            filter: { id: filterByTk },
          });
          ctx.body = { ok: true };
          await next();
        },
      },
    });

    // ---- ACL ----
    // Public read access for logged-in users
    this.app.acl.allow('scopedSequenceFieldConfig', 'get', 'loggedIn');
    this.app.acl.allow('scopedSequenceRules', ['list', 'get'], 'loggedIn');
    // create/update/destroy/set default to admin-only (no explicit allow)
  }

  async install() {}
}

export default PluginScopedSequenceServer;
