import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useNotificationStore } from './notification'
import { usePlayerStore } from './player'
import { getMatches, submitMatchResult, updateMatch } from '../services/MatchService'

export const useMatchStore = defineStore('match', () => {
  const matches = ref([])
  const isLoading = ref(false)
  const error = ref('')

  const matchById = computed(() => (id) => matches.value.find((match) => match.id === id) || null)
  const scheduledMatches = computed(() =>
    matches.value.filter((match) => match.status === 'scheduled'),
  )
  const pendingReviewMatches = computed(() =>
    matches.value.filter((match) => match.status === 'pending_review'),
  )
  const openChallenges = computed(() =>
    matches.value.filter(
      (match) => match.status === 'scheduled' || match.status === 'pending_review',
    ),
  )

  const loadMatches = async () => {
    error.value = ''
    isLoading.value = true

    try {
      const response = await getMatches()
      if (response.success) {
        matches.value = response.data
        const notificationStore = useNotificationStore()
        const playerStore = usePlayerStore()
        notificationStore.syncTournamentMatchEvents(response.data, playerStore.currentPlayerId)
        return response.data
      }

      error.value = response.message || 'Unable to load matches.'
    } catch (loadError) {
      error.value = loadError?.message || 'Unable to load matches.'
    } finally {
      isLoading.value = false
    }

    return []
  }

  const patchMatch = async (matchId, payload) => {
    error.value = ''

    try {
      const response = await updateMatch(matchId, payload)
      if (response.success) {
        const matchIndex = matches.value.findIndex((match) => match.id === matchId)
        if (matchIndex !== -1) {
          matches.value[matchIndex] = response.data
        } else {
          matches.value.push(response.data)
        }

        return response.data
      }

      error.value = response.message || 'Unable to update match.'
    } catch (updateError) {
      error.value = updateError?.message || 'Unable to update match.'
    }

    return null
  }

  const saveLiveState = async (matchId, liveState) => {
    return patchMatch(matchId, { liveState })
  }

  const submitResult = async (matchId, payload) => {
    error.value = ''
    isLoading.value = true

    try {
      const response = await submitMatchResult(matchId, payload)
      if (response.success) {
        const matchIndex = matches.value.findIndex((match) => match.id === matchId)
        if (matchIndex !== -1) {
          matches.value[matchIndex] = response.data
        }

        if (response.data.type !== 'tournament') {
          const playerStore = usePlayerStore()
          await playerStore.loadPlayers()
        } else {
          const notificationStore = useNotificationStore()
          const playerStore = usePlayerStore()
          notificationStore.rememberMatchEvent(response.data)
        }
        return response.data
      }

      error.value = response.message || 'Unable to submit match result.'
    } catch (submitError) {
      error.value = submitError?.message || 'Unable to submit match result.'
    } finally {
      isLoading.value = false
    }

    return null
  }

  return {
    matches,
    isLoading,
    error,
    matchById,
    scheduledMatches,
    pendingReviewMatches,
    openChallenges,
    loadMatches,
    patchMatch,
    saveLiveState,
    submitResult,
  }
})
