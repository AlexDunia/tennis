import assert from 'node:assert/strict'
import test from 'node:test'

import { createMinimalClubSetup } from '../src/config/admin.js'
import {
  mergeMemberImportIntoSetup,
  previewMemberImportIntoSetup,
} from '../src/utils/club/memberData.js'

function setupWithMembers() {
  const setup = createMinimalClubSetup({
    name: 'Greenview',
    country: 'Nigeria',
    city: 'Lagos',
  })

  setup.ladders = [
    {
      id: 'mens-singles',
      name: "Men's Singles",
      matchType: 'singles',
      enabled: true,
      archived: false,
    },
  ]

  setup.membership.manualMembers = [
    {
      id: 'henry-mensah',
      userId: 'user-henry',
      name: 'Henry Mensah',
      email: 'henry@example.com',
      phone: '08030000000',
      gender: 'Male',
      dob: '1992-05-03',
      level: 'Advanced',
      rating: '4.2',
      memberNumber: 'GTC-001',
      yearOfEntry: '2022',
      role: 'player',
      source: 'manual',
      status: 'active',
      photoUrl: '',
      ladderMemberships: [
        {
          ladderName: "Men's Singles",
          position: 3,
        },
      ],
    },
    {
      id: 'chidi-okafor',
      userId: '',
      name: 'Chidi Okafor',
      email: 'chidi@example.com',
      phone: '08031111111',
      gender: 'Male',
      dob: '1990-01-11',
      level: 'Advanced',
      rating: '4.0',
      memberNumber: 'GTC-002',
      yearOfEntry: '2021',
      role: 'player',
      source: 'manual',
      status: 'active',
      photoUrl: '',
      ladderMemberships: [
        {
          ladderName: "Men's Singles",
          position: 5,
        },
      ],
    },
  ]

  return setup
}

test('existing values are kept by default while blank values are filled', () => {
  const setup = setupWithMembers()
  setup.membership.manualMembers[0].gender = ''

  const draft = {
    people: [
      {
        name: 'Henry Mensah',
        email: 'henry@example.com',
        phone: '08099999999',
        gender: 'Male',
        memberNumber: 'GTC-001',
        ladderMemberships: [],
      },
    ],
    ladders: [],
  }

  const preview = previewMemberImportIntoSetup(setup, draft)

  assert.equal(preview.summary.existingCount, 1)
  assert.equal(preview.summary.fillCount, 1)
  assert.equal(
    preview.conflicts.some((conflict) => conflict.field === 'phone'),
    true,
  )

  const merged = mergeMemberImportIntoSetup(setup, draft)
  const saved = merged.membership.manualMembers[0]

  assert.equal(saved.phone, '08030000000')
  assert.equal(saved.gender, 'Male')
  assert.equal(saved.userId, 'user-henry')
  assert.equal(saved.role, 'player')
  assert.equal(saved.source, 'manual')
  assert.equal(saved.status, 'active')
})

test('an explicit imported-value resolution replaces an allowed conflicting field', () => {
  const setup = setupWithMembers()
  const draft = {
    people: [
      {
        name: 'Henry Mensah',
        email: 'henry@example.com',
        phone: '08099999999',
        memberNumber: 'GTC-001',
        ladderMemberships: [],
      },
    ],
    ladders: [],
  }

  const preview = previewMemberImportIntoSetup(setup, draft)
  const phoneConflict = preview.conflicts.find(
    (conflict) => conflict.field === 'phone',
  )

  assert.ok(phoneConflict)

  const merged = mergeMemberImportIntoSetup(setup, draft, {
    [phoneConflict.id]: 'incoming',
  })

  assert.equal(
    merged.membership.manualMembers[0].phone,
    '08099999999',
  )
})

test('ambiguous strong identity is surfaced before any merge', () => {
  const setup = setupWithMembers()
  const draft = {
    people: [
      {
        name: 'Wrongly combined row',
        email: 'henry@example.com',
        memberNumber: 'GTC-002',
        ladderMemberships: [],
      },
    ],
    ladders: [],
  }

  const preview = previewMemberImportIntoSetup(setup, draft)

  assert.equal(preview.canApply, false)
  assert.equal(
    preview.blockingConflicts.some(
      (conflict) => conflict.kind === 'ambiguous-identity',
    ),
    true,
  )

  assert.throws(
    () => mergeMemberImportIntoSetup(setup, draft),
    /will not guess/i,
  )
})

