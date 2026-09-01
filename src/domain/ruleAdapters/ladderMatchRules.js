import { createStandardMatchRulesSnapshot, validateMatchRulesSnapshot } from '../matchRules.js'
import { resolvedRuleAdapter, unresolvedRuleAdapter } from './adapterResult.js'

function setsToWinFromFormat(value) {
  const match = String(value || '').match(/^(?:best[_-]of[_-])([13579])$/)
  return match ? Math.ceil(Number(match[1]) / 2) : null
}

export function ladderRulesToMatchRulesSnapshot(source = {}) {
  const explicitSnapshot =
    source.rulesSnapshot || source.matchRulesSnapshot || source.matchConfig?.rulesSnapshot
  if (explicitSnapshot) {
    const validation = validateMatchRulesSnapshot(explicitSnapshot)
    return validation.valid
      ? resolvedRuleAdapter('ladder', explicitSnapshot)
      : {
          ok: false,
          source: 'ladder',
          state: 'invalid',
          snapshot: null,
          issues: validation.errors,
          warnings: validation.warnings,
        }
  }

  const matchConfig = source.matchConfig || {}
  const ladder = source.ladderConfigSnapshot || source.ladderConfig || {}
  const setsToWin =
    setsToWinFromFormat(matchConfig.matchFormat) ||
    setsToWinFromFormat(ladder.matchFormat) ||
    (['standard-club', 'time-smart'].includes(ladder.matchPreset) ? 2 : null)
  if (!setsToWin) {
    return unresolvedRuleAdapter(
      'ladder',
      'Legacy Ladder data does not identify a supported match format.',
      'matchConfig.matchFormat',
    )
  }

  const scoringRule =
    matchConfig.gameScoringRule ||
    (ladder.scoring === 'noad' ? 'sudden_death' : ladder.scoring === 'ad' ? 'normal' : null)
  if (!['normal', 'sudden_death'].includes(scoringRule)) {
    return unresolvedRuleAdapter(
      'ladder',
      'Legacy Ladder data does not identify Advantage or No-Ad scoring.',
      'matchConfig.gameScoringRule',
    )
  }

  const setWinRule =
    matchConfig.setWinRule ||
    (ladder.tieBreakAt === 0 ? 'no_tiebreak' : ladder.matchPreset ? 'standard' : null)
  if (!['standard', 'no_tiebreak'].includes(setWinRule)) {
    return unresolvedRuleAdapter(
      'ladder',
      'Legacy Ladder data does not identify its normal-set tied-target rule.',
      'matchConfig.setWinRule',
    )
  }

  const finalSetRule =
    matchConfig.finalSetRule ||
    (ladder.matchPreset === 'time-smart' || ladder.decidingMatchTieBreak === true
      ? 'super_tiebreak'
      : ladder.matchPreset === 'standard-club'
        ? 'same'
        : null)
  if (!['same', 'super_tiebreak'].includes(finalSetRule)) {
    return unresolvedRuleAdapter(
      'ladder',
      'Legacy Ladder data does not identify its deciding-set rule.',
      'matchConfig.finalSetRule',
    )
  }

  const warnings = []
  if (
    matchConfig.gameScoringRule &&
    ladder.scoring &&
    (matchConfig.gameScoringRule === 'sudden_death') !== (ladder.scoring === 'noad')
  ) {
    warnings.push({
      path: 'matchConfig.gameScoringRule',
      code: 'source_conflict',
      message: 'Locked Match configuration overrides a conflicting Ladder snapshot.',
    })
  }

  return resolvedRuleAdapter(
    'ladder',
    createStandardMatchRulesSnapshot({
      match: { mode: 'sets', setsToWin },
      set: {
        gamesToWin: Number(matchConfig.gamesToWin ?? ladder.gamesToWin ?? 6),
        winBy: Number(matchConfig.setWinBy ?? ladder.setWinBy ?? 2),
        tiedAtTarget: {
          mode: setWinRule === 'no_tiebreak' ? 'continue' : 'tiebreak',
          tiebreak:
            setWinRule === 'no_tiebreak'
              ? null
              : {
                  pointsToWin: Number(
                    matchConfig.tieBreakPointsToWin ?? ladder.tieBreakPointsToWin ?? 7,
                  ),
                  winBy: Number(matchConfig.tieBreakWinBy ?? ladder.tieBreakWinBy ?? 2),
                },
        },
      },
      game:
        matchConfig.gameMode === 'numeric'
          ? {
              mode: 'numeric',
              deuce: undefined,
              pointsToWin: Number(matchConfig.numericGamePointsToWin),
              winBy: Number(matchConfig.numericGameWinBy),
            }
          : {
              mode: 'traditional',
              deuce: scoringRule === 'sudden_death' ? 'no_ad' : 'advantage',
            },
      decidingSet:
        finalSetRule === 'super_tiebreak'
          ? {
              mode: 'match_tiebreak',
              pointsToWin: Number(
                matchConfig.decidingTieBreakPointsToWin ?? ladder.decidingTieBreakPointsToWin ?? 10,
              ),
              winBy: Number(matchConfig.decidingTieBreakWinBy ?? ladder.decidingTieBreakWinBy ?? 2),
            }
          : { mode: 'normal_set' },
    }),
    warnings,
  )
}

/*
 * Temporary legacy projection for setup records that are still consumed by
 * pre-canonical Ladder screens. MatchRulesSnapshot remains authoritative.
 */
export function matchRulesSnapshotToLegacyLadderConfig(snapshot) {
  const validation = validateMatchRulesSnapshot(snapshot)
  if (!validation.valid) return null

  if (snapshot.match.mode === 'tiebreak') {
    return {
      matchType: 'singles',
      matchFormat: 'match_tiebreak',
      matchTieBreakPointsToWin: snapshot.match.tiebreak.pointsToWin,
      matchTieBreakWinBy: snapshot.match.tiebreak.winBy,
      locked: true,
    }
  }

  return {
    matchType: 'singles',
    matchFormat: `best_of_${snapshot.match.setsToWin * 2 - 1}`,
    gamesToWin: snapshot.set.gamesToWin,
    setWinBy: snapshot.set.winBy,
    setWinRule: snapshot.set.tiedAtTarget.mode === 'tiebreak' ? 'standard' : 'no_tiebreak',
    tieBreakPointsToWin: snapshot.set.tiedAtTarget.tiebreak?.pointsToWin,
    tieBreakWinBy: snapshot.set.tiedAtTarget.tiebreak?.winBy,
    gameMode: snapshot.game.mode,
    gameScoringRule:
      snapshot.game.mode === 'traditional' && snapshot.game.deuce === 'no_ad'
        ? 'sudden_death'
        : 'normal',
    numericGamePointsToWin:
      snapshot.game.mode === 'numeric' ? snapshot.game.pointsToWin : undefined,
    numericGameWinBy: snapshot.game.mode === 'numeric' ? snapshot.game.winBy : undefined,
    finalSetRule: snapshot.decidingSet.mode === 'match_tiebreak' ? 'super_tiebreak' : 'same',
    decidingTieBreakPointsToWin:
      snapshot.decidingSet.mode === 'match_tiebreak'
        ? snapshot.decidingSet.pointsToWin
        : undefined,
    decidingTieBreakWinBy:
      snapshot.decidingSet.mode === 'match_tiebreak' ? snapshot.decidingSet.winBy : undefined,
    locked: true,
  }
}
