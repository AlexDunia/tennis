import {
  challengeViewState,
  isChallengeParticipant,
  TERMINAL_CHALLENGE_STATUSES,
} from '../utils/challenge/challengeLifecycle.js'

export const PERSONAL_PLAY_ACTIONS = Object.freeze({
  VIEW_CHALLENGE: 'view_challenge',
  ACCEPT_CHALLENGE: 'accept_challenge',
  DECLINE_CHALLENGE: 'decline_challenge',
  SCHEDULE_MATCH: 'schedule_match',
  VIEW_MATCH: 'view_match',
  START_MATCH: 'start_match',
  RESUME_SCORING: 'resume_scoring',
  VIEW_LIVE_SCORE: 'view_live_score',
  REVIEW_RESULT: 'review_result',
  CONTINUE_NON_LADDER: 'continue_non_ladder',
})

export const PERSONAL_PLAY_GROUPS = Object.freeze({
  NOW: 'now',
  NEEDS_YOU: 'needs_you',
  UPCOMING: 'upcoming',
})

const ACTIVE_CHALLENGE_STATES = new Set([
  'sent',
  'received',
  'accepted_unscheduled',
  'scheduled',
  'ready',
  'live',
  'pending_review',
])

const ACTIVE_MATCH_STATUSES = new Set([
  'pending',
  'awaiting',
  'accepted',
  'scheduled',
  'ready',
  'live',
  'pending_review',
])

const clean = (value) => String(value || '').trim()

function action(id, label, tone = 'quiet') {
  return { id, label, tone }
}

function belongsToActiveClub(record, activeClubId) {
  const recordClubId = clean(record?.clubId)
  const clubId = clean(activeClubId)
  return recordClubId ? Boolean(clubId && recordClubId === clubId) : true
}

function matchParticipantIds(match = {}) {
  const directIds = [
    match.player1Id,
    match.player2Id,
    match.challengerId,
    match.defenderId,
  ]

  const sideIds = Array.isArray(match.sides)
    ? match.sides.flatMap((side) => [side?.id, ...(side?.participantIds || [])])
    : []

  return [...new Set([...directIds, ...sideIds].map(clean).filter(Boolean))]
}

function isMatchParticipant(match, actorId) {
  return Boolean(clean(actorId) && matchParticipantIds(match).includes(clean(actorId)))
}

function playerMap(players = []) {
  return new Map(players.map((player) => [clean(player?.id), player]))
}

function challengePlayerName(challenge, side, playersById) {
  const isChallenger = side === 'challenger'
  const id = clean(isChallenger ? challenge?.challengerId : challenge?.defenderId)
  const responseName = clean(
    isChallenger ? challenge?.challengerName : challenge?.defenderName,
  )
  const snapshotName = clean(
    isChallenger ? challenge?.challengerSnapshot?.name : challenge?.defenderSnapshot?.name,
  )
  return responseName || snapshotName || clean(playersById.get(id)?.name) || 'Club player'
}

function matchPlayerName(match, side, playersById) {
  const isFirst = side === 'first'
  const id = clean(
    isFirst
      ? match?.player1Id || match?.challengerId || match?.sides?.[0]?.id
      : match?.player2Id || match?.defenderId || match?.sides?.[1]?.id,
  )
  const directName = clean(
    isFirst
      ? match?.player1Name || match?.challengerName || match?.sides?.[0]?.name
      : match?.player2Name || match?.defenderName || match?.sides?.[1]?.name,
  )
  return directName || clean(playersById.get(id)?.name) || (isFirst ? 'Player 1' : 'Player 2')
}

function opponentNameForChallenge(challenge, actorId, playersById) {
  return clean(actorId) === clean(challenge?.challengerId)
    ? challengePlayerName(challenge, 'defender', playersById)
    : challengePlayerName(challenge, 'challenger', playersById)
}

function ladderCompetitionLabel(challenge, match) {
  return clean(
    challenge?.ladderConfigSnapshot?.name ||
      challenge?.ladderConfigSnapshot?.label ||
      match?.ladderConfigSnapshot?.name ||
      match?.ladderConfigSnapshot?.label,
  )
}

