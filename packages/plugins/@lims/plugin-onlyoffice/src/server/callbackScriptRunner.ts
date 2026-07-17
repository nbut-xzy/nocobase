/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

// Compartment is available globally after SES lockdown() is called by NocoBase core.
// Do NOT import 'ses' here — it would try to lock down primordials a second time
// and fail with "Cannot redefine property: sliceToImmutable".
// Module-level declare (not declare global) to avoid TS2300 conflict with ses/types.d.ts.
declare let Compartment: new (endowments?: Record<string, any>) => {
  evaluate(code: string): any;
};

export interface CallbackScriptContext {
  /** OnlyOffice 回调请求体 */
  callbackBody: Record<string, any>;
  /** 原始数据行记录（区块所在的记录，可能为 null） */
  originalRecord: Record<string, any> | null;
  /** 原始数据行所在表名 */
  collectionName: string;
  /** 原始数据行 ID */
  recordId: number | null;
  /** 文件引用字段名（belongsTo 类型，指向文件表） */
  relationKeyField: string | null;
}

/**
 * 在 SES Compartment 沙箱中同步执行回调脚本
 *
 * 使用 NocoBase 原生的 SES Compartment 模式（参考 @nocobase/evaluators 的 formulajs.ts），
 * 提供安全隔离的执行环境，默认阻止 Function、eval、globalThis、process、require 等危险 API。
 *
 * @param code - 要执行的 JavaScript 代码
 * @param context - 脚本上下文变量
 * @returns 脚本返回值
 */
export function runCallbackScript(code: string, context: CallbackScriptContext): any {
  if (!code || !code.trim()) {
    return undefined;
  }

  const compartment = new Compartment({
    console,
    JSON,
    ...context,
  });

  return compartment.evaluate(`(function() { ${code} })()`);
}
