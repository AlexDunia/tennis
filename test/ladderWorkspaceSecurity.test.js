import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ageOnDate,
  digestLadderInviteToken,
  evaluateLadderEligibility,
  ladderEligibilityMissingFields,
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

test('eligibility asks only for required facts', () => {
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

test('age and skill are enforced', () => {
  const result = evaluateLadderEligibility({
    eligibility: {
      gender: 'men',
      age: {
        mode: 'range',
        minimum: 18,
        maximum: 35,
      },
      skill: {
        mode: 'set',
        levels: ['intermediate', 'advanced'],
      },
    },
    profile: {
      gender: 'male',
      dob: '2000-01-01',
      level: 'Advanced',
    },
    now: new Date('2026-09-14T12:00:00Z'),
  })

  assert.equal(result.eligible, true)
  assert.equal(result.complete, true)
})

test('public join sanitizer cannot carry rank authority', () => {
  const profile = sanitizeLadderJoinProfile({
    name: 'Alex Dunia',
    email: ' ALEX@EXAMPLE.COM ',
    position: 1,
    rank: 1,
    role: 'admin',
    status: 'active',
  })

  assert.deepEqual(
    Object.keys(profile).sort(),
    ['dob', 'email', 'gender', 'level', 'name', 'phone'],
  )

  assert.equal(profile.email, 'alex@example.com')
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
