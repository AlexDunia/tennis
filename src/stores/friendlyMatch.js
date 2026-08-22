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
const DRAFT_STORAGE_KEY = 'gorra.friendlyMatchDraft.v4'
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
    matchId: '',
    challengeId: '',
    ladderMatchId: '',
    ladderConfigSnapshot: null,
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

function readArray(key) {
  if (typeof window === 'undefined' || !window.localStorage) return []
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function readDraft() {
  if (typeof window === 'undefined' || !window.localStorage) return createDraft()
  try {
    const stored = JSON.parse(window.localStorage.getItem(DRAFT_STORAGE_KEY) || 'null')
    if (!stored || typeof stored !== 'object') return createDraft()
    return {
      ...createDraft(),
      ...stored,
      schedule: { ...createDraft().schedule, ...(stored.schedule || {}) },
      customFormat: stored.customFormat ? normalizeCustomFormat(stored.customFormat) : null,
      setScores: Array.isArray(stored.setScores) ? stored.setScores : [],
      pointHistory: Array.isArray(stored.pointHistory) ? stored.pointHistory : [],
    }
  } catch {
    return createDraft()
  }
}

function engineConfigForDraft(value) {
  const rules = rulesForDraft(value)

  const useDecidingMatchTieBreak =
    value.matchType === 'ladder' &&
    (value.ladderConfigSnapshot?.matchPreset === 'time-smart' ||
      value.ladderConfigSnapshot?.decidingMatchTieBreak === true)

  return {
    mode: rules.mode,

    scoring: value.format === 'noad' ? 'noad' : 'ad',

    setsToWin: rules.setsToWin,

    /*
     * Gorra's existing custom-format model stores
     * setsToWin rather than bestOfSets.
     *
     * Convert it once here instead of teaching the
     * tennis engine about FriendlyMatchStore.
     */
    bestOfSets: rules.mode === 'sets' ? Math.max(1, rules.setsToWin * 2 - 1) : 1,

    gamesPerSet: rules.gamesPerSet,

    tieBreakAt: rules.tieBreakAt,

    tieBreakPoints: rules.tieBreakPoints,

    decidingMatchTieBreak: useDecidingMatchTieBreak,

    decidingTieBreakPoints: 10,
  }
}

function persist(key, value) {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(key, JSON.stringify(value))
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

function clampInteger(value, minimum, maximum, fallback) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback
}

function normalizeCustomFormat(format = {}) {
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
  const draft = ref(readDraft())
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

  const formatLabel = computed(() => (draft.value.format === 'noad' ? 'No-Ad' : 'Advantage'))
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

  watch(draft, (value) => persist(DRAFT_STORAGE_KEY, value), { deep: true })
  watch(results, (value) => persist(RESULT_STORAGE_KEY, value), { deep: true })
  watch(invitations, (value) => persist(INVITATION_STORAGE_KEY, value), { deep: true })
  watch(savedFormats, (value) => persist(CUSTOM_FORMAT_STORAGE_KEY, value), { deep: true })

  function canManageMatch(actorId = '') {
    return Boolean(actorId && draft.value.ownerId && actorId === draft.value.ownerId)
  }

  function canScoreMatch(actorId = '') {
    return Boolean(actorId && draft.value.scorerId && actorId === draft.value.scorerId)
  }

  function canFinalizeMatch(actorId = '') {
    return canManageMatch(actorId) || canScoreMatch(actorId)
  }

  function cancelActiveInvitation() {
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
  }

  function beginMatch() {
    /*
     * A new match is a hard lifecycle boundary.
     *
     * No opponent, invitation, live score, old result
     * state or previous match session is allowed to
     * leak into the next match.
     */
    cancelActiveInvitation()

    draft.value = createDraft()

    /*
     * Persist immediately rather than waiting for the
     * deep watcher.
     *
     * This is today's frontend equivalent of beginning
     * a fresh server-side match session.
     */
    persist(DRAFT_STORAGE_KEY, draft.value)
    persist(INVITATION_STORAGE_KEY, invitations.value)

    return draft.value
  }

  function chooseMatchType(matchType) {
    if (!['friendly', 'ladder'].includes(matchType)) {
      return false
    }

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
    if (changed) resetScore()
  }

  function chooseMatchFormat(matchFormat) {
    if (!['best-of-3', 'one-set', 'match-tiebreak'].includes(matchFormat)) return
    const changed = draft.value.matchFormat !== matchFormat || Boolean(draft.value.customFormat)
    draft.value.matchFormat = matchFormat
    draft.value.customFormat = null
    if (changed) resetScore()
  }

  function selectCustomFormat(format) {
    const normalized = normalizeCustomFormat(format)
    const changed =
      draft.value.matchFormat !== 'custom' ||
      JSON.stringify(draft.value.customFormat) !== JSON.stringify(normalized)
    draft.value.matchFormat = 'custom'
    draft.value.customFormat = normalized
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

  function startLiveMatch(actorId = '') {
    if (!actorId) {
      return false
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
      draft.value.scorerId = actorId
    }

    const startedAt = draft.value.startedAt || new Date().toISOString()

    const creatorName = activeInvitation.value?.creator?.name || 'You'

    const opponentName = draft.value.opponent?.name || 'Opponent'

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

        config: engineConfigForDraft(draft.value),

        startedAt,
        status: 'live',
      })
    } else {
      draft.value.liveState = createScoreboard({
        players: {
          playerA: creatorName,
          playerB: opponentName,
        },

        config: engineConfigForDraft(draft.value),

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
    persist(DRAFT_STORAGE_KEY, draft.value)
    persist(INVITATION_STORAGE_KEY, invitations.value)

    return true
  }

  function linkLadderRecords(challenge, match = null) {
    draft.value.challengeId = challenge?.id || draft.value.challengeId

    draft.value.ladderMatchId = match?.id || draft.value.ladderMatchId

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

  function refreshDraft() {
    const stored = readDraft()

    const currentRevision = Number(draft.value.liveState?.revision || 0)

    const storedRevision = Number(stored.liveState?.revision || 0)

    /*
     * Never let an older tab overwrite a newer
     * in-memory score merely because a storage
     * event arrived late.
     */
    if (draft.value.liveState && stored.liveState && storedRevision < currentRevision) {
      return draft.value
    }

    draft.value = stored

    if (draft.value.liveState) {
      syncLegacyScoreFields()
    }

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
      resultVersion: 1,

      id: resultId,

      matchId: draft.value.matchId || '',

      challengeId: draft.value.challengeId || '',

      ladderMatchId: draft.value.ladderMatchId || '',

      matchType: draft.value.matchType || 'friendly',

      status: 'completed',

      ownerId: draft.value.ownerId || playerAId,

      scorerId: draft.value.scorerId || '',

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
     * The live session is now CLOSED.
     *
     * Result data lives in `results`.
     * It must no longer live inside the active draft.
     */
    draft.value = createDraft()

    persist(DRAFT_STORAGE_KEY, draft.value)

    return result
  }

  return {
    draft,
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
    refreshInvitations,
    invitationByToken,
    resultById,
    joinInvitation,
    createScheduledInvitation,
    linkLadderRecords,
    startLiveMatch,
    refreshResults,
    canManageMatch,
    canScoreMatch,

    pointLabel,
    recordPoint,
    undoPoint,

    setServer,
    toggleServer,

    refreshDraft,

    endMatch,
  }
})
