/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { EditableItemModel, tExpr } from '@nocobase/flow-engine';
import { Select } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FieldModel } from '@nocobase/client-v2';

// ─── Build options from sub-table form state ───

function buildOptionsFromSubTable(
  rows: unknown[] | undefined,
  labelField: string,
  valueField: string,
): { label: string; value: unknown }[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return rows
    .filter((row) => row != null)
    .map((row: any, idx: number) => ({
      label: String(row[labelField] ?? `#${idx + 1}`),
      value: row[valueField] ?? idx,
    }));
}

// ─── Config resolver ───

interface DynamicSelectConfig {
  labelField: string;
  valueField: string;
  sourceField: string;
}

function resolveConfig(model: any): DynamicSelectConfig {
  // Read from persisted step params first (survive page reload), fall back to runtime props
  const stepParams = model?.getStepParams?.('dynamicSelectSettings', 'fieldMapping') || {};
  const props = model?.props || {};
  return {
    labelField: stepParams.labelField || props.labelField || 'id',
    valueField: stepParams.valueField || props.valueField || 'id',
    sourceField: stepParams.sourceField || props.sourceField || '',
  };
}

// ─── Renderer component ───

function DynamicSelectRenderer({ model }: { model: any }) {
  const [options, setOptions] = useState<{ label: string; value: unknown }[]>([]);

  const config: DynamicSelectConfig = useMemo(() => {
    return resolveConfig(model);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.props]);

  // Strip DynamicSelect-specific config keys before spreading to DOM
  const selectProps = useMemo(() => {
    const { labelField, valueField, sourceField, ...rest } = model.props || {};
    return rest;
  }, [model.props]);

  const form = model.context?.blockModel?.context?.form;
  const emitter = model.context?.blockModel?.emitter;

  const buildOptions = useCallback(() => {
    if (!form || !config.sourceField) {
      setOptions([]);
      return;
    }
    const rows = form.getFieldValue([config.sourceField]);
    setOptions(buildOptionsFromSubTable(rows, config.labelField, config.valueField));
  }, [form, config.sourceField, config.labelField, config.valueField]);

  // Initial build
  useEffect(() => {
    buildOptions();
  }, [buildOptions]);

  // Listen for sub-table changes
  useEffect(() => {
    if (!emitter?.on || !config.sourceField) return;

    const listener = (payload: any) => {
      const paths: any[] = Array.isArray(payload?.changedPaths) ? payload.changedPaths : [];
      const hasChange = paths.some((p: any) => {
        const pathStr = Array.isArray(p) ? p.join('.') : String(p ?? '');
        return pathStr === config.sourceField || pathStr.startsWith(config.sourceField + '.');
      });
      if (hasChange) buildOptions();
    };

    emitter.on('formValuesChange', listener);
    return () => {
      emitter.off('formValuesChange', listener);
    };
  }, [emitter, config.sourceField, buildOptions]);

  return (
    <Select
      {...selectProps}
      mode="multiple"
      options={options}
      allowClear
      placeholder={model.translate('Select from sub-table')}
    />
  );
}

// ─── Model class ───

export class DynamicSelectFieldModel extends FieldModel {
  render() {
    return <DynamicSelectRenderer model={this} />;
  }
}

DynamicSelectFieldModel.define({
  label: tExpr('Dynamic Select'),
});

// ─── Settings flow ───

DynamicSelectFieldModel.registerFlow({
  key: 'dynamicSelectSettings',
  title: tExpr('Dynamic Select Settings'),
  sort: 500,
  steps: {
    fieldMapping: {
      title: tExpr('Field mapping'),
      uiSchema(ctx: any) {
        const parentCollection = ctx.model.context.blockModel?.context?.collection;
        const parentFields = parentCollection?.getFields?.() || [];

        // Source field options: o2m/m2m/mbm fields in the parent collection
        const sourceFieldOptions = parentFields
          .filter((f: any) => {
            const iface = f.interface || f.options?.interface;
            return iface === 'o2m' || iface === 'm2m' || iface === 'mbm';
          })
          .map((f: any) => ({
            label: f.uiSchema?.title || f.name,
            value: f.name,
          }));

        // Helper: resolve target collection fields as select options.
        // In the v2 client, association fields expose `targetCollection` directly as a
        // Collection object (not a string name) — call getFields() on it.
        const resolveTargetFieldOptions = (sourceFieldValue: string): { label: string; value: string }[] => {
          if (!sourceFieldValue) return [];
          const sourceFieldDef = parentFields.find((f: any) => f.name === sourceFieldValue);
          const targetCollection = sourceFieldDef?.targetCollection;
          if (!targetCollection?.getFields) return [];
          return targetCollection.getFields().map((f: any) => ({
            label: f.uiSchema?.title || f.name,
            value: f.name,
          }));
        };

        // Shared x-reactions for labelField / valueField: reactively update dataSource
        // based on the current sourceField selection in the form.
        const targetFieldReaction = (field: any) => {
          const sourceFieldValue = field.form?.values?.sourceField;
          field.dataSource = resolveTargetFieldOptions(sourceFieldValue);
        };

        return {
          sourceField: {
            type: 'string',
            title: tExpr('Source field'),
            'x-decorator': 'FormItem',
            'x-component': 'Select',
            'x-component-props': {
              allowClear: true,
              placeholder: tExpr('Select a subtable field'),
            },
            enum: sourceFieldOptions,
          },
          labelField: {
            type: 'string',
            title: tExpr('Label field'),
            'x-decorator': 'FormItem',
            'x-component': 'Select',
            'x-component-props': {
              allowClear: true,
              placeholder: tExpr('Select source field first'),
            },
            'x-reactions': targetFieldReaction,
          },
          valueField: {
            type: 'string',
            title: tExpr('Value field'),
            'x-decorator': 'FormItem',
            'x-component': 'Select',
            'x-component-props': {
              allowClear: true,
              placeholder: tExpr('Select source field first'),
            },
            'x-reactions': targetFieldReaction,
          },
        };
      },
      defaultParams(ctx: any) {
        const stepParams = ctx.model?.getStepParams?.('dynamicSelectSettings', 'fieldMapping') || {};
        const props = ctx.model.props || {};
        return {
          sourceField: stepParams.sourceField || props.sourceField || '',
          labelField: stepParams.labelField || props.labelField || 'id',
          valueField: stepParams.valueField || props.valueField || 'id',
        };
      },
      handler(ctx: any, params: any) {
        ctx.model.setProps({
          sourceField: params.sourceField || '',
          labelField: params.labelField || 'id',
          valueField: params.valueField || 'id',
        });
      },
    },
  },
});

// ─── Interface binding ───

EditableItemModel.bindModelToInterface('DynamicSelectFieldModel', ['o2m', 'm2m', 'mbm'], {
  order: 260,
});
