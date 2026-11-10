/** Locale bundles for the Subagent settings page. */

import type { SettingsFormLabels } from '@deepseek-ai/dsh-client-ui-primitives'

/** Locale keys the page renders. */
export type SubagentSettingsLocaleKey =
  | 'overridden' | 'reset' | 'readOnly' | 'unavailable'
  | 'save' | 'saving' | 'saveFailed'
  | 'subagentTitle' | 'subagentDescription' | 'subagentLimitsTitle'
  | 'subagentMaxDepth'
  | 'subagentDepthHelpLabel' | 'subagentDepthHelp'
  | 'subagentDepthZero' | 'subagentDepthOne' | 'subagentDepthOverride'
  | 'subagentMaxActive'
  | 'subagentCapacityHelpLabel' | 'subagentCapacityHelp'
  | 'subagentDepthInvalid'
  | 'subagentCapacityInvalid'
  | 'subagentModelSelectionTitle'
  | 'subagentModelSelectionToggle' | 'subagentModelSelectionChoose' | 'subagentModelSelectionAllowed'
  | 'subagentModelSelectionLoading' | 'subagentModelSelectionLoadFailed' | 'subagentModelSelectionRetry'
  | 'subagentModelSelectionPartial' | 'subagentModelSelectionUnavailable'
  | 'subagentModelSelectionUnavailableGroup' | 'subagentModelSelectionEmpty'
  | 'subagentModelSelectionRequired' | 'subagentModelSelectionConflict' | 'subagentModelSelectionOff'
  | 'subagentModelSelectionAutoSelect' | 'subagentModelSelectionAutoSelectHint'
  | 'subagentModelSelectionCapabilityTags' | 'subagentModelSelectionCapabilityTagsHint'
  | 'subagentModelSelectionCapabilityTagsValues' | 'subagentModelSelectionCapabilityAutoSelectable'
  | 'subagentModelSelectionCapabilityPriority' | 'subagentModelSelectionCapabilityPriorityHint'
  | 'subagentModelSelectionCapabilityCost' | 'subagentModelSelectionCapabilityCostFree'
  | 'subagentModelSelectionCapabilityCostLow' | 'subagentModelSelectionCapabilityCostStandard'
  | 'subagentModelSelectionCapabilityCostHigh' | 'subagentModelSelectionCapabilitySpeed'
  | 'subagentModelSelectionCapabilitySpeedFast' | 'subagentModelSelectionCapabilitySpeedBalanced'
  | 'subagentModelSelectionCapabilitySpeedSlow' | 'subagentModelSelectionCapabilityTierUndeclared'
  | 'subagentModelSelectionUsage' | 'subagentModelSelectionUsageValue' | 'subagentModelSelectionUsageUnavailable'
  | 'subagentModelSelectionRoutingRules' | 'subagentModelSelectionRuleSensitive'
  | 'subagentModelSelectionRuleSensitiveText' | 'subagentModelSelectionRuleCode'
  | 'subagentModelSelectionRuleCodeText' | 'subagentModelSelectionRuleReasoning'
  | 'subagentModelSelectionRuleReasoningText' | 'subagentModelSelectionRuleSimple'
  | 'subagentModelSelectionRuleSimpleText' | 'subagentModelSelectionRoutingSort'
  | 'modelPoolNav' | 'modelPoolTitle' | 'modelPoolDescription' | 'modelPoolUnavailable'

