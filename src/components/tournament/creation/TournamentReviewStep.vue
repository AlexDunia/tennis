<script setup>
import { computed, ref } from 'vue'
import {
  eventEligibilityText,
  firstCourtConflict,
  firstCourtRule,
  formatDate,
  formatLabel,
  formatTime,
  registrationFieldsForEvent,
  scoringLabel,
  seedingLabel,
  shortDateRange,
  unitForType,
  weekdayLabel,
  windowForDate,
} from '../../../utils/tournament/tournamentCreation'

const props = defineProps({
  state: { type: Object, required: true },
  venue: { type: Object, default: null },
  dates: { type: Array, default: () => [] },
  neededHours: { type: Number, default: 0 },
  availableHours: { type: Number, default: 0 },
  publishing: { type: Boolean, default: false },
  publishError: { type: String, default: '' },
})

const emit = defineEmits({
  edit: (step) => typeof step === 'string',
  'edit-event': (event) => Boolean(event?.id),
  publish: () => true,
})

const activeTab = ref('tournament')
const selectedCourts = computed(() =>
  (props.venue?.courts || []).filter((court) =>
    props.state.place.selectedCourtIds.includes(court.id),
  ),
)

function hoursLabel() {
  if (!props.state.place.customByDay) {
    return `${formatTime(props.state.place.from)} – ${formatTime(props.state.place.to)} each day`
  }
  return props.dates
    .map((date) => {
      const window = windowForDate(props.state.place, date)
      return `${weekdayLabel(date)} ${formatTime(window.from)}–${formatTime(window.to)}`
    })
    .join(' · ')
}
</script>

