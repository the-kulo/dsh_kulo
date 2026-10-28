import { describe, expect, it } from 'vitest'
import type { DiscussionRoom } from '../src/types.ts'
import { moderatorPrompt, opinionPrompt, rebuttalPrompt } from '../src/prompt.ts'

const room: DiscussionRoom = {
  id: 'room' as DiscussionRoom['id'],
  topic: 'Choose a cache',
  participants: [
    { id: 'participant-1' as DiscussionRoom['participants'][number]['id'], name: 'A', role: 'support', provider: 'p', model: 'a' },
    { id: 'participant-2' as DiscussionRoom['participants'][number]['id'], name: 'B', role: 'challenge', provider: 'p', model: 'b' },
  ],
  moderator: { id: 'moderator' as DiscussionRoom['moderator']['id'], name: 'M', provider: 'p', model: 'm' },
  roundLimit: 3,
  tokenLimit: 100,
  currentRound: 2,
  status: 'running',
  messages: [{
    id: 'message-1' as DiscussionRoom['messages'][number]['id'],
    participantId: 'participant-1' as DiscussionRoom['participants'][number]['id'],
    participantName: 'A', role: 'support', provider: 'p', model: 'a', round: 1, kind: 'opinion', status: 'completed', text: 'Use it',
  }],
}

describe('discussion prompts', () => {
  it('keeps first opinions independent and rounds bounded', () => {
    expect(opinionPrompt(room, room.participants[0]!)).toContain('Do not invent other participants')
    expect(rebuttalPrompt(room, room.participants[0]!, 2)).toContain('rebuttal round 2 of 3')
    expect(rebuttalPrompt(room, room.participants[0]!, 2)).toContain('"text": "Use it"')
  })

  it('requires consensus, one recommendation, disagreements, and every position', () => {
    const prompt = moderatorPrompt(room)
    expect(prompt).toContain('Consensus; Final recommendation; Remaining disagreements; Participant positions')
    expect(prompt).toContain('every named participant')
    expect(prompt).toContain('including participant failures')
  })
})