/** English copy. */
export const en: Record<SubagentSettingsLocaleKey, string> = {
  overridden: 'Overridden',
  reset: 'Reset to default',
  readOnly: 'This deployment stores settings read-only.',
  unavailable: 'This plugin is not loaded, so it cannot be configured right now.',
  save: 'Save',
  saving: 'Saving…',
  saveFailed: 'The deployment did not accept these values; they were left for you to correct.',
  subagentTitle: 'Subagent',
  subagentDescription: 'Set Subagent recursion depth, count, and models.',
  subagentLimitsTitle: 'Limits',
  subagentMaxDepth: 'Maximum recursion depth',
  subagentDepthHelpLabel: 'About maximum recursion depth',
  subagentDepthHelp: 'Limits how many levels of Subagents an Agent can create.',
  subagentDepthZero: 'Disable Subagents',
  subagentDepthOne: 'Only the main Agent can create Subagents',
  subagentDepthOverride: 'If a tool defines its own maximum recursion depth, that setting takes precedence.',
  subagentMaxActive: 'Subagent parallelism limit',
  subagentCapacityHelpLabel: 'About the Subagent parallelism limit',
  subagentCapacityHelp: 'Total live Subagents under the same main Agent, across all recursion levels. The main Agent is excluded. New start requests are rejected when the limit is reached.',
  subagentDepthInvalid: 'Enter a whole number of 0 or more.',
  subagentCapacityInvalid: 'Enter a whole number of 1 or more.',
  subagentModelSelectionTitle: 'Model selection',
  subagentModelSelectionToggle: 'Allow agents to choose models for Subagents',
  subagentModelSelectionChoose: 'When enabled, agents can choose a provider, model, and reasoning effort for each Subagent from the authorized models below. Applies only to new sessions.',
  subagentModelSelectionAllowed: 'Models agents may choose',
  subagentModelSelectionLoading: 'Loading models…',
  subagentModelSelectionLoadFailed: 'Models could not be loaded.',
  subagentModelSelectionRetry: 'Retry',
  subagentModelSelectionPartial: 'Some model providers could not be loaded; saved choices remain removable.',
  subagentModelSelectionUnavailable: 'Currently unavailable',
  subagentModelSelectionUnavailableGroup: 'Saved but currently unavailable',
  subagentModelSelectionEmpty: 'No model provider currently advertises a model.',
  subagentModelSelectionRequired: 'Select at least one model before saving.',
  subagentModelSelectionConflict: 'Settings changed elsewhere. Discard your draft and try again.',
  subagentModelSelectionOff: 'Subagents use configured defaults or inherit the parent agent\'s model. Saved model choices are retained.',
  subagentModelSelectionAutoSelect: 'Automatically select models for subagents',
  subagentModelSelectionAutoSelectHint: 'Route tasks to models tagged flash, code, or reasoning. Explicit model choices take precedence.',
  subagentModelSelectionCapabilityTags: 'Specialties',
  subagentModelSelectionCapabilityTagsHint: 'flash, code, reasoning',
  subagentModelSelectionCapabilityTagsValues: 'Automatic routing matches flash, code, and reasoning (case-insensitive); leave empty for manual-only use.',
  subagentModelSelectionCapabilityAutoSelectable: 'Available for automatic selection',
  subagentModelSelectionCapabilityPriority: 'Priority',
  subagentModelSelectionCapabilityPriorityHint: 'Whole number; higher wins among models that share a specialty.',
  subagentModelSelectionCapabilityCost: 'Declared price tier',
  subagentModelSelectionCapabilityCostFree: 'Free',
  subagentModelSelectionCapabilityCostLow: 'Low',
  subagentModelSelectionCapabilityCostStandard: 'Standard',
  subagentModelSelectionCapabilityCostHigh: 'High',
  subagentModelSelectionCapabilitySpeed: 'Declared speed tier',
  subagentModelSelectionCapabilitySpeedFast: 'Fast',
  subagentModelSelectionCapabilitySpeedBalanced: 'Balanced',
  subagentModelSelectionCapabilitySpeedSlow: 'Slow',
  subagentModelSelectionCapabilityTierUndeclared: 'Undeclared',
  subagentModelSelectionUsage: 'Last 7 days',
  subagentModelSelectionUsageValue: '{requests} requests · {tokens} tokens',
  subagentModelSelectionUsageUnavailable: 'Usage unavailable',
  subagentModelSelectionRoutingRules: 'Automatic routing rules',
  subagentModelSelectionRuleSensitive: 'sensitive',
  subagentModelSelectionRuleSensitiveText: 'Keywords about credentials and secrets always route to LKL-GLM-5.2-FP8.',
  subagentModelSelectionRuleCode: 'code',
  subagentModelSelectionRuleCodeText: 'Keywords about code and building select a model tagged code.',
  subagentModelSelectionRuleReasoning: 'reasoning',
  subagentModelSelectionRuleReasoningText: 'Keywords about analysis and planning select a model tagged reasoning.',
  subagentModelSelectionRuleSimple: 'simple',
  subagentModelSelectionRuleSimpleText: 'Other tasks select a model tagged flash. Categories never fall back to another tag.',
  subagentModelSelectionRoutingSort: 'Within a tag, automatic routing prefers higher priority, then lower declared price, then faster declared speed; undeclared tiers sort last, and remaining ties follow provider/model id order.',
  modelPoolNav: 'Model Pool',
  modelPoolTitle: 'Model Pool',
  modelPoolDescription: 'Choose the models subagents may use, tag them by purpose for automatic routing, and toggle automatic selection.',
  modelPoolUnavailable: 'Subagent model selection is not composed in this deployment.',
}

