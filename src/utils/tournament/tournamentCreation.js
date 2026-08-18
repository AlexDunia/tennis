import { sanitizePlainText } from '../formSafety.js'

export const TOURNAMENT_STEP_KEYS = Object.freeze(['details', 'where', 'events', 'review'])

export const PRESET_EVENTS = Object.freeze([
  {
    id: 'mens-singles',
    name: "Men's Singles",
    type: 'singles',
    group: 'Singles',
    entryRule: 'men',
  },
  {
    id: 'womens-singles',
    name: "Women's Singles",
    type: 'singles',
    group: 'Singles',
    entryRule: 'women',
  },
  {
    id: 'mens-doubles',
    name: "Men's Doubles",
    type: 'doubles',
    group: 'Doubles',
    entryRule: 'men',
  },
  {
    id: 'womens-doubles',
    name: "Women's Doubles",
    type: 'doubles',
    group: 'Doubles',
    entryRule: 'women',
  },
  {
    id: 'mixed-doubles',
    name: 'Mixed Doubles',
    type: 'doubles',
    group: 'Doubles',
    entryRule: 'mixed',
  },
])

export const FORMAT_OPTIONS = Object.freeze([
  { id: 'single', label: 'Knockout', description: "Lose once and you're out." },
  { id: 'roundrobin', label: 'Round robin', description: 'Everyone plays everyone.' },
  { id: 'rrplayoff', label: 'Groups + knockout', description: 'Groups first, then knockout.' },
])

export const SCORING_OPTIONS = Object.freeze([
  { id: 'best3', label: 'Best of 3 sets', hours: 1.5 },
  { id: 'matchtb', label: '2 sets + match tiebreak', hours: 1.2 },
  { id: 'oneset', label: 'One set', hours: 0.75 },
])

export const AGE_OPTIONS = Object.freeze(['Open', 'Under 18', '18+', '35+', '40+', '50+', '60+'])

export const LEVEL_OPTIONS = Object.freeze([
  'Open',
  'Beginner',
  'Intermediate',
  'Advanced',
  '3.0–3.5',
  '4.0–4.5',
  '4.5+',
])

export const DEFAULT_VENUE_HOURS = Object.freeze({ from: '06:00', to: '20:00' })

export function localISODate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayInTimeZone(timeZone = 'UTC', now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now)
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    return `${values.year}-${values.month}-${values.day}`
  } catch {
    return localISODate(now)
  }
}

export function addDays(iso, amount) {
  const [year, month, day] = String(iso).split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + amount)
  return localISODate(date)
}

export function datesBetween(start, end) {
  if (!start || !end || end < start) return []
  const dates = []
  let cursor = start
  while (cursor <= end && dates.length < 370) {
    dates.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return dates
}

export function formatDate(iso, options = {}) {
  if (!iso) return 'Select date'
  const [year, month, day] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    month: options.month || 'short',
    day: 'numeric',
    year: options.year === false ? undefined : 'numeric',
    weekday: options.weekday,
  }).format(new Date(year, month - 1, day))
}

export function shortDateRange(start, end) {
  if (!start || !end) return ''
  if (start === end) return formatDate(start)
  const first = new Date(`${start}T00:00:00`)
  const last = new Date(`${end}T00:00:00`)
  if (first.getFullYear() === last.getFullYear() && first.getMonth() === last.getMonth()) {
    const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(first)
    return `${month} ${first.getDate()}–${last.getDate()}, ${first.getFullYear()}`
  }
  return `${formatDate(start)} – ${formatDate(end)}`
}

export function weekdayLabel(iso, length = 'short') {
  return new Intl.DateTimeFormat('en-US', { weekday: length }).format(new Date(`${iso}T00:00:00`))
}

export function minutes(value) {
  if (!value) return 0
  const [hours, mins] = String(value).split(':').map(Number)
  return hours * 60 + mins
}

export function timeFromMinutes(total) {
  const hours = Math.floor(total / 60)
  const mins = total % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

export function formatTime(value) {
  if (!value) return ''
  const [hours, mins] = value.split(':').map(Number)
  const date = new Date(2000, 0, 1, hours, mins)
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)
}

export function overlaps(start, end, otherStart, otherEnd) {
  return minutes(start) < minutes(otherEnd) && minutes(otherStart) < minutes(end)
}

