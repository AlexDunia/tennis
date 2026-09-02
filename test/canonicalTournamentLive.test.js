import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { generateRoundRobinFixtures } from '../src/composables/useTournamentFixtures.js'
import { normalizeTournamentPhysicalResult } from '../src/domain/tournamentMatchResult.js'
import { toTennisEngineConfig } from '../src/domain/toTennisEngineConfig.js'
import { createScoreboard, recordPoint } from '../src/utils/tennisScoring.js'
import { createLiveMatchSessionRepository } from '../src/services/LiveMatchSessionRepository.js'
import { startOrResumeTournamentMatch } from '../src/services/LiveMatchService.js'

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

function repository() {
  return createLiveMatchSessionRepository({
    storage: storage(),
    eventTarget: null,
    channel: null,
    instanceId: 'canonical-tournament-test',
  })
}

function fixture(status = 'scheduled', scoring = 'oneset') {
  return generateRoundRobinFixtures({
    tournamentId: 'tournament-1',
    categoryId: 'category-1',
    groupId: 'A',
    groupPlayers: [
      { playerId: 'player-a', name: 'A', seed: 1 },
      { playerId: 'player-b', name: 'B', seed: 2 },
    ],
    rulesSource: { settings: { scoring } },
    requireResolvedRules: true,
  }).map((match) => ({ ...match, status, clubId: 'club-1' }))[0]
}

test('new Tournament fixtures freeze canonical rules for every exposed scoring format', () => {
  for (const [scoring, setsToWin, decider] of [
    ['best3', 2, 'normal_set'],
    ['matchtb', 2, 'match_tiebreak'],
    ['oneset', 1, 'normal_set'],
  ]) {
    const match = fixture('pending', scoring)
    assert.equal(match.rulesState, 'resolved')
    assert.equal(Object.isFrozen(match.rulesSnapshot), true)
    assert.equal(match.rulesSnapshot.match.setsToWin, setsToWin)
    assert.equal(match.rulesSnapshot.decidingSet.mode, decider)
  }
  assert.throws(
    () =>
      generateRoundRobinFixtures({
        tournamentId: 'tournament-1',
        categoryId: 'legacy',
        groupId: 'A',
        groupPlayers: [
          { playerId: 'player-a', name: 'A' },
          { playerId: 'player-b', name: 'B' },
        ],
        requireResolvedRules: true,
      }),
    /does not identify/,
  )
})

test('Tournament start is explicit, permission-gated, and creates one canonical session', async () => {
  const match = fixture()
  let startCalls = 0
  const startMatch = async (_matchId, payload) => {
    startCalls += 1
    assert.equal(payload.authorized, true)
    return {
      success: true,
      data: {
        ...match,
        status: 'live',
        startedAt: '2026-09-02T08:00:00.000Z',
        scorerId: payload.actorId,
      },
    }
  }

  const navigationOnly = await startOrResumeTournamentMatch({
    match,
    actorId: 'official-1',
    authorized: true,
    explicitStart: false,
    repository: repository(),
    startMatch,
  })
  assert.equal(navigationOnly.code, 'session_not_started')
  assert.equal(startCalls, 0)

  const denied = await startOrResumeTournamentMatch({
    match,
    actorId: 'player-a',
    authorized: false,
    explicitStart: true,
    repository: repository(),
    startMatch,
  })
  assert.equal(denied.code, 'forbidden')
  assert.equal(startCalls, 0)

  const liveRepository = repository()
  const started = await startOrResumeTournamentMatch({
    match,
    actorId: 'official-1',
    clubId: 'club-1',
    authorized: true,
    explicitStart: true,
    repository: liveRepository,
    startMatch,
  })
  assert.equal(started.ok, true)
  assert.equal(startCalls, 1)
  assert.equal(started.session.matchId, match.id)
  assert.equal(started.session.scorerAuthority.scorerId, 'official-1')

  const resumed = await startOrResumeTournamentMatch({
    match: started.match,
    actorId: 'official-1',
    authorized: true,
    explicitStart: true,
    repository: liveRepository,
    startMatch,
  })
  assert.equal(resumed.ok, true)
  assert.equal(resumed.created, false)
  assert.equal(startCalls, 1)
})

