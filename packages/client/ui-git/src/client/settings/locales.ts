/** Locale bundles for the git binding settings section. */

/** Locale keys the git section renders. */
export type GitSettingsKey =
  | 'nav'
  | 'title'
  | 'sectionIntro'
  | 'workspaceSelect'
  | 'workspacePlaceholder'
  | 'workspaceSearch'
  | 'noWorkspace'
  | 'noWorkspaceHint'
  | 'remoteUrl'
  | 'remoteUrlPlaceholder'
  | 'branch'
  | 'branchChain'
  | 'branchChainPlaceholder'
  | 'branchChainHint'
  | 'autoCommit'
  | 'autoCommitHint'
  | 'bind'
  | 'unbind'
  | 'editBinding'
  | 'cancelEdit'
  | 'currentBinding'
  | 'boundTo'
  | 'loading'
  | 'remoteRequired'
  | 'bindFailed'
  | 'unbindFailed'
  | 'boundAt'
  | 'promote'
  | 'promoteTo'
  | 'promoteFailed'
  | 'switchBranch'
  | 'activeBranch'

/** English copy. */
export const en: Record<GitSettingsKey, string> = {
  nav: 'Git',
  title: 'Git repository',
  sectionIntro: 'Bind this workspace to a remote git repository. Auto-commit saves each agent turn that changed files.',
  workspaceSelect: 'Workspace',
  workspacePlaceholder: 'Select a workspace',
  workspaceSearch: 'Search workspaces',
  noWorkspace: 'Select a workspace to configure its git binding.',
  noWorkspaceHint: 'The git binding is per workspace. Choose a workspace above, then bind it to a remote repository.',
  remoteUrl: 'Remote URL',
  remoteUrlPlaceholder: 'git@github.com:org/repo.git',
  branch: 'Branch',
  branchChain: 'Branch chain',
  branchChainPlaceholder: 'feature, verify, stable',
  branchChainHint: 'Ordered promotion chain. Changes flow from the first branch to the last.',
  autoCommit: 'Auto-commit after each agent turn',
  autoCommitHint: 'The harness commits changes after every agent turn that modified files in the workspace.',
  bind: 'Bind',
  unbind: 'Unbind',
  editBinding: 'Edit',
  cancelEdit: 'Cancel',
  currentBinding: 'Current binding',
  boundTo: 'Bound to {remote} on branch {branch}',
  loading: 'Working…',
  remoteRequired: 'Remote URL is required.',
  bindFailed: 'Bind failed',
  unbindFailed: 'Unbind failed',
  boundAt: 'Bound at',
  promote: 'Promote',
  promoteTo: 'Promote to {branch}',
  promoteFailed: 'Promotion failed',
  switchBranch: 'Switch branch',
  activeBranch: 'Active branch',
}

/** Simplified Chinese copy. */
export const zh: Record<GitSettingsKey, string> = {
  nav: 'Git',
  title: 'Git 仓库',
  sectionIntro: '将当前工作区绑定到远程 Git 仓库。开启自动提交后，每次 Agent 轮次修改文件后会自动保存。',
  workspaceSelect: '工作区',
  workspacePlaceholder: '选择工作区',
  workspaceSearch: '搜索工作区',
  noWorkspace: '请选择一个工作区以配置 Git 绑定。',
  noWorkspaceHint: 'Git 绑定以工作区为单位。请先在上方选择一个工作区，然后将其绑定到远程仓库。',
  remoteUrl: '远程地址',
  remoteUrlPlaceholder: 'git@github.com:org/repo.git',
  branch: '分支',
  branchChain: '分支链',
  branchChainPlaceholder: 'feature, verify, stable',
  branchChainHint: '按顺序晋升的分支链，改动从第一个分支流向最后一个分支。',
  autoCommit: '每次 Agent 轮次后自动提交',
  autoCommitHint: '每次 Agent 轮次修改工作区文件后，自动执行 Git 提交。',
  bind: '绑定',
  unbind: '解绑',
  editBinding: '编辑',
  cancelEdit: '取消',
  currentBinding: '当前绑定',
  boundTo: '已绑定至 {remote}（分支 {branch}）',
  loading: '处理中…',
  remoteRequired: '请输入远程仓库地址。',
  bindFailed: '绑定失败',
  unbindFailed: '解绑失败',
  boundAt: '绑定时间',
  promote: '晋升',
  promoteTo: '晋升到 {branch}',
  promoteFailed: '晋升失败',
  switchBranch: '切换分支',
  activeBranch: '当前分支',
}
