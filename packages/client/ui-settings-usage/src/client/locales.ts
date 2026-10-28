/** Locale bundles for the token usage Settings dashboard. */

export type UsageLocaleKey =
  | 'locale' | 'title' | 'date' | 'allHistory' | 'today'
  | 'loadFailed' | 'retry' | 'emptyTitle' | 'emptyDescription' | 'incomplete'
  | 'kimi' | 'lakala' | 'other' | 'requests' | 'totalTokens' | 'tokens' | 'input' | 'cached' | 'output' | 'model'
  | 'weekday' | 'legendLess' | 'legendMore' | 'dayTotal'

/** English strings for every usage dashboard locale key. */
export const en: Record<UsageLocaleKey, string> = {
  locale: 'en-US',
  title: 'Token usage',
  date: 'Usage date',
  allHistory: 'All history',
  today: 'Today',
  loadFailed: 'Token usage could not be loaded.',
  retry: 'Retry',
  emptyTitle: 'No token usage yet',
  emptyDescription: 'Usage appears after a model reports tokens for this period.',
  incomplete: 'Some usage was omitted because its actual provider or model was unavailable.',
  kimi: 'Kimi',
  lakala: 'Lakala',
  other: 'Other providers',
  requests: '{count} requests',
  totalTokens: 'Total tokens',
  tokens: 'Tokens',
  input: 'Input',
  cached: 'Cached',
  output: 'Output',
  model: 'Model / route',
  weekday: 'W',
  legendLess: 'Less',
  legendMore: 'More',
  dayTotal: '{total} tokens · {requests} requests',
}

/** Simplified Chinese strings for every usage dashboard locale key. */
export const zh: Record<UsageLocaleKey, string> = {
  locale: 'zh-CN',
  title: 'Token 用量',
  date: '用量日期',
  allHistory: '全部历史',
  today: '今天',
  loadFailed: '无法加载 Token 用量',
  retry: '重试',
  emptyTitle: '暂无 Token 用量',
  emptyDescription: '模型报告此时间段的 Token 用量后会显示在这里。',
  incomplete: '部分用量因缺少实际提供商或模型信息而未计入',
  kimi: 'Kimi',
  lakala: 'Lakala',
  other: '其他提供商',
  requests: '{count} 次请求',
  totalTokens: '总 Token',
  tokens: 'Token',
  input: '输入',
  cached: '缓存',
  output: '输出',
  model: '模型 / 路由',
  weekday: '一',
  legendLess: '少',
  legendMore: '多',
  dayTotal: '{total} Token · {requests} 次请求',
}

/** Japanese dashboard strings, with untranslated labels inherited from English. */
export const ja = { ...en,
  locale: 'ja-JP', title: 'トークン使用量',
  date: '使用日', allHistory: '全履歴', today: '今日',
  loadFailed: 'トークン使用量を読み込めませんでした。', retry: '再試行', emptyTitle: 'トークン使用量はまだありません',
  emptyDescription: 'この期間にモデルがトークンを報告すると表示されます。', incomplete: 'ルートを特定できない使用量は除外されました。',
  kimi: 'Kimi', lakala: 'Lakala',
  other: 'その他のプロバイダー', requests: '{count} リクエスト', totalTokens: '合計トークン', tokens: 'トークン',
  input: '入力', cached: 'キャッシュ', output: '出力', model: 'モデル / ルート',
  weekday: '月', legendLess: '少', legendMore: '多', dayTotal: '{total} トークン · {requests} リクエスト',
} satisfies Record<UsageLocaleKey, string>

/** Localized dashboard strings, with untranslated labels inherited from English. */
export const es = { ...en,
  locale: 'es-ES', title: 'Uso de tokens',
  date: 'Fecha de uso', allHistory: 'Todo el historial', today: 'Hoy',
  loadFailed: 'No se pudo cargar el uso de tokens.', retry: 'Reintentar', emptyTitle: 'Aún no hay uso de tokens',
  emptyDescription: 'Aparecerá cuando un modelo informe tokens para este período.', incomplete: 'Se omitió uso sin proveedor o modelo identificable.',
  kimi: 'Kimi', lakala: 'Lakala',
  other: 'Otros proveedores', requests: '{count} solicitudes', totalTokens: 'Tokens totales', tokens: 'Tokens',
  input: 'Entrada', cached: 'Caché', output: 'Salida', model: 'Modelo / ruta',
  weekday: 'L', legendLess: 'Menos', legendMore: 'Más', dayTotal: '{total} tokens · {requests} solicitudes',
} satisfies Record<UsageLocaleKey, string>

