import { normalizeClubRole, sanitizeDirectoryId } from '../admin/clubSetup.js'
import { sanitizePlainText } from '../formSafety.js'

export const CLUB_MEMBER_COLLECTIONS = Object.freeze([
  'roster',
  'manualMembers',
  'importedMembers',
])

function clone(value) {
  try {
    if (typeof structuredClone === 'function') return structuredClone(value)
  } catch {
    // Setup data is plain JSON-compatible prototype state.
  }
  return JSON.parse(JSON.stringify(value ?? {}))
}

function collectionsFrom(setup = {}) {
  const membership = setup.membership || {}
  return Object.fromEntries(
    CLUB_MEMBER_COLLECTIONS.map((key) => [
      key,
      Array.isArray(membership[key]) ? membership[key].map((member) => ({ ...member })) : [],
    ]),
  )
}

function normalizedEmail(value) {
  return sanitizePlainText(value, 254).toLowerCase()
}

function normalizedMemberNumber(value) {
  return sanitizePlainText(value, 80).toLowerCase()
}

function normalizedLadderMemberships(values = []) {
  const seen = new Set()
  return (Array.isArray(values) ? values : [])
    .map((value) => {
      const ladderName = sanitizePlainText(value?.ladderName || value?.ladder, 70)
      const ladderId = sanitizeDirectoryId(value?.ladderId)
      const position = Number.parseInt(value?.position, 10)
      if (!ladderName || !Number.isInteger(position) || position < 1 || position > 10000) return null
      const key = `${ladderName.toLowerCase()}::${position}`
      if (seen.has(key)) return null
      seen.add(key)
      return {
        ladderId,
        ladderName,
        position,
      }
    })
    .filter(Boolean)
    .slice(0, 24)
}

export function collectClubMembers(setup = {}) {
  const membership = setup.membership || {}
  const seen = new Set()
  const output = []

  CLUB_MEMBER_COLLECTIONS.forEach((collectionKey) => {
    ;(Array.isArray(membership[collectionKey]) ? membership[collectionKey] : []).forEach(
      (member, index) => {
        const id = sanitizeDirectoryId(member?.id)
        if (!id || seen.has(id)) return
        seen.add(id)
        output.push({
          ...member,
          id,
          collectionKey,
          collectionIndex: index,
          ladderMemberships: normalizedLadderMemberships(member?.ladderMemberships),
        })
      },
    )
  })

  return output
}

export function exactClubMember(setup, memberIdInput) {
  const memberId = sanitizeDirectoryId(memberIdInput)
  if (!memberId) return { count: 0, member: null }

  const membership = setup?.membership || {}
  const matches = []

  CLUB_MEMBER_COLLECTIONS.forEach((collectionKey) => {
    ;(Array.isArray(membership[collectionKey]) ? membership[collectionKey] : []).forEach(
      (member, collectionIndex) => {
        if (sanitizeDirectoryId(member?.id) !== memberId) return
        matches.push({
          ...member,
          id: memberId,
          collectionKey,
          collectionIndex,
          ladderMemberships: normalizedLadderMemberships(member?.ladderMemberships),
        })
      },
    )
  })

  return {
    count: matches.length,
    member: matches.length === 1 ? matches[0] : null,
  }
}

function replaceMemberInCollections(collections, memberId, update) {
  let count = 0

  CLUB_MEMBER_COLLECTIONS.forEach((collectionKey) => {
    collections[collectionKey] = collections[collectionKey].map((member) => {
      if (sanitizeDirectoryId(member?.id) !== memberId) return member
      count += 1
      return typeof update === 'function' ? update(member) : { ...member, ...update }
    })
  })

  return count
}

export function memberCollectionsPatch(setup, memberIdInput, update) {
  const memberId = sanitizeDirectoryId(memberIdInput)
  if (!memberId) throw new Error('This member record could not be found.')

  const collections = collectionsFrom(setup)
  const count = replaceMemberInCollections(collections, memberId, update)

  if (count === 0) throw new Error('This member record could not be found.')
  if (count > 1) throw new Error('This member record is duplicated. Review the club data before editing it.')

  return {
    ...(setup.membership || {}),
    ...collections,
  }
}

function nextMemberId(name, existingIds) {
  const base = sanitizeDirectoryId(name, 'member')
  if (!existingIds.has(base)) return base

  for (let suffix = 2; suffix <= 9999; suffix += 1) {
    const candidate = `${base}-${suffix}`.slice(0, 80)
    if (!existingIds.has(candidate)) return candidate
  }

  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  return sanitizeDirectoryId(`member-${random}`, `member-${Date.now()}`)
}

