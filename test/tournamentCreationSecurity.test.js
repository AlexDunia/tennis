import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createDefaultEvent,
  createInitialCreationState,
  validateCreationState,
} from '../src/utils/tournament/tournamentCreation.js'

const context = {
  today: '2026-08-17',
  clubId: 'club-1',
  userId: 'admin-1',
  venues: [
    {
      id: 'venue-1',
      clubId: 'club-1',
      name: 'Club venue',
      timezone: 'Africa/Lagos',
      courts: [{ id: 'court-1', name: 'Centre Court' }],
      hoursByWeekday: Object.fromEntries(
        Array.from({ length: 7 }, (_, day) => [day, { from: '09:00', to: '20:00' }]),
      ),
      bookings: [],
    },
  ],
}

function stateWithEvent(event) {
  const state = createInitialCreationState({ today: context.today })
  Object.assign(state.details, {
    name: 'Club Championship',
    start: '2026-09-05',
    end: '2026-09-06',
    signupOpen: '2026-08-18',
    signupClose: '2026-09-04',
  })
  state.place.venueId = 'venue-1'
  state.place.selectedCourtIds = ['court-1']
  state.events = [{ id: 'event-1', name: 'Event', ...event }]
  return state
}

test('publish validation rejects invalid event capacities and enums', () => {
  const valid = createDefaultEvent('singles', {})
  assert.equal(validateCreationState(stateWithEvent(valid), context).valid, true)
  assert.match(
    validateCreationState(stateWithEvent({ ...valid, capacity: 129 }), context).errors.events,
    /invalid option or capacity/,
  )
  assert.match(
    validateCreationState(stateWithEvent({ ...valid, format: 'double-elimination' }), context)
      .errors.events,
    /invalid option or capacity/,
  )
  assert.match(
    validateCreationState(
      stateWithEvent({ ...valid, type: 'singles', entryRule: 'mixed' }),
      context,
    ).errors.events,
    /invalid option or capacity/,
  )
})
