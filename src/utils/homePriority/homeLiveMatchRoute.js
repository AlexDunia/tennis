export function homeLiveMatchRoute(priority) {
  if (!priority?.matchId) return null
  return {
    name: ['ladder', 'tournament'].includes(priority.matchType) ? 'LiveMatch' : 'FriendlyMatchLive',
    params: { matchId: priority.matchId },
  }
}
