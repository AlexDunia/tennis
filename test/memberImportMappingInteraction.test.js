import assert from 'node:assert/strict'
import test from 'node:test'

import {
  importSourceOptionsForTarget,
  importTargetSourceIndex,
  remapImportTarget,
} from '../src/utils/onboarding/memberImport.js'

function workspace() {
  return {
    headers: ['Given Name', 'Surname', 'Primary E-mail', 'Random Note'],
    rows: [
      ['Henry', 'Mensah', 'henry@example.com', 'Left handed'],
    ],
    mappings: {
      0: 'firstName',
      1: 'lastName',
      2: 'email',
      3: '',
    },
    mappingSources: {
      0: 'header',
      1: 'header',
      2: 'header',
      3: 'none',
    },
  }
}

test('every source column stays selectable from a target dropdown', () => {
  const state = workspace()
  const options = importSourceOptionsForTarget(state, 'firstName')

  assert.equal(options.length, 4)
  assert.equal(options.every((option) => option.disabled === false), true)
})

test('choosing a source already used by another field moves the mapping', () => {
  const state = workspace()

  remapImportTarget(state, 'firstName', 1)

  assert.equal(importTargetSourceIndex(state, 'firstName'), 1)
  assert.equal(importTargetSourceIndex(state, 'lastName'), null)
  assert.equal(state.mappings[0], '')
  assert.equal(state.mappings[1], 'firstName')
})

test('choosing a new source immediately changes which data backs the target field', () => {
  const state = workspace()

  remapImportTarget(state, 'email', 3)

  const sourceIndex = importTargetSourceIndex(state, 'email')

  assert.equal(sourceIndex, 3)
  assert.equal(state.rows[0][sourceIndex], 'Left handed')
  assert.equal(state.mappings[2], '')
})
