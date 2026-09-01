import { computed, onUnmounted, shallowRef, unref } from 'vue'
import {
  createLiveMatchSessionFromMatch,
  importLegacyLiveMatchSession,
} from '../domain/liveMatchSession.js'
import { formatMatchRulesSummary } from '../utils/matchRulesSummary.js'
import { describePoint } from '../utils/tennisScoring.js'
import { liveMatchSessionRepository } from '../services/LiveMatchSessionRepository.js'

function valueOf(value) {
  return unref(value)
}

function commandId(type, matchId) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${type}-${crypto.randomUUID()}`
  }
  return `${type}-${matchId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function scoreSets(engineState) {
  return Array.isArray(engineState?.completedSets)
    ? engineState.completedSets.map((set) => {
        const score = set.isMatchTieBreak && set.tieBreak?.score ? set.tieBreak.score : set.games
        return {
          a: Number(score?.playerA || 0),
          b: Number(score?.playerB || 0),
          tieBreak: set.tieBreak ? { ...set.tieBreak } : null,
          isMatchTieBreak: Boolean(set.isMatchTieBreak),
        }
      })
    : []
}

export function createLiveMatchSessionView(session, match) {
  const engineState = session?.engineState || null
  const currentSet = engineState?.sets?.[engineState.currentSetIndex] || null
  const currentGame = engineState?.currentGame || {}
  const inTieBreak = Boolean(currentGame.inTieBreak)
  const points = inTieBreak ? currentGame.tieBreakPoints : currentGame.points
  const setsA = engineState?.completedSets?.filter((set) => set.winner === 'playerA').length || 0
  const setsB = engineState?.completedSets?.filter((set) => set.winner === 'playerB').length || 0
  const playerAPoint = engineState ? describePoint(engineState, 'playerA') : 'Love'
  const playerBPoint = engineState ? describePoint(engineState, 'playerB') : 'Love'
  const rulesSummary = formatMatchRulesSummary(match?.rulesSnapshot || null)
  const finished = Boolean(engineState?.matchWinner)
  const statusText = finished
    ? `${engineState.players?.[engineState.matchWinner] || 'Player'} won`
    : engineState?.config?.mode === 'tiebreak' || inTieBreak
      ? `${Number(points?.playerA || 0)}–${Number(points?.playerB || 0)}`
      : `${playerAPoint} – ${playerBPoint}`

  return {
    playerAName: engineState?.players?.playerA || match?.sides?.[0]?.name || 'Player 1',
    playerBName: engineState?.players?.playerB || match?.sides?.[1]?.name || 'Player 2',
    playerAPoint,
    playerBPoint,
    setsA,
    setsB,
    gamesA: Number(currentSet?.games?.playerA || 0),
    gamesB: Number(currentSet?.games?.playerB || 0),
    setScores: scoreSets(engineState),
    currentSetNumber: Number(engineState?.currentSetIndex || 0) + 1,
    matchFormatLabel: rulesSummary.match,
    scoringFormatLabel: rulesSummary.game,
    statusText,
    currentServer: engineState?.currentServer || 'playerA',
    pointsPlayed: Number(engineState?.pointsPlayed || 0),
    startedAt: session?.startedAt || engineState?.startedAt || '',
    canUndo: Boolean(engineState?.history?.length) && !finished,
    inTieBreak,
    isMatchTieBreak: Boolean(currentGame.isMatchTieBreak),
    standaloneTieBreak: engineState?.config?.mode === 'tiebreak',
    finished,
    winner: engineState?.matchWinner || null,
    engineState,
  }
}

export function createPublicLiveMatchSessionProjection(session, match) {
  if (!session?.matchId || !session.engineState) return null
  const view = createLiveMatchSessionView(session, match)
  return {
    schemaVersion: 1,
    matchId: session.matchId,
    status: session.status,
    scoreRevision: session.scoreRevision,
    startedAt: session.startedAt,
    lastActivityAt: session.lastActivityAt,
    completedAt: session.completedAt,
    players: {
      playerA: view.playerAName,
      playerB: view.playerBName,
    },
    score: {
      playerAPoint: view.playerAPoint,
      playerBPoint: view.playerBPoint,
      setsA: view.setsA,
      setsB: view.setsB,
      gamesA: view.gamesA,
      gamesB: view.gamesB,
      setScores: view.setScores,
      currentSetNumber: view.currentSetNumber,
      currentServer: view.currentServer,
      inTieBreak: view.inTieBreak,
      isMatchTieBreak: view.isMatchTieBreak,
      winner: view.winner,
    },
    display: {
      matchFormat: view.matchFormatLabel,
      scoringFormat: view.scoringFormatLabel,
    },
  }
}

export function useLiveMatchSession(options = {}) {
  const repository = options.repository || liveMatchSessionRepository
  const session = shallowRef(null)
  const match = shallowRef(null)
  const error = shallowRef('')
  let unsubscribe = () => {}

  const rules = computed(() => match.value?.rulesSnapshot || null)
  const view = computed(() => createLiveMatchSessionView(session.value, match.value))
  const permissions = computed(() => {
    const actorId = String(valueOf(options.actorId) || '')
    const ownerId = String(valueOf(options.ownerId) || match.value?.sides?.[0]?.id || '')
    const scorerId = session.value?.scorerAuthority?.scorerId || ''
    return {
      actorId,
      ownerId,
      scorerId,
      canManage: Boolean(actorId && ownerId && actorId === ownerId),
      canScore: Boolean(actorId && scorerId && actorId === scorerId),
      canFinalize: Boolean(actorId && (actorId === ownerId || actorId === scorerId)),
    }
  })

  function acceptSession(nextSession, meta = {}) {
    if (!nextSession) return null
    session.value = nextSession
    error.value = ''
    options.onSessionChange?.(nextSession, match.value, meta)
    return nextSession
  }

  function watchMatch(matchId) {
    unsubscribe()
    unsubscribe = repository.subscribe(matchId, (nextSession, meta) => {
      if (
        !session.value ||
        nextSession.scoreRevision > session.value.scoreRevision ||
        nextSession.authorityRevision > session.value.authorityRevision ||
        nextSession.status !== session.value.status
      ) {
        acceptSession(nextSession, meta)
      }
    })
  }

  function initialize(canonicalMatch, initializeOptions = {}) {
    error.value = ''
    if (!canonicalMatch?.id || !canonicalMatch.rulesSnapshot) {
      error.value = 'A resolved canonical Match is required.'
      return { ok: false, session: null, code: 'invalid_match' }
    }
    match.value = canonicalMatch
    const existing = repository.get(canonicalMatch.id)
    if (existing) {
      watchMatch(canonicalMatch.id)
      acceptSession(existing, { source: 'resume' })
      return { ok: true, session: existing, created: false, imported: false }
    }

    const legacy = initializeOptions.legacyLiveRecord
    if (!legacy?.liveState && initializeOptions.allowCreate === false) {
      error.value = 'No canonical or importable live session exists for this match.'
      return { ok: false, session: null, code: 'session_not_found' }
    }
    const created = legacy?.liveState
      ? importLegacyLiveMatchSession(canonicalMatch, legacy, initializeOptions)
      : createLiveMatchSessionFromMatch(canonicalMatch, initializeOptions)
    if (!created.ok) {
      error.value = created.issues?.[0]?.message || 'The live session could not be created.'
      return { ok: false, session: null, code: 'session_creation_failed' }
    }
    const saved = repository.create(created.session)
    if (!saved.ok) {
      error.value = 'The live session could not be persisted.'
      return { ok: false, session: saved.session, code: saved.code }
    }
    watchMatch(canonicalMatch.id)
    acceptSession(saved.session, { source: legacy?.liveState ? 'legacy_import' : 'create' })
    return {
      ok: true,
      session: saved.session,
      created: true,
      imported: Boolean(legacy?.liveState),
    }
  }

  function run(type, payload = {}, runOptions = {}) {
    const current = session.value
    if (!current) return { ok: false, session: null, code: 'session_not_found' }
    const result = repository.applyCommand(current.matchId, {
      id: runOptions.commandId || commandId(type, current.matchId),
      type,
      actorId: runOptions.actorId || permissions.value.actorId,
      expectedScoreRevision: current.scoreRevision,
      expectedAuthorityRevision: current.authorityRevision,
      authorized: Boolean(runOptions.authorized),
      payload,
    })
    if (result.session && result.session !== session.value) {
      acceptSession(result.session, { source: 'command', type })
    }
    if (!result.ok) error.value = result.message || 'The live-session command failed.'
    return result
  }

  function recordPoint(side, runOptions) {
    return run('record_point', { side }, runOptions)
  }

  function undoPoint(runOptions) {
    return run('undo_last_point', {}, runOptions)
  }

  function changeServer(side, runOptions) {
    return run('set_server', { side }, runOptions)
  }

  function assignScorer(payload, runOptions = {}) {
    return run('assign_scorer', payload, {
      ...runOptions,
      authorized: runOptions.authorized ?? permissions.value.canManage,
    })
  }

  function finishPhysicalMatch(runOptions = {}) {
    return run(
      'finish_physical_match',
      {},
      {
        ...runOptions,
        authorized: runOptions.authorized ?? permissions.value.canFinalize,
      },
    )
  }

  function refresh() {
    if (!match.value?.id) return null
    const current = repository.refresh(match.value.id)
    if (current) acceptSession(current, { source: 'refresh' })
    return current
  }

  onUnmounted(() => unsubscribe())

  return {
    session,
    match,
    rules,
    view,
    permissions,
    error,
    initialize,
    refresh,
    recordPoint,
    undoPoint,
    changeServer,
    assignScorer,
    finishPhysicalMatch,
  }
}
