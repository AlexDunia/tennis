import {
  createLiveMatchSessionFromMatch,
  importLegacyLiveMatchSession,
} from '../domain/liveMatchSession.js'
import { toCanonicalMatch } from '../domain/match.js'
import { liveMatchSessionRepository } from './LiveMatchSessionRepository.js'

const LEGACY_LIVE_PREFIX = 'gorra.friendlyMatchLive.v1.'

function cleanId(value) {
  return String(value || '')
    .trim()
    .slice(0, 120)
}

function unwrap(response) {
  if (response?.success === true) return response.data
  return response?.data?.success === true ? response.data.data : response
}

async function defaultLoadMatch(matchId) {
  const { getMatch } = await import('./MatchService.js')
  return getMatch(matchId)
}

async function defaultStartChallenge(challengeId, actorId) {
  const { startChallenge } = await import('./ChallengeService.js')
  return startChallenge(challengeId, actorId)
}

function browserStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

function legacyRecords(storage) {
  if (!storage) return []
  const records = []
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index) || ''
      if (!key.startsWith(LEGACY_LIVE_PREFIX)) continue
      const routeId = decodeURIComponent(key.slice(LEGACY_LIVE_PREFIX.length))
      const record = JSON.parse(storage.getItem(key) || 'null')
      if (record && typeof record === 'object') records.push({ key, routeId, record })
    }
  } catch {
    return []
  }
  return records
}

function canonicalizeLadderMatch(match, clubId = '') {
  if (!match || String(match.type || match.source).toLowerCase() !== 'ladder') {
    return { ok: false, match: null, issues: [], code: 'not_ladder' }
  }
  const result = toCanonicalMatch(
    { ...match, clubId: match.clubId || clubId, lifecycleStatus: match.status },
    { source: 'ladder', sourceRefId: match.challengeId },
  )
  return result.ok
    ? { ok: true, match: result.match, issues: [], code: '' }
    : { ok: false, match: null, issues: result.issues, code: 'invalid_match' }
}

export async function resolveCanonicalLadderMatch(matchId, options = {}) {
  const requestedId = cleanId(matchId)
  const loadMatch = options.loadMatch || defaultLoadMatch
  const storage = options.storage === undefined ? browserStorage() : options.storage
  if (!requestedId) return { ok: false, code: 'invalid_match_id', match: null }

  let direct = null
  try {
    direct = unwrap(await loadMatch(requestedId))
  } catch {
    direct = null
  }
  if (direct?.id) {
    return String(direct.type || direct.source).toLowerCase() === 'ladder'
      ? { ok: true, code: '', match: direct, requestedId, importedAlias: false }
      : { ok: false, code: 'not_ladder', match: direct, requestedId }
  }

  const alias = legacyRecords(storage).find(
    ({ routeId, record }) =>
      routeId === requestedId && cleanId(record.ladderMatchId) && record.ladderMatchId !== routeId,
  )
  if (!alias) return { ok: false, code: 'match_not_found', match: null, requestedId }

  let canonical = null
  try {
    canonical = unwrap(await loadMatch(cleanId(alias.record.ladderMatchId)))
  } catch {
    canonical = null
  }
  if (!canonical?.id || String(canonical.type || canonical.source).toLowerCase() !== 'ladder') {
    return { ok: false, code: 'match_not_found', match: null, requestedId }
  }
  return {
    ok: true,
    code: '',
    match: canonical,
    requestedId,
    importedAlias: true,
    legacy: alias,
  }
}

