import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  getActiveLadderConfig,
  isEligibleLadderOpponent,
  ladderMatchConfig,
} from '../config/ladder'
import {
  createScoreboard,
  describePoint,
  normalizeScoreboard,
  recordPoint as recordTennisPoint,
  setServer as setTennisServer,
  toggleServer as toggleTennisServer,
  undoLastPoint,
} from '../utils/tennisScoring'
import { freezeMatchRulesSnapshot, validateMatchRulesSnapshot } from '../domain/matchRules'
import { toTennisEngineConfig } from '../domain/toTennisEngineConfig'
import {
  friendlyRulesToMatchRulesSnapshot,
  withFriendlyScoringFormat,
} from '../domain/ruleAdapters/friendlyMatchRules'
import { ladderRulesToMatchRulesSnapshot } from '../domain/ruleAdapters/ladderMatchRules'
import { liveMatchSessionRepository } from '../services/LiveMatchSessionRepository.js'
/*
 * Separation 1E storage schema.
 *
 * We deliberately move the development storage versions
 * forward because the Friendly lifecycle has changed:
 *
 * - completed matches no longer remain inside draft
 * - results now contain participantIds
 * - invitations have explicit targeted/open ownership
 * - liveState is authoritative
 *
 * In production Laravel this would be a real migration.
 * During the frontend/mock stage, using a new version prevents
 * old development state from corrupting the current flow.
 */
const RESULT_STORAGE_KEY = 'gorra.friendlyMatchResults.v2'
const DRAFT_STORAGE_KEY = 'gorra.friendlyMatchDraft.v5'
/*
 * Separation Five.
 *
 * Setup still has one temporary draft.
 *
 * Once a match becomes live, however, it receives
 * its own independent storage record keyed by
 * matchId.
 *
 * This prevents Court A from overwriting Court B.
 */
const LIVE_MATCH_STORAGE_PREFIX = 'gorra.friendlyMatchLive.v1.'
const INVITATION_STORAGE_KEY = 'gorra.friendlyMatchInvitations.v2'
const CUSTOM_FORMAT_STORAGE_KEY = 'gorra.friendlyMatchCustomFormats.v1'
const PLAY_NOW_TTL_MS = 30 * 60 * 1000

export const CLUB_OPPONENTS = Object.freeze([
  { id: 'club-farah-a', name: 'Farah A.', rank: 3, division: 'Open Division', status: 'active' },
  { id: 'club-david-o', name: 'David O.', rank: 4, division: 'Open Division', status: 'active' },
  { id: 'club-tunde-k', name: 'Tunde K.', rank: 5, division: 'Open Division', status: 'active' },
  { id: 'friendly-sam-t', name: 'Sam T.', rank: 7, division: 'Open Division', status: 'active' },
  { id: 'friendly-maya-o', name: 'Maya O.', rank: 8, division: 'Open Division', status: 'active' },
  {
    id: 'friendly-chris-a',
    name: 'Chris A.',
    rank: null,
    division: 'Club Member',
    status: 'active',
  },
  {
    id: 'friendly-jordan-k',
    name: 'Jordan K.',
    rank: null,
    division: 'Club Member',
    status: 'active',
  },
])

export const CURRENT_LADDER_RANK = 6
function createDraft() {
  return {
    matchType: '',
    timing: '',
    invitationAudience: '',
    opponent: null,
    format: '',
    matchFormat: 'best-of-3',
    customFormat: null,
    tieBreak: '6-6',
    schedule: { date: '', time: '', court: '' },

    /*
     * Club boundary for live-match authorization.
     *
     * Admin authority must always be evaluated against
     * the club that owns this match, not merely whichever
     * club happens to be selected in the UI later.
     */
    clubId: '',

    matchId: '',
    challengeId: '',
    ladderMatchId: '',
    ladderConfigSnapshot: null,
    rulesSnapshot: null,
    preMatchPositions: null,
    joinToken: '',
    ownerId: '',

    /*
     * Ownership and scoring authority are separate.
     *
     * ownerId:
     * Who owns/manages this match.
     *
     * scorerId:
     * Who currently has permission to alter
     * the live score.
     *
     * They begin as the same person for a normal
     * Friendly match, but the architecture must not
     * assume they stay the same.
     */
    scorerId: '',

    /*
     * Authority has its own revision/history.
     *
     * Tennis score revision and scorer-authority revision
     * are deliberately separate concerns.
     */
    scorerRevision: 0,
    scorerChangedAt: '',
    scorerChangedBy: '',
    scorerHistory: [],

    /*
     * The immutable start time of this live session.
     */
    startedAt: '',

    /*
     * Source of truth once the match becomes live.
     *
     * The older pointsA / gamesA / setsA fields below
     * remain temporarily as a compatibility layer for
     * the existing Vue UI.
     */
    liveState: null,
    /*
     * Compatibility pointer/projection only.
     * When present, LiveMatchSession is authoritative and this store must not
     * execute tennis score mutations of its own.
     */
    liveSessionId: '',

    status: 'draft',
    pointsA: 0,
    pointsB: 0,
    gamesA: 0,
    gamesB: 0,
    setsA: 0,
    setsB: 0,
    setScores: [],
    isTiebreak: false,
    isMatchTiebreak: false,
    pointHistory: [],
    over: false,
    winner: '',
  }
}

function normalizeLiveMatchId(value) {
  return String(value || '')
    .trim()
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(0, 120)
}

function liveMatchStorageKey(matchId) {
  const id = normalizeLiveMatchId(matchId)

  if (!id) {
    return ''
  }

  return LIVE_MATCH_STORAGE_PREFIX + encodeURIComponent(id)
}

function resolveLiveMatchId(value = {}) {
  return normalizeLiveMatchId(value.matchId || value.ladderMatchId || value.id || '')
}

function removeStored(key) {
  if (!key || typeof window === 'undefined') {
    return false
  }

  try {
    window.localStorage.removeItem(key)

    return true
  } catch {
    return false
  }
}

function readArray(key) {
  if (typeof window === 'undefined' || !window.localStorage) return []
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function normalizeStoredDraft(stored) {
  if (!stored || typeof stored !== 'object') {
    return null
  }

  const empty = createDraft()

  return {
    ...empty,

    ...stored,

    schedule: {
      ...empty.schedule,

      ...(stored.schedule || {}),
    },

    customFormat: stored.customFormat ? normalizeCustomFormat(stored.customFormat) : null,

    setScores: Array.isArray(stored.setScores) ? stored.setScores : [],

    pointHistory: Array.isArray(stored.pointHistory) ? stored.pointHistory : [],

    scorerHistory: Array.isArray(stored.scorerHistory) ? stored.scorerHistory.slice(0, 20) : [],
  }
}

function readDraft() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createDraft()
  }

  try {
    const stored = JSON.parse(window.localStorage.getItem(DRAFT_STORAGE_KEY) || 'null')

    return normalizeStoredDraft(stored) || createDraft()
  } catch {
    return createDraft()
  }
}

function readLiveDraft(matchId) {
  const id = normalizeLiveMatchId(matchId)

  const key = liveMatchStorageKey(id)

  if (!id || !key || typeof window === 'undefined' || !window.localStorage) {
    return null
  }

  try {
    const stored = JSON.parse(window.localStorage.getItem(key) || 'null')

    const normalized = normalizeStoredDraft(stored)

    if (!normalized) {
      return null
    }

    /*
     * Storage key and stored match identity
     * must agree.
     *
     * Knowing another storage key must never
     * allow one match to masquerade as another.
     */
    if (resolveLiveMatchId(normalized) !== id) {
      return null
    }

    if (!normalized.liveState || !['live', 'finished'].includes(normalized.status)) {
      return null
    }

    return normalized
  } catch {
    return null
  }
}

function engineConfigForDraft(value) {
  if (value.rulesSnapshot) {
    const validation = validateMatchRulesSnapshot(value.rulesSnapshot)
    if (!validation.valid) {
      return {
        ok: false,
        state: 'invalid',
        snapshot: null,
        issues: validation.errors,
        warnings: validation.warnings,
      }
    }
    const snapshot = freezeMatchRulesSnapshot(value.rulesSnapshot)
    return {
      ok: true,
      state: 'resolved',
      snapshot,
      issues: [],
      warnings: validation.warnings,
      config: toTennisEngineConfig(snapshot),
    }
  }

  const adapted =
    value.matchType === 'ladder'
      ? ladderRulesToMatchRulesSnapshot({
          ladderConfigSnapshot: value.ladderConfigSnapshot,
          matchConfig:
            value.matchConfig ||
            (value.ladderConfigSnapshot ? ladderMatchConfig(value.ladderConfigSnapshot) : null),
        })
      : friendlyRulesToMatchRulesSnapshot(value)

  if (!adapted.ok) {
    return adapted
  }

  const snapshot = freezeMatchRulesSnapshot(adapted.snapshot)
  return {
    ...adapted,
    snapshot,
    config: toTennisEngineConfig(snapshot),
  }
}

function persist(key, value) {
  if (!key || typeof window === 'undefined') {
    return false
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value))

    return true
  } catch {
    /*
     * Browser storage can fail on low-storage,
     * private or restricted devices.
     *
     * Never crash Match Control merely because
     * persistence is unavailable.
     */
    return false
  }
}

