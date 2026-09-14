import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createMinimalClubSetup,
} from '../src/config/admin.js'
import {
  normalizeClubSetup,
} from '../src/utils/admin/clubSetup.js'
import {
  createLadderFromForm,
} from '../src/services/LadderWorkspaceService.js'

function setup() {
  return normalizeClubSetup(
    createMinimalClubSetup({
      name: 'Greenview Tennis Club',
    }),
  )
}

test('clubs get stable default player levels', () => {
  const current = setup()

  assert.deepEqual(
    current.playerLevels.levels.map((level) => level.id),
    ['beginner', 'intermediate', 'advanced', 'competition'],
  )
})

test('ladder creation stores stable club level IDs', () => {
  const current = setup()

  const result = createLadderFromForm({
    setup: current,
    input: {
      name: "Men's Singles",
      matchType: 'singles',
      eligibility: {
        gender: 'men',
        age: { mode: 'any' },
        skill: {
          mode: 'club_level',
          levelIds: ['intermediate', 'advanced'],
        },
      },
    },
  })

  assert.equal(result.ladder.eligibility.skill.mode, 'club_level')
  assert.deepEqual(
    result.ladder.eligibility.skill.levelIds,
    ['intermediate', 'advanced'],
  )
})

test('ladder creation rejects a forged club level ID', () => {
  const current = setup()

  assert.throws(
    () =>
      createLadderFromForm({
        setup: current,
        input: {
          name: "Men's Singles",
          eligibility: {
            gender: 'men',
            age: { mode: 'any' },
            skill: {
              mode: 'club_level',
              levelIds: ['super-admin-level'],
            },
          },
        },
      }),
    /Choose player levels already used by this club/,
  )
})
