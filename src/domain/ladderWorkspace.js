import { sanitizeDirectoryId } from '../utils/admin/clubSetup.js'
import { sanitizePlainText } from '../utils/formSafety.js'

export const LADDER_SETUP_STATUSES = Object.freeze({
  SETUP: 'setup',
  ACTIVE: 'active',
  PAUSED: 'paused',
})

export const LADDER_SETUP_STEPS = Object.freeze({
  MEMBERS: 'members',
  ORDER: 'order',
  START: 'start',
  COMPLETE: 'complete',
})

export const LADDER_ENTRY_STATUSES = Object.freeze({
  PENDING_PLACEMENT: 'pending_placement',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
})

export const LADDER_GENDER_REQUIREMENTS = Object.freeze(['any', 'men', 'women'])
export const LADDER_RULE_SOURCES = Object.freeze(['gorra', 'club', 'ladder'])

const INVITE_TOKEN_PATTERN = /^[a-f0-9]{48}$/i

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function clampInteger(value, minimum, maximum, fallback = null) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed)) return fallback
  return Math.min(maximum, Math.max(minimum, parsed))
}

function normalizeGender(value) {
  const normalized = sanitizePlainText(value, 30).toLowerCase()
  if (['male', 'man', 'men', 'm'].includes(normalized)) return 'men'
  if (['female', 'woman', 'women', 'f'].includes(normalized)) return 'women'
  return ''
}

function normalizeLevel(value) {
  return sanitizePlainText(value, 50).toLowerCase().replace(/\s+/g, ' ')
}

function uniqueLevels(values = []) {
  const source = Array.isArray(values)
    ? values
    : String(values || '').split(',').map((value) => value.trim())

  return [...new Set(source.map(normalizeLevel).filter(Boolean))].slice(0, 20)
}

function safeIso(value) {
  if (typeof value !== 'string' || value.length > 40) return ''
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : ''
}

