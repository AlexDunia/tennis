export function normalizeTournamentPhysicalResult(match, session) {
  const engineState = session?.engineState
  const sets = Array.isArray(engineState?.completedSets) ? engineState.completedSets : []
  const winnerKey = engineState?.matchWinner
  const playerAId = match?.sides?.[0]?.id
  const playerBId = match?.sides?.[1]?.id
  if (
    session?.status !== 'completed' ||
    !session?.resultId ||
    !['playerA', 'playerB'].includes(winnerKey) ||
    !playerAId ||
    !playerBId
  ) {
    return { ok: false, result: null, message: 'The physical Match result is incomplete.' }
  }

  const setPayload = sets.map((set, index) => ({
    setNumber: index + 1,
    winner: set.winner,
    games: {
      playerA: Number(set.games?.playerA || 0),
      playerB: Number(set.games?.playerB || 0),
    },
    tieBreak: set.tieBreak
      ? {
          winner: set.tieBreak.winner,
          score: {
            playerA: Number(set.tieBreak.score?.playerA || 0),
            playerB: Number(set.tieBreak.score?.playerB || 0),
          },
        }
      : null,
    isMatchTieBreak: Boolean(set.isMatchTieBreak),
  }))

  return {
    ok: true,
    result: {
      resultId: session.resultId,
      p1Sets: sets.filter((set) => set.winner === 'playerA').length,
      p2Sets: sets.filter((set) => set.winner === 'playerB').length,
      p1Games: sets.reduce((total, set) => total + Number(set.games?.playerA || 0), 0),
      p2Games: sets.reduce((total, set) => total + Number(set.games?.playerB || 0), 0),
      sets: setPayload,
      winnerId: winnerKey === 'playerA' ? playerAId : playerBId,
      status: 'completed',
      completedAt: session.completedAt,
    },
  }
}
