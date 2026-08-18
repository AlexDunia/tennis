<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import TournamentCourtDialog from '../components/tournament/creation/TournamentCourtDialog.vue'
import TournamentDetailsStep from '../components/tournament/creation/TournamentDetailsStep.vue'
import TournamentEventDialog from '../components/tournament/creation/TournamentEventDialog.vue'
import TournamentEventsStep from '../components/tournament/creation/TournamentEventsStep.vue'
import TournamentReviewStep from '../components/tournament/creation/TournamentReviewStep.vue'
import TournamentSetupDialog from '../components/tournament/creation/TournamentSetupDialog.vue'
import TournamentWhereWhenStep from '../components/tournament/creation/TournamentWhereWhenStep.vue'
import { useAdminStore } from '../stores/admin'
import { useAuthStore } from '../stores/auth'
import { useBookingStore } from '../stores/booking'
import { useNotificationStore } from '../stores/notification'
import { usePlayerStore } from '../stores/player'
import { useTournamentStore } from '../stores/tournament'
import {
  applyTournamentSetup,
  clearTournamentDraft,
  deleteTournamentSetup,
  listTournamentSetups,
  loadTournamentDraft,
  saveTournamentDraft,
  saveTournamentSetup,
} from '../services/TournamentSetupService'
import {
  TOURNAMENT_STEP_KEYS,
  buildClubVenues,
  buildCreationPayload,
  createDefaultEvent,
  createInitialCreationState,
  datesBetween,
  eventHours,
  minutes,
  recommendedSeedingSource,
  todayInTimeZone,
  totalTournamentCourtHours,
  validateCreationState,
  validateDateRules,
  validateTournamentHours,
  venueHoursForDate,
} from '../utils/tournament/tournamentCreation'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()
const authStore = useAuthStore()
const bookingStore = useBookingStore()
const notificationStore = useNotificationStore()
const playerStore = usePlayerStore()
const tournamentStore = useTournamentStore()

const state = reactive(createInitialCreationState({ today: todayInTimeZone('Africa/Lagos') }))
const ready = ref(false)
const published = ref(false)
const errors = reactive({})
const publishError = ref('')
const courtDialog = reactive({ open: false, court: null })
const eventDialog = reactive({ open: false, event: null, custom: false })
const setupDialogOpen = ref(false)
const templates = ref([])
const templateBusy = ref(false)
const templateError = ref('')
let saveTimer = null

const activeClub = computed(() => adminStore.activeClub)
const timezone = computed(() => activeClub.value?.setup?.workspace?.timezone || 'Africa/Lagos')
const today = computed(() => todayInTimeZone(timezone.value))
const context = computed(() => ({
  clubId: adminStore.activeClubId,
  userId:
    authStore.user?.id ||
    authStore.user?.playerId ||
    authStore.user?.email ||
    playerStore.currentPlayerId ||
    '',
  canManage: adminStore.hasActiveClubPermission('tournaments.manage'),
}))
const capabilities = computed(() => {
  const hasClubLadder = adminStore.activeLadders.length > 0
  const supportsPlayerRatings = playerStore.players.some((player) =>
    Number.isFinite(Number(player.rating ?? player.elo)),
  )
  return {
    hasClubLadder,
    supportsPlayerRatings,
    recommendedSeeding: recommendedSeedingSource({ hasClubLadder, supportsPlayerRatings }),
  }
})
const venues = computed(() => buildClubVenues(activeClub.value, bookingStore.bookings))
const venue = computed(() => venues.value.find((item) => item.id === state.place.venueId) || null)
const tournamentDates = computed(() => datesBetween(state.details.start, state.details.end))
const currentStep = computed(() => {
  const key = String(route.query.step || state.currentStep || 'details')
  return TOURNAMENT_STEP_KEYS.includes(key) ? key : 'details'
})
const currentStepIndex = computed(() => TOURNAMENT_STEP_KEYS.indexOf(currentStep.value))
const availableCourtHours = computed(() =>
  venue.value ? totalTournamentCourtHours(state.place, venue.value, tournamentDates.value) : 0,
)
const neededEventHours = computed(() =>
  state.events.reduce((sum, event) => sum + eventHours(event), 0),
)
const publishing = computed(() => tournamentStore.loading)

function toast(message, type = 'success') {
  notificationStore.addToast({ message, type })
}

