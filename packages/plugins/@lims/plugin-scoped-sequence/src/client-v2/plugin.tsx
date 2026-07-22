/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Application, Plugin } from '@nocobase/client-v2';
import { ScopedSequenceFieldInterface } from './interface';

export class PluginScopedSequenceClientV2 extends Plugin<any, Application> {
  async load() {
    this.app.addFieldInterfaces([ScopedSequenceFieldInterface]);

    this.pluginSettingsManager.addMenuItem({
      key: 'scoped-sequence',
      title: this.t('Scoped Sequences') as unknown as string,
      icon: 'OrderedListOutlined',
    });

    this.pluginSettingsManager.addPageTabItem({
      menuKey: 'scoped-sequence',
      key: 'rules',
      title: this.t('Encoding Rules') as unknown as string,
      componentLoader: () => import('./pages/ScopedSequenceRulesPage'),
      aclSnippet: 'pm',
    });
  }
}

export default PluginScopedSequenceClientV2;
