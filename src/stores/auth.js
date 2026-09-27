import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { fakeRequest, createTimestamp } from '../services/api.js'
import {
  buildAccessProfile,
  hasPermission as checkPermission,
} from '../utils/auth/accessControl.js'
import { APP_DATA_MODES, setAppDataMode } from '../dataMode.js'

const STORAGE_KEY = 'sheltennis-auth'
const LEGACY_DEMO_ID = 'player-02'

// A new local account can create its first Club. From then on, the Club
// membership relationship is the authority for Club access.
export const LOCAL_ACCOUNT_ACCESS_ROLE = 'club_admin'

function accountId() {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `account-${uuid}`
}

function normalizeAccount(user) {
  if (!user || typeof user !== 'object') return null

  const legacyIds = [
    ...(Array.isArray(user.legacyUserIds) ? user.legacyUserIds : []),
    user.accessCompatibility === 'local-prototype' ? user.id : '',
    user.accessCompatibility === 'local-prototype' ? user.playerId : '',
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)

  const isLegacyDemoAccount =
    user.accessCompatibility === 'local-prototype' ||
    user.id === LEGACY_DEMO_ID ||
    user.playerId === LEGACY_DEMO_ID

  const id = !isLegacyDemoAccount && String(user.accountId || user.id || '').trim()
    ? String(user.accountId || user.id).trim()
    : accountId()

  return {
    ...user,
    id,
    accountId: id,
    playerId: id,
    name: String(user.name || 'Gorra member').trim() || 'Gorra member',
    email: String(user.email || '').trim().toLowerCase(),
    roleKey: isLegacyDemoAccount ? LOCAL_ACCOUNT_ACCESS_ROLE : user.roleKey || LOCAL_ACCOUNT_ACCESS_ROLE,
    legacyUserIds: [...new Set(legacyIds)].filter((value) => value !== id),
    accessCompatibility: 'account-based',
  }
}



function loadAuthFromStorage() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) {
    return { isLoggedIn: false, user: null }
  }
  try {
    const parsed = JSON.parse(stored)
    const shouldDiscardRetiredGlobalDemoState =
      Number(parsed.user?.cleanSampleDataVersion || 0) > 0
    const user = normalizeAccount(parsed.user)
    if (shouldDiscardRetiredGlobalDemoState && user) {
      delete user.dataMode
      delete user.cleanSampleDataVersion
      setAppDataMode(APP_DATA_MODES.EMPTY)
      localStorage.removeItem('tennis.mock.ladderState.v2')
      localStorage.removeItem('tennis.mock.tournamentState.v2')
    }
    if (parsed.isLoggedIn === true && JSON.stringify(user) !== JSON.stringify(parsed.user)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ isLoggedIn: true, user }))
    }
    return {
      isLoggedIn: parsed.isLoggedIn === true,
      user,
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

  async function login(credentials = {}) {
    try {
      isAuthLoading.value = true
      const roleKey = LOCAL_ACCOUNT_ACCESS_ROLE
      const id = accountId()
      const requestedMode =
        credentials.dataMode === APP_DATA_MODES.DEMO ? APP_DATA_MODES.DEMO : APP_DATA_MODES.EMPTY
      setAppDataMode(requestedMode)
      const response = await fakeRequest({
        id,
        accountId: id,
        name: credentials.name || 'Gorra member',
        email: credentials.email || '',
        playerId: id,
        roleKey,
        dataMode: requestedMode,
        lastLogin: createTimestamp(),
      })
      user.value = {
        ...normalizeAccount(response),
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
