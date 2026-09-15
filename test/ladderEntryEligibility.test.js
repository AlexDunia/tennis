import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addMembersToLadder,
} from '../src/services/LadderWorkspaceService.js'

function ladder() {
  return {
    id: 'mens-ntrp',
    name: "Men's NTRP",
    status: 'setup',
    setupStep: 'members',
    entries: [],
    eligibility: {
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
    },
  }
}

function setupWith(member) {
  return {
    membership: {
      roster: [],
      manualMembers: [member],
      importedMembers: [],
    },
    playerLevels: {
      levels: [],
    },
    ladders: [ladder()],
  }
}

test('direct admin add cannot bypass Ladder eligibility', () => {
  const setup = setupWith({
    id: 'alex',
    name: 'Alex Dunia',
    gender: 'men',
    dob: '1990-01-01',
    ratings: {
      ntrp: {
        value: 4.5,
        source: 'admin',
      },
    },
  })

  assert.throws(
    () =>
      addMembersToLadder({
        setup,
        ladderId: 'mens-ntrp',
        memberIds: ['alex'],
      }),
    /does not meet this Ladder/,
  )
})

test('direct admin add explains missing authoritative rating', () => {
  const setup = setupWith({
    id: 'alex',
    name: 'Alex Dunia',
    gender: 'men',
    dob: '1990-01-01',
    ratings: {},
  })

  assert.throws(
    () =>
      addMembersToLadder({
        setup,
        ladderId: 'mens-ntrp',
        memberIds: ['alex'],
      }),
    /needs NTRP/,
  )
})

test('eligible club member can be added', () => {
  const setup = setupWith({
    id: 'alex',
    name: 'Alex Dunia',
    gender: 'men',
    dob: '1990-01-01',
    ratings: {
      ntrp: {
        value: 3.5,
        source: 'admin',
      },
    },
  })

  const result = addMembersToLadder({
    setup,
    ladderId: 'mens-ntrp',
    memberIds: ['alex'],
  })

  assert.equal(
    result.ladder.entries.length,
    1,
  )

  assert.equal(
    result.ladder.entries[0].memberId,
    'alex',
  )
})