test('an imported ladder position cannot displace a stationary existing member', () => {
  const setup = setupWithMembers()

  const draft = {
    people: [
      {
        name: 'Henry Mensah',
        email: 'henry@example.com',
        memberNumber: 'GTC-001',
        ladderMemberships: [
          {
            ladderName: "Men's Singles",
            position: 5,
          },
        ],
      },
    ],
    ladders: [],
  }

  const firstPreview = previewMemberImportIntoSetup(setup, draft)
  const ladderConflict = firstPreview.conflicts.find(
    (conflict) => conflict.kind === 'ladder-position',
  )

  const importedPreview = previewMemberImportIntoSetup(setup, draft, {
    [ladderConflict.id]: 'incoming',
  })

  assert.equal(importedPreview.canApply, false)
  assert.equal(
    importedPreview.blockingConflicts.some(
      (conflict) => conflict.kind === 'ladder-position-occupied',
    ),
    true,
  )
})

test('a complete imported swap can move both matched players without duplicate positions', () => {
  const setup = setupWithMembers()

  const draft = {
    people: [
      {
        name: 'Henry Mensah',
        email: 'henry@example.com',
        memberNumber: 'GTC-001',
        ladderMemberships: [
          {
            ladderName: "Men's Singles",
            position: 5,
          },
        ],
      },
      {
        name: 'Chidi Okafor',
        email: 'chidi@example.com',
        memberNumber: 'GTC-002',
        ladderMemberships: [
          {
            ladderName: "Men's Singles",
            position: 3,
          },
        ],
      },
    ],
    ladders: [],
  }

  const preview = previewMemberImportIntoSetup(setup, draft)
  const ladderConflicts = preview.conflicts.filter(
    (conflict) => conflict.kind === 'ladder-position',
  )

  assert.equal(ladderConflicts.length, 2)

  const resolutions = Object.fromEntries(
    ladderConflicts.map((conflict) => [conflict.id, 'incoming']),
  )

  const resolvedPreview = previewMemberImportIntoSetup(
    setup,
    draft,
    resolutions,
  )

  assert.equal(resolvedPreview.canApply, true)

  const merged = mergeMemberImportIntoSetup(
    setup,
    draft,
    resolutions,
  )

  const henry = merged.membership.manualMembers.find(
    (member) => member.id === 'henry-mensah',
  )
  const chidi = merged.membership.manualMembers.find(
    (member) => member.id === 'chidi-okafor',
  )

  assert.equal(henry.ladderMemberships[0].position, 5)
  assert.equal(chidi.ladderMemberships[0].position, 3)
})

test('same-file conflict decisions are honored before comparing with the club record', () => {
  const setup = setupWithMembers()

  const draft = {
    people: [
      {
        importIdentity: 'email:henry@example.com',
        importRows: [0, 1],
        importConflicts: [
          {
            id: 'file:henry:field:phone:1',
            kind: 'file-field',
            field: 'phone',
            fieldLabel: 'Phone',
            earlierValue: '08030000000',
            incomingValue: '08095555555',
            earlierRow: 0,
            incomingRow: 1,
          },
        ],
        name: 'Henry Mensah',
        email: 'henry@example.com',
        phone: '08030000000',
        memberNumber: 'GTC-001',
        ladderMemberships: [],
      },
    ],
    ladders: [],
  }

  const preview = previewMemberImportIntoSetup(setup, draft)

  assert.equal(
    preview.conflicts.some(
      (conflict) => conflict.id === 'file:henry:field:phone:1',
    ),
    true,
  )

  const merged = mergeMemberImportIntoSetup(setup, draft, {
    'file:henry:field:phone:1': 'incoming',
    'member:henry-mensah:field:phone': 'incoming',
  })

  assert.equal(
    merged.membership.manualMembers[0].phone,
    '08095555555',
  )
})