function clearErrors() {
  Object.keys(errors).forEach((key) => delete errors[key])
}

function applyErrors(nextErrors = {}) {
  clearErrors()
  Object.assign(errors, nextErrors)
}

function synchronizeDayHours() {
  if (!venue.value) return
  const activeDates = new Set(tournamentDates.value)
  for (const date of activeDates) {
    if (!state.place.dayHours[date]) {
      state.place.dayHours[date] = { from: state.place.from, to: state.place.to }
    }
  }
  Object.keys(state.place.dayHours).forEach((date) => {
    if (!activeDates.has(date)) delete state.place.dayHours[date]
  })
}

function reconcileVenueState() {
  const selectedVenue =
    venues.value.find((item) => item.id === state.place.venueId) || venues.value[0]
  state.place.venueId = selectedVenue?.id || ''
  const validCourtIds = new Set(selectedVenue?.courts.map((court) => court.id) || [])
  state.place.selectedCourtIds = state.place.selectedCourtIds.filter((courtId) =>
    validCourtIds.has(courtId),
  )
  if (!state.place.selectedCourtIds.length) {
    state.place.selectedCourtIds = selectedVenue?.courts.map((court) => court.id) || []
  }
  state.place.courtRules = Object.fromEntries(
    Object.entries(state.place.courtRules || {}).filter(([courtId]) => validCourtIds.has(courtId)),
  )
  synchronizeDayHours()
}

function reconcileSeeding() {
  const allowed = new Set([
    ...(capabilities.value.hasClubLadder ? ['ladder'] : []),
    ...(capabilities.value.supportsPlayerRatings ? ['rating'] : []),
    'manual',
    'none',
  ])
  state.events.forEach((event) => {
    if (!allowed.has(event.seeding)) event.seeding = capabilities.value.recommendedSeeding
  })
}

function synchronizeDateRules(field = '') {
  const details = state.details
  if (field === 'end') details.touched.end = true
  if (field === 'signupOpen') details.touched.signupOpen = true
  if (field === 'signupClose') details.touched.signupClose = true

  if (field === 'start' && !details.touched.end) details.end = details.start
  if (details.start && (!details.end || details.end < details.start)) details.end = details.start
  if (details.start && details.signupOpen > details.start) details.signupOpen = details.start
  if (details.signupOpen && (!details.signupClose || details.signupClose < details.signupOpen)) {
    details.signupClose = details.signupOpen
  }
  if (details.start && details.signupClose > details.start) details.signupClose = details.start
  synchronizeDayHours()
  const dateErrors = validateDateRules(details, today.value).errors
  Object.assign(errors, dateErrors)
  for (const key of ['start', 'end', 'signupOpen', 'signupClose']) {
    if (!dateErrors[key]) delete errors[key]
  }
}

function stepNumber(step) {
  return TOURNAMENT_STEP_KEYS.indexOf(step) + 1
}

