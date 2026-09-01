import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  applyLiveMatchSessionCommand,
  createLiveMatchSessionFromMatch,
  importLegacyLiveMatchSession,
} from '../src/domain/liveMatchSession.js'
import {
  createStandaloneMatchTieBreakRules,
  createStandardMatchRulesSnapshot,
} from '../src/domain/matchRules.js'
import { createLiveMatchSessionRepository } from '../src/services/LiveMatchSessionRepository.js'
import {
  createLiveMatchSessionView,
  createPublicLiveMatchSessionProjection,
} from '../src/composables/useLiveMatchSession.js'
import { createScoreboard, recordPoint } from '../src/utils/tennisScoring.js'
import { toTennisEngineConfig } from '../src/domain/toTennisEngineConfig.js'

function canonicalMatch(rulesSnapshot, source = 'friendly') {
  return {
    schemaVersion: 1,
    id: `${source}-live-1`,
    clubId: 'club-1',
    source,
    sourceRef: source === 'ladder' ? { type: 'ladder', id: 'ladder-match-1' } : null,
    sides: [
      { key: 'sideA', id: 'player-a', name: 'A', participantIds: ['player-a'] },
      { key: 'sideB', id: 'player-b', name: 'B', participantIds: ['player-b'] },
    ],
    rulesSnapshot,
    rulesState: 'resolved',
    lifecycleStatus: 'live',
  }
}

function start(rules, source = 'friendly') {
  const result = createLiveMatchSessionFromMatch(canonicalMatch(rules, source), {
    scorerId: 'player-a',
    startedAt: '2026-09-01T10:00:00.000Z',
  })
  assert.equal(result.ok, true)
  return result.session
}

let commandSequence = 0
function command(session, type, payload = {}, options = {}) {
  commandSequence += 1
  const result = applyLiveMatchSessionCommand(session, {
    id: options.id || `command-${commandSequence}`,
    type,
    actorId: options.actorId || 'player-a',
    expectedScoreRevision: session.scoreRevision,
    expectedAuthorityRevision: session.authorityRevision,
    authorized: Boolean(options.authorized),
    payload,
    occurredAt: `2026-09-01T10:${String(commandSequence).padStart(2, '0')}:00.000Z`,
  })
  assert.equal(result.ok, true, result.message)
  return result.session
}

function points(session, side, count) {
  let next = session
  for (let index = 0; index < count; index += 1) {
    next = command(next, 'record_point', { side })
  }
  return next
}

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
}

test('session creation derives the engine only from Match.rulesSnapshot', () => {
  const rules = createStandardMatchRulesSnapshot({
    match: { mode: 'sets', setsToWin: 3 },
    set: {
      gamesToWin: 4,
      winBy: 2,
      tiedAtTarget: { mode: 'tiebreak', tiebreak: { pointsToWin: 5, winBy: 2 } },
    },
    game: { mode: 'numeric', pointsToWin: 3, winBy: 2 },
    decidingSet: { mode: 'match_tiebreak', pointsToWin: 8, winBy: 2 },
  })
  const session = start(rules)

  assert.deepEqual(session.engineState.config, toTennisEngineConfig(rules))
  assert.equal(session.matchId, 'friendly-live-1')
  assert.equal(session.scorerAuthority.scorerId, 'player-a')
  assert.equal(session.scoreRevision, session.engineState.revision)
})