<template>
  <section class="creation-step" aria-labelledby="review-heading">
    <header class="step-heading">
      <h1 id="review-heading">Review</h1>
      <p>Check everything before you publish.</p>
    </header>

    <div class="review-tabs" role="tablist" aria-label="Review views">
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'tournament'"
        :class="{ active: activeTab === 'tournament' }"
        @click="activeTab = 'tournament'"
      >
        Tournament
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'registration'"
        :class="{ active: activeTab === 'registration' }"
        @click="activeTab = 'registration'"
      >
        Registration form
      </button>
    </div>

    <div v-if="activeTab === 'tournament'" class="review-stack" role="tabpanel">
      <div v-if="neededHours > availableHours" class="event-advice review-warning" role="status">
        <strong>This may need more court time.</strong>
        <p>
          Your current events need about {{ Math.ceil(neededHours) }} court hours. You set about
          {{ Math.round(availableHours) }}.
        </p>
        <button class="text-link" type="button" @click="emit('edit', 'events')">
          Review events
        </button>
      </div>

      <section class="review-section">
        <header class="review-section__header">
          <div><strong>Tournament</strong><span>Name, dates and sign-up.</span></div>
          <button class="text-link" type="button" @click="emit('edit', 'details')">Edit</button>
        </header>
        <dl class="review-rows">
          <div>
            <dt>Tournament</dt>
            <dd>{{ state.details.name }}</dd>
          </div>
          <div>
            <dt>Dates</dt>
            <dd>{{ shortDateRange(state.details.start, state.details.end) }}</dd>
          </div>
          <div>
            <dt>Sign-up</dt>
            <dd>
              {{ formatDate(state.details.signupOpen) }} –
              {{ formatDate(state.details.signupClose) }}
            </dd>
          </div>
          <div>
            <dt>Sign-up closes</dt>
            <dd>11:59 PM, club time</dd>
          </div>
        </dl>
      </section>

      <section class="review-section">
        <header class="review-section__header">
          <div><strong>Where &amp; When</strong><span>Venue, playing hours and courts.</span></div>
          <button class="text-link" type="button" @click="emit('edit', 'where')">Edit</button>
        </header>
        <dl class="review-rows">
          <div>
            <dt>Venue</dt>
            <dd>{{ venue?.name }}</dd>
          </div>
          <div>
            <dt>Tournament hours</dt>
            <dd>{{ hoursLabel() }}</dd>
          </div>
          <div>
            <dt>Courts</dt>
            <dd>{{ selectedCourts.length }} selected</dd>
          </div>
        </dl>
        <div class="review-courts">
          <div v-for="court in selectedCourts" :key="court.id" class="review-court">
            <span>
              <strong>{{ court.name }}</strong>
              <small v-if="firstCourtRule(state.place, court.id)">
                {{ weekdayLabel(firstCourtRule(state.place, court.id).date) }} from
                {{ formatTime(firstCourtRule(state.place, court.id).from) }}
              </small>
              <small v-else-if="state.place.customByDay">Uses each day's tournament hours</small>
              <small v-else
                >{{ formatTime(state.place.from) }}–{{ formatTime(state.place.to) }}</small
              >
            </span>
            <em
              v-if="
                firstCourtConflict(state.place, venue, court.id, dates) &&
                !firstCourtRule(state.place, court.id)
              "
            >
              Busy {{ weekdayLabel(firstCourtConflict(state.place, venue, court.id, dates).date) }}
              {{
                formatTime(firstCourtConflict(state.place, venue, court.id, dates).booking.from)
              }}–{{
                formatTime(firstCourtConflict(state.place, venue, court.id, dates).booking.to)
              }}
            </em>
          </div>
        </div>
      </section>

      <section class="review-section">
        <header class="review-section__header">
          <div>
            <strong>Events</strong><span>What people can enter and how each event works.</span>
          </div>
          <button class="text-link" type="button" @click="emit('edit', 'events')">Edit</button>
        </header>
        <div class="review-events">
          <article v-for="event in state.events" :key="event.id" class="review-event">
            <header>
              <div>
                <strong>{{ event.name }}</strong
                ><span>{{ eventEligibilityText(event) }}</span>
              </div>
              <button class="text-link" type="button" @click="emit('edit-event', event)">
                Edit
              </button>
            </header>
            <dl>
              <div>
                <dt>Entry limit</dt>
                <dd>{{ event.capacity }} {{ unitForType(event.type) }} max</dd>
              </div>
              <div>
                <dt>Format</dt>
                <dd>{{ formatLabel(event.format) }}</dd>
              </div>
              <div>
                <dt>Each match</dt>
                <dd>{{ scoringLabel(event.scoring) }}</dd>
              </div>
              <div>
                <dt>Seeding</dt>
                <dd>
                  {{ event.format === 'roundrobin' ? 'Not needed' : seedingLabel(event.seeding) }}
                </dd>
              </div>
            </dl>
          </article>
        </div>
      </section>
    </div>

    <section v-else class="review-section" role="tabpanel">
      <header class="review-section__header">
        <div>
          <strong>Registration form</strong><span>Built automatically from this tournament.</span>
        </div>
      </header>
      <div class="registration-lead">
        <strong>Gorra will ask each player only for what their event needs.</strong>
        <span>This is the logic the player form will use.</span>
      </div>
      <div class="registration-logic">
        <div>
          <strong>One form, different questions when needed</strong>
          <span
            >Existing Gorra members reuse saved profile data. New or outside players are asked only
            for missing information.</span
          >
        </div>
        <div v-for="event in state.events" :key="event.id">
          <strong>{{ event.name }}</strong>
          <span>{{ registrationFieldsForEvent(event).join(' · ') }}</span>
        </div>
      </div>
    </section>

    <p v-if="publishError" class="publish-error" role="alert">{{ publishError }}</p>
    <button
      class="button-primary step-primary"
      type="button"
      :disabled="publishing"
      @click="emit('publish')"
    >
      {{ publishing ? 'Publishing…' : 'Publish tournament' }}
    </button>
    <p class="publish-note">Publishing opens the tournament using the sign-up dates you chose.</p>
  </section>
</template>
