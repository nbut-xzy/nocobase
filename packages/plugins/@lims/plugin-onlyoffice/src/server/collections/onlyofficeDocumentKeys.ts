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
  name: 'onlyofficeDocumentKeys',
  title: 'OnlyOffice Document Keys',
  dataCategory: 'system',
  migrationRules: ['overwrite', 'schema-only'],
  shared: true,
  createdBy: true,
  updatedBy: true,
  indexes: [
    { type: 'UNIQUE', fields: ['fileUrl'] },
    { type: 'UNIQUE', fields: ['docKey'] },
  ],
  fields: [
    { type: 'uid', name: 'id', primaryKey: true },
    { type: 'string', name: 'fileUrl', unique: true, title: 'File URL' },
    { type: 'string', name: 'docKey', unique: true, title: 'Document Key' },
    { type: 'string', name: 'uiSchemaBlockUid', title: 'UI Schema Block UID' },
    { type: 'string', name: 'collectionName', title: 'Record Collection Name' },
    { type: 'bigInt', name: 'recordId', title: 'Record ID' },
  ],
});
