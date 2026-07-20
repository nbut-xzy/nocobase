/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Plugin } from '@nocobase/client';
import { OnlyOfficeBlockModel } from '../client-v2/models/OnlyOfficeBlockModel';
import OnlyOfficeSettingsPage from '../client-v2/pages/OnlyOfficeSettingsPage';

export class PluginOnlyofficeClient extends Plugin {
  async load() {
    this.flowEngine.registerModels({
      OnlyOfficeBlockModel,
    });

    this.pluginSettingsManager.add('onlyoffice', {
      title: this.t('OnlyOffice'),
      icon: 'FileTextOutlined',
      Component: OnlyOfficeSettingsPage,
      sort: -1,
    });
  }
}

export default PluginOnlyofficeClient;
