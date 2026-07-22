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
  name: 'scopedSequenceFieldConfig',
  dataCategory: 'business',
  shared: true,
  fields: [
    { name: 'id', type: 'snowflakeId', primaryKey: true },
    { name: 'collectionName', type: 'string' },
    { name: 'fieldName', type: 'string' },
    { name: 'scopeField', type: 'string' },
    { name: 'scopeTargetCollection', type: 'string' },
  ],
});
