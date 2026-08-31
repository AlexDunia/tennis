import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { usePlayerStore } from './player'
import {
  acceptChallenge as acceptChallengeRequest,
  createChallenge as createChallengeRequest,
  createAdminLadderMatch as createAdminLadderMatchRequest,
  declineChallenge as declineChallengeRequest,
  getChallenges,
  reviewChallenge as reviewChallengeRequest,
  resolveChallengeResult as resolveChallengeResultRequest,
  scheduleChallenge as scheduleChallengeRequest,
  startChallenge as startChallengeRequest,
  withdrawChallenge as withdrawChallengeRequest,
} from '../services/ChallengeService'
import { useMatchStore } from './match'

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

  const createAdminLadderMatch = async (payload) => {
    error.value = ''
    isLoading.value = true

    try {
      const response = await createAdminLadderMatchRequest(payload)
      if (response.success) {
        const challenge = response.data?.challenge
        const match = response.data?.match
        if (challenge) challenges.value.push(challenge)
        if (match) {
          const matchStore = useMatchStore()
          const index = matchStore.matches.findIndex((item) => item.id === match.id)
          if (index === -1) matchStore.matches.push(match)
          else matchStore.matches[index] = match
        }
        return response.data
      }

      error.value = response.message || 'Unable to create this Ladder match.'
    } catch (createError) {
      error.value = createError?.message || 'Unable to create this Ladder match.'
    } finally {
      isLoading.value = false
    }

    return null
  }

  const acceptChallenge = async (challengeId, scheduledAt, actorId) => {
    error.value = ''
    isLoading.value = true

    try {
      const response = await acceptChallengeRequest(challengeId, scheduledAt, actorId)
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

  const scheduleChallenge = async (challengeId, payload) => {
    error.value = ''
    isLoading.value = true

    try {
      const response = await scheduleChallengeRequest(challengeId, payload)
      if (response.success) {
        const challengeIndex = challenges.value.findIndex((item) => item.id === challengeId)
        if (challengeIndex !== -1) challenges.value[challengeIndex] = response.data.challenge
        return response.data
      }
      error.value = response.message || 'Unable to schedule this challenge.'
    } catch (scheduleError) {
      error.value = scheduleError?.message || 'Unable to schedule this challenge.'
    } finally {
      isLoading.value = false
    }
    return null
  }

  const startChallenge = async (challengeId, actorId) => {
    error.value = ''
    isLoading.value = true

    try {
      const response = await startChallengeRequest(challengeId, actorId)
      if (response.success) {
        const challengeIndex = challenges.value.findIndex((item) => item.id === challengeId)
        if (challengeIndex !== -1) challenges.value[challengeIndex] = response.data.challenge
        return response.data
      }
      error.value = response.message || 'Unable to start this challenge.'
    } catch (startError) {
      error.value = startError?.message || 'Unable to start this challenge.'
    } finally {
      isLoading.value = false
    }
    return null
  }

  const reviewChallenge = async (challengeId, actorId) => {
    error.value = ''
    isLoading.value = true
    const playerStore = usePlayerStore()

    try {
      const response = await reviewChallengeRequest(challengeId, actorId)
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
  const resolveChallengeResult = async (challengeId, payload) => {
    error.value = ''
    isLoading.value = true

    const playerStore = usePlayerStore()

    try {
      const response = await resolveChallengeResultRequest(challengeId, payload)

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

      error.value = response.message || 'Unable to finalize this result.'
    } catch (resolveError) {
      error.value = resolveError?.message || 'Unable to finalize this result.'
    } finally {
      isLoading.value = false
    }

    return null
  }

  const declineChallenge = async (challengeId, actorId) => {
    error.value = ''
    isLoading.value = true

    try {
      const response = await declineChallengeRequest(challengeId, actorId)
      if (response.success) {
        const challengeIndex = challenges.value.findIndex((item) => item.id === challengeId)
        if (challengeIndex !== -1 && response.data?.id) {
          challenges.value[challengeIndex] = response.data
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

  const withdrawChallenge = async (challengeId, actorId) => {
    error.value = ''
    isLoading.value = true

    try {
      const response = await withdrawChallengeRequest(challengeId, actorId)
      if (response.success) {
        const challengeIndex = challenges.value.findIndex((item) => item.id === challengeId)
        if (challengeIndex !== -1 && response.data?.id) {
          challenges.value[challengeIndex] = response.data
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
    createAdminLadderMatch,
    acceptChallenge,
    scheduleChallenge,
    startChallenge,
    declineChallenge,
    withdrawChallenge,
    reviewChallenge,
    resolveChallengeResult,
    setFilter,
  }
})
