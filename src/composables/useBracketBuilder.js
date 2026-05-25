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

function createCompletedByeMatch({ tournamentId, categoryId, stage, matchCode, player }) {
  const match = createWaitingMatch({ tournamentId, categoryId, stage, matchCode })

  return {
    ...match,
    player1Id: player.id,
    player1Name: player.name,
    player2Id: null,
    player2Name: 'BYE',
    p1Sets: 2,
    p2Sets: 0,
    p1Games: 12,
    p2Games: 0,
    winnerId: player.id,
    winnerName: player.name,
    status: 'completed',
    score: 'BYE',
  }
}

function toBracketPlayer(standing) {
  return {
    id: standing?.playerId || null,
    name: standing?.name || null,
  }
}

function toBracketPlayerFromTournamentPlayer(player) {
  return {
    id: player?.playerId || player?.id || null,
    name: player?.name || null,
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

export function createEmptyKnockout(tournamentId, categoryId, knockoutFormat = 'top4-crossover') {
  const shouldCreateQuarterFinals = ['top4-crossover', 'four-groups-quarterfinals', 'direct-knockout'].includes(
    knockoutFormat,
  )
  const shouldCreateSemiFinals = knockoutFormat !== 'round-robin-only' && knockoutFormat !== 'one-group-final'

  return {
    format: knockoutFormat,
    quarterFinals: shouldCreateQuarterFinals
      ? ['QF1', 'QF2', 'QF3', 'QF4'].map((matchCode) =>
          createWaitingMatch({ tournamentId, categoryId, stage: 'quarterfinal', matchCode }),
        )
      : [],
    semiFinals: shouldCreateSemiFinals
      ? ['SF1', 'SF2'].map((matchCode) =>
          createWaitingMatch({ tournamentId, categoryId, stage: 'semifinal', matchCode }),
        )
      : [],
    final:
      knockoutFormat === 'round-robin-only'
        ? null
        : createWaitingMatch({ tournamentId, categoryId, stage: 'final', matchCode: 'Final' }),
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

function getTop(standingsByGroup, groupId, rankIndex) {
  return toBracketPlayer(standingsByGroup[groupId]?.[rankIndex])
}

function generateOneGroupFinal(category, standingsByGroup) {
  const knockout = category.knockout || createEmptyKnockout(category.tournamentId, category.id, 'one-group-final')
  const groupId = category.groups[0]?.id

  return {
    ...knockout,
    format: 'one-group-final',
    final: assignPlayers(knockout.final, getTop(standingsByGroup, groupId, 0), getTop(standingsByGroup, groupId, 1)),
  }
}

function generateOneGroupSemiFinals(category, standingsByGroup) {
  const knockout = category.knockout || createEmptyKnockout(category.tournamentId, category.id, 'one-group-semifinals')
  const groupId = category.groups[0]?.id
  const pairings = [
    [getTop(standingsByGroup, groupId, 0), getTop(standingsByGroup, groupId, 3)],
    [getTop(standingsByGroup, groupId, 1), getTop(standingsByGroup, groupId, 2)],
  ]

  return {
    ...knockout,
    format: 'one-group-semifinals',
    semiFinals: knockout.semiFinals.map((match, index) =>
      assignPlayers(match, pairings[index][0], pairings[index][1]),
    ),
  }
}

function generateTwoGroupSemiFinals(category, standingsByGroup) {
  const knockout = category.knockout || createEmptyKnockout(category.tournamentId, category.id, 'two-groups-semifinals')
  const groupA = category.groups[0]?.id
  const groupB = category.groups[1]?.id
  const pairings = [
    [getTop(standingsByGroup, groupA, 0), getTop(standingsByGroup, groupB, 1)],
    [getTop(standingsByGroup, groupB, 0), getTop(standingsByGroup, groupA, 1)],
  ]

  return {
    ...knockout,
    format: 'two-groups-semifinals',
    semiFinals: knockout.semiFinals.map((match, index) =>
      assignPlayers(match, pairings[index][0], pairings[index][1]),
    ),
  }
}

function generateFourGroupQuarterFinals(category, standingsByGroup) {
  const knockout = category.knockout || createEmptyKnockout(category.tournamentId, category.id, 'four-groups-quarterfinals')
  const [groupA, groupB, groupC, groupD] = category.groups.map((group) => group.id)
  const pairings = [
    [getTop(standingsByGroup, groupA, 0), getTop(standingsByGroup, groupB, 1)],
    [getTop(standingsByGroup, groupB, 0), getTop(standingsByGroup, groupA, 1)],
    [getTop(standingsByGroup, groupC, 0), getTop(standingsByGroup, groupD, 1)],
    [getTop(standingsByGroup, groupD, 0), getTop(standingsByGroup, groupC, 1)],
  ]

  return {
    ...knockout,
    format: 'four-groups-quarterfinals',
    quarterFinals: knockout.quarterFinals.map((match, index) =>
      assignPlayers(match, pairings[index][0], pairings[index][1]),
    ),
  }
}

export function generateKnockoutForCategory(category, standingsByGroup) {
  const knockoutFormat = category.settings?.knockoutFormat || category.knockoutFormat || category.knockout?.format

  switch (knockoutFormat) {
    case 'one-group-final':
      return generateOneGroupFinal(category, standingsByGroup)
    case 'one-group-semifinals':
      return generateOneGroupSemiFinals(category, standingsByGroup)
    case 'two-groups-semifinals':
      return generateTwoGroupSemiFinals(category, standingsByGroup)
    case 'four-groups-quarterfinals':
      return generateFourGroupQuarterFinals(category, standingsByGroup)
    case 'round-robin-only':
      return {
        ...createEmptyKnockout(category.tournamentId, category.id, 'round-robin-only'),
      }
    case 'top4-crossover':
    default:
      return generateQuarterFinals(category, standingsByGroup.A || [], standingsByGroup.B || [])
  }
}

export function generateDirectKnockout(category, players = []) {
  const seededPlayers = players
    .filter((player) => !player.isBye)
    .sort((playerOne, playerTwo) => Number(playerOne.seed || 9999) - Number(playerTwo.seed || 9999))
    .map(toBracketPlayerFromTournamentPlayer)
  const knockout = createEmptyKnockout(category.tournamentId, category.id, 'direct-knockout')
  const bracketSlots = 8
  const paddedPlayers = [...seededPlayers]

  while (paddedPlayers.length < bracketSlots) {
    paddedPlayers.push({ id: null, name: 'BYE' })
  }

  const pairings = [
    [paddedPlayers[0], paddedPlayers[7]],
    [paddedPlayers[3], paddedPlayers[4]],
    [paddedPlayers[1], paddedPlayers[6]],
    [paddedPlayers[2], paddedPlayers[5]],
  ]

  return {
    ...knockout,
    quarterFinals: knockout.quarterFinals.map((match, index) => {
      const [playerOne, playerTwo] = pairings[index]

      if (playerOne?.id && !playerTwo?.id) {
        return createCompletedByeMatch({
          tournamentId: category.tournamentId,
          categoryId: category.id,
          stage: 'quarterfinal',
          matchCode: match.matchCode,
          player: playerOne,
        })
      }

      if (!playerOne?.id && playerTwo?.id) {
        return createCompletedByeMatch({
          tournamentId: category.tournamentId,
          categoryId: category.id,
          stage: 'quarterfinal',
          matchCode: match.matchCode,
          player: playerTwo,
        })
      }

      return assignPlayers(match, playerOne, playerTwo)
    }),
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
