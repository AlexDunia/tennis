import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createScoreboard,
  describePoint,
  getPointStatus,
  normalizeScoreboard,
  recordPoint,
  setServer,
  undoLastPoint,
} from '../src/utils/tennisScoring.js'
import {
  createStandaloneMatchTieBreakRules,
  createStandardMatchRulesSnapshot,
} from '../src/domain/matchRules.js'
import { toTennisEngineConfig } from '../src/domain/toTennisEngineConfig.js'

function fromRules(rules) {
  return createScoreboard({
    players: { playerA: 'A', playerB: 'B' },
    config: toTennisEngineConfig(rules),
    startedAt: '2026-09-01T10:00:00.000Z',
  })
}

function scorePoints(scoreboard, playerKey, count) {
  let next = scoreboard
  for (let index = 0; index < count; index += 1) {
    next = recordPoint(next, playerKey)
  }
  return next
}

function winGame(scoreboard, playerKey) {
  return scorePoints(
    scoreboard,
    playerKey,
    scoreboard.config.gameMode === 'numeric' ? scoreboard.config.numericGamePoints : 4,
  )
}

function winGames(scoreboard, playerKey, count) {
  let next = scoreboard
  for (let index = 0; index < count; index += 1) {
    next = winGame(next, playerKey)
  }
  return next
}

function standardRules(overrides = {}) {
  return createStandardMatchRulesSnapshot(overrides)
}

test('traditional game progresses Love, 15, 30, 40, game', () => {
  let score = fromRules(standardRules())
  assert.equal(describePoint(score, 'playerA'), 'Love')
  for (const label of ['15', '30', '40']) {
    score = recordPoint(score, 'playerA')
    assert.equal(describePoint(score, 'playerA'), label)
  }
  score = recordPoint(score, 'playerA')
  assert.equal(score.sets[0].games.playerA, 1)
  assert.equal(describePoint(score, 'playerA'), 'Love')
})

test('Advantage game handles deuce, advantage gained/lost, and two-point win', () => {
  let score = fromRules(standardRules())
  score = scorePoints(score, 'playerA', 3)
  score = scorePoints(score, 'playerB', 3)
  assert.equal(getPointStatus(score), 'Deuce')

  score = recordPoint(score, 'playerA')
  assert.equal(describePoint(score, 'playerA'), 'Advantage')
  score = recordPoint(score, 'playerB')
  assert.equal(getPointStatus(score), 'Deuce')
  score = scorePoints(score, 'playerA', 2)
  assert.equal(score.sets[0].games.playerA, 1)
})

test('No-Ad uses a deciding point at 40-40 and never exposes Advantage', () => {
  let score = fromRules(standardRules({ game: { mode: 'traditional', deuce: 'no_ad' } }))
  score = scorePoints(score, 'playerA', 3)
  score = scorePoints(score, 'playerB', 3)
  assert.equal(getPointStatus(score), 'Deciding point')
  assert.notEqual(describePoint(score, 'playerA'), 'Advantage')
  score = recordPoint(score, 'playerB')
  assert.equal(score.sets[0].games.playerB, 1)
  assert.equal(score.currentGame.advantage, null)
})

test('standard sets complete at 6-0, 6-4, and 7-5 but not 6-5', () => {
  let sixLove = fromRules(standardRules())
  sixLove = winGames(sixLove, 'playerA', 6)
  assert.equal(sixLove.completedSets[0].games.playerA, 6)

  let sixFour = fromRules(standardRules())
  sixFour = winGames(sixFour, 'playerA', 5)
  sixFour = winGames(sixFour, 'playerB', 4)
  sixFour = winGame(sixFour, 'playerA')
  assert.deepEqual(sixFour.completedSets[0].games, { playerA: 6, playerB: 4 })

  let sevenFive = fromRules(standardRules())
  sevenFive = winGames(sevenFive, 'playerA', 5)
  sevenFive = winGames(sevenFive, 'playerB', 5)
  sevenFive = winGames(sevenFive, 'playerA', 2)
  assert.deepEqual(sevenFive.completedSets[0].games, { playerA: 7, playerB: 5 })

  let sixFive = fromRules(standardRules())
  sixFive = winGames(sixFive, 'playerA', 5)
  sixFive = winGames(sixFive, 'playerB', 5)
  sixFive = winGame(sixFive, 'playerA')
  assert.equal(sixFive.completedSets.length, 0)
  assert.deepEqual(sixFive.sets[0].games, { playerA: 6, playerB: 5 })
})

