import {
  createStandaloneMatchTieBreakRules,
  createStandardMatchRulesSnapshot,
  validateMatchRulesSnapshot,
} from './matchRules.js'

function toWholeNumber(value) {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value)
  return Number.NaN
}

export function matchRulesSnapshotToDraft(snapshot) {
  const validation = validateMatchRulesSnapshot(snapshot)
  if (!validation.valid) {
    return { ok: false, draft: null, errors: validation.errors, warnings: validation.warnings }
  }

  if (snapshot.match.mode === 'tiebreak') {
    return {
      ok: true,
      errors: [],
      warnings: validation.warnings,
      draft: {
        matchMode: 'tiebreak',
        setsToWin: 2,
        standalonePointsToWin: snapshot.match.tiebreak.pointsToWin,
        standaloneWinBy: snapshot.match.tiebreak.winBy,
        gamesToWin: 6,
        setWinBy: 2,
        setTieMode: 'tiebreak',
        tieBreakPointsToWin: 7,
        tieBreakWinBy: 2,
        gameMode: 'traditional',
        traditionalDeuce: 'advantage',
        numericPointsToWin: 4,
        numericWinBy: 2,
        decidingSetMode: 'normal_set',
        decidingPointsToWin: 10,
        decidingWinBy: 2,
      },
    }
  }

  return {
    ok: true,
    errors: [],
    warnings: validation.warnings,
    draft: {
      matchMode: 'sets',
      setsToWin: snapshot.match.setsToWin,
      standalonePointsToWin: 10,
      standaloneWinBy: 2,
      gamesToWin: snapshot.set.gamesToWin,
      setWinBy: snapshot.set.winBy,
      setTieMode: snapshot.set.tiedAtTarget.mode,
      tieBreakPointsToWin: snapshot.set.tiedAtTarget.tiebreak?.pointsToWin ?? 7,
      tieBreakWinBy: snapshot.set.tiedAtTarget.tiebreak?.winBy ?? 2,
      gameMode: snapshot.game.mode,
      traditionalDeuce:
        snapshot.game.mode === 'traditional' ? snapshot.game.deuce : 'advantage',
      numericPointsToWin: snapshot.game.mode === 'numeric' ? snapshot.game.pointsToWin : 4,
      numericWinBy: snapshot.game.mode === 'numeric' ? snapshot.game.winBy : 2,
      decidingSetMode: snapshot.decidingSet.mode,
      decidingPointsToWin:
        snapshot.decidingSet.mode === 'match_tiebreak' ? snapshot.decidingSet.pointsToWin : 10,
      decidingWinBy:
        snapshot.decidingSet.mode === 'match_tiebreak' ? snapshot.decidingSet.winBy : 2,
    },
  }
}

export function matchRulesDraftToSnapshot(draft = {}) {
  let snapshot

  if (draft.matchMode === 'tiebreak') {
    snapshot = createStandaloneMatchTieBreakRules({
      pointsToWin: toWholeNumber(draft.standalonePointsToWin),
      winBy: toWholeNumber(draft.standaloneWinBy),
    })
  } else {
    const setsToWin = toWholeNumber(draft.setsToWin)
    const setWinBy = toWholeNumber(draft.setWinBy)
    const usesSetTieBreak = setWinBy > 1 && draft.setTieMode === 'tiebreak'
    const usesDecidingTieBreak = setsToWin > 1 && draft.decidingSetMode === 'match_tiebreak'

    snapshot = createStandardMatchRulesSnapshot({
      match: { mode: 'sets', setsToWin },
      set: {
        gamesToWin: toWholeNumber(draft.gamesToWin),
        winBy: setWinBy,
        tiedAtTarget: {
          mode: usesSetTieBreak ? 'tiebreak' : 'continue',
          tiebreak: usesSetTieBreak
            ? {
                pointsToWin: toWholeNumber(draft.tieBreakPointsToWin),
                winBy: toWholeNumber(draft.tieBreakWinBy),
              }
            : null,
        },
      },
      game:
        draft.gameMode === 'numeric'
          ? {
              mode: 'numeric',
              pointsToWin: toWholeNumber(draft.numericPointsToWin),
              winBy: toWholeNumber(draft.numericWinBy),
            }
          : {
              mode: 'traditional',
              deuce: draft.traditionalDeuce,
            },
      decidingSet: usesDecidingTieBreak
        ? {
            mode: 'match_tiebreak',
            pointsToWin: toWholeNumber(draft.decidingPointsToWin),
            winBy: toWholeNumber(draft.decidingWinBy),
          }
        : { mode: 'normal_set' },
    })
  }

  const validation = validateMatchRulesSnapshot(snapshot)
  return {
    ok: validation.valid,
    snapshot: validation.valid ? snapshot : null,
    candidate: snapshot,
    errors: validation.errors,
    warnings: validation.warnings,
  }
}
