const DEFAULT_BYE_SCORE = {
  p1Sets: 2,
  p2Sets: 0,
  p1Games: 12,
  p2Games: 0,
}

function createFixtureId({ tournamentId, categoryId, groupId, playerOne, playerTwo }) {
  return [
    'tm',
    tournamentId,
    categoryId,
    groupId,
    playerOne.playerId,
    playerTwo.playerId,
  ].join('-')
}

function createLiveState() {
  return {
    currentSet: 0,
    p1Points: 0,
    p2Points: 0,
    p1GamesThisSet: 0,
    p2GamesThisSet: 0,
    p1SetsWon: 0,
    p2SetsWon: 0,
    isTiebreak: false,
    currentServerId: null,
    completedSets: [],
    winnerId: null,
    startedAt: null,
    completedAt: null,
  }
}

function createByeFixture({ tournamentId, categoryId, groupId, playerOne, playerTwo }) {
  const realPlayer = playerOne.isBye ? playerTwo : playerOne
  const isPlayerOneWinner = realPlayer.playerId === playerOne.playerId
  const byeScore = isPlayerOneWinner
    ? DEFAULT_BYE_SCORE
    : {
        p1Sets: 0,
        p2Sets: 2,
        p1Games: 0,
        p2Games: 12,
      }

  return {
    id: createFixtureId({ tournamentId, categoryId, groupId, playerOne, playerTwo }),
    type: 'tournament',
    tournamentId,
    categoryId,
    groupId,
    round: 'group',
    player1Id: playerOne.playerId,
    player2Id: playerTwo.playerId,
    player1Name: playerOne.name,
    player2Name: playerTwo.name,
    player1Seed: playerOne.seed,
    player2Seed: playerTwo.seed,
    challengerId: playerOne.playerId,
    defenderId: playerTwo.playerId,
    isBye: true,
    p1Sets: byeScore.p1Sets,
    p2Sets: byeScore.p2Sets,
    p1Games: byeScore.p1Games,
    p2Games: byeScore.p2Games,
    sets: [],
    liveState: createLiveState(),
    winnerId: realPlayer.playerId,
    status: 'walkover',
    scheduledDate: null,
    scheduledTime: null,
    scheduledAt: null,
    court: null,
    score: `${byeScore.p1Sets}-${byeScore.p2Sets}`,
  }
}

function createPendingFixture({ tournamentId, categoryId, groupId, playerOne, playerTwo }) {
  return {
    id: createFixtureId({ tournamentId, categoryId, groupId, playerOne, playerTwo }),
    type: 'tournament',
    tournamentId,
    categoryId,
    groupId,
    round: 'group',
    player1Id: playerOne.playerId,
    player2Id: playerTwo.playerId,
    player1Name: playerOne.name,
    player2Name: playerTwo.name,
    player1Seed: playerOne.seed,
    player2Seed: playerTwo.seed,
    challengerId: playerOne.playerId,
    defenderId: playerTwo.playerId,
    isBye: false,
    p1Sets: null,
    p2Sets: null,
    p1Games: null,
    p2Games: null,
    sets: [],
    liveState: createLiveState(),
    winnerId: null,
    status: 'pending',
    scheduledDate: null,
    scheduledTime: null,
    scheduledAt: null,
    court: null,
    score: null,
  }
}

export function generateRoundRobinFixtures({
  tournamentId,
  categoryId,
  groupId,
  groupPlayers = [],
}) {
  const fixtures = []

  for (let playerIndex = 0; playerIndex < groupPlayers.length; playerIndex += 1) {
    for (let opponentIndex = playerIndex + 1; opponentIndex < groupPlayers.length; opponentIndex += 1) {
      const playerOne = groupPlayers[playerIndex]
      const playerTwo = groupPlayers[opponentIndex]

      // BYE-vs-BYE pairings are not playable matches, so they are skipped entirely.
      if (playerOne.isBye && playerTwo.isBye) {
        continue
      }

      const fixture = playerOne.isBye || playerTwo.isBye
        ? createByeFixture({ tournamentId, categoryId, groupId, playerOne, playerTwo })
        : createPendingFixture({ tournamentId, categoryId, groupId, playerOne, playerTwo })

      fixtures.push(fixture)
    }
  }

  return fixtures
}

export function createTournamentLiveState() {
  return createLiveState()
}
