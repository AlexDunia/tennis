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
const clubCreateSource = readFileSync(
  'src/components/club/ClubCreatePanel.vue',
  'utf8',
)
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

test('Create Club uses the prepared minimal ClubCreatePanel and real club handoff', () => {
  assert.match(
    clubsViewSource,
    /import ClubCreatePanel from '\.\.\/components\/club\/ClubCreatePanel\.vue'/,
  )

  assert.match(
    clubsViewSource,
    /<ClubCreatePanel[\s\S]*:countries="COUNTRY_OPTIONS"[\s\S]*@cancel="showClubDirectory"/,
  )

  assert.doesNotMatch(
    clubsViewSource,
    /minimalClub = reactive/,
  )

  assert.match(clubCreateSource, /v-model="form\.name"/)
  assert.match(clubCreateSource, /v-model="form\.country"/)
  assert.match(clubCreateSource, /v-model="form\.city"/)

  assert.match(
    clubCreateSource,
    /const input = \{[\s\S]*name: form\.name\.trim\(\),[\s\S]*country: form\.country\.trim\(\),[\s\S]*city: form\.city\.trim\(\)/,
  )

  assert.match(
    clubCreateSource,
    /await adminStore\.createClub\(input\)/,
  )

  assert.match(
    clubCreateSource,
    /await router\.push\(\{ name: 'Club' \}\)/,
  )

  assert.match(clubCreateSource, />Club basics<\/h2>/)
  assert.match(clubCreateSource, />Your club<\/h2>/)
  assert.match(clubCreateSource, />You · Admin<\/small>/)
  assert.match(clubCreateSource, /<strong>0<\/strong> members/)
  assert.match(clubCreateSource, /<strong>0<\/strong> ladders/)

  assert.match(clubCreateSource, /type="file"/)

  assert.match(clubCreateSource, /logoUrl: form\.logoUrl/)
  assert.match(clubCreateSource, /coverUrl: form\.coverUrl/)

  assert.match(clubViewSource, /name: 'ClubMembers'/)
})


test('optional club images survive creation and reload without creating setup data', async () => {
  await withStorage(async () => {
    const logoUrl = 'data:image/png;base64,' + 'A'.repeat(4096)
    const coverUrl = 'data:image/webp;base64,' + 'B'.repeat(8192)
    const result = await createClub({ name: 'Image Club', country: 'Nigeria', city: 'Lagos', logoUrl, coverUrl }, { userId: 'image-admin' })
    const stored = (await getClubDirectory({ userId: 'image-admin' })).clubs.find(club => club.id === result.club.id).setup
    assert.equal(stored.workspace.logoUrl, logoUrl)
    assert.equal(stored.workspace.coverUrl, coverUrl)
    assert.deepEqual(stored.ladders, [])
    assert.deepEqual(stored.membership.roster, [])
    assert.deepEqual(stored.workspace.courts, [])
    assert.deepEqual(stored.rules, {})
  })
})

test('club creation discards unsafe and oversized image sources', async () => {
  await withStorage(async () => {
    const result = await createClub({ name: 'Safe Club', country: 'Nigeria', city: 'Lagos', logoUrl: 'javascript:alert(1)', coverUrl: 'data:image/png;base64,' + 'A'.repeat(2_100_000) }, { userId: 'safe-admin' })
    assert.equal(result.club.setup.workspace.logoUrl, '')
    assert.equal(result.club.setup.workspace.coverUrl, '')
  })
})
