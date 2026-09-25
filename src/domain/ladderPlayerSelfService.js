const clean = (value) => String(value ?? '').trim()

export const LADDER_SELF_SERVICE_ACTIVE_STATUSES = Object.freeze([
  'awaiting',
  'accepted',
  'scheduled',
  'ready',
  'live',
  'pending_review',
])

const STATUS_ORDER = Object.freeze({
  live: 0,
  ready: 1,
  scheduled: 2,
  accepted: 3,
  awaiting: 4,
  pending_review: 5,
})

function ladderIdOf(record) {
  return clean(record?.ladderId || record?.ladderConfigSnapshot?.id)
}

function clubIdOf(record) {
  return clean(record?.clubId || record?.ladderConfigSnapshot?.clubId)
}

function isLadderRecord(record) {
  const type = clean(record?.type || record?.source).toLowerCase()
  if (type) return type === 'ladder'
  return Boolean(ladderIdOf(record))
}

function inScope(record, { clubId, ladderId }) {
  const recordLadderId = ladderIdOf(record)
  const recordClubId = clubIdOf(record)
  return Boolean(
    isLadderRecord(record) &&
      ladderId &&
      recordLadderId === ladderId &&
      (!clubId || recordClubId === clubId),
  )
}

function isParticipant(challenge, playerId) {
  return [challenge?.challengerId, challenge?.defenderId].some((id) => clean(id) === playerId)
}

function scheduleTime(entry) {
  const value = entry?.match?.scheduledAt || entry?.challenge?.scheduledAt || ''
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY
}

export function getLadderSelfServiceAssignments({ challenges = [], matches = [], clubId = '', ladderId = '', playerId = '' } = {}) {
  const scope = { clubId: clean(clubId), ladderId: clean(ladderId) }
  const actor = clean(playerId)
  if (!scope.ladderId || !actor) return []
  const scopedChallenges = (Array.isArray(challenges) ? challenges : [])
    .filter((challenge) => inScope(challenge, scope))
    .filter((challenge) => LADDER_SELF_SERVICE_ACTIVE_STATUSES.includes(challenge.status))
    .filter((challenge) => isParticipant(challenge, actor))
  const scopedChallengeIds = new Set(scopedChallenges.map((challenge) => clean(challenge.id)).filter(Boolean))
  const canonicalMatches = new Map()
  ;(Array.isArray(matches) ? matches : []).forEach((match) => {
    const challengeId = clean(match?.challengeId)
    const matchClubId = clubIdOf(match)
    const matchLadderId = ladderIdOf(match)
    if (
      !challengeId ||
      !scopedChallengeIds.has(challengeId) ||
      !isLadderRecord(match) ||
      canonicalMatches.has(challengeId) ||
      (matchClubId && matchClubId !== scope.clubId) ||
      (matchLadderId && matchLadderId !== scope.ladderId)
    ) return
    canonicalMatches.set(challengeId, match)
  })
  return scopedChallenges
    .map((challenge) => ({
      challenge,
      match: canonicalMatches.get(clean(challenge.id)) || null,
      status: clean(challenge.status),
    }))
    .sort((left, right) => {
      const statusDifference = (STATUS_ORDER[left.status] ?? 99) - (STATUS_ORDER[right.status] ?? 99)
      if (statusDifference) return statusDifference
      const scheduleDifference = scheduleTime(left) - scheduleTime(right)
      if (scheduleDifference) return scheduleDifference
      return clean(left.challenge?.id).localeCompare(clean(right.challenge?.id))
    })
}

export function getLadderSelfServiceDestination({ challenge, match, actorId } = {}) {
  const challengeId = clean(challenge?.id)
  const matchId = clean(match?.id)
  const actor = clean(actorId)
  const status = clean(match?.status || challenge?.status)
  if (!challengeId || !actor || !isParticipant(challenge, actor)) return null
  if (status === 'live' && matchId) {
    return clean(match?.scorerId) === actor
      ? { name: 'LiveMatch', params: { matchId } }
      : { name: 'LiveScoreboard', params: { matchId } }
  }
  if (['ready', 'scheduled', 'accepted'].includes(status) && matchId) {
    return { name: 'MatchDetails', params: { matchId } }
  }
  if (status === 'pending_review' || ['awaiting', 'accepted'].includes(status)) {
    return { name: 'ChallengeDetails', params: { challengeId } }
  }
  return null
}

export function getLadderSelfServiceActionLabel({ challenge, match, actorId } = {}) {
  const destination = getLadderSelfServiceDestination({ challenge, match, actorId })
  const status = clean(match?.status || challenge?.status)
  if (!destination) return ''
  if (status === 'live') return destination.name === 'LiveMatch' ? 'Resume scoring' : 'View live score'
  if (status === 'ready') return 'Open ready match'
  if (status === 'scheduled') return 'View scheduled match'
  if (status === 'pending_review') return 'Review result'
  if (status === 'accepted' && match?.id) return 'View challenge'
  if (status === 'accepted') return 'Continue challenge'
  if (status === 'awaiting') return 'View challenge'
  return ''
}