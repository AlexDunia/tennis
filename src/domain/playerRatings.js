export const PLAYER_RATING_SYSTEMS = Object.freeze({
  ntrp: Object.freeze({
    id: 'ntrp',
    acronym: 'NTRP',
    name: 'National Tennis Rating Program',
    description:
      'A familiar U.S. tennis rating system using levels such as 3.0, 3.5 and 4.0.',
    minimum: 1.5,
    maximum: 7,
    step: 0.5,
    precision: 1,
    direction: 'higher-stronger',
  }),
  utr: Object.freeze({
    id: 'utr',
    acronym: 'UTR',
    name: 'Universal Tennis Rating',
    description:
      'A global performance rating based on match results and opponent strength.',
    minimum: 1,
    maximum: 16.5,
    step: 0.01,
    precision: 2,
    direction: 'higher-stronger',
  }),
  wtn: Object.freeze({
    id: 'wtn',
    acronym: 'WTN',
    name: 'World Tennis Number',
    description:
      'An international tennis number from 40 toward 1, where lower numbers represent stronger players.',
    minimum: 1,
    maximum: 40,
    step: 0.1,
    precision: 1,
    direction: 'lower-stronger',
  }),
})

const RATING_SOURCES = new Set([
  'admin',
  'admin-import',
  'external',
  'system',
  'legacy',
])

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
}

function safeTimestamp(value) {
  if (typeof value !== 'string' || value.length > 40) return ''
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : ''
}

export function playerRatingSystem(value) {
  const key = String(value || '').trim().toLowerCase()
  return PLAYER_RATING_SYSTEMS[key] || null
}

export function normalizePlayerRatingValue(systemInput, value) {
  const system = playerRatingSystem(systemInput)
  if (!system) return null

  const number = Number(value)
  if (!Number.isFinite(number)) return null
  if (number < system.minimum || number > system.maximum) return null

  if (system.id === 'ntrp') {
    const units = Math.round((number - system.minimum) / system.step)
    const snapped = system.minimum + units * system.step
    if (Math.abs(snapped - number) > 0.000001) return null
  }

  return Number(number.toFixed(system.precision))
}

export function playerRatingOptions(systemInput) {
  const system = playerRatingSystem(systemInput)
  if (!system || system.id !== 'ntrp') return []

  const values = []

  for (
    let value = system.minimum;
    value <= system.maximum + 0.000001;
    value += system.step
  ) {
    values.push(Number(value.toFixed(system.precision)))
  }

  return values
}

export function playerRatingValueLabel(systemInput, value) {
  const system = playerRatingSystem(systemInput)
  const normalized = normalizePlayerRatingValue(systemInput, value)

  if (!system || normalized === null) return ''

  return normalized.toFixed(system.precision)
}

export function normalizeMemberRatings(input = {}) {
  const source = asObject(input)
  const result = {}

  Object.keys(PLAYER_RATING_SYSTEMS).forEach((systemId) => {
    const raw = source[systemId]
    const record = asObject(raw)

    const candidate =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? record.value
        : raw

    const value = normalizePlayerRatingValue(systemId, candidate)
    if (value === null) return

    result[systemId] = {
      value,
      source: RATING_SOURCES.has(record.source)
        ? record.source
        : 'legacy',
      verified: record.verified === true,
      updatedAt: safeTimestamp(record.updatedAt),
    }
  })

  return result
}

export function memberRatingValue(profileInput = {}, systemInput) {
  const profile = asObject(profileInput)
  const system = playerRatingSystem(systemInput)

  if (!system) return null

  const ratings = normalizeMemberRatings(profile.ratings)

  if (ratings[system.id]) {
    return ratings[system.id].value
  }

  return normalizePlayerRatingValue(system.id, profile[system.id])
}

export function withMemberRating(
  ratingsInput,
  systemInput,
  valueInput,
  {
    source = 'admin',
    verified = false,
    updatedAt = '',
  } = {},
) {
  const system = playerRatingSystem(systemInput)
  const value = normalizePlayerRatingValue(systemInput, valueInput)
  const current = normalizeMemberRatings(ratingsInput)

  if (!system || value === null) return current

  return {
    ...current,
    [system.id]: {
      value,
      source: RATING_SOURCES.has(source) ? source : 'admin',
      verified: verified === true,
      updatedAt: safeTimestamp(updatedAt),
    },
  }
}
