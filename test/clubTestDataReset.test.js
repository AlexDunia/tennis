import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createDefaultClubSetup,
} from '../src/config/admin.js'

import {
  clearClubTestDataSetup,
} from '../src/services/AdminService.js'

test(
  'test-data reset clears member and ladder data without destroying club configuration',
  () => {
    const source =
      createDefaultClubSetup()

    source.status = 'active'

    source.workspace = {
      ...source.workspace,
      name: 'Greenview Tennis Club',
      location: 'Lagos, Nigeria',
      courts: [
        'Centre Court',
        'Court 2',
      ],
      administratorIds: ['alex'],
    }

    source.membership = {
      ...source.membership,
      source: 'import-list',
      selectedPlayerIds: [
        'member-one',
      ],
      inviteEmails:
        'member@example.com',
      invitePhones:
        '+2348000000000',
      privateLinkEnabled: true,
      invitationToken:
        'abcdefghijklmnopqrstuvwx',
      invitationCode: 'ABC123',
      importedMembers: [
        {
          id: 'member-one',
          name: 'Ada Player',
          email:
            'ada@example.com',
          source: 'import',
          role: 'player',
          status: 'active',
        },
      ],
      manualMembers: [
        {
          id: 'member-two',
          name: 'Bola Player',
          email:
            'bola@example.com',
          source: 'manual',
          role: 'player',
          status: 'active',
        },
      ],
      roster: [
        {
          id: 'member-three',
          name: 'Chidi Player',
          email:
            'chidi@example.com',
          source: 'existing',
          role: 'player',
          status: 'active',
        },
      ],
    }

    source.ladders = [
      {
        id: 'mens-singles',
        name: "Men's Singles",
        matchType: 'singles',
        enabled: true,
        archived: false,
      },
    ]

    source.primaryLadderId =
      'mens-singles'

    source.placement = {
      ...source.placement,
      rankingOrder: [
        'member-one',
        'member-two',
      ],
    }

    const rulesBefore = {
      ...source.rules,
    }

    const cleared =
      clearClubTestDataSetup(
        source,
        '2026-09-07T16:00:00.000Z',
      )

    assert.equal(
      cleared.workspace.name,
      'Greenview Tennis Club',
    )

    assert.equal(
      cleared.workspace.location,
      'Lagos, Nigeria',
    )

    assert.deepEqual(
      cleared.workspace.courts,
      [
        'Centre Court',
        'Court 2',
      ],
    )

    assert.deepEqual(
      cleared.workspace.administratorIds,
      ['alex'],
    )

    assert.deepEqual(
      cleared.rules,
      rulesBefore,
    )

    assert.equal(
      cleared.membership.privateLinkEnabled,
      true,
    )

    assert.equal(
      cleared.membership.invitationToken,
      'abcdefghijklmnopqrstuvwx',
    )

    assert.equal(
      cleared.membership.invitationCode,
      'ABC123',
    )

    assert.deepEqual(
      cleared.membership.selectedPlayerIds,
      [],
    )

    assert.deepEqual(
      cleared.membership.importedMembers,
      [],
    )

    assert.deepEqual(
      cleared.membership.manualMembers,
      [],
    )

    assert.deepEqual(
      cleared.membership.roster,
      [],
    )

    assert.deepEqual(
      cleared.ladders,
      [],
    )

    assert.equal(
      cleared.primaryLadderId,
      '',
    )

    assert.deepEqual(
      cleared.placement.rankingOrder,
      [],
    )
  },
)
