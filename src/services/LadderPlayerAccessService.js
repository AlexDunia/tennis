const STORAGE_KEY = 'gorra.ladder.playerAccess.v1'
const MAX_RECORDS = 100

function clean(value, max = 160) {
  return String(value ?? '').trim().slice(0, max)
}

function storage() {
  try {
    return typeof window !== 'undefined' && window.localStorage
      ? window.localStorage
      : null
  } catch {
    return null
  }
}

function isToken(value) {
  return /^gpa_[A-Za-z0-9_-]{24,128}$/.test(clean(value, 140))
}

function normalizeRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const token = clean(value.token, 140)
  const clubId = clean(value.clubId, 120)
  const ladderId = clean(value.ladderId, 120)
  const createdAt = clean(value.createdAt, 48)
  const rotatedAt = clean(value.rotatedAt, 48)
  if (!isToken(token) || !clubId || !ladderId || !createdAt) return null
  return { token, clubId, ladderId, createdAt, rotatedAt }
}

function readRecords() {
  const local = storage()
  if (!local) return []
  try {
    const parsed = JSON.parse(local.getItem(STORAGE_KEY) || '[]')
    const records = Array.isArray(parsed) ? parsed : parsed?.records
    return Array.isArray(records)
      ? records.map(normalizeRecord).filter(Boolean).slice(0, MAX_RECORDS)
      : []
  } catch {
    return []
  }
}

function writeRecords(records) {
  const local = storage()
  if (!local) return
  try {
    local.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)))
  } catch {
    // Local prototype storage is optional; callers still fail safely.
  }
}

function randomToken() {
  const bytes = new Uint8Array(24)
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }
  let token = ''
  bytes.forEach((byte) => {
    token += String.fromCharCode(byte)
  })
  const encoded = typeof btoa === 'function'
    ? btoa(token).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
    : Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `gpa_${encoded}`
}

function scope(input = {}) {
  return { clubId: clean(input.clubId, 120), ladderId: clean(input.ladderId, 120) }
}

function recordFor(input, rotatedAt = '') {
  const { clubId, ladderId } = scope(input)
  if (!clubId || !ladderId) return null
  const now = new Date().toISOString()
  return { token: randomToken(), clubId, ladderId, createdAt: now, rotatedAt: rotatedAt || '' }
}

export function getOrCreateLadderPlayerAccess(input = {}) {
  const requested = scope(input)
  if (!requested.clubId || !requested.ladderId) return null
  const records = readRecords()
  const existing = records.find((record) => record.clubId === requested.clubId && record.ladderId === requested.ladderId)
  if (existing) return { ...existing }
  const record = recordFor(requested)
  if (!record) return null
  writeRecords([record, ...records])
  return { ...record }
}

export function resolveLadderPlayerAccess(token) {
  const requested = clean(token, 140)
  if (!isToken(requested)) return null
  const record = readRecords().find((item) => item.token === requested)
  return record ? { ...record } : null
}

export function rotateLadderPlayerAccess(input = {}) {
  const requested = scope(input)
  if (!requested.clubId || !requested.ladderId) return null
  const records = readRecords().filter((record) => record.clubId !== requested.clubId || record.ladderId !== requested.ladderId)
  const now = new Date().toISOString()
  const record = recordFor(requested, now)
  if (!record) return null
  writeRecords([record, ...records])
  return { ...record }
}

export function clearLadderPlayerAccessTestState({ clubId = '' } = {}) {
  const requestedClubId = clean(clubId, 120)
  if (!requestedClubId) return 0
  const records = readRecords()
  const remaining = records.filter((record) => record.clubId !== requestedClubId)
  writeRecords(remaining)
  return records.length - remaining.length
}