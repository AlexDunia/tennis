import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const clubsView = readFileSync(
  'src/views/ClubsView.vue',
  'utf8',
)

test('member-record join state uses the canonical invitation discriminator', () => {
  assert.match(
    clubsView,
    /CLUB_INVITE_KINDS/,
  )

  assert.match(
    clubsView,
    /pendingInvite\.value\?\.inviteKind === CLUB_INVITE_KINDS\.MEMBER_RECORD/,
  )

  assert.match(
    clubsView,
    /joined\.inviteKind === CLUB_INVITE_KINDS\.MEMBER_RECORD/,
  )
})

test('a resumed invitation is automatically previewed without automatically claiming it', () => {
  assert.match(
    clubsView,
    /routeView\.value === 'directory-join' && route\.query\.invite/,
  )

  assert.match(
    clubsView,
    /inviteCode\.value = String\(route\.query\.invite\)\.slice\(0, 2048\)[\s\S]*await previewDirectoryInvite\(\)/,
  )

  assert.match(
    clubsView,
    /async function previewDirectoryInvite\(\)/,
  )

  assert.doesNotMatch(
    clubsView,
    /route\.query\.invite[\s\S]{0,240}await adminStore\.joinClub/,
  )
})

test('member-record confirmation shows only the safe resolved member summary', () => {
  const memberClaimBlock =
    clubsView.match(
      /<section[^>]*v-else-if="pendingInvite"[^>]*class="member-claim-preview"[^>]*>[\s\S]*?<\/section>/,
    )?.[0] || ''

  assert.ok(memberClaimBlock)

  assert.match(
    memberClaimBlock,
    /pendingInvite\.member\?\.name/,
  )

  assert.match(
    memberClaimBlock,
    /pendingInvite\.member\?\.email/,
  )

  assert.match(
    memberClaimBlock,
    /pendingInvite\.clubName/,
  )

  assert.match(
    memberClaimBlock,
    /pendingInvite\.roleLabel/,
  )

  assert.doesNotMatch(
    memberClaimBlock,
    /<input|<select|<textarea/,
  )
})

test('member-record confirmation clearly explains the account connection', () => {
  assert.match(
    clubsView,
    /already has this member record\. Joining will connect it to your Gorra account\./,
  )

  assert.match(
    clubsView,
    /Join and connect account/,
  )

  assert.match(
    clubsView,
    /This invitation connects only this exact club record to your account\./,
  )
})

test('generic invitation presentation and action remain separate from member-record claiming', () => {
  assert.match(
    clubsView,
    /pendingInvite && !isMemberRecordInvite/,
  )

  assert.match(
    clubsView,
    /Your relationship will be \{\{ pendingInvite\.roleLabel \}\}/,
  )

  assert.match(
    clubsView,
    /'Join this club'/,
  )

  assert.match(
    clubsView,
    /'Check invitation'/,
  )
})

test('successful member-record claims enter the canonical Club while generic joins keep the Clubs destination', () => {
  assert.match(
    clubsView,
    /memberRecordClaim[\s\S]*\? \{ name: 'Club' \}[\s\S]*: \{ name: 'Clubs' \}/,
  )

  assert.match(
    clubsView,
    /Your account is connected to \$\{clubName\}\./,
  )

  assert.match(
    clubsView,
    /You joined \$\{clubName\}\./,
  )
})
