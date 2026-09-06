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

const IMPORT_MUTABLE_FIELDS = Object.freeze([
  'name',
  'email',
  'phone',
  'gender',
  'dob',
  'level',
  'rating',
  'memberNumber',
  'yearOfEntry',
])

const IMPORT_FIELD_LABELS = Object.freeze({
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  gender: 'Gender',
  dob: 'Date of birth',
  level: 'Playing level',
  rating: 'Rating',
  memberNumber: 'Member / reference number',
  yearOfEntry: 'Year of entry',
})

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

function normalizedCompareValue(field, value) {
  const raw = String(value ?? '').trim()

  if (!raw) return ''

  if (field === 'email') return raw.toLowerCase()
  if (field === 'memberNumber') return raw.toLowerCase()
  if (field === 'phone') return raw.replace(/[\s()+-]/g, '')
  if (['name', 'gender', 'level', 'rating'].includes(field)) {
    return raw.replace(/\s+/g, ' ').toLowerCase()
  }

  return raw
}

function sameImportValue(field, left, right) {
  return normalizedCompareValue(field, left) === normalizedCompareValue(field, right)
}

function resolutionValue(resolutions, id) {
  return resolutions?.[id] === 'incoming' ? 'incoming' : 'keep'
}

function sanitizeImportedField(field, value) {
  if (field === 'email') return normalizedEmail(value)

  const limits = {
    name: 100,
    phone: 30,
    gender: 30,
    dob: 10,
    level: 50,
    rating: 40,
    memberNumber: 80,
    yearOfEntry: 4,
  }

  return sanitizePlainText(value, limits[field] || 100)
}

function resolveDraftPerson(personInput = {}, resolutions = {}) {
  const person = {
    importIdentity: sanitizePlainText(personInput.importIdentity, 320),
    importIdentityAmbiguous: Boolean(personInput.importIdentityAmbiguous),
    importRows: Array.isArray(personInput.importRows)
      ? personInput.importRows.slice(0, 50)
      : [],
    importConflicts: Array.isArray(personInput.importConflicts)
      ? personInput.importConflicts.slice(0, 100)
      : [],
    name: sanitizeImportedField('name', personInput.name),
    email: sanitizeImportedField('email', personInput.email),
    phone: sanitizeImportedField('phone', personInput.phone),
    gender: sanitizeImportedField('gender', personInput.gender),
    dob: sanitizeImportedField('dob', personInput.dob),
    level: sanitizeImportedField('level', personInput.level),
    rating: sanitizeImportedField('rating', personInput.rating),
    memberNumber: sanitizeImportedField('memberNumber', personInput.memberNumber),
    yearOfEntry: sanitizeImportedField('yearOfEntry', personInput.yearOfEntry),
    ladderMemberships: normalizedLadderMemberships(personInput.ladderMemberships),
  }

  person.importConflicts.forEach((conflict) => {
    if (resolutionValue(resolutions, conflict.id) !== 'incoming') return

    if (conflict.kind === 'file-field' && IMPORT_MUTABLE_FIELDS.includes(conflict.field)) {
      person[conflict.field] = sanitizeImportedField(
        conflict.field,
        conflict.incomingValue,
      )
      return
    }

    if (conflict.kind === 'file-ladder-position') {
      const ladderName = sanitizePlainText(conflict.ladderName, 70)
      const position = Number.parseInt(conflict.incomingPosition, 10)
      if (!ladderName || !Number.isInteger(position) || position < 1) return

      const current = person.ladderMemberships.find(
        (membership) =>
          membership.ladderName.toLowerCase() === ladderName.toLowerCase(),
      )

      if (current) current.position = position
    }
  })

  return person
}

function memberFieldConflictId(memberId, field) {
  return `member:${sanitizeDirectoryId(memberId)}:field:${field}`
}

function memberLadderConflictId(memberId, ladderName) {
  return `member:${sanitizeDirectoryId(memberId)}:ladder:${sanitizeDirectoryId(ladderName, 'ladder')}`
}

function incomingDisplayName(person) {
  return person.name || person.email || person.memberNumber || 'Imported member'
}