export function slugify(value, fallback = 'item') {
  return (
    String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || fallback
  )
}

function normalizeHoursByWeekday(input = {}) {
  return Object.fromEntries(
    Array.from({ length: 7 }, (_, weekday) => {
      const source = input[weekday] || input[String(weekday)] || DEFAULT_VENUE_HOURS
      return [weekday, { from: source.from || '06:00', to: source.to || '20:00' }]
    }),
  )
}

function bookingTimes(booking) {
  const start =
    booking.from || booking.start || timeFromMinutes(Number(booking.startHour || 0) * 60)
  const durationMinutes = Number(booking.durationMinutes || Number(booking.duration || 1) * 60)
  const end = booking.to || booking.end || timeFromMinutes(minutes(start) + durationMinutes)
  return { from: start, to: end }
}

export function buildClubVenues(activeClub, bookings = []) {
  if (!activeClub?.id) return []
  const workspace = activeClub.setup?.workspace || {}
  const rawVenues = Array.isArray(workspace.venues) ? workspace.venues : []
  const fallbackCourts = Array.isArray(workspace.courts) ? workspace.courts : []
  const venueInputs = rawVenues.length
    ? rawVenues
    : [
        {
          id: `${activeClub.id}-primary-venue`,
          name: workspace.location || activeClub.name,
          courts: fallbackCourts,
          hoursByWeekday: workspace.venueHoursByWeekday,
        },
      ]

  return venueInputs
    .map((venue, venueIndex) => {
      const venueId = String(venue.id || `${activeClub.id}-venue-${venueIndex + 1}`)
      const courtInputs = Array.isArray(venue.courts) ? venue.courts : fallbackCourts
      const courts = courtInputs
        .map((court, courtIndex) => {
          const name = sanitizePlainText(typeof court === 'string' ? court : court?.name, 60)
          if (!name) return null
          return {
            id: String(
              typeof court === 'object' && court?.id
                ? court.id
                : `${venueId}-court-${slugify(name, courtIndex + 1)}`,
            ),
            name,
          }
        })
        .filter(Boolean)
      const firstCourtId = courts[0]?.id || ''
      const courtNameToId = new Map(courts.map((court) => [court.name.toLowerCase(), court.id]))
      const normalizedBookings = bookings
        .filter((booking) => !booking.clubId || booking.clubId === activeClub.id)
        .map((booking) => {
          const courtId =
            booking.courtId ||
            courtNameToId.get(String(booking.court || '').toLowerCase()) ||
            firstCourtId
          const times = bookingTimes(booking)
          return {
            id: String(booking.id || `booking-${booking.date}-${times.from}`),
            venueId,
            courtId,
            date: booking.date,
            from: times.from,
            to: times.to,
            label: sanitizePlainText(
              booking.description || booking.label || 'Existing booking',
              80,
            ),
          }
        })
        .filter((booking) => booking.courtId && booking.date && booking.from && booking.to)
      return {
        id: venueId,
        clubId: activeClub.id,
        name: sanitizePlainText(venue.name || activeClub.name, 100),
        timezone: venue.timezone || workspace.timezone || 'Africa/Lagos',
        hoursByWeekday: normalizeHoursByWeekday(venue.hoursByWeekday),
        courts,
        bookings: normalizedBookings,
      }
    })
    .filter((venue) => venue.courts.length)
}

export function venueHoursForDate(venue, iso) {
  if (!venue || !iso) return null
  const day = new Date(`${iso}T00:00:00`).getDay()
  return venue.hoursByWeekday?.[day] || DEFAULT_VENUE_HOURS
}

export function commonVenueWindow(venue, dates) {
  if (!venue || !dates.length) return null
  let from = null
  let to = null
  for (const date of dates) {
    const hours = venueHoursForDate(venue, date)
    if (!hours) continue
    if (from === null || minutes(hours.from) > minutes(from)) from = hours.from
    if (to === null || minutes(hours.to) < minutes(to)) to = hours.to
  }
  return from && to && minutes(from) < minutes(to) ? { from, to } : null
}

export function windowForDate(place, date) {
  if (place.customByDay && place.dayHours?.[date]) return place.dayHours[date]
  return { from: place.from, to: place.to }
}

