const pointLabels = ['Love', '15', '30', '40']

function createGameState() {
  return {
    points: { playerA: 0, playerB: 0 },
    advantage: null,
    inTieBreak: false,
    tieBreakPoints: { playerA: 0, playerB: 0 },
  }
}

function createSets(bestOfSets) {
  return Array.from({ length: bestOfSets }, () => ({
    games: { playerA: 0, playerB: 0 },
    winner: null,
    tieBreak: null,
  }))
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function getOpponent(playerKey) {
  return playerKey === 'playerA' ? 'playerB' : 'playerA'
}

function calculateSetWins(scoreboard, playerKey) {
  return scoreboard.completedSets.filter((set) => set.winner === playerKey).length
}

function finalizeSet(scoreboard, playerKey) {
  const opponentKey = getOpponent(playerKey)
  const set = scoreboard.sets[scoreboard.currentSetIndex]
  if (!set) {
    return scoreboard
  }
  set.winner = playerKey
  scoreboard.completedSets.push({
    winner: playerKey,
    games: { ...set.games },
    tieBreak: set.tieBreak,
  })
  scoreboard.currentGame = createGameState()
  scoreboard.currentSetIndex = Math.min(scoreboard.currentSetIndex + 1, scoreboard.bestOfSets - 1)
  if (calculateSetWins(scoreboard, playerKey) >= Math.ceil(scoreboard.bestOfSets / 2)) {
    scoreboard.matchWinner = playerKey
  }
}

function startTieBreak(scoreboard) {
  scoreboard.currentGame.inTieBreak = true
  scoreboard.currentGame.tieBreakPoints = { playerA: 0, playerB: 0 }
}

function resetGame(scoreboard) {
  scoreboard.currentGame.points = { playerA: 0, playerB: 0 }
  scoreboard.currentGame.advantage = null
  scoreboard.currentGame.inTieBreak = false
  scoreboard.currentGame.tieBreakPoints = { playerA: 0, playerB: 0 }
}

export function createScoreboard(playerA = 'Server', playerB = 'Returner', bestOfSets = 3) {
  return {
    players: { playerA, playerB },
    sets: createSets(bestOfSets),
    currentSetIndex: 0,
    currentGame: createGameState(),
    completedSets: [],
    matchWinner: null,
    bestOfSets,
  }
}

export function recordPoint(originalScoreboard, playerKey) {
  if (!originalScoreboard) {
    return null
  }
  const scoreboard = clone(originalScoreboard)
  if (scoreboard.matchWinner) {
    return scoreboard
  }
  const opponentKey = getOpponent(playerKey)
  const set = scoreboard.sets[scoreboard.currentSetIndex]
  if (!set || set.winner) {
    return scoreboard
  }
  if (scoreboard.currentGame.inTieBreak) {
    scoreboard.currentGame.tieBreakPoints[playerKey] += 1
    const playerPoints = scoreboard.currentGame.tieBreakPoints[playerKey]
    const opponentPoints = scoreboard.currentGame.tieBreakPoints[opponentKey]
    if (playerPoints >= 7 && playerPoints - opponentPoints >= 2) {
      set.tieBreak = {
        winner: playerKey,
        score: { ...scoreboard.currentGame.tieBreakPoints },
      }
      set.games[playerKey] += 1
      finalizeSet(scoreboard, playerKey)
    }
    return scoreboard
  }
  scoreboard.currentGame.points[playerKey] += 1
  const playerPoints = scoreboard.currentGame.points[playerKey]
  const opponentPoints = scoreboard.currentGame.points[opponentKey]
  if (playerPoints >= 4 && playerPoints - opponentPoints >= 2) {
    set.games[playerKey] += 1
    resetGame(scoreboard)
    if (set.games[playerKey] === 6 && set.games[opponentKey] === 6) {
      scoreboard.currentGame.inTieBreak = true
      scoreboard.currentGame.tieBreakPoints = { playerA: 0, playerB: 0 }
      return scoreboard
    }
    if (set.games[playerKey] >= 6 && set.games[playerKey] - set.games[opponentKey] >= 2) {
      finalizeSet(scoreboard, playerKey)
    }
    return scoreboard
  }
  if (playerPoints >= 3 && opponentPoints >= 3) {
    if (playerPoints === opponentPoints) {
      scoreboard.currentGame.advantage = null
    } else if (playerPoints - opponentPoints === 1) {
      scoreboard.currentGame.advantage = playerKey
    } else if (opponentPoints - playerPoints === 1) {
      scoreboard.currentGame.advantage = opponentKey
    }
  }
  return scoreboard
}

export function describePoint(scoreboard, playerKey) {
  const opponentKey = getOpponent(playerKey)
  const { points, advantage, inTieBreak, tieBreakPoints } = scoreboard.currentGame
  if (inTieBreak) {
    return tieBreakPoints[playerKey].toString()
  }
  if (points[playerKey] >= 3 && points[opponentKey] >= 3) {
    if (advantage === playerKey) {
      return 'Advantage'
    }
    if (advantage === null && points[playerKey] === points[opponentKey]) {
      return 'Deuce'
    }
    if (advantage === opponentKey) {
      return '40'
    }
  }
  return pointLabels[points[playerKey]] ?? '40'
}

export function formatSetSummary(scoreboard) {
  return scoreboard.sets.map((set, index) => ({
    label: `Set ${index + 1}`,
    playerAGames: set.games.playerA,
    playerBGames: set.games.playerB,
    winner: set.winner,
    tieBreak: set.tieBreak,
  }))
}
