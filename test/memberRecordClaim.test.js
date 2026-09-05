import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createClub,
  createMemberRecordInvite,
  getClubDirectory,
  joinClubWithInvite,
  previewClubInvite,
  rotateClubInvite,
  updateActiveClubSetup,
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
  globalThis.window = {
    localStorage: createMemoryStorage(),
  }

  try {
    await run()
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
}

async function createClubWithHenry() {
  const manager = { userId: 'alex' }

  const created = await createClub(
    {
      name: 'Greenview Tennis Club',
      country: 'Nigeria',
      city: 'Lagos',
    },
    manager,
  )

  await updateActiveClubSetup(
    {
      membership: {
        manualMembers: [
          {
            id: 'henry-mensah',
            userId: '',
            name: 'Henry Mensah',
            email: 'henry@example.com',
            phone: '+2348000000000',
            role: 'player',
            source: 'manual',
            status: 'invited',
          },
        ],
      },
    },
    manager,
  )

  return {
    manager,
    clubId: created.club.id,
  }
}

test('manager creates a member-specific invitation for one exact unlinked record', async () => {
  await withStorage(async () => {
    const { manager } = await createClubWithHenry()

    const invite = await createMemberRecordInvite(
      'henry-mensah',
      manager,
    )

    assert.equal(invite.inviteKind, 'member-record')
    assert.equal(invite.kind, 'member-record')
    assert.equal(invite.memberId, 'henry-mensah')
    assert.equal(invite.member.id, 'henry-mensah')
    assert.equal(invite.member.name, 'Henry Mensah')
    assert.equal(invite.member.email, 'henry@example.com')
    assert.equal(invite.role, 'player')
    assert.ok(invite.code)
    assert.ok(invite.token)
  })
})

test('member-specific preview resolves the current exact member record', async () => {
  await withStorage(async () => {
    const { manager } = await createClubWithHenry()

    const invite = await createMemberRecordInvite(
      'henry-mensah',
      manager,
    )

    const preview = await previewClubInvite(
      invite.code,
      { userId: 'henry-account' },
    )

    assert.equal(preview.inviteKind, 'member-record')
    assert.equal(preview.member.id, 'henry-mensah')
    assert.equal(preview.member.name, 'Henry Mensah')
    assert.equal(preview.member.email, 'henry@example.com')
    assert.equal(preview.role, 'player')
    assert.equal(preview.roleLabel, 'Member')
  })
})

test('claim links the same member record and creates one active club relationship', async () => {
  await withStorage(async () => {
    const { manager, clubId } = await createClubWithHenry()

    const invite = await createMemberRecordInvite(
      'henry-mensah',
      manager,
    )

    const result = await joinClubWithInvite(
      invite.token,
      { userId: 'henry-account' },
    )

    assert.equal(result.inviteKind, 'member-record')
    assert.equal(result.member.id, 'henry-mensah')
    assert.equal(result.member.name, 'Henry Mensah')
    assert.equal(result.membership.userId, 'henry-account')
    assert.equal(result.membership.clubId, clubId)
    assert.equal(result.membership.role, 'player')
    assert.equal(result.membership.status, 'active')

    const ownerDirectory = await getClubDirectory(manager)
    const storedMember =
      ownerDirectory.clubs[0].setup.membership.manualMembers.find(
        (member) => member.id === 'henry-mensah',
      )

    assert.ok(storedMember)
    assert.equal(storedMember.userId, 'henry-account')
    assert.equal(storedMember.id, 'henry-mensah')
    assert.equal(storedMember.name, 'Henry Mensah')
    assert.equal(storedMember.email, 'henry@example.com')
    assert.equal(storedMember.phone, '+2348000000000')
    assert.equal(storedMember.source, 'manual')
    assert.equal(storedMember.role, 'player')
    assert.equal(storedMember.status, 'active')

    const henryDirectory = await getClubDirectory({
      userId: 'henry-account',
    })

    const relationships = henryDirectory.memberships.filter(
      (membership) =>
        membership.userId === 'henry-account' &&
        membership.clubId === clubId,
    )

    assert.equal(relationships.length, 1)

    assert.deepEqual(
      ownerDirectory.clubs[0].setup.workspace.courts,
      [],
    )
    assert.deepEqual(ownerDirectory.clubs[0].setup.ladders, [])
    assert.deepEqual(ownerDirectory.clubs[0].setup.rules, {})
  })
})

