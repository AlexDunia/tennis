export const LADDER_CONFIG = Object.freeze({
  id: 'emerald-courts-open-ladder',
  clubId: 'emerald-courts',
  name: 'Emerald Courts Open Ladder',
  seasonStatus: 'active',
  challengeRangeUp: 3,
  allowDownwardChallenges: false,
  maxActiveChallenges: 1,
  responseHours: 48,
  completionDays: 7,
  movementSystem: 'position-swap',
  scoring: 'ad',
  matchFormat: 'best-of-3',
  matchFormatLabel: 'Best of 3 tie-break sets',
  tieBreakLabel: 'Seven points at 6–6',
})

export const ACTIVE_LADDER_CHALLENGE_STATUSES = Object.freeze([
  'awaiting',
  'scheduled',
  'pending_review',
  'ready',
  'live',
])

export function ladderWindowFor(player, config = LADDER_CONFIG) {
  const rank = Number(player?.rank || player?.ladderRank)
  if (!Number.isFinite(rank) || rank < 1) return null
  return {
    highest: Math.max(1, rank - config.challengeRangeUp),
    lowest: Math.max(1, rank - 1),
  }
}

export function isEligibleLadderOpponent(challenger, opponent, config = LADDER_CONFIG) {
  const challengerRank = Number(challenger?.rank || challenger?.ladderRank)
  const opponentRank = Number(opponent?.rank || opponent?.ladderRank)
  if (!challenger?.id || !opponent?.id || challenger.id === opponent.id) return false
  if (!Number.isFinite(challengerRank) || !Number.isFinite(opponentRank)) return false
  if (opponent.status === 'inactive' || opponent.status === 'suspended') return false
  const distance = challengerRank - opponentRank
  return distance >= 1 && distance <= config.challengeRangeUp
}

export function ladderMovementFor(challenger, opponent, config = LADDER_CONFIG) {
  const challengerRank = Number(challenger?.rank || challenger?.ladderRank) || null
  const opponentRank = Number(opponent?.rank || opponent?.ladderRank) || null
  if (!challengerRank || !opponentRank) {
    return { winRank: challengerRank, lossRank: challengerRank, label: 'Movement unavailable' }
  }
  if (config.movementSystem === 'position-swap' && challengerRank > opponentRank) {
    return {
      winRank: opponentRank,
      lossRank: challengerRank,
      label: `Win: move to #${opponentRank} · Loss: stay at #${challengerRank}`,
    }
  }
  return {
    winRank: challengerRank,
    lossRank: challengerRank,
    label: `Your position is calculated after the result is confirmed.`,
  }
}

export function ladderMatchConfig(config = LADDER_CONFIG) {
  return {
    matchType: 'singles',
    matchFormat: 'best_of_3',
    setWinRule: 'standard',
    gameScoringRule: config.scoring === 'noad' ? 'sudden_death' : 'normal',
    finalSetRule: 'same',
    locked: true,
  }
}

export function deadlineFromNow(amount, unit = 'hours') {
  const multiplier = unit === 'days' ? 86_400_000 : 3_600_000
  return new Date(Date.now() + Number(amount || 0) * multiplier).toISOString()
}
