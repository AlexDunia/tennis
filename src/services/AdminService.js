import {
  ageOnDate,
  digestLadderInviteToken,
  evaluateLadderEligibility,
  ladderEligibilityMissingFields,
  LADDER_ENTRY_STATUSES,
  normalizeLadderEligibility,
  normalizeLadderEntries,
  sanitizeLadderJoinProfile,
  validLadderInviteToken,
} from '../domain/ladderWorkspace.js'
import {
  addMembersToLadder,
  createLadderFromForm,
  ladderPublicSummary,
  prepareLadderJoin,
  saveStartingOrder,
  startLadder,
} from './LadderWorkspaceService.js'

import {
  ADMIN_SETUP_STEPS,
  CLUB_DIRECTORY_SCHEMA_VERSION,
  CLUB_DIRECTORY_STORAGE_KEY,
  CLUB_INVITE_KINDS,
  CLUB_SETUP_STORAGE_KEY,
  MAX_CLUB_INVITATIONS,
  createDefaultClubSetup,
  createMinimalClubSetup,
} from '../config/admin.js'
import { hasPermission } from '../utils/auth/accessControl.js'
import {
  createPrivateInvitationCode,
  createPrivateInvitationToken,
  normalizeClubRole,
  normalizeMembershipStatus,
  normalizeClubSetup,
  sanitizeDirectoryId,
  sanitizeInvitationCode,
  sanitizeInvitationToken,
  validateCompleteClubSetup,
} from '../utils/admin/clubSetup.js'
import {
  locateMemberRecord,
  locateMemberRecordsByUserId,
  replaceMemberRecord,
} from '../utils/admin/memberRecords.js'
import {
  addManualMemberPatch,
  collectClubMembers,
  memberCollectionsPatch,
  mergeMemberImportIntoSetup,
  previewMemberImportIntoSetup,
  syncClubMemberLadderOrder,
  sanitizeMemberBio,
} from '../utils/club/memberData.js'
import { isSafeImageSource, sanitizePlainText } from '../utils/formSafety.js'
import { normalizeMemberRatings } from '../domain/playerRatings.js'
import {
  LADDER_TEST_MEMBER_POOL,
  TEST_MEMBER_PREFIX,
} from '../data/ladderTestMembers.js'

const LEGACY_SETUP_SCHEMA_VERSION = 1
const MANAGER_ROLES = new Set(['admin', 'co-admin'])
const ROLE_WEIGHT = Object.freeze({ player: 1, 'co-admin': 2, admin: 3 })
const ROLE_LABELS = Object.freeze({ player: 'Member', 'co-admin': 'Co-admin', admin: 'Admin' })
const INVITE_ROLES = new Set(Object.keys(ROLE_LABELS))

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function createServiceError(message, code, details) {
  const error = new Error(message)
  error.code = code
  if (details) error.details = details
  return error
}

function actorUserId(actor = {}) {
  return sanitizeDirectoryId(actor.userId || actor.id || actor.playerId || actor.email)
}

function requireUserId(actor) {
  const userId = actorUserId(actor)
  if (!userId) throw createServiceError('Please sign in and try again.', 'AUTH_REQUIRED')
  return userId
}

function assertCanCreateClub(actor = {}) {
  if (!hasPermission(actor, 'club.manage')) {
    throw createServiceError('You do not have permission to create a club.', 'FORBIDDEN')
  }
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeTimestamp(value) {
  if (typeof value !== 'string' || value.length > 40) return ''
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : ''
}

function createEmptyDirectory() {
  return {
    schemaVersion: CLUB_DIRECTORY_SCHEMA_VERSION,
    clubs: [],
    memberships: [],
    activeClubByUser: {},
    draftsByUser: {},
    updatedAt: '',
  }
}

function normalizeInvite(input = {}) {
  const code = sanitizeInvitationCode(input.code)
  const token = sanitizeInvitationToken(input.token)
  if (!code && !token) return null

  const requestedKind =
    input.kind === CLUB_INVITE_KINDS.MEMBER_RECORD
      ? CLUB_INVITE_KINDS.MEMBER_RECORD
      : CLUB_INVITE_KINDS.GENERIC

  const memberId =
    requestedKind === CLUB_INVITE_KINDS.MEMBER_RECORD
      ? sanitizeDirectoryId(input.memberId || input.member_id)
      : ''

  // Never downgrade a malformed member-record invitation into a reusable
  // generic invitation. Older invitations without a kind remain generic.
  if (requestedKind === CLUB_INVITE_KINDS.MEMBER_RECORD && !memberId) {
    return null
  }

  return {
    id: sanitizeDirectoryId(input.id, code ? `invite-${code.toLowerCase()}` : ''),
    kind: requestedKind,
    memberId,
    code,
    token,
    role: normalizeClubRole(input.role),
    enabled: input.enabled !== false,
    createdAt: normalizeTimestamp(input.createdAt),
  }
}

function normalizeClubRecord(input = {}) {
  const setupSource = input.setup || input
  const setup = normalizeClubSetup(setupSource)
  const id = sanitizeDirectoryId(input.id || setup.clubId)
  if (!id || !setup.workspace.name) return null

  const inviteKeys = new Set()
  const invites = (Array.isArray(input.invites) ? input.invites : [])
    .slice(0, MAX_CLUB_INVITATIONS)
    .map(normalizeInvite)
    .filter((invite) => {
      if (!invite) return false
      const key = invite.token || invite.code
      if (inviteKeys.has(key)) return false
      inviteKeys.add(key)
      return true
    })

  return {
    id,
    name: setup.workspace.name,
    setup: {
      ...setup,
      clubId: id,
      status: setup.status === 'active' ? 'active' : 'draft',
    },
    invites,
    createdAt: normalizeTimestamp(input.createdAt) || setup.createdAt,
    updatedAt: normalizeTimestamp(input.updatedAt) || setup.updatedAt,
  }
}

function normalizeMembershipRecord(input = {}, clubIds) {
  const userId = sanitizeDirectoryId(input.userId || input.user_id)
  const clubId = sanitizeDirectoryId(input.clubId || input.club_id)
  if (!userId || !clubId || !clubIds.has(clubId)) return null
  return {
    userId,
    clubId,
    role: normalizeClubRole(input.role),
    status: normalizeMembershipStatus(input.status),
    joinedAt: normalizeTimestamp(input.joinedAt || input.joined_at),
  }
}

function normalizeDirectory(input = {}) {
  const directory = createEmptyDirectory()
  const clubIds = new Set()
  directory.clubs = (Array.isArray(input.clubs) ? input.clubs : [])
    .slice(0, 250)
    .map(normalizeClubRecord)
    .filter((club) => {
      if (!club || clubIds.has(club.id)) return false
      clubIds.add(club.id)
      return true
    })

  const membershipKeys = new Set()
  const activeMembershipKeys = new Set()
  directory.memberships = (Array.isArray(input.memberships) ? input.memberships : [])
    .slice(0, 5000)
    .map((membership) => normalizeMembershipRecord(membership, clubIds))
    .filter((membership) => {
      if (!membership) return false
      const key = `${membership.userId}:${membership.clubId}`
      if (membershipKeys.has(key)) return false
      membershipKeys.add(key)
      if (membership.status === 'active') activeMembershipKeys.add(key)
      return true
    })

  const activeClubByUser = input.activeClubByUser || input.active_club_by_user || {}
  Object.entries(activeClubByUser)
    .slice(0, 1000)
    .forEach(([rawUserId, rawClubId]) => {
      const userId = sanitizeDirectoryId(rawUserId)
      const clubId = sanitizeDirectoryId(rawClubId)
      if (activeMembershipKeys.has(`${userId}:${clubId}`)) {
        directory.activeClubByUser[userId] = clubId
      }
    })

  const draftsByUser = input.draftsByUser || input.drafts_by_user || {}
  Object.entries(draftsByUser)
    .slice(0, 1000)
    .forEach(([rawUserId, rawDraft]) => {
      const userId = sanitizeDirectoryId(rawUserId)
      if (!userId) return
      const setup = normalizeClubSetup(rawDraft?.setup || rawDraft)
      directory.draftsByUser[userId] = {
        setup: { ...setup, clubId: '', status: 'draft' },
        updatedAt: normalizeTimestamp(rawDraft?.updatedAt) || setup.updatedAt,
      }
    })

  directory.updatedAt = normalizeTimestamp(input.updatedAt)
  return directory
}

function readStoredDirectory() {
  if (!canUseStorage()) return null
  try {
    const stored = JSON.parse(window.localStorage.getItem(CLUB_DIRECTORY_STORAGE_KEY) || 'null')
    if (!stored || stored.schemaVersion !== CLUB_DIRECTORY_SCHEMA_VERSION) return null
    return normalizeDirectory(stored)
  } catch {
    return null
  }
}

function readLegacySetup() {
  if (!canUseStorage()) return null
  try {
    const stored = JSON.parse(window.localStorage.getItem(CLUB_SETUP_STORAGE_KEY) || 'null')
    if (!stored || stored.schemaVersion !== LEGACY_SETUP_SCHEMA_VERSION || !stored.setup)
      return null
    return normalizeClubSetup(stored.setup)
  } catch {
    return null
  }
}

function isUntouchedDraft(setup) {
  return (
    setup.status === 'draft' &&
    setup.completedStep === 0 &&
    !setup.workspace.name &&
    !setup.membership.selectedPlayerIds.length &&
    !setup.membership.importedMembers.length &&
    !setup.membership.manualMembers.length
  )
}

function uniqueClubId(name, directory) {
  const base = sanitizeDirectoryId(name, 'my-club')
  const existing = new Set(directory.clubs.map((club) => club.id))
  if (!existing.has(base)) return base
  for (let suffix = 2; suffix <= 999; suffix += 1) {
    const candidate = `${base}-${suffix}`.slice(0, 80)
    if (!existing.has(candidate)) return candidate
  }
  throw createServiceError('Unable to make a club ID. Try a different club name.', 'ID_CONFLICT')
}

function createStoredInvite(role, tokenInput = '', codeInput = '', options = {}) {
  const kind =
    options.kind === CLUB_INVITE_KINDS.MEMBER_RECORD
      ? CLUB_INVITE_KINDS.MEMBER_RECORD
      : CLUB_INVITE_KINDS.GENERIC

  const memberId =
    kind === CLUB_INVITE_KINDS.MEMBER_RECORD
      ? sanitizeDirectoryId(options.memberId)
      : ''

  if (kind === CLUB_INVITE_KINDS.MEMBER_RECORD && !memberId) {
    throw createServiceError(
      'Choose a valid member before making this invite.',
      'INVALID_MEMBER_ID',
    )
  }

  const token = sanitizeInvitationToken(tokenInput) || createPrivateInvitationToken()
  const code = sanitizeInvitationCode(codeInput) || createPrivateInvitationCode()

  if (!token || !code) {
    throw createServiceError(
      'Unable to make a secure invite. Please try again.',
      'CRYPTO_UNAVAILABLE',
    )
  }

  return {
    id:
      kind === CLUB_INVITE_KINDS.MEMBER_RECORD
        ? `member-invite-${memberId}-${code.toLowerCase()}`.slice(0, 160)
        : `invite-${code.toLowerCase()}`,
    kind,
    memberId,
    code,
    token,
    role: normalizeClubRole(role),
    enabled: true,
    createdAt: nowIso(),
  }
}

function createFreshStoredInvite(role, existingInvites, options = {}) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const invite = createStoredInvite(role, '', '', options)
    const collides = existingInvites.some(
      (item) => item.code === invite.code || item.token === invite.token,
    )

    if (!collides) return invite
  }

  throw createServiceError(
    'Unable to make a new secure invite. Please try again.',
    'INVITE_CONFLICT',
  )
}

