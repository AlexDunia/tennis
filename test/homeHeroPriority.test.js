import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolveChallengeActionPriority } from '../src/utils/homePriority/challengeActionPriority.js'
import { resolveHomeFallbackPriority } from '../src/utils/homePriority/homeFallbackPriority.js'
import { resolveHomePriority } from '../src/utils/homePriority/resolveHomePriority.js'

const NOW = Date.parse('2026-09-14T10:00:00.000Z')

function baseChallenge(overrides = {}) {
  return {
    id: 'challenge-1',
    clubId: 'club-1',
    challengerId: 'alex',
    challengerName: 'Alex Dunia',
    defenderId: 'lucky',
    defenderName: 'Lucky Mensah',
    createdAt: '2026-09-14T09:00:00.000Z',
    ...overrides,
  }
}

test('received challenge becomes a personal Home action', () => {
  const priority = resolveChallengeActionPriority({
    challenges: [
      baseChallenge({ status: 'awaiting' }),
    ],
    matches: [],
    actorId: 'lucky',
    clubId: 'club-1',
    now: NOW,
  })

  assert.equal(priority?.kind, 'challenge_received')
  assert.equal(priority?.personName, 'Alex Dunia')
  assert.equal(priority?.title, 'Alex Dunia challenged you')
  assert.equal(priority?.ctaLabel, 'Respond to Alex')
})

test('a sent challenge does not pretend the sender needs to respond', () => {
  const priority = resolveChallengeActionPriority({
    challenges: [
      baseChallenge({ status: 'awaiting' }),
    ],
    matches: [],
    actorId: 'alex',
    clubId: 'club-1',
    now: NOW,
  })

  assert.equal(priority, null)
})

test('accepted unscheduled challenge asks either participant to schedule', () => {
  const priority = resolveChallengeActionPriority({
    challenges: [
      baseChallenge({ status: 'accepted' }),
    ],
    matches: [],
    actorId: 'alex',
    clubId: 'club-1',
    now: NOW,
  })

  assert.equal(
    priority?.kind,
    'challenge_needs_schedule',
  )
  assert.equal(priority?.title, 'Set a time with Lucky')
  assert.equal(priority?.action, 'open_challenge')
})

test('the result submitter sees a waiting state, not a fake review action', () => {
  const priority = resolveChallengeActionPriority({
    challenges: [
      baseChallenge({
        status: 'pending_review',
        resultSubmittedBy: 'alex',
        resultSubmittedAt:
          '2026-09-14T09:45:00.000Z',
      }),
    ],
    matches: [],
    actorId: 'alex',
    clubId: 'club-1',
    now: NOW,
  })

  assert.equal(
    priority?.kind,
    'result_waiting_confirmation',
  )
  assert.match(
    priority?.supportingText || '',
    /position stays the same/i,
  )
})

test('a scheduled challenge is promoted only when it is coming up soon', () => {
  const soon = resolveChallengeActionPriority({
    challenges: [
      baseChallenge({
        status: 'scheduled',
        scheduledAt: '2026-09-14T14:00:00.000Z',
      }),
    ],
    matches: [],
    actorId: 'alex',
    clubId: 'club-1',
    now: NOW,
  })

  const later = resolveChallengeActionPriority({
    challenges: [
      baseChallenge({
        status: 'scheduled',
        scheduledAt: '2026-09-16T14:00:00.000Z',
      }),
    ],
    matches: [],
    actorId: 'alex',
    clubId: 'club-1',
    now: NOW,
  })

  assert.equal(soon?.kind, 'scheduled_match')
  assert.equal(later, null)
})

test('ranked calm state uses real rank and never invents movement history', () => {
  const priority = resolveHomeFallbackPriority({
    club: {
      id: 'club-1',
      name: 'Greenview Tennis Club',
      setup: { membership: {} },
    },
    activeLadders: [
      {
        id: 'mens',
        name: "Men's Singles",
      },
    ],
    currentPlayer: {
      id: 'alex',
      name: 'Alex Dunia',
      rank: 3,
    },
    currentPlayerName: 'Alex Dunia',
    availableOpponents: [
      { id: 'lucky' },
      { id: 'mike' },
    ],
    playerCount: 12,
    isAdmin: false,
  })

  assert.equal(
    priority?.title,
    "You’re #3 in Men's Singles",
  )
  assert.equal(priority?.ctaLabel, 'Challenge someone')
  assert.doesNotMatch(
    `${priority?.title} ${priority?.supportingText}`,
    /up\s+\d+|this week/i,
  )
})

test('a genuinely fresh admin club gets a useful zero state', () => {
  const priority = resolveHomeFallbackPriority({
    club: {
      id: 'club-1',
      name: 'Greenview Tennis Club',
      setup: {
        membership: {
          roster: [],
          importedMembers: [],
          manualMembers: [],
          selectedPlayerIds: [],
        },
      },
    },
    activeLadders: [],
    currentPlayer: null,
    currentPlayerName: 'Alex Dunia',
    availableOpponents: [],
    playerCount: 0,
    isAdmin: true,
  })

  assert.equal(priority?.kind, 'fresh_club')
  assert.equal(
    priority?.title,
    'Welcome to Greenview Tennis Club, Alex',
  )
  assert.equal(priority?.ctaLabel, 'Add members')
  assert.equal(priority?.action, 'add_members')
})

test('a fresh normal member is not shown admin setup actions', () => {
  const priority = resolveHomeFallbackPriority({
    club: {
      id: 'club-1',
      name: 'Greenview Tennis Club',
      setup: { membership: {} },
    },
    activeLadders: [],
    currentPlayer: null,
    currentPlayerName: 'Lucky Mensah',
    isAdmin: false,
  })

  assert.equal(priority?.kind, 'fresh_club')
  assert.equal(priority?.ctaLabel, 'Open club')
  assert.equal(priority?.action, 'open_club')
})

test('a real action beats the calm fallback', () => {
  const winner = resolveHomePriority([
    {
      id: 'calm',
      priority: 30,
      kind: 'ladder_position',
    },
    {
      id: 'received',
      priority: 85,
      kind: 'challenge_received',
    },
  ])

  assert.equal(winner?.kind, 'challenge_received')
})

test('HomePrioritySlot is single-state and contains no old carousel timer', async () => {
  const source = await readFile(
    new URL(
      '../src/components/dashboard/HomePrioritySlot.vue',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(source, /priority:/)
  assert.doesNotMatch(source, /rotationIndex|progressWidth|7000|setInterval/)
})
