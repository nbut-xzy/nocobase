/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Model, Transactionable } from '@nocobase/database';
import { Registry } from '@nocobase/utils';
import parser from 'cron-parser';
import dayjs from 'dayjs';
import lodash from 'lodash';
import type { ScopedSequenceField } from './scoped-sequence-field';

export interface Pattern {
  validate?(options): string | null;
  generate(
    this: ScopedSequenceField,
    instance: Model,
    opts: { [key: string]: any },
    options: Transactionable,
  ): Promise<string> | string;
  batchGenerate(
    this: ScopedSequenceField,
    instances: Model[],
    values: string[],
    opts: { [key: string]: any },
    options: Transactionable,
  ): Promise<void> | void;
  getLength(options): number;
  getMatcher(options): string;
  update?(
    this: ScopedSequenceField,
    instance: Model,
    value: string,
    options,
    transactionable: Transactionable & { overwrite?: boolean },
  ): Promise<void>;
}

export const scopedSequencePatterns = new Registry<Pattern>();

// ---- string pattern (stateless, same as built-in) ----

scopedSequencePatterns.register('string', {
  validate(options) {
    if (!options?.value) {
      return 'options.value should be configured as a non-empty string';
    }
    return null;
  },
  generate(_instance, options) {
    return options.value;
  },
  batchGenerate(instances, values, options) {
    instances.forEach((_instance, i) => {
      values[i] = options.value;
    });
  },
  getLength(options) {
    return options.value.length;
  },
  getMatcher(options) {
    return lodash.escapeRegExp(options.value);
  },
});

// ---- integer pattern (scope-aware, uses scopedSequences table) ----

