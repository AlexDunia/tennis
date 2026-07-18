import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  getActiveLadderConfig,
  isEligibleLadderOpponent,
  ladderMatchConfig,
} from '../config/ladder'

const RESULT_STORAGE_KEY = 'gorra.friendlyMatchResults.v1'
const DRAFT_STORAGE_KEY = 'gorra.friendlyMatchDraft.v3'
const INVITATION_STORAGE_KEY = 'gorra.friendlyMatchInvitations.v1'
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
  const opponentReady = computed(
    () =>
      activeInvitation.value?.status === 'ready' && Boolean(activeInvitation.value.opponent?.id),
  )
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

  function beginMatch() {
    if (
      activeInvitation.value &&
      ['waiting_for_opponent', 'ready'].includes(activeInvitation.value.status)
    ) {
      activeInvitation.value.status = 'cancelled'
      activeInvitation.value.cancelledAt = new Date().toISOString()
    }
    draft.value = createDraft()
  }

  function chooseMatchType(matchType) {
    if (!['friendly', 'ladder'].includes(matchType)) return
    if (draft.value.matchType !== matchType) draft.value = { ...createDraft(), matchType }
    else draft.value.matchType = matchType
    if (matchType === 'ladder') applyLadderRules()
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
    if (!['now', 'later'].includes(timing)) return null
    draft.value.timing = timing
    draft.value.ownerId = normalizeIdentity(creator).id
    draft.value.opponent = null
    draft.value.status = 'draft'
    if (timing === 'later') {
      draft.value.matchId = ''
      draft.value.joinToken = ''
      return null
    }
    return createPlayNowInvitation(creator)
  }

  function createPlayNowInvitation(creator) {
    if (
      activeInvitation.value &&
      ['waiting_for_opponent', 'ready'].includes(activeInvitation.value.status)
    )
      return activeInvitation.value
    const now = Date.now()
    const token = createToken()
    const invitation = {
      id: `${draft.value.matchType || 'friendly'}-${now}-${token.slice(0, 6)}`,
      token,
      type: draft.value.matchType || 'friendly',
      timing: 'now',
      status: 'waiting_for_opponent',
      creator: normalizeIdentity(creator),
      opponent: null,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + PLAY_NOW_TTL_MS).toISOString(),
    }
    invitations.value = [invitation, ...invitations.value]
    draft.value.matchId = invitation.id
    draft.value.joinToken = token
    draft.value.status = invitation.status
    return invitation
  }

  function chooseOpponent(opponent) {
    draft.value.opponent = opponent ? normalizeIdentity(opponent) : null
  }

  function addOpponentToPlayNow(opponent) {
    const invitation = activeInvitation.value
    if (!invitation || !['waiting_for_opponent', 'ready'].includes(invitation.status)) return null
    const identity = normalizeIdentity(opponent)
    if (!identity.id || identity.id === invitation.creator?.id) return null
    if (invitation.type === 'ladder' && !isEligibleLadderOpponent(invitation.creator, identity))
      return null
    invitation.opponent = identity
    invitation.status = 'ready'
    invitation.joinedAt = new Date().toISOString()
    invitations.value = invitations.value.map((item) =>
      item.id === invitation.id ? { ...invitation } : item,
    )
    draft.value.opponent = identity
    draft.value.status = 'ready'
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
      return { ok: false, message: 'This invitation belongs to the player who created the match.' }
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
    invitations.value = invitations.value.map((item) =>
      item.id === invitation.id ? { ...invitation } : item,
    )
    if (draft.value.matchId === invitation.id) {
      draft.value.opponent = actor
      draft.value.status = 'ready'
    }
    return { ok: true, invitation }
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
    if (draft.value.ownerId && actorId !== draft.value.ownerId) return false
    if (!draft.value.opponent || !draft.value.format) return false
    if (
      draft.value.timing === 'now' &&
      (!activeInvitation.value || !['ready', 'live'].includes(activeInvitation.value.status))
    )
      return false
    draft.value.status = 'live'
    if (activeInvitation.value) {
      activeInvitation.value.status = 'live'
      activeInvitation.value.startedAt = new Date().toISOString()
    }
    return true
  }

  function linkLadderRecords(challenge, match = null) {
    draft.value.challengeId = challenge?.id || draft.value.challengeId
    draft.value.ladderMatchId = match?.id || draft.value.ladderMatchId
    draft.value.preMatchPositions = challenge?.preMatchPositions || {
      challenger: Number(challenge?.challengerRank || 0) || null,
      defender: Number(challenge?.defenderRank || 0) || null,
    }
    if (challenge?.status) draft.value.status = challenge.status
  }

  function pointLabel(side) {
    const own = side === 'you' ? draft.value.pointsA : draft.value.pointsB
    const other = side === 'you' ? draft.value.pointsB : draft.value.pointsA
    if (draft.value.over) return draft.value.winner === side ? 'Won' : 'Match'
    if (draft.value.isTiebreak || currentRules.value.mode === 'tiebreak') return String(own)
    if (draft.value.format === 'ad' && own >= 3 && other >= 3) {
      if (own === other) return '40'
      if (own === other + 1) return 'Ad'
      if (other === own + 1) return '40'
    }
    return ['Love', '15', '30', '40'][Math.min(own, 3)]
  }

  function snapshotScore() {
    return {
      pointsA: draft.value.pointsA,
      pointsB: draft.value.pointsB,
      gamesA: draft.value.gamesA,
      gamesB: draft.value.gamesB,
      setsA: draft.value.setsA,
      setsB: draft.value.setsB,
      setScores: draft.value.setScores.map((set) => ({ ...set })),
      isTiebreak: draft.value.isTiebreak,
      isMatchTiebreak: draft.value.isMatchTiebreak,
      over: draft.value.over,
      winner: draft.value.winner,
      status: draft.value.status,
    }
  }

  function awardSet(side, a, b) {
    draft.value.setScores.push({ a, b })
    if (side === 'you') draft.value.setsA += 1
    else draft.value.setsB += 1

    draft.value.gamesA = a
    draft.value.gamesB = b
    const targetSets = currentRules.value.setsToWin
    const winnerSets = side === 'you' ? draft.value.setsA : draft.value.setsB
    if (winnerSets >= targetSets) {
      draft.value.over = true
      draft.value.winner = side
      draft.value.status = 'finished'
      return
    }

    draft.value.gamesA = 0
    draft.value.gamesB = 0
    draft.value.pointsA = 0
    draft.value.pointsB = 0
    draft.value.isTiebreak = false
    draft.value.isMatchTiebreak = false

    if (
      draft.value.matchType === 'ladder' &&
      draft.value.ladderConfigSnapshot?.matchPreset === 'time-smart' &&
      draft.value.setsA === 1 &&
      draft.value.setsB === 1
    ) {
      draft.value.isTiebreak = true
      draft.value.isMatchTiebreak = true
    }
  }

  function recordPoint(side, actorId = '') {
    if (draft.value.ownerId && actorId !== draft.value.ownerId) return false
    if (draft.value.status !== 'live') return false
    if (draft.value.over || !['you', 'opponent'].includes(side)) return false
    draft.value.pointHistory.push(snapshotScore())
    if (side === 'you') draft.value.pointsA += 1
    else draft.value.pointsB += 1
    const own = side === 'you' ? draft.value.pointsA : draft.value.pointsB
    const other = side === 'you' ? draft.value.pointsB : draft.value.pointsA

    const rules = currentRules.value
    if (rules.mode === 'tiebreak') {
      if (own >= rules.tieBreakPoints && own - other >= 2) {
        draft.value.setScores = [{ a: draft.value.pointsA, b: draft.value.pointsB }]
        draft.value.setsA = side === 'you' ? 1 : 0
        draft.value.setsB = side === 'opponent' ? 1 : 0
        draft.value.over = true
        draft.value.winner = side
        draft.value.status = 'finished'
      }
      return true
    }

    if (draft.value.isTiebreak) {
      const tieBreakTarget = draft.value.isMatchTiebreak ? 10 : rules.tieBreakPoints
      if (own >= tieBreakTarget && own - other >= 2) {
        if (draft.value.isMatchTiebreak) {
          awardSet(side, draft.value.pointsA, draft.value.pointsB)
          return true
        }
        const winningGames = rules.tieBreakAt + 1
        awardSet(
          side,
          side === 'you' ? winningGames : rules.tieBreakAt,
          side === 'you' ? rules.tieBreakAt : winningGames,
        )
      }
      return true
    }

    const margin = draft.value.format === 'noad' ? 1 : 2
    if (own < 4 || own - other < margin) return true
    if (side === 'you') draft.value.gamesA += 1
    else draft.value.gamesB += 1
    draft.value.pointsA = 0
    draft.value.pointsB = 0
    const gamesOwn = side === 'you' ? draft.value.gamesA : draft.value.gamesB
    const gamesOther = side === 'you' ? draft.value.gamesB : draft.value.gamesA
    if (gamesOwn >= rules.gamesPerSet && gamesOwn - gamesOther >= 2) {
      awardSet(side, draft.value.gamesA, draft.value.gamesB)
    } else if (
      rules.tieBreakAt > 0 &&
      draft.value.gamesA === rules.tieBreakAt &&
      draft.value.gamesB === rules.tieBreakAt
    ) {
      draft.value.isTiebreak = true
    }
    return true
  }

  function undoPoint(actorId = '') {
    if (draft.value.ownerId && actorId !== draft.value.ownerId) return false
    const previous = draft.value.pointHistory.pop()
    if (!previous) return false
    Object.assign(draft.value, previous)
    draft.value.status = previous.status || (previous.over ? 'finished' : 'live')
    return true
  }

  function resetScore() {
    Object.assign(draft.value, {
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
    if (draft.value.ownerId && actorId !== draft.value.ownerId) return null
    if (!draft.value.over || !['you', 'opponent'].includes(draft.value.winner)) return null
    const opponentName = draft.value.opponent?.name || 'Opponent'
    const score = scoreSummary.value
    let summary = `${matchTypeLabel.value} with ${opponentName} ended, ${score}`
    if (draft.value.winner === 'you') summary = `You beat ${opponentName}, ${score}`
    else if (draft.value.winner === 'opponent') summary = `${opponentName} beat you, ${score}`
    const result = {
      id: draft.value.matchId || `match-result-${Date.now()}`,
      opponent: opponentName,
      opponentId: draft.value.opponent?.id || null,
      matchType: draft.value.matchType,
      matchTypeLabel: matchTypeLabel.value,
      format: currentRules.value.mode === 'tiebreak' ? 'Win by two' : formatLabel.value,
      matchFormat: draft.value.matchFormat,
      customFormat: draft.value.customFormat ? { ...draft.value.customFormat } : null,
      matchFormatLabel: matchFormatLabel.value,
      score,
      setScores: draft.value.setScores.map((set) => ({ ...set })),
      pointsA: draft.value.pointsA,
      pointsB: draft.value.pointsB,
      winner: draft.value.winner,
      summary,
      status: 'completed',
      completedAt: new Date().toISOString(),
    }
    results.value = [result, ...results.value]
    if (activeInvitation.value) {
      activeInvitation.value.status = 'completed'
      activeInvitation.value.completedAt = result.completedAt
    }
    draft.value = createDraft()
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
    chooseMatchType,
    applyLadderRules,
    chooseTiming,
    createPlayNowInvitation,
    chooseOpponent,
    addOpponentToPlayNow,
    updateSchedule,
    chooseFormat,
    chooseMatchFormat,
    selectCustomFormat,
    saveCustomFormat,
    refreshInvitations,
    invitationByToken,
    joinInvitation,
    createScheduledInvitation,
    linkLadderRecords,
    startLiveMatch,
    pointLabel,
    recordPoint,
    undoPoint,
    endMatch,
  }
})
