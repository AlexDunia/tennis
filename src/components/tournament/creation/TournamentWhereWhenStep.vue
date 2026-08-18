<script setup>
import { computed } from 'vue'
import {
  firstCourtConflict,
  firstCourtRule,
  formatTime,
  shortDateRange,
  validateTournamentHours,
  weekdayLabel,
} from '../../../utils/tournament/tournamentCreation'

const model = defineModel({ type: Object, required: true })

const props = defineProps({
  venues: { type: Array, default: () => [] },
  venue: { type: Object, default: null },
  dates: { type: Array, default: () => [] },
  startDate: { type: String, default: '' },
  endDate: { type: String, default: '' },
  error: { type: String, default: '' },
})

const emit = defineEmits({
  continue: () => true,
  'venue-change': (venueId) => typeof venueId === 'string',
  'hours-change': (kind) => ['global', 'day'].includes(kind),
  'use-common': (window) => Boolean(window?.from && window?.to),
  'set-each-day': () => true,
  'toggle-court': (courtId) => typeof courtId === 'string',
  'open-court': (court) => Boolean(court?.id),
})

const hoursValidation = computed(() =>
  props.venue
    ? validateTournamentHours(model.value, props.venue, props.dates)
    : { valid: false, title: 'Choose a venue.', copy: 'Select a venue from the active club.' },
)

function isSelected(courtId) {
  return model.value.selectedCourtIds.includes(courtId)
}

function courtSummary(court) {
  if (!isSelected(court.id)) return 'Not selected'
  const rule = firstCourtRule(model.value, court.id)
  if (rule) return `${weekdayLabel(rule.date)} from ${formatTime(rule.from)}`
  const conflict = firstCourtConflict(model.value, props.venue, court.id, props.dates)
  if (conflict) {
    return `Busy ${weekdayLabel(conflict.date)} ${formatTime(conflict.booking.from)}–${formatTime(conflict.booking.to)}`
  }
  if (model.value.customByDay) return "Uses each day's hours"
  return `${formatTime(model.value.from)}–${formatTime(model.value.to)}`
}

function hasConflict(court) {
  return Boolean(
    isSelected(court.id) && firstCourtConflict(model.value, props.venue, court.id, props.dates),
  )
}
</script>

<template>
  <section class="creation-step" aria-labelledby="where-heading">
    <header class="step-heading">
      <h1 id="where-heading">Where &amp; When</h1>
      <p>Pick where you'll play, and what days and times.</p>
    </header>

    <div class="creation-stack">
      <section class="creation-block">
        <header class="block-heading">
          <strong>Venue</strong>
          <span>Where you're playing.</span>
        </header>
        <label class="creation-field">
          <span class="visually-hidden">Venue</span>
          <select
            :value="model.venueId"
            :aria-invalid="!venue"
            @change="emit('venue-change', $event.target.value)"
          >
            <option v-for="option in venues" :key="option.id" :value="option.id">
              {{ option.name }}
            </option>
          </select>
        </label>
      </section>

      <section class="creation-block">
        <header class="block-heading">
          <strong>What days and times?</strong>
          <span>Set a start and end time for each day. You'll pick exact match times later.</span>
        </header>
        <div class="two-column-fields">
          <label class="creation-field">
            <span>From</span>
            <input v-model="model.from" type="time" @change="emit('hours-change', 'global')" />
          </label>
          <label class="creation-field">
            <span>To</span>
            <input v-model="model.to" type="time" @change="emit('hours-change', 'global')" />
          </label>
        </div>

        <div v-if="!hoursValidation.valid" class="context-notice" role="status">
          <strong>{{ hoursValidation.title }}</strong>
          <p>{{ hoursValidation.copy }}</p>
          <div v-if="hoursValidation.type === 'different-hours'" class="notice-actions">
            <button
              class="notice-action notice-action--recommended"
              type="button"
              @click="emit('use-common', hoursValidation.common)"
            >
              Use {{ formatTime(hoursValidation.common.from) }}–{{
                formatTime(hoursValidation.common.to)
              }}
            </button>
            <button class="notice-action" type="button" @click="emit('set-each-day')">
              Set each day
            </button>
          </div>
        </div>

        <div v-if="model.customByDay" class="day-editor">
          <div v-for="date in dates" :key="date" class="day-row">
            <strong>{{ weekdayLabel(date) }} {{ Number(date.slice(-2)) }}</strong>
            <label>
              <span class="visually-hidden">Start time for {{ date }}</span>
              <input
                v-model="model.dayHours[date].from"
                type="time"
                :min="venue.hoursByWeekday[new Date(`${date}T00:00:00`).getDay()].from"
                :max="venue.hoursByWeekday[new Date(`${date}T00:00:00`).getDay()].to"
                @change="emit('hours-change', 'day')"
              />
            </label>
            <label>
              <span class="visually-hidden">End time for {{ date }}</span>
              <input
                v-model="model.dayHours[date].to"
                type="time"
                :min="venue.hoursByWeekday[new Date(`${date}T00:00:00`).getDay()].from"
                :max="venue.hoursByWeekday[new Date(`${date}T00:00:00`).getDay()].to"
                @change="emit('hours-change', 'day')"
              />
            </label>
          </div>
        </div>

        <div class="summary-row">
          <span>{{ shortDateRange(startDate, endDate) }}</span>
          <strong>
            {{
              model.customByDay
                ? 'Different each day'
                : `${formatTime(model.from)} – ${formatTime(model.to)}`
            }}
          </strong>
        </div>
        <div class="court-explainer">
          <strong>This doesn't book your courts.</strong>
          <span
            >Someone else can still book these times. Courts are booked later when you schedule each
            match.</span
          >
        </div>
      </section>

      <section class="creation-block">
        <header class="block-heading">
          <strong>Courts</strong>
          <span>Pick which courts to use. Tap one to change its time.</span>
        </header>
        <div class="court-grid">
          <article
            v-for="court in venue?.courts || []"
            :key="court.id"
            class="court-card"
            :class="{ 'court-card--selected': isSelected(court.id) }"
          >
            <button
              class="court-toggle"
              type="button"
              :aria-label="`${isSelected(court.id) ? 'Remove' : 'Include'} ${court.name}`"
              :aria-pressed="isSelected(court.id)"
              @click="emit('toggle-court', court.id)"
            >
              <span aria-hidden="true">✓</span>
            </button>
            <button
              class="court-open"
              type="button"
              @click="
                isSelected(court.id) ? emit('open-court', court) : emit('toggle-court', court.id)
              "
            >
              <span>
                <strong>{{ court.name }}</strong>
                <small>{{ courtSummary(court) }}</small>
              </span>
              <i v-if="hasConflict(court)" aria-label="Limited availability"></i>
            </button>
          </article>
        </div>
        <small v-if="error" class="field-error" role="alert">{{ error }}</small>
        <div class="court-explainer">
          <strong>No courts booked yet.</strong>
          <span>That happens later, when you put a match on a court.</span>
        </div>
      </section>
    </div>

    <button class="button-primary step-primary" type="button" @click="emit('continue')">
      Continue
    </button>
  </section>
</template>
