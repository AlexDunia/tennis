import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { usePlayerStore } from './player'
import {
  acceptChallenge as acceptChallengeRequest,
  createChallenge as createChallengeRequest,
  declineChallenge as declineChallengeRequest,
  getChallenges,
  reviewChallenge as reviewChallengeRequest,
} from '../services/ChallengeService'
import {
  // ...your existing imports
  withdrawChallenge as withdrawChallengeRequest,
} from '../services/ChallengeService'

export const useChallengeStore = defineStore('challenge', () => {
  const challenges = ref([])
  const filterStatus = ref('all')
  const isLoading = ref(false)
  const error = ref('')

  const filteredChallenges = computed(() => {
    if (filterStatus.value === 'all') {
      return challenges.value
    }

    return challenges.value.filter((challenge) => challenge.status === filterStatus.value)
  })

  const summaryCounts = computed(() => ({
    awaiting: challenges.value.filter((challenge) => challenge.status === 'awaiting').length,
    scheduled: challenges.value.filter((challenge) => challenge.status === 'scheduled').length,
    pendingReview: challenges.value.filter((challenge) => challenge.status === 'pending_review')
      .length,
  }))

  const loadChallenges = async () => {
    error.value = ''
    isLoading.value = true

    try {
      const response = await getChallenges()
      if (response.success) {
        challenges.value = response.data
        return response.data
      }

      error.value = response.message || 'Unable to load challenges.'
    } catch (loadError) {
      error.value = loadError?.message || 'Unable to load challenges.'
    } finally {
      isLoading.value = false
    }

    return []
  }

  const createChallenge = async (payload) => {
    error.value = ''
    isLoading.value = true

    try {
      const response = await createChallengeRequest(payload)
      if (response.success) {
        challenges.value.push(response.data)
        return response.data
      }

      error.value = response.message || 'Unable to create challenge.'
    } catch (createError) {
      error.value = createError?.message || 'Unable to create challenge.'
    } finally {
      isLoading.value = false
    }

    return null
  }

  const acceptChallenge = async (challengeId, scheduledAt) => {
    error.value = ''
    isLoading.value = true

    try {
      const response = await acceptChallengeRequest(challengeId, scheduledAt)
      if (response.success) {
        const challengeIndex = challenges.value.findIndex((item) => item.id === challengeId)
        if (challengeIndex !== -1) {
          challenges.value[challengeIndex] = response.data.challenge
        }

        return response.data
      }

      error.value = response.message || 'Unable to accept challenge.'
    } catch (acceptError) {
      error.value = acceptError?.message || 'Unable to accept challenge.'
    } finally {
      isLoading.value = false
    }

    return null
  }

  const reviewChallenge = async (challengeId) => {
    error.value = ''
    isLoading.value = true
    const playerStore = usePlayerStore()

    try {
      const response = await reviewChallengeRequest(challengeId)
      if (response.success) {
        const challengeIndex = challenges.value.findIndex((item) => item.id === challengeId)
        if (challengeIndex !== -1) {
          challenges.value[challengeIndex] = response.data.challenge
        }

        if (response.data.players) {
          playerStore.players = response.data.players
        } else {
          await playerStore.loadPlayers()
        }

        return response.data
      }

      error.value = response.message || 'Unable to review challenge.'
    } catch (reviewError) {
      error.value = reviewError?.message || 'Unable to review challenge.'
    } finally {
      isLoading.value = false
    }

    return null
  }

  const declineChallenge = async (challengeId) => {
    error.value = ''
    isLoading.value = true

    try {
      const response = await declineChallengeRequest(challengeId)
      if (response.success) {
        const challengeIndex = challenges.value.findIndex((item) => item.id === challengeId)
        if (challengeIndex !== -1) {
          challenges.value.splice(challengeIndex, 1)
        }

        return response.data
      }

      error.value = response.message || 'Unable to decline challenge.'
    } catch (declineError) {
      error.value = declineError?.message || 'Unable to decline challenge.'
    } finally {
      isLoading.value = false
    }

    return null
  }

  const withdrawChallenge = async (challengeId) => {
    error.value = ''
    isLoading.value = true

    try {
      const response = await withdrawChallengeRequest(challengeId)
      if (response.success) {
        const challengeIndex = challenges.value.findIndex((item) => item.id === challengeId)
        if (challengeIndex !== -1) {
          challenges.value.splice(challengeIndex, 1)
        }
        return response.data
      }

      error.value = response.message || 'Unable to withdraw challenge.'
    } catch (withdrawError) {
      error.value = withdrawError?.message || 'Unable to withdraw challenge.'
    } finally {
      isLoading.value = false
    }

    return null
  }

  const setFilter = (status) => {
    filterStatus.value = status
  }

  return {
    challenges,
    filterStatus,
    isLoading,
    error,
    filteredChallenges,
    summaryCounts,
    loadChallenges,
    createChallenge,
    acceptChallenge,
    declineChallenge,
    reviewChallenge,
    setFilter,
  }
})