export function validateDateRules(details, today) {
  const errors = {}
  const name = sanitizePlainText(details.name, 120)
  if (!name) errors.name = 'Enter a tournament name.'
  if (!details.start || details.start < today) errors.start = 'Choose today or a future date.'
  if (!details.end || details.end < details.start) {
    errors.end = "End date can't be before the start date."
  }
  if (
    !details.signupOpen ||
    details.signupOpen < today ||
    (details.start && details.signupOpen > details.start)
  ) {
    errors.signupOpen = 'Choose today or a future date no later than the tournament start.'
  }
  if (
    !details.signupClose ||
    details.signupClose < details.signupOpen ||
    (details.start && details.signupClose > details.start)
  ) {
    errors.signupClose =
      'Sign-up closes must be on or after sign-up opens and no later than the tournament start.'
  }
  return { valid: Object.keys(errors).length === 0, errors }
}

export function validateTournamentHours(place, venue, dates) {
  if (!place.from || !place.to || minutes(place.from) >= minutes(place.to)) {
    return {
      valid: false,
      type: 'invalid-range',
      title: 'Check your times.',
      copy: 'Your finish time needs to be after your start time.',
      affected: [],
      common: null,
    }
  }
  const affected = dates
    .map((date) => {
      const selected = windowForDate(place, date)
      const venueHours = venueHoursForDate(venue, date)
      const invalid =
        !selected?.from ||
        !selected?.to ||
        minutes(selected.from) >= minutes(selected.to) ||
        minutes(selected.from) < minutes(venueHours.from) ||
        minutes(selected.to) > minutes(venueHours.to)
      return invalid ? { date, venue: venueHours } : null
    })
    .filter(Boolean)
  if (!affected.length)
    return { valid: true, affected: [], common: commonVenueWindow(venue, dates) }
  const common = commonVenueWindow(venue, dates)
  if (!place.customByDay && common) {
    const dayNames = affected.map(({ date }) => weekdayLabel(date, 'long')).join(', ')
    return {
      valid: false,
      type: 'different-hours',
      title: `${dayNames} use different venue hours.`,
      copy: `${formatTime(common.from)}–${formatTime(common.to)} works on every tournament day.`,
      affected,
      common,
    }
  }
  const first = affected[0]
  return {
    valid: false,
    type: 'day-invalid',
    title: `Check ${weekdayLabel(first.date, 'long')}.`,
    copy: `The venue is open ${formatTime(first.venue.from)}–${formatTime(first.venue.to)} that day.`,
    affected,
    common,
  }
}

export function bookingsForCourt(venue, courtId, date) {
  return (venue?.bookings || []).filter(
    (booking) => booking.courtId === courtId && booking.date === date,
  )
}

export function relevantBookings(place, venue, courtId, date) {
  const window = windowForDate(place, date)
  return bookingsForCourt(venue, courtId, date).filter((booking) =>
    overlaps(window.from, window.to, booking.from, booking.to),
  )
}

export function firstCourtConflict(place, venue, courtId, dates) {
  for (const date of dates) {
    const booking = relevantBookings(place, venue, courtId, date)[0]
    if (booking) return { date, booking }
  }
  return null
}

export function courtRule(place, courtId, date) {
  return place.courtRules?.[courtId]?.[date] || null
}

export function firstCourtRule(place, courtId) {
  const entry = Object.entries(place.courtRules?.[courtId] || {})[0]
  return entry ? { date: entry[0], ...entry[1] } : null
}

export function nextFreeCourtTime(place, venue, courtId, date) {
  const window = windowForDate(place, date)
  const bookings = relevantBookings(place, venue, courtId, date).sort(
    (left, right) => minutes(left.from) - minutes(right.from),
  )
  let candidate = window.from
  for (const booking of bookings) {
    if (minutes(candidate) >= minutes(booking.from) && minutes(candidate) < minutes(booking.to)) {
      candidate = booking.to
    }
  }
  return minutes(candidate) < minutes(window.to) ? candidate : window.from
}

export function isCourtStartAvailable(place, venue, courtId, date, time) {
  const window = windowForDate(place, date)
  const venueHours = venueHoursForDate(venue, date)
  if (!time || minutes(time) < minutes(window.from) || minutes(time) >= minutes(window.to)) {
    return false
  }
  if (minutes(time) < minutes(venueHours.from) || minutes(time) >= minutes(venueHours.to)) {
    return false
  }
  return !bookingsForCourt(venue, courtId, date).some(
    (booking) => minutes(time) >= minutes(booking.from) && minutes(time) < minutes(booking.to),
  )
}

