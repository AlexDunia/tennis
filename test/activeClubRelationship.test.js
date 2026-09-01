import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  CLUB_DIRECTORY_SCHEMA_VERSION,
  CLUB_DIRECTORY_STORAGE_KEY,
  createDefaultClubSetup,
} from '../src/config/admin.js'
import { getClubDirectory, switchActiveClub } from '../src/services/AdminService.js'
import { hasClubMembershipPermission } from '../src/utils/auth/accessControl.js'

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

function createClub(id, name) {
  const setup = createDefaultClubSetup()
  setup.clubId = id
  setup.status = 'active'
  setup.workspace.name = name
  return { id, name, setup, invites: [] }
}

test('switching active club changes relationship permissions without changing the account', async () => {
  const originalWindow = globalThis.window
  const localStorage = createMemoryStorage()
  globalThis.window = { localStorage }
  localStorage.setItem(
    CLUB_DIRECTORY_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: CLUB_DIRECTORY_SCHEMA_VERSION,
      clubs: [
        createClub('greenview', 'Greenview Tennis Club'),
        createClub('lagos', 'Lagos Tennis Club'),
      ],
      memberships: [
        {
          userId: 'alex',
          clubId: 'greenview',
          role: 'admin',
          status: 'active',
          joinedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          userId: 'alex',
          clubId: 'lagos',
          role: 'player',
          status: 'active',
          joinedAt: '2026-02-01T00:00:00.000Z',
        },
      ],
      activeClubByUser: { alex: 'greenview' },
    }),
  )

  try {
    const person = {
      id: 'alex',
      playerId: 'alex-player',
      name: 'Alex',
      email: 'alex@example.com',
      roleKey: 'club_admin',
      roles: ['club_admin'],
      permissions: ['club.manage'],
      isAdmin: true,
    }
    const accountBeforeSwitch = structuredClone(person)
    const actor = { userId: person.id }

    const greenviewDirectory = await getClubDirectory(actor)
    const greenviewMembership = greenviewDirectory.memberships.find(
      (membership) => membership.clubId === greenviewDirectory.activeClubId,
    )

    assert.equal(greenviewDirectory.activeClubId, 'greenview')
    assert.equal(greenviewMembership.role, 'admin')
    assert.equal(hasClubMembershipPermission(greenviewMembership, 'club.manage'), true)

    await switchActiveClub('lagos', actor)
    const lagosDirectory = await getClubDirectory(actor)
    const lagosMembership = lagosDirectory.memberships.find(
      (membership) => membership.clubId === lagosDirectory.activeClubId,
    )

    assert.equal(lagosDirectory.activeClubId, 'lagos')
    assert.equal(lagosMembership.role, 'player')
    assert.equal(hasClubMembershipPermission(lagosMembership, 'club.manage'), false)
    assert.equal(hasClubMembershipPermission(lagosMembership, 'challenges.create'), true)
    assert.deepEqual(person, accountBeforeSwitch)

    const persisted = JSON.parse(localStorage.getItem(CLUB_DIRECTORY_STORAGE_KEY))
    assert.equal(persisted.activeClubByUser.alex, 'lagos')
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
})

test('the setup route guard derives authority from the active club relationship', () => {
  const routerSource = readFileSync(new URL('../src/router/index.js', import.meta.url), 'utf8')

  assert.match(
    routerSource,
    /hasActiveClubPermission\('club\.manage'\) && !adminStore\.isConfigured/,
  )
  assert.doesNotMatch(routerSource, /!to\.meta\.public && authStore\.isAdmin && !isClubFlow/)
})
