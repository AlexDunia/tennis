import assert from 'node:assert/strict'
import test from 'node:test'
import { CLUB_DIRECTORY_STORAGE_KEY } from '../src/config/admin.js'
import {
  createClub,
  getClubDirectory,
  joinClubWithInvite,
  previewClubInvite,
} from '../src/services/AdminService.js'
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

test('a person creates a club relationship without becoming a global admin', async () => {
  const originalWindow = globalThis.window
  const localStorage = createMemoryStorage()
  globalThis.window = { localStorage }

  const person = {
    id: 'alex',
    name: 'Alex',
    roleKey: 'player',
    permissions: [],
    isAdmin: false,
  }
  const personBeforeCreation = structuredClone(person)

  try {
    const created = await createClub(
      { name: 'Greenview Tennis Club', location: 'Lagos' },
      { userId: person.id },
    )

    assert.equal(created.club.name, 'Greenview Tennis Club')
    assert.equal(created.membership.userId, 'alex')
    assert.equal(created.membership.clubId, created.club.id)
    assert.equal(created.membership.role, 'admin')
    assert.equal(created.membership.status, 'active')
    assert.equal(hasClubMembershipPermission(created.membership, 'club.manage'), true)
    assert.deepEqual(person, personBeforeCreation)

    const directory = await getClubDirectory({ userId: person.id })
    assert.equal(directory.activeClubId, created.club.id)
    assert.equal(directory.clubs.length, 1)
    assert.ok(directory.clubs[0].invitations.some((invite) => invite.role === 'player'))
    assert.ok(localStorage.getItem(CLUB_DIRECTORY_STORAGE_KEY))
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
})

test('a valid member invitation creates one active relationship and selects its club', async () => {
  const originalWindow = globalThis.window
  const localStorage = createMemoryStorage()
  globalThis.window = { localStorage }

  try {
    const created = await createClub(
      { name: 'Greenview Tennis Club', location: 'Lagos' },
      { userId: 'alex' },
    )
    const ownerDirectory = await getClubDirectory({ userId: 'alex' })
    const memberInvite = ownerDirectory.clubs[0].invitations.find(
      (invite) => invite.role === 'player',
    )

    const preview = await previewClubInvite(memberInvite.code, { userId: 'jordan' })
    assert.equal(preview.clubId, created.club.id)
    assert.equal(preview.role, 'player')
    assert.equal(preview.roleLabel, 'Member')

    const joined = await joinClubWithInvite(memberInvite.code, { userId: 'jordan' })
    assert.equal(joined.membership.userId, 'jordan')
    assert.equal(joined.membership.clubId, created.club.id)
    assert.equal(joined.membership.role, 'player')
    assert.equal(joined.membership.status, 'active')
    assert.equal(hasClubMembershipPermission(joined.membership, 'club.manage'), false)

    const memberDirectory = await getClubDirectory({ userId: 'jordan' })
    assert.equal(memberDirectory.activeClubId, created.club.id)
    assert.equal(
      memberDirectory.memberships.filter(
        (membership) => membership.userId === 'jordan' && membership.clubId === created.club.id,
      ).length,
      1,
    )
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
})

test('Create and Join reject missing identity or invalid input', async () => {
  const originalWindow = globalThis.window
  globalThis.window = { localStorage: createMemoryStorage() }

  try {
    await assert.rejects(
      () => createClub({ name: 'A', location: 'Lagos' }, { userId: 'alex' }),
      /club name/i,
    )
    await assert.rejects(() => createClub({ name: 'Greenview', location: 'Lagos' }, {}), /sign in/i)
    await assert.rejects(
      () => joinClubWithInvite('NOT-A-REAL-INVITE', { userId: 'jordan' }),
      /not valid/i,
    )
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
})
