import {
  createScoreboard,
  normalizeScoreboard,
  recordPoint,
  setServer,
  undoLastPoint,
} from '../utils/tennisScoring.js'
import { toTennisEngineConfig } from './toTennisEngineConfig.js'

export const LIVE_MATCH_SESSION_SCHEMA_VERSION = 1
export const LIVE_MATCH_SESSION_STATUSES = Object.freeze([
  'ready',
  'live',
  'suspended',
  'completing',
  'completed',
])
export const LIVE_MATCH_COMMAND_TYPES = Object.freeze([
  'record_point',
  'undo_last_point',
  'set_server',
  'assign_scorer',
  'finish_physical_match',
])

const MAX_RECENT_COMMAND_IDS = 80
const MAX_AUTHORITY_HISTORY = 30

function text(value) {
  return String(value || '').trim()
}

function clone(value) {
  return value === null || value === undefined ? null : JSON.parse(JSON.stringify(value))
}

function nowIso(value) {
  const parsed = value ? new Date(value) : new Date()
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString()
}

function authority(input = {}) {
  return {
    scorerId: text(input.scorerId) || null,
    capabilityId: text(input.capabilityId) || null,
    assignedBy: text(input.assignedBy) || null,
    changedAt: input.changedAt || null,
    history: Array.isArray(input.history)
      ? input.history.slice(0, MAX_AUTHORITY_HISTORY).map((entry) => ({ ...entry }))
      : [],
  }
}

export function createLiveMatchSessionContract(input = {}) {
  const issues = []
  const matchId = text(input.matchId)
  const id = text(input.id) || (matchId ? `live-${matchId}` : '')
  const status = text(input.status || 'ready')

  if (!matchId) {
    issues.push({ path: 'matchId', code: 'required', message: 'Match ID is required.' })
  }
  if (!LIVE_MATCH_SESSION_STATUSES.includes(status)) {
    issues.push({
      path: 'status',
      code: 'invalid_status',
      message: 'LiveMatchSession status is not supported.',
    })
  }

  const scoreRevision = Math.max(0, Number(input.scoreRevision) || 0)
  const authorityRevision = Math.max(0, Number(input.authorityRevision) || 0)
  const session = {
    schemaVersion: LIVE_MATCH_SESSION_SCHEMA_VERSION,
    id: id || null,
    matchId: matchId || null,
    status,
    engineState: clone(input.engineState),
    startedAt: input.startedAt || null,
    lastActivityAt: input.lastActivityAt || null,
    completedAt: input.completedAt || null,
    scorerAuthority: authority(input.scorerAuthority),
    scoreRevision,
    authorityRevision,
    resultId: text(input.resultId) || null,
    projection: {
      version: Math.max(0, Number(input.projection?.version) || 0),
      publishedAt: input.projection?.publishedAt || null,
    },
    recentCommandIds: Array.isArray(input.recentCommandIds)
      ? [...new Set(input.recentCommandIds.map(text).filter(Boolean))].slice(
          0,
          MAX_RECENT_COMMAND_IDS,
        )
      : [],
  }

  if (session.engineState) {
    const engineRevision = Math.max(0, Number(session.engineState.revision) || 0)
    if (scoreRevision !== engineRevision) {
      issues.push({
        path: 'scoreRevision',
        code: 'revision_mismatch',
        message: 'Session scoreRevision must match engineState.revision.',
      })
    }
  }
  if (status === 'completed' && (!session.completedAt || !session.resultId)) {
    issues.push({
      path: 'status',
      code: 'incomplete_completion',
      message: 'Completed sessions require completedAt and resultId.',
    })
  }

  return {
    ok: issues.length === 0,
    session,
    issues,
  }
}

function matchPlayers(match) {
  return {
    playerA: match.sides?.[0]?.name || 'Player 1',
    playerB: match.sides?.[1]?.name || 'Player 2',
  }
}