test('Tournament resume imports only safe newer-stack liveState and never resets unresolved live data', async () => {
  const match = fixture('live')
  const missing = await startOrResumeTournamentMatch({
    match: { ...match, scorerId: 'official-1' },
    actorId: 'official-1',
    explicitStart: false,
    repository: repository(),
  })
  assert.equal(missing.code, 'session_unresolved')

  const unsafe = await startOrResumeTournamentMatch({
    match: {
      ...match,
      scorerId: 'official-1',
      liveState: { p1Points: 15, p2Points: 0 },
    },
    actorId: 'official-1',
    explicitStart: false,
    repository: repository(),
  })
  assert.equal(unsafe.code, 'legacy_state_unresolved')

  const legacyState = recordPoint(
    createScoreboard({
      players: { playerA: 'A', playerB: 'B' },
      config: toTennisEngineConfig(match.rulesSnapshot),
      startedAt: '2026-09-02T07:00:00.000Z',
    }),
    'playerA',
  )
  const imported = await startOrResumeTournamentMatch({
    match: {
      ...match,
      scorerId: 'official-1',
      startedAt: legacyState.startedAt,
      liveState: legacyState,
    },
    actorId: 'official-1',
    explicitStart: false,
    repository: repository(),
  })
  assert.equal(imported.ok, true)
  assert.equal(imported.imported, true)
  assert.equal(imported.session.engineState.pointsPlayed, 1)

  const { rulesSnapshot: _legacyRules, ...legacyMatchWithoutRules } = match
  let persistedRules = null
  const migrated = await startOrResumeTournamentMatch({
    match: {
      ...legacyMatchWithoutRules,
      scorerId: 'official-1',
      startedAt: legacyState.startedAt,
      liveState: legacyState,
    },
    category: { id: 'category-1', settings: { scoring: 'oneset' } },
    actorId: 'official-1',
    explicitStart: false,
    repository: repository(),
    persistMatch: async (_id, payload) => {
      persistedRules = payload.rulesSnapshot
      return {
        success: true,
        data: { ...legacyMatchWithoutRules, ...payload, scorerId: 'official-1', liveState: legacyState },
      }
    },
  })
  assert.equal(migrated.ok, true)
  assert.equal(persistedRules.match.setsToWin, 1)
})

test('canonical Tournament completion normalizes engine output once for the Tournament handler', async () => {
  const match = fixture()
  const liveRepository = repository()
  const started = await startOrResumeTournamentMatch({
    match,
    actorId: 'official-1',
    authorized: true,
    explicitStart: true,
    repository: liveRepository,
    startMatch: async (_id, payload) => ({
      success: true,
      data: {
        ...match,
        status: 'live',
        startedAt: '2026-09-02T08:00:00.000Z',
        scorerId: payload.actorId,
      },
    }),
  })
  let current = started.session
  for (let point = 0; point < 24; point += 1) {
    const scored = liveRepository.applyCommand(match.id, {
      id: `point-${point}`,
      type: 'record_point',
      actorId: 'official-1',
      expectedScoreRevision: current.scoreRevision,
      expectedAuthorityRevision: current.authorityRevision,
      payload: { side: 'you' },
    })
    assert.equal(scored.ok, true)
    current = scored.session
  }
  const finished = liveRepository.applyCommand(match.id, {
    id: 'finish-once',
    type: 'finish_physical_match',
    actorId: 'official-1',
    expectedScoreRevision: current.scoreRevision,
    expectedAuthorityRevision: current.authorityRevision,
    payload: {},
  })
  assert.equal(finished.ok, true)
  const normalized = normalizeTournamentPhysicalResult(started.canonicalMatch, finished.session)
  assert.equal(normalized.ok, true)
  assert.equal(normalized.result.resultId, `result-${match.id}`)
  assert.equal(normalized.result.winnerId, 'player-a')
  assert.deepEqual(
    [normalized.result.p1Sets, normalized.result.p2Sets],
    [1, 0],
  )
  assert.deepEqual(
    [normalized.result.p1Games, normalized.result.p2Games],
    [6, 0],
  )
})

test('Tournament callers use canonical LiveMatch while manual results and walkovers remain separate', () => {
  const router = readFileSync('src/router/index.js', 'utf8')
  const category = readFileSync('src/views/TournamentCategory.vue', 'utf8')
  const details = readFileSync('src/views/MatchDetailsView.vue', 'utf8')
  const host = readFileSync('src/views/FriendlyMatchFlowView.vue', 'utf8')
  const modal = readFileSync('src/components/tournament/TournamentMatchModal.vue', 'utf8')
  assert.match(router, /\['ladder', 'tournament'\][\s\S]*name: 'LiveMatch'/)
  assert.match(category, /startOrResumeMatch\([\s\S]*explicitStart: true/)
  assert.match(details, /openTournamentLive[\s\S]*name: 'LiveMatch'/)
  assert.match(host, /normalizeTournamentPhysicalResult[\s\S]*tournamentStore\.enterMatchResult/)
  assert.match(modal, /status: form\.isWalkover \? 'walkover' : 'completed'/)
  assert.doesNotMatch(modal, /LiveMatchSession|finishPhysicalMatch/)
})
