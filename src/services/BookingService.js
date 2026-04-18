import { fakeRequest, createId, createTimestamp } from './api'

const COURT_START_HOUR = 6
const COURT_END_HOUR = 20
const defaultDurations = [1, 2]

const sampleBookings = [
  {
    id: 'booking-1',
    date: '2026-04-16',
    startHour: 18,
    duration: 2,
    playerName: 'Amina Esin',
    description: 'Evening fitness session',
    createdAt: '2026-04-14T08:00:00.000Z',
  },
  {
    id: 'booking-2',
    date: '2026-04-17',
    startHour: 7,
    duration: 1,
    playerName: 'Shell Wellness',
    description: 'Early bird practice',
    createdAt: '2026-04-14T09:15:00.000Z',
  },
]

function getSlotLabel(startHour, duration) {
  const pad = (value) => value.toString().padStart(2, '0')
  const endHour = startHour + duration
  return `${pad(startHour)}:00 – ${pad(endHour)}:00`
}

function isOverlapping(startHour, duration, existingStart, existingDuration) {
  const endHour = startHour + duration
  const existingEnd = existingStart + existingDuration
  return startHour < existingEnd && existingStart < endHour
}

async function fetchSampleBookings() {
  return fakeRequest(sampleBookings)
}

async function createBooking(payload, existingBookings) {
  const conflict = existingBookings.some((booking) => {
    return booking.date === payload.date && isOverlapping(payload.startHour, payload.duration, booking.startHour, booking.duration)
  })
  if (conflict) {
    throw new Error('Selected slot is already booked')
  }
  const booking = {
    id: createId('booking'),
    description: payload.description,
    playerName: payload.playerName,
    date: payload.date,
    startHour: payload.startHour,
    duration: payload.duration,
    createdAt: createTimestamp(),
  }
  return fakeRequest({ booking, slotLabel: getSlotLabel(booking.startHour, booking.duration) })
}

function listDailySlots() {
  const slots = []
  for (let hour = COURT_START_HOUR; hour < COURT_END_HOUR; hour++) {
    defaultDurations.forEach((duration) => {
      if (hour + duration <= COURT_END_HOUR) {
        slots.push({ hour, duration, label: getSlotLabel(hour, duration) })
      }
    })
  }
  return slots
}

async function fetchDailySlots(date) {
  const slots = listDailySlots().map((slot) => ({ ...slot, date }))
  return fakeRequest(slots)
}

export { fetchSampleBookings, createBooking, fetchDailySlots, getSlotLabel, defaultDurations }