function invitationActivityTime(invitation = {}) {
  return ['completedAt', 'startedAt', 'joinedAt', 'cancelledAt', 'updatedAt', 'createdAt'].reduce(
    (latest, field) => {
      const value = new Date(invitation[field] || 0).getTime()
      return Number.isFinite(value) ? Math.max(latest, value) : latest
    },
    0,
  )
}

function invitationStateWeight(status = '') {
  return (
    {
      waiting_for_opponent: 1,
      waiting_for_acceptance: 1,
      ready: 2,
      live: 3,
      completed: 4,
      cancelled: 4,
      expired: 4,
    }[status] || 0
  )
}

function mergeInvitationSnapshots(memoryItems = [], storedItems = []) {
  const merged = new Map(memoryItems.map((invitation) => [invitation.id, invitation]))
  storedItems.forEach((stored) => {
    if (!stored?.id) return
    const current = merged.get(stored.id)
    if (!current) {
      merged.set(stored.id, stored)
      return
    }
    const storedTime = invitationActivityTime(stored)
    const currentTime = invitationActivityTime(current)
    if (
      storedTime > currentTime ||
      (storedTime === currentTime &&
        invitationStateWeight(stored.status) > invitationStateWeight(current.status))
    ) {
      merged.set(stored.id, stored)
    }
  })
  return [...merged.values()].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
  )
}

function createToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replaceAll('-', '')
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

function normalizeIdentity(identity = {}) {
  return {
    id: identity.id || identity.playerId || '',
    name: identity.name || 'Club player',
    rank: Number(identity.rank || identity.ladderRank) || null,
    division: identity.category || identity.division || 'Club Member',
  }
}

function normalizeAuthorityId(value) {
  return String(value || '')
    .trim()
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(0, 120)
}

function clampInteger(value, minimum, maximum, fallback) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback
}

function normalizeCustomFormat(format = {}) {
  if (format.rulesSnapshot) {
    const validation = validateMatchRulesSnapshot(format.rulesSnapshot)
    if (validation.valid) {
      const rulesSnapshot = freezeMatchRulesSnapshot(format.rulesSnapshot)
      const isTieBreak = rulesSnapshot.match.mode === 'tiebreak'
      return {
        id: String(format.id || `custom-${createToken()}`),
        name:
          String(format.name || 'Custom format')
            .trim()
            .slice(0, 40) || 'Custom format',
        rulesSnapshot,
        mode: isTieBreak ? 'tiebreak' : 'sets',
        setsToWin: isTieBreak ? 1 : rulesSnapshot.match.setsToWin,
        gamesPerSet: isTieBreak ? 0 : rulesSnapshot.set.gamesToWin,
        setWinBy: isTieBreak ? 0 : rulesSnapshot.set.winBy,
        tieBreakAt:
          !isTieBreak && rulesSnapshot.set.tiedAtTarget.mode === 'tiebreak'
            ? rulesSnapshot.set.gamesToWin
            : 0,
        tieBreakPoints: isTieBreak
          ? rulesSnapshot.match.tiebreak.pointsToWin
          : rulesSnapshot.set.tiedAtTarget.tiebreak?.pointsToWin || 7,
        createdAt: format.createdAt || new Date().toISOString(),
      }
    }
  }

  const mode = format.mode === 'tiebreak' ? 'tiebreak' : 'sets'
  const gamesPerSet = clampInteger(format.gamesPerSet, 1, 9, 6)
  return {
    id: String(format.id || `custom-${createToken()}`),
    name:
      String(format.name || 'Custom format')
        .trim()
        .slice(0, 40) || 'Custom format',
    mode,
    setsToWin: mode === 'sets' ? clampInteger(format.setsToWin, 1, 3, 2) : 1,
    gamesPerSet: mode === 'sets' ? gamesPerSet : 0,
    tieBreakAt: mode === 'sets' ? clampInteger(format.tieBreakAt, 0, gamesPerSet, gamesPerSet) : 0,
    tieBreakPoints: clampInteger(format.tieBreakPoints, 1, 21, mode === 'tiebreak' ? 10 : 7),
    createdAt: format.createdAt || new Date().toISOString(),
  }
}

function rulesForDraft(value) {
  if (value.matchFormat === 'custom' && value.customFormat) return value.customFormat
  if (value.matchFormat === 'match-tiebreak')
    return { mode: 'tiebreak', setsToWin: 1, gamesPerSet: 0, tieBreakAt: 0, tieBreakPoints: 10 }
  return {
    mode: 'sets',
    setsToWin: value.matchFormat === 'one-set' ? 1 : 2,
    gamesPerSet: 6,
    tieBreakAt: 6,
    tieBreakPoints: 7,
  }
}

