/** `quickqa` namespace dictionaries (the Quick answers history copy). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'section.title': '轻问答',
  'error.offline': '暂时无法连接，请稍后重试',
} satisfies Record<string, string>

/** The quickqa namespace key union. */
export type QuickQaKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'section.title': 'Quick answers',
  'error.offline': 'Temporarily unavailable. Please try again later.',
} satisfies Record<QuickQaKey, string>

/** Japanese dictionary, checked against the English keys. */
export const ja = {
  'section.title': 'クイック回答',
  'error.offline': '一時的に利用できません。後でもう一度お試しください。',
} satisfies Record<keyof typeof en, string>

/** Spanish dictionary, checked against the English keys. */
export const es = {
  'section.title': 'Respuestas rápidas',
  'error.offline': 'Temporalmente no disponible. Inténtalo de nuevo más tarde.',
} satisfies Record<keyof typeof en, string>

/** French dictionary, checked against the English keys. */
export const fr = {
  'section.title': 'Réponses rapides',
  'error.offline': 'Temporairement indisponible. Veuillez réessayer plus tard.',
} satisfies Record<keyof typeof en, string>

/** German dictionary, checked against the English keys. */
export const de = {
  'section.title': 'Schnelle Antworten',
  'error.offline': 'Vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.',
} satisfies Record<keyof typeof en, string>

/** Russian dictionary, checked against the English keys. */
export const ru = {
  'section.title': 'Быстрые ответы',
  'error.offline': 'Временно недоступно. Повторите попытку позже.',
} satisfies Record<keyof typeof en, string>

/** Portuguese dictionary, checked against the English keys. */
export const pt = {
  'section.title': 'Respostas rápidas',
  'error.offline': 'Temporariamente indisponível. Tente novamente mais tarde.',
} satisfies Record<keyof typeof en, string>