export function makeManualMemberRecord(input = {}, setup = {}) {
  const firstName = sanitizePlainText(input.firstName, 60)
  const lastName = sanitizePlainText(input.lastName, 60)
  const name = sanitizePlainText(input.name || `${firstName} ${lastName}`, 100)
  const email = normalizedEmail(input.email)
  const phone = sanitizePlainText(input.phone, 30)
  const memberNumber = sanitizePlainText(input.memberNumber, 80)

  if (name.length < 2) throw new Error('Enter the member name.')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)) {
    throw new Error('Enter a working email address.')
  }

  const members = collectClubMembers(setup)
  const emailMatch = email && members.some((member) => normalizedEmail(member.email) === email)
  const memberNumberMatch =
    memberNumber &&
    members.some(
      (member) =>
        normalizedMemberNumber(member.memberNumber) === normalizedMemberNumber(memberNumber),
    )

  if (emailMatch || memberNumberMatch) {
    throw new Error('This person already has a club record.')
  }

  const ids = new Set(members.map((member) => member.id))

  return {
    id: nextMemberId(name, ids),
    userId: '',
    name,
    email,
    phone,
    gender: sanitizePlainText(input.gender, 30),
    dob: sanitizePlainText(input.dob, 10),
    level: sanitizePlainText(input.level, 50),
    rating: sanitizePlainText(input.rating, 40),
    memberNumber,
    yearOfEntry: sanitizePlainText(input.yearOfEntry, 4),
    role: normalizeClubRole(input.role),
    source: 'manual',
    status: 'active',
    photoUrl: sanitizePlainText(input.photoUrl, 2_100_000),
    ladderMemberships: normalizedLadderMemberships(input.ladderMemberships),
  }
}

export function addManualMemberPatch(setup, input) {
  const record = makeManualMemberRecord(input, setup)
  const collections = collectionsFrom(setup)
  collections.manualMembers.push(record)

  return {
    record,
    membership: {
      ...(setup.membership || {}),
      ...collections,
    },
  }
}

function memberStrongKeys(member) {
  const keys = []
  const email = normalizedEmail(member?.email)
  const memberNumber = normalizedMemberNumber(member?.memberNumber)
  if (email) keys.push(`email:${email}`)
  if (memberNumber) keys.push(`member:${memberNumber}`)
  return keys
}

function buildExistingStrongKeyIndex(collections) {
  const index = new Map()

  CLUB_MEMBER_COLLECTIONS.forEach((collectionKey) => {
    collections[collectionKey].forEach((member, collectionIndex) => {
      memberStrongKeys(member).forEach((key) => {
        if (!index.has(key)) index.set(key, [])
        index.get(key).push({ collectionKey, collectionIndex })
      })
    })
  })

  return index
}

function mergeLadderMemberships(existing = [], incoming = []) {
  const output = normalizedLadderMemberships(existing)

  normalizedLadderMemberships(incoming).forEach((membership) => {
    const current = output.find(
      (item) => item.ladderName.toLowerCase() === membership.ladderName.toLowerCase(),
    )
    // Existing club-owned ladder information wins on conflict. Import only fills a gap.
    if (!current) output.push(membership)
  })

  return output.slice(0, 24)
}

function fillBlankMemberFields(existing, incoming) {
  const next = { ...existing }

  ;[
    'name',
    'email',
    'phone',
    'gender',
    'dob',
    'level',
    'rating',
    'memberNumber',
    'yearOfEntry',
    'photoUrl',
  ].forEach((field) => {
    if (!String(next[field] || '').trim() && String(incoming[field] || '').trim()) {
      next[field] = incoming[field]
    }
  })

  next.ladderMemberships = mergeLadderMemberships(
    existing.ladderMemberships,
    incoming.ladderMemberships,
  )

  // Account identity, club role, source, id, and current status are never overwritten by import.
  return next
}

function uniqueLadderId(name, used) {
  const base = sanitizeDirectoryId(name, 'ladder')
  if (!used.has(base)) {
    used.add(base)
    return base
  }

  for (let suffix = 2; suffix <= 999; suffix += 1) {
    const id = `${base}-${suffix}`.slice(0, 80)
    if (!used.has(id)) {
      used.add(id)
      return id
    }
  }

  throw new Error('Gorra could not make a unique ladder ID.')
}

function inferredMatchType(name) {
  return /double/i.test(String(name || '')) ? 'doubles' : 'singles'
}