/** Simplified Chinese copy. */
export const zh: Record<SubagentSettingsLocaleKey, string> = {
  overridden: '已覆盖',
  reset: '恢复默认',
  readOnly: '本部署的设置为只读。',
  unavailable: '该插件当前未加载，暂时无法配置。',
  save: '保存',
  saving: '保存中…',
  saveFailed: '本部署没有接受这些值，已保留供你修改。',
  subagentTitle: '子智能体',
  subagentDescription: '设置子智能体的递归层级、数量和模型。',
  subagentLimitsTitle: '运行限制',
  subagentMaxDepth: '最大递归深度',
  subagentDepthHelpLabel: '最大递归深度说明',
  subagentDepthHelp: '限制 Agent 创建子智能体的递归层级。',
  subagentDepthZero: '禁用子智能体',
  subagentDepthOne: '仅允许主 Agent 创建子智能体',
  subagentDepthOverride: '如果某个工具单独设置了最大递归深度，以该工具的设置为准。',
  subagentMaxActive: '子智能体并行数量上限',
  subagentCapacityHelpLabel: '子智能体并行数量上限说明',
  subagentCapacityHelp: '同一主 Agent 下，所有递归层级同时存活的子智能体总数，主 Agent 不计入。达到上限时，新的启动请求会被拒绝。',
  subagentDepthInvalid: '请输入不小于 0 的整数。',
  subagentCapacityInvalid: '请输入不小于 1 的整数。',
  subagentModelSelectionTitle: '模型选择',
  subagentModelSelectionToggle: '允许 Agent 为子智能体选择模型',
  subagentModelSelectionChoose: '开启后，Agent 可以从下方授权模型中，为每个子智能体选择提供方、模型和推理强度。仅影响新会话。',
  subagentModelSelectionAllowed: 'Agent 可选择的模型',
  subagentModelSelectionLoading: '正在加载模型…',
  subagentModelSelectionLoadFailed: '无法加载模型。',
  subagentModelSelectionRetry: '重试',
  subagentModelSelectionPartial: '部分模型提供方暂时无法加载；已保存的选择仍可移除。',
  subagentModelSelectionUnavailable: '当前不可用',
  subagentModelSelectionUnavailableGroup: '已保存但当前不可用',
  subagentModelSelectionEmpty: '当前没有模型提供方公布模型。',
  subagentModelSelectionRequired: '保存前请至少选择一个模型。',
  subagentModelSelectionConflict: '设置已在其他位置更新。请放弃修改后重试。',
  subagentModelSelectionOff: '关闭后，子智能体使用配置的默认模型或继承父 Agent 的模型；已选模型会保留。',
  subagentModelSelectionAutoSelect: '自动为子智能体选择模型',
  subagentModelSelectionAutoSelectHint: '按任务选择标记为 flash、code 或 reasoning 的模型；显式指定的模型优先。',
  subagentModelSelectionCapabilityTags: '擅长方向',
  subagentModelSelectionCapabilityTagsHint: 'flash, code, reasoning',
  subagentModelSelectionCapabilityTagsValues: '自动路由按 flash、code、reasoning 匹配（不区分大小写）；留空表示仅手动选择。',
  subagentModelSelectionCapabilityAutoSelectable: '可用于自动选择',
  subagentModelSelectionCapabilityPriority: '优先序',
  subagentModelSelectionCapabilityPriorityHint: '整数；相同擅长方向中数值大者优先。',
  subagentModelSelectionCapabilityCost: '声明的价格档',
  subagentModelSelectionCapabilityCostFree: '免费',
  subagentModelSelectionCapabilityCostLow: '低',
  subagentModelSelectionCapabilityCostStandard: '标准',
  subagentModelSelectionCapabilityCostHigh: '高',
  subagentModelSelectionCapabilitySpeed: '声明的速度档',
  subagentModelSelectionCapabilitySpeedFast: '快',
  subagentModelSelectionCapabilitySpeedBalanced: '均衡',
  subagentModelSelectionCapabilitySpeedSlow: '慢',
  subagentModelSelectionCapabilityTierUndeclared: '未声明',
  subagentModelSelectionUsage: '近 7 天用量',
  subagentModelSelectionUsageValue: '{requests} 次请求 · {tokens} tokens',
  subagentModelSelectionUsageUnavailable: '用量不可用',
  subagentModelSelectionRoutingRules: '自动路由规则',
  subagentModelSelectionRuleSensitive: '敏感',
  subagentModelSelectionRuleSensitiveText: '包含凭据、密钥等关键词的任务固定路由到 LKL-GLM-5.2-FP8。',
  subagentModelSelectionRuleCode: '代码',
  subagentModelSelectionRuleCodeText: '包含代码、构建等关键词的任务选择带 code 标签的模型。',
  subagentModelSelectionRuleReasoning: '推理',
  subagentModelSelectionRuleReasoningText: '包含分析、规划等关键词的任务选择带 reasoning 标签的模型。',
  subagentModelSelectionRuleSimple: '简单',
  subagentModelSelectionRuleSimpleText: '其余任务选择带 flash 标签的模型；各分类不会回退到其他标签。',
  subagentModelSelectionRoutingSort: '同一标签内按优先序降序、声明价格由低到高、声明速度由快到慢排序；未声明的档位排最后，其余并列按 provider/model 字典序。',
  modelPoolNav: 'Model Pool',
  modelPoolTitle: 'Model Pool',
  modelPoolDescription: '选择子智能体可用的模型，按用途标记以支持自动路由，并可开启自动选择。',
  modelPoolUnavailable: '当前部署未启用子代理模型选择。',
}

/**
 * The form frame's copy, read from this page's dictionary.
 * @param t - the page's locale reader.
 * @returns the labels the shared settings form renders.
 */
export function formLabels(t: (key: SubagentSettingsLocaleKey) => string): SettingsFormLabels {
  return { unavailable: t('unavailable'), readOnly: t('readOnly'), saveFailed: t('saveFailed'), save: t('save'), saving: t('saving') }
}
