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
  matchType: 'singles',
  scoring: 'ad',
  matchFormat: 'best-of-3',
  matchFormatLabel: 'Best of 3 tie-break sets',
  tieBreakLabel: 'Seven points at 6–6',
  rulesSnapshot: null,
})

const CLUB_SETUP_STORAGE_KEY = 'gorra.admin.clubSetup.v1'

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
}

function configuredLadder(setup, ladderId = '') {
  const ladders = Array.isArray(setup?.ladders) ? setup.ladders : []
  const requested = String(ladderId || '').trim()

  if (requested) {
    const match = ladders.find(
      (item) =>
        item.id === requested &&
        item.enabled !== false &&
        !item.archived,
    )
    if (match) return match
  }

  const primary = ladders.find(
    (item) =>
      item.id === setup?.primaryLadderId &&
      item.enabled !== false &&
      !item.archived,
  )
  if (primary) return primary

  return (
    ladders.find(
      (item) => item.enabled !== false && !item.archived,
    ) || null
  )
}

function numberRule(ladderRules, legacyRules, key, fallback) {
  const own = Number(ladderRules?.[key])
  if (Number.isFinite(own)) return own
  const legacy = Number(legacyRules?.[key])
  if (Number.isFinite(legacy)) return legacy
  return fallback
}

function booleanRule(ladderRules, legacyRules, key, fallback = false) {
  if (typeof ladderRules?.[key] === 'boolean') return ladderRules[key]
  if (typeof legacyRules?.[key] === 'boolean') return legacyRules[key]
  return fallback
}

function stringRule(ladderRules, legacyRules, key, fallback) {
  const own = String(ladderRules?.[key] || '').trim()
  if (own) return own
  const legacy = String(legacyRules?.[key] || '').trim()
  return legacy || fallback
}

/**
 * Per-Ladder rules always win.
 * setup.rules remains only as a compatibility fallback for older clubs.
 */
export function resolveLadderConfigFromSetup(setupInput = {}, ladderId = '') {
  const setup = asObject(setupInput)
  const ladder = configuredLadder(setup, ladderId)
  const legacyRules = asObject(setup.rules)
  const ladderRules = asObject(ladder?.rules)

  const matchPreset = stringRule(
    ladderRules,
    legacyRules,
    'matchPreset',
    'standard-club',
  )
  const isTimeSmart = matchPreset === 'time-smart'

  const scoring =
    stringRule(ladderRules, legacyRules, 'scoring', 'ad') === 'noad'
      ? 'noad'
      : 'ad'

  const movementSystem = stringRule(
    ladderRules,
    legacyRules,
    'movementSystem',
    LADDER_CONFIG.movementSystem,
  )

  const matchType = ladder?.matchType === 'doubles' ? 'doubles' : 'singles'
  const explicitRulesSnapshot =
    ladderRules.matchRulesSnapshot &&
    typeof ladderRules.matchRulesSnapshot === 'object'
      ? ladderRules.matchRulesSnapshot
      : null

  return {
    ...LADDER_CONFIG,
    id: ladder?.id || LADDER_CONFIG.id,
    clubId: setup.clubId || setup.workspace?.name || LADDER_CONFIG.clubId,
    name: ladder?.name || LADDER_CONFIG.name,
    challengeRangeUp: numberRule(
      ladderRules,
      legacyRules,
      'challengeRangeUp',
      LADDER_CONFIG.challengeRangeUp,
    ),
    allowDownwardChallenges: booleanRule(
      ladderRules,
      legacyRules,
      'allowDownwardChallenges',
      LADDER_CONFIG.allowDownwardChallenges,
    ),
    maxActiveChallenges: numberRule(
      ladderRules,
      legacyRules,
      'maxActiveChallenges',
      LADDER_CONFIG.maxActiveChallenges,
    ),
    responseHours: numberRule(
      ladderRules,
      legacyRules,
      'responseHours',
      LADDER_CONFIG.responseHours,
    ),
    completionDays: numberRule(
      ladderRules,
      legacyRules,
      'completionDays',
      LADDER_CONFIG.completionDays,
    ),
    rematchCooldownDays: numberRule(
      ladderRules,
      legacyRules,
      'rematchCooldownDays',
      0,
    ),
    repeatedDeclineLimit: numberRule(
      ladderRules,
      legacyRules,
      'repeatedDeclineLimit',
      3,
    ),
    inactivityDays: numberRule(
      ladderRules,
      legacyRules,
      'inactivityDays',
      30,
    ),
    noShowPolicy: stringRule(
      ladderRules,
      legacyRules,
      'noShowPolicy',
      'walkover-after-review',
    ),
    movementSystem: ['position-swap', 'leapfrog', 'points'].includes(movementSystem)
      ? movementSystem
      : LADDER_CONFIG.movementSystem,
    scoring,
    resultConfirmation: stringRule(
      ladderRules,
      legacyRules,
      'resultConfirmation',
      'both-players',
    ),
    matchPreset: isTimeSmart ? 'time-smart' : 'standard-club',
    matchType,
    matchFormat: isTimeSmart ? 'match-tiebreak-third' : 'best-of-3',
    matchFormatLabel: isTimeSmart
      ? 'Two tie-break sets and a 10-point match tie-break'
      : 'Best of 3 tie-break sets',
    rulesSnapshot: explicitRulesSnapshot,
  }
}

