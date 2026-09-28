import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PERSONAL_PLAY_ACTIONS,
  PERSONAL_PLAY_GROUPS,
  buildPersonalPlayItems,
} from '../src/domain/playMatchItems.js'

const NOW = Date.parse('2026-09-27T12:00:00.000Z')

function challenge(overrides = {}) {
  return {
    id: 'challenge-1',
    clubId: 'club-a',
    ladderId: 'ladder-a',
    challengerId: 'player-a',
    defenderId: 'player-b',
    challengerName: 'Alex Dunia',
    defenderName: 'Chidi Okafor',
    status: 'awaiting',
    requestedAt: '2026-09-27T10:00:00.000Z',
    ladderConfigSnapshot: { name: "Men's Singles" },
    ...overrides,
  }
}

function ladderMatch(overrides = {}) {
  return {
    id: 'match-1',
    challengeId: 'challenge-1',
    clubId: 'club-a',
    ladderId: 'ladder-a',
    type: 'ladder',
    challengerId: 'player-a',
    defenderId: 'player-b',
    challengerName: 'Alex Dunia',
    defenderName: 'Chidi Okafor',
    status: 'accepted',
    ...overrides,
  }
}

function build({ actorId = 'player-a', challenges = [], matches = [], activeClubId = 'club-a' }) {
  return buildPersonalPlayItems({
    actorId,
    activeClubId,
    challenges,
    matches,
    now: NOW,
  })
}

test('participant sees their active Ladder commitment', () => {
  const items = build({
    actorId: 'player-a',
    challenges: [challenge()],
  })

  assert.equal(items.length, 1)
  assert.equal(items[0].challengeId, 'challenge-1')
})

test('non-participant and non-participant admin identity cannot leak into My matches', () => {
  const items = build({
    actorId: 'club-admin-user',
    challenges: [challenge()],
    matches: [ladderMatch()],
  })

  assert.deepEqual(items, [])
})

test('awaiting challenge becomes received for defender and sent for challenger', () => {
  const received = build({ actorId: 'player-b', challenges: [challenge()] })[0]
  const sent = build({ actorId: 'player-a', challenges: [challenge()] })[0]

  assert.equal(received.lifecycle, 'received')
  assert.equal(received.group, PERSONAL_PLAY_GROUPS.NEEDS_YOU)
  assert.deepEqual(
    received.actions.map((item) => item.id),
    [PERSONAL_PLAY_ACTIONS.ACCEPT_CHALLENGE, PERSONAL_PLAY_ACTIONS.DECLINE_CHALLENGE],
  )

  assert.equal(sent.lifecycle, 'sent')
  assert.equal(sent.group, PERSONAL_PLAY_GROUPS.UPCOMING)
})

test('accepted challenge without a time becomes accepted_unscheduled', () => {
  const items = build({
    actorId: 'player-a',
    challenges: [challenge({ status: 'accepted' })],
    matches: [ladderMatch({ status: 'accepted' })],
  })

  assert.equal(items[0].lifecycle, 'accepted_unscheduled')
  assert.equal(items[0].group, PERSONAL_PLAY_GROUPS.NEEDS_YOU)
  assert.equal(items[0].actions[0].id, PERSONAL_PLAY_ACTIONS.SCHEDULE_MATCH)
})

test('scheduled challenge becomes ready inside the existing thirty-minute window', () => {
  const scheduledAt = '2026-09-27T12:20:00.000Z'
  const items = build({
    challenges: [challenge({ status: 'scheduled', scheduledAt })],
    matches: [ladderMatch({ status: 'scheduled', scheduledAt })],
  })

  assert.equal(items[0].lifecycle, 'ready')
  assert.equal(items[0].group, PERSONAL_PLAY_GROUPS.NOW)
  assert.equal(items[0].actions[0].id, PERSONAL_PLAY_ACTIONS.START_MATCH)
})

test('linked Challenge and Match render as one personal item', () => {
  const items = build({
    challenges: [challenge({ status: 'scheduled', scheduledAt: '2026-09-28T12:00:00.000Z' })],
    matches: [ladderMatch({ status: 'scheduled', scheduledAt: '2026-09-28T12:00:00.000Z' })],
  })

  assert.equal(items.length, 1)
  assert.equal(items[0].challengeId, 'challenge-1')
  assert.equal(items[0].matchId, 'match-1')
})

test('terminal Ladder challenge states are excluded', () => {
  for (const status of ['completed', 'declined', 'cancelled', 'expired']) {
    const items = build({
      challenges: [challenge({ status })],
      matches: [ladderMatch({ status })],
    })
    assert.equal(items.length, 0, `${status} should not appear in My matches`)
  }
})

test('pending review knows whether this actor must review or is waiting', () => {
  const pendingMatch = ladderMatch({
    status: 'pending_review',
    resultSubmittedBy: 'player-a',
    score: '6-4, 3-6, 10-7',
  })
  const pendingChallenge = challenge({ status: 'pending_review' })

  const reviewer = build({
    actorId: 'player-b',
    challenges: [pendingChallenge],
    matches: [pendingMatch],
  })[0]
  const submitter = build({
    actorId: 'player-a',
    challenges: [pendingChallenge],
    matches: [pendingMatch],
  })[0]

  assert.equal(reviewer.needsActorAction, true)
  assert.equal(reviewer.group, PERSONAL_PLAY_GROUPS.NEEDS_YOU)
  assert.equal(reviewer.actions[0].id, PERSONAL_PLAY_ACTIONS.REVIEW_RESULT)

  assert.equal(submitter.needsActorAction, false)
  assert.equal(submitter.group, PERSONAL_PLAY_GROUPS.UPCOMING)
})

test('scheduled upcoming matches sort by earliest scheduled time', () => {
  const items = buildPersonalPlayItems({
    actorId: 'player-a',
    activeClubId: 'club-a',
    now: NOW,
    challenges: [
      challenge({
        id: 'challenge-later',
        defenderId: 'player-b',
        status: 'scheduled',
        scheduledAt: '2026-09-29T12:00:00.000Z',
      }),
      challenge({
        id: 'challenge-earlier',
        defenderId: 'player-c',
        defenderName: 'Daniel Cole',
        status: 'scheduled',
        scheduledAt: '2026-09-28T12:00:00.000Z',
      }),
    ],
  })

  assert.deepEqual(
    items.map((item) => item.challengeId),
    ['challenge-earlier', 'challenge-later'],
  )
})

test('different active club records are excluded', () => {
  const items = build({
    activeClubId: 'club-b',
    challenges: [challenge({ clubId: 'club-a' })],
  })

  assert.deepEqual(items, [])
})

