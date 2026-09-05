import assert from 'node:assert/strict'
import test from 'node:test'
import { createMinimalClubSetup } from '../src/config/admin.js'
import { normalizeClubSetup } from '../src/utils/admin/clubSetup.js'

test('club member optional profile and imported ladder fields survive normalization', () => {
  const setup = createMinimalClubSetup({
    clubId: 'greenview',
    name: 'Greenview Tennis Club',
    country: 'Nigeria',
    city: 'Lagos',
    creatorId: 'alex',
  })

  setup.membership.importedMembers = [
    {
      id: 'henry',
      userId: '',
      name: 'Henry Mensah',
      email: 'henry@example.com',
      phone: '+2348000000000',
      gender: 'Male',
      dob: '1995-06-20',
      level: 'Intermediate',
      rating: '4.0',
      memberNumber: 'GV-018',
      yearOfEntry: '2024',
      role: 'player',
      source: 'import',
      status: 'active',
      ladderMemberships: [
        {
          ladderName: "Men's Singles",
          position: 3,
        },
      ],
    },
  ]

  const normalized = normalizeClubSetup(setup)
  const member = normalized.membership.importedMembers[0]

  assert.equal(member.gender, 'Male')
  assert.equal(member.dob, '1995-06-20')
  assert.equal(member.level, 'Intermediate')
  assert.equal(member.rating, '4.0')
  assert.equal(member.memberNumber, 'GV-018')
  assert.equal(member.yearOfEntry, '2024')
  assert.deepEqual(member.ladderMemberships, [
    {
      ladderId: '',
      ladderName: "Men's Singles",
      position: 3,
    },
  ])
  assert.equal('accountLinked' in member, false)
})
