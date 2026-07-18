import {
  CLUB_SETUP_SCHEMA_VERSION,
  LADDER_TEMPLATES,
  MATCH_FORMAT_PRESETS,
  MOVEMENT_SYSTEMS,
  PLACEMENT_METHODS,
  TIMEZONE_OPTIONS,
  createDefaultClubSetup,
} from '../../config/admin.js'
import { isSafeImageSource, sanitizePlainText } from '../formSafety.js'

function clampInteger(value, minimum, maximum, fallback) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback
}

function sanitizeId(value, fallback = '') {
  return (
    sanitizePlainText(value, 80)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/(^-|-$)/g, '') || fallback
  )
}

function uniqueTextList(values, { maxItems = 20, maxLength = 80 } = {}) {
  const source = Array.isArray(values) ? values : []
  return [
    ...new Set(source.map((value) => sanitizePlainText(value, maxLength)).filter(Boolean)),
  ].slice(0, maxItems)
}

function uniqueIds(values, maxItems = 250) {
  const source = Array.isArray(values) ? values : []
  return [...new Set(source.map((value) => sanitizeId(value)).filter(Boolean))].slice(0, maxItems)
}

function isAllowed(value, options, fallback) {
  return options.includes(value) ? value : fallback
}

export function normalizeClubSetup(input = {}) {
  const defaults = createDefaultClubSetup()
  const workspace = input.workspace || {}
  const membership = input.membership || {}
  const placement = input.placement || {}
  const rules = input.rules || {}
  const allowedLadderTypes = new Set(['singles', 'doubles'])
  const ladderIds = new Set()
  const ladders = (Array.isArray(input.ladders) ? input.ladders : defaults.ladders)
    .slice(0, 12)
    .map((ladder, index) => {
      const template = LADDER_TEMPLATES.find((item) => item.id === ladder?.id)
      let id = sanitizeId(ladder?.id, `ladder-${index + 1}`)
      while (ladderIds.has(id)) id = `${id}-${index + 1}`
      ladderIds.add(id)
      return {
        id,
        name: sanitizePlainText(ladder?.name || template?.name, 70),
        matchType: allowedLadderTypes.has(ladder?.matchType) ? ladder.matchType : 'singles',
        enabled: ladder?.enabled !== false,
      }
    })
    .filter((ladder) => ladder.id && ladder.name)

  const activeLadderIds = ladders.filter((ladder) => ladder.enabled).map((ladder) => ladder.id)
  const requestedPrimaryId = sanitizeId(input.primaryLadderId)
  const primaryLadderId = activeLadderIds.includes(requestedPrimaryId)
    ? requestedPrimaryId
    : activeLadderIds[0] || ''
  const scoring = rules.scoring === 'noad' ? 'noad' : 'ad'

  return {
    schemaVersion: CLUB_SETUP_SCHEMA_VERSION,
    status: input.status === 'active' ? 'active' : 'draft',
    completedStep: clampInteger(input.completedStep, 0, 6, 0),
    workspace: {
      name: sanitizePlainText(workspace.name, 100),
      logoUrl: isSafeImageSource(workspace.logoUrl) ? String(workspace.logoUrl).slice(0, 2048) : '',
      location: sanitizePlainText(workspace.location, 120),
      timezone: isAllowed(workspace.timezone, TIMEZONE_OPTIONS, defaults.workspace.timezone),
      courts: uniqueTextList(workspace.courts, { maxItems: 30, maxLength: 60 }),
      seasonStart: /^\d{4}-\d{2}-\d{2}$/.test(workspace.seasonStart || '')
        ? workspace.seasonStart
        : '',
      seasonEnd: /^\d{4}-\d{2}-\d{2}$/.test(workspace.seasonEnd || '') ? workspace.seasonEnd : '',
      administratorIds: uniqueIds(workspace.administratorIds, 20),
      notifications: {
        email: workspace.notifications?.email !== false,
        sms: Boolean(workspace.notifications?.sms),
        challengeReminders: workspace.notifications?.challengeReminders !== false,
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
      invitationToken: sanitizePlainText(membership.invitationToken, 128).replace(
        /[^a-zA-Z0-9_-]/g,
        '',
      ),
      allowManualEntry: membership.allowManualEntry !== false,
    },
    ladders,
    primaryLadderId,
    placement: {
      method: isAllowed(
        placement.method,
        PLACEMENT_METHODS.map((item) => item.id),
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
      rematchCooldownDays: clampInteger(rules.rematchCooldownDays, 0, 90, 14),
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
      scoring,
    },
    createdAt: typeof input.createdAt === 'string' ? input.createdAt : '',
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : '',
  }
}

function splitInviteValues(value = '') {
  return String(value)
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function validateClubSetupStep(setup, step) {
  const value = normalizeClubSetup(setup)
  const errors = []

  if (step === 1) {
    if (value.workspace.name.length < 2) errors.push('Enter the club name.')
  }

  if (step === 2) {
    if (value.workspace.location.length < 2) errors.push('Enter the club location.')
  }

  if (step === 3 || step === 4) {
    if (!value.ladders.some((ladder) => ladder.enabled))
      errors.push('Choose at least one ladder for your club.')
  }

  if (step === 5) {
    const emails = splitInviteValues(value.membership.inviteEmails)
    const invalidEmails = emails.filter((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    if (invalidEmails.length) errors.push('Correct the invalid email addresses before continuing.')
    const phones = splitInviteValues(value.membership.invitePhones)
    const invalidPhones = phones.filter((phone) => !/^\+?[0-9()\-]{7,20}$/.test(phone))
    if (invalidPhones.length) errors.push('Correct the invalid phone numbers before continuing.')
    if (value.membership.privateLinkEnabled && value.membership.invitationToken.length < 24) {
      errors.push('Regenerate the private invitation link before continuing.')
    }
    if (
      value.membership.source !== 'later' &&
      value.membership.source !== 'import-list' &&
      !value.membership.selectedPlayerIds.length &&
      !emails.length &&
      !phones.length &&
      !value.membership.privateLinkEnabled &&
      !value.membership.allowManualEntry
    ) {
      errors.push('Choose at least one safe way to add club members.')
    }
  }

  if (step === 6) {
    if (value.workspace.name.length < 2 || value.workspace.location.length < 2)
      errors.push('Review the club name and location before finishing.')
    if (!value.ladders.some((ladder) => ladder.enabled))
      errors.push('Choose at least one ladder before finishing.')
    if (!value.rules.movementSystem) errors.push('Choose how ladder positions move.')
    if (!value.rules.matchPreset) errors.push('Choose the official ladder match format.')
  }

  return { valid: errors.length === 0, errors }
}

export function createPrivateInvitationToken() {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') return ''
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

export function validateCompleteClubSetup(setup) {
  const results = [1, 2, 3, 4, 5, 6].map((step) => ({
    step,
    ...validateClubSetupStep(setup, step),
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
