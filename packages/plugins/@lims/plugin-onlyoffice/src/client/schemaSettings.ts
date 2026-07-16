/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ISchema, useField, useFieldSchema } from '@formily/react';
import {
  SchemaSettings,
  SchemaSettingsBlockHeightItem,
  SchemaSettingsLinkageRules,
  LinkageRuleCategory,
  useDesignable,
} from '@nocobase/client';
import React from 'react';
import { useTranslation } from 'react-i18next';

const commonOptions: any = {
  items: [
    {
      name: 'editOnlyOffice',
      type: 'modal',
      useComponentProps() {
        const field = useField();
        const fieldSchema = useFieldSchema();
        const { t } = useTranslation();
        const { dn } = useDesignable();
        const componentProps = fieldSchema['x-component-props'] || {};

        const submitHandler = async (values: any) => {
          const props = fieldSchema['x-component-props'] || {};
          props.fileUrl = values.fileUrl;
          props.mode = values.mode;
          props.title = values.title || undefined;
          props.fileKey = values.fileKey || undefined;
          props.documentServerUrl = values.documentServerUrl || undefined;
          props.callbackUrl = values.callbackUrl || undefined;
          fieldSchema['x-component-props'] = props;
          field.componentProps = { ...props };
          dn.emit('patch', {
            schema: {
              'x-uid': fieldSchema['x-uid'],
              'x-component-props': props,
            },
          });
        };

        return {
          title: t('Edit OnlyOffice'),
          asyncGetInitialValues: async () => {
            return {
              fileUrl: componentProps.fileUrl || '',
              mode: componentProps.mode || 'edit',
              title: componentProps.title || '',
              fileKey: componentProps.fileKey || '',
              documentServerUrl: componentProps.documentServerUrl || '',
              callbackUrl: componentProps.callbackUrl || '',
            };
          },
          schema: {
            type: 'object',
            title: t('Edit OnlyOffice'),
            properties: {
              fileUrl: {
                title: t('File URL'),
                type: 'string',
                'x-decorator': 'FormItem',
                'x-component': 'Input',
                required: true,
                description: t('Where the OnlyOffice server can download the document file'),
              },
              mode: {
                title: t('Mode'),
                'x-component': 'Radio.Group',
                'x-decorator': 'FormItem',
                required: true,
                default: 'edit',
                enum: [
                  { value: 'edit', label: t('Edit') },
                  { value: 'view', label: t('View') },
                ],
              },
              title: {
                title: t('Document Title'),
                type: 'string',
                'x-decorator': 'FormItem',
                'x-component': 'Input',
              },
              fileKey: {
                title: t('File Key'),
                type: 'string',
                'x-decorator': 'FormItem',
                'x-component': 'Input',
                description: t('Optional unique key for identifying the document'),
              },
              documentServerUrl: {
                title: t('Document Server URL (optional)'),
                type: 'string',
                'x-decorator': 'FormItem',
                'x-component': 'Input',
                description: t('If empty, the global default will be used'),
              },
              callbackUrl: {
                title: t('Callback URL (optional)'),
                type: 'string',
                'x-decorator': 'FormItem',
                'x-component': 'Input',
                description: t('If empty, the global default will be used'),
              },
            },
          } as ISchema,
          onSubmit: submitHandler,
          noRecord: true,
          width: 600,
        };
      },
    },
    {
      name: 'setTheBlockHeight',
      Component: SchemaSettingsBlockHeightItem,
    },
    {
      name: 'blockLinkageRules',
      Component: SchemaSettingsLinkageRules,
      useComponentProps() {
        const { t } = useTranslation();
        return {
          title: t('Block Linkage rules'),
          category: LinkageRuleCategory.block,
        };
      },
    },
    {
      name: 'divider',
      type: 'divider',
    },
    {
      name: 'delete',
      type: 'remove',
      useComponentProps() {
        return {
          removeParentsIfNoChildren: true,
          breakRemoveOn: {
            'x-component': 'Grid',
          },
        };
      },
    },
  ],
};

export const onlyofficeBlockSchemaSettings = new SchemaSettings({
  name: 'blockSettings:onlyoffice',
  ...commonOptions,
});
