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

const CLUB_SETUP_STORAGE_KEY = 'gorra.admin.clubSetup.v1'

export function getActiveLadderConfig() {
  if (typeof window === 'undefined' || !window.localStorage) return LADDER_CONFIG

  try {
    const stored = JSON.parse(window.localStorage.getItem(CLUB_SETUP_STORAGE_KEY) || 'null')
    const setup = stored?.setup
    if (stored?.schemaVersion !== 1 || setup?.status !== 'active') return LADDER_CONFIG

    const ladder = setup.ladders?.find((item) => item.id === setup.primaryLadderId && item.enabled)
    const rules = setup.rules || {}
    const isTimeSmart = rules.matchPreset === 'time-smart'

    return {
      ...LADDER_CONFIG,
      id: ladder?.id || LADDER_CONFIG.id,
      clubId: setup.workspace?.name || LADDER_CONFIG.clubId,
      name: ladder?.name || LADDER_CONFIG.name,
      challengeRangeUp: Number(rules.challengeRangeUp) || LADDER_CONFIG.challengeRangeUp,
      allowDownwardChallenges: Boolean(rules.allowDownwardChallenges),
      maxActiveChallenges: Number(rules.maxActiveChallenges) || LADDER_CONFIG.maxActiveChallenges,
      responseHours: Number(rules.responseHours) || LADDER_CONFIG.responseHours,
      completionDays: Number(rules.completionDays) || LADDER_CONFIG.completionDays,
      rematchCooldownDays: Number(rules.rematchCooldownDays) || 0,
      repeatedDeclineLimit: Number(rules.repeatedDeclineLimit) || 3,
      inactivityDays: Number(rules.inactivityDays) || 30,
      noShowPolicy: rules.noShowPolicy || 'walkover-after-review',
      movementSystem: rules.movementSystem || LADDER_CONFIG.movementSystem,
      scoring: rules.scoring === 'noad' ? 'noad' : 'ad',
      matchPreset: isTimeSmart ? 'time-smart' : 'standard-club',
      matchFormat: isTimeSmart ? 'match-tiebreak-third' : 'best-of-3',
      matchFormatLabel: isTimeSmart
        ? 'Two tie-break sets and a 10-point match tie-break'
        : 'Best of 3 tie-break sets',
    }
  } catch {
    return LADDER_CONFIG
  }
}

export const ACTIVE_LADDER_CHALLENGE_STATUSES = Object.freeze([
  'awaiting',
  'scheduled',
  'pending_review',
  'ready',
  'live',
])

export function ladderWindowFor(player, config = getActiveLadderConfig()) {
  const rank = Number(player?.rank || player?.ladderRank)
  if (!Number.isFinite(rank) || rank < 1) return null
  return {
    highest: Math.max(1, rank - config.challengeRangeUp),
    lowest: config.allowDownwardChallenges ? rank + config.challengeRangeUp : Math.max(1, rank - 1),
  }
}

export function isEligibleLadderOpponent(challenger, opponent, config = getActiveLadderConfig()) {
  const challengerRank = Number(challenger?.rank || challenger?.ladderRank)
  const opponentRank = Number(opponent?.rank || opponent?.ladderRank)
  if (!challenger?.id || !opponent?.id || challenger.id === opponent.id) return false
  if (!Number.isFinite(challengerRank) || !Number.isFinite(opponentRank)) return false
  if (opponent.status === 'inactive' || opponent.status === 'suspended') return false
  const distance = challengerRank - opponentRank
  if (distance >= 1) return distance <= config.challengeRangeUp
  return Boolean(
    config.allowDownwardChallenges && distance < 0 && Math.abs(distance) <= config.challengeRangeUp,
  )
}

export function ladderMovementFor(challenger, opponent, config = getActiveLadderConfig()) {
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

export function ladderMatchConfig(config = getActiveLadderConfig()) {
  return {
    matchType: 'singles',
    matchFormat: 'best_of_3',
    setWinRule: 'standard',
    gameScoringRule: config.scoring === 'noad' ? 'sudden_death' : 'normal',
    finalSetRule: config.matchPreset === 'time-smart' ? 'super_tiebreak' : 'same',
    locked: true,
  }
}

export function deadlineFromNow(amount, unit = 'hours') {
  const multiplier = unit === 'days' ? 86_400_000 : 3_600_000
  return new Date(Date.now() + Number(amount || 0) * multiplier).toISOString()
}
