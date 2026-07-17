/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ISchema, useField, useFieldSchema, useForm } from '@formily/react';
import {
  SchemaSettings,
  SchemaSettingsBlockHeightItem,
  SchemaSettingsLinkageRules,
  LinkageRuleCategory,
  useDesignable,
  useVariableOptions,
  Variable,
  FlagProvider,
} from '@nocobase/client';
import React from 'react';
import { useTranslation } from 'react-i18next';

const OnlyOfficeProvider = (props) => {
  return <FlagProvider collectionField={true}>{props.children}</FlagProvider>;
};

const getVariableComponentWithScope = (Com) => {
  return (props) => {
    const fieldSchema = useFieldSchema();
    const form = useForm();
    const scope = useVariableOptions({
      collectionField: { uiSchema: fieldSchema },
      uiSchema: fieldSchema,
      form,
      noDisabled: true,
    });
    return <Com {...props} scope={scope} />;
  };
};

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
          props.documentServerUrl = values.documentServerUrl || undefined;
          props.callbackUrl = values.callbackUrl || undefined;
          props.preScript = values.preScript || undefined;
          props.postScript = values.postScript || undefined;
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
              documentServerUrl: componentProps.documentServerUrl || '',
              callbackUrl: componentProps.callbackUrl || '',
              preScript: componentProps.preScript || '',
              postScript: componentProps.postScript || '',
            };
          },
          schema: {
            type: 'object',
            title: t('Edit OnlyOffice'),
            properties: {
              container: {
                type: 'void',
                'x-component': OnlyOfficeProvider,
                properties: {
                  fileUrl: {
                    title: t('File URL'),
                    type: 'string',
                    'x-decorator': 'FormItem',
                    'x-component': getVariableComponentWithScope(Variable.TextArea),
                    'x-component-props': {
                      placeholder: 'http://localhost{{ ctx.record.path }}',
                    },
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
                    'x-component': getVariableComponentWithScope(Variable.TextArea),
                    'x-component-props': {
                      placeholder: '/api/onlyoffice:callback',
                    },
                    description: t('If empty, the auto-generated callback URL will be used'),
                  },
                  preScript: {
                    title: t('Pre-callback Script'),
                    type: 'string',
                    'x-decorator': 'FormItem',
                    'x-component': 'Input.TextArea',
                    'x-component-props': {
                      rows: 4,
                      placeholder:
                        '// Runs before file save\n// Access: callbackBody, fileRecord, collectionName, recordId',
                    },
                  },
                  postScript: {
                    title: t('Post-callback Script'),
                    type: 'string',
                    'x-decorator': 'FormItem',
                    'x-component': 'Input.TextArea',
                    'x-component-props': {
                      rows: 4,
                      placeholder:
                        '// Runs after file save\n// Access: callbackBody, fileRecord, collectionName, recordId',
                    },
                  },
                },
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
