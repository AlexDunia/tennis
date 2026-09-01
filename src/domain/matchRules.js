export const MATCH_RULES_SCHEMA_VERSION = 1

/*
 * Central domain limits.
 *
 * These are deliberately generous for real club play while keeping persisted
 * state, test runs and future command streams bounded. They are not copied from
 * prototype HTML max attributes.
 *
 * PRODUCT DECISION — REVIEW:
 * Revisit these caps with product/operations evidence before exposing the full
 * ranges in UI. Raising a cap later is schema-compatible; lowering one is not.
 */
export const MATCH_RULE_LIMITS = Object.freeze({
  setsToWin: Object.freeze({ min: 1, max: 5 }),
  gamesToWin: Object.freeze({ min: 1, max: 12 }),
  setWinBy: Object.freeze({ min: 1, max: 6 }),
  tieBreakPointsToWin: Object.freeze({ min: 1, max: 50 }),
  tieBreakWinBy: Object.freeze({ min: 1, max: 10 }),
  numericGamePointsToWin: Object.freeze({ min: 1, max: 50 }),
  numericGameWinBy: Object.freeze({ min: 1, max: 10 }),
  decidingMatchTieBreakPointsToWin: Object.freeze({ min: 1, max: 50 }),
  decidingMatchTieBreakWinBy: Object.freeze({ min: 1, max: 10 }),
})

export const MATCH_RULE_ERROR_CODES = Object.freeze({
  REQUIRED: 'required',
  TYPE: 'invalid_type',
  VALUE: 'invalid_value',
  RANGE: 'out_of_range',
  CONTRADICTION: 'contradictory',
  VERSION: 'unsupported_version',
})

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function issue(path, code, message) {
  return { path, code, message }
}

function validateInteger(value, path, limit, errors) {
  if (!Number.isInteger(value)) {
    errors.push(issue(path, MATCH_RULE_ERROR_CODES.TYPE, 'Must be a whole number.'))
    return
  }
  if (value < limit.min || value > limit.max) {
    errors.push(
      issue(path, MATCH_RULE_ERROR_CODES.RANGE, `Must be between ${limit.min} and ${limit.max}.`),
    )
  }
}

function validateTieBreak(value, path, pointsLimit, winByLimit, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(issue(path, MATCH_RULE_ERROR_CODES.REQUIRED, 'Tiebreak rules are required.'))
    return
  }
  validateInteger(value.pointsToWin, `${path}.pointsToWin`, pointsLimit, errors)
  validateInteger(value.winBy, `${path}.winBy`, winByLimit, errors)
}

export function createStandardMatchRulesSnapshot(overrides = {}) {
  const setInput = overrides.set || {}
  const tiedInput = setInput.tiedAtTarget || {}
  const tiedMode = tiedInput.mode || 'tiebreak'
  const gameInput = overrides.game || {}
  const gameMode = gameInput.mode || 'traditional'
  const decidingInput = overrides.decidingSet || {}
  const decidingMode = decidingInput.mode || 'normal_set'

  return {
    schemaVersion: overrides.schemaVersion ?? MATCH_RULES_SCHEMA_VERSION,
    sport: overrides.sport ?? 'tennis',
    match: {
      mode: overrides.match?.mode || 'sets',
      setsToWin: overrides.match?.setsToWin ?? 2,
    },
    set:
      overrides.set === null
        ? null
        : {
            gamesToWin: setInput.gamesToWin ?? 6,
            winBy: setInput.winBy ?? 2,
            tiedAtTarget: {
              mode: tiedMode,
              tiebreak:
                tiedMode === 'continue' || tiedInput.tiebreak === null
                  ? null
                  : {
                      pointsToWin: tiedInput.tiebreak?.pointsToWin ?? 7,
                      winBy: tiedInput.tiebreak?.winBy ?? 2,
                    },
            },
          },
    game:
      overrides.game === null
        ? null
        : gameMode === 'numeric'
          ? {
              mode: 'numeric',
              pointsToWin: gameInput.pointsToWin,
              winBy: gameInput.winBy,
            }
          : {
              mode: 'traditional',
              deuce: gameInput.deuce || 'advantage',
            },
    decidingSet:
      overrides.decidingSet === null
        ? null
        : decidingMode === 'match_tiebreak'
          ? {
              mode: 'match_tiebreak',
              pointsToWin: decidingInput.pointsToWin,
              winBy: decidingInput.winBy,
            }
          : { mode: 'normal_set' },
  }
}

