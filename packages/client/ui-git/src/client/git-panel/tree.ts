/**
 * Pure path-to-tree derivation for the git panel's changed-files view.
 *
 * A flat list of repo-relative file paths is split on `/` and assembled into
 * a tree of directory and file nodes. Every node carries the set of
 * {@link GitFileState} values that appear somewhere under it, so a directory
 * row can show whether it contains only additions, only modifications, or a mix.
 */
import type { GitFileState, GitFileView } from '@deepseek-ai/dsh-api-git-controller/types'

/** One row in the derived file tree. */
export type GitTreeNode =
  | {
      /** Stable key, the full repo-relative path. */
      readonly path: string
      readonly name: string
      readonly kind: 'directory'
      /** Child nodes, sorted directories first then files, each group by name. */
      readonly children: readonly GitTreeNode[]
      /**
       * Every status value that appears in any leaf under this directory.
       * A node with no children has an empty set; a real directory always
       * carries at least the states of its direct children.
       */
      readonly states: ReadonlySet<GitFileState>
    }
  | {
      readonly path: string
      readonly name: string
      readonly kind: 'file'
      readonly state: GitFileState
      readonly staged: boolean
      /** The original path for renamed files. */
      readonly originalPath?: string
    }

/** Natural, case-insensitive name order. */
const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/**
 * Derive a sorted tree from a flat list of changed files.
 *
 * Directories sort before files; within each group, entries sort by name.
 * Directory nodes aggregate the status values of their descendants.
 *
 * @param changes - changed files from the git status view.
 * @returns root-level tree nodes (path `/`).
 */
export function buildGitTree(changes: readonly GitFileView[]): readonly GitTreeNode[] {
  const root: Record<string, GitTreeNode> = {}
  for (const change of changes) {
    const segments = change.path.split('/')
    insert(root, segments, 0, change)
  }
  return sortChildren(Object.values(root))
}

/** Insert one file path into the tree, creating directory nodes as needed. */
function insert(
  level: Record<string, GitTreeNode>,
  segments: readonly string[],
  index: number,
  file: GitFileView,
): void {
  const name = segments[index]
  if (name === undefined) {
    throw new Error(`buildGitTree: no path segment at index ${String(index)} for ${file.path}`)
  }
  const path = segments.slice(0, index + 1).join('/')
  if (index === segments.length - 1) {
    // This segment is the filename.
    level[name] = {
      path,
      name,
      kind: 'file',
      state: file.state,
      staged: file.staged,
      ...(file.originalPath === undefined ? {} : { originalPath: file.originalPath }),
    }
    return
  }
  // This segment is a directory.
  let dir = level[name]
  if (dir === undefined || dir.kind !== 'directory') {
    dir = { path, name, kind: 'directory', children: [], states: new Set() }
    level[name] = dir
  }
  const children = dir.children as GitTreeNode[]
  const childMap: Record<string, GitTreeNode> = {}
  for (const child of children) childMap[child.name] = child
  insert(childMap, segments, index + 1, file)
  // Rebuild children in sorted order after insertion.
  const nextChildren = sortChildren(Object.values(childMap))
  // Aggregate states from all descendants.
  const states = new Set<GitFileState>()
  for (const child of nextChildren) {
    if (child.kind === 'file') states.add(child.state)
    else for (const s of child.states) states.add(s)
  }
  level[name] = { path, name, kind: 'directory', children: nextChildren, states }
}

/**
 * Sort tree nodes: directories first, then by name within each group.
 * @param nodes - unsorted nodes.
 * @returns a new sorted array.
 */
function sortChildren(nodes: readonly GitTreeNode[]): readonly GitTreeNode[] {
  return [...nodes].sort((left, right) => {
    const group = Number(right.kind === 'directory') - Number(left.kind === 'directory')
    return group !== 0 ? group : byName.compare(left.name, right.name)
  })
}
