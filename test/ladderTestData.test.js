import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { LADDER_TEST_MEMBER_POOL, TEST_MEMBER_PREFIX } from '../src/data/ladderTestMembers.js'
import {
  populateActiveClubTestPlayers,
  populateActiveClubTestPlayersSetup,
} from '../src/services/AdminService.js'
import { normalizeClubSetup } from '../src/utils/admin/clubSetup.js'
import {
  collectClubMembers,
  makeManualMemberRecord,
  memberCollectionsPatch,
} from '../src/utils/club/memberData.js'

const TIMESTAMP = '2026-09-25T10:00:00.000Z'

function fixtureSetup() {
  return normalizeClubSetup({
    configurationState: 'minimal',
    status: 'active',
    workspace: {
      name: 'Victoria Island Tennis Club',
      courts: ['Court 1', 'Court 2'],
      timezone: 'Africa/Lagos',
    },
    playerLevels: {
      levels: [
        { id: 'advanced', label: 'Advanced', active: true },
        { id: 'competition', label: 'Competition', active: true },
      ],
    },
    membership: {
      source: 'manual',
      manualMembers: [
        {
          id: 'real-member-01',
          userId: '',
          name: 'Existing Club Member',
          email: 'existing.member@example.test',
          phone: '+234 800 000 0001',
          gender: 'female',
          dob: '1988-06-08',
          bio: 'Existing member profile must survive test population.',
          role: 'player',
          source: 'manual',
          status: 'active',
          ladderMemberships: [{ ladderId: 'mens', ladderName: 'Men', position: 1 }],
        },
      ],
      roster: [],
      importedMembers: [],
    },
    ladders: [
      {
        id: 'mens',
        name: 'Men',
        matchType: 'singles',
        enabled: true,
        archived: false,
        status: 'active',
        setupStep: 'complete',
        eligibility: {
          gender: 'men',
          age: { mode: 'any' },
          skill: { mode: 'rating', ratingSystem: 'ntrp', minimum: 3, maximum: 4 },
        },
        entries: [{ memberId: 'real-member-01', status: 'active', position: 1, setupOrder: 1, source: 'admin', joinedAt: TIMESTAMP }],
      },
      {
        id: 'womens',
        name: 'Women',
        matchType: 'singles',
        enabled: true,
        archived: false,
        status: 'active',
        setupStep: 'complete',
        eligibility: { gender: 'women', age: { mode: 'any' }, skill: { mode: 'any' } },
        entries: [],
      },
      {
        id: 'veterans',
        name: 'Veterans',
        matchType: 'singles',
        enabled: true,
        archived: false,
        status: 'active',
        setupStep: 'complete',
        eligibility: {
          gender: 'any',
          age: { mode: 'range', minimum: 50, maximum: 100 },
          skill: { mode: 'club_level', levelIds: ['competition'] },
        },
        entries: [],
      },
    ],
    primaryLadderId: 'mens',
    placement: { method: '', rankingOrder: [] },
    rules: {
      challengeRangeUp: 4,
      allowDownwardChallenges: false,
      maxActiveChallenges: 1,
      responseHours: 48,
      completionDays: 7,
      movementSystem: 'leapfrog',
      matchFormat: 'best-of-3',
      decidingSet: 'full-set',
      tieBreakPoints: 7,
      scoring: 'ad',
    },
  })
}

function generatedEntries(ladder) {
  return ladder.entries
    .filter((entry) => entry.memberId.startsWith(TEST_MEMBER_PREFIX))
    .sort((left, right) => left.position - right.position)
}

test('bio survives member creation, collection updates, and setup normalization', () => {
  const initial = fixtureSetup()
  const record = makeManualMemberRecord({
    name: 'Bio Test Member',
    email: 'bio.member@gorra.example',
    bio: '<b>Calm</b> all-court player with a thoughtful return game.',
  }, initial)
  const membership = memberCollectionsPatch(initial, 'real-member-01', {
    bio: record.bio,
  })
  const normalized = normalizeClubSetup({ ...initial, membership })
  const saved = collectClubMembers(normalized).find((member) => member.id === 'real-member-01')

  assert.equal(record.bio, 'Calm all-court player with a thoughtful return game.')
  assert.equal(saved.bio, record.bio)
  assert.ok(saved.bio.length <= 500)
})

