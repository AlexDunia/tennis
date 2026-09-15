import test from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateLadderEligibility,
  ladderEligibilityMissingFields,
  ladderRequirementsLabel,
  normalizeLadderEligibility,
} from '../src/domain/ladderWorkspace.js'
import {
  normalizeMemberRatings,
  normalizePlayerRatingValue,
} from '../src/domain/playerRatings.js'

test('NTRP accepts supported half-step values only', () => {
  assert.equal(
    normalizePlayerRatingValue(
      'ntrp',
      3.5,
    ),
    3.5,
  )

  assert.equal(
    normalizePlayerRatingValue(
      'ntrp',
      3.7,
    ),
    null,
  )
})

test('rating Ladder stores system and range', () => {
  const eligibility =
    normalizeLadderEligibility({
      gender: 'men',
      age: {
        mode: 'range',
        minimum: 18,
        maximum: 100,
      },
      skill: {
        mode: 'rating',
        ratingSystem: 'ntrp',
        minimum: 3,
        maximum: 4,
      },
    })

  assert.equal(
    eligibility.skill.mode,
    'rating',
  )

  assert.equal(
    eligibility.skill.ratingSystem,
    'ntrp',
  )

  assert.equal(
    eligibility.skill.minimum,
    3,
  )

  assert.equal(
    eligibility.skill.maximum,
    4,
  )
})

test('missing rating is a required admin-owned fact', () => {
  const missing =
    ladderEligibilityMissingFields(
      {
        skill: {
          mode: 'rating',
          ratingSystem: 'ntrp',
          minimum: 3,
          maximum: 4,
        },
      },
      {
        name: 'Alex Dunia',
      },
    )

  assert.deepEqual(
    missing,
    ['rating'],
  )
})

test('known rating is checked mathematically', () => {
  const inside =
    evaluateLadderEligibility({
      eligibility: {
        skill: {
          mode: 'rating',
          ratingSystem: 'ntrp',
          minimum: 3,
          maximum: 4,
        },
      },
      profile: {
        ratings: {
          ntrp: {
            value: 3.5,
            source: 'admin',
          },
        },
      },
    })

  const outside =
    evaluateLadderEligibility({
      eligibility: {
        skill: {
          mode: 'rating',
          ratingSystem: 'ntrp',
          minimum: 3,
          maximum: 4,
        },
      },
      profile: {
        ratings: {
          ntrp: {
            value: 4.5,
            source: 'admin',
          },
        },
      },
    })

  assert.equal(
    inside.eligible,
    true,
  )

  assert.equal(
    outside.eligible,
    false,
  )

  assert.equal(
    outside.reason,
    'rating',
  )
})

test('rating requirement label is human readable', () => {
  assert.equal(
    ladderRequirementsLabel({
      gender: 'men',
      age: {
        mode: 'range',
        minimum: 18,
        maximum: 100,
      },
      skill: {
        mode: 'rating',
        ratingSystem: 'ntrp',
        minimum: 3,
        maximum: 4,
      },
    }),
    'Men Â· Age 18+ Â· NTRP 3.0â€“4.0',
  )
})

test('member ratings remain separate by system', () => {
  const ratings =
    normalizeMemberRatings({
      ntrp: {
        value: 3.5,
        source: 'admin-import',
      },
      utr: {
        value: 7.42,
        source: 'external',
        verified: true,
      },
    })

  assert.equal(
    ratings.ntrp.value,
    3.5,
  )

  assert.equal(
    ratings.utr.value,
    7.42,
  )

  assert.equal(
    ratings.utr.verified,
    true,
  )
})