export function createLiveMatchSessionFromMatch(match, options = {}) {
  if (!match?.id || !match?.rulesSnapshot) {
    return {
      ok: false,
      session: null,
      issues: [
        {
          path: !match?.id ? 'match.id' : 'match.rulesSnapshot',
          code: 'required',
          message: !match?.id
            ? 'A canonical Match is required to start a live session.'
            : 'Match.rulesSnapshot is required to start a live session.',
        },
      ],
    }
  }

  const startedAt = nowIso(options.startedAt)
  const engineState = createScoreboard({
    players: matchPlayers(match),
    config: toTennisEngineConfig(match.rulesSnapshot),
    startedAt,
    status: 'live',
    currentServer: options.currentServer === 'playerB' ? 'playerB' : 'playerA',
  })

  return createLiveMatchSessionContract({
    id: options.id || `live-${match.id}`,
    matchId: match.id,
    status: 'live',
    engineState,
    startedAt,
    lastActivityAt: startedAt,
    scorerAuthority: {
      scorerId: options.scorerId,
      capabilityId: options.capabilityId,
      assignedBy: options.assignedBy || options.scorerId,
      changedAt: startedAt,
      history: [],
    },
    scoreRevision: engineState.revision,
    authorityRevision: Math.max(1, Number(options.authorityRevision) || 1),
    projection: { version: 0, publishedAt: null },
  })
}

export function importLegacyLiveMatchSession(match, legacy = {}, options = {}) {
  if (!legacy?.liveState) {
    return createLiveMatchSessionFromMatch(match, options)
  }
  if (!match?.id || !match?.rulesSnapshot) {
    return createLiveMatchSessionFromMatch(match, options)
  }

  const config = toTennisEngineConfig(match.rulesSnapshot)
  const engineState = normalizeScoreboard(
    {
      ...legacy.liveState,
      config,
    },
    {
      players: matchPlayers(match),
      config,
      startedAt: legacy.startedAt || options.startedAt,
      status: legacy.liveState.matchWinner ? 'finished' : 'live',
    },
  )
  const startedAt = engineState.startedAt || nowIso(legacy.startedAt || options.startedAt)
  const completedAt = engineState.completedAt || null
  const status = engineState.matchWinner ? 'completing' : 'live'

  return createLiveMatchSessionContract({
    id: options.id || `live-${match.id}`,
    matchId: match.id,
    status,
    engineState,
    startedAt,
    lastActivityAt: completedAt || nowIso(legacy.updatedAt),
    completedAt: null,
    scorerAuthority: {
      scorerId: legacy.scorerId || options.scorerId,
      capabilityId: options.capabilityId,
      assignedBy: legacy.scorerChangedBy || options.assignedBy || legacy.ownerId,
      changedAt: legacy.scorerChangedAt || startedAt,
      history: legacy.scorerHistory || [],
    },
    scoreRevision: engineState.revision,
    authorityRevision: Math.max(1, Number(legacy.scorerRevision || options.authorityRevision) || 1),
    projection: { version: 0, publishedAt: null },
  })
}

function rejected(session, code, message) {
  return { ok: false, session, code, message, duplicate: false }
}

function accepted(session, options = {}) {
  return {
    ok: true,
    session,
    code: '',
    message: '',
    duplicate: Boolean(options.duplicate),
  }
}

function rememberCommand(session, commandId) {
  return [commandId, ...(Array.isArray(session.recentCommandIds) ? session.recentCommandIds : [])]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, MAX_RECENT_COMMAND_IDS)
}

function scoreActorAllowed(session, actorId) {
  return Boolean(actorId && actorId === session.scorerAuthority?.scorerId)
}

