import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canStartChallenge,
  challengeViewState,
  isChallengeParticipant,
} from '../src/utils/challenge/challengeLifecycle.js'

const base = { id: 'c1', challengerId: 'p1', defenderId: 'p2' }

test('awaiting challenges render the correct participant state', () => {
  assert.equal(challengeViewState({ ...base, status: 'awaiting' }, null, 'p1'), 'sent')
  assert.equal(challengeViewState({ ...base, status: 'awaiting' }, null, 'p2'), 'received')
})

test('accepted challenges remain unscheduled until a date is agreed', () => {
  assert.equal(
    challengeViewState({ ...base, status: 'accepted' }, null, 'p1'),
    'accepted_unscheduled',
  )
})

test('scheduled challenges become ready thirty minutes before play', () => {
  const now = Date.parse('2026-08-18T10:00:00.000Z')
  assert.equal(
    challengeViewState(
      { ...base, status: 'scheduled', scheduledAt: '2026-08-18T10:29:00.000Z' },
      null,
      'p1',
      now,
    ),
    'ready',
  )
  assert.equal(
    challengeViewState(
      { ...base, status: 'scheduled', scheduledAt: '2026-08-18T11:00:00.000Z' },
      null,
      'p1',
      now,
    ),
    'scheduled',
  )
})

test('live and result review states follow the match record', () => {
  assert.equal(
    challengeViewState({ ...base, status: 'scheduled' }, { status: 'live' }, 'p1'),
    'live',
  )
  assert.equal(
    challengeViewState({ ...base, status: 'scheduled' }, { status: 'pending_review' }, 'p1'),
    'pending_review',
  )
})

test('only participants can start ready challenges', () => {
  const challenge = { ...base, status: 'ready' }
  assert.equal(isChallengeParticipant(challenge, 'p1'), true)
  assert.equal(canStartChallenge(challenge, null, 'p2'), true)
  assert.equal(canStartChallenge(challenge, null, 'p3'), false)
})
