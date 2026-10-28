/** Public discussion-room requests and durable browser views. */

import type { Branded } from '@deepseek-ai/dsh-brand'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionProjectionSummaryExcluded } from '@deepseek-ai/dsh-session-projection/types'

/** Stable identity of the discussion owned by one root Session. */
export type DiscussionRoomId = Branded<'DiscussionRoomId'>

/** Stable identity of one logical participant across rounds. */
export type DiscussionParticipantId = Branded<'DiscussionParticipantId'>

/** Stable identity of one attempted model contribution. */
export type DiscussionMessageId = Branded<'DiscussionMessageId'>

/** Model route and persona selected for one participant. */
export interface DiscussionParticipantRequest {
  readonly name: string
  readonly role: string
  readonly provider: string
  readonly model: string
}

/** Model route selected for the independent final moderator. */
export interface DiscussionModeratorRequest {
  readonly name: string
  readonly provider: string
  readonly model: string
}

/** Browser request to start one bounded discussion in the addressed root Session. */
export interface CreateDiscussionRoomRequest {
  readonly topic: string
  readonly participants: readonly DiscussionParticipantRequest[]
  readonly moderator: DiscussionModeratorRequest
  readonly roundLimit: number
  readonly tokenLimit: number
}

/** Durable logical participant, independent of its per-contribution child Sessions. */
export interface DiscussionParticipant extends DiscussionParticipantRequest {
  readonly id: DiscussionParticipantId
}

/** Durable moderator identity and route. */
export interface DiscussionModerator extends DiscussionModeratorRequest {
  readonly id: DiscussionParticipantId
}

/** Lifecycle of the room-owned background workflow. */
export type DiscussionRoomStatus = 'running' | 'stopping' | 'completed' | 'failed' | 'stopped'

/** Lifecycle of one model contribution. */
export type DiscussionMessageStatus = 'running' | 'completed' | 'failed'

/** Durable model contribution and its captured result. */
export interface DiscussionMessage {
  readonly id: DiscussionMessageId
  readonly participantId: DiscussionParticipantId
  readonly participantName: string
  readonly role: string
  readonly provider: string
  readonly model: string
  readonly round: number
  readonly kind: 'opinion' | 'rebuttal' | 'summary'
  readonly status: DiscussionMessageStatus
  readonly childSessionId?: SessionId
  readonly text?: string
  readonly error?: string
}

/** Complete durable room checkpoint shown by Web clients. */
export interface DiscussionRoom {
  readonly id: DiscussionRoomId
  readonly topic: string
  readonly participants: readonly DiscussionParticipant[]
  readonly moderator: DiscussionModerator
  readonly roundLimit: number
  readonly tokenLimit: number
  readonly currentRound: number
  readonly status: DiscussionRoomStatus
  readonly messages: readonly DiscussionMessage[]
  readonly failure?: string
}

/** Current room projection, including a durable decode failure. */
export interface DiscussionRoomProjection {
  readonly room: DiscussionRoom | null
  readonly failure?: string
}

declare module '@deepseek-ai/dsh-session/types' {
  interface PluginRecordMap {
    /** Whole room checkpoint owned by the experimental discussion-room package. */
    'plugin:discussion-room/state': { readonly version: 1; readonly room: DiscussionRoom }
  }
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** Durable discussion configuration, progress, contributions, and failures. */
    discussionRoom: SessionProjectionSummaryExcluded<DiscussionRoomProjection>
  }
}