export const useFriendlyMatchStore = defineStore('friendlyMatch', () => {
  const initialDraft = readDraft()

  /*
   * Migration from the previous single-draft
   * development architecture.
   *
   * If the old setup key happens to contain an
   * already-live match, move it into the new
   * match-scoped namespace instead of destroying
   * somebody's active development match.
   */
  const legacyLiveMatchId =
    initialDraft.liveState && ['live', 'finished'].includes(initialDraft.status)
      ? resolveLiveMatchId(initialDraft)
      : ''

  const activeLiveMatchId = ref(legacyLiveMatchId)

  /*
   * Detached means:
   *
   * this store intentionally has no setup draft
   * and no writable live session bound to it.
   *
   * This is useful immediately after a live match
   * completes or disappears in another tab.
   */
  const draftDetached = ref(false)

  const draft = ref(initialDraft)

  if (legacyLiveMatchId) {
    const migrated = persist(liveMatchStorageKey(legacyLiveMatchId), initialDraft)

    if (migrated) {
      removeStored(DRAFT_STORAGE_KEY)
    }
  }
  const results = ref(readArray(RESULT_STORAGE_KEY))
  const invitations = ref(readArray(INVITATION_STORAGE_KEY))
  const savedFormats = ref(readArray(CUSTOM_FORMAT_STORAGE_KEY).map(normalizeCustomFormat))
  const ladderOpponents = computed(() => {
    const config = getActiveLadderConfig()
    const currentPlayer = { id: 'current-player', rank: CURRENT_LADDER_RANK, status: 'active' }
    return CLUB_OPPONENTS.filter((player) =>
      isEligibleLadderOpponent(currentPlayer, player, config),
    )
  })

  const liveMatchId = computed(() => activeLiveMatchId.value)

  const formatLabel = computed(() => {
    const game = draft.value.rulesSnapshot?.game || draft.value.customFormat?.rulesSnapshot?.game
    if (game?.mode === 'numeric') return 'Simple points'
    if (game?.mode === 'traditional') return game.deuce === 'no_ad' ? 'No-Ad' : 'Advantage'
    return draft.value.format === 'noad' ? 'No-Ad' : 'Advantage'
  })
  const matchTypeLabel = computed(() =>
    draft.value.matchType === 'ladder' ? 'Ladder challenge' : 'Friendly match',
  )
  const currentRules = computed(() => rulesForDraft(draft.value))
  const matchFormatLabel = computed(() => {
    if (
      draft.value.matchType === 'ladder' &&
      draft.value.ladderConfigSnapshot?.matchPreset === 'time-smart'
    ) {
      return 'Two sets and a 10-point deciding match tie-break'
    }
    if (draft.value.matchFormat === 'custom')
      return draft.value.customFormat?.name || 'Custom format'
    return (
      {
        'best-of-3': 'Best of 3 sets',
        'one-set': 'One set',
        'match-tiebreak': '10-point match tie-break',
      }[draft.value.matchFormat] || 'Best of 3 sets'
    )
  })
  const canUndo = computed(() => draft.value.pointHistory.length > 0)
  const activeInvitation = computed(
    () => invitations.value.find((item) => item.id === draft.value.matchId) || null,
  )
  const opponentReady = computed(() => {
    const invitation = activeInvitation.value

    /*
     * Primary source:
     * the invitation itself says that an opponent
     * successfully claimed the slot.
     */
    if (invitation?.opponent?.id && ['ready', 'live'].includes(invitation.status)) {
      return true
    }

    /*
     * Compatibility fallback while draft + invitation
     * state still coexist in the frontend architecture.
     *
     * joinInvitation() deliberately synchronizes the
     * joined player into the active draft as well.
     *
     * This prevents a temporary invitation snapshot
     * mismatch from making the UI say:
     *
     * "Player joined"
     *
     * while simultaneously rendering:
     *
     * "Waiting for someone to join".
     */
    return Boolean(draft.value.opponent?.id && ['ready', 'live'].includes(draft.value.status))
  })
  const scheduleComplete = computed(() => Boolean(draft.value.opponent))
  const scoreSummary = computed(() => {
    if (currentRules.value.mode === 'tiebreak')
      return `${draft.value.pointsA}–${draft.value.pointsB}`
    const completed = draft.value.setScores.map((set) => `${set.a}–${set.b}`)
    if (!draft.value.over) completed.push(`${draft.value.gamesA}–${draft.value.gamesB}`)
    return completed.join(', ') || '0–0'
  })

  const statusText = computed(() => {
    const { pointsA, pointsB, format, over, winner, isTiebreak } = draft.value
    const opponentName = draft.value.opponent?.name || 'Opponent'
    if (over) return winner === 'you' ? 'You won the match' : `${opponentName} won the match`
    if (currentRules.value.mode === 'tiebreak') return `Match tie-break · ${pointsA}–${pointsB}`
    if (isTiebreak)
      return `${draft.value.isMatchTiebreak ? 'Match tie-break' : 'Tie-break'} · ${pointsA}–${pointsB}`
    if (pointsA >= 3 && pointsB >= 3) {
      if (format === 'noad' && pointsA === pointsB) return 'Deciding point'
      if (format === 'ad' && pointsA === pointsB) return 'Deuce'
      if (format === 'ad' && Math.abs(pointsA - pointsB) === 1)
        return `Advantage — ${pointsA > pointsB ? 'You' : opponentName}`
    }
    return `${pointLabel('you')} – ${pointLabel('opponent')}`
  })

  const currentPointScore = computed(() => {
    const { pointsA, pointsB, format, isTiebreak, over } = draft.value
    if (over) return ''
    if (currentRules.value.mode === 'tiebreak' || isTiebreak) return `${pointsA}–${pointsB}`
    if (pointsA >= 3 && pointsB >= 3) {
      if (format === 'noad' && pointsA === pointsB) return 'Deciding point'
      if (format === 'ad' && pointsA === pointsB) return 'Deuce'
      if (format === 'ad' && Math.abs(pointsA - pointsB) === 1)
        return `Advantage · ${pointsA > pointsB ? 'You' : draft.value.opponent?.name || 'Opponent'}`
    }
    const labels = ['0', '15', '30', '40']
    return `${labels[Math.min(pointsA, 3)]}–${labels[Math.min(pointsB, 3)]}`
  })

  function persistCurrentDraft(value = draft.value) {
    if (draftDetached.value) {
      return false
    }

    const liveId = activeLiveMatchId.value

    if (liveId) {
      /*
       * Critical isolation boundary.
       *
       * The state being written must actually
       * belong to the match represented by
       * this storage key.
       */
      if (resolveLiveMatchId(value) !== liveId) {
        return false
      }

      return persist(liveMatchStorageKey(liveId), value)
    }

    return persist(DRAFT_STORAGE_KEY, value)
  }

  watch(
    draft,

    (value) => {
      persistCurrentDraft(value)
    },

    {
      deep: true,
    },
  )
  watch(results, (value) => persist(RESULT_STORAGE_KEY, value), { deep: true })
  watch(invitations, (value) => persist(INVITATION_STORAGE_KEY, value), { deep: true })
  watch(savedFormats, (value) => persist(CUSTOM_FORMAT_STORAGE_KEY, value), { deep: true })

  function prepareSetupContext() {
    /*
     * Never let Start another match mutate
     * whichever live match happened to be loaded
     * in this tab.
     */
    if (activeLiveMatchId.value) {
      persistCurrentDraft()

      activeLiveMatchId.value = ''

      draftDetached.value = false

      draft.value = readDraft()

      return
    }

    if (draftDetached.value) {
      draftDetached.value = false

      draft.value = readDraft()
    }
  }

  function clearStartedSetupDraft(matchId) {
    const id = normalizeLiveMatchId(matchId)

    if (!id) {
      return false
    }

    /*
     * Do not blindly remove the setup key.
     *
     * Another tab may already be preparing
     * another match.
     */
    const currentSetup = readDraft()

    if (resolveLiveMatchId(currentSetup) !== id) {
      return false
    }

    return removeStored(DRAFT_STORAGE_KEY)
  }

  function isCurrentLiveStorageKey(key) {
    const liveId = activeLiveMatchId.value

    return Boolean(liveId && key === liveMatchStorageKey(liveId))
  }

  function canManageMatch(actorId = '') {
    return Boolean(actorId && draft.value.ownerId && actorId === draft.value.ownerId)
  }

  function canScoreMatch(actorId = '') {
    return Boolean(actorId && draft.value.scorerId && actorId === draft.value.scorerId)
  }

  function canFinalizeMatch(actorId = '') {
    return canManageMatch(actorId) || canScoreMatch(actorId)
  }

  function changeScorerAuthority({
    actorId,
    nextScorerId,
    reason,
    sourceId = '',

    /*
     * owner
     * admin_override
     */
    authorization = 'owner',

    clubId = '',
    authorized = false,
  }) {
    const actor = normalizeAuthorityId(actorId)

    const next = normalizeAuthorityId(nextScorerId)

    if (!actor || !next) {
      return false
    }

    const ownerAuthorized = canManageMatch(actor)

    const requestedClubId = normalizeAuthorityId(clubId)

    /*
     * Frontend/mock equivalent only.
     *
     * `authorized` is supplied by the active-club
     * permission layer in FriendlyMatchFlowView.
     *
     * Laravel must later derive this permission
     * server-side rather than trusting the client.
     */
    const adminOverrideAuthorized =
      authorization === 'admin_override' &&
      authorized === true &&
      Boolean(requestedClubId) &&
      Boolean(draft.value.clubId) &&
      requestedClubId === draft.value.clubId

    if (!ownerAuthorized && !adminOverrideAuthorized) {
      return false
    }

    /*
     * Authority can only change while a real live
     * session exists.
     */
    if (draft.value.status !== 'live' || !draft.value.liveState || draft.value.over) {
      return false
    }

    /*
     * Compatibility entry for Live Operations and older authority callers.
     * A migrated match delegates the authority transaction to the canonical
     * repository; this store only refreshes its projection afterward.
     */
    if (draft.value.liveSessionId) {
      const matchId = activeLiveMatchId.value || resolveLiveMatchId(draft.value)
      const session = liveMatchSessionRepository.get(matchId)

      if (!session) {
        return false
      }

      const result = liveMatchSessionRepository.applyCommand(matchId, {
        id: `assign-scorer-${matchId}-${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        type: 'assign_scorer',
        actorId: actor,
        expectedScoreRevision: session.scoreRevision,
        expectedAuthorityRevision: session.authorityRevision,
        authorized: ownerAuthorized || adminOverrideAuthorized,
        payload: {
          scorerId: next,
          reason: String(reason || '')
            .trim()
            .slice(0, 80),
          sourceId: normalizeAuthorityId(sourceId),
        },
      })

      if (result.ok && result.session) {
        applyLiveSessionProjection(result.session)
      }

      return Boolean(result.ok)
    }

    const previous = normalizeAuthorityId(draft.value.scorerId)

    /*
     * Idempotent duplicate request.
     */
    if (previous === next) {
      return true
    }

    const changedAt = new Date().toISOString()

    const revision = Math.max(0, Number(draft.value.scorerRevision || 0)) + 1

    const historyEntry = {
      revision,

      from: previous,

      to: next,

      changedBy: actor,

      reason: String(reason || '')
        .trim()
        .slice(0, 80),

      sourceId: normalizeAuthorityId(sourceId),

      authorization: adminOverrideAuthorized ? 'admin_override' : 'owner',

      clubId: draft.value.clubId || '',

      changedAt,
    }

    draft.value.scorerId = next

    draft.value.scorerRevision = revision

    draft.value.scorerChangedAt = changedAt

    draft.value.scorerChangedBy = actor

    draft.value.scorerHistory = [
      historyEntry,

      ...(Array.isArray(draft.value.scorerHistory) ? draft.value.scorerHistory : []),
    ].slice(0, 20)

    /*
     * Authority transfer is a security/lifecycle
     * transaction. Commit immediately.
     */
    persistCurrentDraft()

    return true
  }

  function transferScoringAuthority({ actorId, scorerId, sourceId = '' }) {
    return changeScorerAuthority({
      actorId,

      nextScorerId: scorerId,

      reason: 'chair_umpire_handoff',

      sourceId,
    })
  }

  function reclaimScoringAuthority(actorId = '') {
    const actor = normalizeAuthorityId(actorId)

    const owner = normalizeAuthorityId(draft.value.ownerId)

    if (!actor || !owner || actor !== owner) {
      return false
    }

    return changeScorerAuthority({
      actorId: actor,

      nextScorerId: owner,

      reason: 'owner_reclaim',

      sourceId: '',
    })
  }

  function emergencyOverrideScoringAuthority({ actorId, clubId, authorized = false }) {
    const actor = normalizeAuthorityId(actorId)

    const matchClubId = normalizeAuthorityId(draft.value.clubId)

    const requestedClubId = normalizeAuthorityId(clubId)

    if (
      !actor ||
      !matchClubId ||
      !requestedClubId ||
      requestedClubId !== matchClubId ||
      authorized !== true
    ) {
      return false
    }

    /*
     * Being an admin does NOT automatically make
     * somebody the scorer.
     *
     * This function represents the explicit
     * "Take Match Control" action.
     */
    return changeScorerAuthority({
      actorId: actor,

      nextScorerId: actor,

      reason: 'admin_emergency_override',

      sourceId: '',

      authorization: 'admin_override',

      clubId: requestedClubId,

      authorized: true,
    })
  }

  function cancelActiveInvitation() {
    /*
     * A live match is no longer a setup invitation.
     *
     * Never erase live match identity because somebody
     * called a setup-only cancellation function.
     */
    if (activeLiveMatchId.value || draft.value.liveState || draft.value.status === 'live') {
      return false
    }

    const invitation = activeInvitation.value

    if (invitation && ['waiting_for_opponent', 'ready'].includes(invitation.status)) {
      const cancelled = {
        ...invitation,
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      invitations.value = invitations.value.map((item) =>
        item.id === invitation.id ? cancelled : item,
      )
    }

    draft.value.matchId = ''
    draft.value.joinToken = ''

    if (draft.value.status !== 'live') {
      draft.value.status = 'draft'
    }

    return true
  }

  function beginMatch() {
    /*
     * If this tab was previously viewing or scoring
     * another live match, leave that live session intact.
     *
     * We are changing UI context, not ending the match.
     */
    prepareSetupContext()

    /*
     * Cancel only a setup-stage invitation belonging
     * to this temporary setup context.
     */
    cancelActiveInvitation()

    draftDetached.value = false

    draft.value = createDraft()

    persist(DRAFT_STORAGE_KEY, draft.value)

    persist(INVITATION_STORAGE_KEY, invitations.value)

    return draft.value
  }

  function chooseMatchType(matchType) {
    if (!['friendly', 'ladder'].includes(matchType)) {
      return false
    }

    prepareSetupContext()

    /*
     * Selecting a match type here means:
     *
     * "I am creating a NEW match."
     *
     * Never reuse the previous Friendly setup simply because
     * its matchType happened to also be "friendly".
     *
     * This prevents stale:
     * - opponent
     * - timing
     * - invitation
     * - join token
     * - scorer
     * - live state
     *
     * from leaking into the next match.
     */
    cancelActiveInvitation()

    draft.value = {
      ...createDraft(),
      matchType,
    }

    if (matchType === 'ladder') {
      applyLadderRules()
    }

    /*
     * Persist this boundary immediately.
     *
     * Creating a fresh match is a lifecycle transaction,
     * not merely a visual change.
     */
    persist(DRAFT_STORAGE_KEY, draft.value)

    return true
  }

  function applyLadderRules() {
    const ladderConfig = getActiveLadderConfig()
    draft.value.format = ladderConfig.scoring === 'noad' ? 'noad' : 'ad'
    draft.value.matchFormat = 'best-of-3'
    draft.value.customFormat = null
    draft.value.tieBreak = '6-6'
    draft.value.ladderConfigSnapshot = { ...ladderConfig }
    const adapted = ladderRulesToMatchRulesSnapshot({
      ladderConfigSnapshot: draft.value.ladderConfigSnapshot,
      matchConfig: ladderMatchConfig(ladderConfig),
    })
    draft.value.rulesSnapshot = adapted.ok ? freezeMatchRulesSnapshot(adapted.snapshot) : null
    resetScore()
    return ladderMatchConfig(ladderConfig)
  }

  function chooseTiming(timing, creator) {
    if (!['now', 'later'].includes(timing)) {
      return null
    }

    // If the creator previously generated a Friendly invitation
    // and then changes the journey, revoke the old invitation.
    if (draft.value.matchType === 'friendly' && activeInvitation.value) {
      cancelActiveInvitation()
    }

    draft.value.timing = timing
    draft.value.ownerId = normalizeIdentity(creator).id
    draft.value.status = 'draft'

    /*
     * Friendly:
     * Timing is now known, but the opponent/invitation is not.
     */
    if (draft.value.matchType === 'friendly') {
      draft.value.invitationAudience = ''
      draft.value.opponent = null
      return null
    }

    /*
     * Ladder:
     * Opponent is already known before this stage.
     */
    if (timing === 'later') {
      draft.value.matchId = ''
      draft.value.joinToken = ''
      return null
    }

    return createPlayNowInvitation(creator)
  }

  function createPlayNowInvitation(creator) {
    if (draft.value.timing !== 'now') {
      return null
    }

    const creatorIdentity = normalizeIdentity(creator)

    if (!creatorIdentity.id) {
      return null
    }

    const audience =
      draft.value.matchType === 'ladder' ? 'targeted' : draft.value.invitationAudience

    if (!['targeted', 'open'].includes(audience)) {
      return null
    }

    const expectedOpponent =
      audience === 'targeted' && draft.value.opponent
        ? normalizeIdentity(draft.value.opponent)
        : null

    if (audience === 'targeted' && !expectedOpponent?.id) {
      return null
    }

    if (expectedOpponent?.id === creatorIdentity.id) {
      return null
    }

    const existing = activeInvitation.value

    if (existing && ['waiting_for_opponent', 'ready'].includes(existing.status)) {
      const existingAudience =
        existing.audience || (existing.expectedOpponent?.id ? 'targeted' : 'open')

      const existingOpponentId = existing.expectedOpponent?.id || ''
      const nextOpponentId = expectedOpponent?.id || ''

      if (existingAudience === audience && existingOpponentId === nextOpponentId) {
        return existing
      }

      cancelActiveInvitation()
    }

    const now = Date.now()
    const token = createToken()

    const invitation = {
      id: `${draft.value.matchType || 'friendly'}-${now}-${token.slice(0, 6)}`,
      token,

      type: draft.value.matchType || 'friendly',
      timing: 'now',

      /*
       * targeted = a known club member.
       * open = whoever legitimately claims the invitation.
       */
      audience,

      status: 'waiting_for_opponent',

      creator: creatorIdentity,

      // Set only for a targeted invitation.
      expectedOpponent,

      // Populated only after the invited player actually joins.
      opponent: null,

      // Snapshot of the setup the recipient is being invited to.
      matchSetup: {
        scoring: draft.value.format,
        matchFormat: draft.value.matchFormat,
        customFormat: draft.value.customFormat ? { ...draft.value.customFormat } : null,
        rulesSnapshot: draft.value.rulesSnapshot,
        tieBreak: draft.value.tieBreak,
      },

      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + PLAY_NOW_TTL_MS).toISOString(),
    }

    invitations.value = [invitation, ...invitations.value]

    draft.value.invitationAudience = audience
    draft.value.matchId = invitation.id
    draft.value.joinToken = token
    draft.value.status = invitation.status

    /*
     * Invitation creation is a cross-device/cross-tab boundary.
     *
     * Persist immediately instead of waiting for Vue's watcher.
     * This prevents somebody opening the generated URL before
     * the invitation has actually reached localStorage.
     */
    persist(INVITATION_STORAGE_KEY, invitations.value)
    persist(DRAFT_STORAGE_KEY, draft.value)

    return invitation
  }
  function chooseOpponent(opponent) {
    draft.value.opponent = opponent ? normalizeIdentity(opponent) : null
  }

  function setInvitationAudience(audience = '') {
    if (!['', 'targeted', 'open'].includes(audience)) {
      return false
    }

    if (draft.value.matchType !== 'friendly' && audience) {
      return false
    }

    draft.value.invitationAudience = audience

    if (audience === 'open') {
      draft.value.opponent = null
    }

    return true
  }

  function addOpponentToPlayNow(opponent) {
    const invitation = activeInvitation.value
    if (!invitation || !['waiting_for_opponent', 'ready'].includes(invitation.status)) return null
    const identity = normalizeIdentity(opponent)
    if (!identity.id || identity.id === invitation.creator?.id) return null
    if (invitation.expectedOpponent?.id && identity.id !== invitation.expectedOpponent.id) {
      return null
    }
    if (invitation.type === 'ladder' && !isEligibleLadderOpponent(invitation.creator, identity))
      return null
    invitation.opponent = identity
    invitation.status = 'ready'
    invitation.joinedAt = new Date().toISOString()
    invitation.updatedAt = invitation.joinedAt
    invitations.value = invitations.value.map((item) =>
      item.id === invitation.id ? { ...invitation } : item,
    )
    draft.value.opponent = identity
    draft.value.status = 'ready'

    /*
     * Same READY transaction as joinInvitation().
     * Keep simulator/testing behavior identical to the
     * real invitation-claim path.
     */
    persist(INVITATION_STORAGE_KEY, invitations.value)
    persist(DRAFT_STORAGE_KEY, draft.value)

    return identity
  }

  function updateSchedule(field, value) {
    if (['date', 'time', 'court'].includes(field)) draft.value.schedule[field] = String(value || '')
  }

  function chooseFormat(format) {
    if (!['ad', 'noad'].includes(format)) return
    const changed = draft.value.format !== format
    draft.value.format = format
    if (changed && draft.value.matchFormat === 'custom' && draft.value.rulesSnapshot) {
      const rulesSnapshot = withFriendlyScoringFormat(draft.value.rulesSnapshot, format)
      draft.value.rulesSnapshot = rulesSnapshot
      if (draft.value.customFormat) {
        draft.value.customFormat = {
          ...draft.value.customFormat,
          rulesSnapshot,
        }
      }
    }
    if (changed) resetScore()
  }

  function chooseMatchFormat(matchFormat) {
    if (!['best-of-3', 'one-set', 'match-tiebreak'].includes(matchFormat)) return
    const changed = draft.value.matchFormat !== matchFormat || Boolean(draft.value.customFormat)
    draft.value.matchFormat = matchFormat
    draft.value.customFormat = null
    draft.value.rulesSnapshot = null
    if (changed) resetScore()
  }

  function selectCustomFormat(format) {
    const normalized = normalizeCustomFormat(format)
    const changed =
      draft.value.matchFormat !== 'custom' ||
      JSON.stringify(draft.value.customFormat) !== JSON.stringify(normalized)
    draft.value.matchFormat = 'custom'
    draft.value.customFormat = normalized
    draft.value.rulesSnapshot = normalized.rulesSnapshot || null
    if (changed) resetScore()
    return normalized
  }

  function saveCustomFormat(format) {
    const normalized = normalizeCustomFormat(format)
    savedFormats.value = [
      normalized,
      ...savedFormats.value.filter((item) => item.id !== normalized.id),
    ]
    selectCustomFormat(normalized)
    return normalized
  }

  function refreshInvitations() {
    const now = Date.now()
    const snapshots = mergeInvitationSnapshots(invitations.value, readArray(INVITATION_STORAGE_KEY))
    invitations.value = snapshots.map((invitation) =>
      invitation.status === 'waiting_for_opponent' &&
      invitation.expiresAt &&
      new Date(invitation.expiresAt).getTime() <= now
        ? { ...invitation, status: 'expired' }
        : invitation,
    )
    const current = invitations.value.find((item) => item.id === draft.value.matchId)
    if (current) {
      draft.value.status = current.status
      if (current.opponent) draft.value.opponent = { ...current.opponent }
    }
    return current || null
  }

  function invitationByToken(token) {
    refreshInvitations()
    return invitations.value.find((invitation) => invitation.token === token) || null
  }

  function resultById(resultId = '') {
    const id = String(resultId || '')

    if (!id) {
      return null
    }

    return results.value.find((result) => result.id === id) || null
  }

  function reportResultIssue(resultId = '', actorId = '', message = '') {
    const id = String(resultId || '')
    const actor = String(actorId || '')

    if (!id || !actor) {
      return null
    }

    const result = results.value.find((item) => item.id === id)

    if (!result) {
      return null
    }

    /*
     * Only terminal results can receive a review request.
     *
     * A live match has its own Undo/correction workflow.
     */
    if (result.status !== 'completed') {
      return null
    }

    const participantIds = Array.isArray(result.participantIds) ? result.participantIds : []

    /*
     * Frontend authorization boundary.
     *
     * Knowing a result ID must never be enough to create
     * a review request.
     *
     * Laravel will later derive the authenticated actor
     * from the session/token instead of trusting actorId
     * supplied by the browser.
     */
    if (!participantIds.includes(actor)) {
      return null
    }

    /*
     * Keep review payloads bounded and predictable.
     *
     * This is still not a substitute for backend validation.
     */
    const normalizedMessage = String(message || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 280)

    if (normalizedMessage.length < 6) {
      return null
    }

    const issues = Array.isArray(result.issues) ? result.issues : []

    /*
     * One unresolved request per participant/result.
     *
     * This prevents repeated taps or refreshes from creating
     * duplicate review records.
     */
    const existingOpenIssue = issues.find(
      (issue) => issue.reportedBy === actor && issue.status === 'open',
    )

    if (existingOpenIssue) {
      return existingOpenIssue
    }

    const now = new Date().toISOString()

    const issue = {
      id: `issue-${createToken()}`,

      type: 'result_review',

      status: 'open',

      reportedBy: actor,

      message: normalizedMessage,

      createdAt: now,
    }

    const updatedResult = {
      ...result,

      /*
       * IMPORTANT:
       *
       * The tennis result itself remains unchanged.
       *
       * This metadata describes a review workflow around the
       * result. It does not silently modify winner/score/sets.
       */
      reviewStatus: 'issue_reported',

      issues: [issue, ...issues],

      updatedAt: now,
    }

    results.value = results.value.map((item) => (item.id === id ? updatedResult : item))

    /*
     * Important lifecycle metadata is committed immediately.
     *
     * Future backend equivalent:
     *
     * POST /matches/{match}/result-issues
     *
     * The server will authorize the authenticated user,
     * validate the completed result and create an audit event.
     */
    persist(RESULT_STORAGE_KEY, results.value)

    return issue
  }

  function refreshResults() {
    /*
     * Completed results are immutable records.
     *
     * Unlike the active scoring draft, there is no revision
     * conflict to resolve here. The persisted result collection
     * can safely refresh the in-memory collection.
     */
    results.value = readArray(RESULT_STORAGE_KEY)

    return results.value
  }

  function joinInvitation(token, identity) {
    const actor = normalizeIdentity(identity)
    const invitation = invitationByToken(token)
    if (!invitation) return { ok: false, message: 'This match invitation is no longer available.' }
    if (invitation.status === 'expired')
      return { ok: false, message: 'This match invitation has expired.' }
    if (invitation.status === 'cancelled')
      return { ok: false, message: 'This match invitation was cancelled.' }
    if (!actor.id) return { ok: false, message: 'Sign in before joining this match.' }
    if (actor.id === invitation.creator?.id)
      return {
        ok: false,
        message: 'This invitation belongs to the player who created the match.',
      }

    if (invitation.expectedOpponent?.id && actor.id !== invitation.expectedOpponent.id) {
      return {
        ok: false,
        message: `This invitation is for ${invitation.expectedOpponent.name}.`,
      }
    }

    if (invitation.opponent?.id) {
      if (invitation.opponent.id === actor.id) return { ok: true, invitation }
      return { ok: false, message: 'Another player has already joined this match.' }
    }
    if (invitation.status !== 'waiting_for_opponent')
      return { ok: false, message: 'This match is not accepting another player.' }
    if (invitation.type === 'ladder' && !isEligibleLadderOpponent(invitation.creator, actor))
      return {
        ok: false,
        message: 'You are outside this player’s eligible Ladder challenge window.',
      }
    invitation.opponent = actor
    invitation.status = 'ready'
    invitation.joinedAt = new Date().toISOString()
    invitation.updatedAt = invitation.joinedAt
    invitations.value = invitations.value.map((item) =>
      item.id === invitation.id ? { ...invitation } : item,
    )

    if (draft.value.matchId === invitation.id) {
      draft.value.opponent = actor
      draft.value.status = 'ready'
    }

    /*
     * Joining is a real lifecycle transition:
     *
     * waiting_for_opponent
     * → ready
     *
     * Commit it synchronously so the creator's other tab can
     * immediately observe the authoritative Ready state.
     */
    persist(INVITATION_STORAGE_KEY, invitations.value)
    persist(DRAFT_STORAGE_KEY, draft.value)

    return {
      ok: true,
      invitation,
    }
  }

  function createScheduledInvitation(creator) {
    const creatorIdentity = normalizeIdentity(creator)
    if (
      !scheduleComplete.value ||
      (draft.value.ownerId && creatorIdentity.id !== draft.value.ownerId)
    )
      return null
    const resolvedRules = engineConfigForDraft(draft.value)
    if (!resolvedRules.ok) return null
    draft.value.rulesSnapshot = resolvedRules.snapshot
    const now = Date.now()
    const invitation = {
      id: draft.value.matchId || `friendly-scheduled-${now}-${createToken().slice(0, 6)}`,
      token: draft.value.joinToken || createToken(),
      type: draft.value.matchType || 'friendly',
      timing: 'later',
      status: 'waiting_for_acceptance',
      creator: creatorIdentity,
      opponent: normalizeIdentity(draft.value.opponent),
      schedule: { ...draft.value.schedule },
      scoring: draft.value.format,
      matchFormat: draft.value.matchFormat,
      customFormat: draft.value.customFormat ? { ...draft.value.customFormat } : null,
      rulesSnapshot: resolvedRules.snapshot,
      tieBreak: draft.value.tieBreak,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    }
    invitations.value = [
      invitation,
      ...invitations.value.filter((item) => item.id !== invitation.id),
    ]
    draft.value.matchId = invitation.id
    draft.value.joinToken = invitation.token
    draft.value.status = invitation.status
    return invitation
  }

  function startLiveMatch(actorId = '', clubId = '') {
    if (!actorId) {
      return false
    }

    const normalizedClubId = normalizeAuthorityId(clubId)

    /*
     * Once a live session belongs to a club,
     * another active-club selection may not
     * silently rebind it.
     */
    if (draft.value.clubId && normalizedClubId && draft.value.clubId !== normalizedClubId) {
      return false
    }

    if (!draft.value.clubId && normalizedClubId) {
      draft.value.clubId = normalizedClubId
    }

    /*
     * Starting the match is a management action.
     *
     * For today's Friendly flow, the creator owns
     * the match.
     */
    if (draft.value.ownerId && actorId !== draft.value.ownerId) {
      return false
    }

    if (!draft.value.opponent || !draft.value.format) {
      return false
    }

    /*
     * A Play-now match may not start until somebody
     * has legitimately claimed the opponent slot.
     */
    if (
      draft.value.timing === 'now' &&
      (!activeInvitation.value || !['ready', 'live'].includes(activeInvitation.value.status))
    ) {
      return false
    }

    /*
     * Migration-friendly:
     * if an older flow reaches here without ownerId,
     * the authenticated starter becomes the owner.
     */
    if (!draft.value.ownerId) {
      draft.value.ownerId = actorId
    }

    /*
     * Normal Friendly match:
     * creator begins as the scorer.
     *
     * IMPORTANT:
     * if scorerId was already deliberately assigned
     * to somebody else, starting the match must NOT
     * overwrite that authority.
     */
    if (!draft.value.scorerId) {
      const assignedAt = new Date().toISOString()

      draft.value.scorerId = actorId

      draft.value.scorerRevision = Math.max(1, Number(draft.value.scorerRevision || 0))

      draft.value.scorerChangedAt = assignedAt

      draft.value.scorerChangedBy = actorId

      if (!draft.value.scorerHistory.length) {
        draft.value.scorerHistory = [
          {
            revision: draft.value.scorerRevision,

            from: '',

            to: actorId,

            changedBy: actorId,

            reason: 'match_started',

            sourceId: '',

            changedAt: assignedAt,
          },
        ]
      }
    }

    const startedAt = draft.value.startedAt || new Date().toISOString()

    const creatorName = activeInvitation.value?.creator?.name || 'You'

    const opponentName = draft.value.opponent?.name || 'Opponent'
    const resolvedRules = engineConfigForDraft(draft.value)

    /*
     * Serious/ambiguous rule mistakes must not be silently replaced by engine
     * defaults. Once play starts this snapshot is retained unchanged.
     */
    if (!resolvedRules.ok) {
      return false
    }

    draft.value.rulesSnapshot = resolvedRules.snapshot

    /*
     * Never recreate a score merely because Start
     * Match is triggered again.
     *
     * Idempotence matters here:
     * duplicate taps must not erase the match.
     */
    if (draft.value.liveState) {
      draft.value.liveState = normalizeScoreboard(draft.value.liveState, {
        players: {
          playerA: creatorName,
          playerB: opponentName,
        },

        config: resolvedRules.config,

        startedAt,
        status: 'live',
      })
    } else {
      draft.value.liveState = createScoreboard({
        players: {
          playerA: creatorName,
          playerB: opponentName,
        },

        config: resolvedRules.config,

        startedAt,

        status: 'live',

        /*
         * Default only.
         * Separation Two will make the real first
         * server interaction explicit in the UI.
         */
        currentServer: 'playerA',
      })
    }

    draft.value.startedAt = startedAt

    draft.value.status = draft.value.liveState.matchWinner ? 'finished' : 'live'

    /*
     * Existing UI still reads pointsA/gamesA/etc.
     * Keep it working while liveState becomes the
     * source of truth.
     */
    syncLegacyScoreFields()

    const invitation = activeInvitation.value

    if (invitation) {
      const now = new Date().toISOString()

      const updatedInvitation = {
        ...invitation,

        status: draft.value.status,

        startedAt: invitation.startedAt || startedAt,

        updatedAt: now,

        rulesSnapshot: resolvedRules.snapshot,

        matchSetup: {
          ...(invitation.matchSetup || {}),
          scoring: draft.value.format,
          matchFormat: draft.value.matchFormat,
          customFormat: draft.value.customFormat ? { ...draft.value.customFormat } : null,
          rulesSnapshot: resolvedRules.snapshot,
          tieBreak: draft.value.tieBreak,
        },
      }

      invitations.value = invitations.value.map((item) =>
        item.id === invitation.id ? updatedInvitation : item,
      )
    }

    /*
     * Starting the match is another lifecycle transaction.
     *
     * At this moment:
     *
     * ready
     * → live
     *
     * Both the draft and invitation must already agree before
     * the application navigates to Match Control.
     */
    const liveId = resolveLiveMatchId(draft.value)

    if (!liveId) {
      return false
    }

    /*
     * Bind this store instance to this specific
     * live match BEFORE future deep-watcher writes.
     */
    activeLiveMatchId.value = liveId

    draftDetached.value = false

    /*
     * The live record must exist before we release
     * the temporary setup record.
     */
    const livePersisted = persistCurrentDraft()

    if (!livePersisted) {
      /*
       * During the frontend/mock stage localStorage
       * is our only durable live authority.
       *
       * If it cannot be persisted, fail closed rather
       * than pretending Match Control safely started.
       */
      activeLiveMatchId.value = ''

      return false
    }

    persist(INVITATION_STORAGE_KEY, invitations.value)

    /*
     * Remove the old setup only if it still belongs
     * to THIS match.
     *
     * Another tab may already be creating Court B.
     */
    clearStartedSetupDraft(liveId)

    return true
  }

  function linkLadderRecords(challenge, match = null) {
    draft.value.challengeId = challenge?.id || draft.value.challengeId

    draft.value.ladderMatchId = match?.id || draft.value.ladderMatchId

    if (match?.id) {
      draft.value.matchId = match.id
    }

    const rulesSnapshot = match?.rulesSnapshot || challenge?.rulesSnapshot
    if (rulesSnapshot && validateMatchRulesSnapshot(rulesSnapshot).valid) {
      draft.value.rulesSnapshot = freezeMatchRulesSnapshot(rulesSnapshot)
    }

    draft.value.preMatchPositions = challenge?.preMatchPositions || {
      challenger: Number(challenge?.challengerRank || 0) || null,

      defender: Number(challenge?.defenderRank || 0) || null,
    }

    /*
     * Ownership and scoring authority can come
     * from the shared match/challenge domain.
     */
    const ownerId = match?.ownerId || challenge?.challengerId || ''

    const scorerId = match?.scorerId || challenge?.scorerId || ''

    if (ownerId) {
      draft.value.ownerId = ownerId
    }

    if (scorerId) {
      draft.value.scorerId = scorerId
    }

    if (challenge?.status) {
      draft.value.status = challenge.status
    }
  }

  function sideToPlayerKey(side) {
    return side === 'opponent' ? 'playerB' : 'playerA'
  }

  function syncLegacyScoreFields() {
    const liveState = draft.value.liveState

    if (!liveState) {
      return
    }

    const currentSet = liveState.sets?.[liveState.currentSetIndex] || null

    const currentGame = liveState.currentGame || {}

    const isTieBreak = Boolean(currentGame.inTieBreak)

    const points = isTieBreak ? currentGame.tieBreakPoints : currentGame.points

    draft.value.pointsA = Number(points?.playerA || 0)

    draft.value.pointsB = Number(points?.playerB || 0)

    draft.value.gamesA = Number(currentSet?.games?.playerA || 0)

    draft.value.gamesB = Number(currentSet?.games?.playerB || 0)

    draft.value.setsA = liveState.completedSets.filter((set) => set.winner === 'playerA').length

    draft.value.setsB = liveState.completedSets.filter((set) => set.winner === 'playerB').length

    /*
     * Keep the existing MatchResultModal contract
     * alive during migration.
     */
    draft.value.setScores = liveState.completedSets.map((set) => {
      const score = set.isMatchTieBreak && set.tieBreak?.score ? set.tieBreak.score : set.games

      return {
        a: Number(score?.playerA || 0),

        b: Number(score?.playerB || 0),

        tieBreak: set.tieBreak
          ? {
              ...set.tieBreak,
            }
          : null,

        isMatchTieBreak: Boolean(set.isMatchTieBreak),
      }
    })

    draft.value.isTiebreak = isTieBreak

    draft.value.isMatchTiebreak = Boolean(currentGame.isMatchTieBreak)

    draft.value.pointHistory = Array.isArray(liveState.history) ? liveState.history : []

    draft.value.over = Boolean(liveState.matchWinner)

    if (liveState.matchWinner === 'playerA') {
      draft.value.winner = 'you'
    } else if (liveState.matchWinner === 'playerB') {
      draft.value.winner = 'opponent'
    } else {
      draft.value.winner = ''
    }

    draft.value.status = liveState.matchWinner ? 'finished' : 'live'
  }

  function pointLabel(side) {
    if (!['you', 'opponent'].includes(side)) {
      return ''
    }

    /*
     * New authoritative path.
     */
    if (draft.value.liveState) {
      if (draft.value.over) {
        return draft.value.winner === side ? 'Won' : 'Match'
      }

      const label = describePoint(draft.value.liveState, sideToPlayerKey(side))

      return label === 'Advantage' ? 'Ad' : label
    }

    /*
     * Setup/legacy fallback before liveState exists.
     *
     * This is presentation only.
     * No tennis state is mutated here.
     */
    const own = side === 'you' ? draft.value.pointsA : draft.value.pointsB

    const other = side === 'you' ? draft.value.pointsB : draft.value.pointsA

    if (draft.value.over) {
      return draft.value.winner === side ? 'Won' : 'Match'
    }

    if (draft.value.isTiebreak || currentRules.value.mode === 'tiebreak') {
      return String(own)
    }

    if (draft.value.format === 'ad' && own >= 3 && other >= 3) {
      if (own === other) {
        return '40'
      }

      if (own === other + 1) {
        return 'Ad'
      }

      if (other === own + 1) {
        return '40'
      }
    }

    return ['Love', '15', '30', '40'][Math.min(own, 3)]
  }

  function recordPoint(side, actorId = '') {
    if (!['you', 'opponent'].includes(side)) {
      return false
    }

    if (draft.value.liveSessionId) {
      return false
    }

    if (activeLiveMatchId.value) {
      refreshDraft()
    }

    /*
     * This is now score authority,
     * not ownership authority.
     */
    if (!canScoreMatch(actorId)) {
      return false
    }

    if (draft.value.status !== 'live' || !draft.value.liveState || draft.value.over) {
      return false
    }

    const previousRevision = Number(draft.value.liveState.revision || 0)

    const next = recordTennisPoint(draft.value.liveState, sideToPlayerKey(side))

    if (!next || Number(next.revision || 0) <= previousRevision) {
      return false
    }

    draft.value.liveState = next

    syncLegacyScoreFields()

    return true
  }

  function undoPoint(actorId = '') {
    if (draft.value.liveSessionId) {
      return false
    }

    if (activeLiveMatchId.value) {
      refreshDraft()
    }

    if (!canScoreMatch(actorId)) {
      return false
    }

    if (!draft.value.liveState || !draft.value.liveState.history?.length) {
      return false
    }

    const previousRevision = Number(draft.value.liveState.revision || 0)

    const restored = undoLastPoint(draft.value.liveState)

    if (!restored || Number(restored.revision || 0) <= previousRevision) {
      return false
    }

    draft.value.liveState = restored

    syncLegacyScoreFields()

    return true
  }

  function setServer(side, actorId = '') {
    if (!['you', 'opponent'].includes(side)) {
      return false
    }

    if (draft.value.liveSessionId) {
      return false
    }

    if (activeLiveMatchId.value) {
      refreshDraft()
    }

    if (!canScoreMatch(actorId)) {
      return false
    }

    if (!draft.value.liveState || draft.value.over) {
      return false
    }

    const previousRevision = Number(draft.value.liveState.revision || 0)

    const next = setTennisServer(draft.value.liveState, sideToPlayerKey(side))

    if (!next || Number(next.revision || 0) <= previousRevision) {
      /*
       * Selecting the already-active server is
       * harmless and intentionally treated as
       * "no state change".
       */
      return false
    }

    draft.value.liveState = next

    syncLegacyScoreFields()

    return true
  }

  function toggleServer(actorId = '') {
    if (draft.value.liveSessionId) {
      return false
    }

    if (activeLiveMatchId.value) {
      refreshDraft()
    }

    if (!canScoreMatch(actorId)) {
      return false
    }

    if (!draft.value.liveState || draft.value.over) {
      return false
    }

    const previousRevision = Number(draft.value.liveState.revision || 0)

    const next = toggleTennisServer(draft.value.liveState)

    if (!next || Number(next.revision || 0) <= previousRevision) {
      return false
    }

    draft.value.liveState = next

    syncLegacyScoreFields()

    return true
  }

  function mergeLiveDraftSnapshots(current, stored) {
    if (!current) {
      return stored
    }

    if (!stored) {
      return current
    }

    const currentId = resolveLiveMatchId(current)

    const storedId = resolveLiveMatchId(stored)

    if (!currentId || currentId !== storedId) {
      return stored
    }

    const currentScoreRevision = Number(current.liveState?.revision || 0)

    const storedScoreRevision = Number(stored.liveState?.revision || 0)

    const scoreSource = storedScoreRevision >= currentScoreRevision ? stored : current

    const currentAuthorityRevision = Number(current.scorerRevision || 0)

    const storedAuthorityRevision = Number(stored.scorerRevision || 0)

    let authoritySource = storedAuthorityRevision >= currentAuthorityRevision ? stored : current

    /*
     * Same authority revision:
     * use the later explicit authority timestamp.
     */
    if (storedAuthorityRevision === currentAuthorityRevision) {
      const currentChangedAt = new Date(current.scorerChangedAt || 0).getTime()

      const storedChangedAt = new Date(stored.scorerChangedAt || 0).getTime()

      authoritySource = storedChangedAt >= currentChangedAt ? stored : current
    }

    return {
      ...current,

      ...stored,

      /*
       * Tennis state and authority state can advance
       * independently in different tabs.
       *
       * Never throw away a newer score merely because
       * another tab contains a newer scorer revision.
       */
      liveState: scoreSource.liveState,

      startedAt: scoreSource.startedAt,

      status: scoreSource.status,

      scorerId: authoritySource.scorerId,

      scorerRevision: authoritySource.scorerRevision,

      scorerChangedAt: authoritySource.scorerChangedAt,

      scorerChangedBy: authoritySource.scorerChangedBy,

      scorerHistory: Array.isArray(authoritySource.scorerHistory)
        ? authoritySource.scorerHistory.slice(0, 20)
        : [],
    }
  }

  /*
   * Transitional projection for existing Friendly UI/publication consumers.
   * This method never runs tennis arithmetic. The canonical session remains
   * the sole writer and its engineState is copied here only for compatibility.
   */
  function attachCanonicalLiveMatch(match, canonicalMatch, session) {
    const matchId = normalizeLiveMatchId(match?.id)
    const canonicalId = normalizeLiveMatchId(canonicalMatch?.id)
    if (
      !matchId ||
      matchId !== canonicalId ||
      matchId !== normalizeLiveMatchId(session?.matchId) ||
      canonicalMatch?.source !== 'ladder' ||
      !canonicalMatch.rulesSnapshot ||
      !session?.engineState
    ) {
      return false
    }

    const scheduledAt = match.scheduledAt ? new Date(match.scheduledAt) : null
    const rulesSnapshot = freezeMatchRulesSnapshot(canonicalMatch.rulesSnapshot)
    const sideA = canonicalMatch.sides?.[0] || {}
    const sideB = canonicalMatch.sides?.[1] || {}

    activeLiveMatchId.value = matchId
    draftDetached.value = false
    draft.value = normalizeStoredDraft({
      ...createDraft(),
      matchType: 'ladder',
      timing: match.scheduledAt ? 'later' : 'now',
      clubId: canonicalMatch.clubId || match.clubId || '',
      matchId,
      challengeId: match.challengeId || canonicalMatch.sourceRef?.id || '',
      ladderMatchId: matchId,
      ladderConfigSnapshot: match.ladderConfigSnapshot || null,
      rulesSnapshot,
      preMatchPositions: match.preMatchPositions || null,
      ownerId: sideA.id || match.challengerId || '',
      scorerId: session.scorerAuthority?.scorerId || match.scorerId || '',
      scorerRevision: Number(session.authorityRevision || 0),
      scorerChangedAt: session.scorerAuthority?.changedAt || '',
      scorerChangedBy: session.scorerAuthority?.assignedBy || '',
      scorerHistory: session.scorerAuthority?.history || [],
      opponent: {
        id: sideB.id || match.defenderId || '',
        name: sideB.name || match.defenderName || 'Opponent',
        rank: Number(match.preMatchPositions?.defender || 0) || null,
        division: 'Ladder',
      },
      format:
        rulesSnapshot.game?.mode === 'traditional' && rulesSnapshot.game?.deuce === 'no_ad'
          ? 'noad'
          : 'ad',
      matchFormat: 'custom',
      customFormat: {
        id: `canonical-${matchId}`,
        name: 'Ladder match format',
        rulesSnapshot,
      },
      tieBreak:
        rulesSnapshot.set?.tiedAtTarget?.mode === 'tiebreak'
          ? `${rulesSnapshot.set.gamesToWin}-${rulesSnapshot.set.gamesToWin}`
          : 'none',
      schedule: {
        date:
          scheduledAt && Number.isFinite(scheduledAt.getTime())
            ? scheduledAt.toISOString().slice(0, 10)
            : '',
        time:
          scheduledAt && Number.isFinite(scheduledAt.getTime())
            ? scheduledAt.toISOString().slice(11, 16)
            : '',
        court: match.court?.label || match.court || canonicalMatch.court?.label || '',
      },
      startedAt: session.startedAt || match.startedAt || '',
      liveSessionId: session.id,
      liveState: normalizeScoreboard(session.engineState),
      status: session.engineState.matchWinner ? 'finished' : 'live',
    })
    syncLegacyScoreFields()
    return persistCurrentDraft()
  }

  function applyLiveSessionProjection(session) {
    const matchId = normalizeLiveMatchId(session?.matchId)
    const liveId = activeLiveMatchId.value || resolveLiveMatchId(draft.value)

    if (!matchId || !liveId || matchId !== liveId || !session?.engineState) {
      return false
    }

    draft.value.liveSessionId = normalizeLiveMatchId(session.id)
    draft.value.liveState = normalizeScoreboard(session.engineState)
    draft.value.startedAt = session.startedAt || draft.value.startedAt
    draft.value.scorerId = normalizeAuthorityId(session.scorerAuthority?.scorerId)
    draft.value.scorerRevision = Math.max(0, Number(session.authorityRevision || 0))
    draft.value.scorerChangedAt = session.scorerAuthority?.changedAt || ''
    draft.value.scorerChangedBy = session.scorerAuthority?.assignedBy || ''
    draft.value.scorerHistory = Array.isArray(session.scorerAuthority?.history)
      ? session.scorerAuthority.history.slice(0, 20).map((entry) => ({ ...entry }))
      : []

    syncLegacyScoreFields()
    persistCurrentDraft()
    return true
  }

  /*
   * Home / personal live-match projection.
   *
   * This deliberately exposes only live matches that:
   *
   * - belong to the active club
   * - directly involve the current actor
   * - still have a real live scoring state
   *
   * Home must never discover unrelated club matches merely
   * because they happen to exist in browser storage.
   *
   * Laravel will eventually replace this query with an
   * authenticated server-side equivalent.
   */
  function listLiveMatchesForUser({ clubId = '', actorId = '' } = {}) {
    const requestedClubId = normalizeAuthorityId(clubId)

    const requestedActorId = normalizeAuthorityId(actorId)

    /*
     * Fail closed.
     *
     * Without both club and actor identity there is no
     * legitimate personal Home projection to return.
     */
    if (!requestedClubId || !requestedActorId || typeof window === 'undefined') {
      return []
    }

    const matches = []

    try {
      const storage = window.localStorage

      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index) || ''

        if (!key.startsWith(LIVE_MATCH_STORAGE_PREFIX)) {
          continue
        }

        const encodedMatchId = key.slice(LIVE_MATCH_STORAGE_PREFIX.length)

        let matchId = ''

        try {
          matchId = decodeURIComponent(encodedMatchId)
        } catch {
          continue
        }

        const match = readLiveDraft(matchId)

        if (
          !match ||
          match.status !== 'live' ||
          !match.liveState ||
          match.liveState.matchWinner ||
          match.over
        ) {
          continue
        }

        /*
         * Active-club isolation.
         */
        if (normalizeAuthorityId(match.clubId) !== requestedClubId) {
          continue
        }

        /*
         * Personal relationship only.
         *
         * owner:
         * creator / match owner
         *
         * scorer:
         * delegated scorer / chair umpire etc.
         *
         * opponent:
         * second match participant
         */
        const relationshipIds = new Set(
          [match.ownerId, match.scorerId, match.opponent?.id]
            .map(normalizeAuthorityId)
            .filter(Boolean),
        )

        if (!relationshipIds.has(requestedActorId)) {
          continue
        }

        matches.push(match)
      }
    } catch {
      /*
       * Restricted/private browser storage should not
       * crash Home or leak fallback data.
       */
      return []
    }

    return matches
  }

  /*
   * Cross-tab live-match changes.
   *
   * No polling:
   * remain idle when nothing changes and react only when
   * another browser tab actually changes live-match state.
   */
  function subscribeToLiveMatchChanges(callback) {
    if (typeof callback !== 'function' || typeof window === 'undefined') {
      return () => {}
    }

    const handleStorage = (event) => {
      /*
       * key === null means localStorage was cleared.
       */
      if (event.key !== null && !event.key.startsWith(LIVE_MATCH_STORAGE_PREFIX)) {
        return
      }

      callback()
    }

    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }

  function hasLiveMatch(matchId) {
    return Boolean(readLiveDraft(matchId))
  }

  function loadLiveMatch(matchId) {
    const id = normalizeLiveMatchId(matchId)

    if (!id) {
      return null
    }

    /*
     * Persist the previously loaded live court
     * before changing this tab's working context.
     */
    if (activeLiveMatchId.value && activeLiveMatchId.value !== id) {
      persistCurrentDraft()
    }

    const stored = readLiveDraft(id)

    if (!stored) {
      return null
    }

    activeLiveMatchId.value = id

    draftDetached.value = false

    draft.value = stored

    syncLegacyScoreFields()

    return draft.value
  }

  function refreshDraft() {
    const liveId = activeLiveMatchId.value

    /*
     * SETUP MODE
     */
    if (!liveId) {
      if (draftDetached.value) {
        return null
      }

      const stored = readDraft()

      draft.value = stored

      return draft.value
    }

    /*
     * LIVE MODE
     *
     * Read ONLY the storage record belonging
     * to the currently loaded match.
     */
    const stored = readLiveDraft(liveId)

    if (!stored) {
      /*
       * Another context may have completed or
       * removed this live session.
       *
       * Stop treating this tab as authoritative.
       *
       * Do NOT write the stale live object into
       * the setup-draft key.
       */
      activeLiveMatchId.value = ''

      draftDetached.value = true

      return null
    }

    const merged = mergeLiveDraftSnapshots(draft.value, stored)

    draft.value = merged

    syncLegacyScoreFields()

    return draft.value
  }

  function resetScore() {
    Object.assign(draft.value, {
      /*
       * Do not clear ownerId/scorerId here.
       *
       * Score configuration and authority are
       * different concerns.
       */
      startedAt: '',
      liveState: null,

      pointsA: 0,
      pointsB: 0,

      gamesA: 0,
      gamesB: 0,

      setsA: 0,
      setsB: 0,

      setScores: [],

      isTiebreak: false,
      isMatchTiebreak: false,

      pointHistory: [],

      over: false,
      winner: '',
    })
  }

  function endMatch(actorId = '') {
    if (!canFinalizeMatch(actorId)) {
      return null
    }

    /*
     * Completion must come from the scoring engine,
     * not merely from somebody pressing a UI button.
     */
    if (!draft.value.over || !draft.value.winner || !draft.value.liveState?.matchWinner) {
      return null
    }

    const finalLiveState = normalizeScoreboard(draft.value.liveState)

    /*
     * Undo snapshots are useful while playing.
     * They are not the historical match record.
     */
    finalLiveState.history = []

    finalLiveState.status = 'finished'

    finalLiveState.completedAt = finalLiveState.completedAt || new Date().toISOString()

    const playerAId = draft.value.ownerId || actorId

    const playerBId = draft.value.opponent?.id || ''

    /*
     * Never create an anonymous completed result.
     *
     * Later Laravel will perform the same identity
     * validation server-side.
     */
    if (!playerAId || !playerBId) {
      return null
    }

    const playerAName = finalLiveState.players?.playerA || 'Player 1'

    const playerBName = finalLiveState.players?.playerB || draft.value.opponent?.name || 'Opponent'

    const winnerId = finalLiveState.matchWinner === 'playerA' ? playerAId : playerBId

    const participantIds = [...new Set([playerAId, playerBId].filter(Boolean))]

    /*
     * Use the match/session id when possible so the
     * same completed match cannot accidentally create
     * several result records.
     */
    const sourceMatchId = draft.value.matchId || draft.value.ladderMatchId || createToken()

    const resultId = `result-${sourceMatchId}`

    const result = {
      resultVersion: 2,

      id: resultId,

      matchId: draft.value.matchId || '',

      challengeId: draft.value.challengeId || '',

      ladderMatchId: draft.value.ladderMatchId || '',

      matchType: draft.value.matchType || 'friendly',

      clubId: draft.value.clubId || '',

      status: 'completed',

      ownerId: draft.value.ownerId || playerAId,

      scorerId: draft.value.scorerId || '',

      scorerRevision: Number(draft.value.scorerRevision || 0),

      scorerHistory: Array.isArray(draft.value.scorerHistory)
        ? draft.value.scorerHistory.map((entry) => ({
            ...entry,
          }))
        : [],

      /*
       * Backend-ready access boundary.
       */
      participantIds,

      players: {
        playerA: {
          id: playerAId,
          name: playerAName,
        },

        playerB: {
          id: playerBId,
          name: playerBName,
        },
      },

      opponentId: playerBId,
      opponentName: playerBName,

      winner: draft.value.winner,

      winnerId,

      winnerName: winnerId === playerAId ? playerAName : playerBName,

      score: scoreSummary.value,

      setScores: draft.value.setScores.map((set) => ({
        ...set,

        tieBreak: set.tieBreak
          ? {
              ...set.tieBreak,
            }
          : null,
      })),

      scoring: draft.value.format,

      scoringFormat: formatLabel.value,

      matchFormat: draft.value.matchFormat,

      matchFormatLabel: matchFormatLabel.value,

      customFormat: draft.value.customFormat
        ? {
            ...draft.value.customFormat,
          }
        : null,

      startedAt: draft.value.startedAt || finalLiveState.startedAt || null,

      completedAt: finalLiveState.completedAt,

      finalizedBy: actorId,

      /*
       * This is the authoritative frontend snapshot
       * until Laravel becomes the server authority.
       */
      liveState: finalLiveState,
    }

    /*
     * Idempotent local commit.
     */
    results.value = [result, ...results.value.filter((existing) => existing.id !== result.id)]

    /*
     * Persist synchronously BEFORE routing away.
     *
     * This localStorage layer is today's frontend
     * stand-in for the future database transaction.
     */
    persist(RESULT_STORAGE_KEY, results.value)

    const invitation = activeInvitation.value

    if (invitation) {
      invitations.value = invitations.value.map((item) =>
        item.id === invitation.id
          ? {
              ...item,

              status: 'completed',

              completedAt: result.completedAt,

              updatedAt: result.completedAt,
            }
          : item,
      )

      persist(INVITATION_STORAGE_KEY, invitations.value)
    }

    /*
     * Critical lifecycle boundary:
     *
     * Close ONLY this live session.
     *
     * Do not overwrite DRAFT_STORAGE_KEY here.
     * Another tab may already be preparing the next
     * match for another court.
     */
    const completedLiveMatchId = activeLiveMatchId.value || resolveLiveMatchId(draft.value)

    if (completedLiveMatchId) {
      removeStored(liveMatchStorageKey(completedLiveMatchId))
    }

    activeLiveMatchId.value = ''

    /*
     * Prevent the deep watcher from writing this empty
     * local state into the shared setup key.
     */
    draftDetached.value = true

    draft.value = createDraft()

    return result
  }

  return {
    draft,
    liveMatchId,
    results,
    invitations,
    savedFormats,
    opponents: CLUB_OPPONENTS,
    ladderOpponents,
    currentLadderRank: CURRENT_LADDER_RANK,
    formatLabel,
    matchTypeLabel,
    matchFormatLabel,
    statusText,
    currentPointScore,
    scoreSummary,
    canUndo,
    activeInvitation,
    opponentReady,
    scheduleComplete,
    beginMatch,
    cancelActiveInvitation,
    chooseMatchType,
    applyLadderRules,
    chooseTiming,
    createPlayNowInvitation,
    chooseOpponent,
    setInvitationAudience,
    addOpponentToPlayNow,
    updateSchedule,
    chooseFormat,
    chooseMatchFormat,
    selectCustomFormat,
    saveCustomFormat,

    createScheduledInvitation,
    linkLadderRecords,
    startLiveMatch,
    attachCanonicalLiveMatch,
    applyLiveSessionProjection,
    listLiveMatchesForUser,
    subscribeToLiveMatchChanges,
    hasLiveMatch,
    loadLiveMatch,
    isCurrentLiveStorageKey,
    canManageMatch,
    canScoreMatch,
    transferScoringAuthority,
    reclaimScoringAuthority,
    emergencyOverrideScoringAuthority,

    pointLabel,
    recordPoint,
    undoPoint,
    refreshInvitations,
    invitationByToken,

    resultById,
    refreshResults,
    reportResultIssue,

    joinInvitation,
    setServer,
    toggleServer,

    refreshDraft,

    endMatch,
  }
})