export function createStandaloneMatchTieBreakRules({ pointsToWin = 10, winBy = 2 } = {}) {
  return {
    schemaVersion: MATCH_RULES_SCHEMA_VERSION,
    sport: 'tennis',
    match: {
      mode: 'tiebreak',
      tiebreak: {
        pointsToWin,
        winBy,
      },
    },
    set: null,
    game: null,
    decidingSet: null,
  }
}

export function validateMatchRulesSnapshot(snapshot) {
  const errors = []
  const warnings = []

  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return {
      valid: false,
      errors: [issue('', MATCH_RULE_ERROR_CODES.TYPE, 'Match rules must be an object.')],
      warnings,
    }
  }

  if (snapshot.schemaVersion !== MATCH_RULES_SCHEMA_VERSION) {
    errors.push(
      issue(
        'schemaVersion',
        MATCH_RULE_ERROR_CODES.VERSION,
        `Only MatchRulesSnapshot schema version ${MATCH_RULES_SCHEMA_VERSION} is supported.`,
      ),
    )
  }
  if (snapshot.sport !== 'tennis') {
    errors.push(issue('sport', MATCH_RULE_ERROR_CODES.VALUE, 'Sport must be tennis.'))
  }

  const match = snapshot.match
  if (!match || typeof match !== 'object') {
    errors.push(issue('match', MATCH_RULE_ERROR_CODES.REQUIRED, 'Match rules are required.'))
    return { valid: false, errors, warnings }
  }

  if (!['sets', 'tiebreak'].includes(match.mode)) {
    errors.push(
      issue('match.mode', MATCH_RULE_ERROR_CODES.VALUE, 'Match mode must be sets or tiebreak.'),
    )
    return { valid: false, errors, warnings }
  }

  if (match.mode === 'tiebreak') {
    validateTieBreak(
      match.tiebreak,
      'match.tiebreak',
      MATCH_RULE_LIMITS.tieBreakPointsToWin,
      MATCH_RULE_LIMITS.tieBreakWinBy,
      errors,
    )
    for (const field of ['set', 'game', 'decidingSet']) {
      if (snapshot[field] !== null && snapshot[field] !== undefined) {
        errors.push(
          issue(
            field,
            MATCH_RULE_ERROR_CODES.CONTRADICTION,
            `${field} rules do not apply to a standalone match tiebreak.`,
          ),
        )
      }
    }
    if (match.setsToWin !== undefined) {
      errors.push(
        issue(
          'match.setsToWin',
          MATCH_RULE_ERROR_CODES.CONTRADICTION,
          'A standalone match tiebreak does not use setsToWin.',
        ),
      )
    }
    return { valid: errors.length === 0, errors, warnings }
  }

  validateInteger(match.setsToWin, 'match.setsToWin', MATCH_RULE_LIMITS.setsToWin, errors)
  if (match.tiebreak !== undefined) {
    errors.push(
      issue(
        'match.tiebreak',
        MATCH_RULE_ERROR_CODES.CONTRADICTION,
        'A sets match cannot also define a standalone match tiebreak.',
      ),
    )
  }

  const set = snapshot.set
  if (!set || typeof set !== 'object') {
    errors.push(issue('set', MATCH_RULE_ERROR_CODES.REQUIRED, 'Set rules are required.'))
  } else {
    validateInteger(set.gamesToWin, 'set.gamesToWin', MATCH_RULE_LIMITS.gamesToWin, errors)
    validateInteger(set.winBy, 'set.winBy', MATCH_RULE_LIMITS.setWinBy, errors)

    const tied = set.tiedAtTarget
    if (!tied || typeof tied !== 'object') {
      errors.push(
        issue(
          'set.tiedAtTarget',
          MATCH_RULE_ERROR_CODES.REQUIRED,
          'Tied-target behavior is required.',
        ),
      )
    } else if (tied.mode === 'tiebreak') {
      validateTieBreak(
        tied.tiebreak,
        'set.tiedAtTarget.tiebreak',
        MATCH_RULE_LIMITS.tieBreakPointsToWin,
        MATCH_RULE_LIMITS.tieBreakWinBy,
        errors,
      )
    } else if (tied.mode === 'continue') {
      if (tied.tiebreak !== null && tied.tiebreak !== undefined) {
        errors.push(
          issue(
            'set.tiedAtTarget.tiebreak',
            MATCH_RULE_ERROR_CODES.CONTRADICTION,
            'Continue-games sets cannot also define a normal-set tiebreak.',
          ),
        )
      }
    } else {
      errors.push(
        issue(
          'set.tiedAtTarget.mode',
          MATCH_RULE_ERROR_CODES.VALUE,
          'Tied-target mode must be tiebreak or continue.',
        ),
      )
    }
  }

  const game = snapshot.game
  if (!game || typeof game !== 'object') {
    errors.push(issue('game', MATCH_RULE_ERROR_CODES.REQUIRED, 'Game rules are required.'))
  } else if (game.mode === 'traditional') {
    if (!['advantage', 'no_ad'].includes(game.deuce)) {
      errors.push(
        issue(
          'game.deuce',
          MATCH_RULE_ERROR_CODES.VALUE,
          'Traditional deuce must be advantage or no_ad.',
        ),
      )
    }
    if (game.pointsToWin !== undefined || game.winBy !== undefined) {
      errors.push(
        issue(
          'game',
          MATCH_RULE_ERROR_CODES.CONTRADICTION,
          'Traditional games cannot also define numeric point rules.',
        ),
      )
    }
  } else if (game.mode === 'numeric') {
    validateInteger(
      game.pointsToWin,
      'game.pointsToWin',
      MATCH_RULE_LIMITS.numericGamePointsToWin,
      errors,
    )
    validateInteger(game.winBy, 'game.winBy', MATCH_RULE_LIMITS.numericGameWinBy, errors)
    if (game.deuce !== undefined) {
      errors.push(
        issue(
          'game.deuce',
          MATCH_RULE_ERROR_CODES.CONTRADICTION,
          'Numeric games do not use traditional deuce rules.',
        ),
      )
    }
  } else {
    errors.push(
      issue('game.mode', MATCH_RULE_ERROR_CODES.VALUE, 'Game mode must be traditional or numeric.'),
    )
  }

  const deciding = snapshot.decidingSet
  if (!deciding || typeof deciding !== 'object') {
    errors.push(
      issue('decidingSet', MATCH_RULE_ERROR_CODES.REQUIRED, 'Deciding-set behavior is required.'),
    )
  } else if (deciding.mode === 'match_tiebreak') {
    validateTieBreak(
      deciding,
      'decidingSet',
      MATCH_RULE_LIMITS.decidingMatchTieBreakPointsToWin,
      MATCH_RULE_LIMITS.decidingMatchTieBreakWinBy,
      errors,
    )
  } else if (deciding.mode !== 'normal_set') {
    errors.push(
      issue(
        'decidingSet.mode',
        MATCH_RULE_ERROR_CODES.VALUE,
        'Deciding-set mode must be normal_set or match_tiebreak.',
      ),
    )
  } else if (deciding.pointsToWin !== undefined || deciding.winBy !== undefined) {
    errors.push(
      issue(
        'decidingSet',
        MATCH_RULE_ERROR_CODES.CONTRADICTION,
        'A normal deciding set cannot also define match-tiebreak points.',
      ),
    )
  }

  return { valid: errors.length === 0, errors, warnings }
}

export class MatchRulesValidationError extends Error {
  constructor(validation) {
    super(validation.errors[0]?.message || 'Invalid MatchRulesSnapshot.')
    this.name = 'MatchRulesValidationError'
    this.code = 'MATCH_RULES_INVALID'
    this.errors = validation.errors
    this.warnings = validation.warnings
  }
}

export function assertValidMatchRulesSnapshot(snapshot) {
  const validation = validateMatchRulesSnapshot(snapshot)
  if (!validation.valid) {
    throw new MatchRulesValidationError(validation)
  }
  return snapshot
}

export function freezeMatchRulesSnapshot(snapshot) {
  assertValidMatchRulesSnapshot(snapshot)

  function freeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
    Object.values(value).forEach(freeze)
    return Object.freeze(value)
  }

  return freeze(clone(snapshot))
}