function makeInviteForSetup(setup, existingInvites = []) {
  if (!setup.membership.privateLinkEnabled) {
    return {
      setup,
      invites: existingInvites.slice(0, MAX_CLUB_INVITATIONS),
    }
  }

  const memberInvite = createStoredInvite(
    'player',
    setup.membership.invitationToken,
    setup.membership.invitationCode,
  )

  const storedCoAdminInvite = existingInvites.find(
    (invite) =>
      invite.enabled &&
      invite.kind === CLUB_INVITE_KINDS.GENERIC &&
      invite.role === 'co-admin',
  )

  const coAdminInvite = storedCoAdminInvite || createStoredInvite('co-admin')

  const inviteKeys = new Set([
    memberInvite.code,
    memberInvite.token,
    coAdminInvite.code,
    coAdminInvite.token,
  ])

  const preservedInvites = existingInvites.filter((invite) => {
    if (invite.kind === CLUB_INVITE_KINDS.MEMBER_RECORD) return true

    return (
      !['player', 'co-admin'].includes(invite.role) &&
      !inviteKeys.has(invite.code) &&
      !inviteKeys.has(invite.token)
    )
  })

  const invites = [memberInvite, coAdminInvite, ...preservedInvites]

  return {
    setup: {
      ...setup,
      membership: {
        ...setup.membership,
        invitationToken: memberInvite.token,
        invitationCode: memberInvite.code,
        inviteRole: 'player',
      },
    },
    invites: invites.slice(0, MAX_CLUB_INVITATIONS),
  }
}

function migrateLegacyDirectory(userId) {
  const directory = createEmptyDirectory()
  const legacySetup = readLegacySetup()
  if (!legacySetup || isUntouchedDraft(legacySetup)) return directory

  if (legacySetup.status !== 'active') {
    directory.draftsByUser[userId] = { setup: legacySetup, updatedAt: legacySetup.updatedAt }
    return directory
  }

  const clubId = uniqueClubId(legacySetup.workspace.name, directory)
  const inviteResult = makeInviteForSetup({
    ...legacySetup,
    clubId,
    completedStep: ADMIN_SETUP_STEPS.length,
    workspace: {
      ...legacySetup.workspace,
      administratorIds: [...new Set([...legacySetup.workspace.administratorIds, userId])],
    },
  })
  const migratedSetup = inviteResult.setup
  directory.clubs.push({
    id: clubId,
    name: migratedSetup.workspace.name,
    setup: migratedSetup,
    invites: inviteResult.invites,
    createdAt: migratedSetup.createdAt || nowIso(),
    updatedAt: migratedSetup.updatedAt || nowIso(),
  })
  directory.memberships.push({
    userId,
    clubId,
    role: 'admin',
    status: 'active',
    joinedAt: nowIso(),
  })
  directory.activeClubByUser[userId] = clubId
  return directory
}

function mirrorLegacySetup(directory, userId) {
  if (!canUseStorage()) return
  const activeClubId = directory.activeClubByUser[userId]
  const membership = directory.memberships.find(
    (item) => item.userId === userId && item.clubId === activeClubId && item.status === 'active',
  )
  const activeClub = membership
    ? directory.clubs.find((club) => club.id === activeClubId && club.setup.status === 'active')
    : null
  const draft = directory.draftsByUser[userId]?.setup
  const setup = activeClub?.setup || draft || createDefaultClubSetup()
  window.localStorage.setItem(
    CLUB_SETUP_STORAGE_KEY,
    JSON.stringify({ schemaVersion: LEGACY_SETUP_SCHEMA_VERSION, setup }),
  )
}

function writeDirectory(input, userId) {
  const directory = normalizeDirectory({ ...input, updatedAt: nowIso() })
  if (canUseStorage()) {
    try {
      window.localStorage.setItem(CLUB_DIRECTORY_STORAGE_KEY, JSON.stringify(directory))
      if (userId) mirrorLegacySetup(directory, userId)
    } catch {
      throw createServiceError('Unable to save club changes on this device.', 'STORAGE_ERROR')
    }
  }
  return directory
}

function loadDirectory(actor, { migrate = true } = {}) {
  const stored = readStoredDirectory()
  if (stored) return stored
  const userId = actorUserId(actor)
  const directory = migrate && userId ? migrateLegacyDirectory(userId) : createEmptyDirectory()
  return canUseStorage() ? writeDirectory(directory, userId) : directory
}

function membershipFor(directory, userId, clubId) {
  return directory.memberships.find(
    (membership) => membership.userId === userId && membership.clubId === clubId,
  )
}

function assertClubAccess(directory, userId, clubId) {
  const membership = membershipFor(directory, userId, clubId)
  if (!membership || membership.status !== 'active') {
    throw createServiceError('You do not have access to this club.', 'FORBIDDEN')
  }
  return membership
}

function assertClubManager(directory, userId, clubId) {
  const membership = assertClubAccess(directory, userId, clubId)
  if (!MANAGER_ROLES.has(membership.role)) {
    throw createServiceError('You do not have permission to change this club.', 'FORBIDDEN')
  }
  return membership
}

function activeClubWriteContext(directory, userId, { manager = false } = {}) {
  const clubId = directory.activeClubByUser[userId]

  if (!clubId) {
    throw createServiceError('Choose a club first.', 'NO_ACTIVE_CLUB')
  }

  const membership = manager
    ? assertClubManager(directory, userId, clubId)
    : assertClubAccess(directory, userId, clubId)

  const clubIndex = directory.clubs.findIndex((club) => club.id === clubId)

  if (clubIndex === -1) {
    throw createServiceError('This club could not be found.', 'NOT_FOUND')
  }

  return {
    clubId,
    clubIndex,
    club: directory.clubs[clubIndex],
    membership,
  }
}

export function clearClubTestDataSetup(
  input,
  timestamp = nowIso(),
) {
  const current = normalizeClubSetup(input)

  return normalizeClubSetup({
    ...current,

    membership: {
      ...current.membership,
      source: 'later',
      selectedPlayerIds: [],
      inviteEmails: '',
      invitePhones: '',
      importedMembers: [],
      manualMembers: [],
      roster: [],
    },

    ladders: [],

    primaryLadderId: '',

    placement: {
      ...current.placement,
      rankingOrder: [],
    },

    updatedAt: timestamp,
  })
}

export async function clearActiveClubTestData(
  actor,
) {
  if (!import.meta.env?.DEV) {
    throw createServiceError(
      'Test data reset is only available in development.',
      'DEV_ONLY',
    )
  }

  const userId = requireUserId(actor)
  let directory = loadDirectory(actor)

  const context = activeClubWriteContext(
    directory,
    userId,
    {
      manager: true,
    },
  )

  const timestamp = nowIso()

  const setup = clearClubTestDataSetup(
    context.club.setup,
    timestamp,
  )

  directory.clubs[context.clubIndex] = {
    ...context.club,
    name: setup.workspace.name,
    setup,

    // Member-record invitations cannot survive
    // after their target member records are cleared.
    // Generic club invitations remain intact.
    invites: context.club.invites.filter(
      (invite) =>
        invite.kind !==
        CLUB_INVITE_KINDS.MEMBER_RECORD,
    ),

    updatedAt: timestamp,
  }

  // Preserve manager relationships so ownership/admin
  // access survives the reset. Remove ordinary player
  // relationships from this active club because the
  // corresponding member records are now gone.
  directory.memberships =
    directory.memberships.filter(
      (membership) =>
        membership.clubId !==
          context.clubId ||
        MANAGER_ROLES.has(
          membership.role,
        ),
    )

  directory = writeDirectory(
    directory,
    userId,
  )

  return (
    publicDirectoryForUser(
      directory,
      userId,
    ).clubs.find(
      (club) =>
        club.id === context.clubId,
    ) || null
  )
}

function setupWithCreator(setup, userId) {
  return {
    ...setup,
    workspace: {
      ...setup.workspace,
      administratorIds: [...new Set([...setup.workspace.administratorIds, userId])].slice(0, 30),
    },
  }
}

function addMembership(directory, membership) {
  const index = directory.memberships.findIndex(
    (item) => item.userId === membership.userId && item.clubId === membership.clubId,
  )
  if (index === -1) directory.memberships.push(membership)
  else {
    const current = directory.memberships[index]
    directory.memberships[index] = {
      ...membership,
      role: strongerRole(current.role, membership.role),
      joinedAt: current.joinedAt || membership.joinedAt,
    }
  }
}

function addRosterMemberships(directory, setup, clubId) {
  const joinedAt = nowIso()
  setup.membership.selectedPlayerIds.forEach((userId) => {
    addMembership(directory, { userId, clubId, role: 'player', status: 'active', joinedAt })
  })
  ;[
    ...setup.membership.importedMembers,
    ...setup.membership.manualMembers,
    ...setup.membership.roster,
  ].forEach((member) => {
    if (!member.userId) return
    addMembership(directory, {
      userId: member.userId,
      clubId,
      role: normalizeClubRole(member.role),
      status: 'active',
      joinedAt,
    })
  })
}

