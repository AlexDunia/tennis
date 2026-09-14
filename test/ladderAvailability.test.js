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
