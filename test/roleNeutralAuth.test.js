import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { APP_DATA_MODES } from '../src/dataMode.js'
import {
  LOCAL_PROTOTYPE_ACCESS_ROLE,
  useAuthStore,
} from '../src/stores/auth.js'
import {
  buildClubMembershipAccess,
  hasClubMembershipPermission,
} from '../src/utils/auth/accessControl.js'

const loginSource = readFileSync(new URL('../src/views/LoginView.vue', import.meta.url), 'utf8')

function createMemoryStorage() {
  const values = new Map()
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      values.set(key, String(value))
    },
    removeItem(key) {
      values.delete(key)
    },
  }
}

async function withAuthStore(run) {
  const originalWindow = globalThis.window
  const originalLocalStorage = globalThis.localStorage
  const localStorage = createMemoryStorage()
  globalThis.window = { localStorage }
  globalThis.localStorage = localStorage
  setActivePinia(createPinia())

  try {
    const authStore = useAuthStore()
    await run(authStore)
    await nextTick()
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
    if (originalLocalStorage === undefined) delete globalThis.localStorage
    else globalThis.localStorage = originalLocalStorage
  }
}

test('signup UI is role-neutral', () => {
  assert.match(loginSource, /Create your Gorra account/)
  assert.match(loginSource, /Create account/)
  assert.doesNotMatch(loginSource, /I am a player|Club admin|How will you use Gorra/)
  assert.doesNotMatch(loginSource, /roleOptions|selectedRole|chooseRole|auth-role-picker/)
})

test('signin UI is role-neutral', () => {
  assert.match(loginSource, /Welcome back/)
  assert.match(loginSource, /'Sign in'/)
  assert.doesNotMatch(loginSource, /How would you like to enter|Choose a role/)
  assert.match(loginSource, /This local prototype uses the configured demo identity/)
})

test('signup authenticates without a user-selected role', async () => {
  await withAuthStore(async (authStore) => {
    const user = await authStore.login({
      email: 'signup@gorra.demo',
      dataMode: APP_DATA_MODES.EMPTY,
    })

    assert.equal(authStore.isAuthenticated, true)
    assert.equal(user.roleKey, LOCAL_PROTOTYPE_ACCESS_ROLE)
    assert.equal(user.accessCompatibility, 'local-prototype')
  })
})

test('signin authenticates without a user-selected role', async () => {
  await withAuthStore(async (authStore) => {
    await authStore.login({
      email: 'signin@gorra.demo',
      dataMode: APP_DATA_MODES.DEMO,
    })

    assert.equal(authStore.isAuthenticated, true)
    assert.equal(authStore.user.roleKey, LOCAL_PROTOTYPE_ACCESS_ROLE)
  })
})

test('the hidden compatibility profile preserves required prototype permissions', async () => {
  await withAuthStore(async (authStore) => {
    await authStore.login({ dataMode: APP_DATA_MODES.EMPTY })

    assert.equal(authStore.hasPermission('club.manage'), true)
    assert.equal(authStore.hasPermission('tournaments.view'), true)
    assert.equal(authStore.hasPermission('matches.view'), true)
  })
})

test('account compatibility access does not determine a club membership role', () => {
  const memberRelationship = {
    userId: 'player-02',
    clubId: 'greenview',
    role: 'player',
    status: 'active',
  }
  const membershipAccess = buildClubMembershipAccess(memberRelationship)

  assert.equal(membershipAccess.role, 'player')
  assert.equal(hasClubMembershipPermission(memberRelationship, 'club.manage'), false)
  assert.equal(hasClubMembershipPermission(memberRelationship, 'challenges.create'), true)
})

test('LoginView keeps using the shared post-auth resolver without submitting a role', () => {
  assert.match(loginSource, /resolvePostAuthDestination/)
  assert.match(loginSource, /router\.push\(await resolveEntryDestination\(\)\)/)
  assert.doesNotMatch(loginSource, /authStore\.login\(\{[\s\S]*?roleKey/)
})
