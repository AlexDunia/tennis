import { removeUnsafeControlCharacters, sanitizePlainText } from '../formSafety'

const INVITATION_TOKEN = /^[a-zA-Z0-9_-]{24,128}$/
const CLUB_CODE = /^GORRA-[A-Z0-9]{4,12}$/
const ALLOWED_QR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_QR_FILE_BYTES = 5 * 1024 * 1024

export const CLUB_DIRECTORY = Object.freeze([
  {
    id: 'greenview-tennis-club',
    name: 'Greenview Tennis Club',
    location: 'Ibadan, Oyo State',
    members: 84,
    ladders: ['Open Singles', "Women's Singles", 'Mixed Doubles'],
    access: 'open',
  },
  {
    id: 'renaissance-africa-tennis-club',
    name: 'Renaissance Africa Tennis Club',
    location: 'Port Harcourt, Rivers State',
    members: 126,
    ladders: ['Open Singles', "Men's Doubles"],
    access: 'approval',
  },
  {
    id: 'ibadan-racquet-club',
    name: 'Ibadan Racquet Club',
    location: 'Jericho, Ibadan',
    members: 58,
    ladders: ['Open Singles', 'Mixed Doubles'],
    access: 'open',
  },
])

function safeInviteValue(value) {
  return removeUnsafeControlCharacters(value).trim().slice(0, 2048)
}

function tokenFromUrl(url) {
  const directToken = url.searchParams.get('invite')
  if (directToken) return directToken

  const hashQuery = url.hash.includes('?') ? url.hash.slice(url.hash.indexOf('?') + 1) : ''
  return new URLSearchParams(hashQuery).get('invite') || ''
}

export function validateInvitationInput(value, expectedOrigin = window.location.origin) {
  const input = safeInviteValue(value)
  if (!input) return { valid: false, message: 'Enter the invitation you received.' }

  const upperCode = input.toUpperCase()
  if (CLUB_CODE.test(upperCode)) return { valid: true, kind: 'code', token: upperCode }
  if (INVITATION_TOKEN.test(input)) return { valid: true, kind: 'token', token: input }

  try {
    const url = new URL(input)
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, message: 'Use a secure Gorra invitation link.' }
    }
    if (expectedOrigin && url.origin !== expectedOrigin) {
      return { valid: false, message: 'This invitation is not from this Gorra workspace.' }
    }
    const token = tokenFromUrl(url)
    if (!INVITATION_TOKEN.test(token)) {
      return { valid: false, message: 'This invitation link is incomplete or has expired.' }
    }
    return { valid: true, kind: 'link', token }
  } catch {
    return { valid: false, message: 'Check the invitation and try again.' }
  }
}

export function validateQrImage(file) {
  if (!file) return { valid: false, message: 'Choose a QR code image.' }
  if (!ALLOWED_QR_TYPES.has(file.type)) {
    return { valid: false, message: 'Use a PNG, JPG, or WebP image.' }
  }
  if (file.size > MAX_QR_FILE_BYTES) {
    return { valid: false, message: 'Choose an image smaller than 5 MB.' }
  }
  return { valid: true, safeName: sanitizePlainText(file.name, 120) || 'QR code image' }
}

export function searchClubDirectory(value) {
  const query = sanitizePlainText(value, 80).toLocaleLowerCase()
  if (query.length < 2) return []
  return CLUB_DIRECTORY.filter((club) =>
    `${club.name} ${club.location}`.toLocaleLowerCase().includes(query),
  ).slice(0, 5)
}

export function clubNameFromSlug(value) {
  return sanitizePlainText(String(value || '').replace(/-/g, ' '), 100)
}
