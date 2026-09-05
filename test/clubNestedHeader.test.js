import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const layout = readFileSync('src/layouts/DefaultLayout.vue', 'utf8')
const members = readFileSync('src/views/ClubMembersView.vue', 'utf8')
const memberImport = readFileSync('src/views/ClubMemberImportView.vue', 'utf8')
const memberManual = readFileSync('src/views/ClubMemberManualView.vue', 'utf8')
const memberDetail = readFileSync('src/views/ClubMemberDetailView.vue', 'utf8')

test('the shell owns nested Club back navigation and breadcrumbs', () => {
  assert.match(layout, /nestedHeader/)
  assert.match(layout, /nested-header-back/)
  assert.match(layout, /nested-header-crumbs/)
  assert.match(layout, /setNestedHeader/)
  assert.match(layout, /clearNestedHeader/)
})

test('Members moves Back to club out of the page body', () => {
  assert.match(members, /label: 'Back to club'/)
  assert.doesNotMatch(members, /class="ref-back"/)
})

test('member import header follows the current import stage', () => {
  assert.match(memberImport, /'Back to members'/)
  assert.match(memberImport, /'Back to import types'/)
  assert.match(memberImport, /'Back to upload'/)
  assert.doesNotMatch(memberImport, /class="ref-back"/)
})

test('manual and member-detail pages return through the shell header', () => {
  assert.match(memberManual, /label: 'Back to members'/)
  assert.match(memberDetail, /label: 'Back to members'/)
  assert.doesNotMatch(memberManual, /class="ref-back"/)
  assert.doesNotMatch(memberDetail, /class="ref-back"/)
})
