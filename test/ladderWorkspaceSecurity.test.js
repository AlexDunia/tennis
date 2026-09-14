import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ageOnDate,
  digestLadderInviteToken,
  evaluateLadderEligibility,
  ladderEligibilityMissingFields,
  normalizeLadderEligibility,
  normalizeLadderEntries,
  sanitizeLadderJoinProfile,
} from '../src/domain/ladderWorkspace.js'

test('age is derived from DOB', () => {
  assert.equal(
    ageOnDate(
      '2000-09-15',
      new Date('2026-09-14T12:00:00Z'),
    ),
    25,
  )

  assert.equal(
    ageOnDate(
      '2000-09-14',
      new Date('2026-09-14T12:00:00Z'),
    ),
    26,
  )
})

test('eligibility asks only for required personal facts', () => {
  assert.deepEqual(
    ladderEligibilityMissingFields(
      {
        gender: 'men',
        age: { mode: 'any' },
        skill: { mode: 'any' },
      },
      { name: 'Alex Dunia' },
    ),
    ['gender'],
  )
})

test('legacy text levels normalize to stable club level IDs', () => {
  const eligibility = normalizeLadderEligibility({
    skill: {
      mode: 'set',
      levels: ['Intermediate', 'Advanced'],
    },
  })

  assert.equal(eligibility.skill.mode, 'club_level')
  assert.deepEqual(
    eligibility.skill.levelIds,
    ['intermediate', 'advanced'],
  )
})

test('age and admin-owned club level are enforced', () => {
  const result = evaluateLadderEligibility({
    eligibility: {
      gender: 'men',
      age: {
        mode: 'range',
        minimum: 18,
        maximum: 35,
      },
      skill: {
        mode: 'club_level',
        levelIds: ['intermediate', 'advanced'],
      },
    },
    profile: {
      gender: 'male',
      dob: '2000-01-01',
      clubLevelId: 'advanced',
    },
    now: new Date('2026-09-14T12:00:00Z'),
  })

  assert.equal(result.eligible, true)
  assert.equal(result.complete, true)
})

test('missing club level is an admin-owned missing fact', () => {
  const result = evaluateLadderEligibility({
    eligibility: {
      gender: 'any',
      age: { mode: 'any' },
      skill: {
        mode: 'club_level',
        levelIds: ['intermediate'],
      },
    },
    profile: {
      name: 'Alex Dunia',
    },
  })

  assert.equal(result.eligible, false)
  assert.equal(result.complete, false)
  assert.deepEqual(result.missing, ['clubLevel'])
})

test('public join sanitizer cannot carry club level, rating or rank authority', () => {
  const profile = sanitizeLadderJoinProfile({
    name: 'Alex Dunia',
    email: ' ALEX@EXAMPLE.COM ',
    level: 'advanced',
    clubLevelId: 'competition',
    rating: '9999',
    position: 1,
    rank: 1,
    role: 'admin',
    status: 'active',
  })

  assert.deepEqual(
    Object.keys(profile).sort(),
    ['dob', 'email', 'gender', 'name', 'phone'],
  )

  assert.equal(profile.email, 'alex@example.com')
  assert.equal(Object.hasOwn(profile, 'clubLevelId'), false)
  assert.equal(Object.hasOwn(profile, 'level'), false)
  assert.equal(Object.hasOwn(profile, 'rating'), false)
  assert.equal(Object.hasOwn(profile, 'position'), false)
})

test('entries deduplicate a member', () => {
  const entries = normalizeLadderEntries([
    {
      memberId: 'alex',
      status: 'active',
      position: 3,
    },
    {
      memberId: 'alex',
      status: 'active',
      position: 1,
    },
  ])

  assert.equal(entries.length, 1)
  assert.equal(entries[0].position, 3)
})

test('share token is persisted as a one-way digest', async () => {
  const token = 'a'.repeat(48)
  const digest = await digestLadderInviteToken(token)

  assert.equal(digest.length, 64)
  assert.notEqual(digest, token)
})
