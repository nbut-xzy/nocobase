/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useFieldSchema } from '@formily/react';
import { useParamsFromRecord, useCollectionRecordData, useCollectionParentRecordData } from '@nocobase/client';

/**
 * Dynamic decorator props hook for OnlyOfficeBlockProvider.
 *
 * Computes filterByTk from the current record and resolves the parent record
 * for popup scenarios. This enables the "当前记录" (Current Record) data scope
 * option when the block is placed inside a popup.
 *
 * Follows the same pattern as useDetailsDecoratorProps.
 */
export function useOnlyOfficeDecoratorProps(props: any) {
  const params = useParamsFromRecord(props);

  const fieldSchema = useFieldSchema();
  const recordData = useCollectionRecordData();
  const parentRecordData = useCollectionParentRecordData();

  let parentRecord;

  if (props.association) {
    // Resolve parent record respecting x-is-current flag (the "当前记录" option)
    if (fieldSchema['x-is-current']) {
      parentRecord = parentRecordData;
    } else {
      parentRecord = recordData;
    }
  }

  return { params, parentRecord };
}