export function totalTournamentCourtHours(place, venue, dates) {
  let totalMinutes = 0
  for (const date of dates) {
    const window = windowForDate(place, date)
    for (const courtId of place.selectedCourtIds || []) {
      const rule = courtRule(place, courtId, date)
      const start = rule && minutes(rule.from) > minutes(window.from) ? rule.from : window.from
      const end = window.to
      if (minutes(start) >= minutes(end)) continue
      const intervals = bookingsForCourt(venue, courtId, date)
        .map((booking) => ({
          from: Math.max(minutes(start), minutes(booking.from)),
          to: Math.min(minutes(end), minutes(booking.to)),
        }))
        .filter((booking) => booking.from < booking.to)
        .sort((left, right) => left.from - right.from)
      let blocked = 0
      let current = null
      for (const interval of intervals) {
        if (!current) current = { ...interval }
        else if (interval.from <= current.to) current.to = Math.max(current.to, interval.to)
        else {
          blocked += current.to - current.from
          current = { ...interval }
        }
      }
      if (current) blocked += current.to - current.from
      totalMinutes += Math.max(0, minutes(end) - minutes(start) - blocked)
    }
  }
  return totalMinutes / 60
}

export function recommendedSeedingSource({ hasClubLadder, supportsPlayerRatings }) {
  if (hasClubLadder) return 'ladder'
  if (supportsPlayerRatings) return 'rating'
  return 'manual'
}

export function createDefaultEvent(type = 'singles', capabilities = {}) {
  return {
    type,
    capacity: 16,
    format: 'single',
    scoring: 'best3',
    seeding: recommendedSeedingSource(capabilities),
    age: 'Open',
    ability: 'Open',
    entryRule: 'everyone',
  }
}

export function isPowerOfTwo(value) {
  const number = Number(value)
  return number >= 2 && (number & (number - 1)) === 0
}

export function nextPowerOfTwo(value) {
  let power = 2
  while (power < Number(value)) power *= 2
  return power
}

export function roundRobinMatches(value) {
  const number = Number(value)
  return (number * (number - 1)) / 2
}

export function recommendedGroups(value) {
  const number = Number(value)
  if (number < 6) {
    return {
      groups: 1,
      sizes: [number],
      qualifiers: 0,
      matches: roundRobinMatches(number),
      valid: false,
    }
  }
  let best = null
  const maxGroups = Math.max(2, Math.floor(number / 3))
  for (let groups = 2; groups <= maxGroups; groups += 1) {
    const base = Math.floor(number / groups)
    const extra = number % groups
    const sizes = Array.from({ length: groups }, (_, index) => base + (index < extra ? 1 : 0))
    if (Math.min(...sizes) < 3 || Math.max(...sizes) > 5) continue
    const groupMatches = sizes.reduce((sum, size) => sum + roundRobinMatches(size), 0)
    const qualifiers = groups * 2
    const knockoutMatches = Math.max(0, qualifiers - 1)
    const deviation = sizes.reduce((sum, size) => sum + Math.abs(4 - size), 0)
    const score =
      deviation * 10 + (isPowerOfTwo(qualifiers) ? 0 : 3) + (groupMatches + knockoutMatches) / 100
    if (!best || score < best.score) {
      best = {
        score,
        groups,
        sizes,
        qualifiers,
        matches: groupMatches + knockoutMatches,
        valid: true,
      }
    }
  }
  if (best) return best
  const groups = Math.max(2, Math.round(number / 4))
  const base = Math.floor(number / groups)
  const extra = number % groups
  const sizes = Array.from({ length: groups }, (_, index) => base + (index < extra ? 1 : 0))
  const qualifiers = groups * 2
  return {
    groups,
    sizes,
    qualifiers,
    matches:
      sizes.reduce((sum, size) => sum + roundRobinMatches(size), 0) + Math.max(0, qualifiers - 1),
    valid: true,
  }
}

export function matchCount(event) {
  const capacity = Math.max(2, Number(event.capacity) || 2)
  if (event.format === 'single') return capacity - 1
  if (event.format === 'roundrobin') return roundRobinMatches(capacity)
  return recommendedGroups(capacity).matches
}

