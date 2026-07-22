/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Plugin } from '@nocobase/client';

export class PluginScopedSequenceClient extends Plugin {
  async load() {
    // v1 thin compatibility layer: register settings page using v1 API
    // The actual page component lives in client-v2
    this.pluginSettingsManager.add('scoped-sequence', {
      title: this.t('Scoped Sequences'),
      icon: 'OrderedListOutlined',
      Component: () => null, // Page is registered via v2 pluginSettingsManager
    });
  }
}

export default PluginScopedSequenceClient;