scopedSequencePatterns.register('integer', {
  async generate(this: ScopedSequenceField, instance: Model, options, { transaction }) {
    const recordTime = <Date>instance.get('createdAt') ?? new Date();
    const { digits = 1, start = 0, base = 10, cycle, key, _scope } = options;
    const { repository: SeqRepo, model: SeqModel } = this.database.getCollection('scopedSequences');

    const filter = {
      collection: this.collection.name,
      field: this.name,
      key,
      scope: _scope,
    };

    // Standard path: findOne + save
    let lastSeq = await SeqRepo.findOne({ filter, transaction });

    // ============================================================
    // CONCURRENCY HARDENING (commented out by default):
    //   If testing reveals duplicate sequence numbers under concurrent
    //   creation for the same scope, uncomment the block below and
    //   comment out the findOne call above to enable FOR UPDATE row lock.
    //
    // let lastSeq = await SeqRepo.findOne({
    //   filter,
    //   transaction,
    //   // @ts-ignore Sequelize findOptions
    //   lock: transaction.LOCK.UPDATE,
    // });
    // ============================================================

    if (!lastSeq) {
      lastSeq = SeqModel.build({
        collection: this.collection.name,
        field: this.name,
        key,
        scope: _scope,
      });
    }

    let next = start;
    if (lastSeq.get('current') != null) {
      const bn = BigInt(lastSeq.get('current')) + 1n;
      next = bn > start ? bn : start;
      const max = BigInt(base) ** BigInt(digits) - 1n;
      if (next > max) {
        next = start;
      }

      if (cycle) {
        const interval = parser.parseExpression(cycle, { currentDate: <Date>lastSeq.get('lastGeneratedAt') });
        const nextTime = interval.next();
        if (recordTime.getTime() >= nextTime.getTime()) {
          next = start;
        }
      }
    }

    lastSeq.set({
      current: next,
      lastGeneratedAt: recordTime,
    });
    await lastSeq.save({ transaction });

    const num = typeof next === 'bigint' ? next : BigInt(next);
    return num.toString(base).padStart(digits, '0');
  },

  getLength({ digits = 1 } = {}) {
    return digits;
  },

  getMatcher(options = {}) {
    const { digits = 1, base = 10 } = options;
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, base);
    return `[${chars}]{${digits}}`;
  },

  async batchGenerate(this: ScopedSequenceField, instances, values, options, { transaction }) {
    const { digits = 1, start = 0, base = 10, cycle, key, _scope } = options;
    const { repository: SeqRepo, model: SeqModel } = this.database.getCollection('scopedSequences');

    const filter = {
      collection: this.collection.name,
      field: this.name,
      key,
      scope: _scope,
    };

    let lastSeq = await SeqRepo.findOne({ filter, transaction });
    if (!lastSeq) {
      lastSeq = SeqModel.build({
        collection: this.collection.name,
        field: this.name,
        key,
        scope: _scope,
      });
    }

    instances.forEach((instance, i) => {
      const recordTime = <Date>instance.get('createdAt') ?? new Date();
      const value = instance.get(this.options.name);
      if (value != null && this.options.inputable) {
        return;
      }

      let next = start;
      if (lastSeq.get('current') != null) {
        next = Math.max(lastSeq.get('current') + 1, start);
        const max = Math.pow(base, digits) - 1;
        if (next > max) {
          next = start;
        }

        if (cycle) {
          const interval = parser.parseExpression(cycle, { currentDate: <Date>lastSeq.get('lastGeneratedAt') });
          const nextTime = interval.next();
          if (recordTime.getTime() >= nextTime.getTime()) {
            next = start;
          }
        }
      }
      lastSeq.set({
        current: next,
        lastGeneratedAt: recordTime,
      });
      values[i] = next.toString(base).padStart(digits, '0');
    });

    await lastSeq.save({ transaction });
  },

  async update(this: ScopedSequenceField, instance, value, options, { transaction, overwrite }) {
    const recordTime = <Date>instance.get('createdAt') ?? new Date();
    const { digits = 1, start = 0, base = 10, cycle, key, _scope } = options;
    const SeqRepo = this.database.getRepository('scopedSequences');

    const filter = {
      collection: this.collection.name,
      field: this.name,
      key,
      scope: _scope,
    };

    const lastSeq = await SeqRepo.findOne({ filter, transaction });
    const current = parseBigInt(value, base);

    if (!lastSeq) {
      return SeqRepo.create({
        values: {
          collection: this.collection.name,
          field: this.name,
          key,
          scope: _scope,
          current,
          lastGeneratedAt: recordTime,
        },
        transaction,
      });
    }
    if (lastSeq.get('current') == null) {
      return lastSeq.update({ current, lastGeneratedAt: recordTime }, { transaction });
    }
    if (overwrite === true) {
      return lastSeq.update({ current, lastGeneratedAt: recordTime }, { transaction });
    }

    if (cycle) {
      const interval = parser.parseExpression(cycle, { currentDate: <Date>lastSeq.get('lastGeneratedAt') });
      const nextTime = interval.next();
      if (recordTime.getTime() >= nextTime.getTime()) {
        lastSeq.set({ current, lastGeneratedAt: recordTime });
      } else if (current > lastSeq.get('current')) {
        lastSeq.set({ current, lastGeneratedAt: recordTime });
      }
    } else if (current > lastSeq.get('current')) {
      lastSeq.set({ current, lastGeneratedAt: recordTime });
    }

    return lastSeq.save({ transaction });
  },
});

function parseBigInt(str: string, radix = 10) {
  if (typeof str !== 'string') throw new TypeError('Input must be a string');
  if (typeof radix !== 'number' || radix < 2 || radix > 36) throw new RangeError('Radix must be between 2 and 36');

  let negative = false;
  if (str.startsWith('-')) {
    negative = true;
    str = str.slice(1);
  }

  const chars = str.toLowerCase();
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz';

  let result = 0n;
  for (const ch of chars) {
    const value = BigInt(digits.indexOf(ch));
    if (value < 0n || value >= BigInt(radix)) throw new SyntaxError(`Invalid digit "${ch}" for base ${radix}`);
    result = result * BigInt(radix) + value;
  }

  return negative ? -result : result;
}

