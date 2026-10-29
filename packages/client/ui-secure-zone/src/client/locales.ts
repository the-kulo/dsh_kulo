/** `securezone` namespace dictionaries (the Secure zone history copy). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'section.title': '安全区',
  'empty.title': '暂无安全区历史',
  'empty.body': '点击上方「新建对话」创建安全区会话。安全区会话只由自部署本地模型回答，不提供外部工具，数据不会离开本部署。',
  'error.offline': '暂时无法连接，请稍后重试',
} satisfies Record<string, string>

/** The securezone namespace key union. */
export type SecureZoneKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'section.title': 'Secure zone',
  'empty.title': 'No secure conversations yet',
  'empty.body': 'Use New conversation above to start a secure-zone session. Secure-zone sessions are answered only by the self-deployed local model, with no external tools and no data leaving this deployment.',
  'error.offline': 'Temporarily unavailable. Please try again later.',
} satisfies Record<SecureZoneKey, string>

/** Japanese dictionary, checked against the English keys. */
export const ja = {
  'section.title': 'セキュアゾーン',
  'empty.title': 'セキュアゾーンの履歴はまだありません',
  'empty.body': '上の「新規会話」でセキュアゾーンのセッションを作成してください。セキュアゾーンの会話は自己デプロイのローカルモデルのみが回答し、外部ツールはなく、データはこのデプロイメントの外へ出ません。',
  'error.offline': '一時的に利用できません。後でもう一度お試しください。',
} satisfies Record<keyof typeof en, string>

/** Spanish dictionary, checked against the English keys. */
export const es = {
  'section.title': 'Zona segura',
  'empty.title': 'Aún no hay conversaciones seguras',
  'empty.body': 'Use Nueva conversación arriba para iniciar una sesión de la zona segura. Las sesiones de la zona segura solo las responde el modelo local autodesplegado, sin herramientas externas y sin que los datos salgan de esta implementación.',
  'error.offline': 'Temporalmente no disponible. Inténtalo de nuevo más tarde.',
} satisfies Record<keyof typeof en, string>

/** French dictionary, checked against the English keys. */
export const fr = {
  'section.title': 'Zone sécurisée',
  'empty.title': 'Aucune conversation sécurisée pour le moment',
  'empty.body': 'Utilisez Nouvelle conversation ci-dessus pour démarrer une session de la zone sécurisée. Les sessions de la zone sécurisée sont traitées uniquement par le modèle local auto-hébergé, sans outils externes et sans qu’aucune donnée ne quitte ce déploiement.',
  'error.offline': 'Temporairement indisponible. Veuillez réessayer plus tard.',
} satisfies Record<keyof typeof en, string>

/** German dictionary, checked against the English keys. */
export const de = {
  'section.title': 'Sicherheitszone',
  'empty.title': 'Noch keine sicheren Unterhaltungen',
  'empty.body': 'Starten Sie mit „Neue Unterhaltung“ oben eine Sitzung der Sicherheitszone. Sitzungen der Sicherheitszone beantwortet ausschließlich das selbst gehostete lokale Modell, ohne externe Tools und ohne dass Daten diese Bereitstellung verlassen.',
  'error.offline': 'Vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.',
} satisfies Record<keyof typeof en, string>

/** Russian dictionary, checked against the English keys. */
export const ru = {
  'section.title': 'Защищённая зона',
  'empty.title': 'Защищённых бесед пока нет',
  'empty.body': 'Нажмите «Новый разговор» выше, чтобы создать сессию защищённой зоны. Беседы защищённой зоны обрабатывает только локальная модель собственного развёртывания, без внешних инструментов и без передачи данных за пределы этого развёртывания.',
  'error.offline': 'Временно недоступно. Повторите попытку позже.',
} satisfies Record<keyof typeof en, string>

/** Portuguese dictionary, checked against the English keys. */
export const pt = {
  'section.title': 'Zona segura',
  'empty.title': 'Ainda não há conversas seguras',
  'empty.body': 'Use Nova conversa acima para iniciar uma sessão da zona segura. As sessões da zona segura são respondidas apenas pelo modelo local auto-hospedado, sem ferramentas externas e sem que os dados saiam desta implantação.',
  'error.offline': 'Temporariamente indisponível. Tente novamente mais tarde.',
} satisfies Record<keyof typeof en, string>
