import { assertValidMatchRulesSnapshot } from './matchRules.js'

/*
 * The one canonical boundary between source-neutral rules and the scoring
 * engine's backwards-compatible flat configuration.
 */
export function toTennisEngineConfig(matchRulesSnapshot) {
  assertValidMatchRulesSnapshot(matchRulesSnapshot)

  if (matchRulesSnapshot.match.mode === 'tiebreak') {
    return {
      mode: 'tiebreak',
      scoring: 'ad',
      gameMode: 'traditional',
      setsToWin: 1,
      bestOfSets: 1,
      gamesPerSet: 0,
      setWinBy: 2,
      tieBreakBehavior: 'continue',
      tieBreakAt: 0,
      tieBreakPoints: matchRulesSnapshot.match.tiebreak.pointsToWin,
      tieBreakWinBy: matchRulesSnapshot.match.tiebreak.winBy,
      numericGamePoints: 4,
      numericGameWinBy: 2,
      decidingMatchTieBreak: false,
      decidingTieBreakPoints: 10,
      decidingTieBreakWinBy: 2,
    }
  }

  const tiedAtTarget = matchRulesSnapshot.set.tiedAtTarget
  const game = matchRulesSnapshot.game
  const deciding = matchRulesSnapshot.decidingSet
  const setsToWin = matchRulesSnapshot.match.setsToWin

  return {
    mode: 'sets',
    setsToWin,
    bestOfSets: setsToWin * 2 - 1,
    gamesPerSet: matchRulesSnapshot.set.gamesToWin,
    setWinBy: matchRulesSnapshot.set.winBy,
    tieBreakBehavior: tiedAtTarget.mode,
    tieBreakAt: tiedAtTarget.mode === 'tiebreak' ? matchRulesSnapshot.set.gamesToWin : 0,
    tieBreakPoints: tiedAtTarget.mode === 'tiebreak' ? tiedAtTarget.tiebreak.pointsToWin : 7,
    tieBreakWinBy: tiedAtTarget.mode === 'tiebreak' ? tiedAtTarget.tiebreak.winBy : 2,
    gameMode: game.mode,
    scoring: game.mode === 'traditional' && game.deuce === 'no_ad' ? 'noad' : 'ad',
    numericGamePoints: game.mode === 'numeric' ? game.pointsToWin : 4,
    numericGameWinBy: game.mode === 'numeric' ? game.winBy : 2,
    decidingMatchTieBreak: deciding.mode === 'match_tiebreak',
    decidingTieBreakPoints: deciding.mode === 'match_tiebreak' ? deciding.pointsToWin : 10,
    decidingTieBreakWinBy: deciding.mode === 'match_tiebreak' ? deciding.winBy : 2,
  }
}
