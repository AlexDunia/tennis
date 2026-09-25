import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { getLadderPlayerAvailability } from '../src/services/LadderAccessService.js'

const config = {
  id: 'ladder-a',
  seasonStatus: 'active',
  maxActiveChallenges: 2,
}

test('a live Ladder match always blocks both players, even when the Ladder allows more active challenges', () => {
  const availability = getLadderPlayerAvailability({
    player: { id: 'player-a', rank: 3 },
    challenges: [
      {
        id: 'challenge-live',
        ladderId: 'ladder-a',
        challengerId: 'player-a',
        defenderId: 'player-b',
        status: 'live',
      },
    ],
    config,
  })

  assert.equal(availability.available, false)
  assert.equal(availability.label, 'Playing now')
  assert.equal(availability.reason, 'live')
})

test('the Ladder card is non-interactive for live players and exposes only authorized match control', () => {
  const source = readFileSync('src/views/compete/LadderView.vue', 'utf8')

  assert.match(source, /'ladder-row--live':\s*isPlayingLive\(player\)/)
  assert.match(source, /canManageLadder && !isPlayingLive\(player\)/)
  assert.match(source, /Playing now/)
  assert.match(source, /v-if="canManageLiveMatch"/)
  assert.match(source, /name: 'LiveOperationDetail'/)
})