import assert from 'node:assert/strict'
import test from 'node:test'
import {
  askForClubLadder,
  createClub,
  createClubLadder,
  getClubDirectory,
  joinClubWithInvite,
  rotateClubInvite,
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

test('a member can ask once, managers get one email payload, and creation completes the ask', async () => {
  const originalWindow = globalThis.window
  globalThis.window = { localStorage: createMemoryStorage() }

  try {
    const alex = { userId: 'alex', name: 'Alex' }
    const created = await createClub(
      { name: 'Greenview Tennis Club', country: 'Nigeria', city: 'Lagos' },
      alex,
    )

    await rotateClubInvite('player', alex)
    await rotateClubInvite('co-admin', alex)
    const ownerDirectory = await getClubDirectory(alex)
    const playerInvite = ownerDirectory.clubs[0].invitations.find((invite) => invite.role === 'player')
    const coAdminInvite = ownerDirectory.clubs[0].invitations.find((invite) => invite.role === 'co-admin')

    await joinClubWithInvite(playerInvite.code, { userId: 'jordan', name: 'Jordan' })
    await joinClubWithInvite(coAdminInvite.code, { userId: 'riley', name: 'Riley' })

    const firstAsk = await askForClubLadder({ userId: 'jordan', name: 'Jordan' })
    assert.equal(firstAsk.alreadyAsked, false)
    assert.equal(firstAsk.waitingCount, 1)

    const duplicateAsk = await askForClubLadder({ userId: 'jordan', name: 'Jordan' })
    assert.equal(duplicateAsk.alreadyAsked, true)

    await joinClubWithInvite(playerInvite.code, { userId: 'taylor', name: 'Taylor' })
    const secondAsk = await askForClubLadder({ userId: 'taylor', name: 'Taylor' })
    assert.equal(secondAsk.waitingCount, 2)

    await assert.rejects(
      () => askForClubLadder({ userId: 'riley', name: 'Riley' }),
      /only club members/i,
    )

    const adminDirectory = await getClubDirectory(alex)
    assert.equal(adminDirectory.clubs[0].ladderAsks.length, 2)
    assert.equal(adminDirectory.clubs[0].ladderAsks[0].memberName, 'Jordan')
    assert.equal(adminDirectory.clubs[0].ladderAskEmails.length, 1)
    assert.deepEqual(adminDirectory.clubs[0].ladderAskEmails[0].actions.map((action) => action.label), ['Add players', 'Import players'])
    assert.equal(adminDirectory.clubs[0].ladderAskEmails[0].subject, 'Jordan wants a ladder')

    const coAdminDirectory = await getClubDirectory({ userId: 'riley' })
    assert.equal(coAdminDirectory.clubs[0].ladderAskEmails.length, 1)
    assert.equal(coAdminDirectory.clubs[0].ladderAskEmails[0].subject, 'Jordan wants a ladder')

    const result = await createClubLadder(
      {
        name: 'Club Ladder',
        matchType: 'singles',
        eligibility: {
          gender: 'any',
          age: { mode: 'any' },
          skill: { mode: 'any' },
        },
      },
      alex,
    )
    assert.ok(result.ladder?.id)

    const memberDirectory = await getClubDirectory({ userId: 'jordan' })
    assert.equal(memberDirectory.clubs[0].ladderAsks.length, 1)
    assert.equal(memberDirectory.clubs[0].ladderAsks[0].status, 'done')
    assert.equal(memberDirectory.clubs[0].ladderAsks[0].ladderId, result.ladder.id)
    assert.equal(created.club.id, memberDirectory.activeClubId)
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
})