test('normal tiebreak starts at 6-6, rotates service, and completes the set', () => {
  let score = fromRules(standardRules())
  score = winGames(score, 'playerA', 5)
  score = winGames(score, 'playerB', 5)
  score = winGame(score, 'playerA')
  score = winGame(score, 'playerB')
  assert.equal(score.currentGame.inTieBreak, true)
  assert.equal(score.currentServer, 'playerA')

  score = recordPoint(score, 'playerA')
  assert.equal(score.currentServer, 'playerB')
  score = recordPoint(score, 'playerA')
  assert.equal(score.currentServer, 'playerB')
  score = recordPoint(score, 'playerA')
  assert.equal(score.currentServer, 'playerA')
  score = scorePoints(score, 'playerA', 4)

  assert.equal(score.completedSets[0].winner, 'playerA')
  assert.deepEqual(score.completedSets[0].games, { playerA: 7, playerB: 6 })
  assert.deepEqual(score.completedSets[0].tieBreak.score, { playerA: 7, playerB: 0 })
})

test('sets-to-win and Best-of-three style winner detection remain intact', () => {
  let score = fromRules(standardRules({ match: { mode: 'sets', setsToWin: 2 } }))
  score = winGames(score, 'playerA', 6)
  assert.equal(score.matchWinner, null)
  score = winGames(score, 'playerA', 6)
  assert.equal(score.matchWinner, 'playerA')
  assert.equal(score.status, 'finished')
  assert.equal(score.config.bestOfSets, 3)
})

test('deciding match tiebreak activates only at one set all and completes match', () => {
  let score = fromRules(
    standardRules({
      match: { mode: 'sets', setsToWin: 2 },
      decidingSet: { mode: 'match_tiebreak', pointsToWin: 10, winBy: 2 },
    }),
  )
  score = winGames(score, 'playerA', 6)
  assert.equal(score.currentGame.inTieBreak, false)
  score = winGames(score, 'playerB', 6)
  assert.equal(score.currentGame.inTieBreak, true)
  assert.equal(score.currentGame.isMatchTieBreak, true)
  score = scorePoints(score, 'playerA', 10)
  assert.equal(score.matchWinner, 'playerA')
  assert.equal(score.completedSets.at(-1).isMatchTieBreak, true)
})

test('deciding match tiebreak honors its own custom winning margin', () => {
  let score = fromRules(
    standardRules({
      match: { mode: 'sets', setsToWin: 2 },
      decidingSet: { mode: 'match_tiebreak', pointsToWin: 7, winBy: 3 },
    }),
  )
  score = winGames(score, 'playerA', 6)
  score = winGames(score, 'playerB', 6)
  score = scorePoints(score, 'playerA', 6)
  score = scorePoints(score, 'playerB', 5)
  score = recordPoint(score, 'playerA')
  assert.equal(score.matchWinner, null)
  score = recordPoint(score, 'playerA')
  assert.equal(score.matchWinner, 'playerA')
  assert.deepEqual(score.completedSets.at(-1).tieBreak.score, { playerA: 8, playerB: 5 })
})

test('standalone match tiebreak remains supported', () => {
  let score = fromRules(createStandaloneMatchTieBreakRules({ pointsToWin: 10, winBy: 2 }))
  assert.equal(score.currentGame.inTieBreak, true)
  score = scorePoints(score, 'playerB', 10)
  assert.equal(score.matchWinner, 'playerB')
  assert.equal(score.completedSets[0].isMatchTieBreak, true)
})

test('undo restores point, game, set, tiebreak, and match while revision increases', () => {
  let point = fromRules(standardRules())
  point = recordPoint(point, 'playerA')
  const pointRevision = point.revision
  point = undoLastPoint(point)
  assert.equal(point.currentGame.points.playerA, 0)
  assert.ok(point.revision > pointRevision)

  let game = fromRules(standardRules())
  game = scorePoints(game, 'playerA', 4)
  const gameRevision = game.revision
  game = undoLastPoint(game)
  assert.equal(game.sets[0].games.playerA, 0)
  assert.equal(game.currentGame.points.playerA, 3)
  assert.ok(game.revision > gameRevision)

  let set = fromRules(standardRules())
  set = winGames(set, 'playerA', 5)
  set = scorePoints(set, 'playerA', 4)
  set = undoLastPoint(set)
  assert.equal(set.completedSets.length, 0)
  assert.equal(set.sets[0].games.playerA, 5)

  let tie = fromRules(standardRules())
  tie = winGames(tie, 'playerA', 5)
  tie = winGames(tie, 'playerB', 5)
  tie = winGame(tie, 'playerA')
  tie = winGame(tie, 'playerB')
  tie = scorePoints(tie, 'playerA', 7)
  tie = undoLastPoint(tie)
  assert.equal(tie.currentGame.inTieBreak, true)
  assert.equal(tie.currentGame.tieBreakPoints.playerA, 6)

  let match = fromRules(standardRules({ match: { mode: 'sets', setsToWin: 1 } }))
  match = winGames(match, 'playerA', 6)
  const completedRevision = match.revision
  match = undoLastPoint(match)
  assert.equal(match.matchWinner, null)
  assert.equal(match.status, 'live')
  assert.ok(match.revision > completedRevision)
})

