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
import { AddSubModelButton, DndProvider, FlowSettingsButton, tExpr, useFlowEngine } from '@nocobase/flow-engine';
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