export function getActiveLadderConfig(ladderId = '') {
  if (typeof window === 'undefined' || !window.localStorage) return LADDER_CONFIG

  try {
    const stored = JSON.parse(
      window.localStorage.getItem(CLUB_SETUP_STORAGE_KEY) || 'null',
    )
    const setup = stored?.setup
    if (stored?.schemaVersion !== 1 || setup?.status !== 'active') return LADDER_CONFIG
    return resolveLadderConfigFromSetup(setup, ladderId)
  } catch {
    return LADDER_CONFIG
  }
}

export const ACTIVE_LADDER_CHALLENGE_STATUSES = Object.freeze([
  'awaiting',
  'accepted',
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
    lowest: config.allowDownwardChallenges
      ? rank + config.challengeRangeUp
      : Math.max(1, rank - 1),
  }
}

export function isEligibleLadderOpponent(
  challenger,
  opponent,
  config = getActiveLadderConfig(),
) {
  const challengerRank = Number(challenger?.rank || challenger?.ladderRank)
  const opponentRank = Number(opponent?.rank || opponent?.ladderRank)

  if (!challenger?.id || !opponent?.id || challenger.id === opponent.id) return false
  if (!Number.isFinite(challengerRank) || !Number.isFinite(opponentRank)) return false
  if (
    opponent.status === 'inactive' ||
    opponent.status === 'suspended' ||
    opponent.challengePaused
  ) {
    return false
  }

  const distance = challengerRank - opponentRank
  if (distance >= 1) return distance <= config.challengeRangeUp

  return Boolean(
    config.allowDownwardChallenges &&
      distance < 0 &&
      Math.abs(distance) <= config.challengeRangeUp,
  )
}

export function ladderMovementFor(
  challenger,
  opponent,
  config = getActiveLadderConfig(),
) {
  const challengerRank = Number(challenger?.rank || challenger?.ladderRank) || null
  const opponentRank = Number(opponent?.rank || opponent?.ladderRank) || null

  if (!challengerRank || !opponentRank) {
    return {
      winRank: challengerRank,
      lossRank: challengerRank,
      label: 'Movement unavailable',
    }
  }

  if (
    ['position-swap', 'leapfrog'].includes(config.movementSystem) &&
    challengerRank > opponentRank
  ) {
    return {
      winRank: opponentRank,
      lossRank: challengerRank,
      label:
        config.movementSystem === 'leapfrog'
          ? `Win: take #${opponentRank} · Loss: stay at #${challengerRank}`
          : `Win: move to #${opponentRank} · Loss: stay at #${challengerRank}`,
    }
  }

  return {
    winRank: challengerRank,
    lossRank: challengerRank,
    label:
      config.movementSystem === 'points'
        ? 'Your position is calculated from points after the result is confirmed.'
        : 'Your position is calculated after the result is confirmed.',
  }
}

export function ladderMatchConfig(config = getActiveLadderConfig()) {
  return {
    matchType: config.matchType === 'doubles' ? 'doubles' : 'singles',
    matchFormat: 'best_of_3',
    setWinRule: 'standard',
    gameScoringRule: config.scoring === 'noad' ? 'sudden_death' : 'normal',
    finalSetRule: config.matchPreset === 'time-smart' ? 'super_tiebreak' : 'same',
    rulesSnapshot: config.rulesSnapshot || undefined,
    locked: true,
  }
}

export function deadlineFromNow(amount, unit = 'hours') {
  const multiplier = unit === 'days' ? 86_400_000 : 3_600_000
  return new Date(Date.now() + Number(amount || 0) * multiplier).toISOString()
}