test('point, game, set, match, finish, and duplicate finish use canonical revisions', () => {
  const gameRules = createStandardMatchRulesSnapshot({
    match: { mode: 'sets', setsToWin: 2 },
    set: { gamesToWin: 2, winBy: 1 },
    game: { mode: 'numeric', pointsToWin: 2, winBy: 1 },
  })
  let gameSession = start(gameRules)
  const initialRevision = gameSession.scoreRevision
  gameSession = points(gameSession, 'you', 2)
  assert.equal(gameSession.engineState.sets[0].games.playerA, 1)
  assert.equal(gameSession.scoreRevision, initialRevision + 2)

  const setRules = createStandardMatchRulesSnapshot({
    match: { mode: 'sets', setsToWin: 2 },
    set: { gamesToWin: 1, winBy: 1 },
    game: { mode: 'numeric', pointsToWin: 1, winBy: 1 },
  })
  let setSession = start(setRules)
  setSession = command(setSession, 'record_point', { side: 'you' })
  assert.equal(setSession.engineState.completedSets.length, 1)
  assert.equal(setSession.status, 'live')

  const matchRules = createStandardMatchRulesSnapshot({
    match: { mode: 'sets', setsToWin: 1 },
    set: { gamesToWin: 1, winBy: 1 },
    game: { mode: 'numeric', pointsToWin: 1, winBy: 1 },
  })
  let matchSession = start(matchRules)
  matchSession = command(matchSession, 'record_point', { side: 'you' })
  assert.equal(matchSession.status, 'completing')
  assert.equal(matchSession.engineState.matchWinner, 'playerA')

  const completed = command(matchSession, 'finish_physical_match', {}, { authorized: true })
  assert.equal(completed.status, 'completed')
  assert.equal(completed.resultId, 'result-friendly-live-1')

  const duplicate = applyLiveMatchSessionCommand(completed, {
    id: 'finish-again',
    type: 'finish_physical_match',
    actorId: 'player-a',
    expectedScoreRevision: completed.scoreRevision,
    expectedAuthorityRevision: completed.authorityRevision,
    authorized: true,
  })
  assert.equal(duplicate.ok, true)
  assert.equal(duplicate.duplicate, true)
  assert.equal(duplicate.session.resultId, completed.resultId)
})

test('undo and server correction are commands and do not bypass score revision', () => {
  let session = start(createStandardMatchRulesSnapshot())
  session = command(session, 'record_point', { side: 'you' })
  const afterPointRevision = session.scoreRevision
  session = command(session, 'undo_last_point')
  assert.equal(session.engineState.currentGame.points.playerA, 0)
  assert.equal(session.scoreRevision, afterPointRevision + 1)

  session = command(session, 'set_server', { side: 'opponent' })
  assert.equal(session.engineState.currentServer, 'playerB')
  assert.equal(session.scoreRevision, afterPointRevision + 2)
})

test('Advantage, No-Ad, numeric games, and custom set win-by remain engine-owned', () => {
  let advantage = start(createStandardMatchRulesSnapshot())
  advantage = points(advantage, 'you', 3)
  advantage = points(advantage, 'opponent', 3)
  advantage = command(advantage, 'record_point', { side: 'you' })
  assert.equal(
    createLiveMatchSessionView(advantage, canonicalMatch(createStandardMatchRulesSnapshot()))
      .playerAPoint,
    'Advantage',
  )

  let noAd = start(
    createStandardMatchRulesSnapshot({ game: { mode: 'traditional', deuce: 'no_ad' } }),
  )
  noAd = points(noAd, 'you', 3)
  noAd = points(noAd, 'opponent', 3)
  noAd = command(noAd, 'record_point', { side: 'opponent' })
  assert.equal(noAd.engineState.sets[0].games.playerB, 1)

  let numeric = start(
    createStandardMatchRulesSnapshot({
      game: { mode: 'numeric', pointsToWin: 3, winBy: 2 },
    }),
  )
  numeric = points(numeric, 'you', 3)
  assert.equal(numeric.engineState.sets[0].games.playerA, 1)

  let winBy = start(
    createStandardMatchRulesSnapshot({
      match: { mode: 'sets', setsToWin: 1 },
      set: {
        gamesToWin: 2,
        winBy: 2,
        tiedAtTarget: { mode: 'continue', tiebreak: null },
      },
      game: { mode: 'numeric', pointsToWin: 1, winBy: 1 },
    }),
  )
  winBy = command(winBy, 'record_point', { side: 'you' })
  winBy = command(winBy, 'record_point', { side: 'opponent' })
  winBy = command(winBy, 'record_point', { side: 'you' })
  assert.equal(winBy.engineState.matchWinner, null)
  winBy = command(winBy, 'record_point', { side: 'you' })
  assert.equal(winBy.engineState.matchWinner, 'playerA')
})

