import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(
  'src/views/ClubMemberImportView.vue',
  'utf8',
)

test('member import promotes richer detected ladder data directly into review', () => {
  assert.match(source, /SCENARIO_DETAIL_LEVEL/)
  assert.match(source, /autoPromoteDetectedScenario/)
  assert.match(source, /analyseMemberImportMatrix/)
  assert.match(source, /stage\.value = 'review'/)

  assert.doesNotMatch(
    source,
    /stage\.value = 'mismatch'/,
  )
})

