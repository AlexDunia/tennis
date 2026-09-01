import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildClubMembershipAccess,
  hasClubMembershipPermission,
} from '../src/utils/auth/accessControl.js'
import {
  CLUB_DIRECTORY_SCHEMA_VERSION,
  CLUB_DIRECTORY_STORAGE_KEY,
  createDefaultClubSetup,
} from '../src/config/admin.js'
import { getClubDirectory, switchActiveClub } from '../src/services/AdminService.js'

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

test('one person can have different access in different clubs', () => {
  const greenview = buildClubMembershipAccess({
    userId: 'alex',
    clubId: 'greenview',
    role: 'admin',
    status: 'active',
  })
  const lagos = buildClubMembershipAccess({
    userId: 'alex',
    clubId: 'lagos',
    role: 'player',
    status: 'active',
  })

  assert.equal(greenview.role, 'admin')
  assert.equal(greenview.isManager, true)
  assert.equal(greenview.permissions.includes('club.manage'), true)
  assert.equal(lagos.role, 'player')
  assert.equal(lagos.isManager, false)
  assert.equal(lagos.permissions.includes('club.manage'), false)
  assert.equal(lagos.permissions.includes('challenges.create'), true)
})

test('membership status gates every club permission', () => {
  const inactiveMembership = {
    userId: 'alex',
    clubId: 'greenview',
    role: 'admin',
    status: 'inactive',
  }

  assert.deepEqual(buildClubMembershipAccess(inactiveMembership).permissions, [])
  assert.equal(hasClubMembershipPermission(inactiveMembership, 'club.manage'), false)
  assert.equal(hasClubMembershipPermission(inactiveMembership, 'tournaments.view'), false)
})

test('no club relationship means no club permissions', () => {
  assert.equal(hasClubMembershipPermission({}, 'challenges.create'), false)
  assert.equal(hasClubMembershipPermission({ role: 'admin' }, 'club.manage'), false)
})

test('legacy memberships remain active by default', () => {
  const membership = { userId: 'alex', clubId: 'greenview', role: 'player' }
  const access = buildClubMembershipAccess(membership)

  assert.equal(access.status, 'active')
  assert.equal(hasClubMembershipPermission(membership, 'rankings.view'), true)
})

test('the existing directory switches only between active relationships for one person', async () => {
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
        createClub('ikoyi', 'Ikoyi Racquet Club'),
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
        {
          userId: 'alex',
          clubId: 'ikoyi',
          role: 'co-admin',
          status: 'inactive',
          joinedAt: '2026-03-01T00:00:00.000Z',
        },
      ],
      activeClubByUser: { alex: 'greenview' },
    }),
  )

  try {
    const actor = { userId: 'alex' }
    const initial = await getClubDirectory(actor)
    assert.equal(initial.activeClubId, 'greenview')
    assert.deepEqual(
      initial.clubs.map((club) => club.id),
      ['greenview', 'lagos'],
    )
    assert.equal(
      initial.memberships.find((membership) => membership.clubId === 'ikoyi').status,
      'inactive',
    )

    await switchActiveClub('lagos', actor)
    assert.equal((await getClubDirectory(actor)).activeClubId, 'lagos')
    await assert.rejects(() => switchActiveClub('ikoyi', actor), /do not have access/)
  } finally {
    globalThis.window = originalWindow
  }
})
