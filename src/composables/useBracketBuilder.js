function createWaitingMatch({ tournamentId, categoryId, stage, matchCode }) {
  return {
    id: `ko-${tournamentId}-${categoryId}-${matchCode.toLowerCase()}`,
    tournamentId,
    categoryId,
    stage,
    round: stage,
    matchCode,
    player1Id: null,
    player1Name: null,
    player2Id: null,
    player2Name: null,
    p1Sets: null,
    p2Sets: null,
    p1Games: null,
    p2Games: null,
    winnerId: null,
    winnerName: null,
    status: 'waiting',
    scheduledDate: null,
    scheduledTime: null,
    scheduledAt: null,
    court: null,
  }
}

function toBracketPlayer(standing) {
  return {
    id: standing?.playerId || null,
    name: standing?.name || null,
  }
}

function assignPlayers(match, playerOne, playerTwo) {
  return {
    ...match,
    player1Id: playerOne.id,
    player1Name: playerOne.name,
    player2Id: playerTwo.id,
    player2Name: playerTwo.name,
    status: playerOne.id && playerTwo.id ? 'pending' : 'waiting',
  }
}

export function createEmptyKnockout(tournamentId, categoryId) {
  return {
    quarterFinals: ['QF1', 'QF2', 'QF3', 'QF4'].map((matchCode) =>
      createWaitingMatch({ tournamentId, categoryId, stage: 'quarterfinal', matchCode }),
    ),
    semiFinals: ['SF1', 'SF2'].map((matchCode) =>
      createWaitingMatch({ tournamentId, categoryId, stage: 'semifinal', matchCode }),
    ),
    final: createWaitingMatch({ tournamentId, categoryId, stage: 'final', matchCode: 'Final' }),
    championId: null,
    championName: null,
  }
}

export function generateQuarterFinals(category, groupAStandings, groupBStandings) {
  const knockout = category.knockout || createEmptyKnockout(category.tournamentId, category.id)
  const groupA = groupAStandings.slice(0, 4).map(toBracketPlayer)
  const groupB = groupBStandings.slice(0, 4).map(toBracketPlayer)

  // Crossover bracket seeding keeps same-group leaders apart until later rounds.
  const pairings = [
    [groupA[0], groupB[3]],
    [groupB[1], groupA[2]],
    [groupB[0], groupA[3]],
    [groupA[1], groupB[2]],
  ]

  return {
    ...knockout,
    quarterFinals: knockout.quarterFinals.map((match, index) =>
      assignPlayers(match, pairings[index][0], pairings[index][1]),
    ),
  }
}

function getCompletedWinner(match) {
  if (match?.status !== 'completed' || !match.winnerId) {
    return null
  }

  return {
    id: match.winnerId,
    name: match.winnerName || (match.winnerId === match.player1Id ? match.player1Name : match.player2Name),
  }
}

export function generateSemiFinals(knockout) {
  const qfWinners = knockout.quarterFinals.map(getCompletedWinner)
  const semiFinals = [...knockout.semiFinals]

  if (qfWinners[0] && qfWinners[1]) {
    semiFinals[0] = assignPlayers(semiFinals[0], qfWinners[0], qfWinners[1])
  }

  if (qfWinners[2] && qfWinners[3]) {
    semiFinals[1] = assignPlayers(semiFinals[1], qfWinners[2], qfWinners[3])
  }

  return { ...knockout, semiFinals }
}

export function generateFinal(knockout) {
  const finalists = knockout.semiFinals.map(getCompletedWinner)
  if (!finalists[0] || !finalists[1]) {
    return knockout
  }

  return {
    ...knockout,
    final: assignPlayers(knockout.final, finalists[0], finalists[1]),
  }
}

export function setChampion(category, finalMatch) {
  const winnerName =
    finalMatch.winnerName ||
    (finalMatch.winnerId === finalMatch.player1Id ? finalMatch.player1Name : finalMatch.player2Name)

  return {
    ...category,
    status: 'completed',
    knockout: {
      ...category.knockout,
      final: finalMatch,
      championId: finalMatch.winnerId,
      championName: winnerName,
    },
  }
}

export function progressKnockout(category) {
  const afterSemi = generateSemiFinals(category.knockout)
  const afterFinal = generateFinal(afterSemi)
  const finalMatch = afterFinal.final

  if (finalMatch?.status === 'completed' && finalMatch.winnerId) {
    return setChampion({ ...category, knockout: afterFinal }, finalMatch)
  }

  return { ...category, knockout: afterFinal }
}
