import {
  LADDER_ENTRY_STATUSES,
  LADDER_SETUP_STATUSES,
  LADDER_SETUP_STEPS,
  createLadderWorkspaceDraft,
  evaluateLadderEligibility,
  ladderRequirementsLabel,
  normalizeLadderEligibility,
  normalizeLadderEntries,
  sanitizeLadderJoinProfile,
  validateLadderJoinProfile,
} from '../domain/ladderWorkspace.js'
import { collectClubMembers } from '../utils/club/memberData.js'
import { sanitizeDirectoryId } from '../utils/admin/clubSetup.js'
import { sanitizePlainText } from '../utils/formSafety.js'

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? {}))
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function nowIso() {
  return new Date().toISOString()
}

function ladderById(setup, ladderIdInput) {
  const ladderId = sanitizeDirectoryId(ladderIdInput)

  return (
    (Array.isArray(setup?.ladders) ? setup.ladders : []).find(
      (ladder) => ladder.id === ladderId && !ladder.archived,
    ) || null
  )
}

function nextLadderId(name, setup) {
  const base = sanitizeDirectoryId(name, 'ladder')
  const used = new Set((setup?.ladders || []).map((ladder) => ladder.id))

  if (!used.has(base)) return base

  for (let suffix = 2; suffix <= 999; suffix += 1) {
    const candidate = `${base}-${suffix}`.slice(0, 80)
    if (!used.has(candidate)) return candidate
  }

  throw new Error('Use a different ladder name.')
}

function configuredClubLevelIds(setup) {
  return new Set(
    (Array.isArray(setup?.playerLevels?.levels)
      ? setup.playerLevels.levels
      : []
    )
      .filter((level) => level?.active !== false)
      .map((level) => sanitizeDirectoryId(level?.id))
      .filter(Boolean),
  )
}

export function createLadderFromForm({ setup, input } = {}) {
  const current = clone(setup)
  const value = asObject(input)
  const name = sanitizePlainText(value.name, 70)

  if (name.length < 2) throw new Error('Enter a ladder name.')

  const eligibility = normalizeLadderEligibility(value.eligibility)

  if (eligibility.skill.mode === 'club_level') {
    const allowed = configuredClubLevelIds(current)

    if (!allowed.size) {
      throw new Error('Add club player levels before limiting this ladder by level.')
    }

    const hasUnknownLevel = eligibility.skill.levelIds.some(
      (levelId) => !allowed.has(levelId),
    )

    if (hasUnknownLevel) {
      throw new Error('Choose player levels already used by this club.')
    }
  }

  const hasClubDefaults = Boolean(
    current.rules && Object.keys(current.rules).length,
  )

  const ladder = createLadderWorkspaceDraft({
    id: nextLadderId(name, current),
    name,
    matchType: value.matchType === 'doubles' ? 'doubles' : 'singles',
    eligibility,
    rulesSource: hasClubDefaults ? 'club' : 'gorra',
    rules: hasClubDefaults ? current.rules : {},
  })

  return {
    ladder,
    ladders: [...(current.ladders || []), ladder],
  }
}

export function addMembersToLadder({
  setup,
  ladderId,
  memberIds = [],
  source = 'admin',
} = {}) {
  const current = clone(setup)
  const ladder = ladderById(current, ladderId)

  if (!ladder) throw new Error('This ladder could not be found.')

  const validMembers = new Set(
    collectClubMembers(current).map((member) => member.id),
  )

  const selected = [
    ...new Set(
      (Array.isArray(memberIds) ? memberIds : [])
        .map(sanitizeDirectoryId)
        .filter((memberId) => validMembers.has(memberId)),
    ),
  ].slice(0, 1000)

  const entries = normalizeLadderEntries(ladder.entries)
  const existingIds = new Set(entries.map((entry) => entry.memberId))

  selected.forEach((memberId) => {
    if (existingIds.has(memberId)) return

    entries.push({
      memberId,
      status: LADDER_ENTRY_STATUSES.PENDING_PLACEMENT,
      position: null,
      setupOrder: entries.length + 1,
      joinedAt: nowIso(),
      source: ['admin', 'import', 'invite', 'existing'].includes(source)
        ? source
        : 'admin',
    })

    existingIds.add(memberId)
  })

  const nextLadder = {
    ...ladder,
    entries,
    setupStep: LADDER_SETUP_STEPS.ORDER,
  }

  return {
    ladder: nextLadder,
    ladders: current.ladders.map((item) =>
      item.id === nextLadder.id ? nextLadder : item,
    ),
  }
}

export function orderedLadderEntries(setup, ladderId) {
  const ladder = ladderById(setup, ladderId)
  if (!ladder) return []

  const membersById = new Map(
    collectClubMembers(setup).map((member) => [member.id, member]),
  )

  return normalizeLadderEntries(ladder.entries)
    .map((entry, index) => ({
      ...entry,
      member: membersById.get(entry.memberId) || null,
      _index: index,
    }))
    .filter((entry) => entry.member)
    .sort(
      (left, right) =>
        (left.setupOrder ?? left.position ?? left._index + 1) -
        (right.setupOrder ?? right.position ?? right._index + 1),
    )
}

