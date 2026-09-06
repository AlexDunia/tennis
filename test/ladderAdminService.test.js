import assert from 'node:assert/strict'
import test from 'node:test'

import {
  effectiveLadderRoster,
  moveLadderPlayer,
  previewMissingMatchMovement,
  recordMissingLadderMatch,
  setLadderChallengePaused,
} from '../src/services/LadderAdminService.js'

function storage() {
  const map = new Map()

  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null
    },
    setItem(key, value) {
      map.set(key, String(value))
    },
    removeItem(key) {
      map.delete(key)
    },
    clear() {
      map.clear()
    },
  }
}

global.window = {
  localStorage: storage(),
}

const scope = {
  clubId: 'greenview',
  ladderId: 'mens-singles',
}

function roster() {
  return [
    { id: 'a', name: 'Amara', rank: 1 },
    { id: 'b', name: 'Tobi', rank: 2 },
    { id: 'c', name: 'Henry', rank: 3 },
    { id: 'd', name: 'Sarah', rank: 4 },
    { id: 'e', name: 'Alex', rank: 5 },
  ]
}

test('manual move-to shifts the players between positions', () => {
  window.localStorage.clear()

  const result = moveLadderPlayer({
    scope,
    roster: roster(),
    playerId: 'e',
    targetRank: 3,
    actorName: 'Club admin',
  })

  assert.equal(result.fromRank, 5)
  assert.equal(result.toRank, 3)

  const next = effectiveLadderRoster(scope, roster())

  assert.deepEqual(
    next.map((player) => player.id),
    ['a', 'b', 'e', 'c', 'd'],
  )
})

test('pause challenges persists without removing the player from the ladder', () => {
  window.localStorage.clear()

  setLadderChallengePaused({
    scope,
    roster: roster(),
    playerId: 'c',
    paused: true,
    actorName: 'Club admin',
  })

  const next = effectiveLadderRoster(scope, roster())
  const henry = next.find((player) => player.id === 'c')

  assert.equal(henry.challengePaused, true)
  assert.equal(next.length, 5)
})

test('missing singles result can apply bump-rank movement from a real score', () => {
  window.localStorage.clear()

  const preview = previewMissingMatchMovement({
    scope,
    roster: roster(),
    movementSystem: 'bump-rank',
    matchType: 'singles',
    sideAIds: ['e'],
    sideBIds: ['c'],
    sets: [
      { sideA: 6, sideB: 4 },
      { sideA: 6, sideB: 3 },
    ],
  })

  assert.equal(preview.valid, true)
  assert.equal(preview.winnerSide, 'A')
  assert.equal(preview.winnerFrom, 5)
  assert.equal(preview.winnerTo, 3)

  recordMissingLadderMatch({
    scope,
    roster: roster(),
    movementSystem: 'bump-rank',
    matchType: 'singles',
    sideAIds: ['e'],
    sideBIds: ['c'],
    sets: [
      { sideA: 6, sideB: 4 },
      { sideA: 6, sideB: 3 },
    ],
    playedOn: '2026-09-05',
    actorName: 'Club admin',
  })

  const next = effectiveLadderRoster(scope, roster())

  assert.deepEqual(
    next.map((player) => player.id),
    ['a', 'b', 'e', 'c', 'd'],
  )
})

test('points ladder records a result without inventing a points formula', () => {
  window.localStorage.clear()

  const preview = previewMissingMatchMovement({
    scope,
    roster: roster(),
    movementSystem: 'points',
    matchType: 'singles',
    sideAIds: ['e'],
    sideBIds: ['c'],
    sets: [
      { sideA: 6, sideB: 4 },
      { sideA: 6, sideB: 3 },
    ],
  })

  assert.equal(preview.valid, true)
  assert.equal(preview.moved, false)
  assert.match(preview.message, /points formula/i)
})

