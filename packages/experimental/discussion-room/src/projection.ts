/** Incremental replay of discussion-room plugin records into the Web projection. */

import { z } from 'zod'
import { brandString } from '@deepseek-ai/dsh-brand'
import { pluginRecordOf, SessionLogOffset } from '@deepseek-ai/dsh-session'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type {
  DiscussionMessageId,
  DiscussionParticipantId,
  DiscussionRoomId,
  DiscussionMessage,
  DiscussionRoom,
  DiscussionRoomProjection,
} from './types.ts'

const participantId = z.string().min(1).transform(value => brandString<DiscussionParticipantId>(value))
const messageId = z.string().min(1).transform(value => brandString<DiscussionMessageId>(value))
const sessionId = z.string().min(1).transform(value => brandString<SessionId>(value))
const participantSchema = z.object({
  id: participantId,
  name: z.string().min(1),
  role: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
}).strict()
const messageSchema = z.object({
  id: messageId,
  participantId,
  participantName: z.string().min(1),
  role: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  round: z.number().int().positive(),
  kind: z.enum(['opinion', 'rebuttal', 'summary']),
  status: z.enum(['running', 'completed', 'failed']),
  childSessionId: sessionId.optional(),
  text: z.string().optional(),
  error: z.string().optional(),
}).strict() as z.ZodType<DiscussionMessage>
const roomSchema = z.object({
  id: z.string().min(1).transform(value => brandString<DiscussionRoomId>(value)),
  topic: z.string().min(1),
  participants: z.array(participantSchema).min(2),
  moderator: participantSchema.omit({ role: true }),
  roundLimit: z.number().int().positive(),
  tokenLimit: z.number().int().positive(),
  currentRound: z.number().int().nonnegative(),
  status: z.enum(['running', 'stopping', 'completed', 'failed', 'stopped']),
  messages: z.array(messageSchema),
  failure: z.string().optional(),
}).strict() as z.ZodType<DiscussionRoom>
const recordSchema = z.object({ version: z.literal(1), room: roomSchema }).strict()
const stateSchema = z.object({ room: roomSchema.nullable(), failure: z.string().optional() }).strict()

/** Room projection state with the fork boundary retained for replay. */
export interface DiscussionRoomProjectionState extends DiscussionRoomProjection {
  readonly inheritedEventCount: SessionLogOffset
}

const storedStateSchema = stateSchema.extend({
  inheritedEventCount: z.number().int().nonnegative().transform(SessionLogOffset),
}) as z.ZodType<DiscussionRoomProjectionState>
const viewSchema = stateSchema as z.ZodType<DiscussionRoomProjection>

/** Durable room projection; inherited records belong to the ancestor discussion. */
export const discussionRoomProjection = {
  key: 'discussionRoom',
  stateVersion: 1,
  stateSchema: storedStateSchema,
  init: (_header, inheritedEventCount) => ({ room: null, inheritedEventCount }),
  apply: (state: DiscussionRoomProjectionState, event): DiscussionRoomProjectionState => {
    if (event.seq < state.inheritedEventCount || state.failure !== undefined) return state
    const record = pluginRecordOf(event)
    if (record?.type !== 'plugin:discussion-room/state') return state
    const parsed = recordSchema.safeParse(record.data)
    if (!parsed.success) return { ...state, failure: 'Invalid persisted discussion-room record' }
    return { ...state, room: parsed.data.room }
  },
  wire: {
    summary: false,
    viewSchema,
    view: (state: DiscussionRoomProjectionState): DiscussionRoomProjection => ({
      room: state.room,
      ...state.failure === undefined ? {} : { failure: state.failure },
    }),
  },
} satisfies ProjectionDefinition<'discussionRoom', DiscussionRoomProjectionState>
