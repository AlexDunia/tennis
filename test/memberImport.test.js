import assert from 'node:assert/strict'
import test from 'node:test'
import {
  analyseMemberImportMatrix,
  buildMemberImportDraft,
  importReviewFields,
  importWorkspaceHealth,
  parseDelimitedSpreadsheet,
  remapImportTarget,
} from '../src/utils/onboarding/memberImport.js'

test('members-only import recognises familiar headings and requires Year of Entry', () => {
  const rows = parseDelimitedSpreadsheet(
    'First Name,Last Name,Email,Year Joined,Phone\nHenry,Mensah,henry@example.com,2024,+2348000000000',
  )

  const analysis = analyseMemberImportMatrix(rows, {
    scenario: 'members-only',
    fileName: 'members.csv',
  })

  assert.equal(analysis.ok, true)
  assert.equal(analysis.suggestedScenario, 'members-only')

  const mapped = new Set(Object.values(analysis.mappings))
  assert.equal(mapped.has('firstName'), true)
  assert.equal(mapped.has('lastName'), true)
  assert.equal(mapped.has('email'), true)
  assert.equal(mapped.has('yearOfEntry'), true)
})

test('Full Name can satisfy split identity without inventing a second name mapping', () => {
  const analysis = analyseMemberImportMatrix(
    [
      ['Full Name', 'Email', 'Year of Entry'],
      ['Henry Mensah', 'henry@example.com', '2024'],
    ],
    { scenario: 'members-only' },
  )

  const workspace = { ...analysis, scenario: 'members-only', oneLadderName: '' }
  const fields = importReviewFields(workspace)

  assert.equal(fields.some((field) => field.key === 'fullName' && field.required), true)
  assert.equal(importWorkspaceHealth(workspace).blocking, false)

  const draft = buildMemberImportDraft(workspace)
  assert.equal(draft.people[0].firstName, 'Henry')
  assert.equal(draft.people[0].lastName, 'Mensah')
})

test('one-ladder import blocks duplicate positions', () => {
  const analysis = analyseMemberImportMatrix(
    [
      ['First Name', 'Last Name', 'Email', 'Position', 'Year of Entry'],
      ['Henry', 'Mensah', 'henry@example.com', '1', '2024'],
      ['Maya', 'Cole', 'maya@example.com', '1', '2023'],
    ],
    { scenario: 'one-ladder' },
  )

  const workspace = {
    ...analysis,
    scenario: 'one-ladder',
    oneLadderName: "Men's Singles",
  }

  const health = importWorkspaceHealth(workspace)
  assert.equal(health.blocking, true)
  assert.equal(health.duplicateRows.size, 2)
})

test('multiple-ladder import merges repeated people by exact email and keeps both ladder memberships', () => {
  const analysis = analyseMemberImportMatrix(
    [
      ['First Name', 'Last Name', 'Email', 'Ladder', 'Position', 'Year of Entry'],
      ['Henry', 'Mensah', 'henry@example.com', "Men's Singles", '3', '2024'],
      ['Henry', 'Mensah', 'henry@example.com', 'Open Singles', '5', '2024'],
    ],
    { scenario: 'multiple-ladders' },
  )

  const workspace = {
    ...analysis,
    scenario: 'multiple-ladders',
    oneLadderName: '',
  }

  assert.equal(importWorkspaceHealth(workspace).blocking, false)

  const draft = buildMemberImportDraft(workspace)
  assert.equal(draft.people.length, 1)
  assert.equal(draft.people[0].ladderMemberships.length, 2)
  assert.equal(draft.ladders.length, 2)
})

test('mapping can be corrected inline in the table header', () => {
  const analysis = analyseMemberImportMatrix(
    [
      ['Given', 'Surname', 'Mail', 'Joined'],
      ['Henry', 'Mensah', 'henry@example.com', '2024'],
    ],
    { scenario: 'members-only' },
  )

  const workspace = {
    ...analysis,
    scenario: 'members-only',
    oneLadderName: '',
  }

  const joinedIndex = workspace.headers.indexOf('Joined')
  remapImportTarget(workspace, 'yearOfEntry', joinedIndex)

  assert.equal(workspace.mappings[joinedIndex], 'yearOfEntry')
  assert.equal(importWorkspaceHealth(workspace).blocking, false)
})

test('formula-like spreadsheet values are kept inert', () => {
  const analysis = analyseMemberImportMatrix(
    [
      ['First Name', 'Last Name', 'Email', 'Year of Entry', 'Rating'],
      ['Henry', 'Mensah', 'henry@example.com', '2024', '=WEBSERVICE("bad")'],
    ],
    { scenario: 'members-only' },
  )

  assert.equal(analysis.ok, true)
  assert.equal(analysis.fixes.includes('Blocked spreadsheet formulas'), true)
  assert.match(analysis.rows[0][4], /^'/)
})
