import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  applyCompletedLadderResult,
  effectiveLadderRoster,
  getLadderAdminState,
} from '../src/services/LadderAdminService.js'

const scope = { clubId: 'club-auto', ladderId: 'ladder-auto' }
const roster = [
  { id: 'a', name: 'Player A', wins: 0, losses: 0, matchesPlayed: 0 },
  { id: 'b', name: 'Player B', wins: 1, losses: 0, matchesPlayed: 1 },
  { id: 'c', name: 'Player C', wins: 0, losses: 1, matchesPlayed: 1 },
  { id: 'challenger', name: 'Challenger', wins: 2, losses: 2, matchesPlayed: 4, matches: 4 },
  { id: 'e', name: 'Player E', wins: 0, losses: 0, matchesPlayed: 0 },
]

function withStorage(run) {
  const previousWindow = globalThis.window
  const values = new Map()
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
    },
  }
  try { return run() } finally { globalThis.window = previousWindow }
}

function result(overrides = {}) {
  return applyCompletedLadderResult({
    scope,
    roster,
    matchId: 'match-auto',
    resultId: 'result-auto',
    challengerId: 'challenger',
    defenderId: 'b',
    winnerId: 'challenger',
    movementSystem: 'position-swap',
    score: '6-4, 6-3',
    completedAt: '2026-09-25T12:00:00.000Z',
    actorName: 'Match scorer',
    ...overrides,
  })
}

test('automatic position-swap completion moves ranks and applies winner/loser stats', () => withStorage(() => {
  const completed = result()
  assert.equal(completed.duplicate, false)
  assert.equal(completed.moved, true)
  assert.equal(completed.winnerFrom, 4)
  assert.equal(completed.winnerTo, 2)
  assert.equal(completed.winnerRankAfter, 2)
  assert.equal(completed.loserRankAfter, 4)
  assert.equal(completed.winner.wins, 3)
  assert.equal(completed.winner.matchesPlayed, 5)
  assert.equal(completed.winner.matches, 5)
  assert.equal(completed.loser.losses, 1)
  assert.equal(completed.loser.matchesPlayed, 2)
}))

test('the same automatic result is idempotent and records one completion activity', () => withStorage(() => {
  result()
  const duplicate = result()
  const players = effectiveLadderRoster(scope, roster)
  const challenger = players.find((player) => player.id === 'challenger')
  const defender = players.find((player) => player.id === 'b')
  assert.equal(duplicate.duplicate, true)
  assert.equal(challenger.wins, 3)
  assert.equal(challenger.matchesPlayed, 5)
  assert.equal(defender.losses, 1)
  assert.equal(defender.matchesPlayed, 2)
  const events = getLadderAdminState(scope).activity.filter((event) => event.type === 'ladder-match-completed' && event.resultId === 'result-auto')
  assert.equal(events.length, 1)
}))

test('a higher-ranked winner updates stats without changing order', () => withStorage(() => {
  const completed = result({ challengerId: 'b', defenderId: 'challenger', winnerId: 'b', resultId: 'higher-wins' })
  assert.equal(completed.moved, false)
  assert.deepEqual(completed.players.map((player) => player.id), roster.map((player) => player.id))
  assert.equal(completed.winner.wins, 2)
  assert.equal(completed.loser.losses, 3)
}))

test('leapfrog uses the existing bump-rank movement behavior', () => withStorage(() => {
  const completed = result({ movementSystem: 'leapfrog', resultId: 'leapfrog-result' })
  assert.equal(completed.moved, true)
  assert.deepEqual(completed.players.map((player) => player.id), ['a', 'challenger', 'b', 'c', 'e'])
}))

test('points ladders record stats without inventing rank movement', () => withStorage(() => {
  const completed = result({ movementSystem: 'points', resultId: 'points-result' })
  assert.equal(completed.moved, false)
  assert.deepEqual(completed.players.map((player) => player.id), roster.map((player) => player.id))
  assert.equal(completed.winner.wins, 3)
  assert.equal(completed.loser.losses, 1)
}))

test('gorra_live source completes directly while legacy review support remains', () => {
  const api = readFileSync('src/services/ApiService.js', 'utf8')
  const liveFlow = readFileSync('src/views/FriendlyMatchFlowView.vue', 'utf8')
  const changedSources = [api, liveFlow, readFileSync('src/views/MatchDetailsView.vue', 'utf8'), readFileSync('src/services/LadderAdminService.js', 'utf8')].join('\n')
  const liveBranch = api.slice(api.indexOf('if (isGorraLiveResult)'), api.indexOf('Legacy/manual Ladder results'))
  assert.match(api, /resultSource/)
  assert.match(api, /gorra_live/)
  assert.match(api, /applyCompletedLadderResult/)
  assert.match(liveBranch, /match\.status = 'completed'/)
  assert.match(liveBranch, /challenge\.status = 'completed'/)
  assert.doesNotMatch(liveBranch, /pending_review/)
  assert.ok(api.includes('path.match(/^\\/challenges\\/[^/]+\\/review$/)'))
  assert.match(api, /pending_review/)
  assert.match(liveFlow, /resultSource: 'gorra_live'/)
  assert.doesNotMatch(liveFlow, /Your opponent must confirm it before rankings move/)
  assert.match(liveFlow, /challengeStore\.loadChallenges\(\)/)
  assert.match(liveFlow, /router\.replace\(\{[\s\S]*name: 'MatchDetails'/)
  assert.match(liveFlow, /publishCurrentLiveOperations\(\{ type: 'complete' \}\)/)
  assert.doesNotMatch(changedSources, /Update Ladder\?|Apply ranking\?|Confirm ranking\?|Do you want to update/)
})