function fileConflictCards(personInput, resolvedPerson) {
  return (Array.isArray(personInput.importConflicts) ? personInput.importConflicts : []).map(
    (conflict) => ({
      id: conflict.id,
      kind: conflict.kind,
      personName: incomingDisplayName(resolvedPerson),
      field: conflict.field || 'ladderPosition',
      fieldLabel:
        conflict.fieldLabel ||
        IMPORT_FIELD_LABELS[conflict.field] ||
        'Imported value',
      ladderName: conflict.ladderName || '',
      currentLabel:
        Number.isInteger(conflict.earlierRow)
          ? `Earlier row ${conflict.earlierRow + 1}`
          : 'Earlier row',
      incomingLabel:
        Number.isInteger(conflict.incomingRow)
          ? `Later row ${conflict.incomingRow + 1}`
          : 'Later row',
      currentValue:
        conflict.kind === 'file-ladder-position'
          ? `#${conflict.earlierPosition}`
          : String(conflict.earlierValue || ''),
      incomingValue:
        conflict.kind === 'file-ladder-position'
          ? `#${conflict.incomingPosition}`
          : String(conflict.incomingValue || ''),
      canUseIncoming: true,
      message:
        'This person appears more than once in the uploaded file with different information.',
    }),
  )
}

function makeImportPlan(setupInput, draft = {}, resolutions = {}) {
  const setup = clone(setupInput)
  const collections = collectionsFrom(setup)
  const strongKeyIndex = buildExistingStrongKeyIndex(collections)
  const existingMembers = collectClubMembers(setup)
  const conflicts = []
  const blockingConflicts = []

  const plans = (Array.isArray(draft.people) ? draft.people : []).map(
    (personInput, personIndex) => {
      const person = resolveDraftPerson(personInput, resolutions)
      conflicts.push(...fileConflictCards(personInput, person))

      if (person.importIdentityAmbiguous) {
        blockingConflicts.push({
          id: `file-identity:${personIndex}`,
          kind: 'ambiguous-file-identity',
          personName: incomingDisplayName(person),
          message:
            'Rows in this file connect the same email and member numbers in conflicting ways. Gorra will not guess which rows belong to the same person.',
        })

        return {
          personIndex,
          personInput,
          person,
          kind: 'ambiguous',
          location: null,
          current: null,
          memberKey: `ambiguous:${personIndex}`,
          fills: [],
          newLadderMemberships: [],
          fieldConflicts: [],
          ladderConflicts: [],
        }
      }

      const candidateLocations = new Map()

      memberStrongKeys(person).forEach((key) => {
        ;(strongKeyIndex.get(key) || []).forEach((location) => {
          candidateLocations.set(
            `${location.collectionKey}:${location.collectionIndex}`,
            location,
          )
        })
      })

      if (candidateLocations.size > 1) {
        blockingConflicts.push({
          id: `ambiguous:${personIndex}`,
          kind: 'ambiguous-identity',
          personName: incomingDisplayName(person),
          message:
            'Email and member number point to different existing club records. Gorra will not guess which person to change.',
        })

        return {
          personIndex,
          personInput,
          person,
          kind: 'ambiguous',
          location: null,
          current: null,
          memberKey: `ambiguous:${personIndex}`,
          fills: [],
          newLadderMemberships: [],
          fieldConflicts: [],
          ladderConflicts: [],
        }
      }

      const location = [...candidateLocations.values()][0] || null
      const current = location
        ? collections[location.collectionKey][location.collectionIndex]
        : null
      const memberKey = current?.id
        ? sanitizeDirectoryId(current.id)
        : `new:${person.importIdentity || personIndex}`

      const plan = {
        personIndex,
        personInput,
        person,
        kind: current ? 'existing' : 'new',
        location,
        current,
        memberKey,
        fills: [],
        newLadderMemberships: [],
        fieldConflicts: [],
        ladderConflicts: [],
      }

      if (!current) return plan

      IMPORT_MUTABLE_FIELDS.forEach((field) => {
        const incomingValue = String(person[field] || '').trim()
        const currentValue = String(current[field] || '').trim()

        if (!incomingValue) return

        if (!currentValue) {
          plan.fills.push({
            field,
            fieldLabel: IMPORT_FIELD_LABELS[field],
            value: incomingValue,
          })
          return
        }

        if (sameImportValue(field, currentValue, incomingValue)) return

        const conflict = {
          id: memberFieldConflictId(current.id, field),
          kind: 'member-field',
          personName: incomingDisplayName(person),
          field,
          fieldLabel: IMPORT_FIELD_LABELS[field],
          currentLabel: 'Current club record',
          incomingLabel: 'Imported file',
          currentValue,
          incomingValue,
          canUseIncoming: true,
          message: 'The club already has a different value for this field.',
        }

        plan.fieldConflicts.push(conflict)
        conflicts.push(conflict)
      })

      const currentMemberships = normalizedLadderMemberships(
        current.ladderMemberships,
      )

      person.ladderMemberships.forEach((incomingMembership) => {
        const existingMembership = currentMemberships.find(
          (membership) =>
            membership.ladderName.toLowerCase() ===
            incomingMembership.ladderName.toLowerCase(),
        )

        if (!existingMembership) {
          plan.newLadderMemberships.push(incomingMembership)
          return
        }

        if (existingMembership.position === incomingMembership.position) return

        const conflict = {
          id: memberLadderConflictId(current.id, incomingMembership.ladderName),
          kind: 'ladder-position',
          personName: incomingDisplayName(person),
          field: 'ladderPosition',
          fieldLabel: 'Ladder position',
          ladderName: incomingMembership.ladderName,
          currentLabel: 'Current club position',
          incomingLabel: 'Imported file',
          currentValue: `#${existingMembership.position}`,
          incomingValue: `#${incomingMembership.position}`,
          currentPosition: existingMembership.position,
          incomingPosition: incomingMembership.position,
          canUseIncoming: true,
          message:
            'Changing this uses the imported ladder position. Gorra will still block the save if another player would be left in the same position.',
        }

        plan.ladderConflicts.push(conflict)
        conflicts.push(conflict)
      })

      return plan
    },
  )

  const planByExistingMemberId = new Map(
    plans
      .filter((plan) => plan.kind === 'existing' && plan.current?.id)
      .map((plan) => [sanitizeDirectoryId(plan.current.id), plan]),
  )

  const occupancy = new Map()

  existingMembers.forEach((member) => {
    normalizedLadderMemberships(member.ladderMemberships).forEach(
      (membership) => {
        const key = `${membership.ladderName.toLowerCase()}::${membership.position}`
        if (!occupancy.has(key)) occupancy.set(key, [])
        occupancy.get(key).push(sanitizeDirectoryId(member.id))
      },
    )
  })

  function finalPositionForPlan(plan, ladderName) {
    const incomingMembership = plan.person.ladderMemberships.find(
      (membership) =>
        membership.ladderName.toLowerCase() === ladderName.toLowerCase(),
    )

    const currentMembership = normalizedLadderMemberships(
      plan.current?.ladderMemberships,
    ).find(
      (membership) =>
        membership.ladderName.toLowerCase() === ladderName.toLowerCase(),
    )

    if (!incomingMembership) return currentMembership?.position || null
    if (!currentMembership) return incomingMembership.position
    if (currentMembership.position === incomingMembership.position) {
      return currentMembership.position
    }

    const conflictId = memberLadderConflictId(
      plan.current.id,
      incomingMembership.ladderName,
    )

    return resolutionValue(resolutions, conflictId) === 'incoming'
      ? incomingMembership.position
      : currentMembership.position
  }

  plans.forEach((plan) => {
    if (plan.kind === 'ambiguous') return

    plan.person.ladderMemberships.forEach((incomingMembership) => {
      const currentMembership = normalizedLadderMemberships(
        plan.current?.ladderMemberships,
      ).find(
        (membership) =>
          membership.ladderName.toLowerCase() ===
          incomingMembership.ladderName.toLowerCase(),
      )

      const finalPosition = finalPositionForPlan(
        plan,
        incomingMembership.ladderName,
      )

      const unchangedExistingPosition =
        currentMembership &&
        currentMembership.position === finalPosition

      if (unchangedExistingPosition) return

      const key = `${incomingMembership.ladderName.toLowerCase()}::${finalPosition}`
      const occupants = (occupancy.get(key) || []).filter(
        (memberId) =>
          !plan.current?.id ||
          memberId !== sanitizeDirectoryId(plan.current.id),
      )

      const stationaryOccupants = occupants.filter((memberId) => {
        const occupantPlan = planByExistingMemberId.get(memberId)
        if (!occupantPlan) return true

        const occupantFinalPosition = finalPositionForPlan(
          occupantPlan,
          incomingMembership.ladderName,
        )

        return occupantFinalPosition === finalPosition
      })

      if (!stationaryOccupants.length) return

      const occupiedBy = existingMembers
        .filter((member) =>
          stationaryOccupants.includes(sanitizeDirectoryId(member.id)),
        )
        .map((member) => member.name || member.email)
        .filter(Boolean)
        .join(', ')

      blockingConflicts.push({
        id: `position:${sanitizeDirectoryId(incomingMembership.ladderName, 'ladder')}:${finalPosition}:${plan.memberKey}`,
        kind: 'ladder-position-occupied',
        personName: incomingDisplayName(plan.person),
        ladderName: incomingMembership.ladderName,
        message: `Position #${finalPosition} in ${incomingMembership.ladderName} is still held by ${occupiedBy || 'another club member'}. Change the import or move that player as part of the same ladder update.`,
      })
    })
  })

  const existingLadderNames = new Set(
    (Array.isArray(setup.ladders) ? setup.ladders : [])
      .map((ladder) => String(ladder.name || '').trim().toLowerCase())
      .filter(Boolean),
  )

  const newLadderNames = new Set(
    (Array.isArray(draft.ladders) ? draft.ladders : [])
      .map((ladder) => String(ladder.name || '').trim())
      .filter(
        (name) =>
          name && !existingLadderNames.has(name.toLowerCase()),
      )
      .map((name) => name.toLowerCase()),
  )

  const existingPlans = plans.filter((plan) => plan.kind === 'existing')
  const newPlans = plans.filter((plan) => plan.kind === 'new')

  const fillCount = existingPlans.reduce(
    (total, plan) => total + plan.fills.length,
    0,
  )

  const newLadderMembershipCount = plans.reduce(
    (total, plan) => total + plan.newLadderMemberships.length,
    0,
  )

  const unchangedCount = existingPlans.filter(
    (plan) =>
      !plan.fills.length &&
      !plan.newLadderMemberships.length &&
      !plan.fieldConflicts.length &&
      !plan.ladderConflicts.length,
  ).length

  return {
    setup,
    collections,
    plans,
    resolutions,
    conflicts,
    blockingConflicts,
    summary: {
      newCount: newPlans.length,
      existingCount: existingPlans.length,
      unchangedCount,
      fillCount,
      newLadderMembershipCount,
      conflictCount: conflicts.length,
      blockingCount: blockingConflicts.length,
      newLadderCount: newLadderNames.size,
    },
  }
}

