/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { BaseColumnFieldOptions, DataTypes, Field, FieldContext, Model, Transactionable } from '@nocobase/database';
import { scopedSequencePatterns } from './scoped-sequence-patterns';

export interface PatternConfig {
  type: string;
  title?: string;
  options?: any;
}

export interface ScopedSequenceFieldOptions extends BaseColumnFieldOptions {
  type: 'scopedSequence';
  scopeField?: string;
}

export class ScopedSequenceField extends Field {
  matcher: RegExp | null = null;
  // resolved at load time, cached per collection+field
  private _scopeField: string | null = null;

  get dataType() {
    return DataTypes.STRING;
  }

  constructor(options: ScopedSequenceFieldOptions, context: FieldContext) {
    super(options, context);
    // No patterns validation at construction time — patterns come from
    // scopedSequenceRules at runtime per scope value.
  }

  /**
   * Resolve the scope value from the instance.
   * Returns null if no scopeField configured or scope value not present.
   */
  async resolveScope(instance: Model): Promise<string | null> {
    const scopeField = await this.getScopeField();
    if (!scopeField) {
      return null;
    }
    // The scopeField references a belongsTo/hasOne association field on the
    // same collection. The FK column is typically scopeField + 'Id'.
    // Try the field name, then try with 'Id' suffix.
    const value = instance.get(scopeField);
    if (value != null) {
      return String(value);
    }
    const fkValue = instance.get(scopeField + 'Id');
    if (fkValue != null) {
      return String(fkValue);
    }
    return null;
  }

  /**
   * Get the scopeField name from scopedSequenceFieldConfig (cached).
   */
  private async getScopeField(): Promise<string | null> {
    if (this._scopeField !== null) {
      return this._scopeField;
    }
    try {
      const repo = this.database.getRepository('scopedSequenceFieldConfig');
      const config = await repo.findOne({
        filter: {
          collectionName: this.collection.name,
          fieldName: this.name,
        },
      });
      this._scopeField = (config?.get('scopeField') as string | undefined) ?? '';
      return this._scopeField || null;
    } catch {
      // Table may not exist yet during initial sync
      return null;
    }
  }

  /**
   * Look up the encoding rules for a given scope value.
   */
  private async findRules(scope: string, transaction?: any) {
    try {
      const repo = this.database.getRepository('scopedSequenceRules');
      return repo.findOne({
        filter: {
          collectionName: this.collection.name,
          fieldName: this.name,
          scopeValue: scope,
          enabled: true,
        },
        transaction,
      });
    } catch {
      return null;
    }
  }

  /**
   * Build the matcher regex from a set of patterns.
   */
  private buildMatcher(patterns: PatternConfig[]): RegExp {
    const parts = patterns.map(({ type, options }) => scopedSequencePatterns.get(type).getMatcher(options));
    return new RegExp(`^${parts.map((p) => `(${p})`).join('')}$`, 'i');
  }

  // ---- Hook handlers ----

  setValue = async (instance: Model, options: Transactionable & { skipIndividualHooks?: Set<string> }) => {
    if (options.skipIndividualHooks?.has(`${this.collection.name}.beforeCreate.${this.name}`)) {
      return;
    }

    const { name, inputable } = this.options;
    const value = instance.get(name);

    // If user provided a value and field is inputable, skip generation
    if (value != null && inputable) {
      return;
    }

    // Resolve scope
    const scope = await this.resolveScope(instance);
    if (scope == null) {
      return; // No scope → leave field empty
    }

    // Look up rules for this scope
    const rule = await this.findRules(scope, options.transaction);
    if (!rule || !rule.get('patterns')?.length) {
      return; // No rules configured → leave field empty
    }

    const patterns = rule.get('patterns') as PatternConfig[];

    // Generate value by concatenating all patterns
    const results = await patterns.reduce(
      (promise, p) =>
        promise.then(async (result) => {
          const item = await scopedSequencePatterns
            .get(p.type)
            .generate.call(this, instance, { ...p.options, _scope: scope }, options);
          return result.concat(item);
        }),
      Promise.resolve([] as string[]),
    );

    instance.set(name, results.join(''));
  };

  setGroupValue = async (instances: Model[], options: Transactionable & { skipIndividualHooks?: Set<string> }) => {
    if (!instances.length) {
      return;
    }
    if (!options.skipIndividualHooks) {
      options.skipIndividualHooks = new Set();
    }
    options.skipIndividualHooks.add(`${this.collection.name}.beforeCreate.${this.name}`);

    const { name, inputable } = this.options;

    // Group instances by scope
    const scopeGroups = new Map<string | null, { instances: Model[]; patterns: PatternConfig[] | null }>();

    for (const instance of instances) {
      const value = instance.get(name);
      if (value != null && inputable) {
        continue;
      }

      const scope = await this.resolveScope(instance);
      const scopeKey = scope ?? '__null__';

      if (!scopeGroups.has(scopeKey)) {
        let patterns: PatternConfig[] | null = null;
        if (scope != null) {
          const rule = await this.findRules(scope, options.transaction);
          patterns = (rule?.get('patterns') as PatternConfig[] | undefined) ?? null;
        }
        scopeGroups.set(scopeKey, { instances: [], patterns });
      }

      const group = scopeGroups.get(scopeKey);
      if (group) {
        group.instances.push(instance);
      }
    }

    // Generate values per scope group
    for (const [, group] of scopeGroups) {
      if (!group.patterns || group.instances.length === 0) {
        continue;
      }

      const array: string[][] = Array(group.patterns.length)
        .fill(null)
        .map(() => Array(group.instances.length));

      // Resolve scope from first instance in group
      const firstScope = await this.resolveScope(group.instances[0]);

      await group.patterns.reduce(
        (promise, p, i) =>
          promise.then(() =>
            scopedSequencePatterns
              .get(p.type)
              .batchGenerate.call(
                this,
                group.instances,
                array[i],
                { ...p.options, _scope: firstScope ?? '__default__' },
                options,
              ),
          ),
        Promise.resolve(),
      );

      group.instances.forEach((instance, i) => {
        instance.set(name, array.map((a) => a[i]).join(''));
      });
    }
  };

  cleanHook = (_instances: Model[], options: { skipIndividualHooks?: Set<string> }) => {
    options.skipIndividualHooks?.delete(`${this.collection.name}.beforeCreate.${this.name}`);
  };

  // ---- Lifecycle ----

  bind() {
    super.bind();
    this.on('beforeCreate', this.setValue);
    this.on('beforeBulkCreate', this.setGroupValue);
    this.on('afterBulkCreate', this.cleanHook);
  }

  unbind() {
    super.unbind();
    this.off('beforeCreate', this.setValue);
    this.off('beforeBulkCreate', this.setGroupValue);
    this.off('afterBulkCreate', this.cleanHook);
  }
}
