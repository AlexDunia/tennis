export const PLAY_MATCH_ACTIONS = Object.freeze({
  VIEW_MATCH: 'view_match',
  START_MATCH: 'start_match',
  RESUME_SCORING: 'resume_scoring',
  VIEW_LIVE_SCORE: 'view_live_score',
  OPEN_MATCH_CONTROL: 'open_match_control',
  RESCHEDULE: 'reschedule',
  CANCEL: 'cancel',
})

export const PLAY_OPERATIONAL_STATUSES = Object.freeze([
  'accepted', 'scheduled', 'ready', 'live', 'pending_review',
])

const clean = (value) => String(value || '').trim()

export function matchParticipantIds(match = {}) {
  return [...new Set([
    match.challengerId, match.defenderId, match.player1Id, match.player2Id,
  ].map(clean).filter(Boolean))]
}

export function isMatchParticipant(match, actorId) {
  return matchParticipantIds(match).includes(clean(actorId))
}

export function playMatchClubId(match = {}) { return clean(match.clubId) }
export function playMatchLadderId(match = {}) {
  return clean(match.ladderId || match.ladderConfigSnapshot?.id)
}

export function playMatchBelongsToActiveClub(match, activeClubId) {
  const matchClubId = playMatchClubId(match)
  const clubId = clean(activeClubId)
  return matchClubId ? Boolean(clubId && matchClubId === clubId) : true
}

export function isOperationalPlayMatch(match, { actorId = '', activeClubId = '', canManage = false } = {}) {
  if (clean(match?.type) !== 'ladder') return false
  if (!PLAY_OPERATIONAL_STATUSES.includes(clean(match.status))) return false
  if (!playMatchBelongsToActiveClub(match, activeClubId)) return false
  return isMatchParticipant(match, actorId) || Boolean(canManage)
}

const action = (id, label, tone = 'secondary') => ({ id, label, tone })

export function getPlayMatchActions(match, { actorId = '', canManage = false, canLiveControl = false } = {}) {
  const participant = isMatchParticipant(match, actorId)
  const scorer = clean(match?.scorerId) === clean(actorId)
  const status = clean(match?.status)
  if (status === 'scheduled') return canManage
    ? [action(PLAY_MATCH_ACTIONS.VIEW_MATCH, 'View match'), action(PLAY_MATCH_ACTIONS.RESCHEDULE, 'Reschedule'), action(PLAY_MATCH_ACTIONS.CANCEL, 'Cancel', 'danger')]
    : participant ? [action(PLAY_MATCH_ACTIONS.VIEW_MATCH, 'View match')] : []
  if (status === 'ready') return participant
    ? [action(PLAY_MATCH_ACTIONS.START_MATCH, 'Start match', 'primary'), action(PLAY_MATCH_ACTIONS.VIEW_MATCH, 'View match')]
    : canManage ? [action(PLAY_MATCH_ACTIONS.VIEW_MATCH, 'View match'), action(PLAY_MATCH_ACTIONS.RESCHEDULE, 'Reschedule'), action(PLAY_MATCH_ACTIONS.CANCEL, 'Cancel', 'danger')] : []
  if (status === 'live') {
    if (scorer) return [action(PLAY_MATCH_ACTIONS.RESUME_SCORING, 'Resume scoring', 'primary'), action(PLAY_MATCH_ACTIONS.VIEW_MATCH, 'View match')]
    if (participant) return [action(PLAY_MATCH_ACTIONS.VIEW_LIVE_SCORE, 'View live score', 'primary'), action(PLAY_MATCH_ACTIONS.VIEW_MATCH, 'View match')]
    if (canManage && canLiveControl) return [action(PLAY_MATCH_ACTIONS.VIEW_LIVE_SCORE, 'View live score', 'primary'), action(PLAY_MATCH_ACTIONS.OPEN_MATCH_CONTROL, 'Open match control'), action(PLAY_MATCH_ACTIONS.VIEW_MATCH, 'View match')]
  }
  return ['accepted', 'pending_review'].includes(status) ? [action(PLAY_MATCH_ACTIONS.VIEW_MATCH, 'View match')] : []
}

const rank = { live: 0, ready: 1, scheduled: 2, accepted: 3, pending_review: 4 }
export function compareOperationalPlayMatches(a, b) {
  const priority = (rank[clean(a?.status)] ?? 99) - (rank[clean(b?.status)] ?? 99)
  if (priority) return priority
  const left = new Date(a?.scheduledAt || a?.createdAt || a?.requestedAt || 0).getTime()
  const right = new Date(b?.scheduledAt || b?.createdAt || b?.requestedAt || 0).getTime()
  return left - right || clean(a?.id).localeCompare(clean(b?.id))
}