function goToStep(step, { force = false } = {}) {
  const targetIndex = TOURNAMENT_STEP_KEYS.indexOf(step)
  if (targetIndex < 0 || (!force && targetIndex + 1 > state.highestStep)) return
  state.currentStep = step
  router.replace({ path: route.path, query: { ...route.query, step } })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function validateDetailsAndContinue() {
  const result = validateDateRules(state.details, today.value)
  applyErrors(result.errors)
  if (!result.valid) return
  state.highestStep = Math.max(state.highestStep, 2)
  goToStep('where', { force: true })
}

function onVenueChange(venueId) {
  state.place.venueId = venueId
  state.place.selectedCourtIds = venue.value?.courts.map((court) => court.id) || []
  state.place.courtRules = {}
  state.place.customByDay = false
  state.place.dayHours = {}
  synchronizeDayHours()
  delete errors.venue
  delete errors.courts
}

function onHoursChange(kind) {
  if (kind === 'global') state.place.customByDay = false
  synchronizeDayHours()
  if (
    venue.value &&
    validateTournamentHours(state.place, venue.value, tournamentDates.value).valid
  ) {
    delete errors.hours
  }
}

function useCommonHours(window) {
  state.place.from = window.from
  state.place.to = window.to
  state.place.customByDay = false
  synchronizeDayHours()
  delete errors.hours
}

function setEachDay() {
  if (!venue.value) return
  state.place.customByDay = true
  for (const date of tournamentDates.value) {
    const venueHours = venueHoursForDate(venue.value, date)
    let from =
      minutes(state.place.from) < minutes(venueHours.from) ? venueHours.from : state.place.from
    let to = minutes(state.place.to) > minutes(venueHours.to) ? venueHours.to : state.place.to
    if (minutes(from) >= minutes(to)) ({ from, to } = venueHours)
    state.place.dayHours[date] = { from, to }
  }
  delete errors.hours
}

function toggleCourt(courtId) {
  const index = state.place.selectedCourtIds.indexOf(courtId)
  if (index >= 0) {
    if (state.place.selectedCourtIds.length === 1) {
      toast('Keep at least one court.', 'info')
      return
    }
    state.place.selectedCourtIds.splice(index, 1)
  } else state.place.selectedCourtIds.push(courtId)
  delete errors.courts
}

function openCourt(court) {
  courtDialog.court = court
  courtDialog.open = true
}

function saveCourtRule({ courtId, date, from }) {
  if (!state.place.courtRules[courtId]) state.place.courtRules[courtId] = {}
  state.place.courtRules[courtId][date] = { from }
  courtDialog.open = false
  courtDialog.court = null
}

function validateWhereAndContinue() {
  const nextErrors = {}
  if (!venue.value) nextErrors.venue = 'Choose a venue from the active club.'
  const hours = venue.value
    ? validateTournamentHours(state.place, venue.value, tournamentDates.value)
    : { valid: false, copy: 'Choose a venue.' }
  if (!hours.valid) nextErrors.hours = hours.copy
  if (!state.place.selectedCourtIds.length) nextErrors.courts = 'Choose at least one court.'
  applyErrors(nextErrors)
  if (Object.keys(nextErrors).length) {
    toast(nextErrors.hours || nextErrors.courts || nextErrors.venue, 'error')
    return
  }
  state.highestStep = Math.max(state.highestStep, 3)
  goToStep('events', { force: true })
}

function openEventEditor(payload) {
  const { preset, event: existing } = payload
  eventDialog.custom = Boolean(payload.custom)
  eventDialog.event = existing
    ? { ...existing, configured: true }
    : preset
      ? {
          ...createDefaultEvent(preset.type, capabilities.value),
          id: preset.id,
          name: preset.name,
          entryRule: preset.entryRule,
          custom: false,
          configured: false,
        }
      : {
          ...createDefaultEvent('singles', capabilities.value),
          id: '',
          name: '',
          custom: true,
          configured: false,
        }
  eventDialog.open = true
}

function saveEvent(event) {
  const saved = {
    ...event,
    id: event.id || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    configured: true,
  }
  const index = state.events.findIndex((item) => item.id === saved.id)
  if (index >= 0) state.events.splice(index, 1, saved)
  else state.events.push(saved)
  eventDialog.open = false
  eventDialog.event = null
  delete errors.events
}

function removeEvent(eventId) {
  const index = state.events.findIndex((event) => event.id === eventId)
  if (index >= 0) state.events.splice(index, 1)
  eventDialog.open = false
  eventDialog.event = null
}

function validateEventsAndContinue() {
  if (!state.events.length) {
    errors.events = 'Add at least one event.'
    toast(errors.events, 'error')
    return
  }
  delete errors.events
  state.highestStep = 4
  goToStep('review', { force: true })
}

function editEventFromReview(event) {
  goToStep('events', { force: true })
  openEventEditor({ event, custom: event.custom })
}

async function refreshTemplates() {
  templates.value = await listTournamentSetups(context.value)
}

async function openSetupDialog() {
  templateError.value = ''
  try {
    await refreshTemplates()
    setupDialogOpen.value = true
  } catch (error) {
    toast(error.message, 'error')
  }
}

async function saveSetup(name) {
  templateBusy.value = true
  templateError.value = ''
  try {
    await saveTournamentSetup(name, state, context.value)
    await refreshTemplates()
    toast('Reusable setup saved.')
  } catch (error) {
    templateError.value = error.message
  } finally {
    templateBusy.value = false
  }
}

async function loadSetup(template) {
  templateBusy.value = true
  templateError.value = ''
  try {
    const next = applyTournamentSetup(template, state, {
      venues: venues.value,
      capabilities: capabilities.value,
    })
    Object.assign(state, next)
    reconcileVenueState()
    reconcileSeeding()
    setupDialogOpen.value = false
    toast('Reusable setup applied. Choose fresh dates and review current court availability.')
  } catch (error) {
    templateError.value = error.message
  } finally {
    templateBusy.value = false
  }
}

async function deleteSetup(templateId) {
  templateBusy.value = true
  templateError.value = ''
  try {
    await deleteTournamentSetup(templateId, context.value)
    await refreshTemplates()
    toast('Reusable setup deleted.', 'info')
  } catch (error) {
    templateError.value = error.message
  } finally {
    templateBusy.value = false
  }
}

function stepForErrors(validationErrors) {
  if (['name', 'start', 'end', 'signupOpen', 'signupClose'].some((key) => validationErrors[key])) {
    return 'details'
  }
  if (['venue', 'hours', 'courts'].some((key) => validationErrors[key])) return 'where'
  if (validationErrors.events) return 'events'
  return 'review'
}

async function publishTournament() {
  publishError.value = ''
  if (!context.value.canManage) {
    publishError.value = 'You do not have permission to publish tournaments for this club.'
    return
  }
  reconcileVenueState()
  const validationContext = {
    today: today.value,
    clubId: context.value.clubId,
    venues: venues.value,
    userId: context.value.userId,
  }
  const validation = validateCreationState(state, validationContext)
  if (!validation.valid) {
    applyErrors(validation.errors)
    goToStep(stepForErrors(validation.errors), { force: true })
    toast(Object.values(validation.errors)[0], 'error')
    return
  }
  try {
    const payload = buildCreationPayload(state, validationContext)
    const tournament = await tournamentStore.createTournament(payload)
    if (!tournament) throw new Error(tournamentStore.error || 'Unable to publish the tournament.')
    published.value = true
    await clearTournamentDraft(context.value)
    toast('Tournament published.')
    await router.push({ name: 'TournamentOverview', params: { tournamentId: tournament.id } })
  } catch (error) {
    publishError.value = error.message || 'Unable to publish the tournament.'
  }
}

function exitFlow() {
  toast('Draft saved.', 'info')
  router.push({ name: 'Tournaments' })
}

async function restoreOrCreateState() {
  const fresh = createInitialCreationState({ today: today.value, capabilities: capabilities.value })
  let draft = null
  try {
    draft = await loadTournamentDraft(context.value)
  } catch {
    draft = null
  }
  Object.assign(state, fresh, draft || {})
  state.details = { ...fresh.details, ...(draft?.details || {}) }
  state.details.touched = { ...fresh.details.touched, ...(draft?.details?.touched || {}) }
  state.place = { ...fresh.place, ...(draft?.place || {}) }
  state.place.dayHours = { ...(draft?.place?.dayHours || {}) }
  state.place.courtRules = { ...(draft?.place?.courtRules || {}) }
  state.events = Array.isArray(draft?.events) ? draft.events : []
  reconcileVenueState()
  reconcileSeeding()
  const requested = String(route.query.step || state.currentStep || 'details')
  const safeStep = TOURNAMENT_STEP_KEYS.includes(requested) ? requested : 'details'
  state.highestStep = Math.max(1, Math.min(4, Number(state.highestStep) || 1))
  if (stepNumber(safeStep) > state.highestStep) state.highestStep = stepNumber(safeStep)
  state.currentStep = safeStep
  await router.replace({ path: route.path, query: { ...route.query, step: safeStep } })
}

watch(
  state,
  () => {
    if (!ready.value) return
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      saveTournamentDraft(JSON.parse(JSON.stringify(state)), context.value).catch(() => {})
    }, 350)
  },
  { deep: true },
)

