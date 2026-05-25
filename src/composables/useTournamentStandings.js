const DEFAULT_RULES = {
  winPoints: 1,
  qualifiersPerGroup: 4,
}

function createStanding(player) {
  return {
    playerId: player.playerId,
    name: player.name,
    seed: player.seed,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    points: 0,
    setsFor: 0,
    setsAgainst: 0,
    setDiff: 0,
    gamesFor: 0,
    gamesAgainst: 0,
    gameDiff: 0,
    rank: 0,
    qualified: false,
  }
}

function addMatchStats(standing, match, rules) {
  const isPlayerOne = standing.playerId === match.player1Id
  const setsFor = isPlayerOne ? match.p1Sets : match.p2Sets
  const setsAgainst = isPlayerOne ? match.p2Sets : match.p1Sets
  const gamesFor = isPlayerOne ? match.p1Games : match.p2Games
  const gamesAgainst = isPlayerOne ? match.p2Games : match.p1Games
  const hasWon = match.winnerId === standing.playerId

  standing.matchesPlayed += match.isBye ? 0 : 1
  standing.wins += hasWon ? 1 : 0
  standing.losses = standing.matchesPlayed - standing.wins
  standing.points = standing.wins * rules.winPoints
  standing.setsFor += Number(setsFor || 0)
  standing.setsAgainst += Number(setsAgainst || 0)
  standing.gamesFor += Number(gamesFor || 0)
  standing.gamesAgainst += Number(gamesAgainst || 0)
}

function finalizeStanding(standing) {
  return {
    ...standing,
    setDiff: standing.setsFor - standing.setsAgainst,
    gameDiff: standing.gamesFor - standing.gamesAgainst,
  }
}

function sortStandings(playerOne, playerTwo) {
  // Tournament ranking order: wins create points first, then set and game margins break ties.
  if (playerTwo.points !== playerOne.points) return playerTwo.points - playerOne.points
  if (playerTwo.setDiff !== playerOne.setDiff) return playerTwo.setDiff - playerOne.setDiff
  if (playerTwo.gameDiff !== playerOne.gameDiff) return playerTwo.gameDiff - playerOne.gameDiff
  if (playerTwo.wins !== playerOne.wins) return playerTwo.wins - playerOne.wins
  return playerOne.name.localeCompare(playerTwo.name)
}

export function calculateGroupStandings(group, matches = [], tournamentRules = {}) {
  const rules = { ...DEFAULT_RULES, ...tournamentRules }
  const standingsByPlayer = new Map()

  // BYE slots must never appear in standings, even though their walkovers count as fixtures.
  group.players
    .filter((player) => !player.isBye)
    .forEach((player) => {
      standingsByPlayer.set(player.playerId, createStanding(player))
    })

  matches
    .filter((match) => match.groupId === group.id)
    .filter((match) => ['completed', 'walkover'].includes(match.status))
    .forEach((match) => {
      const playerOneStanding = standingsByPlayer.get(match.player1Id)
      const playerTwoStanding = standingsByPlayer.get(match.player2Id)

      if (playerOneStanding) addMatchStats(playerOneStanding, match, rules)
      if (playerTwoStanding) addMatchStats(playerTwoStanding, match, rules)
    })

  return [...standingsByPlayer.values()]
    .map(finalizeStanding)
    .sort(sortStandings)
    .map((standing, index) => ({
      ...standing,
      rank: index + 1,
      qualified: index + 1 <= rules.qualifiersPerGroup,
    }))
}
