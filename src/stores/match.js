import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { usePlayerStore } from './player'
import { getMatches, submitMatchResult } from '../services/MatchService'

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

        const playerStore = usePlayerStore()
        await playerStore.loadPlayers()
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
    submitResult,
  }
})
