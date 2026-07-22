/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { DataNode } from 'antd/es/tree';
import React, { useCallback, useMemo, useState } from 'react';
import { Button, Drawer, Form, message, Select, Space, Spin, Table, Tree } from 'antd';
import { useFlowContext } from '@nocobase/flow-engine';
import { useRequest } from 'ahooks';
import { useT } from '../locale';
import { SequenceRulesConfigureField } from '../SequenceRulesConfigureField';
import { scopedSequenceRuleTypes } from '../interface';

interface ScopedSequenceRule {
  id?: number;
  collectionName: string;
  fieldName: string;
  scopeValue: string;
  scopeLabel: string;
  patterns: any[];
  inputable: boolean;
  match: boolean;
  enabled: boolean;
}

export default function ScopedSequenceRulesPage() {
  const ctx = useFlowContext();
  const t = useT();

  // Selected collection + field
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [collectionName, setCollectionName] = useState('');
  const [fieldName, setFieldName] = useState('');

  // Scope configuration
  const [scopeField, setScopeField] = useState('');
  const [scopeTargetCollection, setScopeTargetCollection] = useState('');

  // Editing state
  const [editingRule, setEditingRule] = useState<ScopedSequenceRule | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ruleForm] = Form.useForm();

  // ---- Build tree data from main data source ----
  const treeData = useMemo(() => {
    const nodes: DataNode[] = [];
    try {
      const mainDS = ctx.dataSourceManager?.getDataSource('main');
      if (!mainDS) return nodes;

      const collections = mainDS.getCollections();
      if (!collections) return nodes;

      collections.forEach((collection: any) => {
        const fields =
          collection.fields instanceof Map
            ? Array.from(collection.fields.values())
            : (collection.fields as any[]) || [];
        const scopedFields = fields.filter((f: any) => f.type === 'scopedSequence');
        if (scopedFields.length === 0) return;

        nodes.push({
          key: collection.name,
          title: collection.title || collection.name,
          selectable: false,
          children: scopedFields.map((f: any) => ({
            key: `${collection.name}:${f.name}`,
            title: f.uiSchema?.title || f.name,
            isLeaf: true,
          })),
        });
      });
    } catch {
      // Data source not yet loaded
    }
    return nodes;
  }, [ctx.dataSourceManager]);

  // ---- Handle tree selection ----
  const handleTreeSelect = useCallback((keys: React.Key[]) => {
    const key = keys[0] as string;
    if (!key || !key.includes(':')) return;
    setSelectedKey(key);
    const [colName, fName] = key.split(':');
    setCollectionName(colName);
    setFieldName(fName);
    // Reset scope when switching field
    setScopeField('');
    setScopeTargetCollection('');
  }, []);

  // ---- Load field config (scopeField) ----
  const { data: fieldConfig, loading: configLoading } = useRequest(
    async () => {
      if (!collectionName || !fieldName) return null;
      const res = await ctx.api.request({
        url: 'scopedSequenceFieldConfig:get',
        method: 'get',
        params: { collectionName, fieldName },
      });
      return res?.data?.data ?? null;
    },
    {
      refreshDeps: [collectionName, fieldName],
      onSuccess(data) {
        if (data?.scopeField) {
          setScopeField(data.scopeField);
          setScopeTargetCollection(data.scopeTargetCollection || '');
        }
      },
    },
  );

  // ---- Load collection fields (for scope field selector) ----
  const collectionFields = useMemo(() => {
    if (!collectionName) return [];
    try {
      const mainDS = ctx.dataSourceManager?.getDataSource('main');
      const collection = mainDS?.getCollection(collectionName);
      if (!collection) return [];
      const fields =
        collection.fields instanceof Map ? Array.from(collection.fields.values()) : (collection.fields as any[]) || [];
      return fields.filter((f: any) => f.interface === 'belongsTo' || f.type === 'belongsTo');
    } catch {
      return [];
    }
  }, [collectionName, ctx.dataSourceManager]);

  // ---- Load scope records (from target table) ----
  const { data: scopeRecords = [], loading: scopeLoading } = useRequest(
    async () => {
      if (!scopeTargetCollection) return [];
      try {
        const res = await ctx.api.request({
          url: `${scopeTargetCollection}:list`,
          method: 'get',
          params: { pageSize: 500 },
        });
        return res?.data?.data || [];
      } catch {
        return [];
      }
    },
    {
      refreshDeps: [scopeTargetCollection],
      ready: !!scopeTargetCollection,
    },
  );

  // ---- Load scopedSequenceRules ----
  const {
    data: rules = [],
    loading: rulesLoading,
    refresh: refreshRules,
  } = useRequest(
    async () => {
      if (!collectionName || !fieldName) return [];
      const res = await ctx.api.request({
        url: 'scopedSequenceRules:list',
        method: 'get',
        params: { collectionName, fieldName },
      });
      return res?.data?.data || [];
    },
    {
      refreshDeps: [collectionName, fieldName],
    },
  );

  // ---- Save scope field config ----
  const saveScopeField = useCallback(
    async (newScopeField: string) => {
      const fieldObj = collectionFields.find((f: any) => f.name === newScopeField);
      const targetCollection = fieldObj?.target || '';
      setScopeField(newScopeField);
      setScopeTargetCollection(targetCollection);

      await ctx.api.request({
        url: 'scopedSequenceFieldConfig:set',
        method: 'post',
        data: {
          collectionName,
          fieldName,
          scopeField: newScopeField,
          scopeTargetCollection: targetCollection,
        },
      });
      message.success(t('Saved successfully'));
    },
    [collectionName, fieldName, collectionFields, ctx.api, t],
  );

  // ---- Build merged data source for the rules table ----
  const mergedData = useMemo(() => {
    if (!scopeTargetCollection || scopeRecords.length === 0) {
      // If no target collection loaded yet, show existing rules only
      return rules.map((r: ScopedSequenceRule) => ({
        key: r.id ?? r.scopeValue,
        scopeValue: r.scopeValue,
        scopeLabel: r.scopeLabel,
        patterns: r.patterns,
        inputable: r.inputable,
        match: r.match,
        enabled: r.enabled,
        hasRule: true,
        ruleId: r.id,
      }));
    }

    const ruleMap = new Map<string, ScopedSequenceRule>();
    rules.forEach((r: ScopedSequenceRule) => ruleMap.set(r.scopeValue, r));

    // Determine the title field from the scope record
    const getScopeLabel = (record: any): string => {
      return record.title || record.name || record.label || String(record.id);
    };

    return scopeRecords.map((record: any) => {
      const scopeValue = String(record.id);
      const existingRule = ruleMap.get(scopeValue);
      return {
        key: scopeValue,
        scopeValue,
        scopeLabel: getScopeLabel(record),
        patterns: existingRule?.patterns || null,
        inputable: existingRule?.inputable ?? false,
        match: existingRule?.match ?? false,
        enabled: existingRule?.enabled ?? true,
        hasRule: !!existingRule,
        ruleId: existingRule?.id,
      };
    });
  }, [scopeRecords, rules, scopeTargetCollection]);

  // ---- Open drawer to edit ----
  const openEdit = useCallback(
    (record: any) => {
      setEditingRule({
        collectionName,
        fieldName,
        scopeValue: record.scopeValue,
        scopeLabel: record.scopeLabel,
        patterns: record.patterns || [{ type: 'integer', options: { digits: 4, start: 1 } }],
        inputable: record.inputable ?? false,
        match: record.match ?? false,
        enabled: record.enabled ?? true,
        id: record.ruleId,
      });
      setDrawerOpen(true);
    },
    [collectionName, fieldName],
  );

  // ---- Submit rule ----
  const submitRule = useCallback(async () => {
    if (!editingRule) return;
    const values = await ruleForm.validateFields();
    const payload = {
      collectionName: editingRule.collectionName,
      fieldName: editingRule.fieldName,
      scopeValue: editingRule.scopeValue,
      scopeLabel: editingRule.scopeLabel,
      patterns: values.patterns,
      inputable: editingRule.inputable,
      match: editingRule.match,
      enabled: true,
    };

    if (editingRule.id) {
      await ctx.api.request({
        url: `scopedSequenceRules:update/${editingRule.id}`,
        method: 'post',
        data: payload,
      });
    } else {
      await ctx.api.request({
        url: 'scopedSequenceRules:create',
        method: 'post',
        data: payload,
      });
    }

    message.success(t('Saved successfully'));
    setDrawerOpen(false);
    setEditingRule(null);
    ruleForm.resetFields();
    refreshRules();
  }, [editingRule, ruleForm, ctx.api, t, refreshRules]);

  // ---- Delete rule ----
  const deleteRule = useCallback(
    async (record: any) => {
      if (!record.ruleId) return;
      await ctx.api.request({
        url: `scopedSequenceRules:destroy/${record.ruleId}`,
        method: 'post',
      });
      message.success(t('Deleted successfully'));
      refreshRules();
    },
    [ctx.api, t, refreshRules],
  );

  const columns = useMemo(
    () => [
      { title: t('Scope'), dataIndex: 'scopeLabel', key: 'scopeLabel' },
      {
        title: t('Patterns'),
        dataIndex: 'patterns',
        key: 'patterns',
        render: (patterns: any[]) =>
          patterns ? (
            <span>
              {patterns.map((p: any, i: number) => (
                <code key={i} style={{ marginRight: 4 }}>
                  {p.type}
                  {i < patterns.length - 1 ? ' + ' : ''}
                </code>
              ))}
            </span>
          ) : (
            <span style={{ color: '#999' }}>{t('Not configured')}</span>
          ),
      },
      {
        title: t('Operations'),
        key: 'actions',
        width: 180,
        render: (_: any, record: any) => (
          <Space>
            <Button size="small" type="link" onClick={() => openEdit(record)}>
              {record.hasRule ? t('Edit') : t('Configure')}
            </Button>
            {record.hasRule && (
              <Button size="small" type="link" danger onClick={() => deleteRule(record)}>
                {t('Delete')}
              </Button>
            )}
          </Space>
        ),
      },
    ],
    [t, openEdit, deleteRule],
  );

  return (
    <div style={{ display: 'flex', height: '100%', gap: 16 }}>
      {/* ---- Left: Tree ---- */}
      <div style={{ width: 250, flexShrink: 0, borderRight: '1px solid #f0f0f0', padding: '16px 8px' }}>
        <h4 style={{ marginBottom: 12 }}>{t('Collections')}</h4>
        {treeData.length > 0 ? (
          <Tree
            treeData={treeData}
            selectedKeys={selectedKey ? [selectedKey] : []}
            onSelect={handleTreeSelect}
            defaultExpandAll
          />
        ) : (
          <span style={{ color: '#999' }}>{t('No collections with scoped sequence fields')}</span>
        )}
      </div>

      {/* ---- Right: Rules panel ---- */}
      <div style={{ flex: 1, padding: '16px 0', overflow: 'auto' }}>
        {!selectedKey ? (
          <div style={{ color: '#999', textAlign: 'center', marginTop: 80 }}>
            {t('Select a field to configure encoding rules')}
          </div>
        ) : (
          <Spin spinning={configLoading}>
            {/* Scope field selector */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
                {t('Scope field')} ({t('belongsTo / hasOne association on current collection')})
              </label>
              <Select
                style={{ width: 320 }}
                value={scopeField || undefined}
                placeholder={t('Select association field')}
                options={collectionFields.map((f: any) => ({
                  value: f.name,
                  label: f.uiSchema?.title || f.name,
                }))}
                onChange={saveScopeField}
                allowClear
              />
              {scopeTargetCollection && (
                <span style={{ marginLeft: 12, color: '#666' }}>
                  {t('Target')}: <code>{scopeTargetCollection}</code>
                </span>
              )}
            </div>

            {/* Rules table */}
            <Spin spinning={scopeLoading || rulesLoading}>
              <Table
                dataSource={mergedData}
                columns={columns}
                rowKey="key"
                pagination={{ pageSize: 50, showSizeChanger: true }}
                size="small"
              />
            </Spin>
          </Spin>
        )}

        {/* ---- Rule edit Drawer ---- */}
        <Drawer
          title={editingRule?.scopeLabel ? `${t('Encoding rule')}: ${editingRule.scopeLabel}` : t('New encoding rule')}
          open={drawerOpen}
          width={640}
          onClose={() => {
            setDrawerOpen(false);
            setEditingRule(null);
            ruleForm.resetFields();
          }}
          footer={
            <Button type="primary" onClick={submitRule}>
              {t('Save')}
            </Button>
          }
        >
          <Form
            form={ruleForm}
            layout="vertical"
            initialValues={{
              patterns: editingRule?.patterns || [{ type: 'integer', options: { digits: 4, start: 1 } }],
            }}
            preserve={false}
          >
            <SequenceRulesConfigureField
              name="patterns"
              title={t('Encoding rules')}
              namePath={['patterns']}
              schema={{
                required: true,
                'x-component-props': { ruleTypes: scopedSequenceRuleTypes },
              }}
              form={ruleForm}
              context={{} as Record<string, boolean>}
              mode="edit"
              fieldInterface={null as any}
            />
          </Form>
        </Drawer>
      </div>
    </div>
  );
}
