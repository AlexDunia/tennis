import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addClubMemberRecord,
  createClub,
  getClubDirectory,
  syncActiveClubMember,
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

test('a migrated builder account is synchronized to one canonical Club member record', async () => {
  const originalWindow = globalThis.window
  const originalLocalStorage = globalThis.localStorage
  const localStorage = createMemoryStorage()
  globalThis.window = { localStorage }
  globalThis.localStorage = localStorage

  try {
    const legacyBuilder = {
      userId: 'player-02',
      name: 'Henry Dunia',
      email: 'henry@example.com',
      permissions: ['*'],
    }

    await createClub(
      { name: 'Greenview Tennis Club', country: 'Nigeria', city: 'Lagos' },
      legacyBuilder,
    )
    const added = await addClubMemberRecord(
      { name: 'Player 02', email: 'legacy-member@example.com', role: 'admin' },
      legacyBuilder,
    )
    assert.equal(added.member.id, 'player-02')

    const account = {
      userId: 'account-builder',
      id: 'account-builder',
      name: 'Henry Dunia',
      email: 'henry@example.com',
      legacyUserIds: ['player-02'],
    }
    const synced = await syncActiveClubMember(account)
    const directory = await getClubDirectory(account)
    const membership = directory.memberships.find(
      (item) => item.userId === account.userId && item.clubId === synced.club.id,
    )
    const member = synced.club.setup.membership.manualMembers.find(
      (item) => item.id === added.member.id,
    )

    assert.equal(synced.member.id, added.member.id)
    assert.equal(member.userId, account.userId)
    assert.equal(membership.memberId, added.member.id)
    assert.equal(
      directory.memberships.some((item) => item.userId === 'player-02'),
      false,
    )
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
    if (originalLocalStorage === undefined) delete globalThis.localStorage
    else globalThis.localStorage = originalLocalStorage
  }
})
