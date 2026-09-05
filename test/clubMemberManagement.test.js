import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addClubMemberRecord,
  createClub,
  createMemberRecordInvite,
  getClubDirectory,
  importClubMemberData,
  joinClubWithInvite,
  updateClubMemberRecord,
} from '../src/services/AdminService.js'

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

async function withStorage(run) {
  const originalWindow = globalThis.window
  globalThis.window = { localStorage: createMemoryStorage() }
  try {
    await run()
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
}

test('manager can add a complete club member record without creating an account', async () => {
  await withStorage(async () => {
    const manager = { userId: 'alex' }
    await createClub(
      { name: 'Greenview Tennis Club', country: 'Nigeria', city: 'Lagos' },
      manager,
    )

    const result = await addClubMemberRecord(
      {
        firstName: 'Henry',
        lastName: 'Mensah',
        email: 'henry@example.com',
        gender: 'Male',
        dob: '1995-06-20',
        level: 'Intermediate',
        yearOfEntry: '2024',
      },
      manager,
    )

    assert.equal(result.member.name, 'Henry Mensah')
    assert.equal(result.member.userId, '')
    assert.equal(result.member.level, 'Intermediate')
    assert.equal(result.member.yearOfEntry, '2024')
  })
})

test('import fills an existing club record by strong club data without linking a Gorra account', async () => {
  await withStorage(async () => {
    const manager = { userId: 'alex' }
    await createClub(
      { name: 'Greenview Tennis Club', country: 'Nigeria', city: 'Lagos' },
      manager,
    )

    const created = await addClubMemberRecord(
      {
        firstName: 'Henry',
        lastName: 'Mensah',
        email: 'henry@example.com',
      },
      manager,
    )

    const result = await importClubMemberData(
      {
        scenario: 'members-only',
        people: [
          {
            name: 'Henry Mensah',
            email: 'henry@example.com',
            level: 'Intermediate',
            yearOfEntry: '2024',
            ladderMemberships: [],
          },
        ],
        ladders: [],
      },
      manager,
    )

    assert.equal(result.addedCount, 0)
    assert.equal(result.updatedCount, 1)

    const directory = await getClubDirectory(manager)
    const members = directory.clubs[0].setup.membership.manualMembers
    assert.equal(members.length, 1)
    assert.equal(members[0].id, created.member.id)
    assert.equal(members[0].userId, '')
    assert.equal(members[0].level, 'Intermediate')
  })
})

test('changing a connected member club role keeps the membership relationship in sync', async () => {
  await withStorage(async () => {
    const manager = { userId: 'alex' }
    await createClub(
      { name: 'Greenview Tennis Club', country: 'Nigeria', city: 'Lagos' },
      manager,
    )

    const created = await addClubMemberRecord(
      {
        firstName: 'Henry',
        lastName: 'Mensah',
        email: 'henry@example.com',
      },
      manager,
    )

    const invite = await createMemberRecordInvite(created.member.id, manager)
    await joinClubWithInvite(invite.code, { userId: 'henry-account' })

    await updateClubMemberRecord(
      created.member.id,
      { role: 'co-admin' },
      manager,
    )

    const henryDirectory = await getClubDirectory({ userId: 'henry-account' })
    const membership = henryDirectory.memberships.find(
      (item) =>
        item.userId === 'henry-account' &&
        item.clubId === henryDirectory.activeClubId,
    )

    assert.equal(membership.role, 'co-admin')
  })
})
