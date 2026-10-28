/** Discussion-room Web dictionaries. */

/** Locale namespace owned by the discussion-room UI. */
export const NS = 'discussion-room'

/** Simplified Chinese dictionary and locale key source. */
export const zh = {
  trigger: '多模型讨论室',
  'tab.label': '讨论室',
  'tab.empty': '本会话还没有多模型讨论记录。',
  close: '关闭',
  createTitle: '创建多模型讨论室',
  roomTitle: '多模型讨论室',
  description: '让多个模型先独立作答，再有界反驳，最后由主持人统一建议并保留分歧。',
  topic: '讨论主题',
  topicPlaceholder: '输入希望模型讨论的问题',
  participants: '参与者',
  participant: '参与者 {number}',
  defaultParticipant: '参与者 {number}',
  defaultModerator: '主持人',
  name: '名称',
  role: '角色',
  roleAdvocate: '提出支持方案的观点与理由',
  roleSkeptic: '审视风险、反例与替代方案',
  roleContributor: '提供独立分析与证据',
  model: '模型',
  moderator: '主持人',
  rounds: '讨论轮数',
  tokenLimit: '每次回复 token 上限',
  addParticipant: '添加参与者',
  removeParticipant: '移除{name}',
  create: '创建房间',
  creating: '正在创建…',
  loading: '正在加载模型…',
  stop: '停止讨论',
  stoppingAction: '正在停止…',
  error: '操作失败：{message}',
  projectionFailure: '房间记录无效：{message}',
  roundProgress: '轮次 {current}/{total}',
  messages: '讨论消息',
  emptyMessages: '模型尚未提交观点。',
  kindOpinion: '首轮观点',
  kindRebuttal: '第{round}轮反驳',
  kindSummary: '主持人最终建议',
  statusRunning: '进行中',
  statusStopping: '正在停止',
  statusCompleted: '已完成',
  statusFailed: '失败',
  statusStopped: '已停止',
  messageRunning: '正在生成',
  messageFailed: '生成失败',
  moderatorBadge: '主持人',
} satisfies Record<string, string>

/** Discussion-room locale key union. */
export type DiscussionKey = keyof typeof zh

/** English dictionary checked against the Chinese key set. */
export const en = {
  trigger: 'Multi-model discussion',
  'tab.label': 'Discussion',
  'tab.empty': 'This session has no multi-model discussion yet.',
  close: 'Close',
  createTitle: 'Create a multi-model discussion',
  roomTitle: 'Multi-model discussion',
  description: 'Models answer independently, rebut within a fixed round limit, then a moderator gives one recommendation while preserving disagreements.',
  topic: 'Topic',
  topicPlaceholder: 'Enter the question for the models to discuss',
  participants: 'Participants',
  participant: 'Participant {number}',
  defaultParticipant: 'Participant {number}',
  defaultModerator: 'Moderator',
  name: 'Name',
  role: 'Role',
  roleAdvocate: 'Argue for the proposal with concrete reasons',
  roleSkeptic: 'Examine risks, counterexamples, and alternatives',
  roleContributor: 'Contribute independent analysis and evidence',
  model: 'Model',
  moderator: 'Moderator',
  rounds: 'Discussion rounds',
  tokenLimit: 'Token limit per response',
  addParticipant: 'Add participant',
  removeParticipant: 'Remove {name}',
  create: 'Create room',
  creating: 'Creating…',
  loading: 'Loading models…',
  stop: 'Stop discussion',
  stoppingAction: 'Stopping…',
  error: 'Operation failed: {message}',
  projectionFailure: 'Invalid room record: {message}',
  roundProgress: 'Round {current}/{total}',
  messages: 'Discussion messages',
  emptyMessages: 'No model opinions have arrived yet.',
  kindOpinion: 'Initial opinion',
  kindRebuttal: 'Round {round} rebuttal',
  kindSummary: 'Moderator’s final recommendation',
  statusRunning: 'Running',
  statusStopping: 'Stopping',
  statusCompleted: 'Completed',
  statusFailed: 'Failed',
  statusStopped: 'Stopped',
  messageRunning: 'Generating',
  messageFailed: 'Generation failed',
  moderatorBadge: 'Moderator',
} satisfies Record<DiscussionKey, string>