test('synthetic pool uses unique bios, DOBs, and UTR only', () => {
  assert.equal(LADDER_TEST_MEMBER_POOL.length, 30)
  assert.equal(new Set(LADDER_TEST_MEMBER_POOL.map((member) => member.bio)).size, 30)

  LADDER_TEST_MEMBER_POOL.forEach((member) => {
    assert.match(member.id, /^gorra-test-member-/)
    assert.match(member.email, /@gorra\.example$/)
    assert.match(member.dob, /^\d{4}-\d{2}-\d{2}$/)
    assert.equal(Object.hasOwn(member, 'age'), false)
    assert.deepEqual(Object.keys(member.ratings), ['utr'])
    assert.equal(typeof member.ratings.utr.value, 'number')
    assert.equal(Object.hasOwn(member.ratings, 'ntrp'), false)
    assert.equal(Object.hasOwn(member.ratings, 'wtn'), false)
  })
})

test('population creates ten valid generated entries per active ladder without changing club or ladder settings', () => {
  const initial = fixtureSetup()
  const initialRules = structuredClone(initial.rules)
  const initialLadders = initial.ladders.map((ladder) => ({
    id: ladder.id,
    name: ladder.name,
    matchType: ladder.matchType,
    enabled: ladder.enabled,
    archived: ladder.archived,
  }))
  const result = populateActiveClubTestPlayersSetup(initial, TIMESTAMP)
  const members = collectClubMembers(result.setup)
  const memberIds = new Set(members.map((member) => member.id))

  assert.equal(result.generatedMemberCount, 30)
  assert.equal(result.activeLadderCount, 3)
  assert.equal(members.filter((member) => member.id.startsWith(TEST_MEMBER_PREFIX)).length, 30)
  assert.ok(members.some((member) => member.id === 'real-member-01'))
  assert.deepEqual(result.setup.rules, initialRules)
  assert.deepEqual(
    result.setup.ladders.map((ladder) => ({ id: ladder.id, name: ladder.name, matchType: ladder.matchType, enabled: ladder.enabled, archived: ladder.archived })),
    initialLadders,
  )

  result.setup.ladders.forEach((ladder) => {
    const entries = generatedEntries(ladder)
    assert.equal(entries.length, 10)
    assert.deepEqual(entries.map((entry) => entry.position), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    assert.equal(new Set(entries.map((entry) => entry.position)).size, 10)
    entries.forEach((entry) => assert.ok(memberIds.has(entry.memberId)))
  })

  const men = result.setup.ladders.find((ladder) => ladder.id === 'mens')
  assert.equal(men.eligibility.skill.ratingSystem, 'utr')
  assert.equal(men.eligibility.skill.mode, 'rating')
  assert.deepEqual(result.setup.placement.rankingOrder, generatedEntries(men).map((entry) => entry.memberId))

  const veterans = result.setup.ladders.find((ladder) => ladder.id === 'veterans')
  generatedEntries(veterans).forEach((entry) => {
    assert.equal(members.find((member) => member.id === entry.memberId).clubLevelId, 'competition')
  })

  assert.equal(Object.hasOwn(result.setup, 'matches'), false)
  assert.equal(Object.hasOwn(result.setup, 'challenges'), false)
})

test('population is deterministic and does not duplicate generated members', () => {
  const first = populateActiveClubTestPlayersSetup(fixtureSetup(), TIMESTAMP)
  const second = populateActiveClubTestPlayersSetup(first.setup, TIMESTAMP)
  const members = collectClubMembers(second.setup)

  assert.equal(members.filter((member) => member.id.startsWith(TEST_MEMBER_PREFIX)).length, 30)
  second.setup.ladders.forEach((ladder) => {
    const entries = generatedEntries(ladder)
    assert.equal(entries.length, 10)
    assert.deepEqual(entries.map((entry) => entry.position), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })
})

test('population service is DEV guarded', async () => {
  const source = await readFile(new URL('../src/services/AdminService.js', import.meta.url), 'utf8')
  assert.match(source, /export async function populateActiveClubTestPlayers\(actor\)/)
  assert.match(source, /if \(!import\.meta\.env\?\.DEV\)/)
  await assert.rejects(
    () => populateActiveClubTestPlayers({ userId: 'admin' }),
    /only available in development/i,
  )
})