function sourceLabel(match) {
  const source = clean(match?.type || match?.source).toLowerCase()
  if (source === 'ladder') return 'Ladder match'
  if (source === 'tournament') return 'Tournament match'
  if (source === 'friendly') return 'Friendly match'
  return 'Match'
}

function groupForChallengeState(state, needsActorAction) {
  if (['live', 'ready'].includes(state)) return PERSONAL_PLAY_GROUPS.NOW
  if (['received', 'accepted_unscheduled'].includes(state)) {
    return PERSONAL_PLAY_GROUPS.NEEDS_YOU
  }
  if (state === 'pending_review' && needsActorAction) return PERSONAL_PLAY_GROUPS.NEEDS_YOU
  return PERSONAL_PLAY_GROUPS.UPCOMING
}

function challengeItemActions({ state, challenge, match, actorId, needsActorAction }) {
  if (state === 'received') {
    return [
      action(PERSONAL_PLAY_ACTIONS.ACCEPT_CHALLENGE, 'Accept challenge', 'primary'),
      action(PERSONAL_PLAY_ACTIONS.DECLINE_CHALLENGE, 'Decline', 'danger'),
    ]
  }

  if (state === 'sent') {
    return [action(PERSONAL_PLAY_ACTIONS.VIEW_CHALLENGE, 'View challenge')]
  }

  if (state === 'accepted_unscheduled') {
    return [action(PERSONAL_PLAY_ACTIONS.SCHEDULE_MATCH, 'Schedule match', 'primary')]
  }

  if (state === 'scheduled') {
    return [
      action(
        match?.id ? PERSONAL_PLAY_ACTIONS.VIEW_MATCH : PERSONAL_PLAY_ACTIONS.VIEW_CHALLENGE,
        'View match',
      ),
    ]
  }

  if (state === 'ready') {
    return [
      ...(match?.id
        ? [action(PERSONAL_PLAY_ACTIONS.START_MATCH, 'Start match', 'primary')]
        : []),
      action(
        match?.id ? PERSONAL_PLAY_ACTIONS.VIEW_MATCH : PERSONAL_PLAY_ACTIONS.VIEW_CHALLENGE,
        'View match',
      ),
    ]
  }

  if (state === 'live') {
    if (!match?.id) return [action(PERSONAL_PLAY_ACTIONS.VIEW_CHALLENGE, 'View challenge')]
    const scorer = clean(match?.scorerId) === clean(actorId)
    return [
      action(
        scorer ? PERSONAL_PLAY_ACTIONS.RESUME_SCORING : PERSONAL_PLAY_ACTIONS.VIEW_LIVE_SCORE,
        scorer ? 'Resume scoring' : 'View live score',
        'primary',
      ),
      action(PERSONAL_PLAY_ACTIONS.VIEW_MATCH, 'View match'),
    ]
  }

  if (state === 'pending_review') {
    return [
      action(
        needsActorAction ? PERSONAL_PLAY_ACTIONS.REVIEW_RESULT : PERSONAL_PLAY_ACTIONS.VIEW_CHALLENGE,
        needsActorAction ? 'Review result' : 'View result',
        needsActorAction ? 'primary' : 'quiet',
      ),
    ]
  }

  return []
}