test('server rotation, correction, and undo restoration remain correct', () => {
  let score = fromRules(standardRules())
  assert.equal(score.currentServer, 'playerA')
  score = winGame(score, 'playerA')
  assert.equal(score.currentServer, 'playerB')
  const corrected = setServer(score, 'playerA')
  assert.equal(corrected.currentServer, 'playerA')

  let endingPoint = scorePoints(score, 'playerB', 3)
  endingPoint = recordPoint(endingPoint, 'playerB')
  assert.equal(endingPoint.currentServer, 'playerA')
  const restored = undoLastPoint(endingPoint)
  assert.equal(restored.currentServer, 'playerB')
})

test('old schema scoreboards normalize with new defaults without losing live score', () => {
  let score = createScoreboard('Legacy A', 'Legacy B', 3)
  score = scorePoints(score, 'playerA', 2)
  const legacy = JSON.parse(JSON.stringify(score))
  legacy.schemaVersion = 2
  delete legacy.config.gameMode
  delete legacy.config.setWinBy
  delete legacy.config.tieBreakBehavior
  delete legacy.config.tieBreakWinBy
  delete legacy.config.numericGamePoints
  delete legacy.config.numericGameWinBy
  delete legacy.config.decidingTieBreakWinBy

  const normalized = normalizeScoreboard(legacy)
  assert.equal(normalized.schemaVersion, 3)
  assert.equal(normalized.currentGame.points.playerA, 2)
  assert.equal(normalized.config.gameMode, 'traditional')
  assert.equal(normalized.config.setWinBy, 2)
  assert.equal(normalized.config.tieBreakWinBy, 2)
})

test('custom first-to-four set wins by two', () => {
  let score = fromRules(
    standardRules({
      match: { mode: 'sets', setsToWin: 1 },
      set: { gamesToWin: 4, winBy: 2 },
    }),
  )
  score = winGames(score, 'playerA', 3)
  score = winGames(score, 'playerB', 2)
  score = winGame(score, 'playerA')
  assert.equal(score.matchWinner, 'playerA')
  assert.deepEqual(score.completedSets[0].games, { playerA: 4, playerB: 2 })
})

test('custom set win-by three rejects 6-4 and finishes 7-4', () => {
  let score = fromRules(
    standardRules({
      match: { mode: 'sets', setsToWin: 1 },
      set: {
        gamesToWin: 6,
        winBy: 3,
        tiedAtTarget: { mode: 'continue', tiebreak: null },
      },
    }),
  )
  score = winGames(score, 'playerA', 5)
  score = winGames(score, 'playerB', 4)
  score = winGame(score, 'playerA')
  assert.equal(score.matchWinner, null)
  score = winGame(score, 'playerA')
  assert.equal(score.matchWinner, 'playerA')
  assert.deepEqual(score.completedSets[0].games, { playerA: 7, playerB: 4 })
})

test('continue-games set plays through 6-6 and finishes 8-6', () => {
  let score = fromRules(
    standardRules({
      match: { mode: 'sets', setsToWin: 1 },
      set: {
        gamesToWin: 6,
        winBy: 2,
        tiedAtTarget: { mode: 'continue', tiebreak: null },
      },
    }),
  )
  score = winGames(score, 'playerA', 5)
  score = winGames(score, 'playerB', 5)
  score = winGame(score, 'playerA')
  score = winGame(score, 'playerB')
  assert.equal(score.currentGame.inTieBreak, false)
  assert.equal(score.matchWinner, null)
  score = winGames(score, 'playerA', 2)
  assert.deepEqual(score.completedSets[0].games, { playerA: 8, playerB: 6 })
})