export async function startOrResumeLadderMatch(options = {}) {
  const repository = options.repository || liveMatchSessionRepository
  const storage = options.storage === undefined ? browserStorage() : options.storage
  const resolved = options.match?.id
    ? {
        ok: String(options.match.type || options.match.source).toLowerCase() === 'ladder',
        code: 'not_ladder',
        match: options.match,
        requestedId: cleanId(options.matchId || options.match.id),
      }
    : await resolveCanonicalLadderMatch(options.matchId, { ...options, storage })
  if (!resolved.ok) return { ...resolved, session: null, canonicalMatch: null }

  let rawMatch = resolved.match
  let canonical = canonicalizeLadderMatch(rawMatch, options.clubId)
  if (!canonical.ok) {
    return {
      ok: false,
      code: canonical.code,
      message: canonical.issues?.[0]?.message || 'This Ladder Match has invalid rules.',
      match: rawMatch,
      canonicalMatch: null,
      session: null,
    }
  }

  const canonicalId = cleanId(rawMatch.id)
  const existing = repository.get(canonicalId)
  const compatibleLegacy =
    resolved.legacy ||
    legacyRecords(storage).find(
      ({ routeId, record }) =>
        cleanId(record.ladderMatchId) === canonicalId ||
        (routeId === canonicalId && cleanId(record.matchId) === canonicalId),
    )

  if (existing) {
    if (compatibleLegacy?.routeId && compatibleLegacy.routeId !== canonicalId) {
      repository.remove(compatibleLegacy.routeId)
      try {
        storage?.removeItem(compatibleLegacy.key)
      } catch {
        // Canonical session already wins; stale compatibility data is harmless.
      }
    }
    return {
      ok: true,
      code: '',
      match: rawMatch,
      canonicalMatch: canonical.match,
      session: existing,
      created: false,
      imported: false,
    }
  }

  const legacy = compatibleLegacy?.record?.liveState
    ? compatibleLegacy.record
    : rawMatch.liveState
      ? rawMatch
      : null
  const status = String(rawMatch.status || '')

  if (!legacy && options.explicitStart !== true && status !== 'live') {
    return {
      ok: false,
      code: 'session_not_started',
      message: 'This Match has not been explicitly started.',
      match: rawMatch,
      canonicalMatch: canonical.match,
      session: null,
    }
  }

  if (!['accepted', 'scheduled', 'ready', 'live'].includes(status)) {
    return {
      ok: false,
      code: 'match_not_startable',
      message: 'This Match cannot be started from its current state.',
      match: rawMatch,
      canonicalMatch: canonical.match,
      session: null,
    }
  }

  if (status !== 'live') {
    if (!rawMatch.challengeId) {
      return {
        ok: false,
        code: 'challenge_required',
        message: 'The linked Challenge is required to start this Ladder Match.',
        match: rawMatch,
        canonicalMatch: canonical.match,
        session: null,
      }
    }
    const startChallenge = options.startChallenge || defaultStartChallenge
    const started = unwrap(await startChallenge(rawMatch.challengeId, options.actorId))
    rawMatch = started?.match
    if (!rawMatch?.id || rawMatch.id !== canonicalId || rawMatch.status !== 'live') {
      return {
        ok: false,
        code: 'lifecycle_start_failed',
        message: started?.message || 'The Ladder Match lifecycle could not be started.',
        match: resolved.match,
        canonicalMatch: canonical.match,
        session: null,
      }
    }
    canonical = canonicalizeLadderMatch(rawMatch, options.clubId)
    if (!canonical.ok) {
      return { ok: false, code: canonical.code, match: rawMatch, session: null }
    }
  }

  const created = legacy
    ? importLegacyLiveMatchSession(canonical.match, legacy, {
        scorerId: legacy.scorerId || rawMatch.scorerId || options.actorId,
        assignedBy: legacy.scorerChangedBy || rawMatch.scorerId || options.actorId,
        startedAt: legacy.startedAt || rawMatch.startedAt,
      })
    : createLiveMatchSessionFromMatch(canonical.match, {
        scorerId: rawMatch.scorerId || options.actorId,
        assignedBy: rawMatch.scorerId || options.actorId,
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
  if (!saved.ok) {
    return {
      ok: false,
      code: saved.code,
      message: 'The canonical live session could not be persisted.',
      match: rawMatch,
      canonicalMatch: canonical.match,
      session: saved.session,
    }
  }

  if (compatibleLegacy) {
    if (compatibleLegacy.routeId !== canonicalId) repository.remove(compatibleLegacy.routeId)
    try {
      storage?.removeItem(compatibleLegacy.key)
    } catch {
      // The one-time reader will be ignored because the canonical session now exists.
    }
  }
  return {
    ok: true,
    code: '',
    match: rawMatch,
    canonicalMatch: canonical.match,
    session: saved.session,
    created: true,
    imported: Boolean(legacy),
  }
}
