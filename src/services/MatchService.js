import ApiService from './ApiService'

export async function getMatches() {
  // Mock data for demo - 10 completed matches
  const mockMatches = [
    {
      id: 'match1',
      playerA: { id: 'player-02', name: 'You' },
      playerB: { id: 'player2', name: 'Opponent 1' },
      challengerName: 'Opponent 1',
      defenderName: 'You',
      winnerId: 'player-02', // You win
      score: '6-4',
      status: 'completed',
      completedAt: '2024-04-01T10:00:00Z',
    },
    {
      id: 'match2',
      playerA: { id: 'player-02', name: 'You' },
      playerB: { id: 'player3', name: 'Opponent 2' },
      challengerName: 'Opponent 2',
      defenderName: 'You',
      winnerId: 'player3', // Loss
      score: '4-6',
      status: 'completed',
      completedAt: '2024-04-02T10:00:00Z',
    },
    {
      id: 'match3',
      playerA: { id: 'player4', name: 'Opponent 3' },
      playerB: { id: 'player-02', name: 'You' },
      challengerName: 'You',
      defenderName: 'Opponent 3',
      winnerId: 'player-02', // Win
      score: '7-5',
      status: 'completed',
      completedAt: '2024-04-03T10:00:00Z',
    },
    {
      id: 'match4',
      playerA: { id: 'player-02', name: 'You' },
      playerB: { id: 'player5', name: 'Opponent 4' },
      challengerName: 'Opponent 4',
      defenderName: 'You',
      winnerId: 'player5', // Loss
      score: '6-3',
      status: 'completed',
      completedAt: '2024-04-04T10:00:00Z',
    },
    {
      id: 'match5',
      playerA: { id: 'player6', name: 'Opponent 5' },
      playerB: { id: 'player-02', name: 'You' },
      challengerName: 'You',
      defenderName: 'Opponent 5',
      winnerId: 'player-02', // Win
      score: '6-2',
      status: 'completed',
      completedAt: '2024-04-05T10:00:00Z',
    },
    {
      id: 'match6',
      playerA: { id: 'player-02', name: 'You' },
      playerB: { id: 'player7', name: 'Opponent 6' },
      challengerName: 'Opponent 6',
      defenderName: 'You',
      winnerId: 'player-02', // Win
      score: '6-4',
      status: 'completed',
      completedAt: '2024-04-06T10:00:00Z',
    },
    {
      id: 'match7',
      playerA: { id: 'player8', name: 'Opponent 7' },
      playerB: { id: 'player-02', name: 'You' },
      challengerName: 'You',
      defenderName: 'Opponent 7',
      winnerId: 'player8', // Loss
      score: '7-6',
      status: 'completed',
      completedAt: '2024-04-07T10:00:00Z',
    },
    {
      id: 'match8',
      playerA: { id: 'player-02', name: 'You' },
      playerB: { id: 'player9', name: 'Opponent 8' },
      challengerName: 'Opponent 8',
      defenderName: 'You',
      winnerId: 'player-02', // Win
      score: '6-1',
      status: 'completed',
      completedAt: '2024-04-08T10:00:00Z',
    },
    {
      id: 'match9',
      playerA: { id: 'player10', name: 'Opponent 9' },
      playerB: { id: 'player-02', name: 'You' },
      challengerName: 'You',
      defenderName: 'Opponent 9',
      winnerId: 'player-02', // Win
      score: '6-3',
      status: 'completed',
      completedAt: '2024-04-09T10:00:00Z',
    },
    {
      id: 'match10',
      playerA: { id: 'player-02', name: 'You' },
      playerB: { id: 'player11', name: 'Opponent 10' },
      challengerName: 'Opponent 10',
      defenderName: 'You',
      winnerId: 'player11', // Loss
      score: '4-6',
      status: 'completed',
      completedAt: '2024-04-10T10:00:00Z',
    },
  ]

  return {
    data: {
      success: true,
      data: mockMatches,
    },
  }
}

export async function submitMatchResult(matchId, payload) {
  const response = await ApiService.post(`/matches/${matchId}/result`, payload)
  return response.data
}
