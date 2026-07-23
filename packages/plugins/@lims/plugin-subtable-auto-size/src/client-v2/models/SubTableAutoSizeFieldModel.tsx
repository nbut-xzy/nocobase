/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { SettingOutlined } from '@ant-design/icons';
import { DragEndEvent } from '@dnd-kit/core';
import { AddSubModelButton, DndProvider, FlowSettingsButton, useFlowEngine } from '@nocobase/flow-engine';
import { tExpr } from '../locale';
import React from 'react';
import { FormItemModel, SubTableFieldModel } from '@nocobase/client-v2';
import { SubTableAutoSizeField } from './SubTableAutoSizeField';

// ─── HeaderWrapperComponent (local copy — not exported from SubTableFieldModel module) ───
const AddFieldColumn = ({ model }: { model: any }) => {
  return (
    <AddSubModelButton
      model={model}
      subModelKey={'columns'}
      subModelBaseClasses={['SubTableColumnModel']}
      keepDropdownOpen
    >
      <FlowSettingsButton icon={<SettingOutlined />}>{model.translate('Fields')}</FlowSettingsButton>
    </AddSubModelButton>
  );
};

const HeaderWrapperComponent = React.memo((props: any) => {
  const engine = useFlowEngine();

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (active.id && over?.id && active.id !== over.id) {
      engine.moveModel(active.id as string, over.id as string);
    }
  };

  return (
    <DndProvider onDragEnd={onDragEnd}>
      <thead {...props} />
    </DndProvider>
  );
});

// ─── Model class ───
export class SubTableAutoSizeFieldModel extends SubTableFieldModel {
  render() {
    const autoSizeParams = this.getStepParams?.('subTableAutoSizeSettings', 'autoSizeField');
    const autoSizeField = autoSizeParams?.autoSizeField || null;
    const fieldDefaultValues = this.props.fieldDefaultValues || {};

    if (!autoSizeField) {
      // No auto-size configured — fall back to standard SubTableField behavior
      return super.render();
    }

    const columns = this.getColumns();
    const components = {
      header: {
        wrapper: HeaderWrapperComponent,
      },
    };
    const isConfigMode = !!this.context.flowSettingsEnabled;
    const fieldPathArray = this.context.fieldPathArray ?? this.parent?.context?.fieldPathArray;
    const onResetFieldValue = () => {
      const value: any[] = [];
      this.setProps({ value });
      this.context.blockModel?.setFieldValue?.(fieldPathArray, value);
    };

    return (
      <SubTableAutoSizeField
        {...this.props}
        autoSizeField={autoSizeField}
        fieldDefaultValues={fieldDefaultValues}
        columns={columns}
        components={components}
        isConfigMode={isConfigMode}
        parentFieldIndex={this.context.fieldIndex}
        parentItem={this.context.item}
        filterTargetKey={this.collection.filterTargetKey}
        formValuesChangeEmitter={this.context.blockModel?.emitter}
        fieldPathArray={fieldPathArray}
        getCurrentValue={() => this.getCurrentValue()}
        onResetFieldValue={onResetFieldValue}
      />
    );
  }
}

// ─── Model definition ───
SubTableAutoSizeFieldModel.define({
  label: tExpr('Subtable (Auto-size)'),
});

// ─── Settings flow ───
SubTableAutoSizeFieldModel.registerFlow({
  key: 'subTableAutoSizeSettings',
  title: tExpr('Auto-size settings'),
  sort: 250,
  steps: {
    autoSizeField: {
      title: tExpr('Row count field'),
      uiSchema(ctx: any) {
        const parentCollection = ctx.model.context.blockModel?.context?.collection;
        const integerFields = (parentCollection?.getFields?.() || [])
          .filter((f: any) => {
            const type = f.type || f.options?.type;
            const iface = f.interface || f.options?.interface;
            return type === 'integer' || type === 'bigInt' || iface === 'integer' || iface === 'id' || iface === 'sort';
          })
          .map((f: any) => ({
            label: f.uiSchema?.title || f.name,
            value: f.name,
          }));

        return {
          autoSizeField: {
            type: 'string',
            title: tExpr('Select an integer field to control row count'),
            'x-decorator': 'FormItem',
            'x-component': 'Select',
            'x-component-props': {
              allowClear: true,
              placeholder: tExpr('None (manual control)'),
            },
            enum: integerFields,
          },
        };
      },
      defaultParams: {
        autoSizeField: null,
      },
      handler(ctx: any, params: any) {
        ctx.model.setProps({ autoSizeField: params.autoSizeField || null });
      },
    },
    fieldDefaultValues: {
      title: tExpr('Field default values'),
      uiSchema(ctx: any) {
        const columns = (ctx.model.getColumns?.() || []) as any[];
        const properties: Record<string, any> = {};

        columns.forEach((col: any) => {
          const name = String(col.dataIndex || col.props?.dataIndex || '');
          if (!name || name === 'delete') return;
          let title = col.props?.title || col.title || name;
          console.log('col.props.title:', col.props?.title, 'col.title:', col.title, 'name:', name);
          // Guard: col.props.title may be a React element (e.g. Tooltip wrapper)
          // that carries engine references and breaks JSON.stringify.
          if (typeof title !== 'string') {
            title = String(name);
          }
          properties[name] = {
            type: 'string',
            title,
            'x-decorator': 'FormItem',
            'x-component': 'FlowSettingsVariableTextArea',
            'x-component-props': {
              placeholder: String(ctx.t('e.g. DEFAULT-{index} or {{ ctx.formValues.field }}')),
              rows: 2,
            },
          };
        });

        return properties;
      },
      defaultParams: () => ({}),
      handler(ctx: any, params: any) {
        const cleaned: Record<string, any> = {};
        if (params && typeof params === 'object') {
          Object.keys(params).forEach((key) => {
            if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
              cleaned[key] = params[key];
            }
          });
        }
        ctx.model.setProps({ fieldDefaultValues: cleaned });
      },
    },
  },
});

// ─── Interface binding ───
FormItemModel.bindModelToInterface('SubTableAutoSizeFieldModel', ['m2m', 'o2m', 'mbm'], {
  order: 250,
  when: (ctx: any, field: any) => {
    if ((ctx?.model?.constructor as any)?.fieldComponentContext === 'subTableColumn') return false;
    if (field.targetCollection) {
      return field.targetCollection.template !== 'file';
    }
    return true;
  },
});