/** Localized dashboard strings, with untranslated labels inherited from English. */
export const fr = { ...en,
  locale: 'fr-FR', title: 'Utilisation des tokens',
  date: 'Date d’utilisation', allHistory: 'Tout l’historique', today: 'Aujourd’hui',
  loadFailed: 'Impossible de charger l’utilisation des tokens.', retry: 'Réessayer', emptyTitle: 'Aucune utilisation de tokens',
  emptyDescription: 'Elle apparaîtra après la déclaration de tokens pour cette période.', incomplete: 'Une partie de l’utilisation sans route identifiable a été omise.',
  kimi: 'Kimi', lakala: 'Lakala',
  other: 'Autres fournisseurs', requests: '{count} requêtes', totalTokens: 'Tokens au total', tokens: 'Tokens',
  input: 'Entrée', cached: 'Cache', output: 'Sortie', model: 'Modèle / route',
  weekday: 'L', legendLess: 'Moins', legendMore: 'Plus', dayTotal: '{total} tokens · {requests} requêtes',
} satisfies Record<UsageLocaleKey, string>

/** Localized dashboard strings, with untranslated labels inherited from English. */
export const de = { ...en,
  locale: 'de-DE', title: 'Token-Verbrauch',
  date: 'Verbrauchsdatum', allHistory: 'Gesamter Verlauf', today: 'Heute',
  loadFailed: 'Token-Verbrauch konnte nicht geladen werden.', retry: 'Erneut versuchen', emptyTitle: 'Noch kein Token-Verbrauch',
  emptyDescription: 'Der Verbrauch erscheint, sobald ein Modell Tokens für diesen Zeitraum meldet.', incomplete: 'Nutzung ohne eindeutige Route wurde ausgelassen.',
  kimi: 'Kimi', lakala: 'Lakala',
  other: 'Andere Anbieter', requests: '{count} Anfragen', totalTokens: 'Tokens gesamt', tokens: 'Tokens',
  input: 'Eingabe', cached: 'Cache', output: 'Ausgabe', model: 'Modell / Route',
  weekday: 'M', legendLess: 'Weniger', legendMore: 'Mehr', dayTotal: '{total} Tokens · {requests} Anfragen',
} satisfies Record<UsageLocaleKey, string>

/** Localized dashboard strings, with untranslated labels inherited from English. */
export const ru = { ...en,
  locale: 'ru-RU', title: 'Использование токенов',
  date: 'Дата использования', allHistory: 'Вся история', today: 'Сегодня',
  loadFailed: 'Не удалось загрузить использование токенов.', retry: 'Повторить', emptyTitle: 'Использования токенов пока нет',
  emptyDescription: 'Данные появятся после отчёта модели о токенах за этот период.', incomplete: 'Использование без известного маршрута не учтено.',
  kimi: 'Kimi', lakala: 'Lakala',
  other: 'Другие провайдеры', requests: 'Запросов: {count}', totalTokens: 'Всего токенов', tokens: 'Токены',
  input: 'Ввод', cached: 'Кэш', output: 'Вывод', model: 'Модель / маршрут',
  weekday: 'П', legendLess: 'Меньше', legendMore: 'Больше', dayTotal: '{total} токенов · запросов: {requests}',
} satisfies Record<UsageLocaleKey, string>

/** Localized dashboard strings, with untranslated labels inherited from English. */
export const pt = { ...en,
  locale: 'pt-BR', title: 'Uso de tokens',
  date: 'Data de uso', allHistory: 'Todo el historial', today: 'Hoy',
  loadFailed: 'Não foi possível carregar o uso de tokens.', retry: 'Tentar novamente', emptyTitle: 'Ainda não há uso de tokens',
  emptyDescription: 'O uso aparecerá quando um modelo relatar tokens neste período.', incomplete: 'Uso sem rota identificável foi omitido.',
  kimi: 'Kimi', lakala: 'Lakala',
  other: 'Outros provedores', requests: '{count} solicitações', totalTokens: 'Total de tokens', tokens: 'Tokens',
  input: 'Entrada', cached: 'Cache', output: 'Saída', model: 'Modelo / rota',
  weekday: 'S', legendLess: 'Menos', legendMore: 'Mais', dayTotal: '{total} tokens · {requests} solicitações',
} satisfies Record<UsageLocaleKey, string>
