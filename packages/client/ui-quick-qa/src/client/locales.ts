/** `quickqa` namespace dictionaries (the Quick answers history copy). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'section.title': '轻问答',
  'search.aria': '搜索轻问答会话',
  'search.placeholder': '搜索会话名称',
  'search.clear': '清除搜索',
  'search.noMatches': '无匹配会话',
  'session.new': '新会话',
  'session.untitled': '未命名',
  'empty.none': '暂无会话',
  'time.now': '刚刚',
  'time.minutes': '{n}分钟',
  'time.hours': '{n}小时',
  'time.days': '{n}天',
  'time.months': '{n}个月',
  'time.years': '{n}年',
  'error.offline': '暂时无法连接，请稍后重试',
} satisfies Record<string, string>

/** The quickqa namespace key union. */
export type QuickQaKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'section.title': 'Quick answers',
  'search.aria': 'Search quick answers',
  'search.placeholder': 'Search session names',
  'search.clear': 'Clear search',
  'search.noMatches': 'No matching sessions',
  'session.new': 'New Session',
  'session.untitled': 'Untitled',
  'empty.none': 'No sessions yet',
  'time.now': 'now',
  'time.minutes': '{n}min',
  'time.hours': '{n}h',
  'time.days': '{n}d',
  'time.months': '{n}mo',
  'time.years': '{n}y',
  'error.offline': 'Temporarily unavailable. Please try again later.',
} satisfies Record<QuickQaKey, string>

/** Japanese dictionary, checked against the English keys. */
export const ja = {
  'section.title': 'クイック回答',
  'search.aria': 'クイック回答を検索',
  'search.placeholder': 'セッション名を検索',
  'search.clear': '検索をクリア',
  'search.noMatches': '一致するセッションはありません',
  'session.new': '新しいセッション',
  'session.untitled': '無題',
  'empty.none': 'セッションはまだありません',
  'time.now': '今',
  'time.minutes': '{n}分',
  'time.hours': '{n}時間',
  'time.days': '{n}日',
  'time.months': '{n}か月',
  'time.years': '{n}年',
  'error.offline': '一時的に利用できません。後でもう一度お試しください。',
} satisfies Record<keyof typeof en, string>

/** Spanish dictionary, checked against the English keys. */
export const es = {
  'section.title': 'Respuestas rápidas',
  'search.aria': 'Buscar respuestas rápidas',
  'search.placeholder': 'Buscar nombres de sesión',
  'search.clear': 'Borrar búsqueda',
  'search.noMatches': 'No hay sesiones coincidentes',
  'session.new': 'Nueva sesión',
  'session.untitled': 'Sin título',
  'empty.none': 'Aún no hay sesiones',
  'time.now': 'ahora',
  'time.minutes': '{n}min',
  'time.hours': '{n}h',
  'time.days': '{n}d',
  'time.months': '{n}m',
  'time.years': '{n}a',
  'error.offline': 'Temporalmente no disponible. Inténtalo de nuevo más tarde.',
} satisfies Record<keyof typeof en, string>

/** French dictionary, checked against the English keys. */
export const fr = {
  'section.title': 'Réponses rapides',
  'search.aria': 'Rechercher des réponses rapides',
  'search.placeholder': 'Rechercher des noms de session',
  'search.clear': 'Effacer la recherche',
  'search.noMatches': 'Aucune session correspondante',
  'session.new': 'Nouvelle session',
  'session.untitled': 'Sans titre',
  'empty.none': 'Aucune session pour le moment',
  'time.now': 'maintenant',
  'time.minutes': '{n}min',
  'time.hours': '{n}h',
  'time.days': '{n}j',
  'time.months': '{n}mois',
  'time.years': '{n}an',
  'error.offline': 'Temporairement indisponible. Veuillez réessayer plus tard.',
} satisfies Record<keyof typeof en, string>

/** German dictionary, checked against the English keys. */
export const de = {
  'section.title': 'Schnelle Antworten',
  'search.aria': 'Schnelle Antworten suchen',
  'search.placeholder': 'Sitzungsnamen suchen',
  'search.clear': 'Suche löschen',
  'search.noMatches': 'Keine passenden Sitzungen',
  'session.new': 'Neue Sitzung',
  'session.untitled': 'Unbenannt',
  'empty.none': 'Noch keine Sitzungen',
  'time.now': 'jetzt',
  'time.minutes': '{n}Min.',
  'time.hours': '{n}Std.',
  'time.days': '{n}T',
  'time.months': '{n}Mon.',
  'time.years': '{n}J',
  'error.offline': 'Vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.',
} satisfies Record<keyof typeof en, string>

/** Russian dictionary, checked against the English keys. */
export const ru = {
  'section.title': 'Быстрые ответы',
  'search.aria': 'Поиск быстрых ответов',
  'search.placeholder': 'Поиск по названию сессии',
  'search.clear': 'Очистить поиск',
  'search.noMatches': 'Нет подходящих сессий',
  'session.new': 'Новая сессия',
  'session.untitled': 'Без названия',
  'empty.none': 'Сессий пока нет',
  'time.now': 'сейчас',
  'time.minutes': '{n}мин',
  'time.hours': '{n}ч',
  'time.days': '{n}д',
  'time.months': '{n}мес.',
  'time.years': '{n}г',
  'error.offline': 'Временно недоступно. Повторите попытку позже.',
} satisfies Record<keyof typeof en, string>

/** Portuguese dictionary, checked against the English keys. */
export const pt = {
  'section.title': 'Respostas rápidas',
  'search.aria': 'Pesquisar respostas rápidas',
  'search.placeholder': 'Pesquisar nomes de sessão',
  'search.clear': 'Limpar pesquisa',
  'search.noMatches': 'Nenhuma sessão correspondente',
  'session.new': 'Nova sessão',
  'session.untitled': 'Sem título',
  'empty.none': 'Ainda não há sessões',
  'time.now': 'agora',
  'time.minutes': '{n}min',
  'time.hours': '{n}h',
  'time.days': '{n}d',
  'time.months': '{n}m',
  'time.years': '{n}a',
  'error.offline': 'Temporariamente indisponível. Tente novamente mais tarde.',
} satisfies Record<keyof typeof en, string>
