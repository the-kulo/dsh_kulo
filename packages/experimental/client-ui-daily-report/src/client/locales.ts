/** Locale namespace registered for the daily-report UI. */
export const NS = 'dailyReport'

/** English daily-report UI copy. */
export const en = {
  panel: 'Daily reports', title: 'Daily work reports', generate: 'Generate today', generating: 'Generating…',
  loading: 'Loading reports…', empty: 'No reports yet.', failed: 'Report generation failed.', noActivity: 'No activity in the work window.',
  completed: 'Completed', inProgress: 'In progress', blocked: 'Blocked', followUp: 'Follow-up', sources: 'Source sessions',
  none: 'None', retry: 'Retry',
} as const

/** Chinese daily-report UI copy. */
export const zh = {
  panel: '工作日报', title: '每日工作日报', generate: '生成今日日报', generating: '正在生成…',
  loading: '正在加载日报…', empty: '暂无日报。', failed: '日报生成失败。', noActivity: '工作时段内没有活动。',
  completed: '已完成', inProgress: '进行中', blocked: '阻塞', followUp: '后续', sources: '来源会话',
  none: '无', retry: '重试',
} as const

/** Keys shared by the daily-report locale dictionaries. */
export type DailyReportLocaleKey = keyof typeof en