/** Japanese dictionary. */
export const ja = { ...en, trigger: 'マルチモデル討論', close: '閉じる', createTitle: 'マルチモデル討論を作成', roomTitle: 'マルチモデル討論', topic: '話題', participants: '参加者', defaultModerator: 'モデレーター', name: '名前', role: '役割', model: 'モデル', moderator: 'モデレーター', rounds: '討論ラウンド数', addParticipant: '参加者を追加', create: 'ルームを作成', stop: '討論を停止', messages: '討論メッセージ', statusRunning: '実行中', statusStopping: '停止中', statusCompleted: '完了', statusFailed: '失敗', statusStopped: '停止済み' , 'tab.label': '討論室', 'tab.empty': 'このセッションにはまだマルチモデル討論がありません。' } satisfies Record<DiscussionKey, string>
/** Spanish dictionary. */
export const es = { ...en, trigger: 'Debate multimodelo', close: 'Cerrar', createTitle: 'Crear debate multimodelo', roomTitle: 'Debate multimodelo', topic: 'Tema', participants: 'Participantes', defaultModerator: 'Moderador', name: 'Nombre', role: 'Rol', model: 'Modelo', moderator: 'Moderador', rounds: 'Rondas de debate', addParticipant: 'Añadir participante', create: 'Crear sala', stop: 'Detener debate', messages: 'Mensajes del debate', statusRunning: 'En curso', statusStopping: 'Deteniendo', statusCompleted: 'Completado', statusFailed: 'Fallido', statusStopped: 'Detenido' , 'tab.label': 'Debate', 'tab.empty': 'Esta sesión aún no tiene un debate multimodelo.' } satisfies Record<DiscussionKey, string>
/** French dictionary. */
export const fr = { ...en, trigger: 'Discussion multimodèle', close: 'Fermer', createTitle: 'Créer une discussion multimodèle', roomTitle: 'Discussion multimodèle', topic: 'Sujet', participants: 'Participants', defaultModerator: 'Modérateur', name: 'Nom', role: 'Rôle', model: 'Modèle', moderator: 'Modérateur', rounds: 'Tours de discussion', addParticipant: 'Ajouter un participant', create: 'Créer le salon', stop: 'Arrêter la discussion', messages: 'Messages de discussion', statusRunning: 'En cours', statusStopping: 'Arrêt en cours', statusCompleted: 'Terminé', statusFailed: 'Échec', statusStopped: 'Arrêté' , 'tab.label': 'Discussion', 'tab.empty': 'Cette session n’a pas encore de discussion multimodèle.' } satisfies Record<DiscussionKey, string>
/** German dictionary. */
export const de = { ...en, trigger: 'Multimodell-Diskussion', close: 'Schließen', createTitle: 'Multimodell-Diskussion erstellen', roomTitle: 'Multimodell-Diskussion', topic: 'Thema', participants: 'Teilnehmer', defaultModerator: 'Moderator', name: 'Name', role: 'Rolle', model: 'Modell', moderator: 'Moderator', rounds: 'Diskussionsrunden', addParticipant: 'Teilnehmer hinzufügen', create: 'Raum erstellen', stop: 'Diskussion stoppen', messages: 'Diskussionsnachrichten', statusRunning: 'Läuft', statusStopping: 'Wird gestoppt', statusCompleted: 'Abgeschlossen', statusFailed: 'Fehlgeschlagen', statusStopped: 'Gestoppt' , 'tab.label': 'Diskussion', 'tab.empty': 'Diese Sitzung hat noch keine Multimodell-Diskussion.' } satisfies Record<DiscussionKey, string>
/** Russian dictionary. */
export const ru = { ...en, trigger: 'Обсуждение нескольких моделей', close: 'Закрыть', createTitle: 'Создать обсуждение моделей', roomTitle: 'Обсуждение нескольких моделей', topic: 'Тема', participants: 'Участники', defaultModerator: 'Модератор', name: 'Имя', role: 'Роль', model: 'Модель', moderator: 'Модератор', rounds: 'Раунды обсуждения', addParticipant: 'Добавить участника', create: 'Создать комнату', stop: 'Остановить обсуждение', messages: 'Сообщения обсуждения', statusRunning: 'Выполняется', statusStopping: 'Остановка', statusCompleted: 'Завершено', statusFailed: 'Ошибка', statusStopped: 'Остановлено' , 'tab.label': 'Обсуждение', 'tab.empty': 'В этом сеансе пока нет обсуждения нескольких моделей.' } satisfies Record<DiscussionKey, string>
/** Portuguese dictionary. */
export const pt = { ...en, trigger: 'Discussão multimodelo', close: 'Fechar', createTitle: 'Criar discussão multimodelo', roomTitle: 'Discussão multimodelo', topic: 'Tópico', participants: 'Participantes', defaultModerator: 'Moderador', name: 'Nome', role: 'Função', model: 'Modelo', moderator: 'Moderador', rounds: 'Rodadas de discussão', addParticipant: 'Adicionar participante', create: 'Criar sala', stop: 'Parar discussão', messages: 'Mensagens da discussão', statusRunning: 'Em execução', statusStopping: 'Parando', statusCompleted: 'Concluído', statusFailed: 'Falhou', statusStopped: 'Parado' , 'tab.label': 'Discussão', 'tab.empty': 'Esta sessão ainda não tem uma discussão multimodelo.' } satisfies Record<DiscussionKey, string>
