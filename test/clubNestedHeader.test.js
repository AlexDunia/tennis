import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const layout = readFileSync('src/layouts/DefaultLayout.vue', 'utf8')
const club = readFileSync('src/views/ClubView.vue', 'utf8')
const members = readFileSync('src/views/ClubMembersView.vue', 'utf8')
const memberImport = readFileSync('src/views/ClubMemberImportView.vue', 'utf8')
const memberManual = readFileSync('src/views/ClubMemberManualView.vue', 'utf8')
const memberDetail = readFileSync('src/views/ClubMemberDetailView.vue', 'utf8')

test('the shell separates the back arrow from nested Club title and breadcrumb copy', () => {
  assert.match(layout, /class="nested-header-arrow"/)
  assert.match(layout, /class="nested-header-copy"/)
  assert.match(layout, /<AppBreadcrumbs :items="navigationBreadcrumbs"/)
  assert.match(layout, /nestedHeader\.subtitle/)
  assert.match(layout, /nestedHeader\.backLabel/)

  assert.doesNotMatch(
    layout,
    /class="nested-header-back"/,
  )
})

test('Members shows Club, Members and current club identity beneath Back to club', () => {
  assert.match(members, /label: 'Back to club'/)
  assert.match(members, /\{ label: 'Members' \}/)
  assert.match(members, /club\.value\?\.name \|\| 'Current club'/)
  assert.doesNotMatch(members, /class="ref-back"/)
})

test('the active Club surface returns to the club directory from the shell header', () => {
  assert.match(club, /label: 'Back to clubs'/)
  assert.match(club, /back: \(\) => router\.push\(\{ name: 'Clubs' \}\)/)
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
