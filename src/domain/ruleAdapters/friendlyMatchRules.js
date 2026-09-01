import {
  createStandaloneMatchTieBreakRules,
  createStandardMatchRulesSnapshot,
  freezeMatchRulesSnapshot,
  validateMatchRulesSnapshot,
} from '../matchRules.js'
import { resolvedRuleAdapter, unresolvedRuleAdapter } from './adapterResult.js'

export function withFriendlyScoringFormat(snapshot, format) {
  const validation = validateMatchRulesSnapshot(snapshot)
  if (!validation.valid || snapshot.match.mode !== 'sets' || !['ad', 'noad'].includes(format)) {
    return snapshot
  }

  return freezeMatchRulesSnapshot({
    ...snapshot,
    game: {
      mode: 'traditional',
      deuce: format === 'noad' ? 'no_ad' : 'advantage',
    },
  })
}

export function friendlyRulesToMatchRulesSnapshot(draft = {}) {
  const explicitSnapshot = draft.customFormat?.rulesSnapshot || draft.matchRulesSnapshot
  if (draft.matchFormat === 'custom' && explicitSnapshot) {
    const validation = validateMatchRulesSnapshot(explicitSnapshot)
    return validation.valid
      ? resolvedRuleAdapter('friendly', explicitSnapshot)
      : {
          ok: false,
          source: 'friendly',
          state: 'invalid',
          snapshot: null,
          issues: validation.errors,
          warnings: validation.warnings,
        }
  }

  const deuce = draft.format === 'noad' ? 'no_ad' : draft.format === 'ad' ? 'advantage' : null
  if (!deuce) {
    return unresolvedRuleAdapter(
      'friendly',
      'Friendly scoring must explicitly be Advantage or No-Ad.',
      'format',
    )
  }

  const custom = draft.matchFormat === 'custom' ? draft.customFormat : null
  const mode = custom?.mode || (draft.matchFormat === 'match-tiebreak' ? 'tiebreak' : 'sets')

  if (mode === 'tiebreak') {
    return resolvedRuleAdapter(
      'friendly',
      createStandaloneMatchTieBreakRules({
        pointsToWin: Number(custom?.tieBreakPoints ?? 10),
        winBy: Number(custom?.tieBreakWinBy ?? 2),
      }),
    )
  }

  if (!['best-of-3', 'one-set', 'custom'].includes(draft.matchFormat)) {
    return unresolvedRuleAdapter(
      'friendly',
      'Friendly match format is missing or unsupported.',
      'matchFormat',
    )
  }

  const setsToWin = Number(custom?.setsToWin ?? (draft.matchFormat === 'one-set' ? 1 : 2))
  const gamesToWin = Number(custom?.gamesPerSet ?? 6)
  const tieBreakAt = Number(custom?.tieBreakAt ?? 6)
  const tieBreakMode = tieBreakAt > 0 ? 'tiebreak' : 'continue'

  return resolvedRuleAdapter(
    'friendly',
    createStandardMatchRulesSnapshot({
      match: { mode: 'sets', setsToWin },
      set: {
        gamesToWin,
        winBy: Number(custom?.setWinBy ?? 2),
        tiedAtTarget: {
          mode: tieBreakMode,
          tiebreak:
            tieBreakMode === 'tiebreak'
              ? {
                  pointsToWin: Number(custom?.tieBreakPoints ?? 7),
                  winBy: Number(custom?.tieBreakWinBy ?? 2),
                }
              : null,
        },
      },
      game: { mode: 'traditional', deuce },
      decidingSet: { mode: 'normal_set' },
    }),
  )
}
