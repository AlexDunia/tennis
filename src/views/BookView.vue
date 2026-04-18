<script setup>
// IMPORTS
import { computed, onMounted, ref } from 'vue'
import { useBookingStore } from '../stores/booking'
import { useAuthStore } from '../stores/auth'
import CourtBookingForm from '../components/CourtBookingForm.vue'

// PROPS
// none

// EMITS
// none

// ROUTER / ROUTE
// none

// STORES
const bookingStore = useBookingStore()
const authStore = useAuthStore()

// REACTIVE STATE
const selectedDate = ref(new Date().toISOString().slice(0, 10))

// COMPUTED PROPERTIES
const sortedBookings = computed(() => [...bookingStore.bookings].sort((a, b) => new Date(a.date) - new Date(b.date)))

// METHODS
async function handleBooking(payload) {
  try {
    await bookingStore.bookCourt({
      ...payload,
      playerName: authStore.user?.name ?? 'Shell player',
    })
  } catch (_) {
    // message handled inside store
  }
}

// WATCHERS
// none

// LIFECYCLE HOOKS
onMounted(async () => {
  await bookingStore.loadBookings()
  await bookingStore.loadSlots(selectedDate.value)
})
</script>

<template>
  <section class="book">
    <div class="book__grid">
      <div class="book__form">
        <h1 class="book__title">Book the Port Harcourt court</h1>
        <CourtBookingForm :slots="bookingStore.bookingSlots" @book="handleBooking" />
        <p class="book__note">Bookings update instantly. Only one court is available and there are no alternate courts.</p>
      </div>
      <div class="book__calendar">
        <div class="book__calendar-header">
          <h2>Upcoming bookings</h2>
        </div>
        <ul class="book__list">
          <li class="book__item" v-for="booking in sortedBookings" :key="booking.id">
            <p class="book__item-date">{{ booking.date }} · {{ booking.startHour }}:00</p>
            <p class="book__item-detail">{{ booking.playerName }} · {{ booking.duration }} hour(s)</p>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.book {
  padding: 2rem 1.25rem;
}
.book__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 2rem;
}
.book__form {
  background: #fff;
  border-radius: 1.5rem;
  padding: 1.5rem;
  box-shadow: 0 30px 70px rgba(0, 0, 0, 0.1);
}
.book__title {
  margin-top: 0;
}
.book__note {
  margin-top: 1rem;
  color: rgba(0, 0, 0, 0.6);
}
.book__calendar {
  background: #101820;
  color: #fff;
  border-radius: 1.25rem;
  padding: 1.25rem;
}
.book__calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.book__list {
  list-style: none;
  padding: 0;
  margin: 1rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.book__item {
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 0.65rem;
}
.book__item:last-child {
  border-bottom: none;
}
.book__item-date {
  margin: 0;
  font-weight: 600;
}
.book__item-detail {
  margin: 0;
  color: rgba(255, 255, 255, 0.65);
}
</style>
