import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ladderImportTemplateHeaders,
  normalizeLadderImportDate,
  previewExistingLadderImport,
  spreadsheetRowsForLadder,
} from '../src/services/LadderImportService.js'

function setupWithMembers(
  members = [],
) {
  return {
    playerLevels: {
      levels: [
        {
          id: 'beginner',
          label: 'Beginner',
          active: true,
        },
        {
          id: 'intermediate',
          label: 'Intermediate',
          active: true,
        },
        {
          id: 'advanced',
          label: 'Advanced',
          active: true,
        },
      ],
    },
    membership: {
      roster: [],
      manualMembers:
        members,
      importedMembers: [],
    },
  }
}

function restrictedLadder() {
  return {
    id: 'mens-35',
    name: "Men's 35+",
    eligibility: {
      gender: 'men',
      age: {
        mode: 'range',
        minimum: 35,
        maximum: 100,
      },
      skill: {
        mode: 'rating',
        ratingSystem: 'ntrp',
        minimum: 3,
        maximum: 4,
      },
    },
  }
}

test('template derives columns from Ladder rules', () => {
  assert.deepEqual(
    ladderImportTemplateHeaders(
      restrictedLadder(),
    ),
    [
      'Name',
      'Email',
      'Position',
      'Gender',
      'Date of Birth',
      'NTRP',
    ],
  )
})

test('existing member facts satisfy missing spreadsheet columns', () => {
  const setup =
    setupWithMembers([
      {
        id: 'alex',
        name: 'Alex Dunia',
        email:
          'alex@example.com',
        gender: 'men',
        dob: '1988-04-10',
        ratings: {
          ntrp: {
            value: 3.5,
            source: 'admin',
          },
        },
        role: 'player',
        source: 'manual',
        status: 'active',
      },
    ])

  const rows =
    spreadsheetRowsForLadder(
      [
        {
          Player: 'Alex Dunia',
          Email:
            'alex@example.com',
          Rank: '1',
        },
      ],
      {
        ladder:
          restrictedLadder(),
      },
    )

  const preview =
    previewExistingLadderImport({
      setup,
      ladder:
        restrictedLadder(),
      rows,
    })

  assert.equal(
    preview.summary.ready,
    1,
  )

  assert.equal(
    preview.rows[0]
      .existingMemberId,
    'alex',
  )
})

test('rating outside Ladder requirement is visible and not ready', () => {
  const rows =
    spreadsheetRowsForLadder(
      [
        {
          Name: 'David Cole',
          Email:
            'david@example.com',
          Position: 1,
          Gender: 'Men',
          'Date of Birth':
            '1980-02-12',
          NTRP: '4.5',
        },
      ],
      {
        ladder:
          restrictedLadder(),
      },
    )

  const preview =
    previewExistingLadderImport({
      setup:
        setupWithMembers(),
      ladder:
        restrictedLadder(),
      rows,
    })

  assert.equal(
    preview.summary.ineligible,
    1,
  )

  assert.equal(
    preview.summary.ready,
    0,
  )

  assert.match(
    preview.rows[0]
      .eligibilityReason,
    /4\.5/,
  )
})

test('existing vs uploaded rating conflict needs an explicit decision', () => {
  const setup =
    setupWithMembers([
      {
        id: 'alex',
        name: 'Alex Dunia',
        email:
          'alex@example.com',
        gender: 'men',
        dob: '1988-04-10',
        ratings: {
          ntrp: {
            value: 3.5,
            source: 'admin',
          },
        },
        role: 'player',
        source: 'manual',
        status: 'active',
      },
    ])

  const rows =
    spreadsheetRowsForLadder(
      [
        {
          Name: 'Alex Dunia',
          Email:
            'alex@example.com',
          Position: 1,
          Gender: 'Men',
          'Date of Birth':
            '1988-04-10',
          NTRP: '4.0',
        },
      ],
      {
        ladder:
          restrictedLadder(),
      },
    )

  const unresolved =
    previewExistingLadderImport({
      setup,
      ladder:
        restrictedLadder(),
      rows,
    })

  assert.equal(
    unresolved.summary.attention,
    1,
  )

  const resolved =
    previewExistingLadderImport({
      setup,
      ladder:
        restrictedLadder(),
      rows,
      resolutions: {
        'row-1:rating:ntrp':
          'incoming',
      },
    })

  assert.equal(
    resolved.summary.attention,
    0,
  )

  assert.equal(
    resolved.summary.ready,
    1,
  )
})

test('ambiguous numeric date is never guessed', () => {
  const date =
    normalizeLadderImportDate(
      '04/05/2001',
    )

  assert.equal(
    date.value,
    '',
  )

  assert.equal(
    date.ambiguous,
    true,
  )

  assert.deepEqual(
    date.options,
    [
      '2001-05-04',
      '2001-04-05',
    ],
  )
})

