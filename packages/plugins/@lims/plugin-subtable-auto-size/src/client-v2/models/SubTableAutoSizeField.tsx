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
 *
 * Adapted from: packages/core/client-v2/src/flow/models/fields/AssociationFieldModel/SubTableFieldModel/SubTableField.tsx
 * Extended with auto-size logic that watches a configurable integer field
 * and automatically adjusts subtable row count.
 */

import { CloseOutlined, ZoomInOutlined, PlusOutlined } from '@ant-design/icons';
import { Table, Form, Space, Button, Tooltip } from 'antd';
import { css } from '@emotion/css';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useFlowModel, useFlowEngine } from '@nocobase/flow-engine';
import { getSubTableRowIdentity, normalizeSubTableRows } from './rowIdentity';

type NamePath = Array<string | number>;

// ─── Local copy of parsePathString (not in @nocobase/client-v2 public API) ───
type PathSegment = string | number | { placeholder: string };

function parsePathString(path: string): PathSegment[] {
  const segs: PathSegment[] = [];
  let i = 0;
  const len = path.length;
  const readIdent = () => {
    const start = i;
    while (i < len && path[i] !== '.' && path[i] !== '[') i++;
    const raw = path.slice(start, i);
    if (raw) segs.push(raw);
  };
  while (i < len) {
    const ch = path[i];
    if (ch === '.') {
      i++;
      continue;
    }
    if (ch === '[') {
      i++;
      const start = i;
      while (i < len && path[i] !== ']') i++;
      const raw = path.slice(start, i);
      i++;
      if (/^\d+$/.test(raw)) {
        segs.push(Number(raw));
      } else if (raw) {
        segs.push({ placeholder: raw });
      }
      continue;
    }
    readIdent();
  }
  return segs;
}

// ─── Local copy of ActionWithoutPermission (not in @nocobase/client-v2 public API) ───
function ActionWithoutPermission(props: any) {
  const { t } = useTranslation();
  const model: any = useFlowModel();
  const blockModel = model.context.blockModel;
  const collection = props.collection || blockModel.collection;
  const dataSource = collection.dataSource;
  const nameValue = useMemo(() => {
    const dataSourcePrefix = `${t(dataSource.displayName || dataSource.key)} > `;
    const collectionPrefix = collection ? `${t(collection.title) || collection.name || collection.tableName} ` : '';
    return `${dataSourcePrefix}${collectionPrefix}`;
  }, [collection, dataSource.displayName, dataSource.key, t]);
  const { actionName } = props?.forbidden || model.forbidden;
  const messageValue = useMemo(() => {
    return t(
      `The current user only has the UI configuration permission, but don't have "{{actionName}}" permission for collection "{{name}}"`,
      {
        name: nameValue,
        actionName: t(actionName?.charAt?.(0)?.toUpperCase?.() + actionName?.slice?.(1) || actionName),
      },
    ).replaceAll('&gt;', '>');
  }, [actionName, nameValue, t]);

  return <Tooltip title={props.message || messageValue}>{props.children}</Tooltip>;
}

// ─── Path utilities (copied from original SubTableField.tsx) ───
function isSamePathPrefix(prefix: NamePath, path: NamePath) {
  if (!prefix.length || prefix.length > path.length) return false;
  return prefix.every((seg, index) => seg === path[index]);
}

function isRelatedPath(a: NamePath, b: NamePath) {
  return isSamePathPrefix(a, b) || isSamePathPrefix(b, a);
}

function normalizeChangedPath(path: unknown): NamePath | null {
  const rawPath = Array.isArray(path) ? path : typeof path === 'string' ? [path] : null;
  if (!rawPath) return null;
  const normalized = rawPath.flatMap((seg) => {
    if (typeof seg === 'number') return [seg];
    if (typeof seg !== 'string') return [];
    return parsePathString(seg).filter((parsed): parsed is string | number => typeof parsed !== 'object');
  });
  return normalized.length ? normalized : null;
}

function shouldRefreshForChangedPaths(fieldPath: unknown, changedPaths: unknown) {
  const currentFieldPath = normalizeChangedPath(fieldPath);
  if (!currentFieldPath) return false;
  const paths = Array.isArray(changedPaths) ? changedPaths : [];
  return paths.some((path) => {
    const changedPath = normalizeChangedPath(path);
    return changedPath ? isRelatedPath(currentFieldPath, changedPath) : false;
  });
}

