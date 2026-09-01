import { validateMatchRulesSnapshot } from '../domain/matchRules.js'

function winBy(value) {
  return `win by ${value}`
}

export function formatMatchRulesSummary(snapshot) {
  const validation = validateMatchRulesSnapshot(snapshot)
  if (!validation.valid) {
    return {
      valid: false,
      match: 'Match format unavailable',
      set: '',
      tiebreak: '',
      decidingSet: '',
      game: '',
      rows: [],
      concise: ['Match format unavailable'],
      errors: validation.errors,
    }
  }

  if (snapshot.match.mode === 'tiebreak') {
    const match = `First to ${snapshot.match.tiebreak.pointsToWin} points · ${winBy(
      snapshot.match.tiebreak.winBy,
    )}`
    return {
      valid: true,
      match,
      set: '',
      tiebreak: '',
      decidingSet: '',
      game: 'Standalone match tiebreak',
      rows: [
        { key: 'match', label: 'Match', value: match },
        { key: 'game', label: 'Game', value: 'Standalone match tiebreak' },
      ],
      concise: [match, 'Standalone match tiebreak'],
      errors: [],
    }
  }

  const match =
    snapshot.match.setsToWin === 1
      ? 'One set'
      : `Best of ${snapshot.match.setsToWin * 2 - 1} sets`
  const set = `First to ${snapshot.set.gamesToWin} games · ${winBy(snapshot.set.winBy)}`
  const tiebreak =
    snapshot.set.tiedAtTarget.mode === 'tiebreak'
      ? `${snapshot.set.tiedAtTarget.tiebreak.pointsToWin}-point tiebreak at ${snapshot.set.gamesToWin}–${snapshot.set.gamesToWin}`
      : 'No set tiebreak · keep playing games'
  const game =
    snapshot.game.mode === 'traditional'
      ? `Traditional · ${snapshot.game.deuce === 'no_ad' ? 'No-Ad' : 'Advantage'}`
      : `Simple points · First to ${snapshot.game.pointsToWin} · ${winBy(snapshot.game.winBy)}`
  const decidingSet =
    snapshot.match.setsToWin === 1
      ? ''
      : snapshot.decidingSet.mode === 'match_tiebreak'
        ? `${snapshot.decidingSet.pointsToWin}-point deciding match tiebreak`
        : 'Normal deciding set'
  const rows = [
    { key: 'match', label: 'Match', value: match },
    { key: 'set', label: 'Set', value: set },
    { key: 'tiebreak', label: 'Tiebreak', value: tiebreak },
    ...(decidingSet ? [{ key: 'decidingSet', label: 'Deciding set', value: decidingSet }] : []),
    { key: 'game', label: 'Game', value: game },
  ]

  return {
    valid: true,
    match,
    set,
    tiebreak,
    decidingSet,
    game,
    rows,
    concise: rows.map((row) => row.value),
    errors: [],
  }
}
