import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createStandardMatchRulesSnapshot } from '../src/domain/matchRules.js'
import { createScoreboard } from '../src/utils/tennisScoring.js'
import { toTennisEngineConfig } from '../src/domain/toTennisEngineConfig.js'
import { createLiveMatchSessionFromMatch } from '../src/domain/liveMatchSession.js'
import { createLiveMatchSessionRepository } from '../src/services/LiveMatchSessionRepository.js'
import {
  resolveCanonicalLadderMatch,
  startOrResumeLadderMatch,
} from '../src/services/LadderLiveMatchService.js'

function storage() {
  const values = new Map()
  return {
    get length() {
      return values.size
    },
    key(index) {
      return [...values.keys()][index] ?? null
    },
    getItem(key) {
      return values.get(key) ?? null
    },
    setItem(key, value) {
      values.set(key, String(value))
    },
    removeItem(key) {
      values.delete(key)
    },
  }
}

function match(rulesSnapshot, status = 'live') {
  return {
    id: 'match-canonical-1',
    type: 'ladder',
    challengeId: 'challenge-source-1',
    challengerId: 'player-a',
    challengerName: 'A',
    defenderId: 'player-b',
    defenderName: 'B',
    scorerId: 'player-a',
    status,
    rulesSnapshot,
    startedAt: status === 'live' ? '2026-09-02T08:00:00.000Z' : null,
  }
}

function repository(backing = storage()) {
  return createLiveMatchSessionRepository({
    storage: backing,
    eventTarget: null,
    channel: null,
    instanceId: 'canonical-ladder-test',
  })
}

test('all Ladder rule variants enter a session keyed by the canonical Match ID', async () => {
  const variants = [
    createStandardMatchRulesSnapshot(),
    createStandardMatchRulesSnapshot({ game: { mode: 'traditional', deuce: 'no_ad' } }),
    createStandardMatchRulesSnapshot({
      set: {
        gamesToWin: 4,
        winBy: 1,
        tiedAtTarget: { mode: 'tiebreak', tiebreak: { pointsToWin: 5, winBy: 2 } },
      },
    }),
    createStandardMatchRulesSnapshot({
      decidingSet: { mode: 'match_tiebreak', pointsToWin: 10, winBy: 2 },
    }),
    createStandardMatchRulesSnapshot({
      game: { mode: 'numeric', pointsToWin: 4, winBy: 2 },
    }),
  ]

  for (const rulesSnapshot of variants) {
    const liveRepository = repository()
    const rawMatch = match(rulesSnapshot)
    const result = await startOrResumeLadderMatch({
      match: rawMatch,
      actorId: 'player-a',
      explicitStart: true,
      repository: liveRepository,
      storage: null,
    })
    assert.equal(result.ok, true)
    assert.equal(result.match.id, rawMatch.id)
    assert.equal(result.canonicalMatch.id, rawMatch.id)
    assert.equal(result.session.matchId, rawMatch.id)
    assert.equal(liveRepository.get(rawMatch.id)?.matchId, rawMatch.id)
    assert.deepEqual(result.session.engineState.config, toTennisEngineConfig(rulesSnapshot))
  }
})

test('scheduled Play and Sidebar Challenge starts use one lifecycle boundary before session creation', async () => {
  for (const status of ['scheduled', 'accepted', 'ready']) {
    const rulesSnapshot = createStandardMatchRulesSnapshot({
      game: { mode: 'traditional', deuce: 'no_ad' },
    })
    const initial = match(rulesSnapshot, status)
    const calls = []
    const result = await startOrResumeLadderMatch({
      match: initial,
      actorId: 'player-b',
      explicitStart: true,
      repository: repository(),
      storage: null,
      startChallenge: async (challengeId, actorId) => {
        calls.push({ challengeId, actorId })
        return {
          success: true,
          data: {
            challenge: { id: challengeId, status: 'live' },
            match: { ...initial, status: 'live', startedAt: '2026-09-02T08:30:00.000Z' },
          },
        }
      },
    })
    assert.equal(result.ok, true)
    assert.deepEqual(calls, [{ challengeId: initial.challengeId, actorId: 'player-b' }])
    assert.equal(result.match.status, 'live')
    assert.equal(result.session.matchId, initial.id)
    assert.deepEqual(result.session.engineState.config, toTennisEngineConfig(rulesSnapshot))
  }
})

test('route navigation alone never starts a scheduled Ladder Match', async () => {
  let startCalls = 0
  const result = await startOrResumeLadderMatch({
    match: match(createStandardMatchRulesSnapshot(), 'scheduled'),
    actorId: 'player-a',
    explicitStart: false,
    repository: repository(),
    storage: null,
    startChallenge: async () => {
      startCalls += 1
    },
  })
  assert.equal(result.ok, false)
  assert.equal(result.code, 'session_not_started')
  assert.equal(startCalls, 0)

  const alreadyLive = await startOrResumeLadderMatch({
    match: match(createStandardMatchRulesSnapshot(), 'live'),
    actorId: 'player-a',
    explicitStart: false,
    repository: repository(),
    storage: null,
  })
  assert.equal(alreadyLive.ok, true)
  assert.equal(alreadyLive.session.matchId, alreadyLive.match.id)
})

