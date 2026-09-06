import assert from 'node:assert/strict'
import test from 'node:test'
import { memberTemplateMatrix, memberTemplateDelimited } from '../src/utils/onboarding/memberImportTemplates.js'
import { analyseMemberImportMatrix, importWorkspaceHealth, buildMemberImportDraft, parseDelimitedSpreadsheet, importScenarioTemplate } from '../src/utils/onboarding/memberImport.js'

for (const scenario of ['members-only', 'one-ladder', 'multiple-ladders']) {
  test(`${scenario} filled template passes the real import validator and produces eight distinct people`, () => {
    const matrix = memberTemplateMatrix(scenario)
    assert.deepEqual(matrix[0], importScenarioTemplate(scenario))
    const analysis = analyseMemberImportMatrix(matrix, { scenario })
    const workspace = { ...analysis, scenario, oneLadderName: scenario === 'one-ladder' ? 'Open Singles' : '' }
    assert.equal(analysis.ok, true)
    assert.equal(importWorkspaceHealth(workspace).blocking, false)
    const draft = buildMemberImportDraft(workspace)
    assert.equal(draft.people.length, 8)
    assert.ok(draft.people.every(person => person.email.endsWith('@example.com')))
    if (scenario === 'multiple-ladders') assert.equal(matrix.length, 17)
  })
  test(`${scenario} CSV round-trips the exact rows and blank variant contains only headings`, () => {
    assert.deepEqual(parseDelimitedSpreadsheet(memberTemplateDelimited(scenario)), memberTemplateMatrix(scenario))
    assert.deepEqual(memberTemplateMatrix(scenario, false), [importScenarioTemplate(scenario)])
  })
}