test('common spreadsheet headings are understood', () => {
  const rows =
    spreadsheetRowsForLadder(
      [
        {
          'Player Name':
            'Alex Dunia',
          Mail:
            'alex@example.com',
          Ranking: 3,
          Sex: 'M',
          DOB: '1988-04-10',
          'USTA NTRP': '3.5',
        },
      ],
      {
        ladder:
          restrictedLadder(),
      },
    )

  assert.equal(
    rows[0].name,
    'Alex Dunia',
  )

  assert.equal(
    rows[0].position,
    3,
  )

  assert.equal(
    rows[0].gender,
    'men',
  )

  assert.equal(
    rows[0].dob,
    '1988-04-10',
  )

  assert.equal(
    rows[0].ratings.ntrp,
    3.5,
  )
})

test('name alone never auto-matches an existing member', () => {
  const setup =
    setupWithMembers([
      {
        id: 'alex-existing',
        name: 'Alex Dunia',
        email:
          'existing@example.com',
        gender: 'men',
        dob: '1988-04-10',
        ratings: {
          ntrp: {
            value: 3.5,
            source: 'admin',
          },
        },
        role: 'player',
        source: 'manual',
        status: 'active',
      },
    ])

  const rows =
    spreadsheetRowsForLadder(
      [
        {
          Name: 'Alex Dunia',
          Position: 1,
          Gender: 'Men',
          'Date of Birth':
            '1988-04-10',
          NTRP: '3.5',
        },
      ],
      {
        ladder:
          restrictedLadder(),
      },
    )

  const preview =
    previewExistingLadderImport({
      setup,
      ladder:
        restrictedLadder(),
      rows,
    })

  assert.equal(
    preview.rows[0]
      .existingMemberId,
    '',
  )
})

test('invalid NTRP is surfaced instead of silently ignored', () => {
  const rows =
    spreadsheetRowsForLadder(
      [
        {
          Name: 'Alex Dunia',
          Email:
            'alex@example.com',
          Position: 1,
          Gender: 'Men',
          'Date of Birth':
            '1988-04-10',
          NTRP: '3.7',
        },
      ],
      {
        ladder:
          restrictedLadder(),
      },
    )

  const preview =
    previewExistingLadderImport({
      setup:
        setupWithMembers(),
      ladder:
        restrictedLadder(),
      rows,
    })

  assert.equal(
    preview.summary.attention,
    1,
  )

  assert.equal(
    preview.rows[0]
      .issues.some(
        (issue) =>
          issue.field ===
          'rating',
      ),
    true,
  )
})

test('skipping one duplicate position lets the remaining row proceed', () => {
  const rows =
    spreadsheetRowsForLadder(
      [
        {
          Name: 'Alex Dunia',
          Email:
            'alex@example.com',
          Position: 1,
          Gender: 'Men',
          'Date of Birth':
            '1988-04-10',
          NTRP: '3.5',
        },
        {
          Name: 'David Cole',
          Email:
            'david@example.com',
          Position: 1,
          Gender: 'Men',
          'Date of Birth':
            '1980-02-12',
          NTRP: '3.5',
        },
      ],
      {
        ladder:
          restrictedLadder(),
      },
    )

  const unresolved =
    previewExistingLadderImport({
      setup:
        setupWithMembers(),
      ladder:
        restrictedLadder(),
      rows,
    })

  assert.equal(
    unresolved.summary.attention,
    2,
  )

  const withSkip =
    previewExistingLadderImport({
      setup:
        setupWithMembers(),
      ladder:
        restrictedLadder(),
      rows,
      skippedRowIds: [
        'row-2',
      ],
    })

  assert.equal(
    withSkip.summary.attention,
    0,
  )

  assert.equal(
    withSkip.summary.ready,
    1,
  )
})

test('gaps are allowed and reported for order normalization', () => {
  const rows =
    spreadsheetRowsForLadder(
      [
        {
          Name: 'Alex Dunia',
          Email:
            'alex@example.com',
          Position: 1,
          Gender: 'Men',
          'Date of Birth':
            '1988-04-10',
          NTRP: '3.5',
        },
        {
          Name: 'David Cole',
          Email:
            'david@example.com',
          Position: 3,
          Gender: 'Men',
          'Date of Birth':
            '1980-02-12',
          NTRP: '3.5',
        },
      ],
      {
        ladder:
          restrictedLadder(),
      },
    )

  const preview =
    previewExistingLadderImport({
      setup:
        setupWithMembers(),
      ladder:
        restrictedLadder(),
      rows,
    })

  assert.equal(
    preview.summary.ready,
    2,
  )

  assert.equal(
    preview.hasPositionGap,
    true,
  )
})
