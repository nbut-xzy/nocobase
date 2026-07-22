/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'scopedSequenceRules',
  dataCategory: 'business',
  shared: true,
  fields: [
    { name: 'id', type: 'snowflakeId', primaryKey: true },
    { name: 'collectionName', type: 'string' },
    { name: 'fieldName', type: 'string' },
    { name: 'scopeValue', type: 'string' },
    { name: 'scopeLabel', type: 'string' },
    { name: 'patterns', type: 'json' },
    { name: 'inputable', type: 'boolean', defaultValue: false },
    { name: 'match', type: 'boolean', defaultValue: false },
    { name: 'enabled', type: 'boolean', defaultValue: true },
  ],
});
