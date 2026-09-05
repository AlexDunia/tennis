import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  CLUB_DIRECTORY_SCHEMA_VERSION,
  CLUB_DIRECTORY_STORAGE_KEY,
  createDefaultClubSetup,
} from '../src/config/admin.js'
import { getClubDirectory } from '../src/services/AdminService.js'
import {
  resolvePostAuthDestination,
  safeInternalRedirect,
} from '../src/utils/onboarding/resolvePostAuthDestination.js'

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

function activeClub(id) {
  return { id, name: `${id} Tennis Club` }
}

test('signup with zero active clubs resolves to Clubs', () => {
  const resolution = resolvePostAuthDestination({ activeClubs: [] })

  assert.deepEqual(resolution.destination, { name: 'Clubs' })
  assert.equal(resolution.reason, 'zero-active-clubs')
})

test('signin with zero active clubs uses the same shared Clubs resolution', () => {
  const resolution = resolvePostAuthDestination({ activeClubs: [] })

  assert.deepEqual(resolution.destination, { name: 'Clubs' })
  assert.match(loginSource, /router\.push\(await resolveEntryDestination\(\)\)/)
  assert.doesNotMatch(loginSource, /safeRedirect \|\| \{ name: 'Dashboard' \}/)
})

test('one active club opens the canonical active Club route', () => {
  const resolution = resolvePostAuthDestination({ activeClubs: [activeClub('greenview')] })

  assert.deepEqual(resolution.destination, { name: 'Club' })
  assert.equal(resolution.activeClubId, 'greenview')
  assert.match(loginSource, /await adminStore\.switchClub\(clubResolution\.activeClubId\)/)
})

test('multiple active clubs open the existing Clubs chooser', () => {
  const resolution = resolvePostAuthDestination({
    activeClubs: [activeClub('greenview'), activeClub('lagos')],
  })

  assert.deepEqual(resolution.destination, { name: 'Clubs' })
  assert.equal(resolution.activeClubId, '')
  assert.equal(resolution.reason, 'multiple-active-clubs')
})

test('signup club invitation survives authentication', () => {
  const resolution = resolvePostAuthDestination({ invite: 'signup-token' })

  assert.deepEqual(resolution.destination, {
    name: 'Clubs',
    query: { view: 'join', invite: 'signup-token' },
  })
})

test('signin club invitation uses the same post-auth destination', () => {
  const resolution = resolvePostAuthDestination({ invite: 'signin-token' })

  assert.deepEqual(resolution.destination, {
    name: 'Clubs',
    query: { view: 'join', invite: 'signin-token' },
  })
  assert.doesNotMatch(loginSource, /if \(isSignUp\.value\) \{[\s\S]*route\.query\.invite/)
})

test('signup and signin can switch modes without losing invitation intent', () => {
  assert.match(
    loginSource,
    /const alternateAuthDestination = computed/,
  )

  assert.match(
    loginSource,
    /route\.query\.invite/,
  )

  assert.match(
    loginSource,
    /route\.query\.redirect/,
  )

  assert.match(
    loginSource,
    /route\.query\.club/,
  )

  assert.match(
    loginSource,
    /Already have a Gorra account\?/,
  )

  assert.match(
    loginSource,
    /New to Gorra\?/,
  )

  assert.match(
    loginSource,
    /:to="alternateAuthDestination"/,
  )
})

test('an already-authenticated explicit invitation resumes without claiming from the auth page', () => {
  assert.match(
    loginSource,
    /onMounted\(async \(\) => \{[\s\S]*?if \(!authStore\.isAuthenticated\) return/,
  )

  assert.match(
    loginSource,
    /resolvePostAuthDestination\(\{[\s\S]*?redirect: route\.query\.redirect,[\s\S]*?invite: route\.query\.invite/,
  )

  assert.match(
    loginSource,
    /await router\.replace\(intentResolution\.destination\)/,
  )

  assert.doesNotMatch(
    loginSource,
    /onMounted[\s\S]*?joinClubWithInvite/,
  )
})

test('a safe internal redirect wins over club invitation and club-state routing', () => {
  const resolution = resolvePostAuthDestination({
    redirect: '/matches/match-42/live?resume=1',
    invite: 'lower-priority-token',
    activeClubs: [],
  })

  assert.equal(resolution.destination, '/matches/match-42/live?resume=1')
  assert.equal(resolution.reason, 'explicit-redirect')
})

test('external and malformed redirects are rejected before normal club resolution', () => {
  assert.equal(safeInternalRedirect('https://example.com/steal-session'), '')
  assert.equal(safeInternalRedirect('//example.com/steal-session'), '')
  assert.equal(safeInternalRedirect('/\\example.com/steal-session'), '')
  assert.deepEqual(
    resolvePostAuthDestination({
      redirect: 'https://example.com/steal-session',
      activeClubs: [],
    }).destination,
    { name: 'Clubs' },
  )
})

test('an inactive membership does not count as an active club', async () => {
  const originalWindow = globalThis.window
  const localStorage = createMemoryStorage()
  const setup = createDefaultClubSetup()
  setup.clubId = 'inactive-club'
  setup.status = 'active'
  setup.workspace.name = 'Inactive Tennis Club'
  globalThis.window = { localStorage }
  localStorage.setItem(
    CLUB_DIRECTORY_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: CLUB_DIRECTORY_SCHEMA_VERSION,
      clubs: [{ id: 'inactive-club', name: setup.workspace.name, setup, invites: [] }],
      memberships: [
        {
          userId: 'alex',
          clubId: 'inactive-club',
          role: 'player',
          status: 'inactive',
        },
      ],
      activeClubByUser: { alex: 'inactive-club' },
    }),
  )

  try {
    const directory = await getClubDirectory({ userId: 'alex' })
    const resolution = resolvePostAuthDestination({ activeClubs: directory.clubs })

    assert.equal(directory.clubs.length, 0)
    assert.deepEqual(resolution.destination, { name: 'Clubs' })
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
})