export function matchHours(scoring) {
  return SCORING_OPTIONS.find((option) => option.id === scoring)?.hours || 0.75
}

export function eventHours(event) {
  return matchCount(event) * matchHours(event.scoring)
}

export function formatLabel(format) {
  return FORMAT_OPTIONS.find((option) => option.id === format)?.label || 'Groups + knockout'
}

export function scoringLabel(scoring) {
  return SCORING_OPTIONS.find((option) => option.id === scoring)?.label || 'One set'
}

export function seedingLabel(seeding) {
  return (
    {
      ladder: 'Club ladder',
      rating: 'Player rating',
      manual: 'Choose later',
      none: 'No seeding',
    }[seeding] || 'Choose later'
  )
}

export function unitForType(type) {
  return type === 'singles' ? 'players' : 'teams'
}

export function eventEligibilityText(event) {
  const labels = { men: 'Men', women: 'Women', mixed: 'Mixed pairs' }
  const parts = []
  if (event.entryRule && !['preset', 'everyone'].includes(event.entryRule)) {
    parts.push(labels[event.entryRule])
  }
  if (event.age !== 'Open') parts.push(event.age)
  if (event.ability !== 'Open') parts.push(event.ability)
  return parts.filter(Boolean).join(' · ') || 'All ages · All levels'
}

export function registrationFieldsForEvent(event) {
  const fields = ['Name', 'Contact', 'Event']
  if (event.type === 'doubles') fields.push('Partner')
  if (event.age !== 'Open') fields.push('Age / date of birth')
  if (event.ability !== 'Open') fields.push('Playing level')
  if (event.format !== 'roundrobin') {
    if (event.seeding === 'rating') fields.push("Tennis rating, if Gorra doesn't already have it")
    else if (event.seeding === 'ladder') fields.push('Club identity, so Gorra can match the ladder')
    else if (event.seeding === 'manual')
      fields.push('No seed question — admin reviews players later')
  }
  return fields
}

export function validateCreationState(state, context) {
  const dateValidation = validateDateRules(state.details, context.today)
  const dates = datesBetween(state.details.start, state.details.end)
  const venue = context.venues.find((item) => item.id === state.place.venueId)
  const errors = { ...dateValidation.errors }
  if (!venue || venue.clubId !== context.clubId)
    errors.venue = 'Choose a venue from the active club.'
  const selected = new Set(state.place.selectedCourtIds || [])
  if (!selected.size) errors.courts = 'Choose at least one court.'
  if (
    venue &&
    [...selected].some((courtId) => !venue.courts.some((court) => court.id === courtId))
  ) {
    errors.courts = 'One or more selected courts no longer belong to this venue.'
  }
  if (venue) {
    for (const courtId of selected) {
      for (const [date, rule] of Object.entries(state.place.courtRules?.[courtId] || {})) {
        if (
          !dates.includes(date) ||
          !isCourtStartAvailable(state.place, venue, courtId, date, rule.from)
        ) {
          errors.courts =
            'A court-specific start time is no longer available. Review the selected court.'
          break
        }
      }
      if (errors.courts) break
    }
  }
  const hours = venue ? validateTournamentHours(state.place, venue, dates) : { valid: false }
  if (!hours.valid) errors.hours = hours.copy || 'Check the tournament hours.'
  if (!state.events.length) errors.events = 'Add at least one event.'
  const validFormats = new Set(FORMAT_OPTIONS.map((option) => option.id))
  const validScoring = new Set(SCORING_OPTIONS.map((option) => option.id))
  const validSeeding = new Set(['ladder', 'rating', 'manual', 'none'])
  const validEntryRules = new Set(['everyone', 'men', 'women', 'mixed'])
  const invalidEvent = state.events.find((event) => {
    const capacity = Number(event.capacity)
    return (
      !sanitizePlainText(event.name, 80) ||
      !['singles', 'doubles'].includes(event.type) ||
      !Number.isInteger(capacity) ||
      capacity < 2 ||
      capacity > 128 ||
      !validFormats.has(event.format) ||
      !validScoring.has(event.scoring) ||
      !validSeeding.has(event.seeding) ||
      !AGE_OPTIONS.includes(event.age) ||
      !LEVEL_OPTIONS.includes(event.ability) ||
      !validEntryRules.has(event.entryRule) ||
      (event.type === 'singles' && event.entryRule === 'mixed')
    )
  })
  if (invalidEvent) errors.events = 'One or more events contains an invalid option or capacity.'
  return { valid: Object.keys(errors).length === 0, errors, venue, dates, hours }
}

