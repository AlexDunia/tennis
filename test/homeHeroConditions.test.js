import { resolveLadderConfigFromSetup } from '../src/config/ladder.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveHomeFallbackPriority as fallback } from '../src/utils/homePriority/homeFallbackPriority.js'
import { resolveChallengeActionPriority as challengePriority } from '../src/utils/homePriority/challengeActionPriority.js'
import { resolveReadyMatchPriority as readyPriority } from '../src/utils/homePriority/readyMatchPriority.js'
import { resolveResultReviewPriority as reviewPriority } from '../src/utils/homePriority/resultReviewPriority.js'
import { resolveHomePriority } from '../src/utils/homePriority/resolveHomePriority.js'

const ladder = { id: 'open', name: 'Open Singles', enabled: true }
function context(overrides = {}) {
  return {
    club: { id: 'greenview', name: 'Greenview Tennis Club', setup: { membership: {} } },
    activeLadders: [ladder],
    players: [],
    actorId: 'alex',
    userId: 'account-alex',
    currentPlayerName: 'Alex Dunia',
    isAdmin: true,
    canCreateChallenge: true,
    challengeConfig: { ...resolveLadderConfigFromSetup({ ladders: [ladder] }, 'open'), id: 'open' },
    ...overrides,
  }
}
function withMembers(records, collection = 'roster', overrides = {}) {
  const input = context(overrides)
  input.club = {
    ...input.club,
    setup: { ...input.club.setup, membership: { [collection]: records } },
  }
  return input
}
const member = { id: 'member-alex', userId: 'account-alex', name: 'Alex Dunia', status: 'active' }

for (const collection of ['roster', 'manualMembers', 'importedMembers']) {
  test(`${collection}: club members with an empty player store are not asked to add members`, () => {
    const result = fallback(withMembers([member], collection))
    assert.equal(result.kind, 'ladder_needs_placement')
    assert.equal(result.action, 'open_ladder')
    assert.match(result.supportingText, /already added/)
    assert.doesNotMatch(result.supportingText, /Add your club members/)
  })
}

test('existing imported ladder positions work without the global player API', () => {
  const result = fallback(
    withMembers(
      [
        {
          ...member,
          ladderMemberships: [{ ladderId: 'open', ladderName: 'Open Singles', position: 4 }],
        },
      ],
      'importedMembers',
    ),
  )
  assert.equal(result.kind, 'ladder_position')
  assert.equal(result.title, 'You’re #4 in Open Singles')
  assert.equal(result.action, 'open_ladder')
})

test('another member on the ladder produces a populated ladder, not an add-members prompt', () => {
  const result = fallback(
    withMembers([
      {
        id: 'lucky',
        name: 'Lucky',
        ladderMemberships: [{ ladderName: 'Open Singles', position: 1 }],
      },
    ]),
  )
  assert.equal(result.kind, 'ladder_available')
  assert.match(result.supportingText, /1 player is/)
})

test('duplicate member collections are counted once', () => {
  const entry = { ...member, ladderMemberships: [{ ladderName: 'Open Singles', position: 1 }] }
  const input = withMembers([entry])
  input.club.setup.membership.importedMembers = [entry]
  assert.match(fallback(input).supportingText, /1 player is/)
})

test('selected legacy club members count as member evidence even before players load', () => {
  const input = context()
  input.club.setup.membership.selectedPlayerIds = ['alex']
  assert.equal(fallback(input).action, 'open_ladder')
})

test('a truly empty admin club is the only add-members setup case', () => {
  assert.equal(fallback(context()).action, 'add_members')
  assert.equal(fallback(context({ activeLadders: [] })).action, 'add_members')
  assert.equal(fallback(context({ isAdmin: false })).action, 'open_ladder')
  assert.equal(fallback(context({ activeLadders: [], isAdmin: false })).action, 'open_club')
})

test('existing members without a ladder are not described as a fresh club', () => {
  const result = fallback(withMembers([member], 'manualMembers', { activeLadders: [] }))
  assert.equal(result.kind, 'club_needs_ladder')
  assert.equal(result.action, 'open_ladder')
  assert.doesNotMatch(result.title, /first ladder/)
})

test('disabled and archived ladders are excluded from the active-ladder conditions', () => {
  for (const inactive of [
    { ...ladder, enabled: false },
    { ...ladder, archived: true },
  ]) {
    assert.equal(
      fallback(withMembers([member], 'roster', { activeLadders: [inactive] })).kind,
      'club_needs_ladder',
    )
  }
})

test('missing or failed data produces a neutral state, never a false empty-club instruction', () => {
  assert.equal(fallback(context({ dataReady: false })).action, 'open_club')
  assert.equal(
    fallback(context({ club: { id: 'greenview', name: 'Greenview' } })).kind,
    'club_overview',
  )
  assert.equal(fallback(context({ club: null })), null)
})

test('unscoped global players and players from another club cannot supply a Home rank', () => {
  for (const player of [
    { id: 'alex', rank: 3 },
    { id: 'alex', rank: 3, clubId: 'other' },
  ]) {
    assert.notEqual(fallback(context({ players: [player] })).kind, 'ladder_position')
  }
})

test('the hero selects the player’s actual ladder instead of applying their rank to the first ladder', () => {
  const second = { id: 'women', name: 'Women’s Singles', enabled: true }
  const result = fallback(
    withMembers(
      [
        {
          ...member,
          ladderMemberships: [{ ladderId: 'women', ladderName: 'Women’s Singles', position: 2 }],
        },
      ],
      'roster',
      { activeLadders: [ladder, second] },
    ),
  )
  assert.equal(result.title, 'You’re #2 in Women’s Singles')
  assert.equal(result.ladderId, 'women')
})