test('custom normal tiebreak and deciding match tiebreak are preserved', () => {
  let normalTieBreak = start(
    createStandardMatchRulesSnapshot({
      match: { mode: 'sets', setsToWin: 1 },
      set: {
        gamesToWin: 1,
        winBy: 2,
        tiedAtTarget: { mode: 'tiebreak', tiebreak: { pointsToWin: 3, winBy: 2 } },
      },
      game: { mode: 'numeric', pointsToWin: 1, winBy: 1 },
    }),
  )
  normalTieBreak = command(normalTieBreak, 'record_point', { side: 'you' })
  normalTieBreak = command(normalTieBreak, 'record_point', { side: 'opponent' })
  assert.equal(normalTieBreak.engineState.currentGame.inTieBreak, true)
  normalTieBreak = points(normalTieBreak, 'you', 3)
  assert.equal(normalTieBreak.engineState.matchWinner, 'playerA')

  let decider = start(
    createStandardMatchRulesSnapshot({
      match: { mode: 'sets', setsToWin: 2 },
      set: { gamesToWin: 1, winBy: 1 },
      game: { mode: 'numeric', pointsToWin: 1, winBy: 1 },
      decidingSet: { mode: 'match_tiebreak', pointsToWin: 3, winBy: 2 },
    }),
  )
  decider = command(decider, 'record_point', { side: 'you' })
  decider = command(decider, 'record_point', { side: 'opponent' })
  assert.equal(decider.engineState.currentGame.isMatchTieBreak, true)
  decider = points(decider, 'you', 3)
  assert.equal(decider.engineState.matchWinner, 'playerA')
})

test('standalone custom match tiebreak uses the canonical snapshot', () => {
  let session = start(createStandaloneMatchTieBreakRules({ pointsToWin: 5, winBy: 2 }))
  session = points(session, 'you', 5)
  assert.equal(session.engineState.config.mode, 'tiebreak')
  assert.equal(session.engineState.matchWinner, 'playerA')
})

test('legacy newer-stack live state imports once with canonical rules', () => {
  const legacyRules = createStandardMatchRulesSnapshot()
  let legacyState = createScoreboard({
    players: { playerA: 'A', playerB: 'B' },
    config: toTennisEngineConfig(legacyRules),
    startedAt: '2026-09-01T10:00:00.000Z',
  })
  legacyState = recordPoint(legacyState, 'playerA')
  const canonicalRules = createStandardMatchRulesSnapshot({
    game: { mode: 'traditional', deuce: 'no_ad' },
  })
  const imported = importLegacyLiveMatchSession(canonicalMatch(canonicalRules), {
    liveState: legacyState,
    ownerId: 'player-a',
    scorerId: 'player-a',
    scorerRevision: 4,
  })

  assert.equal(imported.ok, true)
  assert.equal(imported.session.engineState.currentGame.points.playerA, 1)
  assert.equal(imported.session.engineState.config.scoring, 'noad')
  assert.equal(imported.session.authorityRevision, 4)
})

test('repository persists, reloads, rejects stale writes, and synchronizes subscribers', () => {
  const storage = memoryStorage()
  const first = createLiveMatchSessionRepository({ storage, eventTarget: null, channel: null })
  const second = createLiveMatchSessionRepository({ storage, eventTarget: null, channel: null })
  const session = start(createStandardMatchRulesSnapshot())
  assert.equal(first.create(session).ok, true)
  assert.deepEqual(second.get(session.matchId), session)

  let received = null
  const unsubscribe = second.subscribe(session.matchId, (next) => {
    received = next
  })
  const changed = first.applyCommand(session.matchId, {
    id: 'repository-point',
    type: 'record_point',
    actorId: 'player-a',
    expectedScoreRevision: session.scoreRevision,
    expectedAuthorityRevision: session.authorityRevision,
    payload: { side: 'you' },
  })
  assert.equal(changed.ok, true)
  assert.equal(second.get(session.matchId).scoreRevision, session.scoreRevision + 1)
  assert.equal(received.scoreRevision, session.scoreRevision + 1)

  const stale = first.save(session, { expectedScoreRevision: session.scoreRevision })
  assert.equal(stale.ok, false)
  assert.equal(stale.code, 'stale_score_revision')
  unsubscribe()
  first.dispose()
  second.dispose()
})