export function buildCreationPayload(state, context) {
  const validation = validateCreationState(state, context)
  if (!validation.valid) {
    const error = new Error(Object.values(validation.errors)[0] || 'Check the tournament setup.')
    error.details = validation.errors
    throw error
  }
  const timestamp = Date.now()
  const tournamentId = `${slugify(state.details.name, 'tournament')}-${timestamp}`
  const venue = validation.venue
  const selectedCourtIds = [...state.place.selectedCourtIds]
  const events = state.events.map((event, index) => {
    const eventId = event.id || `event-${index + 1}`
    const groupPlan = event.format === 'rrplayoff' ? recommendedGroups(event.capacity) : null
    return {
      id: eventId,
      tournamentId,
      name: sanitizePlainText(event.name, 80),
      description: `${formatLabel(event.format)} · ${event.capacity} ${unitForType(event.type)} max`,
      status: 'waiting',
      source: event.custom ? 'custom' : 'preset',
      players: [],
      groups: [],
      knockout: {
        quarterFinals: [],
        semiFinals: [],
        final: null,
        championId: null,
        championName: null,
      },
      settings: {
        schemaVersion: 2,
        registrationStage: true,
        playingType: event.type,
        entryRule: event.entryRule,
        age: event.age,
        ability: event.ability,
        maxEntrants: Number(event.capacity),
        entrantUnit: unitForType(event.type),
        format: event.format,
        formatName: formatLabel(event.format),
        scoring: event.scoring,
        scoringName: scoringLabel(event.scoring),
        seedingPolicy: event.format === 'roundrobin' ? 'none-required' : event.seeding,
        estimatedMatches: matchCount(event),
        estimatedMatchHours: eventHours(event),
        groupPlan,
        actualDrawCreated: false,
      },
    }
  })
  const registrationRequirements = events.map((event) => ({
    eventId: event.id,
    fields: registrationFieldsForEvent({
      type: event.settings.playingType,
      age: event.settings.age,
      ability: event.settings.ability,
      format: event.settings.format,
      seeding: event.settings.seedingPolicy,
    }),
  }))
  return {
    id: tournamentId,
    schemaVersion: 2,
    clubId: context.clubId,
    createdBy: context.userId,
    name: sanitizePlainText(state.details.name, 120),
    description: `Registration ${formatDate(state.details.signupOpen)} – ${formatDate(state.details.signupClose)}.`,
    status: 'upcoming',
    startDate: state.details.start,
    endDate: state.details.end,
    signupOpen: state.details.signupOpen,
    signupClose: state.details.signupClose,
    signupCloseTime: '23:59',
    timezone: venue.timezone,
    roundRobinStart: state.details.start,
    roundRobinEnd: state.details.end,
    knockoutStart: state.details.start,
    finalDate: state.details.end,
    officials: [],
    venue: {
      id: venue.id,
      name: venue.name,
      timezone: venue.timezone,
    },
    courtIntent: {
      reservesCourts: false,
      selectedCourtIds,
      windowsByDate: Object.fromEntries(
        validation.dates.map((date) => [date, { ...windowForDate(state.place, date) }]),
      ),
      courtRules: structuredClone(state.place.courtRules || {}),
      availabilityCheckedAt: new Date().toISOString(),
    },
    categories: events,
    events,
    registrationRequirements,
    rules: {
      drawCreated: false,
      registrationStage: true,
      scoringIsPerEvent: true,
    },
  }
}

export function createInitialCreationState({ today, capabilities = {} }) {
  const start = addDays(today, 20)
  return {
    version: 2,
    currentStep: 'details',
    highestStep: 1,
    details: {
      name: '',
      start,
      end: addDays(start, 1),
      signupOpen: today,
      signupClose: today,
      touched: { end: false, signupOpen: false, signupClose: false },
    },
    place: {
      venueId: '',
      from: '10:00',
      to: '17:00',
      customByDay: false,
      dayHours: {},
      selectedCourtIds: [],
      courtRules: {},
    },
    events: [],
    capabilities,
  }
}