test('a redeemed member-specific invitation cannot be reused by another account', async () => {
  await withStorage(async () => {
    const { manager } = await createClubWithHenry()

    const invite = await createMemberRecordInvite(
      'henry-mensah',
      manager,
    )

    await joinClubWithInvite(invite.code, {
      userId: 'henry-account',
    })

    await assert.rejects(
      () =>
        joinClubWithInvite(invite.code, {
          userId: 'different-account',
        }),
      /not valid/i,
    )
  })
})

test('claim fails if the target record becomes linked to another account', async () => {
  await withStorage(async () => {
    const { manager } = await createClubWithHenry()

    const invite = await createMemberRecordInvite(
      'henry-mensah',
      manager,
    )

    await updateActiveClubSetup(
      {
        membership: {
          manualMembers: [
            {
              id: 'henry-mensah',
              userId: 'other-account',
              name: 'Henry Mensah',
              email: 'henry@example.com',
              phone: '+2348000000000',
              role: 'player',
              source: 'manual',
              status: 'active',
            },
          ],
        },
      },
      manager,
    )

    await assert.rejects(
      () =>
        joinClubWithInvite(invite.code, {
          userId: 'henry-account',
        }),
      /already connected/i,
    )
  })
})

test('a normal club member cannot create member-record invitations', async () => {
  await withStorage(async () => {
    const { manager } = await createClubWithHenry()

    const genericInvite = await rotateClubInvite(
      'player',
      manager,
    )

    await joinClubWithInvite(genericInvite.code, {
      userId: 'normal-member',
    })

    await assert.rejects(
      () =>
        createMemberRecordInvite('henry-mensah', {
          userId: 'normal-member',
        }),
      /permission/i,
    )
  })
})

test('generic club invitation never claims an existing matching member record', async () => {
  await withStorage(async () => {
    const { manager } = await createClubWithHenry()

    const genericInvite = await rotateClubInvite(
      'player',
      manager,
    )

    const preview = await previewClubInvite(
      genericInvite.code,
      {
        userId: 'henry-account',
        email: 'henry@example.com',
        name: 'Henry Mensah',
      },
    )

    assert.equal(preview.inviteKind, 'generic-club')

    await joinClubWithInvite(genericInvite.code, {
      userId: 'henry-account',
      email: 'henry@example.com',
      name: 'Henry Mensah',
    })

    const ownerDirectory = await getClubDirectory(manager)
    const storedMember =
      ownerDirectory.clubs[0].setup.membership.manualMembers.find(
        (member) => member.id === 'henry-mensah',
      )

    assert.equal(storedMember.userId, '')
  })
})

test('rotating a generic player invite preserves member-specific player invitations', async () => {
  await withStorage(async () => {
    const { manager } = await createClubWithHenry()

    const memberInvite = await createMemberRecordInvite(
      'henry-mensah',
      manager,
    )

    const genericInvite = await rotateClubInvite(
      'player',
      manager,
    )

    const directory = await getClubDirectory(manager)
    const invitations = directory.clubs[0].invitations

    assert.ok(
      invitations.some(
        (invite) =>
          invite.code === memberInvite.code &&
          invite.kind === 'member-record' &&
          invite.enabled,
      ),
    )

    assert.ok(
      invitations.some(
        (invite) =>
          invite.code === genericInvite.code &&
          invite.kind === 'generic-club' &&
          invite.enabled,
      ),
    )
  })
})

test('one Gorra account cannot claim two different member records in the same club', async () => {
  await withStorage(async () => {
    const { manager } = await createClubWithHenry()

    await updateActiveClubSetup(
      {
        membership: {
          manualMembers: [
            {
              id: 'henry-mensah',
              userId: '',
              name: 'Henry Mensah',
              email: 'henry@example.com',
              role: 'player',
              source: 'manual',
              status: 'invited',
            },
            {
              id: 'henry-second-record',
              userId: '',
              name: 'Henry M.',
              email: 'henry.second@example.com',
              role: 'player',
              source: 'manual',
              status: 'invited',
            },
          ],
        },
      },
      manager,
    )

    const firstInvite = await createMemberRecordInvite(
      'henry-mensah',
      manager,
    )

    const secondInvite = await createMemberRecordInvite(
      'henry-second-record',
      manager,
    )

    await joinClubWithInvite(firstInvite.code, {
      userId: 'henry-account',
    })

    await assert.rejects(
      () =>
        joinClubWithInvite(secondInvite.code, {
          userId: 'henry-account',
        }),
      /already connected to another member record/i,
    )
  })
})
