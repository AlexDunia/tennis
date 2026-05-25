import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { calculateGroupStandings } from '../composables/useTournamentStandings'
import { useNotificationStore } from './notification'
import { useMatchStore } from './match'
import {
  closeRoundRobinRequest,
  createTournamentRequest,
  generateFixturesRequest,
  getScheduleRequest,
  getTournament,
  getTournaments,
} from '../services/TournamentService'

export const useTournamentStore = defineStore('tournament', () => {
  const tournaments = ref([])
  const activeTournament = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const schedule = ref([])

  const activeTournamentMatches = computed(() => {
    const matchStore = useMatchStore()
    if (!activeTournament.value) {
      return []
    }

    return matchStore.matches.filter((match) => match.tournamentId === activeTournament.value.id)
  })

  const todayMatchCount = computed(() => {
    const today = new Date().toISOString().slice(0, 10)
    return activeTournamentMatches.value.filter((match) => match.scheduledDate === today).length
  })

  const pendingMatchCount = computed(
    () => activeTournamentMatches.value.filter((match) => match.status === 'pending').length,
  )

  const activeCategoryById = computed(() => (categoryId) => {
    return activeTournament.value?.categories.find((category) => category.id === categoryId) || null
  })

  const groupById = computed(() => (categoryId, groupId) => {
    const category = activeCategoryById.value(categoryId)
    return category?.groups.find((group) => group.id === groupId) || null
  })

  const standingsForGroup = computed(() => (categoryId, groupId) => {
    const category = activeCategoryById.value(categoryId)
    const group = groupById.value(categoryId, groupId)

    if (!category || !group || !activeTournament.value) {
      return []
    }

    return calculateGroupStandings(group, activeTournamentMatches.value, {
      ...activeTournament.value.rules,
      qualifiersPerGroup:
        category.settings?.qualifiersPerGroup ?? activeTournament.value.rules?.qualifiersPerGroup,
    })
  })

  const knockoutForCategory = computed(() => (categoryId) => {
    return activeCategoryById.value(categoryId)?.knockout || null
  })

  const championForCategory = computed(() => (categoryId) => {
    const category = activeCategoryById.value(categoryId)
    if (!category?.knockout?.championId) {
      return null
    }

    return {
      id: category.knockout.championId,
      name: category.knockout.championName,
    }
  })

  const fetchTournaments = async () => {
    loading.value = true
    error.value = null

    try {
      const response = await getTournaments()
      if (response.success) {
        tournaments.value = response.data
        activeTournament.value =
          response.data.find((tournament) => tournament.status === 'active') || response.data[0] || null
        return response.data
      }

      error.value = response.message || 'Unable to load tournaments.'
    } catch (fetchError) {
      error.value = fetchError?.message || 'Unable to load tournaments.'
    } finally {
      loading.value = false
    }

    return []
  }

  const fetchTournament = async (tournamentId) => {
    loading.value = true
    error.value = null

    try {
      const response = await getTournament(tournamentId)
      if (response.success) {
        activeTournament.value = response.data
        const tournamentIndex = tournaments.value.findIndex((item) => item.id === tournamentId)
        if (tournamentIndex === -1) {
          tournaments.value.push(response.data)
        } else {
          tournaments.value[tournamentIndex] = response.data
        }
        return response.data
      }

      error.value = response.message || 'Unable to load tournament.'
    } catch (fetchError) {
      error.value = fetchError?.message || 'Unable to load tournament.'
    } finally {
      loading.value = false
    }

    return null
  }

  const createTournament = async (payload) => {
    loading.value = true
    error.value = null

    try {
      const response = await createTournamentRequest(payload)
      if (response.success) {
        tournaments.value.push(response.data)
        activeTournament.value = response.data
        return response.data
      }

      error.value = response.message || 'Unable to create tournament.'
    } catch (createError) {
      error.value = createError?.message || 'Unable to create tournament.'
    } finally {
      loading.value = false
    }

    return null
  }

  const generateFixtures = async (tournamentId, categoryId) => {
    const response = await generateFixturesRequest(tournamentId, categoryId)
    if (response.success) {
      await fetchTournament(tournamentId)
      await useMatchStore().loadMatches()
      return response.data
    }

    error.value = response.message || 'Unable to generate fixtures.'
    return null
  }

  const closeRoundRobin = async (tournamentId, categoryId) => {
    const response = await closeRoundRobinRequest(tournamentId, categoryId)
    if (response.success) {
      await fetchTournament(tournamentId)
      await useMatchStore().loadMatches()
      return response.data
    }

    error.value = response.message || 'Unable to close round robin.'
    return null
  }

  const enterMatchResult = async (matchId, payload) => {
    const matchStore = useMatchStore()
    const notificationStore = useNotificationStore()
    const result = await matchStore.submitResult(matchId, payload)

    if (result?.type === 'tournament') {
      await Promise.all([fetchTournament(result.tournamentId), matchStore.loadMatches()])
      notificationStore.addToast({ message: 'Score recorded.', type: 'success' })
      notificationStore.addNotification({
        title: 'Tournament score recorded',
        message: `${result.challengerName} vs ${result.defenderName} is now ${result.score}.`,
        type: 'success',
      })
    }

    return result
  }

  const markWalkover = async (matchId, winnerId) => {
    return enterMatchResult(matchId, {
      p1Sets: 2,
      p2Sets: 0,
      p1Games: 12,
      p2Games: 0,
      winnerId,
      status: 'walkover',
    })
  }

  const updateMatchSchedule = async (matchId, payload) => {
    const matchStore = useMatchStore()
    const scheduledAt =
      payload.date && payload.time ? `${payload.date}T${payload.time}:00` : null
    return matchStore.patchMatch(matchId, {
      scheduledDate: payload.date,
      scheduledTime: payload.time,
      scheduledAt,
      court: payload.court,
      rescheduleNote: payload.note,
    })
  }

  const saveLiveState = async (matchId, liveState) => {
    return useMatchStore().saveLiveState(matchId, liveState)
  }

  const fetchSchedule = async (tournamentId) => {
    const response = await getScheduleRequest(tournamentId)
    if (response.success) {
      schedule.value = response.data
      return response.data
    }

    error.value = response.message || 'Unable to load schedule.'
    return []
  }

  return {
    tournaments,
    activeTournament,
    loading,
    error,
    schedule,
    activeCategoryById,
    groupById,
    standingsForGroup,
    knockoutForCategory,
    todayMatchCount,
    pendingMatchCount,
    championForCategory,
    fetchTournaments,
    fetchTournament,
    createTournament,
    generateFixtures,
    enterMatchResult,
    markWalkover,
    closeRoundRobin,
    updateMatchSchedule,
    saveLiveState,
    fetchSchedule,
  }
})
