/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Plugin } from '@nocobase/client';
import { SubTableAutoSizeFieldModel } from '../client-v2/models/SubTableAutoSizeFieldModel';

export class PluginSubtableAutoSizeClient extends Plugin {
  async load() {
    this.flowEngine.registerModels({
      SubTableAutoSizeFieldModel,
    });
  }
}

export default PluginSubtableAutoSizeClient;
