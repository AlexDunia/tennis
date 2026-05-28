import { onMounted, onUnmounted } from 'vue'
import { useMatchStore } from '../stores/match'
import { useTournamentStore } from '../stores/tournament'

export function useTournamentLiveRefresh(tournamentId, options = {}) {
  const intervalMs = Number(options.intervalMs || 1000)
  const matchStore = useMatchStore()
  const tournamentStore = useTournamentStore()
  let intervalId = null
  let isRefreshing = false

  async function refresh() {
    if (!tournamentId.value || isRefreshing) {
      return
    }

    if (typeof document !== 'undefined' && document.hidden) {
      return
    }

    isRefreshing = true
    try {
      await Promise.all([
        tournamentStore.fetchTournament(tournamentId.value),
        matchStore.loadMatches(),
      ])
    } finally {
      isRefreshing = false
    }
  }

  onMounted(() => {
    intervalId = window.setInterval(refresh, intervalMs)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', refresh)
    }
  })

  onUnmounted(() => {
    if (intervalId) {
      window.clearInterval(intervalId)
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', refresh)
    }
  })

  return {
    refreshTournamentData: refresh,
  }
}
