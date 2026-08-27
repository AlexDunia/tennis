import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { fakeRequest, createTimestamp } from '../services/api'
import { buildAccessProfile, hasPermission as checkPermission } from '../utils/auth/accessControl'
import { APP_DATA_MODES, setAppDataMode } from '../dataMode'
import { APP_CURRENT_PLAYER } from '../config/currentPlayer'

const STORAGE_KEY = 'sheltennis-auth'

function applyCurrentPlayerIdentity(user) {
  if (!user) return null

  return {
    ...user,
    id: APP_CURRENT_PLAYER.id,
    playerId: APP_CURRENT_PLAYER.id,
    name: APP_CURRENT_PLAYER.name,
    avatar: APP_CURRENT_PLAYER.imageUrl,
  }
}

function loadAuthFromStorage() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) {
    return { isLoggedIn: false, user: null }
  }
  try {
    const parsed = JSON.parse(stored)
    return {
      isLoggedIn: parsed.isLoggedIn === true,
      user: applyCurrentPlayerIdentity(parsed.user),
    }
  } catch (_) {
    return { isLoggedIn: false, user: null }
  }
}

export const useAuthStore = defineStore('auth', () => {
  const storedAuth = loadAuthFromStorage()
  const isLoggedIn = ref(storedAuth.isLoggedIn)
  const user = ref(storedAuth.user)
  const isAuthLoading = ref(false)
  const authMessage = ref('')

  const isAuthenticated = computed(() => isLoggedIn.value && Boolean(user.value))
  const accessProfile = computed(() => buildAccessProfile(user.value || {}))
  const isAdmin = computed(() => accessProfile.value.isAdmin)
  const hasPermission = computed(
    () => (permission) => checkPermission(accessProfile.value, permission),
  )

  watch([isLoggedIn, user], () => {
    const payload = {
      isLoggedIn: isLoggedIn.value,
      user: user.value,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  })

  async function login(credentials) {
    try {
      isAuthLoading.value = true
      const roleKey = ['club_admin', 'super_admin'].includes(credentials.roleKey)
        ? credentials.roleKey
        : 'player'
      const playerId = APP_CURRENT_PLAYER.id
      const requestedMode =
        roleKey !== 'player' || credentials.dataMode === APP_DATA_MODES.DEMO
          ? APP_DATA_MODES.DEMO
          : APP_DATA_MODES.EMPTY
      setAppDataMode(requestedMode)
      const response = await fakeRequest({
        id: APP_CURRENT_PLAYER.id,
        name: APP_CURRENT_PLAYER.name,
        email: credentials.email || `${credentials.username}@shell.com`,
        playerId,
        roleKey,
        lastLogin: createTimestamp(),
        avatar: APP_CURRENT_PLAYER.imageUrl,
      })
      user.value = {
        ...response,
        ...buildAccessProfile(response, roleKey),
      }
      isLoggedIn.value = true
      authMessage.value = 'Welcome to ShellTennis'
      return user.value
    } catch (error) {
      authMessage.value = 'Unable to log in right now'
      throw error
    } finally {
      isAuthLoading.value = false
    }
  }

  function logout() {
    isLoggedIn.value = false
    user.value = null
    authMessage.value = 'Logged out'
  }

  return {
    isLoggedIn,
    user,
    authMessage,
    isAuthLoading,
    isAuthenticated,
    accessProfile,
    isAdmin,
    hasPermission,
    login,
    logout,
  }
})
