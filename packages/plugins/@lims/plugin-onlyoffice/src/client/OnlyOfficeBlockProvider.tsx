/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import {
  SchemaComponentOptions,
  BlockProvider,
  withDynamicSchemaProps,
  RecordProvider,
  BlockItem,
  useBlockRequestContext,
} from '@nocobase/client';
import React from 'react';
import { OnlyOffice } from './OnlyOffice';
import { OnlyOfficeBlockInitializer } from './OnlyOfficeBlockInitializer';
import { useOnlyOfficeDecoratorProps } from './hooks/useOnlyOfficeDecoratorProps';

/**
 * Internal provider that wraps the fetched record data in RecordProvider
 * so it's available to useCollectionRecordData() in the OnlyOffice component.
 */
const InternalOnlyOfficeBlockProvider = (props: any) => {
  const { resource, service } = useBlockRequestContext();
  const currentRecord = service?.data?.data || {};

  return (
    <RecordProvider isNew={false} record={currentRecord}>
      <BlockItem name={props.name || 'onlyoffice'}>{props.children}</BlockItem>
    </RecordProvider>
  );
};

/**
 * Block decorator for OnlyOffice v1.
 *
 * Mode A (collection configured): wraps in BlockProvider → DataBlockProvider chain
 *   to provide self-contained data fetching and record context.
 * Mode B (no collection): renders BlockItem wrapper only (current behavior).
 */
const OnlyOfficeBlockProviderDecorator = withDynamicSchemaProps((props: any) => {
  const { collection, dataSource, ...restProps } = props;

  if (!collection) {
    // Mode B: no collection configured — just wrap in BlockItem
    return <BlockItem name={restProps.name || 'onlyoffice'}>{props.children}</BlockItem>;
  }

  // Mode A: full data block with collection
  return (
    <BlockProvider name="onlyoffice" collection={collection} dataSource={dataSource} action="get" {...restProps}>
      <InternalOnlyOfficeBlockProvider name={restProps.name}>{props.children}</InternalOnlyOfficeBlockProvider>
    </BlockProvider>
  );
});

OnlyOfficeBlockProviderDecorator.displayName = 'OnlyOfficeBlockProvider';

// Used as x-decorator in Formily schemas
export const OnlyOfficeBlockProvider = OnlyOfficeBlockProviderDecorator;

/**
 * Registers OnlyOffice components, the new block decorator, and the decorator-props hook
 * into the Formily schema scope. Used via app.use() in the plugin entry.
 */
export const OnlyOfficeSchemaComponentProvider = (props: any) => {
  return (
    <SchemaComponentOptions
      components={{
        OnlyOffice,
        OnlyOfficeBlockInitializer,
        OnlyOfficeBlockProvider: OnlyOfficeBlockProviderDecorator,
      }}
      scope={{ useOnlyOfficeDecoratorProps }}
    >
      {props.children}
    </SchemaComponentOptions>
  );
};