function buildChallengeItem(challenge, match, actorId, playersById, now) {
  const state = challengeViewState(challenge, match, actorId, now)
  if (!ACTIVE_CHALLENGE_STATES.has(state) || TERMINAL_CHALLENGE_STATUSES.includes(state)) {
    return null
  }

  const challengerName = challengePlayerName(challenge, 'challenger', playersById)
  const defenderName = challengePlayerName(challenge, 'defender', playersById)
  const opponentName = opponentNameForChallenge(challenge, actorId, playersById)
  const submittedBy = clean(match?.resultSubmittedBy || challenge?.resultSubmittedBy)
  const needsActorAction =
    state === 'received' ||
    state === 'accepted_unscheduled' ||
    (state === 'pending_review' && Boolean(submittedBy) && submittedBy !== clean(actorId))

  let statusLabel = 'Match update'
  let secondaryCopy = ''

  if (state === 'sent') {
    statusLabel = 'Challenge sent'
    secondaryCopy = `Waiting for ${opponentName} to respond.`
  } else if (state === 'received') {
    statusLabel = 'Challenge received'
    secondaryCopy = `${opponentName} wants to play you.`
  } else if (state === 'accepted_unscheduled') {
    statusLabel = 'Schedule your match'
    secondaryCopy = 'No date yet.'
  } else if (state === 'scheduled') {
    statusLabel = 'Scheduled'
  } else if (state === 'ready') {
    statusLabel = 'Ready to play'
    secondaryCopy = 'Your match is ready to start.'
  } else if (state === 'live') {
    statusLabel = 'Live'
    secondaryCopy = 'Match in progress.'
  } else if (state === 'pending_review') {
    statusLabel = needsActorAction ? 'Result needs your review' : 'Result submitted'
    secondaryCopy = needsActorAction
      ? 'Review the submitted result before the Ladder updates.'
      : `Waiting for ${opponentName} to confirm.`
  }

  return {
    id: `challenge:${challenge.id}`,
    source: 'ladder',
    lifecycle: state,
    group: groupForChallengeState(state, needsActorAction),
    needsActorAction,
    challenge,
    match: match || null,
    challengeId: challenge.id,
    matchId: match?.id || '',
    player1Name: challengerName,
    player2Name: defenderName,
    opponentName,
    sourceLabel: 'Ladder match',
    competitionLabel: ladderCompetitionLabel(challenge, match),
    statusLabel,
    secondaryCopy,
    scheduledAt: challenge?.scheduledAt || match?.scheduledAt || '',
    court: challenge?.court || match?.court || '',
    score: match?.score || '',
    createdAt: challenge?.createdAt || challenge?.requestedAt || match?.createdAt || '',
    actions: challengeItemActions({
      state,
      challenge,
      match,
      actorId,
      needsActorAction,
    }),
  }
}

function genericMatchState(match) {
  return clean(match?.status).toLowerCase()
}

function genericMatchGroup(status, needsActorAction) {
  if (['live', 'ready'].includes(status)) return PERSONAL_PLAY_GROUPS.NOW
  if (status === 'pending_review' && needsActorAction) return PERSONAL_PLAY_GROUPS.NEEDS_YOU
  return PERSONAL_PLAY_GROUPS.UPCOMING
}

function genericMatchActions(match, actorId, needsActorAction) {
  const status = genericMatchState(match)
  if (status === 'live') {
    return [
      action(PERSONAL_PLAY_ACTIONS.CONTINUE_NON_LADDER, 'Continue match', 'primary'),
      action(PERSONAL_PLAY_ACTIONS.VIEW_MATCH, 'View match'),
    ]
  }

  if (status === 'ready') {
    return [
      action(PERSONAL_PLAY_ACTIONS.CONTINUE_NON_LADDER, 'Start match', 'primary'),
      action(PERSONAL_PLAY_ACTIONS.VIEW_MATCH, 'View match'),
    ]
  }

  if (status === 'pending_review' && needsActorAction) {
    return [action(PERSONAL_PLAY_ACTIONS.VIEW_MATCH, 'Review result', 'primary')]
  }

  return [action(PERSONAL_PLAY_ACTIONS.VIEW_MATCH, 'View match')]
}

