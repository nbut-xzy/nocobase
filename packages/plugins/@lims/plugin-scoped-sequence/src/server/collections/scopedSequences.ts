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
  name: 'scopedSequences',
  dataCategory: 'system',
  shared: true,
  fields: [
    { name: 'id', type: 'snowflakeId', primaryKey: true },
    { name: 'collection', type: 'string' },
    { name: 'field', type: 'string' },
    { name: 'key', type: 'integer' },
    { name: 'scope', type: 'string' },
    { name: 'current', type: 'bigInt' },
    { name: 'lastGeneratedAt', type: 'date' },
  ],
});
