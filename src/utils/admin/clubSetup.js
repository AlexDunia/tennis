import {
  ADMIN_SETUP_STEPS,
  CLUB_MEMBERSHIP_ROLES,
  CLUB_SETUP_SCHEMA_VERSION,
  LADDER_TEMPLATES,
  MATCH_FORMAT_PRESETS,
  MOVEMENT_SYSTEMS,
  PLACEMENT_METHODS,
  TIMEZONE_OPTIONS,
  createDefaultClubSetup,
} from '../../config/admin.js'
import { isSafeImageSource, sanitizePlainText } from '../formSafety.js'

const MEMBER_SOURCES = Object.freeze(['invite', 'import', 'manual', 'existing'])
const MEMBER_STATUSES = Object.freeze(['invited', 'pending', 'active', 'inactive'])

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function clampInteger(value, minimum, maximum, fallback) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback
}

export function sanitizeDirectoryId(value, fallback = '') {
  return (
    sanitizePlainText(value, 80)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/(^-|-$)/g, '') || fallback
  )
}

function sanitizeEmail(value) {
  const email = sanitizePlainText(value, 254).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''
}

function sanitizePhone(value) {
  const phone = sanitizePlainText(value, 30)
  return /^\+?[0-9()\-\s]{7,30}$/.test(phone) ? phone : ''
}

function uniqueTextList(values, { fallback = [], maxItems = 20, maxLength = 80 } = {}) {
  const source = Array.isArray(values) ? values : fallback
  return [
    ...new Set(source.map((value) => sanitizePlainText(value, maxLength)).filter(Boolean)),
  ].slice(0, maxItems)
}

function uniqueIds(values, maxItems = 250) {
  const source = Array.isArray(values) ? values : []
  return [...new Set(source.map((value) => sanitizeDirectoryId(value)).filter(Boolean))].slice(
    0,
    maxItems,
  )
}

function isAllowed(value, options, fallback) {
  return options.includes(value) ? value : fallback
}

function sanitizeIsoTimestamp(value) {
  if (typeof value !== 'string' || value.length > 40) return ''
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : ''
}

function sanitizeDate(value, fallback = '') {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : fallback
}

export function normalizeClubRole(value, fallback = 'player') {
  return CLUB_MEMBERSHIP_ROLES.includes(value) ? value : fallback
}

export function sanitizeInvitationToken(value) {
  const token = sanitizePlainText(value, 128)
  return /^[a-zA-Z0-9_-]{24,128}$/.test(token) ? token : ''
}

export function sanitizeInvitationCode(value) {
  const code = sanitizePlainText(value, 40)
    .toUpperCase()
    .replace(/[\s-]+/g, '')
  return /^[A-Z0-9]{6,16}$/.test(code) ? code : ''
}

function normalizeMemberRecord(input, index, sourceFallback) {
  const value = asObject(input)
  const source = isAllowed(value.source, MEMBER_SOURCES, sourceFallback)
  const email = sanitizeEmail(value.email)
  const phone = sanitizePhone(value.phone)
  const name = sanitizePlainText(value.name || value.fullName, 100)
  if (!name && !email && !phone) return null

  const identitySeed = value.id || value.userId || email || phone || `${source}-${index + 1}`
  return {
    id: sanitizeDirectoryId(identitySeed, `${source}-${index + 1}`),
    userId: sanitizeDirectoryId(value.userId),
    name,
    email,
    phone,
    role: normalizeClubRole(value.role),
    source,
    status: isAllowed(value.status, MEMBER_STATUSES, source === 'existing' ? 'active' : 'invited'),
  }
}