test('Continue resumes the existing canonical session without resetting score', async () => {
  const liveRepository = repository()
  const rawMatch = match(createStandardMatchRulesSnapshot())
  const first = await startOrResumeLadderMatch({
    match: rawMatch,
    actorId: 'player-a',
    explicitStart: true,
    repository: liveRepository,
    storage: null,
  })
  const scored = liveRepository.applyCommand(rawMatch.id, {
    id: 'point-once',
    type: 'record_point',
    actorId: 'player-a',
    expectedScoreRevision: first.session.scoreRevision,
    expectedAuthorityRevision: first.session.authorityRevision,
    payload: { side: 'you' },
  })
  assert.equal(scored.ok, true)

  const resumed = await startOrResumeLadderMatch({
    match: rawMatch,
    actorId: 'player-a',
    explicitStart: true,
    repository: liveRepository,
    storage: null,
  })
  assert.equal(resumed.created, false)
  assert.equal(resumed.session.scoreRevision, scored.session.scoreRevision)
  assert.equal(resumed.session.engineState.pointsPlayed, 1)
})

test('a transitional Ladder route/session is imported once under Match.id', async () => {
  const backing = storage()
  const liveRepository = repository(backing)
  const rulesSnapshot = createStandardMatchRulesSnapshot()
  const rawMatch = match(rulesSnapshot)
  const aliasId = 'invitation-old-route'
  const legacyState = createScoreboard({
    players: { playerA: 'A', playerB: 'B' },
    config: toTennisEngineConfig(rulesSnapshot),
    startedAt: rawMatch.startedAt,
  })
  backing.setItem(
    `gorra.friendlyMatchLive.v1.${encodeURIComponent(aliasId)}`,
    JSON.stringify({
      matchId: aliasId,
      ladderMatchId: rawMatch.id,
      matchType: 'ladder',
      ownerId: 'player-a',
      scorerId: 'player-a',
      startedAt: rawMatch.startedAt,
      liveState: legacyState,
      status: 'live',
    }),
  )
  const oldCanonical = {
    id: aliasId,
    source: 'ladder',
    sourceRef: { type: 'ladder', id: rawMatch.challengeId },
    sides: [
      { id: 'player-a', name: 'A', participantIds: ['player-a'] },
      { id: 'player-b', name: 'B', participantIds: ['player-b'] },
    ],
    rulesSnapshot,
    lifecycleStatus: 'live',
  }
  const oldSession = createLiveMatchSessionFromMatch(oldCanonical, { scorerId: 'player-a' })
  liveRepository.create(oldSession.session)

  const loadMatch = async (id) => {
    if (id === aliasId) throw new Error('not found')
    return id === rawMatch.id ? { success: true, data: rawMatch } : null
  }
  const resolved = await resolveCanonicalLadderMatch(aliasId, { loadMatch, storage: backing })
  assert.equal(resolved.match.id, rawMatch.id)

  const imported = await startOrResumeLadderMatch({
    matchId: aliasId,
    actorId: 'player-a',
    explicitStart: false,
    repository: liveRepository,
    storage: backing,
    loadMatch,
  })
  assert.equal(imported.ok, true)
  assert.equal(imported.imported, true)
  assert.equal(imported.session.matchId, rawMatch.id)
  assert.equal(liveRepository.get(aliasId), null)
  assert.equal(backing.getItem(`gorra.friendlyMatchLive.v1.${encodeURIComponent(aliasId)}`), null)
})

test('all active Ladder entry callers target LiveMatch and Tournament remains on PlayMatch', () => {
  const router = readFileSync('src/router/index.js', 'utf8')
  const flow = readFileSync('src/views/FriendlyMatchFlowView.vue', 'utf8')
  const challenge = readFileSync('src/views/ChallengeDetailsView.vue', 'utf8')
  const hub = readFileSync('src/views/PlayHubView.vue', 'utf8')
  const ladder = readFileSync('src/views/compete/LadderView.vue', 'utf8')
  const details = readFileSync('src/views/MatchDetailsView.vue', 'utf8')
  const operations = readFileSync('src/views/LiveOperationDetailView.vue', 'utf8')
  const tournament = readFileSync('src/views/TournamentCategory.vue', 'utf8')

  assert.match(router, /path: '\/matches\/:matchId\/live'[\s\S]*name: 'LiveMatch'/)
  assert.match(router, /to\.name === 'PlayMatch'[\s\S]*match\.type[\s\S]*name: 'LiveMatch'/)
  assert.match(flow, /startOrResumeLadderMatch/)
  assert.match(flow, /name: 'LiveMatch'/)
  assert.match(challenge, /startOrResumeLadderMatch[\s\S]*name: 'LiveMatch'/)
  assert.match(hub, /match\.type === 'ladder'[\s\S]*name: 'LiveMatch'/)
  assert.match(ladder, /startOrResumeLadderMatch[\s\S]*name: 'LiveMatch'/)
  assert.match(details, /openLadderLive[\s\S]*name: 'LiveMatch'/)
  assert.match(operations, /matchType === 'ladder' \? 'LiveMatch' : 'FriendlyMatchLive'/)
  assert.match(tournament, /router\.push\(`\/play\/\$\{match\.id\}`\)/)
  assert.doesNotMatch(details, /matchStore\.submitResult/)
})

test('legacy MatchesView is not routed and stable result identity guards duplicate completion', () => {
  const router = readFileSync('src/router/index.js', 'utf8')
  const api = readFileSync('src/services/ApiService.js', 'utf8')
  const completion = readFileSync('src/views/FriendlyMatchFlowView.vue', 'utf8')
  assert.doesNotMatch(router, /import MatchesView/)
  assert.match(api, /const resultId = [\s\S]*\|\| `result-\$\{match\.id\}`/)
  assert.match(api, /if \(match\.resultId\)/)
  assert.match(completion, /resultId: physicalCompletion\.session\?\.resultId/)
})