test('explicit exclusion and local ladder removal override stale member placement', () => {
  const entry = {
    ...member,
    ladderMemberships: [{ ladderId: 'open', ladderName: 'Open Singles', position: 2 }],
  }
  assert.notEqual(
    fallback(withMembers([entry], 'roster', { activeLadders: [{ ...ladder, memberIds: [] }] }))
      .kind,
    'ladder_position',
  )
  assert.notEqual(
    fallback(
      withMembers([entry], 'roster', {
        ladderStateFor: () => ({ removedPlayerIds: ['member-alex'] }),
      }),
    ).kind,
    'ladder_position',
  )
})

test('challenge CTA respects permission, paused players, and existing challenges', () => {
  const players = [
    { id: 'alex', clubId: 'greenview', ladderIds: ['open'], rank: 2 },
    { id: 'lucky', clubId: 'greenview', ladderIds: ['open'], rank: 1 },
  ]
  assert.equal(fallback(context({ players })).action, 'create_challenge')
  assert.equal(fallback(context({ players, canCreateChallenge: false })).action, 'open_ladder')
  assert.equal(
    fallback(context({ players, ladderStateFor: () => ({ pausedPlayerIds: ['alex'] }) })).action,
    'open_ladder',
  )
  assert.equal(
    fallback(
      context({
        players,
        challenges: [
          {
            id: 'pending',
            clubId: 'greenview',
            ladderId: 'open',
            challengerId: 'alex',
            defenderId: 'lucky',
            status: 'awaiting',
          },
        ],
      }),
    ).action,
    'open_ladder',
  )
})

const now = Date.parse('2026-09-14T12:00:00Z')
const challenge = {
  id: 'challenge-a',
  clubId: 'greenview',
  challengerId: 'alex',
  defenderId: 'lucky',
  challengerName: 'Alex',
  defenderName: 'Lucky',
}
const match = {
  id: 'match-a',
  challengeId: challenge.id,
  clubId: 'greenview',
  status: 'pending_review',
  resultSubmittedBy: 'alex',
  resultSubmittedAt: '2026-09-13T10:00:00Z',
  score: '6-4, 6-3',
}

test('an outstanding result review does not disappear after four hours or when its time is absent', () => {
  for (const resultSubmittedAt of [match.resultSubmittedAt, null]) {
    const result = reviewPriority({
      challenges: [{ ...challenge, status: 'pending_review' }],
      matches: [{ ...match, resultSubmittedAt }],
      clubId: 'greenview',
      actorId: 'lucky',
      now,
    })
    assert.equal(result?.kind, 'result_review')
  }
  assert.equal(
    reviewPriority({
      challenges: [{ ...challenge, status: 'pending_review' }],
      matches: [match],
      clubId: 'greenview',
      actorId: 'alex',
      now,
    }),
    null,
  )
})

test('all challenge hero branches reject unknown clubs, conflicting clubs, outsiders, and terminal matches', () => {
  for (const [resolve, status] of [
    [challengePriority, 'awaiting'],
    [readyPriority, 'ready'],
    [reviewPriority, 'pending_review'],
  ]) {
    const input = {
      challenges: [{ ...challenge, status }],
      matches: [{ ...match, status }],
      actorId: 'lucky',
      clubId: 'greenview',
      now,
    }
    assert.ok(resolve(input), status)
    assert.equal(resolve({ ...input, clubId: 'other' }), null)
    assert.equal(resolve({ ...input, actorId: 'outsider' }), null)
    assert.equal(resolve({ ...input, matches: [{ ...input.matches[0], clubId: 'other' }] }), null)
    assert.equal(
      resolve({
        ...input,
        challenges: [{ ...input.challenges[0], clubId: '' }],
        matches: [{ ...input.matches[0], clubId: '' }],
      }),
      null,
    )
    assert.equal(
      resolve({ ...input, matches: [{ ...input.matches[0], status: 'completed' }] }),
      null,
    )
  }
})

test('one highest-priority state wins through every transition down to the fallback', () => {
  const candidates = [
    ['live_match', 100],
    ['ready_match', 90],
    ['challenge_received', 85],
    ['result_review', 80],
    ['challenge_needs_schedule', 75],
    ['result_waiting_confirmation', 70],
    ['scheduled_match', 60],
    ['ladder_position', 30],
  ].map(([kind, priority]) => ({ id: kind, kind, priority }))
  while (candidates.length) {
    assert.equal(resolveHomePriority([...candidates].reverse()).kind, candidates[0].kind)
    candidates.shift()
  }
})

test('inactive member records still prevent a false fresh-club prompt', () => {
  assert.equal(fallback(withMembers([{ ...member, status: 'inactive' }])).action, 'open_ladder')
})

test('a different or unsupported challenge ladder never gets a misleading create CTA', () => {
  const players = [
    { id: 'alex', clubId: 'greenview', ladderIds: ['open'], rank: 2 },
    { id: 'lucky', clubId: 'greenview', ladderIds: ['open'], rank: 1 },
  ]
  assert.equal(fallback(context({ players, challengeConfig: null })).action, 'open_ladder')
  assert.equal(
    fallback(context({ players, challengeConfig: { id: 'other', seasonStatus: 'active' } })).action,
    'open_ladder',
  )
  assert.equal(
    fallback(
      context({
        players,
        challenges: [{ challengerId: 'alex', defenderId: 'lucky', status: 'awaiting' }],
      }),
    ).action,
    'open_ladder',
  )
})