function normalizeMemberList(values, source, maxItems = 500) {
  const seen = new Set()
  return (Array.isArray(values) ? values : [])
    .slice(0, maxItems)
    .map((value, index) => normalizeMemberRecord(value, index, source))
    .filter((member) => {
      if (!member) return false
      const key = member.userId || member.email || member.phone || member.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function normalizeLadders(input, defaults) {
  const source = Array.isArray(input) ? input : defaults
  const ladderIds = new Set()
  return source
    .slice(0, 12)
    .map((rawLadder, index) => {
      const ladder = asObject(rawLadder)
      const template = LADDER_TEMPLATES.find((item) => item.id === ladder.id)
      let id = sanitizeDirectoryId(ladder.id, `ladder-${index + 1}`)
      while (ladderIds.has(id)) id = `${id}-${index + 1}`
      ladderIds.add(id)
      return {
        id,
        name: sanitizePlainText(ladder.name || template?.name, 70),
        matchType: ['singles', 'doubles'].includes(ladder.matchType)
          ? ladder.matchType
          : template?.matchType || 'singles',
        enabled: ladder.enabled !== false,
        archived: Boolean(ladder.archived),
      }
    })
    .filter((ladder) => ladder.id && ladder.name)
}

export function normalizeClubSetup(input = {}) {
  const value = asObject(input)
  const defaults = createDefaultClubSetup()
  const workspace = asObject(value.workspace)
  const membership = asObject(value.membership)
  const placement = asObject(value.placement)
  const rules = asObject(value.rules)
  const notificationInput = asObject(workspace.notifications)
  const ladders = normalizeLadders(value.ladders, defaults.ladders)
  const activeLadderIds = ladders
    .filter((ladder) => ladder.enabled && !ladder.archived)
    .map((ladder) => ladder.id)
  const requestedPrimaryId = sanitizeDirectoryId(value.primaryLadderId)
  const primaryLadderId = activeLadderIds.includes(requestedPrimaryId)
    ? requestedPrimaryId
    : activeLadderIds[0] || ''

  return {
    schemaVersion: CLUB_SETUP_SCHEMA_VERSION,
    clubId: sanitizeDirectoryId(value.clubId),
    status: value.status === 'active' ? 'active' : 'draft',
    completedStep: clampInteger(value.completedStep, 0, ADMIN_SETUP_STEPS.length, 0),
    workspace: {
      name: sanitizePlainText(workspace.name, 100),
      logoUrl: isSafeImageSource(workspace.logoUrl) ? String(workspace.logoUrl).slice(0, 2048) : '',
      location: sanitizePlainText(workspace.location, 120),
      timezone: isAllowed(workspace.timezone, TIMEZONE_OPTIONS, defaults.workspace.timezone),
      courts: uniqueTextList(workspace.courts, {
        fallback: defaults.workspace.courts,
        maxItems: 30,
        maxLength: 60,
      }),
      seasonStart: sanitizeDate(workspace.seasonStart, defaults.workspace.seasonStart),
      seasonEnd: sanitizeDate(workspace.seasonEnd, defaults.workspace.seasonEnd),
      administratorIds: uniqueIds(workspace.administratorIds, 30),
      notifications: {
        email: notificationInput.email !== false,
        sms: Boolean(notificationInput.sms),
        challengeReminders: notificationInput.challengeReminders !== false,
      },
    },
    membership: {
      source: isAllowed(
        membership.source,
        ['existing-roster', 'import-list', 'email-phone', 'private-link', 'manual', 'later'],
        defaults.membership.source,
      ),
      selectedPlayerIds: uniqueIds(membership.selectedPlayerIds),
      inviteEmails: sanitizePlainText(membership.inviteEmails, 4000),
      invitePhones: sanitizePlainText(membership.invitePhones, 3000),
      privateLinkEnabled: membership.privateLinkEnabled !== false,
      invitationToken: sanitizeInvitationToken(membership.invitationToken),
      invitationCode: sanitizeInvitationCode(membership.invitationCode),
      inviteRole: normalizeClubRole(membership.inviteRole),
      importedMembers: normalizeMemberList(
        membership.importedMembers || membership.importRows || membership.imports,
        'import',
      ),
      manualMembers: normalizeMemberList(membership.manualMembers, 'manual'),
      roster: normalizeMemberList(membership.roster, 'existing'),
      allowManualEntry: membership.allowManualEntry !== false,
    },
    ladders,
    primaryLadderId,
    placement: {
      method: isAllowed(
        placement.method,
        PLACEMENT_METHODS.filter((item) => item.available).map((item) => item.id),
        defaults.placement.method,
      ),
      provisionalMatches: clampInteger(placement.provisionalMatches, 1, 10, 3),
      newMemberPolicy: 'bottom-provisional',
      rankingOrder: uniqueIds(placement.rankingOrder),
    },
    rules: {
      challengeRangeUp: clampInteger(rules.challengeRangeUp, 1, 20, 3),
      allowDownwardChallenges: Boolean(rules.allowDownwardChallenges),
      maxActiveChallenges: clampInteger(rules.maxActiveChallenges, 1, 5, 1),
      responseHours: clampInteger(rules.responseHours, 1, 168, 48),
      completionDays: clampInteger(rules.completionDays, 1, 30, 7),
      rematchCooldownDays: clampInteger(rules.rematchCooldownDays, 0, 90, 7),
      repeatedDeclineLimit: clampInteger(rules.repeatedDeclineLimit, 1, 10, 3),
      inactivityDays: clampInteger(rules.inactivityDays, 7, 365, 30),
      noShowPolicy: isAllowed(
        rules.noShowPolicy,
        ['walkover-after-review', 'automatic-walkover', 'admin-review'],
        'walkover-after-review',
      ),
      movementSystem: isAllowed(
        rules.movementSystem,
        MOVEMENT_SYSTEMS.filter((item) => item.available).map((item) => item.id),
        'position-swap',
      ),
      matchPreset: isAllowed(
        rules.matchPreset,
        MATCH_FORMAT_PRESETS.map((item) => item.id),
        'time-smart',
      ),
      scoring: rules.scoring === 'noad' ? 'noad' : 'ad',
      resultConfirmation: isAllowed(
        rules.resultConfirmation,
        ['both-players', 'either-player', 'admin-only'],
        'both-players',
      ),
      disputeResolution: isAllowed(rules.disputeResolution, ['admin'], 'admin'),
    },
    createdAt: sanitizeIsoTimestamp(value.createdAt),
    updatedAt: sanitizeIsoTimestamp(value.updatedAt),
  }
}

function splitInviteValues(value = '') {
  return String(value)
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function splitPhoneValues(value = '') {
  return String(value)
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function validateClubSetupStep(setup, step) {
  const value = normalizeClubSetup(setup)
  const errors = []

  if (step === 1) {
    if (value.workspace.name.length < 2) errors.push('Enter the club name.')
    if (value.workspace.location.length < 2) errors.push('Enter the club location.')
    if (!value.workspace.courts.length) errors.push('Add at least one court.')
    if (value.workspace.seasonEnd < value.workspace.seasonStart) {
      errors.push('The season end date must come after the start date.')
    }
  }

  if (step === 2) {
    const emails = splitInviteValues(value.membership.inviteEmails)
    const invalidEmails = emails.filter((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    if (invalidEmails.length) errors.push('Check the email addresses and try again.')
    const phones = splitPhoneValues(value.membership.invitePhones)
    const invalidPhones = phones.filter((phone) => {
      const digits = phone.replace(/\D/g, '')
      return !/^\+?[0-9()\-\s]{7,24}$/.test(phone) || digits.length < 7 || digits.length > 15
    })
    if (invalidPhones.length) errors.push('Check the phone numbers and try again.')
    if (value.membership.privateLinkEnabled && !value.membership.invitationToken) {
      errors.push('Make a new invite link before you continue.')
    }
  }

  if (step === 3 && !value.ladders.some((ladder) => ladder.enabled && !ladder.archived)) {
    errors.push('Choose at least one ladder.')
  }

  if (step === 4 && !value.placement.method) {
    errors.push('Choose how players will start on the ladder.')
  }

  if (step === 5) {
    if (!value.rules.movementSystem) errors.push('Choose how ladder positions move.')
    if (!value.rules.matchPreset) errors.push('Choose the match format.')
    if (value.rules.resultConfirmation !== 'both-players') {
      errors.push('Choose both players to confirm each result.')
    }
    if (value.rules.disputeResolution !== 'admin') {
      errors.push('Choose an admin to settle result problems.')
    }
  }

  return { valid: errors.length === 0, errors }
}

function secureRandomBytes(length) {
  const cryptoApi = globalThis.crypto
  if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function') return null
  const bytes = new Uint8Array(length)
  cryptoApi.getRandomValues(bytes)
  return bytes
}

export function createPrivateInvitationToken() {
  const bytes = secureRandomBytes(24)
  if (!bytes) return ''
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

export function createPrivateInvitationCode() {
  const bytes = secureRandomBytes(8)
  if (!bytes) return ''
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('')
}

export function validateCompleteClubSetup(setup) {
  const results = ADMIN_SETUP_STEPS.map((_, index) => ({
    step: index + 1,
    ...validateClubSetupStep(setup, index + 1),
  }))
  return {
    valid: results.every((result) => result.valid),
    errors: results.flatMap((result) =>
      result.errors.map((message) => ({ step: result.step, message })),
    ),
  }
}

export function formatPresetFor(setup) {
  return MATCH_FORMAT_PRESETS.find((preset) => preset.id === setup?.rules?.matchPreset) || null
}
