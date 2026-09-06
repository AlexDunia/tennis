import assert from 'node:assert/strict'
import test from 'node:test'

import {
  resolveLadderConfigFromSetup,
} from '../src/config/ladder.js'

const setup = {
  clubId: 'club-1',
  status: 'active',
  primaryLadderId: 'mens',
  rules: {
    challengeRangeUp: 3,
    movementSystem: 'position-swap',
    scoring: 'ad',
    matchPreset: 'standard-club',
  },
  ladders: [
    {
      id: 'mens',
      name: "Men's Singles",
      matchType: 'singles',
      enabled: true,
      archived: false,
      rules: {
        challengeRangeUp: 2,
        movementSystem: 'leapfrog',
        scoring: 'ad',
        matchPreset: 'time-smart',
      },
    },
    {
      id: 'womens',
      name: "Women's Singles",
      matchType: 'singles',
      enabled: true,
      archived: false,
      rules: {
        challengeRangeUp: 5,
        movementSystem: 'position-swap',
        scoring: 'noad',
        matchPreset: 'standard-club',
      },
    },
  ],
}

test('each ladder resolves its own challenge and match defaults', () => {
  const mens = resolveLadderConfigFromSetup(setup, 'mens')
  const womens = resolveLadderConfigFromSetup(setup, 'womens')

  assert.equal(mens.challengeRangeUp, 2)
  assert.equal(mens.movementSystem, 'leapfrog')
  assert.equal(mens.matchPreset, 'time-smart')
  assert.equal(mens.scoring, 'ad')

  assert.equal(womens.challengeRangeUp, 5)
  assert.equal(womens.movementSystem, 'position-swap')
  assert.equal(womens.matchPreset, 'standard-club')
  assert.equal(womens.scoring, 'noad')
})

test('older clubs still fall back to legacy club rules', () => {
  const legacy = {
    ...setup,
    ladders: [
      {
        id: 'legacy',
        name: 'Legacy Ladder',
        matchType: 'singles',
        enabled: true,
        archived: false,
      },
    ],
    primaryLadderId: 'legacy',
  }

  const config = resolveLadderConfigFromSetup(legacy, 'legacy')

  assert.equal(config.challengeRangeUp, 3)
  assert.equal(config.movementSystem, 'position-swap')
  assert.equal(config.scoring, 'ad')
})

