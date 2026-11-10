/** Locale-owned application-access approval messages. */

/** English application-access messages. */
export const en = {
  question: 'Allow computer use to launch, read, capture and control this application?',
  detail: 'Session access lasts until DSH restarts or computer use is disabled.',
  approve: 'Allow for this session',
}

/** Chinese application-access messages. */
export const zh = {
  question: '\u5141\u8BB8 Computer Use \u542F\u52A8\u3001\u8BFB\u53D6\u3001\u622A\u56FE\u548C\u63A7\u5236\u6B64\u5E94\u7528\u5417\uFF1F',
  detail: '\u4F1A\u8BDD\u6388\u6743\u5728 DSH \u91CD\u542F\u6216\u5173\u95ED Computer Use \u540E\u5931\u6548\u3002',
  approve: '\u672C\u4F1A\u8BDD\u5141\u8BB8',
} satisfies Record<keyof typeof en, string>

/** Display translations resolved by the Client; wire choices stay unchanged. */
export const applicationAccessDisplay = {
  question: { en: en.question, zh: zh.question },
  detail: { en: en.detail, zh: zh.detail },
  approve: { en: en.approve, zh: zh.approve },
}