function stripPrivateInviteData(setup) {
  return {
    ...setup,
    membership: {
      ...setup.membership,
      inviteEmails: '',
      invitePhones: '',
      invitationToken: '',
      invitationCode: '',
    },
  }
}

function publicDirectoryForUser(directory, userId) {
  const ownMemberships = directory.memberships.filter((item) => item.userId === userId)
  const activeOwnMemberships = ownMemberships.filter((item) => item.status === 'active')
  const accessibleIds = new Set(activeOwnMemberships.map((item) => item.clubId))
  const roleByClub = new Map(activeOwnMemberships.map((item) => [item.clubId, item.role]))
  const clubs = directory.clubs
    .filter((club) => accessibleIds.has(club.id))
    .map((club) => {
      const canManage = MANAGER_ROLES.has(roleByClub.get(club.id))
      return {
        id: club.id,
        name: club.name,
        setup: canManage ? club.setup : stripPrivateInviteData(club.setup),
        invitations: canManage
          ? club.invites.map((invite) => ({ ...invite, roleLabel: ROLE_LABELS[invite.role] }))
          : [],
        createdAt: club.createdAt,
        updatedAt: club.updatedAt,
      }
    })
  const memberships = directory.memberships.filter(
    (item) => item.userId === userId || accessibleIds.has(item.clubId),
  )
  const requestedActiveId = directory.activeClubByUser[userId]
  const activeClubId = accessibleIds.has(requestedActiveId)
    ? requestedActiveId
    : activeOwnMemberships[0]?.clubId || ''

  return {
    schemaVersion: CLUB_DIRECTORY_SCHEMA_VERSION,
    clubs,
    memberships,
    activeClubId,
  }
}

export async function getClubDirectory(actor) {
  const userId = requireUserId(actor)
  let directory = loadDirectory(actor)
  const fallbackClubId =
    directory.memberships.find((item) => item.userId === userId && item.status === 'active')
      ?.clubId || ''
  if (!directory.activeClubByUser[userId] && fallbackClubId) {
    directory.activeClubByUser[userId] = fallbackClubId
    directory = writeDirectory(directory, userId)
  } else if (canUseStorage()) {
    mirrorLegacySetup(directory, userId)
  }
  return publicDirectoryForUser(directory, userId)
}

export async function getClubSetup(actor) {
  const userId = requireUserId(actor)
  const directory = loadDirectory(actor)
  const draft = directory.draftsByUser[userId]?.setup
  if (draft) return normalizeClubSetup(draft)

  const activeClubId = directory.activeClubByUser[userId]
  const membership = membershipFor(directory, userId, activeClubId)
  const activeClub =
    membership?.status === 'active'
      ? directory.clubs.find((club) => club.id === activeClubId)
      : null
  return activeClub ? normalizeClubSetup(activeClub.setup) : createDefaultClubSetup()
}

export async function saveClubSetupDraft(input, actor) {
  assertCanCreateClub(actor)
  const userId = requireUserId(actor)
  let directory = loadDirectory(actor)
  let setup = normalizeClubSetup(input)
  setup = setupWithCreator({ ...setup, clubId: '', status: 'draft', updatedAt: nowIso() }, userId)
  const inviteResult = makeInviteForSetup(setup)
  setup = inviteResult.setup
  directory.draftsByUser[userId] = { setup, updatedAt: setup.updatedAt }
  directory = writeDirectory(directory, userId)
  return normalizeClubSetup(directory.draftsByUser[userId].setup)
}

export async function saveClubSetup(input, actor) {
  const userId = requireUserId(actor)
  let directory = loadDirectory(actor)
  let setup = normalizeClubSetup(input)
  const requestedClubId = setup.clubId
  const existingClub = requestedClubId
    ? directory.clubs.find((club) => club.id === requestedClubId)
    : null

  if (existingClub) assertClubManager(directory, userId, existingClub.id)

  const validation = validateCompleteClubSetup(setup)
  if (!validation.valid) {
    throw createServiceError(
      validation.errors[0]?.message || 'Check the club setup and try again.',
      'VALIDATION_ERROR',
      validation.errors,
    )
  }

  const timestamp = nowIso()
  const clubId = existingClub?.id || uniqueClubId(setup.workspace.name, directory)
  setup = setupWithCreator(
    {
      ...setup,
      clubId,
      status: 'active',
      completedStep: ADMIN_SETUP_STEPS.length,
      createdAt: existingClub?.setup.createdAt || setup.createdAt || timestamp,
      updatedAt: timestamp,
    },
    userId,
  )
  const inviteResult = makeInviteForSetup(setup, existingClub?.invites)
  setup = inviteResult.setup

  const clubRecord = {
    id: clubId,
    name: setup.workspace.name,
    setup,
    invites: inviteResult.invites,
    createdAt: existingClub?.createdAt || timestamp,
    updatedAt: timestamp,
  }
  if (existingClub) {
    directory.clubs[directory.clubs.findIndex((club) => club.id === clubId)] = clubRecord
  } else {
    directory.clubs.push(clubRecord)
    addMembership(directory, {
      userId,
      clubId,
      role: 'admin',
      status: 'active',
      joinedAt: timestamp,
    })
  }
  addRosterMemberships(directory, setup, clubId)
  directory.activeClubByUser[userId] = clubId
  delete directory.draftsByUser[userId]
  directory = writeDirectory(directory, userId)
  return normalizeClubSetup(directory.clubs.find((club) => club.id === clubId).setup)
}

