import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getPlayers } from '../services/PlayerService'
import {
  ACCESS_ROLES,
  buildAccessProfile,
  hasPermission as checkPermission,
} from '../utils/auth/accessControl'
import { useAuthStore } from './auth'
import { getActiveLadderConfig, isEligibleLadderOpponent } from '../config/ladder'

const ROLE_STORAGE_KEY = 'tennis.local.playerRoles.v1'

function loadRoleOverrides() {
  try {
    return JSON.parse(localStorage.getItem(ROLE_STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveRoleOverrides(roles) {
  localStorage.setItem(ROLE_STORAGE_KEY, JSON.stringify(roles))
}

export const usePlayerStore = defineStore('player', () => {
  const authStore = useAuthStore()
  // 6. REACTIVE STATE
  const players = ref([])
  const currentPlayerId = computed(() => authStore.user?.playerId || 'player-02')
  const roleOverrides = ref(loadRoleOverrides())
  const isLoading = ref(false)
  const error = ref('')

  // 7. COMPUTED PROPERTIES

  // All players sorted by rank ascending (rank 1 = top of ladder)
  const sortedLadder = computed(() => [...players.value].sort((a, b) => a.rank - b.rank))

  const playersByCategory = computed(() => {
    return players.value.reduce((groups, player) => {
      const categoryId = player.categoryId || 'uncategorized'
      const group = groups[categoryId] || []
      return {
        ...groups,
        [categoryId]: [...group, player],
      }
    }, {})
  })

  const playerAccessProfile = computed(
    () => (player) =>
      buildAccessProfile(
        player || {},
        player?.id === currentPlayerId.value && authStore.user?.roleKey
          ? authStore.user.roleKey
          : roleOverrides.value[player?.id],
      ),
  )
  const currentPlayer = computed(() => {
    const player = players.value.find((item) => item.id === currentPlayerId.value) ?? null

    const access = player ? playerAccessProfile.value(player) : null

    return player
      ? {
          ...player,
          ...access,
          name: access?.isAdmin && authStore.user?.name ? authStore.user.name : player.name,
        }
      : null
  })
  const isCurrentPlayerAdmin = computed(() => Boolean(currentPlayer.value?.isAdmin))
  const currentPlayerCan = computed(
    () => (permission) => checkPermission(currentPlayer.value || {}, permission),
  )

  const categoryRoster = computed(() => (categoryId) => {
    return playersByCategory.value[categoryId] || []
  })

  // Players ranked higher (lower rank number) than the current player
  // and within 3 positions — these are the only legal challenge targets
  const availableOpponents = computed(() => {
    const active = currentPlayer.value
    if (!active) return []

    const ladderConfig = getActiveLadderConfig()

    return players.value
      .filter((player) => isEligibleLadderOpponent(active, player, ladderConfig))
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

  const assignCategory = (playerId, category) => {
    const playerIndex = players.value.findIndex((player) => player.id === playerId)
    if (playerIndex === -1) {
      return null
    }

    const player = players.value[playerIndex]
    const categoryHistory = [
      ...(player.categoryHistory || []).map((entry) =>
        entry.to === null
          ? {
              ...entry,
              to: new Date().toISOString().slice(0, 10),
            }
          : entry,
      ),
      {
        categoryId: category.id,
        category: category.name,
        from: new Date().toISOString().slice(0, 10),
        to: null,
        reason: category.reason || 'Admin category assignment',
      },
    ]

    players.value[playerIndex] = {
      ...player,
      categoryId: category.id,
      category: category.name,
      categoryHistory,
    }

    return players.value[playerIndex]
  }

  const promotePlayer = (playerId, category) => {
    return assignCategory(playerId, {
      ...category,
      reason: category.reason || 'Promotion after tournament performance',
    })
  }

  const relegatePlayer = (playerId, category) => {
    return assignCategory(playerId, {
      ...category,
      reason: category.reason || 'Relegation after tournament performance',
    })
  }

  const setPlayerRole = (playerId, roleKey) => {
    if (!ACCESS_ROLES[roleKey]) {
      return null
    }

    roleOverrides.value = {
      ...roleOverrides.value,
      [playerId]: roleKey,
    }
    saveRoleOverrides(roleOverrides.value)
    return roleOverrides.value[playerId]
  }

  const clearPlayerRole = (playerId) => {
    const nextRoles = { ...roleOverrides.value }
    delete nextRoles[playerId]
    roleOverrides.value = nextRoles
    saveRoleOverrides(roleOverrides.value)
  }

  return {
    players,
    currentPlayerId,
    roleOverrides,
    isLoading,
    error,
    sortedLadder,
    playersByCategory,
    currentPlayer,
    isCurrentPlayerAdmin,
    currentPlayerCan,
    categoryRoster,
    availableOpponents,
    getPlayerZone,
    loadPlayers,
    assignCategory,
    promotePlayer,
    relegatePlayer,
    setPlayerRole,
    clearPlayerRole,
  }
})
