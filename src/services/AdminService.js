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
  if (!candidates.code && !candidates.token) return null
  for (const club of directory.clubs) {
    if (club.setup.status !== 'active') continue
    const invite = club.invites.find(
      (item) =>
        item.enabled &&
        ((candidates.code && item.code === candidates.code) ||
          (candidates.token && item.token === candidates.token)),
    )
    if (invite) return { club, invite }
  }
  return null
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
  const hasSetupSections = ['workspace', 'membership', 'ladders', 'placement', 'rules'].some(
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

export async function discardClubSetupDraft(actor) {
  const userId = requireUserId(actor)
  let directory = loadDirectory(actor)
  delete directory.draftsByUser[userId]
  directory = writeDirectory(directory, userId)
  const activeClubId = directory.activeClubByUser[userId]
  const activeClub = directory.clubs.find((club) => club.id === activeClubId)
  return activeClub ? normalizeClubSetup(activeClub.setup) : createDefaultClubSetup()
}

export const previewInvite = previewClubInvite
export const joinClub = joinClubWithInvite
export const switchClub = switchActiveClub
export const updateActiveClub = updateActiveClubSetup
export const discardDraft = discardClubSetupDraft