// ---- date pattern (stateless, same as built-in) ----

scopedSequencePatterns.register('date', {
  generate(this: ScopedSequenceField, instance, options) {
    return dayjs(instance.get(options?.field ?? 'createdAt')).format(options?.format ?? 'YYYYMMDD');
  },
  batchGenerate(instances, values, options) {
    const { field, inputable } = options;
    instances.forEach((instance, i) => {
      if (!inputable || instance.get(field ?? 'createdAt') == null) {
        values[i] = dayjs(instance.get(field ?? 'createdAt')).format(options?.format ?? 'YYYYMMDD');
      }
    });
  },
  getLength(options) {
    return options.format?.length ?? 8;
  },
  getMatcher(options = {}) {
    return `.{${options?.format?.length ?? 8}}`;
  },
});

// ---- randomChar pattern (stateless, same as built-in) ----

const CHAR_SETS = {
  number: '0123456789',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  symbol: '!@#$%^&*_-+',
} as const;

scopedSequencePatterns.register('randomChar', {
  validate(options) {
    if (!options?.length || options.length < 1) {
      return 'options.length should be configured as a positive integer';
    }
    if (!options?.charsets || options.charsets.length === 0) {
      return 'At least one character set should be selected';
    }
    if (options.charsets.some((charset) => !CHAR_SETS[charset])) {
      return 'Invalid charset selected';
    }
    return null;
  },

  generate(_instance, options) {
    const { length = 6, charsets = ['number'] } = options;
    const chars = [...new Set(charsets.reduce((acc, charset) => acc + CHAR_SETS[charset], ''))];
    const getRandomChar = () => {
      const randomIndex = Math.floor(Math.random() * chars.length);
      return chars[randomIndex];
    };
    return Array.from({ length }, () => getRandomChar()).join('');
  },

  batchGenerate(instances, values, options) {
    const { length = 6, charsets = ['number'] } = options;
    const chars = [...new Set(charsets.reduce((acc, charset) => acc + CHAR_SETS[charset], ''))];
    const getRandomChar = () => chars[Math.floor(Math.random() * chars.length)];
    instances.forEach((_instance, i) => {
      values[i] = Array.from({ length }, () => getRandomChar()).join('');
    });
  },

  getLength(options) {
    return options.length || 6;
  },

  getMatcher(options) {
    const pattern = [
      ...new Set(
        (options.charsets || ['number']).reduce((acc, charset) => {
          switch (charset) {
            case 'number':
              return acc + '0-9';
            case 'lowercase':
              return acc + 'a-z';
            case 'uppercase':
              return acc + 'A-Z';
            case 'symbol':
              return acc + CHAR_SETS.symbol.replace('-', '').replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '-';
            default:
              return acc;
          }
        }, ''),
      ),
    ].join('');
    return `[${pattern}]{${options.length || 6}}`;
  },
});

// ---- field pattern (NEW: reads a field value from the record) ----

scopedSequencePatterns.register('field', {
  validate(options) {
    if (!options?.field) {
      return 'options.field should be configured as a non-empty string';
    }
    return null;
  },

  generate(_instance, options) {
    const raw = lodash.get(_instance.toJSON(), options.field) ?? '';
    const str = String(raw);
    const start = options.start ?? 0;
    const end = options.end;
    return end != null ? str.slice(start, end) : str.slice(start);
  },

  batchGenerate(instances, values, options) {
    instances.forEach((instance, i) => {
      const raw = lodash.get(instance.toJSON(), options.field) ?? '';
      const str = String(raw);
      const start = options.start ?? 0;
      const end = options.end;
      values[i] = end != null ? str.slice(start, end) : str.slice(start);
    });
  },

  getLength(options) {
    if (options.end != null) {
      return options.end - (options.start ?? 0);
    }
    return undefined as unknown as number;
  },

  getMatcher(_options) {
    // Dynamic field value cannot be precisely matched; use loose capture
    return '(.+?)';
  },
});