export function previewMemberImportIntoSetup(
  setupInput,
  draft = {},
  resolutions = {},
) {
  const plan = makeImportPlan(setupInput, draft, resolutions)

  return {
    summary: plan.summary,
    conflicts: plan.conflicts,
    blockingConflicts: plan.blockingConflicts,
    canApply: plan.blockingConflicts.length === 0,
  }
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

export function mergeMemberImportIntoSetup(
  setupInput,
  draft = {},
  resolutions = {},
) {
  const reconciliation = makeImportPlan(
    setupInput,
    draft,
    resolutions,
  )

  if (reconciliation.blockingConflicts.length) {
    throw new Error(reconciliation.blockingConflicts[0].message)
  }

  const setup = reconciliation.setup
  const collections = reconciliation.collections
  const existingIds = new Set(
    collectClubMembers(setup).map((member) => member.id),
  )

  let addedCount = 0
  let updatedCount = 0
  let unchangedCount = 0

  reconciliation.plans.forEach((plan) => {
    if (plan.kind === 'ambiguous') return

    const incoming = {
      id: '',
      userId: '',
      name: plan.person.name,
      email: plan.person.email,
      phone: plan.person.phone,
      gender: plan.person.gender,
      dob: plan.person.dob,
      level: plan.person.level,
      rating: plan.person.rating,
      memberNumber: plan.person.memberNumber,
      yearOfEntry: plan.person.yearOfEntry,
      role: 'player',
      source: 'import',
      status: 'active',
      photoUrl: '',
      ladderMemberships: normalizedLadderMemberships(
        plan.person.ladderMemberships,
      ),
    }

    if (!plan.location || !plan.current) {
      incoming.id = nextMemberId(
        incoming.name || incoming.email || 'member',
        existingIds,
      )
      existingIds.add(incoming.id)
      collections.importedMembers.push(incoming)
      addedCount += 1
      return
    }

    const current = plan.current
    const next = {
      ...current,
      ladderMemberships: normalizedLadderMemberships(
        current.ladderMemberships,
      ),
    }

    IMPORT_MUTABLE_FIELDS.forEach((field) => {
      const incomingValue = String(incoming[field] || '').trim()
      const currentValue = String(current[field] || '').trim()

      if (!incomingValue) return

      if (!currentValue) {
        next[field] = incoming[field]
        return
      }

      if (sameImportValue(field, currentValue, incomingValue)) return

      const conflictId = memberFieldConflictId(current.id, field)

      if (resolutionValue(resolutions, conflictId) === 'incoming') {
        next[field] = incoming[field]
      }
    })

    incoming.ladderMemberships.forEach((incomingMembership) => {
      const currentMembership = next.ladderMemberships.find(
        (membership) =>
          membership.ladderName.toLowerCase() ===
          incomingMembership.ladderName.toLowerCase(),
      )

      if (!currentMembership) {
        next.ladderMemberships.push(incomingMembership)
        return
      }

      if (currentMembership.position === incomingMembership.position) return

      const conflictId = memberLadderConflictId(
        current.id,
        incomingMembership.ladderName,
      )

      if (resolutionValue(resolutions, conflictId) === 'incoming') {
        currentMembership.position = incomingMembership.position
      }
    })

    const before = JSON.stringify({
      name: current.name,
      email: current.email,
      phone: current.phone,
      gender: current.gender,
      dob: current.dob,
      level: current.level,
      rating: current.rating,
      memberNumber: current.memberNumber,
      yearOfEntry: current.yearOfEntry,
      ladderMemberships: normalizedLadderMemberships(
        current.ladderMemberships,
      ),
    })

    const after = JSON.stringify({
      name: next.name,
      email: next.email,
      phone: next.phone,
      gender: next.gender,
      dob: next.dob,
      level: next.level,
      rating: next.rating,
      memberNumber: next.memberNumber,
      yearOfEntry: next.yearOfEntry,
      ladderMemberships: normalizedLadderMemberships(
        next.ladderMemberships,
      ),
    })

    collections[plan.location.collectionKey][
      plan.location.collectionIndex
    ] = next

    if (before === after) unchangedCount += 1
    else updatedCount += 1
  })

  const currentLadders = Array.isArray(setup.ladders)
    ? setup.ladders.map((ladder) => ({ ...ladder }))
    : []

  const usedLadderIds = new Set(
    currentLadders
      .map((ladder) => sanitizeDirectoryId(ladder.id))
      .filter(Boolean),
  )

  let addedLadderCount = 0

  ;(Array.isArray(draft.ladders) ? draft.ladders : []).forEach(
    (input) => {
      const name = sanitizePlainText(input.name, 70)
      if (!name) return

      if (
        currentLadders.some(
          (ladder) =>
            String(ladder.name || '').toLowerCase() ===
            name.toLowerCase(),
        )
      ) {
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
    },
  )

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
    unchangedCount,
    addedLadderCount,
    reconciliation: reconciliation.summary,
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
