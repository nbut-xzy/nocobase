/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Plugin } from '@nocobase/client';
import { OnlyOfficeBlockProvider } from './OnlyOfficeBlockProvider';
import { onlyofficeBlockSchemaSettings } from './schemaSettings';
import { OnlyOfficeBlockModel } from '../client-v2/models/OnlyOfficeBlockModel';
import OnlyOfficeSettingsPage from './pages/OnlyOfficeSettingsPage';

export class PluginOnlyofficeClient extends Plugin {
  async load() {
    this.app.schemaSettingsManager.add(onlyofficeBlockSchemaSettings);
    this.app.use(OnlyOfficeBlockProvider);

    const blockInitializers = this.app.schemaInitializerManager.get('page:addBlock');
    blockInitializers?.add('otherBlocks.onlyoffice', {
      title: '{{t("OnlyOffice")}}',
      Component: 'OnlyOfficeBlockInitializer',
    });

    const createFormBlockInitializers = this.app.schemaInitializerManager.get('popup:addNew:addBlock');
    createFormBlockInitializers?.add('otherBlocks.onlyoffice', {
      title: '{{t("OnlyOffice")}}',
      Component: 'OnlyOfficeBlockInitializer',
    });

    const recordBlockInitializers = this.app.schemaInitializerManager.get('popup:common:addBlock');
    recordBlockInitializers?.add('otherBlocks.onlyoffice', {
      title: '{{t("OnlyOffice")}}',
      Component: 'OnlyOfficeBlockInitializer',
    });

    const recordFormBlockInitializers = this.app.schemaInitializerManager.get('RecordFormBlockInitializers');
    recordFormBlockInitializers?.add('otherBlocks.onlyoffice', {
      title: '{{t("OnlyOffice")}}',
      Component: 'OnlyOfficeBlockInitializer',
    });

    this.app.schemaInitializerManager.addItem('mobilePage:addBlock', 'otherBlocks.onlyoffice', {
      title: '{{t("OnlyOffice")}}',
      Component: 'OnlyOfficeBlockInitializer',
    });

    this.app.schemaInitializerManager.addItem('mobile:addBlock', 'otherBlocks.onlyoffice', {
      title: '{{t("OnlyOffice")}}',
      Component: 'OnlyOfficeBlockInitializer',
    });

    this.flowEngine.registerModels({
      OnlyOfficeBlockModel,
    });

    this.pluginSettingsManager.add('onlyoffice', {
      title: this.t('OnlyOffice'),
      icon: 'FileTextOutlined',
      Component: OnlyOfficeSettingsPage,
    });
  }
}

export default PluginOnlyofficeClient;
