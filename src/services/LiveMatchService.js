import {
  createLiveMatchSessionFromMatch,
  importLegacyLiveMatchSession,
} from '../domain/liveMatchSession.js'
import { toCanonicalMatch } from '../domain/match.js'
import { tournamentRulesToMatchRulesSnapshot } from '../domain/ruleAdapters/tournamentMatchRules.js'
import { liveMatchSessionRepository } from './LiveMatchSessionRepository.js'
import { startOrResumeLadderMatch } from './LadderLiveMatchService.js'

function cleanId(value) {
  return String(value || '').trim().slice(0, 120)
}

function unwrap(response) {
  if (response?.success === true) return response.data
  return response?.data?.success === true ? response.data.data : response
}

async function defaultLoadMatch(matchId) {
  const { getMatch } = await import('./MatchService.js')
  return getMatch(matchId)
}

async function defaultStartMatch(matchId, payload) {
  const { startMatch } = await import('./MatchService.js')
  return startMatch(matchId, payload)
}

async function defaultPersistMatch(matchId, payload) {
  const { updateMatch } = await import('./MatchService.js')
  return updateMatch(matchId, payload)
}

async function defaultLoadTournament(tournamentId) {
  const { getTournament } = await import('./TournamentService.js')
  return getTournament(tournamentId)
}

function tournamentContext(match, tournament, category) {
  return {
    tournamentId: match.tournamentId || '',
    tournamentName: tournament?.name || '',
    categoryId: match.categoryId || '',
    categoryName: category?.name || '',
    groupId: match.groupId || null,
    round: match.matchCode || match.round || match.stage || '',
  }
}

function canonicalizeTournamentMatch(match, options = {}) {
  if (!match || String(match.type || match.source).toLowerCase() !== 'tournament') {
    return { ok: false, code: 'not_tournament', match: null, issues: [] }
  }
  const rules = tournamentRulesToMatchRulesSnapshot({
    ...(options.tournament || {}),
    ...(options.category || {}),
    ...match,
    rulesSnapshot: match.rulesSnapshot,
  })
  if (!rules.ok) {
    return {
      ok: false,
      code: rules.state === 'legacy_unresolved' ? 'rules_unresolved' : 'invalid_rules',
      match: null,
      issues: rules.issues,
    }
  }
  const canonical = toCanonicalMatch(
    {
      ...match,
      clubId: match.clubId || options.tournament?.clubId || options.clubId,
      lifecycleStatus: match.status,
      rulesSnapshot: rules.snapshot,
    },
    { source: 'tournament', sourceRefId: match.tournamentId },
  )
  return canonical.ok
    ? { ok: true, code: '', match: canonical.match, issues: [] }
    : { ok: false, code: 'invalid_match', match: null, issues: canonical.issues }
}

function safeLegacyLiveRecord(match) {
  const liveState = match?.liveState
  if (!liveState || typeof liveState !== 'object') return { ok: true, record: null }
  if (!liveState.sets || !liveState.currentGame || !Array.isArray(liveState.completedSets)) {
    return { ok: false, record: null }
  }
  return { ok: true, record: match }
}