export async function createClub(input, actor) {
  const userId = requireUserId(actor)
  let directory = loadDirectory(actor)
  let setup = normalizeClubSetup(createMinimalClubSetup(input))

  if (setup.workspace.name.length < 2) {
    throw createServiceError('Enter the club name.', 'VALIDATION_ERROR')
  }
  if (setup.workspace.country.length < 2) {
    throw createServiceError('Choose the club country.', 'VALIDATION_ERROR')
  }
  if (setup.workspace.city.length < 2) {
    throw createServiceError('Enter the club city.', 'VALIDATION_ERROR')
  }

  const timestamp = nowIso()
  const clubId = uniqueClubId(setup.workspace.name, directory)
  setup = setupWithCreator(
    {
      ...setup,
      clubId,
      status: 'active',
      completedStep: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    userId,
  )

  directory.clubs.push({
    id: clubId,
    name: setup.workspace.name,
    setup,
    invites: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  const membership = {
    userId,
    clubId,
    role: 'admin',
    status: 'active',
    joinedAt: timestamp,
  }
  addMembership(directory, membership)
  directory.activeClubByUser[userId] = clubId
  delete directory.draftsByUser[userId]
  directory = writeDirectory(directory, userId)

  const result = publicDirectoryForUser(directory, userId)
  return {
    club: result.clubs.find((club) => club.id === clubId) || null,
    membership,
  }
}

function extractInviteCandidates(input) {
  const raw = String(input || '')
    .trim()
    .slice(0, 2048)
  if (!raw) return { code: '', token: '' }
  const values = [raw]
  try {
    const url = new URL(
      raw,
      typeof window !== 'undefined' ? window.location.origin : 'https://gorra.local',
    )
    ;['invite', 'code', 'token'].forEach((key) => {
      const value = url.searchParams.get(key)
      if (value) values.push(value)
    })
    const hashQuery = url.hash.includes('?') ? url.hash.slice(url.hash.indexOf('?') + 1) : ''
    const hashParams = new URLSearchParams(hashQuery)
    ;['invite', 'code', 'token'].forEach((key) => {
      const value = hashParams.get(key)
      if (value) values.push(value)
    })
  } catch {
    // Direct invite codes and tokens do not need to be URLs.
  }

  return values.reduce(
    (result, value) => ({
      code: result.code || sanitizeInvitationCode(value),
      token: result.token || sanitizeInvitationToken(value),
    }),
    { code: '', token: '' },
  )
}

function findStoredInvite(directory, input) {
  const candidates = extractInviteCandidates(input)

  if (!candidates.code && !candidates.token) {
    return null
  }

  const matches = []

  for (const club of directory.clubs) {
    if (club.setup.status !== 'active') continue

    for (const invite of club.invites) {
      if (!invite.enabled) continue

      const codeMatches =
        Boolean(candidates.code) &&
        invite.code === candidates.code

      const tokenMatches =
        Boolean(candidates.token) &&
        invite.token === candidates.token

      if (!codeMatches && !tokenMatches) continue

      matches.push({ club, invite })

      // Never resolve an ambiguous credential according to storage order.
      // A future backend should enforce credential uniqueness transactionally.
      if (matches.length > 1) {
        return null
      }
    }
  }

  return matches[0] || null
}

function requireExactMemberRecord(club, memberIdInput) {
  const result = locateMemberRecord(club.setup, memberIdInput)

  if (result.count === 0) {
    throw createServiceError(
      'This member record could not be found.',
      'MEMBER_NOT_FOUND',
    )
  }

  if (result.count > 1 || !result.match) {
    throw createServiceError(
      'This member record is ambiguous. Ask a club admin to review it.',
      'AMBIGUOUS_MEMBER_RECORD',
    )
  }

  return result.match
}

function memberInviteSummary(member) {
  return {
    id: sanitizeDirectoryId(member.id),
    name: String(member.name || ''),
    email: String(member.email || ''),
  }
}

function sameStoredInvite(left, right) {
  if (left?.token && right?.token && left.token === right.token) return true
  return Boolean(left?.code && right?.code && left.code === right.code)
}

export async function createMemberRecordInvite(memberIdInput, actor) {
  const userId = requireUserId(actor)
  let directory = loadDirectory(actor)

  const clubId = directory.activeClubByUser[userId]
  if (!clubId) {
    throw createServiceError('Choose a club first.', 'NO_ACTIVE_CLUB')
  }

  assertClubManager(directory, userId, clubId)

  const clubIndex = directory.clubs.findIndex((club) => club.id === clubId)
  if (clubIndex === -1) {
    throw createServiceError('This club could not be found.', 'NOT_FOUND')
  }

  const current = directory.clubs[clubIndex]
  const target = requireExactMemberRecord(current, memberIdInput)

  if (sanitizeDirectoryId(target.member.userId)) {
    throw createServiceError(
      'This member record is already connected to a Gorra account.',
      'MEMBER_ALREADY_LINKED',
    )
  }

  const role = normalizeClubRole(target.member.role)

  const invite = createFreshStoredInvite(role, current.invites, {
    kind: CLUB_INVITE_KINDS.MEMBER_RECORD,
    memberId: target.member.id,
  })

  const timestamp = nowIso()

  const previousInvites = current.invites.map((item) => {
    const sameMember =
      item.kind === CLUB_INVITE_KINDS.MEMBER_RECORD &&
      item.memberId === target.member.id

    return sameMember ? { ...item, enabled: false } : item
  })

  directory.clubs[clubIndex] = {
    ...current,
    invites: [invite, ...previousInvites].slice(0, MAX_CLUB_INVITATIONS),
    updatedAt: timestamp,
  }

  directory = writeDirectory(directory, userId)

  const savedClub = publicDirectoryForUser(directory, userId).clubs.find(
    (club) => club.id === clubId,
  )

  const savedInvite = savedClub?.invitations.find(
    (item) => item.code === invite.code,
  )

  return {
    ...savedInvite,
    inviteKind: CLUB_INVITE_KINDS.MEMBER_RECORD,
    member: memberInviteSummary(target.member),
  }
}

export async function previewClubInvite(input, actor) {
  const directory = loadDirectory(actor, {
    migrate: Boolean(actorUserId(actor)),
  })

  const match = findStoredInvite(directory, input)

  if (!match) {
    throw createServiceError(
      'This invite code is not valid.',
      'INVALID_INVITE',
    )
  }

  if (match.invite.kind === CLUB_INVITE_KINDS.MEMBER_RECORD) {
    const target = requireExactMemberRecord(
      match.club,
      match.invite.memberId,
    )

    if (sanitizeDirectoryId(target.member.userId)) {
      throw createServiceError(
        'This member record is already connected to a Gorra account.',
        'MEMBER_ALREADY_LINKED',
      )
    }

    const role = normalizeClubRole(target.member.role)

    return {
      inviteKind: CLUB_INVITE_KINDS.MEMBER_RECORD,
      clubId: match.club.id,
      clubName: match.club.name,
      role,
      roleLabel: ROLE_LABELS[role],
      member: memberInviteSummary(target.member),
    }
  }

  return {
    inviteKind: CLUB_INVITE_KINDS.GENERIC,
    clubId: match.club.id,
    clubName: match.club.name,
    role: match.invite.role,
    roleLabel: ROLE_LABELS[match.invite.role],
  }
}

function strongerRole(currentRole, invitedRole) {
  return ROLE_WEIGHT[invitedRole] > ROLE_WEIGHT[currentRole] ? invitedRole : currentRole
}

export async function joinClubWithInvite(input, actor) {
  const userId = requireUserId(actor)
  let directory = loadDirectory(actor)

  const match = findStoredInvite(directory, input)

  if (!match) {
    throw createServiceError(
      'This invite code is not valid.',
      'INVALID_INVITE',
    )
  }

  if (match.invite.kind === CLUB_INVITE_KINDS.MEMBER_RECORD) {
    const clubIndex = directory.clubs.findIndex(
      (club) => club.id === match.club.id,
    )

    if (clubIndex === -1) {
      throw createServiceError(
        'This club could not be found.',
        'NOT_FOUND',
      )
    }

    const current = directory.clubs[clubIndex]
    const target = requireExactMemberRecord(
      current,
      match.invite.memberId,
    )

    const linkedUserId = sanitizeDirectoryId(target.member.userId)

    if (linkedUserId && linkedUserId !== userId) {
      throw createServiceError(
        'This member record is already connected to another Gorra account.',
        'MEMBER_ALREADY_LINKED',
      )
    }

    const otherLinkedRecords = locateMemberRecordsByUserId(
      current.setup,
      userId,
    ).filter(
      (location) =>
        sanitizeDirectoryId(location.member.id) !==
        sanitizeDirectoryId(target.member.id),
    )

    if (otherLinkedRecords.length) {
      throw createServiceError(
        'Your Gorra account is already connected to another member record in this club.',
        'ACCOUNT_ALREADY_LINKED',
      )
    }

    const role = normalizeClubRole(target.member.role)
    const timestamp = nowIso()

    const nextSetup = {
      ...replaceMemberRecord(current.setup, target, (member) => ({
        ...member,
        userId,
        status: 'active',
      })),
      updatedAt: timestamp,
    }

    const existingMembership = membershipFor(
      directory,
      userId,
      current.id,
    )

    const membership = {
      userId,
      clubId: current.id,
      role: existingMembership
        ? strongerRole(existingMembership.role, role)
        : role,
      status: 'active',
      joinedAt: existingMembership?.joinedAt || timestamp,
    }

    addMembership(directory, membership)

    directory.clubs[clubIndex] = {
      ...current,
      setup: nextSetup,
      invites: current.invites.map((item) => {
        const belongsToClaimedMember =
          item.kind === CLUB_INVITE_KINDS.MEMBER_RECORD &&
          item.memberId === target.member.id

        const isRedeemedInvite = sameStoredInvite(
          item,
          match.invite,
        )

        return belongsToClaimedMember || isRedeemedInvite
          ? { ...item, enabled: false }
          : item
      }),
      updatedAt: timestamp,
    }

    directory.activeClubByUser[userId] = current.id
    directory = writeDirectory(directory, userId)

    const result = publicDirectoryForUser(directory, userId)
    const savedClub = result.clubs.find(
      (club) => club.id === current.id,
    )

    const savedMembership =
      membershipFor(directory, userId, current.id) || membership

    const savedTarget = requireExactMemberRecord(
      directory.clubs.find((club) => club.id === current.id),
      target.member.id,
    )

    return {
      inviteKind: CLUB_INVITE_KINDS.MEMBER_RECORD,
      club: savedClub,
      membership: savedMembership,
      role,
      roleLabel: ROLE_LABELS[role],
      member: memberInviteSummary(savedTarget.member),
    }
  }

  const existing = membershipFor(
    directory,
    userId,
    match.club.id,
  )

  const membership = {
    userId,
    clubId: match.club.id,
    role: existing
      ? strongerRole(existing.role, match.invite.role)
      : match.invite.role,
    status: 'active',
    joinedAt: existing?.joinedAt || nowIso(),
  }

  addMembership(directory, membership)
  directory.activeClubByUser[userId] = match.club.id
  directory = writeDirectory(directory, userId)

  const result = publicDirectoryForUser(directory, userId)

  return {
    inviteKind: CLUB_INVITE_KINDS.GENERIC,
    club: result.clubs.find(
      (club) => club.id === match.club.id,
    ),
    membership:
      membershipFor(directory, userId, match.club.id) || membership,
    role: match.invite.role,
    roleLabel: ROLE_LABELS[match.invite.role],
  }
}

function validateClubId(value) {
  const raw = String(value || '').trim()
  const normalized = sanitizeDirectoryId(raw)
  if (!normalized || raw !== normalized) {
    throw createServiceError('Choose a valid club.', 'INVALID_CLUB_ID')
  }
  return normalized
}

export async function switchActiveClub(clubIdInput, actor) {
  const userId = requireUserId(actor)
  const clubId = validateClubId(clubIdInput)
  let directory = loadDirectory(actor)
  assertClubAccess(directory, userId, clubId)
  const club = directory.clubs.find((item) => item.id === clubId)
  if (!club) throw createServiceError('This club could not be found.', 'NOT_FOUND')
  directory.activeClubByUser[userId] = clubId
  directory = writeDirectory(directory, userId)
  return publicDirectoryForUser(directory, userId).clubs.find((item) => item.id === clubId)
}

function mergeSetup(current, input) {
  const rawInput = input?.setup || input || {}
  const hasSetupSections = [
    'workspace',
    'membership',
    'playerLevels',
    'ladders',
    'placement',
    'rules',
  ].some(
    (key) => Object.prototype.hasOwnProperty.call(rawInput, key),
  )
  const patch = hasSetupSections ? rawInput : { workspace: rawInput }
  return {
    ...current,
    ...patch,
    clubId: current.clubId,
    workspace: {
      ...current.workspace,
      ...(patch.workspace || {}),
      notifications: {
        ...current.workspace.notifications,
        ...(patch.workspace?.notifications || {}),
      },
    },
    membership: { ...current.membership, ...(patch.membership || {}) },
    playerLevels: {
      ...current.playerLevels,
      ...(patch.playerLevels || {}),
    },
    ladders: Array.isArray(patch.ladders) ? patch.ladders : current.ladders,
    placement: { ...current.placement, ...(patch.placement || {}) },
    rules: { ...current.rules, ...(patch.rules || {}) },
  }
}

export async function updateActiveClubSetup(input, actor) {
  const userId = requireUserId(actor)
  let directory = loadDirectory(actor)
  const clubId = directory.activeClubByUser[userId]
  if (!clubId) throw createServiceError('Choose a club first.', 'NO_ACTIVE_CLUB')
  assertClubManager(directory, userId, clubId)
  const clubIndex = directory.clubs.findIndex((club) => club.id === clubId)
  if (clubIndex === -1) throw createServiceError('This club could not be found.', 'NOT_FOUND')

  const current = directory.clubs[clubIndex]
  const keepsMinimalSetup = current.setup.configurationState === 'minimal'
  let setup = normalizeClubSetup(mergeSetup(current.setup, input))
  setup = {
    ...setup,
    clubId,
    status: 'active',
    completedStep: keepsMinimalSetup ? current.setup.completedStep : ADMIN_SETUP_STEPS.length,
    createdAt: current.setup.createdAt,
    updatedAt: nowIso(),
  }
  const validation = keepsMinimalSetup
    ? { valid: true, errors: [] }
    : validateCompleteClubSetup(setup)
  if (!validation.valid) {
    throw createServiceError(
      validation.errors[0]?.message || 'Check the club details and try again.',
      'VALIDATION_ERROR',
      validation.errors,
    )
  }

  const inviteResult = makeInviteForSetup(setup, current.invites)
  setup = inviteResult.setup
  directory.clubs[clubIndex] = {
    ...current,
    name: setup.workspace.name,
    setup,
    invites: inviteResult.invites,
    updatedAt: setup.updatedAt,
  }
  directory = writeDirectory(directory, userId)
  return publicDirectoryForUser(directory, userId).clubs.find((club) => club.id === clubId)
}

export async function rotateClubInvite(roleInput, actor) {
  const role = typeof roleInput === 'string' ? roleInput.trim() : ''
  if (!INVITE_ROLES.has(role)) {
    throw createServiceError('Choose a valid invite role.', 'INVALID_ROLE')
  }

  const userId = requireUserId(actor)
  let directory = loadDirectory(actor)
  const clubId = directory.activeClubByUser[userId]
  if (!clubId) throw createServiceError('Choose a club first.', 'NO_ACTIVE_CLUB')
  assertClubManager(directory, userId, clubId)

  const clubIndex = directory.clubs.findIndex((club) => club.id === clubId)
  if (clubIndex === -1) throw createServiceError('This club could not be found.', 'NOT_FOUND')
  const current = directory.clubs[clubIndex]
  const invite = createFreshStoredInvite(role, current.invites)
  const timestamp = nowIso()
  const setup = {
    ...current.setup,
    membership:
      role === 'player'
        ? {
            ...current.setup.membership,
            privateLinkEnabled: true,
            invitationToken: invite.token,
            invitationCode: invite.code,
            inviteRole: 'player',
          }
        : current.setup.membership,
    updatedAt: timestamp,
  }

  directory.clubs[clubIndex] = {
    ...current,
    setup,
    invites: [
      invite,
      ...current.invites.filter(
        (item) =>
          item.kind === CLUB_INVITE_KINDS.MEMBER_RECORD ||
          item.role !== role,
      ),
    ].slice(0, MAX_CLUB_INVITATIONS),
    updatedAt: timestamp,
  }
  directory = writeDirectory(directory, userId)

  const savedClub = publicDirectoryForUser(directory, userId).clubs.find(
    (club) => club.id === clubId,
  )
  return savedClub.invitations.find((item) => item.code === invite.code)
}

export async function addClubMemberRecord(input, actor) {
  const userId = requireUserId(actor)
  let directory = loadDirectory(actor)
  const context = activeClubWriteContext(directory, userId, { manager: true })

  const result = addManualMemberPatch(context.club.setup, input)
  const timestamp = nowIso()
  const nextSetup = normalizeClubSetup({
    ...context.club.setup,
    membership: result.membership,
    updatedAt: timestamp,
  })

  directory.clubs[context.clubIndex] = {
    ...context.club,
    name: nextSetup.workspace.name,
    setup: nextSetup,
    updatedAt: timestamp,
  }

  directory = writeDirectory(directory, userId)

  const savedClub = directory.clubs.find((club) => club.id === context.clubId)
  const savedMember = requireExactMemberRecord(savedClub, result.record.id).member

  return {
    club: publicDirectoryForUser(directory, userId).clubs.find(
      (club) => club.id === context.clubId,
    ),
    member: savedMember,
  }
}

export async function updateClubMemberRecord(memberIdInput, input = {}, actor) {
  const userId = requireUserId(actor)
  let directory = loadDirectory(actor)
  const context = activeClubWriteContext(directory, userId)
  const target = requireExactMemberRecord(context.club, memberIdInput)

  const canManage = MANAGER_ROLES.has(context.membership.role)
  const linkedUserId = sanitizeDirectoryId(target.member.userId)
  const isSelf = Boolean(linkedUserId && linkedUserId === userId)

  if (!canManage && !isSelf) {
    throw createServiceError(
      'You do not have permission to change this member.',
      'FORBIDDEN',
    )
  }

  const name = sanitizePlainText(
    input.name === undefined ? target.member.name : input.name,
    100,
  )
  const email = sanitizePlainText(
    input.email === undefined ? target.member.email : input.email,
    254,
  ).toLowerCase()
  const phone = sanitizePlainText(
    input.phone === undefined ? target.member.phone : input.phone,
    30,
  )

  if (name.length < 2) {
    throw createServiceError('Add the member name.', 'INVALID_MEMBER')
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)) {
    throw createServiceError('Enter a working email address.', 'INVALID_EMAIL')
  }

  const requestedPhoto =
    input.photoUrl === undefined ? target.member.photoUrl : String(input.photoUrl || '')

  if (requestedPhoto && !isSafeImageSource(requestedPhoto)) {
    throw createServiceError('That member photo could not be used safely.', 'INVALID_IMAGE')
  }

  const nextRole = canManage && input.role !== undefined
    ? normalizeClubRole(input.role)
    : target.member.role

  if (canManage && linkedUserId && nextRole !== target.member.role) {
    const linkedMembership = membershipFor(directory, linkedUserId, context.clubId)

    if (!linkedMembership || linkedMembership.status !== 'active') {
      throw createServiceError(
        'This connected member is missing its club relationship.',
        'LINKED_MEMBERSHIP_MISSING',
      )
    }

    if (
      MANAGER_ROLES.has(linkedMembership.role) &&
      !MANAGER_ROLES.has(nextRole)
    ) {
      const activeManagers = directory.memberships.filter(
        (membership) =>
          membership.clubId === context.clubId &&
          membership.status === 'active' &&
          MANAGER_ROLES.has(membership.role),
      )

      if (activeManagers.length <= 1) {
        throw createServiceError(
          'Keep at least one club admin.',
          'LAST_CLUB_MANAGER',
        )
      }
    }

    linkedMembership.role = nextRole
  }

  const membership = memberCollectionsPatch(
    context.club.setup,
    target.member.id,
    (current) => ({
      ...current,
      name,
      email,
      phone,
      gender: sanitizePlainText(
        input.gender === undefined ? current.gender : input.gender,
        30,
      ),
      dob: sanitizePlainText(
        input.dob === undefined ? current.dob : input.dob,
        10,
      ),
      bio: sanitizeMemberBio(
        input.bio === undefined ? current.bio : input.bio,
      ),
      level: canManage
        ? sanitizePlainText(
            input.level === undefined ? current.level : input.level,
            50,
          )
        : sanitizePlainText(current.level, 50),
      clubLevelId: canManage
        ? sanitizeDirectoryId(
            input.clubLevelId === undefined
              ? current.clubLevelId || current.level
              : input.clubLevelId,
          )
        : sanitizeDirectoryId(current.clubLevelId || current.level),
      rating: canManage
        ? sanitizePlainText(
            input.rating === undefined ? current.rating : input.rating,
            40,
          )
        : sanitizePlainText(current.rating, 40),
      ratings: canManage
        ? normalizeMemberRatings(input.ratings === undefined ? current.ratings : input.ratings)
        : normalizeMemberRatings(current.ratings),
      memberNumber: sanitizePlainText(
        input.memberNumber === undefined ? current.memberNumber : input.memberNumber,
        80,
      ),
      yearOfEntry: sanitizePlainText(
        input.yearOfEntry === undefined ? current.yearOfEntry : input.yearOfEntry,
        4,
      ),
      photoUrl: requestedPhoto,
      role: nextRole,
    }),
  )

  const timestamp = nowIso()
  const nextSetup = normalizeClubSetup({
    ...context.club.setup,
    membership,
    updatedAt: timestamp,
  })

  directory.clubs[context.clubIndex] = {
    ...context.club,
    name: nextSetup.workspace.name,
    setup: nextSetup,
    updatedAt: timestamp,
  }

  directory = writeDirectory(directory, userId)

  const savedClub = directory.clubs.find((club) => club.id === context.clubId)
  const savedMember = requireExactMemberRecord(savedClub, target.member.id).member

  return {
    club: publicDirectoryForUser(directory, userId).clubs.find(
      (club) => club.id === context.clubId,
    ),
    member: savedMember,
  }
}

export async function previewClubMemberImport(
  draft,
  actor,
  resolutions = {},
) {
  const userId = requireUserId(actor)
  const directory = loadDirectory(actor)
  const context = activeClubWriteContext(directory, userId, {
    manager: true,
  })

  if (!Array.isArray(draft?.people) || !draft.people.length) {
    throw createServiceError(
      'There are no members to import.',
      'EMPTY_IMPORT',
    )
  }

  if (draft.people.length > 5000) {
    throw createServiceError(
      'Import no more than 5,000 members at a time.',
      'IMPORT_TOO_LARGE',
    )
  }

  return previewMemberImportIntoSetup(
    context.club.setup,
    draft,
    resolutions,
  )
}

export async function importClubMemberData(
  draft,
  actor,
  resolutions = {},
) {
  const userId = requireUserId(actor)
  let directory = loadDirectory(actor)
  const context = activeClubWriteContext(directory, userId, {
    manager: true,
  })

  if (!Array.isArray(draft?.people) || !draft.people.length) {
    throw createServiceError(
      'There are no members to import.',
      'EMPTY_IMPORT',
    )
  }

  if (draft.people.length > 5000) {
    throw createServiceError(
      'Import no more than 5,000 members at a time.',
      'IMPORT_TOO_LARGE',
    )
  }

  // Re-evaluate against the latest club state at apply time.
  // A future backend must perform this same preview + apply transactionally.
  const merged = mergeMemberImportIntoSetup(
    context.club.setup,
    draft,
    resolutions,
  )

  const timestamp = nowIso()

  const nextSetup = normalizeClubSetup({
    ...context.club.setup,
    membership: merged.membership,
    ladders: merged.ladders,
    primaryLadderId: merged.primaryLadderId,
    updatedAt: timestamp,
  })

  directory.clubs[context.clubIndex] = {
    ...context.club,
    name: nextSetup.workspace.name,
    setup: nextSetup,
    updatedAt: timestamp,
  }

  directory = writeDirectory(directory, userId)

  return {
    club: publicDirectoryForUser(directory, userId).clubs.find(
      (club) => club.id === context.clubId,
    ),
    addedCount: merged.addedCount,
    updatedCount: merged.updatedCount,
    unchangedCount: merged.unchangedCount,
    addedLadderCount: merged.addedLadderCount,
    reconciliation: merged.reconciliation,
  }
}

export async function discardClubSetupDraft(actor) {
  const userId = requireUserId(actor)
  let directory = loadDirectory(actor)
  delete directory.draftsByUser[userId]
  directory = writeDirectory(directory, userId)
  const activeClubId = directory.activeClubByUser[userId]
  const activeClub = directory.clubs.find((club) => club.id === activeClubId)
  return activeClub ? normalizeClubSetup(activeClub.setup) : createDefaultClubSetup()
}


function isGeneratedTestMemberId(memberId) {
  return String(memberId || '').startsWith(TEST_MEMBER_PREFIX)
}

function activeClubLevelMap(setup) {
  return new Map(
    (Array.isArray(setup?.playerLevels?.levels) ? setup.playerLevels.levels : [])
      .filter((level) => level?.active !== false)
      .map((level) => [sanitizeDirectoryId(level?.id), String(level?.label || '').trim()])
      .filter(([id]) => Boolean(id)),
  )
}

function seededUtr(member) {
  return Number(member?.ratings?.utr?.value)
}

function seededMemberMatchesBaseEligibility(member, eligibility, now) {
  if (eligibility.gender === 'men' && member.gender !== 'male') return false
  if (eligibility.gender === 'women' && member.gender !== 'female') return false

  if (eligibility.age.mode === 'range') {
    const age = ageOnDate(member.dob, now)
    if (
      age === null ||
      age < eligibility.age.minimum ||
      age > eligibility.age.maximum
    ) {
      return false
    }
  }

  if (
    eligibility.skill.mode === 'rating' &&
    eligibility.skill.ratingSystem === 'utr'
  ) {
    const utr = seededUtr(member)
    if (
      !Number.isFinite(utr) ||
      utr < eligibility.skill.minimum ||
      utr > eligibility.skill.maximum
    ) {
      return false
    }
  }

  return true
}

function testUtrRange(selectedMembers) {
  const values = selectedMembers.map(seededUtr).filter(Number.isFinite)
  const minimum = Math.max(1, Math.min(...values) - 0.25)
  const maximum = Math.min(16.5, Math.max(...values) + 0.25)

  return {
    minimum: Number(minimum.toFixed(2)),
    maximum: Number(maximum.toFixed(2)),
  }
}

function levelForSeed(memberId, eligibility, levelsById, assignments) {
  if (eligibility.skill.mode !== 'club_level') return ''

  const allowedIds = eligibility.skill.levelIds.filter((id) => levelsById.has(id))
  if (!allowedIds.length) {
    throw createServiceError(
      'This Ladder requires a club level that is not active in this Club.',
      'INVALID_LADDER_LEVEL',
    )
  }

  const existing = assignments.get(memberId)
  if (existing && !allowedIds.includes(existing)) return null

  return existing || allowedIds[0]
}

/*
 * Pure setup transformation used by the DEV-only service and the node test.
 * It deliberately changes member records/entries only: club identity, invites,
 * courts, settings, match/challenge data, and active-club relationships are
 * outside its input/output surface.
 */
export function populateActiveClubTestPlayersSetup(input, timestamp = nowIso()) {
  const current = normalizeClubSetup(input)
  const activeLadders = current.ladders.filter(
    (ladder) => ladder.enabled === true && ladder.archived !== true,
  )

  if (!activeLadders.length) {
    throw createServiceError('No active Ladder to populate.', 'NO_ACTIVE_LADDER')
  }

  const levelsById = activeClubLevelMap(current)
  const generatedIds = new Set(
    LADDER_TEST_MEMBER_POOL.map((member) => member.id),
  )
  const existingMembers = collectClubMembers(current)
  const existingMemberIds = new Set(
    existingMembers
      .filter((member) => !isGeneratedTestMemberId(member.id))
      .map((member) => member.id),
  )

  let ladders = current.ladders.map((ladder) => ({
    ...ladder,
    entries: normalizeLadderEntries(ladder.entries).filter(
      (entry) => !isGeneratedTestMemberId(entry.memberId),
    ),
  }))

  const selectedByLadder = new Map()
  const clubLevelAssignments = new Map()
  const allocatedMemberIds = new Set()
  const now = new Date(timestamp)

  activeLadders.forEach((activeLadder) => {
    const ladderIndex = ladders.findIndex((ladder) => ladder.id === activeLadder.id)
    const ladder = ladders[ladderIndex]
    let eligibility = normalizeLadderEligibility(ladder.eligibility)

    let candidates = LADDER_TEST_MEMBER_POOL.filter((member) =>
      seededMemberMatchesBaseEligibility(member, eligibility, now),
    )

    if (eligibility.skill.mode === 'club_level') {
      candidates = candidates.filter((member) =>
        levelForSeed(member.id, eligibility, levelsById, clubLevelAssignments) !== null,
      )
    }

    const unallocated = candidates.filter(
      (member) => !allocatedMemberIds.has(member.id),
    )
    const selectionPool = unallocated.length >= 10 ? unallocated : candidates
    const selected = [...selectionPool]
      .sort((left, right) => seededUtr(right) - seededUtr(left))
      .slice(0, 10)

    if (selected.length !== 10) {
      throw createServiceError(
        `Could not find 10 eligible synthetic players for ${ladder.name || 'this Ladder'}.`,
        'INSUFFICIENT_TEST_PLAYERS',
      )
    }

    selected.forEach((member) => {
      allocatedMemberIds.add(member.id)
      const levelId = levelForSeed(
        member.id,
        eligibility,
        levelsById,
        clubLevelAssignments,
      )
      if (levelId) clubLevelAssignments.set(member.id, levelId)
    })

    if (
      eligibility.skill.mode === 'rating' &&
      ['ntrp', 'wtn'].includes(eligibility.skill.ratingSystem)
    ) {
      const range = testUtrRange(selected)
      eligibility = normalizeLadderEligibility({
        ...eligibility,
        skill: {
          mode: 'rating',
          ratingSystem: 'utr',
          ...range,
        },
      })
    }

    const orderedExistingIds = normalizeLadderEntries(ladder.entries)
      .filter((entry) => existingMemberIds.has(entry.memberId))
      .sort((left, right) =>
        (left.position ?? left.setupOrder ?? 10000) -
        (right.position ?? right.setupOrder ?? 10000),
      )
      .map((entry) => entry.memberId)

    const orderedMemberIds = [
      ...selected.map((member) => member.id),
      ...orderedExistingIds.filter((memberId) => !generatedIds.has(memberId)),
    ]

    ladders[ladderIndex] = {
      ...ladder,
      eligibility,
      entries: normalizeLadderEntries(
        orderedMemberIds.map((memberId, index) => ({
          memberId,
          status: LADDER_ENTRY_STATUSES.ACTIVE,
          position: index + 1,
          setupOrder: index + 1,
          source: 'admin',
          joinedAt: timestamp,
        })),
      ),
    }

    selectedByLadder.set(ladder.id, selected)
  })

  const membership = {
    ...current.membership,
    roster: (current.membership.roster || []).filter(
      (member) => !isGeneratedTestMemberId(member?.id),
    ),
    importedMembers: (current.membership.importedMembers || []).filter(
      (member) => !isGeneratedTestMemberId(member?.id),
    ),
    manualMembers: [
      ...(current.membership.manualMembers || []).filter(
        (member) => !isGeneratedTestMemberId(member?.id),
      ),
      ...LADDER_TEST_MEMBER_POOL.map((seed) => {
        const clubLevelId = clubLevelAssignments.get(seed.id) || ''
        return {
          ...seed,
          ratings: { utr: { ...seed.ratings.utr } },
          clubLevelId,
          level: levelsById.get(clubLevelId) || '',
          ladderMemberships: [],
        }
      }),
    ],
  }

  let nextSetup = {
    ...current,
    membership,
    ladders,
    placement: {
      ...current.placement,
      rankingOrder: (current.placement?.rankingOrder || []).filter(
        (memberId) => !isGeneratedTestMemberId(memberId),
      ),
    },
    updatedAt: timestamp,
  }

  activeLadders.forEach((activeLadder) => {
    const ladder = nextSetup.ladders.find((item) => item.id === activeLadder.id)
    const orderedMemberIds = normalizeLadderEntries(ladder?.entries)
      .sort((left, right) => left.position - right.position)
      .map((entry) => entry.memberId)

    nextSetup = {
      ...nextSetup,
      membership: syncClubMemberLadderOrder(nextSetup, {
        ladderId: ladder.id,
        ladderName: ladder.name,
        orderedMemberIds,
      }),
    }
  })

  const primarySelection = selectedByLadder.get(nextSetup.primaryLadderId)
  if (primarySelection) {
    nextSetup = {
      ...nextSetup,
      placement: {
        ...nextSetup.placement,
        rankingOrder: primarySelection.map((member) => member.id),
      },
    }
  }

  const setup = normalizeClubSetup(nextSetup)
  const laddersSummary = activeLadders.map((activeLadder) => {
    const ladder = setup.ladders.find((item) => item.id === activeLadder.id)
    const generatedEntries = normalizeLadderEntries(ladder?.entries)
      .filter((entry) => isGeneratedTestMemberId(entry.memberId))
      .sort((left, right) => left.position - right.position)
    const membersById = new Map(collectClubMembers(setup).map((member) => [member.id, member]))

    return {
      id: ladder.id,
      name: ladder.name,
      players: generatedEntries.map((entry) => ({
        id: entry.memberId,
        name: membersById.get(entry.memberId)?.name || 'Test player',
        position: entry.position,
      })),
    }
  })

  return {
    setup,
    generatedMemberCount: LADDER_TEST_MEMBER_POOL.length,
    activeLadderCount: laddersSummary.length,
    ladders: laddersSummary,
  }
}

export async function populateActiveClubTestPlayers(actor) {
  if (!import.meta.env?.DEV) {
    throw createServiceError(
      'Test player population is only available in development.',
      'DEV_ONLY',
    )
  }

  const userId = requireUserId(actor)
  let directory = loadDirectory(actor)
  const context = activeClubWriteContext(directory, userId, { manager: true })
  const timestamp = nowIso()
  const population = populateActiveClubTestPlayersSetup(context.club.setup, timestamp)

  const nextSetup = normalizeClubSetup({
    ...population.setup,
    updatedAt: timestamp,
  })

  directory.clubs[context.clubIndex] = {
    ...context.club,
    name: nextSetup.workspace.name,
    setup: nextSetup,
    updatedAt: timestamp,
  }

  directory = writeDirectory(directory, userId)

  return {
    club: publicDirectoryForUser(directory, userId).clubs.find(
      (club) => club.id === context.clubId,
    ),
    generatedMemberCount: population.generatedMemberCount,
    activeLadderCount: population.activeLadderCount,
    ladders: population.ladders,
  }
}
export async function updateClubMemberLadderPosition(memberIdInput, ladderIdInput, positionInput, actor) {
  const userId = requireUserId(actor)
  let directory = loadDirectory(actor)
  const context = activeClubWriteContext(directory, userId, { manager: true })
  const memberId = sanitizeDirectoryId(memberIdInput)
  const ladderId = sanitizeDirectoryId(ladderIdInput)
  const requestedPosition = Number.parseInt(positionInput, 10)
  if (!memberId || !ladderId || !Number.isInteger(requestedPosition) || requestedPosition < 1) throw createServiceError('Choose a valid Ladder position.', 'INVALID_LADDER_POSITION')
  const setup = context.club.setup
  const ladders = Array.isArray(setup.ladders) ? setup.ladders.map((ladder) => ({ ...ladder })) : []
  const ladderIndex = ladders.findIndex((ladder) => sanitizeDirectoryId(ladder.id) === ladderId)
  if (ladderIndex === -1) throw createServiceError('This Ladder could not be found.', 'LADDER_NOT_FOUND')
  const ladder = ladders[ladderIndex]
  if (ladder.archived || ladder.enabled === false) throw createServiceError('This Ladder is not active.', 'LADDER_UNAVAILABLE')
  const clubMembers = collectClubMembers(setup)
  if (!clubMembers.some((member) => member.id === memberId)) throw createServiceError('This member could not be found.', 'MEMBER_NOT_FOUND')
  const ladderName = String(ladder.name || '').trim()
  const existingEntries = normalizeLadderEntries(ladder.entries)
  const entryByMember = new Map(existingEntries.map((entry) => [entry.memberId, entry]))
  const currentMemberships = clubMembers.flatMap((member) => (Array.isArray(member.ladderMemberships) ? member.ladderMemberships : []).filter((membership) => (membership.ladderId && sanitizeDirectoryId(membership.ladderId) === ladderId) || (!membership.ladderId && String(membership.ladderName || '').trim().toLowerCase() === ladderName.toLowerCase())).map((membership) => ({ memberId: member.id, position: Number(membership.position) || 10000 })))
  const allOrderedIds = [...new Set([...existingEntries.slice().sort((left, right) => (left.position ?? left.setupOrder ?? 10000) - (right.position ?? right.setupOrder ?? 10000)).map((entry) => entry.memberId), ...currentMemberships.slice().sort((left, right) => left.position - right.position).map((membership) => membership.memberId)])]
  if (!allOrderedIds.includes(memberId)) throw createServiceError('This member is not on that Ladder.', 'MEMBER_NOT_ON_LADDER')
  const orderedMemberIds = allOrderedIds.filter((id) => id !== memberId)
  orderedMemberIds.splice(Math.min(Math.max(requestedPosition - 1, 0), orderedMemberIds.length), 0, memberId)
  const isActive = ladder.status === 'active'
  ladders[ladderIndex] = { ...ladder, entries: normalizeLadderEntries(orderedMemberIds.map((orderedMemberId, index) => { const existing = entryByMember.get(orderedMemberId); return { memberId: orderedMemberId, status: isActive ? LADDER_ENTRY_STATUSES.ACTIVE : LADDER_ENTRY_STATUSES.PENDING_PLACEMENT, position: isActive ? index + 1 : null, setupOrder: index + 1, joinedAt: existing?.joinedAt || '', source: existing?.source || 'admin' } })) }
  const membership = syncClubMemberLadderOrder(setup, { ladderId, ladderName, orderedMemberIds })
  const timestamp = nowIso()
  const nextSetup = normalizeClubSetup({ ...setup, membership, ladders, updatedAt: timestamp })
  directory.clubs[context.clubIndex] = { ...context.club, name: nextSetup.workspace.name, setup: nextSetup, updatedAt: timestamp }
  directory = writeDirectory(directory, userId)
  const savedClub = publicDirectoryForUser(directory, userId).clubs.find((club) => club.id === context.clubId)
  return { club: savedClub, ladder: savedClub?.setup?.ladders?.find((item) => item.id === ladderId) || null }
}
export const previewInvite = previewClubInvite
export const joinClub = joinClubWithInvite
export const switchClub = switchActiveClub
export const updateActiveClub = updateActiveClubSetup
export const discardDraft = discardClubSetupDraft

function ladderRecord(club, ladderIdInput) {
  const ladderId = sanitizeDirectoryId(ladderIdInput)

  return (
    (club?.setup?.ladders || []).find(
      (ladder) => ladder.id === ladderId && !ladder.archived,
    ) || null
  )
}

function replaceClubLadder(club, ladder) {
  return normalizeClubSetup({
    ...club.setup,
    ladders: club.setup.ladders.map((item) =>
      item.id === ladder.id ? ladder : item,
    ),
  })
}

function publicDirectory() {
  return readStoredDirectory() || createEmptyDirectory()
}

function linkedClubMember(club, userIdInput) {
  const userId = sanitizeDirectoryId(userIdInput)
  if (!userId) return null

  return (
    collectClubMembers(club?.setup || {}).find(
      (member) => sanitizeDirectoryId(member.userId) === userId,
    ) || null
  )
}

function publicProfile(member) {
  if (!member) return null

  return {
    memberId: member.id,
    name: sanitizePlainText(member.name, 100),
    email: sanitizePlainText(member.email, 254).toLowerCase(),
    phone: sanitizePlainText(member.phone, 30),
    gender: sanitizePlainText(member.gender, 30),
    dob: sanitizePlainText(member.dob, 10),
    clubLevelId: sanitizeDirectoryId(member.clubLevelId || member.level),
  }
}

function nextPublicMemberId(name, members) {
  const base = sanitizeDirectoryId(name, 'member')
  const used = new Set(members.map((member) => member.id))

  if (!used.has(base)) return base

  for (let suffix = 2; suffix <= 9999; suffix += 1) {
    const candidate = `${base}-${suffix}`.slice(0, 80)
    if (!used.has(candidate)) return candidate
  }

  const random =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  return sanitizeDirectoryId(
    `member-${random}`,
    `member-${Date.now()}`,
  )
}

async function resolveLadderInvite(tokenInput) {
  const token = sanitizePlainText(tokenInput, 64)
  if (!validLadderInviteToken(token)) return null

  const digest = await digestLadderInviteToken(token)
  if (!digest) return null

  const directory = publicDirectory()

  for (const club of directory.clubs) {
    for (const ladder of club.setup?.ladders || []) {
      if (
        ladder.archived ||
        ladder.invite?.enabled !== true ||
        !ladder.invite?.tokenDigest
      ) {
        continue
      }

      if (ladder.invite.tokenDigest === digest) {
        return { directory, club, ladder }
      }
    }
  }

  return null
}

function persistManagerClub(directory, userId, context, nextSetup) {
  const timestamp = nowIso()

  const nextClub = {
    ...context.club,
    setup: normalizeClubSetup(nextSetup),
    updatedAt: timestamp,
  }

  const nextDirectory = {
    ...directory,
    clubs: directory.clubs.map((club) =>
      club.id === nextClub.id ? nextClub : club,
    ),
  }

  writeDirectory(nextDirectory, userId)

  return nextClub
}

export async function createClubLadder(input, actor) {
  const userId = requireUserId(actor)
  const directory = loadDirectory(actor)
  const context = activeClubWriteContext(directory, userId, { manager: true })

  const result = createLadderFromForm({
    setup: context.club.setup,
    input,
  })

  const nextClub = persistManagerClub(
    directory,
    userId,
    context,
    {
      ...context.club.setup,
      ladders: result.ladders,
    },
  )

  return {
    club: nextClub,
    ladder: ladderRecord(nextClub, result.ladder.id),
  }
}

export async function addClubLadderMembers(ladderId, memberIds, actor) {
  const userId = requireUserId(actor)
  const directory = loadDirectory(actor)
  const context = activeClubWriteContext(directory, userId, { manager: true })

  const result = addMembersToLadder({
    setup: context.club.setup,
    ladderId,
    memberIds,
    source: 'admin',
  })

  const nextClub = persistManagerClub(
    directory,
    userId,
    context,
    {
      ...context.club.setup,
      ladders: result.ladders,
    },
  )

  return {
    club: nextClub,
    ladder: ladderRecord(nextClub, result.ladder.id),
  }
}

export async function saveClubLadderStartingOrder(
  ladderId,
  memberIds,
  actor,
) {
  const userId = requireUserId(actor)
  const directory = loadDirectory(actor)
  const context = activeClubWriteContext(directory, userId, { manager: true })

  const result = saveStartingOrder({
    setup: context.club.setup,
    ladderId,
    memberIds,
  })

  const nextClub = persistManagerClub(
    directory,
    userId,
    context,
    {
      ...context.club.setup,
      ladders: result.ladders,
    },
  )

  return {
    club: nextClub,
    ladder: ladderRecord(nextClub, result.ladder.id),
  }
}

export async function startClubLadder(ladderId, actor) {
  const userId = requireUserId(actor)
  const directory = loadDirectory(actor)
  const context = activeClubWriteContext(directory, userId, { manager: true })

  const result = startLadder({
    setup: context.club.setup,
    ladderId,
  })

  const nextClub = persistManagerClub(
    directory,
    userId,
    context,
    {
      ...context.club.setup,
      ladders: result.ladders,
      primaryLadderId:
        context.club.setup.primaryLadderId || result.ladder.id,
    },
  )

  return {
    club: nextClub,
    ladder: ladderRecord(nextClub, result.ladder.id),
  }
}

export async function createLadderInvite(ladderId, actor) {
  const userId = requireUserId(actor)
  const directory = loadDirectory(actor)
  const context = activeClubWriteContext(directory, userId, { manager: true })

  const ladder = ladderRecord(context.club, ladderId)

  if (!ladder) {
    throw createServiceError(
      'This ladder could not be found.',
      'LADDER_NOT_FOUND',
    )
  }

  const token = createPrivateInvitationToken()

  if (!token) {
    throw createServiceError(
      'Unable to make a secure invite on this device.',
      'CRYPTO_UNAVAILABLE',
    )
  }

  const tokenDigest = await digestLadderInviteToken(token)

  if (!tokenDigest) {
    throw createServiceError(
      'Unable to secure this invite.',
      'CRYPTO_UNAVAILABLE',
    )
  }

  const timestamp = nowIso()

  const nextLadder = {
    ...ladder,
    invite: {
      enabled: true,
      tokenDigest,
      createdAt: ladder.invite?.createdAt || timestamp,
      rotatedAt: timestamp,
    },
  }

  const nextClub = persistManagerClub(
    directory,
    userId,
    context,
    replaceClubLadder(context.club, nextLadder),
  )

  return {
    token,
    clubId: nextClub.id,
    ladderId: nextLadder.id,
  }
}

export async function previewLadderInvite(token, actor = {}) {
  const resolved = await resolveLadderInvite(token)

  if (!resolved) {
    throw createServiceError(
      'This ladder invite is not available.',
      'INVALID_LADDER_INVITE',
    )
  }

  const userId = actorUserId(actor)
  const member = userId
    ? linkedClubMember(resolved.club, userId)
    : null

  const summary = ladderPublicSummary({
    club: resolved.club,
    ladder: resolved.ladder,
  })

  const profile = publicProfile(member)

  const missingFields = profile
    ? ladderEligibilityMissingFields(
        resolved.ladder.eligibility,
        profile,
      )
    : []

  const eligibilityResult = profile
    ? evaluateLadderEligibility({
        eligibility: resolved.ladder.eligibility,
        profile,
      })
    : null

  return {
    ...summary,
    eligibilityRules: summary.eligibility,
    knownProfile: profile,
    missingFields,
    eligibilityResult,
    alreadyJoined: Boolean(
      member &&
        normalizeLadderEntries(resolved.ladder.entries).some(
          (entry) => entry.memberId === member.id,
        ),
    ),
  }
}

export async function joinLadderWithInvite(
  token,
  input = {},
  actor = {},
) {
  const resolved = await resolveLadderInvite(token)

  if (!resolved) {
    throw createServiceError(
      'This ladder invite is not available.',
      'INVALID_LADDER_INVITE',
    )
  }

  let { directory, club, ladder } = resolved
  const userId = actorUserId(actor)
  const existingLinked = userId ? linkedClubMember(club, userId) : null

  const prepared = prepareLadderJoin({
    ladder,
    existingProfile: publicProfile(existingLinked),
    input,
  })

  if (!prepared.ok) {
    throw createServiceError(
      prepared.message ||
        'You cannot join this ladder with the information provided.',
      prepared.eligibility?.complete
        ? 'NOT_ELIGIBLE'
        : 'PROFILE_INCOMPLETE',
      { missing: prepared.eligibility?.missing || [] },
    )
  }

  const profile = sanitizeLadderJoinProfile(prepared.profile)
  const members = collectClubMembers(club.setup)
  let member = existingLinked

  if (!member) {
    const emailMatch = profile.email
      ? members.find(
          (item) =>
            sanitizePlainText(item.email, 254).toLowerCase() === profile.email,
        )
      : null

    /*
     * Anonymous/public input may not claim an existing person by knowing
     * their email. Production may link only after verified authentication.
     */
    if (emailMatch) {
      throw createServiceError(
        'This email already belongs to a club member. Sign in with that account or ask the club administrator for help.',
        'IDENTITY_VERIFICATION_REQUIRED',
      )
    }

    member = {
      id: nextPublicMemberId(profile.name, members),
      userId: userId || '',
      ...profile,
      role: 'player',
      source: 'invite',
      status: 'active',
      photoUrl: '',
      memberNumber: '',
      yearOfEntry: '',
      level: '',
      clubLevelId: '',
      rating: '',
      ladderMemberships: [],
    }

    club = {
      ...club,
      setup: normalizeClubSetup({
        ...club.setup,
        membership: {
          ...club.setup.membership,
          manualMembers: [
            ...(club.setup.membership?.manualMembers || []),
            member,
          ],
        },
      }),
    }
  } else {
    const membership = memberCollectionsPatch(
      club.setup,
      member.id,
      (current) => ({
        ...current,
        /*
         * Invite may fill missing reusable profile facts only.
         * It cannot mutate Ladder position/rules/status authority.
         */
        name: current.name || profile.name,
        email: current.email || profile.email,
        phone: current.phone || profile.phone,
        gender: current.gender || profile.gender,
        dob: current.dob || profile.dob,
      }),
    )

    club = {
      ...club,
      setup: normalizeClubSetup({
        ...club.setup,
        membership,
      }),
    }

    member = collectClubMembers(club.setup).find(
      (item) => item.id === member.id,
    )
  }

  ladder = ladderRecord(club, ladder.id)

  const entries = normalizeLadderEntries(ladder.entries)
  const existingEntry = entries.find(
    (entry) => entry.memberId === member.id,
  )

  if (!existingEntry) {
    entries.push({
      memberId: member.id,
      status: 'pending_placement',
      position: null,
      setupOrder: entries.length + 1,
      joinedAt: nowIso(),
      source: 'invite',
    })
  }

  const nextLadder = { ...ladder, entries }
  const nextSetup = replaceClubLadder(club, nextLadder)
  const timestamp = nowIso()

  const nextClub = {
    ...club,
    setup: nextSetup,
    updatedAt: timestamp,
  }

  directory = {
    ...directory,
    clubs: directory.clubs.map((item) =>
      item.id === nextClub.id ? nextClub : item,
    ),
  }

  /*
   * Anonymous invite acceptance creates/links the ClubMember and LadderEntry.
   * It does not fabricate an authenticated Club relationship.
   */
  writeDirectory(directory, userId || '')

  return {
    clubId: nextClub.id,
    ladderId: nextLadder.id,
    memberId: member.id,
    status: existingEntry?.status || 'pending_placement',
  }
}

function normalizeImportRow(input, index) {
  const name = sanitizePlainText(
    input?.name || input?.player || input?.fullName,
    100,
  )
  const email = sanitizePlainText(input?.email, 254).toLowerCase()
  const position = Number.parseInt(
    input?.position ?? input?.rank ?? index + 1,
    10,
  )

  if (
    name.length < 2 ||
    !Number.isInteger(position) ||
    position < 1 ||
    position > 10000
  ) {
    return null
  }

  if (
    email &&
    !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/i.test(email)
  ) {
    return null
  }

  return {
    name,
    email,
    phone: sanitizePlainText(input?.phone, 30),
    gender: sanitizePlainText(input?.gender, 30),
    dob: sanitizePlainText(input?.dob || input?.dateOfBirth, 10),
    level: sanitizePlainText(input?.level || input?.skill, 50),
    position,
  }
}

export async function importLadderRoster(ladderId, rows, actor) {
  const userId = requireUserId(actor)
  let directory = loadDirectory(actor)
  const context = activeClubWriteContext(directory, userId, { manager: true })

  const ladder = ladderRecord(context.club, ladderId)

  if (!ladder) {
    throw createServiceError(
      'This ladder could not be found.',
      'LADDER_NOT_FOUND',
    )
  }

  const source = (Array.isArray(rows) ? rows : [])
    .slice(0, 500)
    .map(normalizeImportRow)
    .filter(Boolean)

  if (!source.length) {
    throw createServiceError('No usable ladder rows were found.', 'EMPTY_IMPORT')
  }

  const positions = new Set()
  const emails = new Set()

  for (const row of source) {
    if (positions.has(row.position)) {
      throw createServiceError(
        `Position #${row.position} appears more than once.`,
        'DUPLICATE_POSITION',
      )
    }

    positions.add(row.position)

    if (row.email) {
      if (emails.has(row.email)) {
        throw createServiceError(
          `The email ${row.email} appears more than once.`,
          'DUPLICATE_IDENTITY',
        )
      }
      emails.add(row.email)
    }
  }

  let workingSetup = context.club.setup
  const imported = []
  let createdMembers = 0
  let reusedMembers = 0

  for (const row of [...source].sort((a, b) => a.position - b.position)) {
    const members = collectClubMembers(workingSetup)

    const existing = row.email
      ? members.find(
          (member) =>
            sanitizePlainText(member.email, 254).toLowerCase() === row.email,
        )
      : null

    let memberId = existing?.id || ''

    if (existing) {
      reusedMembers += 1
    } else {
      /*
       * Deliberately no name-only auto merge.
       * Temporary duplicate > merging two different humans.
       */
      const patch = addManualMemberPatch(workingSetup, {
        ...row,
        role: 'player',
      })

      workingSetup = normalizeClubSetup({
        ...workingSetup,
        membership: patch.membership,
      })

      memberId = patch.record.id
      createdMembers += 1
    }

    imported.push({
      memberId,
      position: row.position,
    })
  }

  const latestLadder = ladderRecord(
    { ...context.club, setup: workingSetup },
    ladder.id,
  )

  const entryMap = new Map(
    normalizeLadderEntries(latestLadder.entries).map((entry) => [
      entry.memberId,
      entry,
    ]),
  )

  imported.forEach(({ memberId, position }) => {
    const current = entryMap.get(memberId)

    entryMap.set(memberId, {
      memberId,
      status: 'pending_placement',
      position: null,
      setupOrder: position,
      joinedAt: current?.joinedAt || nowIso(),
      source: current?.source || 'import',
    })
  })

  const nextLadder = {
    ...latestLadder,
    entries: [...entryMap.values()],
    setupStep: 'order',
  }

  const nextSetup = normalizeClubSetup({
    ...workingSetup,
    ladders: workingSetup.ladders.map((item) =>
      item.id === nextLadder.id ? nextLadder : item,
    ),
  })

  const timestamp = nowIso()
  const nextClub = {
    ...context.club,
    setup: nextSetup,
    updatedAt: timestamp,
  }

  directory = {
    ...directory,
    clubs: directory.clubs.map((club) =>
      club.id === nextClub.id ? nextClub : club,
    ),
  }

  writeDirectory(directory, userId)

  return {
    club: nextClub,
    ladder: ladderRecord(nextClub, nextLadder.id),
    summary: {
      rows: source.length,
      createdMembers,
      reusedMembers,
    },
  }
}
