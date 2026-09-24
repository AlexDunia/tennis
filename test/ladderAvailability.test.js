import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getEligibleLadderOpponents,
  getLadderPlayerAvailability,
} from '../src/services/LadderAccessService.js'

const config = {
  id: 'mens-singles',
  seasonStatus: 'active',
  challengeRangeUp: 3,
  allowDownwardChallenges: false,
  maxActiveChallenges: 1,
}

test('pending review keeps both players unavailable', () => {
  const challenge = {
    id: 'c1',
    ladderId: 'mens-singles',
    challengerId: 'alex',
    defenderId: 'lucky',
    status: 'pending_review',
  }

  const alex = getLadderPlayerAvailability({
    player: { id: 'alex', rank: 5 },
    challenges: [challenge],
    config,
  })

  const lucky = getLadderPlayerAvailability({
    player: { id: 'lucky', rank: 3 },
    challenges: [challenge],
    config,
  })

  assert.equal(alex.available, false)
  assert.equal(lucky.available, false)
  assert.equal(alex.label, 'Result pending')
})

test('terminal challenge releases availability', () => {
  const result = getLadderPlayerAvailability({
    player: { id: 'alex', rank: 5 },
    challenges: [
      {
        ladderId: 'mens-singles',
        challengerId: 'alex',
        defenderId: 'lucky',
        status: 'completed',
      },
    ],
    config,
  })

  assert.equal(result.available, true)
})

test('max active challenges greater than one is respected', () => {
  const result = getLadderPlayerAvailability({
    player: { id: 'alex', rank: 5 },
    challenges: [
      {
        ladderId: 'mens-singles',
        challengerId: 'alex',
        defenderId: 'lucky',
        status: 'scheduled',
      },
    ],
    config: {
      ...config,
      maxActiveChallenges: 2,
    },
  })

  assert.equal(result.available, true)
  assert.equal(result.activeCount, 1)
})

test('unavailable player stays visible but is not legal opponent', () => {
  const eligible = getEligibleLadderOpponents({
    challenger: { id: 'alex', rank: 5 },
    players: [
      { id: 'lucky', rank: 3 },
      { id: 'john', rank: 4 },
    ],
    challenges: [
      {
        ladderId: 'mens-singles',
        challengerId: 'lucky',
        defenderId: 'david',
        status: 'scheduled',
      },
    ],
    config,
  })

  assert.deepEqual(
    eligible.map((player) => player.id),
    ['john'],
  )
})

test('Bulk drafts block Individual availability', () => {
  const result = getLadderPlayerAvailability({
    player: { id: 'alex', rank: 5 },
    challenges: [],
    config,
    clubId: 'club-a',
    ladderId: 'mens-singles',
    workspace: {
      bulkDrafts: [
        { id: 'draft-1', challengerId: 'alex', opponentId: 'lucky' },
      ],
      individualSelectedPlayerId: '',
    },
    ignoreWorkspaceKinds: ['individual'],
  })

  assert.equal(result.available, false)
  assert.equal(result.reason, 'bulk_draft')
  assert.equal(result.blocking?.kind, 'bulk_draft')
})

test('Individual selection does not block itself when Individual is ignored', () => {
  const result = getLadderPlayerAvailability({
    player: { id: 'alex', rank: 5 },
    challenges: [],
    config,
    clubId: 'club-a',
    ladderId: 'mens-singles',
    workspace: {
      bulkDrafts: [],
      individualSelectedPlayerId: 'alex',
    },
    ignoreWorkspaceKinds: ['individual'],
  })

  assert.equal(result.available, true)
})

test('Individual selection blocks Bulk-style availability when not ignored', () => {
  const result = getLadderPlayerAvailability({
    player: { id: 'alex', rank: 5 },
    challenges: [],
    config,
    clubId: 'club-a',
    ladderId: 'mens-singles',
    workspace: {
      bulkDrafts: [],
      individualSelectedPlayerId: 'alex',
    },
  })

  assert.equal(result.available, false)
  assert.equal(result.reason, 'individual_draft')
})

test('canonical challenges on a different ladder do not block this ladder', () => {
  const result = getLadderPlayerAvailability({
    player: { id: 'alex', rank: 5 },
    challenges: [
      {
        clubId: 'club-a',
        ladderId: 'womens-singles',
        challengerId: 'alex',
        defenderId: 'lucky',
        status: 'scheduled',
      },
    ],
    config,
    clubId: 'club-a',
    ladderId: 'mens-singles',
  })

  assert.equal(result.available, true)
})

test('same ladder in a different club does not block this club', () => {
  const result = getLadderPlayerAvailability({
    player: { id: 'alex', rank: 5 },
    challenges: [
      {
        clubId: 'club-b',
        ladderId: 'mens-singles',
        challengerId: 'alex',
        defenderId: 'lucky',
        status: 'scheduled',
      },
    ],
    config,
    clubId: 'club-a',
    ladderId: 'mens-singles',
  })

  assert.equal(result.available, true)
})