export function saveStartingOrder({ setup, ladderId, memberIds = [] } = {}) {
  const current = clone(setup)
  const ladder = ladderById(current, ladderId)

  if (!ladder) throw new Error('This ladder could not be found.')

  const currentEntries = normalizeLadderEntries(ladder.entries)
  const currentIds = new Set(currentEntries.map((entry) => entry.memberId))

  const requested = [
    ...new Set(
      (Array.isArray(memberIds) ? memberIds : [])
        .map(sanitizeDirectoryId)
        .filter((memberId) => currentIds.has(memberId)),
    ),
  ]

  if (requested.length !== currentIds.size) {
    throw new Error('Every ladder member must have one starting position.')
  }

  const entryByMember = new Map(
    currentEntries.map((entry) => [entry.memberId, entry]),
  )

  const entries = requested.map((memberId, index) => ({
    ...entryByMember.get(memberId),
    position: null,
    setupOrder: index + 1,
    status: LADDER_ENTRY_STATUSES.PENDING_PLACEMENT,
  }))

  const nextLadder = {
    ...ladder,
    entries,
    setupStep: LADDER_SETUP_STEPS.START,
  }

  return {
    ladder: nextLadder,
    ladders: current.ladders.map((item) =>
      item.id === nextLadder.id ? nextLadder : item,
    ),
  }
}

export function startLadder({ setup, ladderId } = {}) {
  const current = clone(setup)
  const ladder = ladderById(current, ladderId)

  if (!ladder) throw new Error('This ladder could not be found.')

  const ordered = orderedLadderEntries(current, ladder.id)

  if (!ordered.length) {
    throw new Error('Add at least one member before starting this ladder.')
  }

  const entries = ordered.map((entry, index) => ({
    memberId: entry.memberId,
    status: LADDER_ENTRY_STATUSES.ACTIVE,
    position: index + 1,
    setupOrder: index + 1,
    joinedAt: entry.joinedAt || nowIso(),
    source: entry.source || 'admin',
  }))

  const nextLadder = {
    ...ladder,
    entries,
    status: LADDER_SETUP_STATUSES.ACTIVE,
    setupStep: LADDER_SETUP_STEPS.COMPLETE,
  }

  return {
    ladder: nextLadder,
    ladders: current.ladders.map((item) =>
      item.id === nextLadder.id ? nextLadder : item,
    ),
  }
}

export function ladderPublicSummary({ club, ladder } = {}) {
  if (!club || !ladder) return null

  const clubLevels = Array.isArray(club.setup?.playerLevels?.levels)
    ? club.setup.playerLevels.levels
    : []

  return {
    clubId: sanitizeDirectoryId(club.id),
    clubName: sanitizePlainText(
      club.name || club.setup?.workspace?.name,
      100,
    ),
    ladderId: sanitizeDirectoryId(ladder.id),
    ladderName: sanitizePlainText(ladder.name, 70),
    matchType: ladder.matchType === 'doubles' ? 'doubles' : 'singles',
    eligibility: clone(ladder.eligibility || {}),
    requirementsLabel: ladderRequirementsLabel(
      ladder.eligibility,
      clubLevels,
    ),
  }
}

export function prepareLadderJoin({
  ladder,
  existingProfile = null,
  input = {},
  now = new Date(),
} = {}) {
  const baseProfile = sanitizeLadderJoinProfile(existingProfile || {})
  const trustedClubLevelId = sanitizeDirectoryId(
    existingProfile?.clubLevelId ||
      existingProfile?.club_level_id ||
      existingProfile?.levelId ||
      existingProfile?.level ||
      '',
  )
  const incoming = sanitizeLadderJoinProfile(input)

  const merged = {
    name: incoming.name || baseProfile.name,
    email: incoming.email || baseProfile.email,
    phone: incoming.phone || baseProfile.phone,
    gender: incoming.gender || baseProfile.gender,
    dob: incoming.dob || baseProfile.dob,
  }

  const validation = validateLadderJoinProfile(merged)

  if (!validation.valid) {
    return {
      ok: false,
      message: validation.message,
      profile: validation.profile,
      eligibility: null,
    }
  }

  const checkedProfile = {
    ...validation.profile,
    clubLevelId: trustedClubLevelId,
  }

  const eligibility = evaluateLadderEligibility({
    eligibility: ladder?.eligibility,
    profile: checkedProfile,
    now,
  })

  const needsClubLevel =
    !eligibility.complete &&
    eligibility.missing.includes('clubLevel')

  return {
    ok: eligibility.complete && eligibility.eligible,
    message: needsClubLevel
      ? 'Your club needs to set your playing level before you can join this ladder.'
      : !eligibility.complete
        ? 'We need one more detail before we can check eligibility.'
        : !eligibility.eligible
          ? 'You do not meet this ladder’s current requirements.'
          : '',
    profile: checkedProfile,
    eligibility,
  }
}
