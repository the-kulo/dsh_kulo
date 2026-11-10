/**
 * `gitPanel` namespace dictionaries, and the namespace's declaration.
 */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Git panel type name, guide entry, binding form, and status copy. */
    gitPanel: GitKey
  }
}

/** Simplified Chinese dictionary and key-set source of truth. */
export const zh = {
  'panel.title': 'Git',
  'guide.title': '版本控制',
  'guide.description': '绑定工作区到远程仓库，浏览变更与提交历史',
  'unbound.explanation': '将此工作区绑定到远程 Git 仓库以跟踪文件变更。',
  'unbound.remoteLabel': '远程地址',
  'unbound.remotePlaceholder': 'https://github.com/user/repo.git',
  'unbound.branchLabel': '分支',
  'unbound.autoCommitLabel': '自动提交变更',
  'unbound.bind': '绑定',
  'bound.branch': '分支',
  'bound.remote': '远程',
  'bound.autoCommit': '自动提交',
  'bound.autoCommit.enable': '开启自动提交',
  'bound.autoCommit.disable': '关闭自动提交',
  refresh: '刷新',
  unbind: '解除绑定',
  clean: '工作区干净',
  loading: '加载中…',
  'error.title': '出错了',
  retry: '重试',
  'changedFiles': '已变更文件',
  'commits': '提交记录',
  'staged': '已暂存',
  ahead: '领先',
  behind: '落后',
  'state.added': '新增',
  'state.modified': '修改',
  'state.deleted': '删除',
  'state.renamed': '重命名',
  'state.untracked': '未跟踪',
  'state.conflicted': '冲突',
  'time.secondsAgo': '{value} 秒前',
  'time.minutesAgo': '{value} 分钟前',
  'time.hoursAgo': '{value} 小时前',
  'time.daysAgo': '{value} 天前',
} satisfies Record<string, string>

/** Git dictionary key union. */
export type GitKey = keyof typeof zh

/** English dictionary, checked against the Chinese key set. */
export const en = {
  'panel.title': 'Git',
  'guide.title': 'Version control',
  'guide.description': 'Bind a workspace to a remote repository, browse changes and commit history',
  'unbound.explanation': 'Bind this workspace to a remote Git repository to track file changes.',
  'unbound.remoteLabel': 'Remote URL',
  'unbound.remotePlaceholder': 'https://github.com/user/repo.git',
  'unbound.branchLabel': 'Branch',
  'unbound.autoCommitLabel': 'Auto-commit changes',
  'unbound.bind': 'Bind',
  'bound.branch': 'Branch',
  'bound.remote': 'Remote',
  'bound.autoCommit': 'Auto-commit',
  'bound.autoCommit.enable': 'Enable auto-commit',
  'bound.autoCommit.disable': 'Disable auto-commit',
  refresh: 'Refresh',
  unbind: 'Unbind',
  clean: 'Working tree clean',
  loading: 'Loading…',
  'error.title': 'Error',
  retry: 'Retry',
  'changedFiles': 'Changed files',
  'commits': 'Commits',
  'staged': 'Staged',
  ahead: 'ahead',
  behind: 'behind',
  'state.added': 'Added',
  'state.modified': 'Modified',
  'state.deleted': 'Deleted',
  'state.renamed': 'Renamed',
  'state.untracked': 'Untracked',
  'state.conflicted': 'Conflicted',
  'time.secondsAgo': '{value}s ago',
  'time.minutesAgo': '{value}m ago',
  'time.hoursAgo': '{value}h ago',
  'time.daysAgo': '{value}d ago',
} satisfies Record<GitKey, string>
