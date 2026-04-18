import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { fetchDailySlots, fetchSampleBookings, createBooking as serviceCreateBooking } from '../services/BookingService'

const STORAGE_KEY = 'sheltennis-bookings'

function readStoredBookings() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) {
    return []
  }
  try {
    return JSON.parse(stored)
  } catch (_) {
    return []
  }
}

export const useBookingStore = defineStore('booking', () => {
  const bookings = ref(readStoredBookings())
  const bookingSlots = ref([])
  const isBookingLoading = ref(false)
  const bookingMessage = ref('')

  const upcomingCount = computed(() => bookings.value.length)

  watch(bookings, () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings.value))
  })

  async function loadBookings() {
    if (bookings.value.length) {
      return bookings.value
    }
    try {
      isBookingLoading.value = true
      const sample = await fetchSampleBookings()
      bookings.value = sample
      return sample
    } catch (error) {
      bookingMessage.value = 'Unable to refresh bookings now'
      throw error
    } finally {
      isBookingLoading.value = false
    }
  }

  async function loadSlots(date) {
    try {
      isBookingLoading.value = true
      const slots = await fetchDailySlots(date)
      bookingSlots.value = slots
      return slots
    } catch (error) {
      bookingMessage.value = 'Unable to load slots'
      throw error
    } finally {
      isBookingLoading.value = false
    }
  }

  async function bookCourt(payload) {
    try {
      isBookingLoading.value = true
      const response = await serviceCreateBooking(payload, bookings.value)
      bookings.value = [...bookings.value, response.booking]
      bookingMessage.value = 'Court booked successfully'
      return response.booking
    } catch (error) {
      bookingMessage.value = error.message ?? 'Unable to book court'
      throw error
    } finally {
      isBookingLoading.value = false
    }
  }

  return {
    bookings,
    bookingSlots,
    isBookingLoading,
    bookingMessage,
    upcomingCount,
    loadBookings,
    loadSlots,
    bookCourt,
  }
})
