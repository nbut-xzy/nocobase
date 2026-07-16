/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { SchemaComponentOptions } from '@nocobase/client';
import React from 'react';
import { OnlyOffice } from './OnlyOffice';
import { OnlyOfficeBlockInitializer } from './OnlyOfficeBlockInitializer';

export const OnlyOfficeBlockProvider = (props: any) => {
  return (
    <SchemaComponentOptions components={{ OnlyOffice, OnlyOfficeBlockInitializer }}>
      {props.children}
    </SchemaComponentOptions>
  );
};
