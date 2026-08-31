import {
  ACTIVE_LADDER_CHALLENGE_STATUSES,
  getActiveLadderConfig,
  isEligibleLadderOpponent,
} from '../config/ladder.js'

function localAccessDecision({ player, challenges = [] }) {
  const ladderConfig = getActiveLadderConfig()
  if (ladderConfig.seasonStatus !== 'active') {
    return { allowed: false, message: 'This Ladder is not accepting challenges right now.' }
  }

  if (!Number(player?.rank)) {
    return {
      allowed: false,
      message: 'You must be placed on the active Ladder before creating a challenge.',
    }
  }

  const activeChallenges = challenges.filter(
    (challenge) =>
      ACTIVE_LADDER_CHALLENGE_STATUSES.includes(challenge.status) &&
      [challenge.challengerId, challenge.defenderId].includes(player.id),
  )

  if (activeChallenges.length >= ladderConfig.maxActiveChallenges) {
    return {
      allowed: false,
      message: 'Finish your active challenge before creating another one.',
    }
  }

  return { allowed: true, message: '' }
}

export async function verifyLadderCreationAccess(context) {
  const localDecision = localAccessDecision(context)
  if (!localDecision.allowed) return { ...localDecision, source: 'local' }

  const endpoint = import.meta.env.VITE_LADDER_ACCESS_ENDPOINT
  if (!endpoint) return { ...localDecision, source: 'local' }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: context.player?.id,
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
        result.allowed === true ? '' : result.message || 'This Ladder action is unavailable.',
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

  const blockingPlayers = new Set(
    challenges
      .filter(
        (challenge) =>
          (challenge.ladderId || challenge.ladderConfigSnapshot?.id) === config.id &&
          ACTIVE_LADDER_CHALLENGE_STATUSES.includes(challenge.status),
      )
      .flatMap((challenge) => [challenge.challengerId, challenge.defenderId]),
  )

  if (blockingPlayers.has(challenger.id)) return []

  return players.filter(
    (opponent) =>
      !blockingPlayers.has(opponent?.id) && isEligibleLadderOpponent(challenger, opponent, config),
  )
}
