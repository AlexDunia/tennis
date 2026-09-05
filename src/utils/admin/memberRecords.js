import { sanitizeDirectoryId } from './clubSetup.js'

export const MEMBER_RECORD_COLLECTIONS = Object.freeze([
  'manualMembers',
  'importedMembers',
  'roster',
])

function memberCollection(setup, collectionKey) {
  const value = setup?.membership?.[collectionKey]
  return Array.isArray(value) ? value : []
}

export function locateMemberRecord(setup, memberIdInput) {
  const memberId = sanitizeDirectoryId(memberIdInput)
  if (!memberId) {
    return {
      memberId: '',
      count: 0,
      match: null,
    }
  }

  const matches = []

  MEMBER_RECORD_COLLECTIONS.forEach((collectionKey) => {
    memberCollection(setup, collectionKey).forEach((member, index) => {
      if (sanitizeDirectoryId(member?.id) !== memberId) return

      matches.push({
        collectionKey,
        index,
        member,
      })
    })
  })

  return {
    memberId,
    count: matches.length,
    match: matches.length === 1 ? matches[0] : null,
  }
}

export function locateMemberRecordsByUserId(setup, userIdInput) {
  const userId = sanitizeDirectoryId(userIdInput)
  if (!userId) return []

  const matches = []

  MEMBER_RECORD_COLLECTIONS.forEach((collectionKey) => {
    memberCollection(setup, collectionKey).forEach((member, index) => {
      if (sanitizeDirectoryId(member?.userId) !== userId) return

      matches.push({
        collectionKey,
        index,
        member,
      })
    })
  })

  return matches
}

export function replaceMemberRecord(setup, location, update) {
  if (!location?.collectionKey || !Number.isInteger(location.index)) {
    return setup
  }

  const currentCollection = memberCollection(setup, location.collectionKey)
  const currentMember = currentCollection[location.index]

  if (!currentMember) return setup

  const nextMember =
    typeof update === 'function'
      ? update(currentMember)
      : {
          ...currentMember,
          ...(update || {}),
        }

  const nextCollection = [...currentCollection]
  nextCollection[location.index] = nextMember

  return {
    ...setup,
    membership: {
      ...setup.membership,
      [location.collectionKey]: nextCollection,
    },
  }
}
