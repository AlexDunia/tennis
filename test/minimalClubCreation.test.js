import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  CLUB_DIRECTORY_SCHEMA_VERSION,
  CLUB_DIRECTORY_STORAGE_KEY,
  createDefaultClubSetup,
} from '../src/config/admin.js'
import {
  createClub,
  getClubDirectory,
  updateActiveClubSetup,
} from '../src/services/AdminService.js'
import { hasClubMembershipPermission } from '../src/utils/auth/accessControl.js'

const clubsViewSource = readFileSync('src/views/ClubsView.vue', 'utf8')
const clubViewSource = readFileSync('src/views/ClubView.vue', 'utf8')
const settingsViewSource = readFileSync('src/views/SettingsView.vue', 'utf8')

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
  const localStorage = createMemoryStorage()
  globalThis.window = { localStorage }
  try {
    await run(localStorage)
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
}

test('Create Club requires name, country, and city', async () => {
  await withStorage(async () => {
    const actor = { userId: 'alex' }
    await assert.rejects(
      () => createClub({ name: '', country: 'Nigeria', city: 'Lagos' }, actor),
      /club name/i,
    )
    await assert.rejects(
      () => createClub({ name: 'Greenview', country: '', city: 'Lagos' }, actor),
      /country/i,
    )
    await assert.rejects(
      () => createClub({ name: 'Greenview', country: 'Nigeria', city: '' }, actor),
      /city/i,
    )
  })
})

test('new club is minimal, active, and managed through the creator relationship', async () => {
  await withStorage(async () => {
    const account = {
      userId: 'alex',
      roleKey: 'player',
      permissions: [],
      isAdmin: false,
    }
    const accountBeforeCreation = structuredClone(account)
    const created = await createClub(
      { name: 'Greenview Tennis Club', country: 'Nigeria', city: 'Lagos' },
      account,
    )
    const directory = await getClubDirectory(account)
    const setup = created.club.setup

    assert.equal(directory.activeClubId, created.club.id)
    assert.deepEqual(account, accountBeforeCreation)
    assert.deepEqual(created.membership, {
      userId: 'alex',
      clubId: created.club.id,
      role: 'admin',
      status: 'active',
      joinedAt: created.membership.joinedAt,
    })
    assert.equal(hasClubMembershipPermission(created.membership, 'club.manage'), true)
    assert.equal(setup.status, 'active')
    assert.equal(setup.configurationState, 'minimal')
    assert.equal(setup.completedStep, 0)
    assert.equal(setup.workspace.name, 'Greenview Tennis Club')
    assert.equal(setup.workspace.country, 'Nigeria')
    assert.equal(setup.workspace.city, 'Lagos')
    assert.equal(setup.workspace.location, 'Lagos, Nigeria')
    assert.deepEqual(setup.workspace.courts, [])
    assert.deepEqual(setup.ladders, [])
    assert.equal(setup.primaryLadderId, '')
    assert.deepEqual(setup.placement, {
      method: '',
      provisionalMatches: 0,
      newMemberPolicy: '',
      rankingOrder: [],
    })
    assert.deepEqual(setup.rules, {})
    assert.deepEqual(setup.membership.importedMembers, [])
    assert.deepEqual(setup.membership.manualMembers, [])
    assert.deepEqual(setup.membership.roster, [])
    assert.equal(created.club.invitations.length, 0)
  })
})

test('adding members to a minimal club does not create Ladder, placement, rules, or courts', async () => {
  await withStorage(async () => {
    const actor = { userId: 'alex' }
    await createClub({ name: 'Greenview Tennis Club', country: 'Nigeria', city: 'Lagos' }, actor)
    await updateActiveClubSetup(
      {
        membership: {
          manualMembers: [
            {
              id: 'member-one',
              name: 'Jordan Lee',
              role: 'player',
              source: 'manual',
              status: 'invited',
            },
          ],
        },
      },
      actor,
    )

    const setup = (await getClubDirectory(actor)).clubs[0].setup
    assert.equal(setup.completedStep, 0)
    assert.deepEqual(setup.workspace.courts, [])
    assert.deepEqual(setup.ladders, [])
    assert.deepEqual(setup.placement, {
      method: '',
      provisionalMatches: 0,
      newMemberPolicy: '',
      rankingOrder: [],
    })
    assert.deepEqual(setup.rules, {})
    assert.equal(setup.membership.manualMembers.length, 1)
  })
})

test('existing stored clubs keep their pre-change setup configuration', async () => {
  await withStorage(async (localStorage) => {
    const setup = createDefaultClubSetup()
    setup.clubId = 'existing-club'
    setup.status = 'active'
    setup.completedStep = 5
    setup.workspace.name = 'Existing Tennis Club'
    setup.workspace.location = 'Ibadan'
    setup.workspace.courts = ['Centre Court']
    setup.ladders[0].name = 'Existing Singles'
    setup.rules.challengeRangeUp = 5

    localStorage.setItem(
      CLUB_DIRECTORY_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: CLUB_DIRECTORY_SCHEMA_VERSION,
        clubs: [
          {
            id: 'existing-club',
            name: 'Existing Tennis Club',
            setup,
            invites: [],
          },
        ],
        memberships: [
          {
            userId: 'alex',
            clubId: 'existing-club',
            role: 'admin',
            status: 'active',
          },
        ],
        activeClubByUser: { alex: 'existing-club' },
      }),
    )

    const stored = (await getClubDirectory({ userId: 'alex' })).clubs[0].setup
    assert.deepEqual(stored.workspace.courts, ['Centre Court'])
    assert.equal(stored.ladders[0].name, 'Existing Singles')
    assert.equal(stored.rules.challengeRangeUp, 5)
    assert.equal(stored.completedStep, 5)
    assert.equal(Object.hasOwn(stored, 'configurationState'), false)
    assert.equal(Object.hasOwn(stored.workspace, 'country'), false)
    assert.equal(Object.hasOwn(stored.workspace, 'city'), false)
  })
})

test('Create Club form and first-club handoff use the approved real destinations', () => {
  assert.match(clubsViewSource, /minimalClub = reactive\(\{ name: '', country: '', city: '' \}\)/)
  assert.match(clubsViewSource, /<span>Country<\/span>/)
  assert.match(clubsViewSource, /<span>City<\/span>/)
  assert.match(clubsViewSource, /await router\.push\(\{ name: 'Club' \}\)/)
  assert.match(clubViewSource, /title="Your club is ready"/)
  assert.match(clubViewSource, /primary-action-label="Add members"/)
  assert.match(clubViewSource, /name: 'Settings', query: \{ section: 'members' \}/)
  assert.match(settingsViewSource, /route\.query\.section/)
  assert.match(settingsViewSource, /value\.configurationState !== 'minimal'/)
})
