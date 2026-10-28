/** Gateway task classification by keyword priority. */

import type { GatewayTaskCategory } from './types.ts'

const SENSITIVE_PATTERN = new RegExp(
  '\\b(?:sensitive|secrets?|credentials?|api[- ]?keys?|tokens?|passwords?|confidential)\\b'
  + '|敏感|密钥|凭据|保密|密码|令牌', 'iu')

const TEST_PATTERN = new RegExp(
  '\\b(?:tests?|testing|mock|stub|regression|unit[- ]?test|integration[- ]?test|fixtures?)\\b'
  + '|测试|单测|集成测试|回归|mock', 'iu')

const RELEASE_PATTERN = new RegExp(
  '\\b(?:release|deploy|deployment|rollout|rollback|canary|launch|publish)\\b'
  + '|发布|部署|上线|灰度|回滚', 'iu')

const SQL_PATTERN = new RegExp(
  '\\b(?:sql|database|databases|transaction|transactions?|migration|migrations?)\\b'
  + '|sql|数据库|事务|迁移', 'iu')

const BACKEND_PATTERN = new RegExp(
  '\\b(?:backend|server|service|api|crud|endpoint|endpoints?)\\b'
  + '|后端|接口|服务', 'iu')

const FRONTEND_PATTERN = new RegExp(
  '\\b(?:frontend|page|pages|component|components|ui|css|interaction|interactions?)\\b'
  + '|前端|页面|组件|交互', 'iu')

const REASONING_PATTERN = new RegExp(
  '\\b(?:analy[sz]e|analysis|reasoning|research|design|architecture|complex|evaluate|investigate)\\b'
  + '|分析|推理|设计|架构|复杂', 'iu')

/**
 * Assign a task category from the gateway description and prompt.
 * Priority: sensitive > test > release > sql > backend > frontend > reasoning > simple.
 * @param description - Short task label.
 * @param prompt - Complete task text.
 * @returns The task category used for gateway routing.
 */
export function classifyGatewayTask(description: string, prompt: string): GatewayTaskCategory {
  const text = `${description} ${prompt}`
  if (SENSITIVE_PATTERN.test(text)) return 'sensitive'
  if (TEST_PATTERN.test(text)) return 'test'
  if (RELEASE_PATTERN.test(text)) return 'release'
  if (SQL_PATTERN.test(text)) return 'sql'
  if (BACKEND_PATTERN.test(text)) return 'backend'
  if (FRONTEND_PATTERN.test(text)) return 'frontend'
  if (REASONING_PATTERN.test(text)) return 'reasoning'
  return 'simple'
}