test('scorer handoff advances only authority revision and protects scoring', () => {
  const session = start(createStandardMatchRulesSnapshot())
  const assigned = command(
    session,
    'assign_scorer',
    { scorerId: 'umpire-1', reason: 'chair_umpire_handoff', sourceId: 'invite-1' },
    { authorized: true },
  )
  assert.equal(assigned.scoreRevision, session.scoreRevision)
  assert.deepEqual(assigned.engineState, session.engineState)
  assert.equal(assigned.authorityRevision, session.authorityRevision + 1)
  assert.equal(assigned.scorerAuthority.scorerId, 'umpire-1')

  const forbidden = applyLiveMatchSessionCommand(assigned, {
    id: 'old-scorer-point',
    type: 'record_point',
    actorId: 'player-a',
    expectedScoreRevision: assigned.scoreRevision,
    expectedAuthorityRevision: assigned.authorityRevision,
    payload: { side: 'you' },
  })
  assert.equal(forbidden.ok, false)
  assert.equal(forbidden.code, 'forbidden')
})

test('public projection is read-only and omits scorer authority secrets', () => {
  const rules = createStandardMatchRulesSnapshot()
  const match = canonicalMatch(rules)
  const session = start(rules)
  const projection = createPublicLiveMatchSessionProjection(session, match)
  assert.equal(projection.matchId, session.matchId)
  assert.equal(projection.score.currentServer, 'playerA')
  assert.equal('engineState' in projection, false)
  assert.equal('scorerAuthority' in projection, false)
  assert.equal(JSON.stringify(projection).includes('capabilityId'), false)
})

test('newer Friendly and Play-to-Ladder live UI uses the session API while consequences stay source-specific', () => {
  const source = readFileSync(
    new URL('../src/views/FriendlyMatchFlowView.vue', import.meta.url),
    'utf8',
  )
  assert.match(source, /liveSessionApi\.recordPoint\(side\)/)
  assert.match(source, /liveSessionApi\.undoPoint\(\)/)
  assert.match(source, /liveSessionApi\.changeServer\(side\)/)
  assert.match(source, /liveSessionApi\.finishPhysicalMatch\(\)/)
  assert.doesNotMatch(source, /friendlyMatchStore\.recordPoint\(/)
  assert.doesNotMatch(source, /friendlyMatchStore\.undoPoint\(/)
  assert.doesNotMatch(source, /friendlyMatchStore\.setServer\(/)
  assert.match(source, /friendlyMatchStore\.endMatch/)
  assert.match(source, /matchStore\.submitResult/)
})

test('mobile Match Format implementation keeps semantic compact toggles and narrow reflow rules', () => {
  const editor = readFileSync(
    new URL('../src/components/match/MatchFormatEditor.vue', import.meta.url),
    'utf8',
  )
  const drawer = readFileSync(
    new URL('../src/components/ladder/AdminLadderMatchDrawer.vue', import.meta.url),
    'utf8',
  )
  assert.equal((editor.match(/class="chevron"/g) || []).length, 3)
  assert.equal(editor.includes('<svg viewBox="0 0 16 16"'), false)
  assert.match(editor, /grid-template-areas:\s*'title chevron'\s*'result result'/)
  assert.match(editor, /@media \(max-width: 380px\)/)
  assert.match(editor, /grid-template-columns: 1fr;/)
  assert.match(drawer, /@media \(max-width: 420px\)/)
  assert.match(drawer, /\.rules-card \{[\s\S]*flex-direction: column;/)
})
