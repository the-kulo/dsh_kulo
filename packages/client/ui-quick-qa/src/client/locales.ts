/** `quickqa` namespace dictionaries (the Quick answers history copy). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'section.title': '轻问答',
  'empty.title': '暂无轻问答历史',
  'empty.body': '在新任务中选择“轻问答”并发送消息后，历史会显示在这里；面板不选择或附加工作区，回答只使用该会话历史。',
  'error.offline': '暂时无法连接，请稍后重试',
} satisfies Record<string, string>

/** The quickqa namespace key union. */
export type QuickQaKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'section.title': 'Quick answers',
  'empty.title': 'No quick answers yet',
  'empty.body': 'Pick Quick answers when starting a new task and send a message; its history appears here. No workspace is picked or attached, and answers use only that conversation’s history.',
  'error.offline': 'Temporarily unavailable. Please try again later.',
} satisfies Record<QuickQaKey, string>

/** Japanese dictionary, checked against the English keys. */
export const ja = {
  'section.title': 'クイック回答',
  'empty.title': 'クイック回答の履歴はまだありません',
  'empty.body': '新しいタスクで「クイック回答」を選んで送信すると、履歴がここに表示されます。ワークスペースの選択や追加は不要で、その会話の履歴だけを使って回答します。',
  'error.offline': '一時的に利用できません。後でもう一度お試しください。',
} satisfies Record<keyof typeof en, string>

/** Spanish dictionary, checked against the English keys. */
export const es = {
  'section.title': 'Respuestas rápidas',
  'empty.title': 'Aún no hay respuestas rápidas',
  'empty.body': 'Elige Respuestas rápidas al iniciar una nueva tarea y envía un mensaje; su historial aparecerá aquí. No se elige ni se adjunta un área de trabajo y las respuestas usan solo el historial de esa conversación.',
  'error.offline': 'Temporalmente no disponible. Inténtalo de nuevo más tarde.',
} satisfies Record<keyof typeof en, string>

/** French dictionary, checked against the English keys. */
export const fr = {
  'section.title': 'Réponses rapides',
  'empty.title': 'Aucune réponse rapide pour le moment',
  'empty.body': 'Choisissez Réponses rapides au démarrage d’une nouvelle tâche et envoyez un message ; son historique apparaîtra ici. Aucun espace de travail n’est choisi ni joint, et les réponses n’utilisent que l’historique de cette conversation.',
  'error.offline': 'Temporairement indisponible. Veuillez réessayer plus tard.',
} satisfies Record<keyof typeof en, string>

/** German dictionary, checked against the English keys. */
export const de = {
  'section.title': 'Schnelle Antworten',
  'empty.title': 'Noch keine schnellen Antworten',
  'empty.body': 'Wählen Sie Schnelle Antworten beim Start einer neuen Aufgabe und senden Sie eine Nachricht; der Verlauf erscheint hier. Es wird kein Arbeitsbereich ausgewählt oder angehängt, und Antworten nutzen nur den Verlauf dieser Unterhaltung.',
  'error.offline': 'Vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.',
} satisfies Record<keyof typeof en, string>

/** Russian dictionary, checked against the English keys. */
export const ru = {
  'section.title': 'Быстрые ответы',
  'empty.title': 'Быстрых ответов пока нет',
  'empty.body': 'Выберите «Быстрые ответы» при запуске новой задачи и отправьте сообщение — история появится здесь. Рабочая область не выбирается и не добавляется, а ответы используют только историю этого разговора.',
  'error.offline': 'Временно недоступно. Повторите попытку позже.',
} satisfies Record<keyof typeof en, string>

/** Portuguese dictionary, checked against the English keys. */
export const pt = {
  'section.title': 'Respostas rápidas',
  'empty.title': 'Ainda não há respostas rápidas',
  'empty.body': 'Escolha Respostas rápidas ao iniciar uma nova tarefa e envie uma mensagem; o histórico aparecerá aqui. Nenhum espaço de trabalho é escolhido ou anexado, e as respostas usam apenas o histórico dessa conversação.',
  'error.offline': 'Temporariamente indisponível. Tente novamente mais tarde.',
} satisfies Record<keyof typeof en, string>
