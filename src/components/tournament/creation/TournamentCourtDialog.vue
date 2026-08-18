<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import {
  bookingsForCourt,
  courtRule,
  formatDate,
  formatTime,
  isCourtStartAvailable,
  nextFreeCourtTime,
  relevantBookings,
  venueHoursForDate,
  windowForDate,
} from '../../../utils/tournament/tournamentCreation'

const props = defineProps({
  open: { type: Boolean, default: false },
  court: { type: Object, default: null },
  place: { type: Object, required: true },
  venue: { type: Object, default: null },
  dates: { type: Array, default: () => [] },
})

const emit = defineEmits({
  close: () => true,
  save: (payload) => Boolean(payload?.courtId && payload?.date && payload?.from),
})

const date = ref('')
const start = ref('')
const revealed = ref(false)
const startInput = ref(null)

const window = computed(() => windowForDate(props.place, date.value))
const venueHours = computed(() => venueHoursForDate(props.venue, date.value))
const conflicts = computed(() =>
  props.court ? relevantBookings(props.place, props.venue, props.court.id, date.value) : [],
)
const allBookings = computed(() =>
  props.court ? bookingsForCourt(props.venue, props.court.id, date.value) : [],
)
const validStart = computed(() =>
  props.court
    ? isCourtStartAvailable(props.place, props.venue, props.court.id, date.value, start.value)
    : false,
)
const recommendedStart = computed(() =>
  props.court ? nextFreeCourtTime(props.place, props.venue, props.court.id, date.value) : '',
)
const availability = computed(() => {
  if (!date.value || !props.venue) return { state: 'bad', title: 'Choose a day', copy: '' }
  if (conflicts.value.length) {
    const booking = conflicts.value[0]
    return {
      state: 'busy',
      title: `Booked · ${formatTime(booking.from)}–${formatTime(booking.to)}`,
      copy: `Free before ${formatTime(booking.from)} and after ${formatTime(booking.to)}.`,
    }
  }
  return {
    state: 'good',
    title: 'Available',
    copy: `${formatTime(window.value.from)}–${formatTime(window.value.to)} is clear on ${formatDate(date.value, { weekday: 'long', year: false })}.`,
  }
})

function reset() {
  if (!props.court) return
  const conflictDate = props.dates.find(
    (item) => relevantBookings(props.place, props.venue, props.court.id, item).length,
  )
  date.value = conflictDate || props.dates[0] || ''
  const existing = courtRule(props.place, props.court.id, date.value)
  revealed.value = Boolean(existing)
  start.value =
    existing?.from || nextFreeCourtTime(props.place, props.venue, props.court.id, date.value)
}

function reveal() {
  revealed.value = true
  start.value = recommendedStart.value
  nextTick(() => startInput.value?.focus())
}

function onDateChange() {
  const existing = courtRule(props.place, props.court.id, date.value)
  revealed.value = Boolean(existing)
  start.value =
    existing?.from || nextFreeCourtTime(props.place, props.venue, props.court.id, date.value)
}

function onKeydown(event) {
  if (event.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  (open) => {
    if (open) reset()
  },
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="creation-overlay"
      role="presentation"
      @click.self="emit('close')"
      @keydown="onKeydown"
    >
      <section
        class="creation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="court-dialog-title"
      >
        <header class="dialog-header">
          <div>
            <h2 id="court-dialog-title">{{ court?.name }}</h2>
            <p>Check a day or change when this court can be used.</p>
          </div>
          <button class="icon-close" type="button" aria-label="Close" @click="emit('close')">
            ×
          </button>
        </header>

        <div class="dialog-section">
          <label class="creation-field">
            <span>Day</span>
            <input
              v-model="date"
              type="date"
              :min="dates[0]"
              :max="dates.at(-1)"
              @change="onDateChange"
            />
          </label>
          <div
            class="availability-box"
            :class="`availability-box--${availability.state}`"
            role="status"
          >
            <strong>{{ availability.title }}</strong>
            <span>{{ availability.copy }}</span>
          </div>
        </div>

        <div class="dialog-section">
          <button v-if="!revealed" class="change-trigger" type="button" @click="reveal">
            <span>Start using this court later</span><strong>Set time</strong>
          </button>
          <label v-else class="creation-field">
            <span>Use this court from</span>
            <input
              ref="startInput"
              v-model="start"
              type="time"
              :min="window.from"
              :max="window.to"
            />
            <small v-if="validStart" class="available-note"
              >{{ formatTime(start) }} is available.</small
            >
            <small v-else class="field-error">
              {{
                isCourtStartAvailable(place, venue, court.id, date, recommendedStart)
                  ? `${formatTime(start)} isn't available. ${formatTime(recommendedStart)} is the next free time.`
                  : 'Choose another day or time.'
              }}
            </small>
          </label>
          <span v-if="allBookings.length && !conflicts.length" class="visually-hidden">
            This court has bookings outside the selected tournament window.
          </span>
        </div>

        <footer class="dialog-actions">
          <button class="button-secondary" type="button" @click="emit('close')">Close</button>
          <button
            v-if="revealed"
            class="button-primary"
            type="button"
            :disabled="!validStart"
            @click="emit('save', { courtId: court.id, date, from: start })"
          >
            Use {{ court?.name }} from {{ formatTime(start) }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