test('custom tiebreak target and custom win-by are enforced', () => {
  let tenPoint = fromRules(
    standardRules({
      match: { mode: 'sets', setsToWin: 1 },
      set: {
        tiedAtTarget: {
          mode: 'tiebreak',
          tiebreak: { pointsToWin: 10, winBy: 2 },
        },
      },
    }),
  )
  tenPoint = winGames(tenPoint, 'playerA', 5)
  tenPoint = winGames(tenPoint, 'playerB', 5)
  tenPoint = winGame(tenPoint, 'playerA')
  tenPoint = winGame(tenPoint, 'playerB')
  tenPoint = scorePoints(tenPoint, 'playerA', 10)
  assert.equal(tenPoint.matchWinner, 'playerA')
  assert.equal(tenPoint.completedSets[0].tieBreak.score.playerA, 10)

  let marginThree = fromRules(
    standardRules({
      match: { mode: 'sets', setsToWin: 1 },
      set: {
        tiedAtTarget: {
          mode: 'tiebreak',
          tiebreak: { pointsToWin: 7, winBy: 3 },
        },
      },
    }),
  )
  marginThree = winGames(marginThree, 'playerA', 5)
  marginThree = winGames(marginThree, 'playerB', 5)
  marginThree = winGame(marginThree, 'playerA')
  marginThree = winGame(marginThree, 'playerB')
  marginThree = scorePoints(marginThree, 'playerA', 6)
  marginThree = scorePoints(marginThree, 'playerB', 5)
  marginThree = recordPoint(marginThree, 'playerA')
  assert.equal(marginThree.matchWinner, null)
  marginThree = recordPoint(marginThree, 'playerA')
  assert.equal(marginThree.matchWinner, 'playerA')
  assert.deepEqual(marginThree.completedSets[0].tieBreak.score, { playerA: 8, playerB: 5 })
})

test('numeric first-to-four win-by-two and win-by-one award normal games', () => {
  const numeric = standardRules({
    game: { mode: 'numeric', deuce: undefined, pointsToWin: 4, winBy: 2 },
  })

  let fourTwo = fromRules(numeric)
  fourTwo = scorePoints(fourTwo, 'playerA', 3)
  fourTwo = scorePoints(fourTwo, 'playerB', 2)
  fourTwo = recordPoint(fourTwo, 'playerA')
  assert.equal(fourTwo.sets[0].games.playerA, 1)

  let extended = fromRules(numeric)
  extended = scorePoints(extended, 'playerA', 3)
  extended = scorePoints(extended, 'playerB', 3)
  extended = recordPoint(extended, 'playerA')
  assert.equal(extended.sets[0].games.playerA, 0)
  assert.equal(getPointStatus(extended), '4 – 3')
  extended = recordPoint(extended, 'playerA')
  assert.equal(extended.sets[0].games.playerA, 1)

  let winByOne = fromRules(
    standardRules({
      game: { mode: 'numeric', deuce: undefined, pointsToWin: 4, winBy: 1 },
    }),
  )
  winByOne = scorePoints(winByOne, 'playerA', 3)
  winByOne = scorePoints(winByOne, 'playerB', 3)
  winByOne = recordPoint(winByOne, 'playerA')
  assert.equal(winByOne.sets[0].games.playerA, 1)
})

test('undo works after numeric game, custom set, custom tiebreak, and custom match completion', () => {
  let numeric = fromRules(
    standardRules({
      game: { mode: 'numeric', deuce: undefined, pointsToWin: 4, winBy: 2 },
    }),
  )
  numeric = scorePoints(numeric, 'playerA', 4)
  numeric = undoLastPoint(numeric)
  assert.equal(numeric.sets[0].games.playerA, 0)
  assert.equal(numeric.currentGame.points.playerA, 3)

  let customSet = fromRules(
    standardRules({
      match: { mode: 'sets', setsToWin: 1 },
      set: { gamesToWin: 4, winBy: 2 },
    }),
  )
  customSet = winGames(customSet, 'playerA', 4)
  customSet = undoLastPoint(customSet)
  assert.equal(customSet.matchWinner, null)
  assert.equal(customSet.sets[0].games.playerA, 3)

  let customTie = fromRules(createStandaloneMatchTieBreakRules({ pointsToWin: 7, winBy: 3 }))
  customTie = scorePoints(customTie, 'playerA', 7)
  customTie = undoLastPoint(customTie)
  assert.equal(customTie.matchWinner, null)
  assert.equal(customTie.currentGame.tieBreakPoints.playerA, 6)
})

test('custom game and set rules do not change normal game service rotation', () => {
  let score = fromRules(
    standardRules({
      set: { gamesToWin: 4, winBy: 2 },
      game: { mode: 'numeric', deuce: undefined, pointsToWin: 4, winBy: 2 },
    }),
  )
  score = scorePoints(score, 'playerA', 4)
  assert.equal(score.currentServer, 'playerB')
  score = undoLastPoint(score)
  assert.equal(score.currentServer, 'playerA')
})