export function mergeMemberImportIntoSetup(setupInput, draft = {}) {
  const setup = clone(setupInput)
  const collections = collectionsFrom(setup)
  const strongKeyIndex = buildExistingStrongKeyIndex(collections)
  const existingIds = new Set(collectClubMembers(setup).map((member) => member.id))
  let addedCount = 0
  let updatedCount = 0

  ;(Array.isArray(draft.people) ? draft.people : []).forEach((person) => {
    const incoming = {
      id: '',
      userId: '',
      name: sanitizePlainText(person.name, 100),
      email: normalizedEmail(person.email),
      phone: sanitizePlainText(person.phone, 30),
      gender: sanitizePlainText(person.gender, 30),
      dob: sanitizePlainText(person.dob, 10),
      level: sanitizePlainText(person.level, 50),
      rating: sanitizePlainText(person.rating, 40),
      memberNumber: sanitizePlainText(person.memberNumber, 80),
      yearOfEntry: sanitizePlainText(person.yearOfEntry, 4),
      role: 'player',
      source: 'import',
      status: 'active',
      photoUrl: '',
      ladderMemberships: normalizedLadderMemberships(person.ladderMemberships),
    }

    const candidateLocations = new Map()
    memberStrongKeys(incoming).forEach((key) => {
      ;(strongKeyIndex.get(key) || []).forEach((location) => {
        candidateLocations.set(`${location.collectionKey}:${location.collectionIndex}`, location)
      })
    })

    if (candidateLocations.size > 1) {
      throw new Error(
        `Gorra found more than one existing club record for ${incoming.name || incoming.email}. Review the member list before importing.`,
      )
    }

    const location = [...candidateLocations.values()][0]

    if (location) {
      const current = collections[location.collectionKey][location.collectionIndex]
      collections[location.collectionKey][location.collectionIndex] = fillBlankMemberFields(
        current,
        incoming,
      )
      updatedCount += 1
      return
    }

    incoming.id = nextMemberId(incoming.name || incoming.email || 'member', existingIds)
    existingIds.add(incoming.id)
    collections.importedMembers.push(incoming)
    memberStrongKeys(incoming).forEach((key) => {
      strongKeyIndex.set(key, [
        {
          collectionKey: 'importedMembers',
          collectionIndex: collections.importedMembers.length - 1,
        },
      ])
    })
    addedCount += 1
  })

  const currentLadders = Array.isArray(setup.ladders) ? setup.ladders.map((ladder) => ({ ...ladder })) : []
  const usedLadderIds = new Set(currentLadders.map((ladder) => sanitizeDirectoryId(ladder.id)).filter(Boolean))
  let addedLadderCount = 0

  ;(Array.isArray(draft.ladders) ? draft.ladders : []).forEach((input) => {
    const name = sanitizePlainText(input.name, 70)
    if (!name) return
    if (currentLadders.some((ladder) => String(ladder.name || '').toLowerCase() === name.toLowerCase())) {
      return
    }

    currentLadders.push({
      id: uniqueLadderId(name, usedLadderIds),
      name,
      matchType: inferredMatchType(name),
      enabled: true,
      archived: false,
    })
    addedLadderCount += 1
  })

  const activeIds = currentLadders
    .filter((ladder) => ladder.enabled !== false && !ladder.archived)
    .map((ladder) => sanitizeDirectoryId(ladder.id))
    .filter(Boolean)

  return {
    membership: {
      ...(setup.membership || {}),
      ...collections,
    },
    ladders: currentLadders,
    primaryLadderId:
      activeIds.includes(sanitizeDirectoryId(setup.primaryLadderId))
        ? sanitizeDirectoryId(setup.primaryLadderId)
        : activeIds[0] || '',
    addedCount,
    updatedCount,
    addedLadderCount,
  }
}

export function memberMissingDetails(member = {}) {
  const fields = []
  if (!String(member.email || '').trim()) fields.push('email')
  if (!String(member.gender || '').trim()) fields.push('gender')
  if (!String(member.dob || '').trim()) fields.push('date of birth')
  if (!String(member.level || '').trim()) fields.push('playing level')
  return fields
}

export function memberDirectoryStatus(member = {}) {
  const missing = memberMissingDetails(member)
  if (sanitizeDirectoryId(member.userId)) {
    return { key: 'connected', label: 'Connected account', missing }
  }
  if (missing.length) {
    return {
      key: 'needs',
      label: `${missing.length} ${missing.length === 1 ? 'detail' : 'details'} missing`,
      missing,
    }
  }
  return { key: 'unlinked', label: 'Club record', missing: [] }
}

export function memberPrimaryLadder(member = {}) {
  const membership = normalizedLadderMemberships(member.ladderMemberships)[0]
  if (!membership) return '—'
  return `${membership.ladderName} · #${membership.position}`
}
