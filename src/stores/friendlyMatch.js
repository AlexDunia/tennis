import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

const RESULT_STORAGE_KEY = 'gorra.friendlyMatchResults.v1'
const DRAFT_STORAGE_KEY = 'gorra.friendlyMatchDraft.v2'
const INVITATION_STORAGE_KEY = 'gorra.friendlyMatchInvitations.v1'
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
export const LADDER_ELIGIBLE_OPPONENTS = Object.freeze(
  CLUB_OPPONENTS.filter(
    (player) =>
      player.rank && player.rank < CURRENT_LADDER_RANK && CURRENT_LADDER_RANK - player.rank <= 3,
  ),
)

function createDraft() {
  return {
    matchType: '',
    timing: '',
    opponent: null,
    format: '',
    matchFormat: 'best-of-3',
    tieBreak: '6-6',
    schedule: { date: '', time: '', court: '' },
    matchId: '',
    joinToken: '',
    ownerId: '',
    status: 'draft',
    pointsA: 0,
    pointsB: 0,
    pointHistory: [],
    over: false,
    winner: '',
  }
}

function readArray(key) {
  if (typeof window === 'undefined' || !window.localStorage) return []
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) || '[]')
    return Array.isArray(stored) ? stored : []
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

export const useFriendlyMatchStore = defineStore('friendlyMatch', () => {
  const draft = ref(readDraft())
  const results = ref(readArray(RESULT_STORAGE_KEY))
  const invitations = ref(readArray(INVITATION_STORAGE_KEY))

  const formatLabel = computed(() => (draft.value.format === 'noad' ? 'No-Ad' : 'Advantage'))
  const matchTypeLabel = computed(() =>
    draft.value.matchType === 'ladder' ? 'Ladder challenge' : 'Friendly match',
  )
  const canUndo = computed(() => draft.value.pointHistory.length > 0)
  const activeInvitation = computed(
    () => invitations.value.find((item) => item.id === draft.value.matchId) || null,
  )
  const opponentReady = computed(
    () =>
      activeInvitation.value?.status === 'ready' && Boolean(activeInvitation.value.opponent?.id),
  )
  const scheduleComplete = computed(() =>
    Boolean(draft.value.opponent && draft.value.schedule.date && draft.value.schedule.time),
  )

  const statusText = computed(() => {
    const { pointsA, pointsB, format, over, winner } = draft.value
    const opponentName = draft.value.opponent?.name || 'Opponent'
    if (over) return winner === 'you' ? 'You win the game' : `${opponentName} wins the game`
    if (pointsA >= 3 && pointsB >= 3) {
      if (format === 'noad' && pointsA === pointsB) return 'Deciding point'
      if (format === 'ad' && pointsA === pointsB) return 'Deuce'
      if (format === 'ad' && Math.abs(pointsA - pointsB) === 1) {
        return `Advantage — ${pointsA > pointsB ? 'You' : opponentName}`
      }
    }
    return `${pointLabel('you')} – ${pointLabel('opponent')}`
  })

  watch(draft, (value) => persist(DRAFT_STORAGE_KEY, value), { deep: true })
  watch(results, (value) => persist(RESULT_STORAGE_KEY, value), { deep: true })
  watch(invitations, (value) => persist(INVITATION_STORAGE_KEY, value), { deep: true })

  function beginMatch() {
    const pending = activeInvitation.value
    if (pending && ['waiting_for_opponent', 'ready'].includes(pending.status)) {
      pending.status = 'cancelled'
      pending.cancelledAt = new Date().toISOString()
    }
    draft.value = createDraft()
  }

  function chooseMatchType(matchType) {
    if (!['friendly', 'ladder'].includes(matchType)) return
    if (draft.value.matchType !== matchType) {
      draft.value.opponent = null
      draft.value.timing = ''
      draft.value.matchId = ''
      draft.value.joinToken = ''
      draft.value.schedule = { date: '', time: '', court: '' }
    }
    draft.value.matchType = matchType
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
    const existing = activeInvitation.value
    if (existing && ['waiting_for_opponent', 'ready'].includes(existing.status)) return existing
    const now = Date.now()
    const token = createToken()
    const invitation = {
      id: `friendly-${now}-${token.slice(0, 6)}`,
      token,
      type: 'friendly',
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

  function updateSchedule(field, value) {
    if (['date', 'time', 'court'].includes(field)) draft.value.schedule[field] = String(value || '')
  }

  function chooseFormat(format) {
    if (!['ad', 'noad'].includes(format)) return
    const changed = draft.value.format !== format
    draft.value.format = format
    if (changed) resetScore()
  }

  function refreshInvitations() {
    const now = Date.now()
    invitations.value = readArray(INVITATION_STORAGE_KEY).map((invitation) => {
      if (
        invitation.status === 'waiting_for_opponent' &&
        invitation.expiresAt &&
        new Date(invitation.expiresAt).getTime() <= now
      ) {
        return { ...invitation, status: 'expired' }
      }
      return invitation
    })
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
    invitation.opponent = actor
    invitation.status = 'ready'
    invitation.joinedAt = new Date().toISOString()
    invitations.value = invitations.value.map((item) =>
      item.id === invitation.id ? { ...invitation } : item,
    )
    if (draft.value.matchId === invitation.id) {
      draft.value.opponent = { ...actor }
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
      type: 'friendly',
      timing: 'later',
      status: 'waiting_for_acceptance',
      creator: creatorIdentity,
      opponent: normalizeIdentity(draft.value.opponent),
      schedule: { ...draft.value.schedule },
      scoring: draft.value.format,
      matchFormat: draft.value.matchFormat,
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
    draft.value.status = 'live'
    if (activeInvitation.value) {
      activeInvitation.value.status = 'live'
      activeInvitation.value.startedAt = new Date().toISOString()
    }
    return true
  }

  function pointLabel(side) {
    const ownPoints = side === 'you' ? draft.value.pointsA : draft.value.pointsB
    const otherPoints = side === 'you' ? draft.value.pointsB : draft.value.pointsA
    if (draft.value.over) return draft.value.winner === side ? 'Won' : 'Game'
    if (draft.value.format === 'ad' && ownPoints >= 3 && otherPoints >= 3) {
      if (ownPoints === otherPoints) return '40'
      if (ownPoints === otherPoints + 1) return 'Ad'
      if (otherPoints === ownPoints + 1) return '40'
    }
    return ['Love', '15', '30', '40'][Math.min(ownPoints, 3)]
  }

  function recordPoint(side, actorId = '') {
    if (draft.value.ownerId && actorId !== draft.value.ownerId) return
    if (draft.value.over || !['you', 'opponent'].includes(side)) return
    draft.value.pointHistory.push({
      pointsA: draft.value.pointsA,
      pointsB: draft.value.pointsB,
      over: draft.value.over,
      winner: draft.value.winner,
    })
    if (side === 'you') draft.value.pointsA += 1
    else draft.value.pointsB += 1
    const ownPoints = side === 'you' ? draft.value.pointsA : draft.value.pointsB
    const otherPoints = side === 'you' ? draft.value.pointsB : draft.value.pointsA
    const margin = draft.value.format === 'noad' ? 1 : 2
    if (ownPoints >= 4 && ownPoints - otherPoints >= margin) {
      draft.value.over = true
      draft.value.winner = side
    }
  }

  function undoPoint(actorId = '') {
    if (draft.value.ownerId && actorId !== draft.value.ownerId) return
    const previous = draft.value.pointHistory.pop()
    if (!previous) return
    draft.value.pointsA = previous.pointsA
    draft.value.pointsB = previous.pointsB
    draft.value.over = previous.over
    draft.value.winner = previous.winner
  }

  function resetScore() {
    draft.value.pointsA = 0
    draft.value.pointsB = 0
    draft.value.pointHistory = []
    draft.value.over = false
    draft.value.winner = ''
  }

  function endMatch(actorId = '') {
    if (draft.value.ownerId && actorId !== draft.value.ownerId) return null
    const opponentName = draft.value.opponent?.name || 'Opponent'
    const yourScore = draft.value.pointsA
    const opponentScore = draft.value.pointsB
    const winnerScore = Math.max(yourScore, opponentScore)
    const loserScore = Math.min(yourScore, opponentScore)
    let summary = `${matchTypeLabel.value} with ${opponentName} ended, ${yourScore}–${opponentScore}`
    if (draft.value.winner === 'you')
      summary = `You beat ${opponentName}, ${winnerScore}–${loserScore}`
    else if (draft.value.winner === 'opponent')
      summary = `${opponentName} beat you, ${winnerScore}–${loserScore}`
    const result = {
      id: draft.value.matchId || `match-result-${Date.now()}`,
      opponent: opponentName,
      opponentId: draft.value.opponent?.id || null,
      matchType: draft.value.matchType,
      matchTypeLabel: matchTypeLabel.value,
      format: formatLabel.value,
      matchFormat: draft.value.matchFormat,
      pointsA: yourScore,
      pointsB: opponentScore,
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
    opponents: CLUB_OPPONENTS,
    ladderOpponents: LADDER_ELIGIBLE_OPPONENTS,
    currentLadderRank: CURRENT_LADDER_RANK,
    formatLabel,
    matchTypeLabel,
    statusText,
    canUndo,
    activeInvitation,
    opponentReady,
    scheduleComplete,
    beginMatch,
    chooseMatchType,
    chooseTiming,
    createPlayNowInvitation,
    chooseOpponent,
    updateSchedule,
    chooseFormat,
    refreshInvitations,
    invitationByToken,
    joinInvitation,
    createScheduledInvitation,
    startLiveMatch,
    pointLabel,
    recordPoint,
    undoPoint,
    endMatch,
  }
})
