import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCreationPayload,
  commonVenueWindow,
  createDefaultEvent,
  createInitialCreationState,
  datesBetween,
  eventHours,
  isCourtStartAvailable,
  matchCount,
  nextFreeCourtTime,
  nextPowerOfTwo,
  recommendedGroups,
  recommendedSeedingSource,
  registrationFieldsForEvent,
  roundRobinMatches,
  totalTournamentCourtHours,
  validateCreationState,
  validateDateRules,
  validateTournamentHours,
} from '../src/utils/tournament/tournamentCreation.js'
import { applyTournamentSetup } from '../src/services/TournamentSetupService.js'

const today = '2026-08-17'

function venue(overrides = {}) {
  return {
    id: 'venue-1',
    clubId: 'club-1',
    name: 'Club venue',
    timezone: 'Africa/Lagos',
    courts: [
      { id: 'court-1', name: 'Centre Court' },
      { id: 'court-2', name: 'Court Two' },
    ],
    hoursByWeekday: Object.fromEntries(
      Array.from({ length: 7 }, (_, day) => [day, { from: '09:00', to: '20:00' }]),
    ),
    bookings: [],
    ...overrides,
  }
}

function completeState() {
  const state = createInitialCreationState({ today })
  state.details = {
    ...state.details,
    name: 'Club Championship',
    start: '2026-09-05',
    end: '2026-09-06',
    signupOpen: '2026-08-18',
    signupClose: '2026-09-04',
  }
  state.place.venueId = 'venue-1'
  state.place.selectedCourtIds = ['court-1', 'court-2']
  state.events = [
    {
      id: 'mens-singles',
      name: "Men's Singles",
      custom: false,
      ...createDefaultEvent('singles', { hasClubLadder: true }),
      entryRule: 'men',
    },
  ]
  return state
}

test('date rules enforce every tournament and registration dependency', () => {
  assert.equal(
    validateDateRules({ ...completeState().details, start: '2026-08-16' }, today).valid,
    false,
  )
  assert.ok(validateDateRules({ ...completeState().details, end: '2026-09-04' }, today).errors.end)
  assert.ok(
    validateDateRules({ ...completeState().details, signupOpen: '2026-09-06' }, today).errors
      .signupOpen,
  )
  assert.ok(
    validateDateRules(
      { ...completeState().details, signupOpen: '2026-08-20', signupClose: '2026-08-19' },
      today,
    ).errors.signupClose,
  )
  assert.ok(
    validateDateRules({ ...completeState().details, signupClose: '2026-09-06' }, today).errors
      .signupClose,
  )
  assert.equal(validateDateRules(completeState().details, today).valid, true)
})

test('venue hours stay quiet when uniform and recommend a common shorter window when needed', () => {
  const place = completeState().place
  const dates = datesBetween('2026-09-05', '2026-09-06')
  const uniform = venue()
  assert.equal(validateTournamentHours(place, uniform, dates).valid, true)

  place.from = '09:00'
  place.to = '20:00'
  const shorterSunday = venue()
  shorterSunday.hoursByWeekday[0] = { from: '10:00', to: '17:00' }
  const result = validateTournamentHours(place, shorterSunday, dates)
  assert.equal(result.valid, false)
  assert.deepEqual(result.common, { from: '10:00', to: '17:00' })
  assert.deepEqual(commonVenueWindow(shorterSunday, dates), { from: '10:00', to: '17:00' })

  place.customByDay = true
  place.dayHours = {
    '2026-09-05': { from: '10:00', to: '17:00' },
    '2026-09-06': { from: '10:00', to: '17:00' },
  }
  assert.equal(validateTournamentHours(place, shorterSunday, dates).valid, true)
})

test('court availability exposes conflicts, next-free time, capacity, and venue membership', () => {
  const state = completeState()
  const activeVenue = venue({
    bookings: [
      {
        id: 'booking-1',
        venueId: 'venue-1',
        courtId: 'court-1',
        date: '2026-09-05',
        from: '13:00',
        to: '15:00',
      },
    ],
  })
  assert.equal(nextFreeCourtTime(state.place, activeVenue, 'court-1', '2026-09-05'), '10:00')
  assert.equal(
    isCourtStartAvailable(state.place, activeVenue, 'court-1', '2026-09-05', '13:30'),
    false,
  )
  assert.equal(
    isCourtStartAvailable(state.place, activeVenue, 'court-1', '2026-09-05', '15:00'),
    true,
  )
  assert.equal(totalTournamentCourtHours(state.place, activeVenue, ['2026-09-05']), 12)

  state.place.selectedCourtIds = []
  assert.ok(
    validateCreationState(state, {
      today,
      clubId: 'club-1',
      userId: 'admin-1',
      venues: [activeVenue],
    }).errors.courts,
  )
  state.place.selectedCourtIds = ['other-venue-court']
  assert.match(
    validateCreationState(state, {
      today,
      clubId: 'club-1',
      userId: 'admin-1',
      venues: [activeVenue],
    }).errors.courts,
    /no longer belong/,
  )
})

