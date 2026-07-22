/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { tExpr } from '@nocobase/flow-engine';
import { Select } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FieldModel, FormItemModel } from '@nocobase/client-v2';

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

function resolveConfig(collectionField: any): DynamicSelectConfig {
  const props = collectionField?.uiSchema?.['x-component-props'] || {};
  return {
    labelField: props.labelField || 'id',
    valueField: props.valueField || 'id',
    sourceField: props.sourceField || '',
  };
}

// ─── Renderer component ───

function DynamicSelectRenderer({ model }: { model: any }) {
  const [options, setOptions] = useState<{ label: string; value: unknown }[]>([]);

  const config: DynamicSelectConfig = useMemo(() => {
    return resolveConfig(model.collectionField);
  }, [model.collectionField]);

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
      const paths: string[] = Array.isArray(payload?.changedPaths) ? payload.changedPaths : [];
      const hasChange = paths.some((p: string) => p === config.sourceField || p.startsWith(config.sourceField + '.'));
      if (hasChange) buildOptions();
    };

    emitter.on('formValuesChange', listener);
    return () => {
      emitter.off('formValuesChange', listener);
    };
  }, [emitter, config.sourceField, buildOptions]);

  return (
    <Select
      {...model.props}
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

// ─── Interface binding ───

FormItemModel.bindModelToInterface('DynamicSelectFieldModel', ['o2m', 'm2m', 'mbm'], {
  order: 260,
  when: (_ctx: any, field: any) => {
    const component = field?.uiSchema?.['x-component'];
    return component === 'DynamicSelect';
  },
});
