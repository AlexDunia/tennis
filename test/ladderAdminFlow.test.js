import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { getEligibleLadderOpponents } from '../src/services/LadderAccessService.js'

const players = [1, 2, 3, 4, 5].map((rank) => ({
  id: `player-${rank}`,
  rank,
  status: 'active',
}))
const config = {
  id: 'ladder-a',
  seasonStatus: 'active',
  challengeRangeUp: 2,
  allowDownwardChallenges: false,
}

test('admin player selection uses the shared Ladder eligibility window', () => {
  const eligible = getEligibleLadderOpponents({
    challenger: players[4],
    players,
    config,
  })
  assert.deepEqual(
    eligible.map((player) => player.rank),
    [3, 4],
  )
})

test('active challenge records block either selected player from a new admin match', () => {
  const opponentBlocked = getEligibleLadderOpponents({
    challenger: players[4],
    players,
    config,
    challenges: [
      {
        ladderId: 'ladder-a',
        status: 'scheduled',
        challengerId: 'player-4',
        defenderId: 'player-1',
      },
    ],
  })
  assert.deepEqual(
    opponentBlocked.map((player) => player.rank),
    [3],
  )

  const challengerBlocked = getEligibleLadderOpponents({
    challenger: players[4],
    players,
    config,
    challenges: [
      {
        ladderId: 'ladder-a',
        status: 'live',
        challengerId: 'player-5',
        defenderId: 'player-2',
      },
    ],
  })
  assert.deepEqual(challengerBlocked, [])
})

test('active challenges from another club Ladder do not block valid opponents', () => {
  const eligible = getEligibleLadderOpponents({
    challenger: players[2],
    players,
    config,
    challenges: [
      {
        ladderId: 'unrelated-ladder',
        status: 'scheduled',
        challengerId: 'player-1',
        defenderId: 'player-2',
      },
      {
        status: 'awaiting',
        challengerId: 'player-1',
        defenderId: 'player-2',
      },
    ],
  })

  assert.deepEqual(
    eligible.map((player) => player.rank),
    [1, 2],
  )
})

test('admin scheduling uses native local date controls and the service-layer endpoint', () => {
  const drawer = readFileSync('src/components/ladder/AdminLadderMatchDrawer.vue', 'utf8')
  const service = readFileSync('src/services/ChallengeService.js', 'utf8')
  const api = readFileSync('src/services/ApiService.js', 'utf8')

  assert.match(drawer, /type="date" :min="minimumDate"/)
  assert.match(drawer, /type="time"/)
  assert.match(drawer, /matchRuleSource/)
  assert.match(service, /post\('\/admin\/ladder-matches', payload\)/)
  assert.match(api, /path === '\/admin\/ladder-matches'/)
  assert.match(api, /isEligibleLadderOpponent\(challenger, defender, ladderConfig\)/)
  assert.match(api, /rulesSnapshot: freezeMatchRulesSnapshot\(preparedRules\.snapshot\)/)
  assert.match(api, /freezeMatchRulesSnapshot\(challenge\.rulesSnapshot\)/)
})

test('active Challenge summaries resolve canonical rules through one formatter', () => {
  const card = readFileSync('src/components/ChallengeCard.vue', 'utf8')
  const challenges = readFileSync('src/views/ChallengesView.vue', 'utf8')
  const details = readFileSync('src/views/ChallengeDetailsView.vue', 'utf8')

  for (const source of [card, challenges, details]) {
    assert.match(source, /ladderRulesToMatchRulesSnapshot/)
    assert.match(source, /formatMatchRulesSummary/)
  }
})

test('the admin drawer switches to overlay mode before its inline grid column closes', () => {
  const drawer = readFileSync('src/components/ladder/AdminLadderMatchDrawer.vue', 'utf8')
  const ladder = readFileSync('src/views/compete/LadderView.vue', 'utf8')

  assert.match(drawer, /@media \(max-width: 1180px\)/)
  assert.match(ladder, /@media \(max-width: 1180px\)[\s\S]*ladder-view--drawer/)
})
