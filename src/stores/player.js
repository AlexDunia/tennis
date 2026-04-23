import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getPlayers } from '../services/PlayerService'

export const usePlayerStore = defineStore('player', () => {
  // 6. REACTIVE STATE
  const players = ref([])
  const currentPlayerId = ref('player-02')
  const isLoading = ref(false)
  const error = ref('')

  // 7. COMPUTED PROPERTIES

  // All players sorted by rank ascending (rank 1 = top of ladder)
  const sortedLadder = computed(() => [...players.value].sort((a, b) => a.rank - b.rank))

  const currentPlayer = computed(
    () => players.value.find((player) => player.id === currentPlayerId.value) ?? null,
  )

  // Players ranked higher (lower rank number) than the current player
  // and within 3 positions — these are the only legal challenge targets
  const availableOpponents = computed(() => {
    const active = currentPlayer.value
    if (!active) return []

    return players.value
      .filter((player) => {
        const isHigherRanked = player.rank < active.rank
        const isWithinWindow = active.rank - player.rank <= 3
        return isHigherRanked && isWithinWindow
      })
      .sort((a, b) => a.rank - b.rank)
  })

  // Returns one of three zone labels for a given player relative to the current player:
  // 'challengeable' — legal challenge target (within 3 ranks above)
  // 'self'          — the current logged-in player
  // 'out-of-range'  — everyone else (too far above, or ranked below)
  const getPlayerZone = computed(() => {
    return (playerId) => {
      if (playerId === currentPlayerId.value) return 'self'
      const isChallengeable = availableOpponents.value.some((p) => p.id === playerId)
      return isChallengeable ? 'challengeable' : 'out-of-range'
    }
  })

  // 8. ACTIONS

  const loadPlayers = async () => {
    error.value = ''
    isLoading.value = true

    try {
      const response = await getPlayers()

      if (response.success) {
        players.value = response.data
        return response.data
      }

      error.value = response.message || 'Unable to load players.'
    } catch (loadError) {
      error.value = loadError?.message || 'Unable to load players.'
    } finally {
      isLoading.value = false
    }

    return []
  }

  return {
    players,
    currentPlayerId,
    isLoading,
    error,
    sortedLadder,
    currentPlayer,
    availableOpponents,
    getPlayerZone,
    loadPlayers,
  }
})