export async function startOrResumeTournamentMatch(options = {}) {
  const repository = options.repository || liveMatchSessionRepository
  const loadMatch = options.loadMatch || defaultLoadMatch
  let rawMatch = options.match || null
  if (!rawMatch?.id) {
    try {
      rawMatch = unwrap(await loadMatch(cleanId(options.matchId)))
    } catch {
      rawMatch = null
    }
  }
  if (!rawMatch?.id) {
    return { ok: false, code: 'match_not_found', message: 'Match not found.' }
  }

  let tournament = options.tournament || null
  let category = options.category || null
  if (!rawMatch.rulesSnapshot && !category && rawMatch.tournamentId) {
    const loadTournament = options.loadTournament || defaultLoadTournament
    try {
      tournament = unwrap(await loadTournament(rawMatch.tournamentId))
      category =
        tournament?.categories?.find((item) => item.id === rawMatch.categoryId) || null
    } catch {
      tournament = null
      category = null
    }
  }
  const resolvedOptions = { ...options, tournament, category }

  let canonical = canonicalizeTournamentMatch(rawMatch, resolvedOptions)
  if (!canonical.ok) {
    return {
      ok: false,
      code: canonical.code,
      message:
        canonical.issues?.[0]?.message ||
        'This Tournament Match does not have resolved canonical rules.',
      match: rawMatch,
      canonicalMatch: null,
      session: null,
    }
  }

  const matchId = cleanId(rawMatch.id)
  const existing = repository.get(matchId)
  if (existing) {
    return {
      ok: true,
      code: '',
      match: rawMatch,
      canonicalMatch: canonical.match,
      session: existing,
      created: false,
      imported: false,
      context: tournamentContext(rawMatch, tournament, category),
    }
  }

  const initialStatus = String(rawMatch.status || '')
  if (!['pending', 'scheduled', 'live'].includes(initialStatus)) {
    return {
      ok: false,
      code: 'match_not_startable',
      message: 'This Tournament Match cannot be started from its current state.',
      match: rawMatch,
      canonicalMatch: canonical.match,
      session: null,
    }
  }
  if (initialStatus === 'live' && !rawMatch.rulesSnapshot) {
    const persistMatch = options.persistMatch || defaultPersistMatch
    const persisted = unwrap(
      await persistMatch(matchId, {
        rulesSnapshot: canonical.match.rulesSnapshot,
        rulesState: 'resolved',
      }),
    )
    if (!persisted?.id || persisted.id !== matchId) {
      return {
        ok: false,
        code: 'rules_persistence_failed',
        message: 'Canonical Tournament rules could not be persisted for this live Match.',
        match: rawMatch,
        canonicalMatch: canonical.match,
        session: null,
      }
    }
    rawMatch = persisted
  }
  if (initialStatus !== 'live' && options.explicitStart !== true) {
    return {
      ok: false,
      code: 'session_not_started',
      message: 'This Match has not been explicitly started.',
      match: rawMatch,
      canonicalMatch: canonical.match,
      session: null,
    }
  }

  let newlyStarted = false
  if (initialStatus !== 'live') {
    if (!options.authorized || !cleanId(options.actorId)) {
      return {
        ok: false,
        code: 'forbidden',
        message: 'Tournament score-update permission is required to start this Match.',
        match: rawMatch,
        canonicalMatch: canonical.match,
        session: null,
      }
    }
    const startMatch = options.startMatch || defaultStartMatch
    rawMatch = unwrap(
      await startMatch(matchId, {
        actorId: cleanId(options.actorId),
        clubId: cleanId(options.clubId),
        authorized: true,
      }),
    )
    if (!rawMatch?.id || rawMatch.id !== matchId || rawMatch.status !== 'live') {
      return {
        ok: false,
        code: 'lifecycle_start_failed',
        message: rawMatch?.message || 'The Tournament Match lifecycle could not be started.',
        match: options.match,
        canonicalMatch: canonical.match,
        session: null,
      }
    }
    newlyStarted = true
    canonical = canonicalizeTournamentMatch(rawMatch, resolvedOptions)
    if (!canonical.ok) {
      return {
        ok: false,
        code: canonical.code,
        message: canonical.issues?.[0]?.message || 'Tournament rules could not be frozen.',
        match: rawMatch,
        canonicalMatch: null,
        session: null,
      }
    }
  }

  const legacy = safeLegacyLiveRecord(rawMatch)
  if (!legacy.ok) {
    return {
      ok: false,
      code: 'legacy_state_unresolved',
      message: 'The legacy Tournament live score cannot be imported safely.',
      match: rawMatch,
      canonicalMatch: canonical.match,
      session: null,
    }
  }
  if (!newlyStarted && !legacy.record) {
    return {
      ok: false,
      code: 'session_unresolved',
      message: 'This live Tournament Match has no resumable canonical or legacy score session.',
      match: rawMatch,
      canonicalMatch: canonical.match,
      session: null,
    }
  }

  const scorerId = cleanId(rawMatch.scorerId || (newlyStarted ? options.actorId : ''))
  if (!scorerId) {
    return {
      ok: false,
      code: 'scorer_unresolved',
      message: 'This Tournament Match has no assigned scorer.',
      match: rawMatch,
      canonicalMatch: canonical.match,
      session: null,
    }
  }
  const created = legacy.record
    ? importLegacyLiveMatchSession(canonical.match, legacy.record, {
        scorerId,
        assignedBy: scorerId,
        startedAt: rawMatch.startedAt,
      })
    : createLiveMatchSessionFromMatch(canonical.match, {
        scorerId,
        assignedBy: scorerId,
        startedAt: rawMatch.startedAt,
      })
  if (!created.ok) {
    return {
      ok: false,
      code: 'session_creation_failed',
      message: created.issues?.[0]?.message || 'The live session could not be created.',
      match: rawMatch,
      canonicalMatch: canonical.match,
      session: null,
    }
  }
  const saved = repository.create(created.session)
  return saved.ok
    ? {
        ok: true,
        code: '',
        match: rawMatch,
        canonicalMatch: canonical.match,
        session: saved.session,
        created: true,
        imported: Boolean(legacy.record),
        context: tournamentContext(rawMatch, tournament, category),
      }
    : {
        ok: false,
        code: saved.code,
        message: 'The canonical live session could not be persisted.',
        match: rawMatch,
        canonicalMatch: canonical.match,
        session: saved.session,
      }
}

export async function startOrResumeMatch(options = {}) {
  const source = String(options.match?.type || options.match?.source || '').toLowerCase()
  if (source === 'ladder') return startOrResumeLadderMatch(options)
  if (source === 'tournament') return startOrResumeTournamentMatch(options)

  const loadMatch = options.loadMatch || defaultLoadMatch
  let match = null
  try {
    match = unwrap(await loadMatch(cleanId(options.matchId)))
  } catch {
    match = null
  }
  const loadedSource = String(match?.type || match?.source || '').toLowerCase()
  if (loadedSource === 'tournament') return startOrResumeTournamentMatch({ ...options, match })
  if (loadedSource === 'ladder') return startOrResumeLadderMatch({ ...options, match })
  if (!match) return startOrResumeLadderMatch(options)
  return {
    ok: false,
    code: 'unsupported_source',
    message: 'This Match source has not migrated to the canonical live route.',
    match,
    canonicalMatch: null,
    session: null,
  }
}
