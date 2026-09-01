import { createStandardMatchRulesSnapshot, validateMatchRulesSnapshot } from '../matchRules.js'
import { resolvedRuleAdapter, unresolvedRuleAdapter } from './adapterResult.js'

function scoringValues(source) {
  return [
    source.scoring,
    source.matchConfig?.scoring,
    source.settings?.scoring,
    source.category?.settings?.scoring,
    source.event?.settings?.scoring,
  ].filter(Boolean)
}

export function tournamentRulesToMatchRulesSnapshot(source = {}) {
  const explicitSnapshot =
    source.rulesSnapshot || source.matchRulesSnapshot || source.matchConfig?.rulesSnapshot
  if (explicitSnapshot) {
    const validation = validateMatchRulesSnapshot(explicitSnapshot)
    return validation.valid
      ? resolvedRuleAdapter('tournament', explicitSnapshot)
      : {
          ok: false,
          source: 'tournament',
          state: 'invalid',
          snapshot: null,
          issues: validation.errors,
          warnings: validation.warnings,
        }
  }

  const scoringCandidates = [...new Set(scoringValues(source))]
  if (scoringCandidates.length > 1) {
    return unresolvedRuleAdapter(
      'tournament',
      'Legacy Tournament rule sources conflict; no scoring format was selected.',
      'settings.scoring',
    )
  }

  const scoring = scoringCandidates[0] || null
  if (!['best3', 'matchtb', 'oneset'].includes(scoring)) {
    return unresolvedRuleAdapter(
      'tournament',
      'Legacy Tournament data does not identify an unambiguous scoring format.',
      'settings.scoring',
    )
  }

  return resolvedRuleAdapter(
    'tournament',
    createStandardMatchRulesSnapshot({
      match: { mode: 'sets', setsToWin: scoring === 'oneset' ? 1 : 2 },
      game: { mode: 'traditional', deuce: 'advantage' },
      decidingSet:
        scoring === 'matchtb'
          ? { mode: 'match_tiebreak', pointsToWin: 10, winBy: 2 }
          : { mode: 'normal_set' },
    }),
    [
      {
        path: 'game',
        code: 'legacy_inherited_default',
        message:
          'Tournament format IDs do not encode game/set detail; this preserves the current Advantage and standard-set-tiebreak behavior.',
      },
    ],
  )
}
