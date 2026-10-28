/** Locale bundles for the Model gateway settings page. */

import type { SettingsFormLabels } from '@deepseek-ai/dsh-client-ui-primitives'

/** Locale keys the page renders. */
export type ModelGatewayLocaleKey =
  | 'save' | 'saving' | 'saveFailed' | 'readOnly' | 'unavailable'
  | 'gatewayNav' | 'gatewayTitle' | 'gatewayDescription' | 'gatewayUnavailable'
  | 'gatewayEnabled' | 'gatewayEnabledHint'
  | 'routingTitle' | 'routingDescription'
  | 'routingZone' | 'routingCategory' | 'routingProvider' | 'routingModel' | 'routingTier'
  | 'routingAdd' | 'routingRemove'
  | 'zoneWorkspace' | 'zoneQuickQa' | 'zoneSecure'
  | 'categorySensitive' | 'categoryTest' | 'categoryBackend' | 'categoryFrontend'
  | 'categorySql' | 'categoryRelease' | 'categoryReasoning' | 'categorySimple'
  | 'tierExpert' | 'tierPool' | 'tierLocal'
  | 'expertQuotaTitle' | 'expertQuotaDailyCallLimit' | 'expertQuotaMaxEscalations' | 'expertQuotaContextBudget'
  | 'tokenBudgetTitle' | 'tokenBudgetDailyTotal' | 'tokenBudgetRegularShare' | 'tokenBudgetReviewShare' | 'tokenBudgetReserveShare'
  | 'tokenBudgetShareInvalid' | 'gatewayConflict'

/** English copy. */
export const en: Record<ModelGatewayLocaleKey, string> = {
  save: 'Save',
  saving: 'Saving…',
  saveFailed: 'The deployment did not accept these values; they were left for you to correct.',
  readOnly: 'This deployment stores settings read-only.',
  unavailable: 'This plugin is not loaded, so it cannot be configured right now.',
  gatewayNav: 'Model gateway',
  gatewayTitle: 'Model gateway',
  gatewayDescription: 'View and edit the model gateway routing table, expert quota, and token budget allocation.',
  gatewayUnavailable: 'Model gateway settings are not composed in this deployment.',
  gatewayEnabled: 'Enable gateway routing',
  gatewayEnabledHint: 'When enabled, the gateway routing policy resolves model routes for each zone and task category.',
  routingTitle: 'Routing table',
  routingDescription: 'Each row maps a zone and task category to a provider, model, and tier.',
  routingZone: 'Zone',
  routingCategory: 'Category',
  routingProvider: 'Provider',
  routingModel: 'Model',
  routingTier: 'Tier',
  routingAdd: 'Add route',
  routingRemove: 'Remove',
  zoneWorkspace: 'Workspace',
  zoneQuickQa: 'Quick QA',
  zoneSecure: 'Secure',
  categorySensitive: 'Sensitive',
  categoryTest: 'Test',
  categoryBackend: 'Backend',
  categoryFrontend: 'Frontend',
  categorySql: 'SQL',
  categoryRelease: 'Release',
  categoryReasoning: 'Reasoning',
  categorySimple: 'Simple',
  tierExpert: 'Expert',
  tierPool: 'Pool',
  tierLocal: 'Local',
  expertQuotaTitle: 'Expert quota',
  expertQuotaDailyCallLimit: 'Daily call limit',
  expertQuotaMaxEscalations: 'Max escalations per task',
  expertQuotaContextBudget: 'Context budget tokens',
  tokenBudgetTitle: 'Token budget',
  tokenBudgetDailyTotal: 'Daily total tokens',
  tokenBudgetRegularShare: 'Regular share',
  tokenBudgetReviewShare: 'Review share',
  tokenBudgetReserveShare: 'Reserve share',
  tokenBudgetShareInvalid: 'Shares must sum to 1.',
  gatewayConflict: 'Settings changed elsewhere. Discard your draft and try again.',
}

/** Simplified Chinese copy. */
export const zh: Record<ModelGatewayLocaleKey, string> = {
  save: '保存',
  saving: '保存中…',
  saveFailed: '本部署没有接受这些值，已保留供你修改。',
  readOnly: '本部署的设置为只读。',
  unavailable: '该插件当前未加载，暂时无法配置。',
  gatewayNav: '模型网关',
  gatewayTitle: '模型网关',
  gatewayDescription: '查看并修改模型网关的路由表、专家限额和 token 预算分配。',
  gatewayUnavailable: '当前部署未启用模型网关设置。',
  gatewayEnabled: '启用网关路由',
  gatewayEnabledHint: '启用后，网关路由策略会按区域和任务类别解析模型路由。',
  routingTitle: '路由表',
  routingDescription: '每行将一个区域和任务类别映射到提供方、模型和层级。',
  routingZone: '区域',
  routingCategory: '任务类别',
  routingProvider: '提供方',
  routingModel: '模型',
  routingTier: '层级',
  routingAdd: '新增路由',
  routingRemove: '移除',
  zoneWorkspace: '工作区',
  zoneQuickQa: '快速问答',
  zoneSecure: '安全',
  categorySensitive: '敏感',
  categoryTest: '测试',
  categoryBackend: '后端',
  categoryFrontend: '前端',
  categorySql: 'SQL',
  categoryRelease: '发布',
  categoryReasoning: '推理',
  categorySimple: '简单',
  tierExpert: '专家',
  tierPool: '池',
  tierLocal: '本地',
  expertQuotaTitle: '专家限额',
  expertQuotaDailyCallLimit: '每日调用上限',
  expertQuotaMaxEscalations: '单任务最大升级次数',
  expertQuotaContextBudget: '单轮上下文预算',
  tokenBudgetTitle: 'Token 预算',
  tokenBudgetDailyTotal: '每日总额',
  tokenBudgetRegularShare: '常规占比',
  tokenBudgetReviewShare: '复核占比',
  tokenBudgetReserveShare: '预留占比',
  tokenBudgetShareInvalid: '占比之和必须为 1。',
  gatewayConflict: '设置已在其他位置更新。请放弃修改后重试。',
}

/**
 * The form frame's copy, read from this page's dictionary.
 * @param t - the page's locale reader.
 * @returns the labels the shared settings form renders.
 */
export function formLabels(t: (key: ModelGatewayLocaleKey) => string): SettingsFormLabels {
  return { unavailable: t('unavailable'), readOnly: t('readOnly'), saveFailed: t('saveFailed'), save: t('save'), saving: t('saving') }
}
