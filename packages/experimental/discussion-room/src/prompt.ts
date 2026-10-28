/** Model-visible prompts for independent opinions, bounded rebuttals, and moderation. */

import type { DiscussionParticipant, DiscussionRoom } from './types.ts'

function transcript(room: DiscussionRoom): string {
  const messages = room.messages.filter(message => message.status !== 'running').map(message => ({
    round: message.round,
    kind: message.kind,
    participant: message.participantName,
    role: message.role,
    outcome: message.status,
    ...message.text === undefined ? {} : { text: message.text },
    ...message.error === undefined ? {} : { error: message.error },
  }))
  return JSON.stringify(messages, null, 2)
}

function heading(room: DiscussionRoom, participant: DiscussionParticipant): string {
  return [
    `You are ${participant.name}. Your discussion role is: ${participant.role}.`,
    `Topic: ${room.topic}`,
    'Stay within that role, reason independently, and state material uncertainty. Do not call tools or ask the user questions.',
  ].join('\n')
}

/**
 * Build the exact first-round user prompt for one participant.
 * @param room - durable topic and participant configuration.
 * @param participant - logical participant receiving the prompt.
 * @returns the complete user-message text.
 */
export function opinionPrompt(room: DiscussionRoom, participant: DiscussionParticipant): string {
  return `${heading(room, participant)}\nGive your initial position with concrete reasoning and practical implications. Do not invent other participants' views.`
}

/**
 * Build the exact bounded-rebuttal user prompt for one participant.
 * @param room - durable room and settled transcript.
 * @param participant - logical participant receiving the prompt.
 * @param round - current one-based discussion round.
 * @returns the complete user-message text.
 */
export function rebuttalPrompt(room: DiscussionRoom, participant: DiscussionParticipant, round: number): string {
  return `${heading(room, participant)}\nThis is rebuttal round ${round} of ${room.roundLimit}. Read the durable discussion transcript below. Identify the strongest disagreement with another participant, answer it directly, and revise your own position only when the reasoning justifies it. Keep the response bounded to this round.\nTranscript:\n${transcript(room)}`
}

/**
 * Build the exact final moderator prompt, preserving consensus and disagreement.
 * @param room - durable room and complete settled transcript.
 * @returns the complete moderator user-message text.
 */
export function moderatorPrompt(room: DiscussionRoom): string {
  return [
    `You are ${room.moderator.name}, the independent moderator of a multi-model discussion.`,
    `Topic: ${room.topic}`,
    'Read the complete transcript, including participant failures. Produce a unified final recommendation without hiding disagreement.',
    'Use these sections: Consensus; Final recommendation; Remaining disagreements; Participant positions. Preserve a distinct position for every named participant, including minority and unchanged positions. Do not call tools or ask the user questions.',
    `Transcript:\n${transcript(room)}`,
  ].join('\n')
}
