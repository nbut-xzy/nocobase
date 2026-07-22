/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { CollectionFieldInterface } from '@nocobase/client-v2';
import { SequenceRulesConfigureField } from './SequenceRulesConfigureField';
import { tExpr } from './locale';

export const scopedSequenceRuleTypes = [
  {
    value: 'string',
    label: tExpr('Fixed text'),
    defaults: { value: '' },
    fields: [{ name: 'value', label: tExpr('Text content'), component: 'Input', required: true }],
  },
  {
    value: 'date',
    label: tExpr('Date'),
    defaults: { format: 'YYYYMMDD' },
    fields: [{ name: 'format', label: tExpr('Date format'), component: 'Input', required: true }],
  },
  {
    value: 'integer',
    label: tExpr('Autoincrement'),
    defaults: { digits: 4, start: 1 },
    fields: [
      {
        name: 'digits',
        label: tExpr('Digits'),
        component: 'InputNumber',
        componentProps: { min: 1, max: 10 },
        required: true,
      },
      {
        name: 'start',
        label: tExpr('Start from'),
        component: 'InputNumber',
        componentProps: { min: 0 },
        required: true,
      },
      { name: 'cycle', label: tExpr('Reset cycle'), component: 'CronCycle' },
    ],
  },
  {
    value: 'randomChar',
    label: tExpr('Random character'),
    defaults: { length: 6, charsets: ['number'] },
    fields: [
      {
        name: 'length',
        label: tExpr('Length'),
        component: 'InputNumber',
        componentProps: { min: 1, max: 32 },
        required: true,
      },
      {
        name: 'charsets',
        label: tExpr('Character sets'),
        component: 'Select',
        componentProps: { mode: 'multiple', allowClear: false },
        enum: [
          { value: 'number', label: tExpr('Number') },
          { value: 'lowercase', label: tExpr('Lowercase letters') },
          { value: 'uppercase', label: tExpr('Uppercase letters') },
          { value: 'symbol', label: tExpr('Symbols') },
        ],
        required: true,
      },
    ],
  },
  {
    value: 'field',
    label: tExpr('Field value'),
    defaults: { field: '', start: 0 },
    fields: [
      {
        name: 'field',
        label: tExpr('Source field'),
        component: 'Input',
        required: true,
      },
      {
        name: 'start',
        label: tExpr('Start position'),
        component: 'InputNumber',
        componentProps: { min: 0 },
        defaultValue: 0,
      },
      {
        name: 'end',
        label: tExpr('End position'),
        component: 'InputNumber',
        componentProps: { min: 0 },
      },
    ],
  },
];

export class ScopedSequenceFieldInterface extends CollectionFieldInterface {
  name = 'scopedSequence';
  type = 'object';
  group = 'advanced';
  order = 4;
  title = tExpr('Scoped sequence');
  description = tExpr(
    'Generate scoped auto-encoding codes based on configured rules, with independent counters per scope value.',
  );
  sortable = true;
  default = {
    interface: 'scopedSequence',
    type: 'scopedSequence',
    uiSchema: {
      type: 'string',
      'x-component': 'Input',
      'x-component-props': {},
    },
  };
  availableTypes = ['scopedSequence'];
  hasDefaultValue = false;
  filterable = {
    operators: 'string',
  };
  titleUsable = true;
  configure = {
    items: [
      {
        name: 'unique',
        title: '{{t("Unique")}}',
        component: 'Checkbox',
      },
    ],
  };
}