// ─── SubTableAutoSizeField component ───
export function SubTableAutoSizeField(props: any) {
  const { t } = useTranslation();
  const {
    onChange,
    columns,
    disabled,
    allowAddNew,
    components,
    allowSelectExistingRecord,
    onSelectExitRecordClick,
    allowDisassociation,
    pageSize,
    allowCreate, // acl
    isConfigMode,
    parentFieldIndex,
    parentItem,
    resetPage,
    filterTargetKey = 'id',
    getCurrentValue,
    fieldPathArray,
    formValuesChangeEmitter,
    onResetFieldValue,
    // [AUTO-SIZE] new prop
    autoSizeField,
    fieldDefaultValues,
  } = props;

  // [AUTO-SIZE] Form instance and guard ref
  const form = Form.useFormInstance();
  const isAdjustingRef = useRef(false);

  const engine = useFlowEngine();

  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);
  const [, forceRefresh] = useState(0);
  const rawCurrentValue = getCurrentValue();
  const currentValue = useMemo(() => normalizeSubTableRows(rawCurrentValue), [rawCurrentValue]);
  const getRecordIdentity = useCallback(
    (record: any) => getSubTableRowIdentity(record, filterTargetKey),
    [filterTargetKey],
  );
  useEffect(() => {
    setCurrentPageSize(pageSize);
  }, [pageSize]);
  useEffect(() => {
    resetPage && setCurrentPage(1);
  }, [resetPage]);
  useEffect(() => {
    if (!formValuesChangeEmitter?.on || !formValuesChangeEmitter?.off) return;
    const listener = (payload: any) => {
      if (!shouldRefreshForChangedPaths(fieldPathArray, payload?.changedPaths)) return;
      forceRefresh((v) => v + 1);
    };
    formValuesChangeEmitter.on('formValuesChange', listener);
    return () => {
      formValuesChangeEmitter.off('formValuesChange', listener);
    };
  }, [fieldPathArray, formValuesChangeEmitter]);
  useEffect(() => {
    if (!formValuesChangeEmitter?.on || !formValuesChangeEmitter?.off || !onResetFieldValue) return;
    const listener = () => {
      onResetFieldValue();
      forceRefresh((v) => v + 1);
    };
    formValuesChangeEmitter.on('onFieldReset', listener);
    return () => {
      formValuesChangeEmitter.off('onFieldReset', listener);
    };
  }, [formValuesChangeEmitter, onResetFieldValue]);
  const applyValue = useCallback((nextValue: any) => onChange?.(normalizeSubTableRows(nextValue)), [onChange]);
  const getLatestValue = useCallback(() => normalizeSubTableRows(getCurrentValue()), [getCurrentValue]);
  useEffect(() => {
    if (currentValue !== rawCurrentValue) {
      applyValue(currentValue);
    }
  }, [applyValue, currentValue, rawCurrentValue]);

  // [AUTO-SIZE] Default value helpers
  // Sync: replace {index} with 1-based row number (visible immediately)
  const applyFieldDefaultsSync = useCallback(
    (newRow: any, rowIndex: number, columns: any[]) => {
      if (!fieldDefaultValues || typeof fieldDefaultValues !== 'object') return;
      columns.forEach((col: any) => {
        const key = col.dataIndex;
        if (!key) return;
        const template = fieldDefaultValues[key];
        if (!template || typeof template !== 'string') return;
        newRow[key] = template.replace(/\{index\}/g, String(rowIndex + 1));
      });
    },
    [fieldDefaultValues],
  );

  // Async: resolve {{ ctx.X }} expressions via engine.context.resolveJsonTemplate()
  // Reads current cell value (which already has {index} replaced), not the original template,
  // to avoid overwriting the {index} replacement.
  const resolveCtxVariablesForRow = useCallback(
    async (rowIndex: number) => {
      if (!fieldDefaultValues || !engine?.context?.resolveJsonTemplate) return;

      const current = normalizeSubTableRows(getCurrentValue() || []);
      if (rowIndex >= current.length) return;
      const row = current[rowIndex];

      const updates: Record<string, any> = {};

      for (const key of Object.keys(fieldDefaultValues)) {
        const cellValue = row[key];
        if (typeof cellValue !== 'string') continue;
        if (!/\{\{\s*ctx\./.test(cellValue)) continue;

        try {
          const resolved = await engine.context.resolveJsonTemplate(cellValue);
          if (resolved !== cellValue) {
            updates[key] = resolved;
          }
        } catch {
          // Keep original value on failure
        }
      }

      if (Object.keys(updates).length > 0) {
        const latest = normalizeSubTableRows(getCurrentValue() || []);
        if (rowIndex < latest.length) {
          latest[rowIndex] = { ...latest[rowIndex], ...updates };
          onChange?.(normalizeSubTableRows(latest));
        }
      }
    },
    [fieldDefaultValues, engine, getCurrentValue, onChange],
  );

  // [AUTO-SIZE] Core: adjust row count
  const adjustRowCount = useCallback(
    (targetCount: number) => {
      const current = normalizeSubTableRows(getCurrentValue() || []);
      const k = Math.max(0, parseInt(String(targetCount)) || 0);
      if (k === current.length) return;
      if (k > current.length) {
        const diff = k - current.length;
        const emptyRows = Array.from({ length: diff }, (_, i) => {
          const newRow: any = { __is_new__: true };
          applyFieldDefaultsSync(newRow, current.length + i, columns);
          return newRow;
        });
        onChange?.(normalizeSubTableRows([...current, ...emptyRows]));

        // Async resolve ctx variables for each new row
        for (let i = 0; i < diff; i++) {
          resolveCtxVariablesForRow(current.length + i);
        }
      } else {
        onChange?.(normalizeSubTableRows(current.slice(0, k)));
      }
    },
    [getCurrentValue, onChange, applyFieldDefaultsSync, resolveCtxVariablesForRow, columns],
  );

  // [AUTO-SIZE] Watch for field A value changes
  useEffect(() => {
    if (!autoSizeField || !formValuesChangeEmitter?.on) return;
    const listener = (payload: any) => {
      if (isAdjustingRef.current) return;
      const { changedValues } = payload || {};
      if (!changedValues || !(autoSizeField in changedValues)) return;
      const newValue = changedValues[autoSizeField];
      if (typeof newValue === 'number' && Number.isFinite(newValue) && newValue >= 0) {
        isAdjustingRef.current = true;
        try {
          adjustRowCount(Math.round(newValue));
        } finally {
          setTimeout(() => {
            isAdjustingRef.current = false;
          }, 0);
        }
      }
    };
    formValuesChangeEmitter.on('formValuesChange', listener);
    return () => {
      formValuesChangeEmitter.off('formValuesChange', listener);
    };
  }, [autoSizeField, formValuesChangeEmitter, adjustRowCount]);

  // [AUTO-SIZE] Initial load: adjust rows based on field A's current value
  useEffect(() => {
    if (!autoSizeField || !form) return;
    const timer = setTimeout(() => {
      const k = form.getFieldValue([autoSizeField]);
      if (typeof k === 'number' && Number.isFinite(k) && k >= 0) {
        adjustRowCount(Math.round(k));
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [autoSizeField]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pagination (unchanged from original)
  const pagination = useMemo(() => {
    return {
      style: {
        position: 'absolute',
        right: '0px',
        bottom: '0px',
      },
      current: currentPage,
      pageSize: currentPageSize,
      total: currentValue.length,
      onChange: (page: number, size: number) => {
        setCurrentPage(page);
        setCurrentPageSize(size);
      },
      showSizeChanger: true,
      showTotal: (total: number) => {
        return t('Total {{count}} items', { count: total });
      },
    } as any;
  }, [currentPage, currentPageSize, currentValue.length, t]);

  // Add new row
  const handleAdd = () => {
    if (allowCreate === false) return;

    const currentValues = getLatestValue();
    const newRow: any = { __is_new__: true };
    const nextIndex = currentValues.length;

    // Sync: apply default values ({index} replacement)
    applyFieldDefaultsSync(newRow, nextIndex, columns);

    // Set undefined for columns without default value
    columns.forEach((col: any) => {
      if (!(col.dataIndex in newRow)) {
        newRow[col.dataIndex] = undefined;
      }
    });

    const newValue = [...currentValues, newRow];
    setCurrentPage(Math.ceil(newValue.length / currentPageSize));
    applyValue(newValue);

    // Async: resolve ctx variables
    resolveCtxVariablesForRow(nextIndex);
  };

  // Delete row (unchanged)
  const handleDelete = (index: number) => {
    const newValue = [...getLatestValue()];
    newValue.splice(index, 1);
    const lastPage = Math.ceil(newValue.length / currentPageSize);
    setCurrentPage(currentPage > lastPage ? lastPage : currentPage);
    applyValue(newValue);
  };

  // Edit cell (unchanged)
  const handleCellChange = (rowIdx: number, dataIndex: string, cellValue: any) => {
    const newData = getLatestValue().map((row: any, idx: number) =>
      idx === rowIdx ? { ...row, [dataIndex]: cellValue } : row,
    );
    applyValue(newData);
  };

  // Build editable columns (unchanged)
  const editableColumns = columns
    .map((col: any) => ({
      ...col,
      render: (text: any, record: any, rowIdx: number) => {
        const pageRowIdx = (currentPage - 1) * currentPageSize + rowIdx;
        const rowIdentity = getRecordIdentity(record) ?? `row:${pageRowIdx}`;
        const rowBindingKey = `${rowIdentity}:${pageRowIdx}`;
        const columnKey = col.dataIndex ?? col.key ?? 'cell';
        if (!col.render) {
          return;
        }
        return col.render({
          record,
          rowIdx: pageRowIdx,
          id: `field-${String(columnKey)}-${rowBindingKey}`,
          value: text,
          parentFieldIndex,
          parentItem,
          onChange: (value: any) => {
            handleCellChange(pageRowIdx, col.dataIndex, value?.target?.value ?? value);
          },
          ['aria-describedby']: `field-${String(columnKey)}-${rowBindingKey}`,
        });
      },
    }))
    .concat([
      !disabled && {
        title: '',
        key: 'delete',
        width: 50,
        align: 'center' as const,
        fixed: 'right' as const,
        render: (_v: any, record: any, index: number) => {
          const pageRowIdx = (currentPage - 1) * currentPageSize + index;
          if (!allowDisassociation && !(record.__is_new__ || record.__is_stored__)) {
            return;
          }
          return (
            <div
              onMouseDown={(event: React.MouseEvent) => {
                const activeElement = document.activeElement as HTMLElement | null;
                if (!activeElement || event.currentTarget.contains(activeElement)) {
                  return;
                }
                activeElement.blur?.();
              }}
              onClick={() => {
                setTimeout(() => {
                  handleDelete(pageRowIdx);
                });
              }}
            >
              <CloseOutlined style={{ cursor: 'pointer', color: 'gray' }} />
            </div>
          );
        },
      },
    ])
    .filter(Boolean);

  const pagedDataSource = useMemo(() => {
    if (!currentValue.length) return [];

    const start = (currentPage - 1) * currentPageSize;
    return currentValue.slice(start, start + currentPageSize);
  }, [currentValue, currentPage, currentPageSize]);

  return (
    <Form.Item>
      <Table
        dataSource={pagedDataSource}
        columns={editableColumns}
        rowKey={(record: any) => getRecordIdentity(record) ?? ''}
        tableLayout="fixed"
        scroll={{ x: 'max-content' }}
        pagination={pagination}
        locale={{
          emptyText: (
            <span>
              {disabled
                ? t('No data')
                : allowAddNew && allowSelectExistingRecord
                  ? t('Please add or select record')
                  : allowAddNew
                    ? t('Please add record')
                    : allowSelectExistingRecord
                      ? t('Please select record')
                      : t('No data')}
            </span>
          ),
        }}
        components={components ?? {}}
        className={css`
          .ant-table-cell-ellipsis.ant-table-cell-fix-right-first .ant-table-cell-content {
            display: inline;
          }
          .ant-table-footer {
            padding: 0;
            button {
              margin-top: 4px !important;
              margin-bottom: 4px;
            }
          }
        `}
        footer={() => (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              minHeight: '36px',
            }}
          >
            <Space>
              {allowAddNew &&
                (allowCreate || isConfigMode) &&
                (allowCreate ? (
                  <Button type="link" onClick={handleAdd} disabled={disabled}>
                    <PlusOutlined />
                    {t('Add new')}
                  </Button>
                ) : (
                  <ActionWithoutPermission message={t('No permission to add new')} forbidden={{ actionName: 'create' }}>
                    <Button type="link" disabled>
                      <PlusOutlined />
                      {t('Add new')}
                    </Button>
                  </ActionWithoutPermission>
                ))}
              {allowSelectExistingRecord && (
                <Button
                  type="link"
                  onClick={() => onSelectExitRecordClick(setCurrentPage, currentPageSize)}
                  disabled={disabled}
                >
                  <ZoomInOutlined /> {t('Select record')}
                </Button>
              )}
            </Space>
          </div>
        )}
      />
    </Form.Item>
  );
}