watch(currentStep, (step) => {
  state.currentStep = step
})

watch(venues, () => {
  if (ready.value) reconcileVenueState()
})

onMounted(async () => {
  try {
    await Promise.all([
      adminStore.activeClub ? Promise.resolve() : adminStore.loadClubs(),
      playerStore.players.length ? Promise.resolve() : playerStore.loadPlayers(),
      bookingStore.loadBookings(),
    ])
    await restoreOrCreateState()
    ready.value = true
  } catch (error) {
    publishError.value = error?.message || 'Unable to load the tournament workspace.'
  }
})

onBeforeRouteLeave(async () => {
  if (!ready.value || published.value) return true
  window.clearTimeout(saveTimer)
  try {
    await saveTournamentDraft(JSON.parse(JSON.stringify(state)), context.value)
  } catch {
    // Route navigation still proceeds if the current local adapter is unavailable.
  }
  return true
})

onBeforeUnmount(() => window.clearTimeout(saveTimer))
</script>

<template>
  <main class="tournament-creation-shell">
    <section v-if="!ready" class="creation-loading" aria-live="polite">
      <span class="skeleton-line"></span>
      <span class="skeleton-line"></span>
      <span class="skeleton-line"></span>
    </section>

    <template v-else>
      <div class="creation-utility-bar">
        <button class="button-ghost" type="button" @click="openSetupDialog">Reusable setups</button>
        <button class="button-ghost" type="button" @click="exitFlow">Exit</button>
      </div>

      <nav class="creation-progress" aria-label="Tournament creation progress">
        <button
          v-for="(step, index) in TOURNAMENT_STEP_KEYS"
          :key="step"
          type="button"
          :class="{ current: index === currentStepIndex, done: index < currentStepIndex }"
          :disabled="index + 1 > state.highestStep || index === currentStepIndex"
          :aria-label="`Go to step ${index + 1}`"
          @click="goToStep(step)"
        ></button>
      </nav>
      <p class="creation-step-copy">Step {{ currentStepIndex + 1 }} of 4</p>

      <TournamentDetailsStep
        v-if="currentStep === 'details'"
        v-model="state.details"
        :today="today"
        :timezone="timezone"
        :errors="errors"
        @date-change="synchronizeDateRules"
        @continue="validateDetailsAndContinue"
      />
      <TournamentWhereWhenStep
        v-else-if="currentStep === 'where'"
        v-model="state.place"
        :venues="venues"
        :venue="venue"
        :dates="tournamentDates"
        :start-date="state.details.start"
        :end-date="state.details.end"
        :error="errors.courts || errors.hours || errors.venue"
        @venue-change="onVenueChange"
        @hours-change="onHoursChange"
        @use-common="useCommonHours"
        @set-each-day="setEachDay"
        @toggle-court="toggleCourt"
        @open-court="openCourt"
        @continue="validateWhereAndContinue"
      />
      <TournamentEventsStep
        v-else-if="currentStep === 'events'"
        :events="state.events"
        :error="errors.events"
        @open="openEventEditor"
        @continue="validateEventsAndContinue"
      />
      <TournamentReviewStep
        v-else
        :state="state"
        :venue="venue"
        :dates="tournamentDates"
        :needed-hours="neededEventHours"
        :available-hours="availableCourtHours"
        :publishing="publishing"
        :publish-error="publishError"
        @edit="(step) => goToStep(step, { force: true })"
        @edit-event="editEventFromReview"
        @publish="publishTournament"
      />
    </template>

    <TournamentCourtDialog
      :open="courtDialog.open"
      :court="courtDialog.court"
      :place="state.place"
      :venue="venue"
      :dates="tournamentDates"
      @close="courtDialog.open = false"
      @save="saveCourtRule"
    />
    <TournamentEventDialog
      :open="eventDialog.open"
      :event="eventDialog.event"
      :custom="eventDialog.custom"
      :capabilities="capabilities"
      :available-court-hours="availableCourtHours"
      @close="eventDialog.open = false"
      @save="saveEvent"
      @remove="removeEvent"
    />
    <TournamentSetupDialog
      :open="setupDialogOpen"
      :templates="templates"
      :busy="templateBusy"
      :error="templateError"
      @close="setupDialogOpen = false"
      @save="saveSetup"
      @load="loadSetup"
      @delete="deleteSetup"
    />
  </main>
</template>

<style scoped>
.tournament-creation-shell {
  width: 100%;
  margin: 0 auto;
  padding: 4px 0 64px;
}

.creation-loading {
  display: grid;
  gap: 16px;
  min-height: 380px;
  align-content: center;
}

.creation-utility-bar {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-bottom: 14px;
}

.creation-progress {
  display: flex;
  gap: 7px;
}

.creation-progress button {
  min-height: 3px;
  flex: 1;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: var(--color-border);
}

.creation-progress button.current,
.creation-progress button.done {
  background: var(--color-primary);
}

.creation-progress button.done {
  cursor: pointer;
}

.creation-step-copy {
  margin: 8px 0 22px;
  color: var(--color-primary-strong);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
}

@media (max-width: 767px) {
  .tournament-creation-shell {
    padding-bottom: 40px;
  }
}
</style>
