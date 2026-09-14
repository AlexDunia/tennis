import {
  ACTIVE_LADDER_CHALLENGE_STATUSES,
  getActiveLadderConfig,
  isEligibleLadderOpponent,
} from '../config/ladder.js'

function challengeLadderId(challenge) {
  return challenge?.ladderId || challenge?.ladderConfigSnapshot?.id || ''
}

function activeChallengesFor({
  playerId,
  challenges = [],
  ladderId,
}) {
  if (!playerId) return []

  return (Array.isArray(challenges) ? challenges : []).filter(
    (challenge) =>
      challengeLadderId(challenge) === ladderId &&
      ACTIVE_LADDER_CHALLENGE_STATUSES.includes(challenge.status) &&
      [challenge.challengerId, challenge.defenderId].includes(playerId),
  )
}

function statusLabel(challenge) {
  switch (challenge?.status) {
    case 'pending_review':
      return 'Result pending'
    case 'live':
      return 'Playing now'
    case 'ready':
    case 'scheduled':
      return 'Match scheduled'
    case 'accepted':
      return 'Match accepted'
    case 'awaiting':
      return 'Challenge pending'
    default:
      return 'Unavailable'
  }
}

export function getLadderPlayerAvailability({
  player,
  challenges = [],
  config = getActiveLadderConfig(),
} = {}) {
  const limit = Math.max(1, Number(config?.maxActiveChallenges) || 1)

  if (!player?.id) {
    return {
      available: false,
      label: 'Unavailable',
      reason: 'missing_player',
      activeCount: 0,
      limit,
    }
  }

  if (
    player.status === 'inactive' ||
    player.status === 'suspended' ||
    player.challengePaused
  ) {
    return {
      available: false,
      label: player.challengePaused ? 'Paused' : 'Unavailable',
      reason: 'player_paused',
      activeCount: 0,
      limit,
    }
  }

  const active = activeChallengesFor({
    playerId: player.id,
    challenges,
    ladderId: config?.id || '',
  })

  if (active.length >= limit) {
    const weight = {
      pending_review: 6,
      live: 5,
      ready: 4,
      scheduled: 3,
      accepted: 2,
      awaiting: 1,
    }

    const mostImportant = [...active].sort(
      (left, right) =>
        (weight[right.status] || 0) - (weight[left.status] || 0),
    )[0]

    return {
      available: false,
      label: statusLabel(mostImportant),
      reason: mostImportant?.status || 'active_challenge',
      activeCount: active.length,
      limit,
    }
  }

  return {
    available: true,
    label: 'Available',
    reason: '',
    activeCount: active.length,
    limit,
  }
}

function localAccessDecision({
  player,
  challenges = [],
  config = getActiveLadderConfig(),
}) {
  if (config.seasonStatus !== 'active') {
    return {
      allowed: false,
      message: 'This Ladder is not accepting challenges right now.',
    }
  }

  if (!Number(player?.rank)) {
    return {
      allowed: false,
      message: 'You must be placed on the active Ladder before creating a challenge.',
    }
  }

  const availability = getLadderPlayerAvailability({
    player,
    challenges,
    config,
  })

  if (!availability.available) {
    return {
      allowed: false,
      message:
        availability.label === 'Result pending'
          ? 'Your result is still pending. Finish that review before creating another challenge.'
          : 'Finish your active challenge before creating another one.',
    }
  }

  return { allowed: true, message: '' }
}

export async function verifyLadderCreationAccess(context) {
  const config = context?.config || getActiveLadderConfig()

  const localDecision = localAccessDecision({
    ...context,
    config,
  })

  if (!localDecision.allowed) {
    return { ...localDecision, source: 'local' }
  }

  const endpoint = import.meta.env.VITE_LADDER_ACCESS_ENDPOINT

  if (!endpoint) {
    return { ...localDecision, source: 'local' }
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: context.player?.id,
        ladderId: config.id,
        action: 'create_ladder_challenge',
      }),
    })

    if (!response.ok) {
      return {
        allowed: false,
        message: 'Your Ladder eligibility could not be confirmed. Please try again.',
        source: 'backend',
      }
    }

    const result = await response.json()

    return {
      allowed: result.allowed === true,
      message:
        result.allowed === true
          ? ''
          : result.message || 'This Ladder action is unavailable.',
      source: 'backend',
    }
  } catch {
    return {
      allowed: false,
      message: 'Your Ladder eligibility could not be confirmed. Please try again.',
      source: 'backend',
    }
  }
}

export function getEligibleLadderOpponents({
  challenger,
  players = [],
  challenges = [],
  config = getActiveLadderConfig(),
}) {
  if (!challenger?.id || config.seasonStatus !== 'active') return []

  const challengerAvailability = getLadderPlayerAvailability({
    player: challenger,
    challenges,
    config,
  })

  if (!challengerAvailability.available) return []

  return (Array.isArray(players) ? players : []).filter((opponent) => {
    const availability = getLadderPlayerAvailability({
      player: opponent,
      challenges,
      config,
    })

    return (
      availability.available &&
      isEligibleLadderOpponent(challenger, opponent, config)
    )
  })
}
