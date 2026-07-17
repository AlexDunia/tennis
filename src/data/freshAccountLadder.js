export const FRESH_ACCOUNT_LADDER_SCOPE = 'fresh-account-ladder'

const FRESH_ACCOUNT_LADDER_MEMBER_IDS = Object.freeze([
  'player-01',
  'player-02',
  'player-03',
  'player-04',
  'player-05',
  'player-06',
  'player-07',
  'player-08',
])

export function buildFreshAccountLadderRoster(players = []) {
  const memberIds = new Set(FRESH_ACCOUNT_LADDER_MEMBER_IDS)

  return players
    .filter((player) => memberIds.has(player.id))
    .map((player) => ({
      ...player,
      wins: 0,
      losses: 0,
      matchesPlayed: 0,
      winRate: 0,
      movement: 0,
      recentForm: [],
    }))
    .sort((a, b) => a.rank - b.rank)
}