function validDateOnly(value) {
  const text = sanitizePlainText(value, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return ''
  const parsed = new Date(`${text}T12:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? '' : text
}

export function normalizeLadderEligibility(input = {}) {
  const value = asObject(input)
  const gender = LADDER_GENDER_REQUIREMENTS.includes(value.gender)
    ? value.gender
    : 'any'

  const age = asObject(value.age)
  const ageMode = age.mode === 'range' ? 'range' : 'any'

  let minimumAge =
    ageMode === 'range' ? clampInteger(age.minimum, 5, 100, 18) : null
  let maximumAge =
    ageMode === 'range' ? clampInteger(age.maximum, 5, 100, 100) : null

  if (minimumAge !== null && maximumAge !== null && maximumAge < minimumAge) {
    ;[minimumAge, maximumAge] = [maximumAge, minimumAge]
  }

  const skill = asObject(value.skill)
  const levels = uniqueLevels(skill.levels || skill.allowedLevels)

  return {
    gender,
    age: {
      mode: ageMode,
      minimum: ageMode === 'range' ? minimumAge : null,
      maximum: ageMode === 'range' ? maximumAge : null,
    },
    skill: {
      mode: skill.mode === 'set' && levels.length ? 'set' : 'any',
      levels: skill.mode === 'set' ? levels : [],
    },
  }
}

export function normalizeLadderEntry(input = {}) {
  const value = asObject(input)
  const memberId = sanitizeDirectoryId(value.memberId)
  if (!memberId) return null

  const position = Number.parseInt(value.position, 10)
  const setupOrder = Number.parseInt(value.setupOrder ?? value.importPosition, 10)
  const status = Object.values(LADDER_ENTRY_STATUSES).includes(value.status)
    ? value.status
    : LADDER_ENTRY_STATUSES.PENDING_PLACEMENT

  return {
    memberId,
    status,
    position:
      status === LADDER_ENTRY_STATUSES.ACTIVE &&
      Number.isInteger(position) &&
      position >= 1 &&
      position <= 10000
        ? position
        : null,
    setupOrder:
      Number.isInteger(setupOrder) && setupOrder >= 1 && setupOrder <= 10000
        ? setupOrder
        : null,
    joinedAt: safeIso(value.joinedAt),
    source: ['admin', 'invite', 'import', 'existing'].includes(value.source)
      ? value.source
      : 'admin',
  }
}

export function normalizeLadderEntries(values = []) {
  const source = Array.isArray(values) ? values : []
  const seen = new Set()

  return source
    .slice(0, 1000)
    .map(normalizeLadderEntry)
    .filter((entry) => {
      if (!entry || seen.has(entry.memberId)) return false
      seen.add(entry.memberId)
      return true
    })
}

export function normalizeLadderInvite(input = {}) {
  const value = asObject(input)
  return {
    enabled: value.enabled === true,
    tokenDigest: /^[a-f0-9]{64}$/i.test(String(value.tokenDigest || ''))
      ? String(value.tokenDigest).toLowerCase()
      : '',
    createdAt: safeIso(value.createdAt),
    rotatedAt: safeIso(value.rotatedAt),
  }
}

export function normalizeLadderWorkspaceFields(
  input = {},
  { legacyActive = false } = {},
) {
  const value = asObject(input)
  const status = Object.values(LADDER_SETUP_STATUSES).includes(value.status)
    ? value.status
    : legacyActive
      ? LADDER_SETUP_STATUSES.ACTIVE
      : LADDER_SETUP_STATUSES.SETUP

  const setupStep = Object.values(LADDER_SETUP_STEPS).includes(value.setupStep)
    ? value.setupStep
    : status === LADDER_SETUP_STATUSES.ACTIVE
      ? LADDER_SETUP_STEPS.COMPLETE
      : LADDER_SETUP_STEPS.MEMBERS

  const rulesSource = LADDER_RULE_SOURCES.includes(value.rulesSource)
    ? value.rulesSource
    : 'club'

  return {
    status,
    setupStep,
    eligibility: normalizeLadderEligibility(value.eligibility),
    rulesSource,
    entries: normalizeLadderEntries(value.entries),
    invite: normalizeLadderInvite(value.invite),
  }
}

export function createLadderWorkspaceDraft({
  id = '',
  name = '',
  matchType = 'singles',
  eligibility = {},
  rulesSource = 'club',
  rules = {},
} = {}) {
  const safeName = sanitizePlainText(name, 70)

  return {
    id: sanitizeDirectoryId(id || safeName, `ladder-${Date.now()}`),
    name: safeName,
    matchType: matchType === 'doubles' ? 'doubles' : 'singles',
    enabled: true,
    archived: false,
    status: LADDER_SETUP_STATUSES.SETUP,
    setupStep: LADDER_SETUP_STEPS.MEMBERS,
    eligibility: normalizeLadderEligibility(eligibility),
    rulesSource: LADDER_RULE_SOURCES.includes(rulesSource) ? rulesSource : 'club',
    rules:
      rules && typeof rules === 'object' && !Array.isArray(rules)
        ? JSON.parse(JSON.stringify(rules))
        : {},
    entries: [],
    invite: {
      enabled: false,
      tokenDigest: '',
      createdAt: '',
      rotatedAt: '',
    },
  }
}

export function ageOnDate(dobInput, nowInput = new Date()) {
  const dob = validDateOnly(dobInput)
  if (!dob) return null

  const [year, month, day] = dob.split('-').map(Number)
  const now = nowInput instanceof Date ? nowInput : new Date(nowInput)
  if (Number.isNaN(now.getTime())) return null

  let age = now.getUTCFullYear() - year
  const monthDifference = now.getUTCMonth() + 1 - month

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && now.getUTCDate() < day)
  ) {
    age -= 1
  }

  return age >= 0 && age <= 130 ? age : null
}

export function ladderEligibilityMissingFields(eligibilityInput, profileInput) {
  const eligibility = normalizeLadderEligibility(eligibilityInput)
  const profile = asObject(profileInput)
  const missing = []

  if (eligibility.gender !== 'any' && !normalizeGender(profile.gender)) {
    missing.push('gender')
  }

  if (eligibility.age.mode === 'range' && !validDateOnly(profile.dob)) {
    missing.push('dob')
  }

  if (
    eligibility.skill.mode === 'set' &&
    !normalizeLevel(profile.level || profile.skillLevel)
  ) {
    missing.push('level')
  }

  return missing
}

export function evaluateLadderEligibility({
  eligibility: eligibilityInput,
  profile: profileInput,
  now = new Date(),
} = {}) {
  const eligibility = normalizeLadderEligibility(eligibilityInput)
  const profile = asObject(profileInput)
  const missing = ladderEligibilityMissingFields(eligibility, profile)

  if (missing.length) {
    return {
      eligible: false,
      complete: false,
      reason: 'missing_information',
      missing,
    }
  }

  if (
    eligibility.gender !== 'any' &&
    normalizeGender(profile.gender) !== eligibility.gender
  ) {
    return {
      eligible: false,
      complete: true,
      reason: 'gender',
      missing: [],
    }
  }

  if (eligibility.age.mode === 'range') {
    const age = ageOnDate(profile.dob, now)

    if (age === null) {
      return {
        eligible: false,
        complete: false,
        reason: 'missing_information',
        missing: ['dob'],
      }
    }

    if (age < eligibility.age.minimum || age > eligibility.age.maximum) {
      return {
        eligible: false,
        complete: true,
        reason: 'age',
        missing: [],
      }
    }
  }

  if (eligibility.skill.mode === 'set') {
    const level = normalizeLevel(profile.level || profile.skillLevel)
    if (!eligibility.skill.levels.includes(level)) {
      return {
        eligible: false,
        complete: true,
        reason: 'skill',
        missing: [],
      }
    }
  }

  return {
    eligible: true,
    complete: true,
    reason: '',
    missing: [],
  }
}

export function ladderRequirementsLabel(eligibilityInput) {
  const eligibility = normalizeLadderEligibility(eligibilityInput)
  const parts = []

  if (eligibility.gender === 'men') parts.push('Men')
  else if (eligibility.gender === 'women') parts.push('Women')
  else parts.push('Any gender')

  if (eligibility.age.mode === 'range') {
    const min = eligibility.age.minimum
    const max = eligibility.age.maximum
    parts.push(max >= 100 ? `Age ${min}+` : `Age ${min}–${max}`)
  } else {
    parts.push('Any age')
  }

  if (eligibility.skill.mode === 'set') {
    parts.push(
      eligibility.skill.levels
        .map((level) => level.replace(/\b\w/g, (letter) => letter.toUpperCase()))
        .join(', '),
    )
  } else {
    parts.push('All skill levels')
  }

  return parts.join(' · ')
}

export function sanitizeLadderJoinProfile(input = {}) {
  return {
    name: sanitizePlainText(input.name || input.fullName, 100),
    email: sanitizePlainText(input.email, 254).toLowerCase(),
    phone: sanitizePlainText(input.phone, 30),
    gender: sanitizePlainText(input.gender, 30),
    dob: validDateOnly(input.dob),
    level: sanitizePlainText(input.level || input.skillLevel, 50),
  }
}

export function validateLadderJoinProfile(profileInput) {
  const profile = sanitizeLadderJoinProfile(profileInput)

  if (profile.name.length < 2) {
    return { valid: false, message: 'Enter your full name.', profile }
  }

  if (
    profile.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(profile.email)
  ) {
    return { valid: false, message: 'Enter a working email address.', profile }
  }

  if (profile.phone && !/^\+?[0-9()\-\s]{7,30}$/.test(profile.phone)) {
    return { valid: false, message: 'Check the phone number.', profile }
  }

  if (!profile.email && !profile.phone) {
    return {
      valid: false,
      message: 'Add an email address or phone number.',
      profile,
    }
  }

  return { valid: true, message: '', profile }
}

export function validLadderInviteToken(value) {
  return INVITE_TOKEN_PATTERN.test(sanitizePlainText(value, 64))
}

export async function digestLadderInviteToken(tokenInput) {
  const token = sanitizePlainText(tokenInput, 64)
  if (!validLadderInviteToken(token)) return ''

  const cryptoApi = globalThis.crypto
  if (!cryptoApi?.subtle || typeof TextEncoder === 'undefined') return ''

  const digest = await cryptoApi.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  )

  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('')
}
