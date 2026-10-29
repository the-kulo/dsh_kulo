/** `securezone` namespace dictionaries (the Secure zone history copy). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'section.title': '安全区',
  'error.offline': '暂时无法连接，请稍后重试',
} satisfies Record<string, string>

/** The securezone namespace key union. */
export type SecureZoneKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'section.title': 'Secure zone',
  'error.offline': 'Temporarily unavailable. Please try again later.',
} satisfies Record<SecureZoneKey, string>

/** Japanese dictionary, checked against the English keys. */
export const ja = {
  'section.title': 'セキュアゾーン',
  'error.offline': '一時的に利用できません。後でもう一度お試しください。',
} satisfies Record<keyof typeof en, string>

/** Spanish dictionary, checked against the English keys. */
export const es = {
  'section.title': 'Zona segura',
  'error.offline': 'Temporalmente no disponible. Inténtalo de nuevo más tarde.',
} satisfies Record<keyof typeof en, string>

/** French dictionary, checked against the English keys. */
export const fr = {
  'section.title': 'Zone sécurisée',
  'error.offline': 'Temporairement indisponible. Veuillez réessayer plus tard.',
} satisfies Record<keyof typeof en, string>

/** German dictionary, checked against the English keys. */
export const de = {
  'section.title': 'Sicherheitszone',
  'error.offline': 'Vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.',
} satisfies Record<keyof typeof en, string>

/** Russian dictionary, checked against the English keys. */
export const ru = {
  'section.title': 'Защищённая зона',
  'error.offline': 'Временно недоступно. Повторите попытку позже.',
} satisfies Record<keyof typeof en, string>

/** Portuguese dictionary, checked against the English keys. */
export const pt = {
  'section.title': 'Zona segura',
  'error.offline': 'Temporariamente indisponível. Tente novamente mais tarde.',
} satisfies Record<keyof typeof en, string>
