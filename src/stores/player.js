import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getPlayers } from '../services/PlayerService'

export const usePlayerStore = defineStore('player', () => {
  const players = ref([])
  const currentPlayerId = ref('player-02')
  const isLoading = ref(false)
  const error = ref('')

  const sortedLadder = computed(() => [...players.value].sort((a, b) => a.rank - b.rank))
  const currentPlayer = computed(
    () => players.value.find((player) => player.id === currentPlayerId.value) || null,
  )
  const availableOpponents = computed(() => {
    const activePlayer = players.value.find((player) => player.id === currentPlayerId.value)
    if (!activePlayer) {
      return []
    }

    return players.value
      .filter((player) => player.rank < activePlayer.rank)
      .filter((player) => activePlayer.rank - player.rank <= 3)
      .sort((a, b) => a.rank - b.rank)
  })

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
    loadPlayers,
  }
})