export function applyLiveMatchSessionCommand(inputSession, inputCommand = {}) {
  const normalized = createLiveMatchSessionContract(inputSession)
  if (!normalized.ok) {
    return rejected(inputSession, 'invalid_session', 'The live session is invalid.')
  }

  const session = normalized.session
  const command = {
    ...inputCommand,
    id: text(inputCommand.id || inputCommand.commandId),
    type: text(inputCommand.type),
    actorId: text(inputCommand.actorId || inputCommand.actor?.id),
  }

  if (!command.id) {
    return rejected(session, 'command_id_required', 'A command ID is required.')
  }
  if (!LIVE_MATCH_COMMAND_TYPES.includes(command.type)) {
    return rejected(session, 'unsupported_command', 'The live-session command is unsupported.')
  }
  if (session.recentCommandIds.includes(command.id)) {
    return accepted(session, { duplicate: true })
  }
  if (
    command.expectedScoreRevision !== undefined &&
    Number(command.expectedScoreRevision) !== session.scoreRevision
  ) {
    return rejected(session, 'stale_score_revision', 'The score changed in another session.')
  }
  if (
    command.expectedAuthorityRevision !== undefined &&
    Number(command.expectedAuthorityRevision) !== session.authorityRevision
  ) {
    return rejected(
      session,
      'stale_authority_revision',
      'Scoring authority changed in another session.',
    )
  }

  const occurredAt = nowIso(command.occurredAt)
  const next = clone(session)

  if (['record_point', 'undo_last_point', 'set_server'].includes(command.type)) {
    if (!scoreActorAllowed(session, command.actorId)) {
      return rejected(session, 'forbidden', 'Only the assigned scorer can change the score.')
    }
    if (
      !session.engineState ||
      session.status === 'completed' ||
      (session.status === 'completing' && command.type !== 'undo_last_point')
    ) {
      return rejected(session, 'not_live', 'The physical match is not accepting score changes.')
    }

    let engineState = session.engineState
    if (command.type === 'record_point') {
      const playerKey = command.payload?.side === 'opponent' ? 'playerB' : 'playerA'
      if (!['you', 'opponent'].includes(command.payload?.side)) {
        return rejected(session, 'invalid_side', 'Choose a valid scoring side.')
      }
      engineState = recordPoint(engineState, playerKey)
    } else if (command.type === 'undo_last_point') {
      if (!engineState.history?.length) {
        return rejected(session, 'nothing_to_undo', 'There is no recorded point to undo.')
      }
      engineState = undoLastPoint(engineState)
    } else {
      const playerKey = command.payload?.side === 'opponent' ? 'playerB' : 'playerA'
      if (!['you', 'opponent'].includes(command.payload?.side)) {
        return rejected(session, 'invalid_side', 'Choose a valid serving side.')
      }
      engineState = setServer(engineState, playerKey)
    }

    if (Number(engineState?.revision || 0) <= session.scoreRevision) {
      return rejected(session, 'no_change', 'The command did not change the score.')
    }
    next.engineState = engineState
    next.scoreRevision = engineState.revision
    next.status = engineState.matchWinner ? 'completing' : 'live'
  }

  if (command.type === 'assign_scorer') {
    const nextScorerId = text(command.payload?.scorerId)
    if (!command.authorized || !nextScorerId) {
      return rejected(session, 'forbidden', 'Scorer assignment is not authorized.')
    }
    if (['completed', 'completing'].includes(session.status)) {
      return rejected(session, 'not_live', 'Scoring authority cannot change after match point.')
    }
    if (nextScorerId === session.scorerAuthority?.scorerId) {
      next.recentCommandIds = rememberCommand(next, command.id)
      return accepted(next)
    }
    const previous = session.scorerAuthority?.scorerId || null
    next.authorityRevision += 1
    next.scorerAuthority = {
      scorerId: nextScorerId,
      capabilityId: text(command.payload?.capabilityId) || null,
      assignedBy: command.actorId || null,
      changedAt: occurredAt,
      history: [
        {
          revision: next.authorityRevision,
          from: previous,
          to: nextScorerId,
          changedBy: command.actorId || null,
          reason: text(command.payload?.reason).slice(0, 80),
          sourceId: text(command.payload?.sourceId).slice(0, 120),
          changedAt: occurredAt,
        },
        ...(session.scorerAuthority?.history || []),
      ].slice(0, MAX_AUTHORITY_HISTORY),
    }
  }

  if (command.type === 'finish_physical_match') {
    if (!session.engineState?.matchWinner) {
      return rejected(session, 'match_not_won', 'The tennis engine has not completed the match.')
    }
    if (!scoreActorAllowed(session, command.actorId) && !command.authorized) {
      return rejected(session, 'forbidden', 'This actor cannot finish the physical match.')
    }
    if (session.status === 'completed') {
      return accepted(session, { duplicate: true })
    }
    next.status = 'completed'
    next.completedAt = session.completedAt || session.engineState.completedAt || occurredAt
    next.resultId = session.resultId || `result-${session.matchId}`
    next.engineState = {
      ...session.engineState,
      status: 'finished',
      completedAt: next.completedAt,
    }
  }

  next.lastActivityAt = occurredAt
  next.recentCommandIds = rememberCommand(next, command.id)
  next.projection = {
    version: Number(session.projection?.version || 0) + 1,
    publishedAt: occurredAt,
  }

  const result = createLiveMatchSessionContract(next)
  return result.ok
    ? accepted(result.session)
    : rejected(session, 'invalid_transition', 'The command produced an invalid live session.')
}
