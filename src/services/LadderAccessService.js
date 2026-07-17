import { ACTIVE_LADDER_CHALLENGE_STATUSES, LADDER_CONFIG } from '../config/ladder'

function localAccessDecision({ player, challenges = [] }) {
  if (LADDER_CONFIG.seasonStatus !== 'active') {
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

  if (activeChallenges.length >= LADDER_CONFIG.maxActiveChallenges) {
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
      message: result.allowed === true ? '' : result.message || 'This Ladder action is unavailable.',
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

