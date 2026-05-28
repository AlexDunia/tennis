import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { fakeRequest, createTimestamp } from '../services/api'
import { buildAccessProfile, hasPermission as checkPermission } from '../utils/auth/accessControl'

const STORAGE_KEY = 'sheltennis-auth'

function createAvatarImage(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=EDF2F7&color=2E3A59`
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
      user: parsed.user ?? null,
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
  const hasPermission = computed(() => (permission) => checkPermission(accessProfile.value, permission))

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
      const response = await fakeRequest({
        name: credentials.username,
        email: `${credentials.username}@shell.com`,
        lastLogin: createTimestamp(),
        avatar: createAvatarImage(credentials.username),
      })
      user.value = {
        ...response,
        ...buildAccessProfile(response),
      }
      isLoggedIn.value = true
      authMessage.value = 'Welcome to ShellTennis'
      return response
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
