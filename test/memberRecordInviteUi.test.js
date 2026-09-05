import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const adminStoreSource = readFileSync(
  'src/stores/admin.js',
  'utf8',
)

const settingsViewSource = readFileSync(
  'src/views/SettingsView.vue',
  'utf8',
)

test('AdminStore exposes the existing member-record invitation service through one small wrapper', () => {
  assert.match(
    adminStoreSource,
    /createMemberRecordInvite/,
  )

  assert.match(
    adminStoreSource,
    /async function createMemberInvite\(memberId\)/,
  )

  assert.match(
    adminStoreSource,
    /createMemberRecordInvite\(safeMemberId, currentActor\)/,
  )

  assert.match(
    adminStoreSource,
    /await getClubDirectory\(currentActor\)/,
  )

  assert.match(
    adminStoreSource,
    /createMemberInvite,/,
  )
})

test('generic Club invite UI can never select a member-record invitation by role', () => {
  assert.match(
    settingsViewSource,
    /invite\.kind === CLUB_INVITE_KINDS\.GENERIC/,
  )

  assert.match(
    settingsViewSource,
    /invite\.role === role/,
  )

  assert.match(
    settingsViewSource,
    /invite\.kind === CLUB_INVITE_KINDS\.MEMBER_RECORD/,
  )
})

test('member account connection state derives from userId rather than a duplicate accountLinked flag', () => {
  assert.match(
    settingsViewSource,
    /function memberIsConnected\(member\)/,
  )

  assert.match(
    settingsViewSource,
    /Boolean\(sanitizePlainText\(member\?\.userId, 100\)\)/,
  )

  assert.doesNotMatch(
    settingsViewSource,
    /accountLinked/,
  )
})

test('member account invitation UI keeps unsaved records out of the claim flow', () => {
  assert.match(
    settingsViewSource,
    /function memberHasUnsavedChanges\(member\)/,
  )

  assert.match(
    settingsViewSource,
    /Save changes before making an account invite\./,
  )

  assert.match(
    settingsViewSource,
    /!memberHasUnsavedChanges\(member\)/,
  )
})

test('member rows expose restrained Club record, invite-ready, and Connected account states', () => {
  assert.match(settingsViewSource, />\s*Club record\s*</)
  assert.match(settingsViewSource, />\s*Account invite ready\s*</)
  assert.match(settingsViewSource, />\s*Connected account\s*</)
  assert.match(settingsViewSource, /Make account invite/)
  assert.match(settingsViewSource, /Copy link/)
  assert.match(settingsViewSource, /Make new link/)
})

test('member account invites use the canonical history-mode SignUp route', () => {
  assert.match(
    settingsViewSource,
    /function buildSignupInviteLink\(secretInput\)/,
  )

  assert.match(
    settingsViewSource,
    /router\.resolve\(\{[\s\S]*?name: 'SignUp'[\s\S]*?invite: secret/,
  )

  assert.match(
    settingsViewSource,
    /new URL\([\s\S]*?resolved\.href[\s\S]*?window\.location\.origin/,
  )

  assert.doesNotMatch(
    settingsViewSource,
    /#\/signup/,
  )

  assert.match(
    settingsViewSource,
    /memberAccountInviteLink\(member\)/,
  )
})