function buildGenericMatchItem(match, actorId, playersById) {
  const status = genericMatchState(match)
  if (!ACTIVE_MATCH_STATUSES.has(status)) return null

  const submittedBy = clean(match?.resultSubmittedBy)
  const needsActorAction =
    status === 'pending_review' && Boolean(submittedBy) && submittedBy !== clean(actorId)

  const firstName = matchPlayerName(match, 'first', playersById)
  const secondName = matchPlayerName(match, 'second', playersById)
  const opponentName = clean(actorId) === clean(match?.player1Id || match?.challengerId)
    ? secondName
    : firstName

  let statusLabel = match?.statusLabel || status.replaceAll('_', ' ')
  let secondaryCopy = ''

  if (status === 'scheduled') statusLabel = 'Scheduled'
  if (status === 'ready') statusLabel = 'Ready to play'
  if (status === 'live') {
    statusLabel = 'Live'
    secondaryCopy = 'Match in progress.'
  }
  if (status === 'pending_review') {
    statusLabel = needsActorAction ? 'Result needs your review' : 'Result submitted'
    secondaryCopy = needsActorAction
      ? 'Review the submitted result.'
      : `Waiting for ${opponentName} to confirm.`
  }

  const competitionLabel = clean(
    match?.tournamentName || match?.categoryName || match?.matchCode || match?.round,
  )

  return {
    id: `match:${match.id}`,
    source: clean(match?.type || match?.source).toLowerCase() || 'match',
    lifecycle: status,
    group: genericMatchGroup(status, needsActorAction),
    needsActorAction,
    challenge: null,
    match,
    challengeId: clean(match?.challengeId),
    matchId: match?.id || '',
    player1Name: firstName,
    player2Name: secondName,
    opponentName,
    sourceLabel: sourceLabel(match),
    competitionLabel,
    statusLabel,
    secondaryCopy,
    scheduledAt: match?.scheduledAt || '',
    court: match?.court || '',
    score: match?.score || '',
    createdAt: match?.createdAt || match?.requestedAt || '',
    actions: genericMatchActions(match, actorId, needsActorAction),
  }
}

const GROUP_RANK = Object.freeze({
  [PERSONAL_PLAY_GROUPS.NOW]: 0,
  [PERSONAL_PLAY_GROUPS.NEEDS_YOU]: 1,
  [PERSONAL_PLAY_GROUPS.UPCOMING]: 2,
})

const STATE_RANK = Object.freeze({
  live: 0,
  ready: 1,
  received: 2,
  accepted_unscheduled: 3,
  pending_review: 4,
  scheduled: 5,
  sent: 6,
  accepted: 7,
  pending: 8,
  awaiting: 9,
})

function timeValue(value) {
  const parsed = new Date(value || '').getTime()
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER
}

export function comparePersonalPlayItems(left, right) {
  const groupDifference = (GROUP_RANK[left?.group] ?? 99) - (GROUP_RANK[right?.group] ?? 99)
  if (groupDifference) return groupDifference

  if (left?.group === PERSONAL_PLAY_GROUPS.UPCOMING) {
    const scheduleDifference = timeValue(left?.scheduledAt) - timeValue(right?.scheduledAt)
    if (scheduleDifference) return scheduleDifference
  }

  const stateDifference =
    (STATE_RANK[left?.lifecycle] ?? 99) - (STATE_RANK[right?.lifecycle] ?? 99)
  if (stateDifference) return stateDifference

  const createdDifference = timeValue(left?.createdAt) - timeValue(right?.createdAt)
  if (createdDifference) return createdDifference

  return clean(left?.id).localeCompare(clean(right?.id))
}

export function buildPersonalPlayItems({
  challenges = [],
  matches = [],
  players = [],
  actorId = '',
  activeClubId = '',
  now = Date.now(),
} = {}) {
  const currentActorId = clean(actorId)
  if (!currentActorId) return []

  const playersById = playerMap(players)
  const linkedMatchByChallengeId = new Map()

  for (const match of matches) {
    const challengeId = clean(match?.challengeId)
    if (challengeId) linkedMatchByChallengeId.set(challengeId, match)
  }

  const items = []
  const consumedMatchIds = new Set()

  for (const challenge of challenges) {
    if (!isChallengeParticipant(challenge, currentActorId)) continue
    if (!belongsToActiveClub(challenge, activeClubId)) continue

    const match = linkedMatchByChallengeId.get(clean(challenge?.id)) || null
    const item = buildChallengeItem(challenge, match, currentActorId, playersById, now)
    if (!item) continue

    if (match?.id) consumedMatchIds.add(clean(match.id))
    items.push(item)
  }

  for (const match of matches) {
    if (consumedMatchIds.has(clean(match?.id))) continue
    if (!isMatchParticipant(match, currentActorId)) continue
    if (!belongsToActiveClub(match, activeClubId)) continue

    const item = buildGenericMatchItem(match, currentActorId, playersById)
    if (item) items.push(item)
  }

  return items.sort(comparePersonalPlayItems)
}