test('knockout uses actual n minus one matches and power-of-two bye previews', () => {
  for (const [players, matches] of [
    [8, 7],
    [16, 15],
    [20, 19],
  ]) {
    assert.equal(matchCount({ capacity: players, format: 'single' }), matches)
  }
  assert.equal(nextPowerOfTwo(20), 32)
  assert.equal(nextPowerOfTwo(20) - 20, 12)
  assert.equal(nextPowerOfTwo(13), 16)
  assert.equal(nextPowerOfTwo(13) - 13, 3)
})

test('round robin match counts are exact', () => {
  assert.equal(roundRobinMatches(4), 6)
  assert.equal(roundRobinMatches(6), 15)
  assert.equal(roundRobinMatches(16), 120)
})

test('groups plus knockout balances sensible fields and leaves small-field choice intact', () => {
  const plan = recommendedGroups(16)
  assert.equal(plan.valid, true)
  assert.equal(Math.max(...plan.sizes) - Math.min(...plan.sizes) <= 1, true)
  assert.equal(plan.qualifiers, plan.groups * 2)
  assert.ok(plan.matches > 0)

  const small = recommendedGroups(5)
  assert.equal(small.valid, false)
  assert.equal(matchCount({ capacity: 5, format: 'rrplayoff' }), small.matches)
})

test('scoring changes estimated duration without changing competition matches', () => {
  const base = { capacity: 16, format: 'single', type: 'singles' }
  const matchTotal = matchCount({ ...base, scoring: 'best3' })
  assert.equal(matchCount({ ...base, scoring: 'oneset' }), matchTotal)
  assert.ok(eventHours({ ...base, scoring: 'best3' }) > eventHours({ ...base, scoring: 'oneset' }))
})

test('seeding recommendation follows real capability priority', () => {
  assert.equal(
    recommendedSeedingSource({ hasClubLadder: true, supportsPlayerRatings: true }),
    'ladder',
  )
  assert.equal(
    recommendedSeedingSource({ hasClubLadder: false, supportsPlayerRatings: true }),
    'rating',
  )
  assert.equal(
    recommendedSeedingSource({ hasClubLadder: false, supportsPlayerRatings: false }),
    'manual',
  )
})

test('registration fields derive doubles, age, level, and seeding requirements', () => {
  const event = {
    type: 'doubles',
    age: '40+',
    ability: 'Advanced',
    format: 'single',
    seeding: 'rating',
  }
  const fields = registrationFieldsForEvent(event)
  assert.ok(fields.includes('Partner'))
  assert.ok(fields.includes('Age / date of birth'))
  assert.ok(fields.includes('Playing level'))
  assert.ok(fields.some((field) => field.startsWith('Tennis rating')))
  assert.equal(
    registrationFieldsForEvent({ ...event, format: 'roundrobin' }).some((field) =>
      field.includes('seed'),
    ),
    false,
  )
})

test('publish payload preserves registration-stage events without creating a draw or reservations', () => {
  const state = completeState()
  const payload = buildCreationPayload(state, {
    today,
    clubId: 'club-1',
    userId: 'admin-1',
    venues: [venue()],
  })
  assert.equal(payload.clubId, 'club-1')
  assert.equal(payload.courtIntent.reservesCourts, false)
  assert.equal(payload.categories[0].groups.length, 0)
  assert.equal(payload.categories[0].settings.actualDrawCreated, false)
  assert.equal(payload.registrationRequirements[0].eventId, 'mens-singles')
})

test('loading a reusable setup drops missing courts and re-evaluates stale seeding capability', () => {
  const state = completeState()
  const template = {
    configuration: {
      place: {
        venueId: 'venue-1',
        from: '10:00',
        to: '17:00',
        selectedCourtIds: ['deleted-court'],
      },
      events: [{ ...state.events[0], seeding: 'ladder' }],
    },
  }
  const result = applyTournamentSetup(template, state, {
    venues: [venue()],
    capabilities: {
      hasClubLadder: false,
      supportsPlayerRatings: true,
      recommendedSeeding: 'rating',
    },
  })
  assert.deepEqual(result.place.selectedCourtIds, ['court-1', 'court-2'])
  assert.equal(result.events[0].seeding, 'rating')
  assert.deepEqual(result.place.courtRules, {})
})
