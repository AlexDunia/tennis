<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import PersonAvatar from '../PersonAvatar.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  ladder: { type: Object, default: null },
  playerA: { type: Object, default: null },
  playerB: { type: Object, default: null },
  ladderRules: { type: Object, required: true },
  courts: { type: Array, default: () => [] },
  submitting: { type: Boolean, default: false },
  error: { type: String, default: '' },
  result: { type: Object, default: null },
})

const emit = defineEmits(['close', 'submit', 'view', 'done'])
const closeButton = ref(null)
const timing = ref('')
const courtId = ref('')
const scheduleDate = ref('')
const scheduleTime = ref('')
const overrideOpen = ref(false)
const matchRuleSource = ref('ladder_default')
const overrideRules = reactive({
  matchFormat: 'best_of_3',
  gameScoringRule: 'normal',
  finalSetRule: 'same',
})

function localDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateFromLocalFields() {
  if (!scheduleDate.value || !scheduleTime.value) return null
  const [year, month, day] = scheduleDate.value.split('-').map(Number)
  const [hours, minutes] = scheduleTime.value.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes)
}

const minimumDate = computed(() => localDateString())
const currentRules = computed(() =>
  matchRuleSource.value === 'admin_override' ? overrideRules : props.ladderRules,
)
const scheduledDateTime = computed(() => dateFromLocalFields())
const scheduleIsFuture = computed(
  () =>
    Boolean(scheduledDateTime.value) &&
    Number.isFinite(scheduledDateTime.value.getTime()) &&
    scheduledDateTime.value.getTime() > Date.now(),
)
const canSubmit = computed(
  () =>
    !props.submitting &&
    Boolean(props.playerA && props.playerB) &&
    (timing.value === 'now' || (timing.value === 'scheduled' && scheduleIsFuture.value)),
)

function formatDate(value) {
  if (!value) return ''
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

function formatDateTime(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value)
}

function formatResultDate(value) {
  if (!value) return 'Ready now'
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function matchFormatLabel(value) {
  return value === 'best_of_5' ? 'Best of 5 sets' : 'Best of 3 sets'
}

function scoringLabel(value) {
  return value === 'sudden_death' ? 'No-Ad' : 'Advantage'
}

function finalSetLabel(value) {
  return value === 'super_tiebreak' ? '10-point final-set tiebreak' : 'Full final set'
}

function reset() {
  timing.value = ''
  courtId.value = ''
  scheduleDate.value = ''
  scheduleTime.value = ''
  overrideOpen.value = false
  matchRuleSource.value = 'ladder_default'
  Object.assign(overrideRules, props.ladderRules)
}

function saveOverride() {
  matchRuleSource.value = 'admin_override'
  overrideOpen.value = false
}

function useLadderDefault() {
  matchRuleSource.value = 'ladder_default'
  Object.assign(overrideRules, props.ladderRules)
  overrideOpen.value = false
}

function submit() {
  if (!canSubmit.value) return
  emit('submit', {
    timing: timing.value,
    scheduledAt: timing.value === 'scheduled' ? scheduledDateTime.value.toISOString() : null,
    courtId: courtId.value || null,
    matchRuleSource: matchRuleSource.value,
    matchRules: { ...currentRules.value },
  })
}

function handleKeydown(event) {
  if (props.open && event.key === 'Escape' && !props.submitting) emit('close')
}

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return
    reset()
    await nextTick()
    closeButton.value?.focus()
  },
)

watch(
  () => props.ladderRules,
  (rules) => Object.assign(overrideRules, rules),
  { immediate: true, deep: true },
)

onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div
    class="admin-drawer"
    :class="{ 'admin-drawer--open': open }"
    role="presentation"
    @click.self="!submitting && emit('close')"
  >
    <section
      class="admin-drawer__panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-ladder-drawer-title"
    >
      <template v-if="!result">
        <header class="admin-drawer__header">
          <div>
            <small>Set up match</small>
            <h2 id="admin-ladder-drawer-title">
              {{ playerA?.name }} <span>vs</span> {{ playerB?.name }}
            </h2>
          </div>
          <button
            ref="closeButton"
            type="button"
            aria-label="Close match setup"
            :disabled="submitting"
            @click="emit('close')"
          >
            ×
          </button>
        </header>

        <div class="matchup">
          <div>
            <span class="matchup__person">
              <PersonAvatar :name="playerA?.name || ''" :image="playerA?.imageUrl" :size="34" />
              <strong>{{ playerA?.name }}</strong>
            </span>
            <i>vs</i>
            <span class="matchup__person">
              <PersonAvatar :name="playerB?.name || ''" :image="playerB?.imageUrl" :size="34" />
              <strong>{{ playerB?.name }}</strong>
            </span>
          </div>
          <p>{{ ladder?.name }} · Ladder match</p>
        </div>

        <fieldset class="timing-choice">
          <legend>When are they playing?</legend>
          <div>
            <button
              type="button"
              :class="{ active: timing === 'now' }"
              :aria-pressed="timing === 'now'"
              @click="timing = 'now'"
            >
              <strong>Play now</strong>
              <span>Create a match ready for live scoring.</span>
            </button>
            <button
              type="button"
              :class="{ active: timing === 'scheduled' }"
              :aria-pressed="timing === 'scheduled'"
              @click="timing = 'scheduled'"
            >
              <strong>Schedule</strong>
              <span>Choose a clear date and time.</span>
            </button>
          </div>
        </fieldset>

        <section v-if="timing" class="drawer-section">
          <div class="drawer-section__label">
            <strong>Match rules</strong>
            <span>{{
              matchRuleSource === 'admin_override' ? 'Admin override' : 'Ladder default'
            }}</span>
          </div>
          <div class="rules-card">
            <span>
              <strong>{{ matchFormatLabel(currentRules.matchFormat) }}</strong>
              <small
                >{{ scoringLabel(currentRules.gameScoringRule) }} ·
                {{ finalSetLabel(currentRules.finalSetRule) }}</small
              >
            </span>
            <button type="button" @click="overrideOpen = !overrideOpen">
              {{ overrideOpen ? 'Close' : 'Change' }}
            </button>
          </div>
          <p v-if="matchRuleSource === 'admin_override'" class="override-note">
            This admin override applies to this match only.
            <button type="button" @click="useLadderDefault">Use Ladder default</button>
          </p>

          <div v-if="overrideOpen" class="override-editor">
            <label>
              <span>Match format</span>
              <select v-model="overrideRules.matchFormat">
                <option value="best_of_3">Best of 3 sets</option>
                <option value="best_of_5">Best of 5 sets</option>
              </select>
            </label>
            <label>
              <span>Game scoring</span>
              <select v-model="overrideRules.gameScoringRule">
                <option value="normal">Advantage</option>
                <option value="sudden_death">No-Ad</option>
              </select>
            </label>
            <label>
              <span>Final set</span>
              <select v-model="overrideRules.finalSetRule">
                <option value="same">Full final set</option>
                <option value="super_tiebreak">10-point match tiebreak</option>
              </select>
            </label>
            <button class="override-editor__save" type="button" @click="saveOverride">
              Apply to this match
            </button>
          </div>
        </section>

        <section v-if="timing === 'scheduled'" class="drawer-section">
          <div class="schedule-fields">
            <label>
              <span>Date</span>
              <input v-model="scheduleDate" type="date" :min="minimumDate" />
            </label>
            <label>
              <span>Time</span>
              <input v-model="scheduleTime" type="time" />
            </label>
          </div>
          <p v-if="scheduleDate" class="selected-day">{{ formatDate(scheduleDate) }}</p>
          <div class="schedule-summary" aria-live="polite">
            <small>Match time</small>
            <strong>{{
              scheduledDateTime ? formatDateTime(scheduledDateTime) : 'Choose a date and time.'
            }}</strong>
            <span v-if="scheduledDateTime && !scheduleIsFuture">Choose a time later than now.</span>
          </div>
        </section>

        <section v-if="timing" class="drawer-section">
          <label class="court-field">
            <span>Court <small>Optional</small></span>
            <select v-if="courts.length" v-model="courtId">
              <option value="">Choose later</option>
              <option v-for="court in courts" :key="court.id || court" :value="court.id || court">
                {{ court.name || court }}
              </option>
            </select>
            <input v-else v-model="courtId" type="text" placeholder="e.g. Court 2" />
          </label>
        </section>

        <p v-if="error" class="drawer-error" role="alert">{{ error }}</p>
        <button
          v-if="timing"
          class="drawer-primary"
          type="button"
          :disabled="!canSubmit"
          @click="submit"
        >
          {{
            submitting
              ? 'Creating match…'
              : timing === 'now'
                ? 'Create & start match'
                : 'Schedule match'
          }}
        </button>
      </template>

      <section v-else class="drawer-success" aria-live="polite">
        <span class="drawer-success__check" aria-hidden="true">✓</span>
        <h2>{{ result.timing === 'scheduled' ? 'Match scheduled' : 'Match ready' }}</h2>
        <p>{{ playerA?.name }} vs {{ playerB?.name }}</p>
        <div>
          <strong>{{
            result.timing === 'scheduled'
              ? formatResultDate(result.match?.scheduledAt)
              : 'Ready for live scoring'
          }}</strong>
          <span v-if="result.match?.court">{{ result.match.court }}</span>
        </div>
        <button class="drawer-primary" type="button" @click="emit('view', result)">
          {{ result.timing === 'scheduled' ? 'View scheduled match' : 'Open live scoring' }}
        </button>
        <button class="drawer-secondary" type="button" @click="emit('done')">Done</button>
      </section>
    </section>
  </div>
</template>

<style scoped>
.admin-drawer {
  display: none;
  min-width: 0;
  border-left: 1px solid var(--color-border);
  background: var(--color-surface);
}

.admin-drawer--open {
  display: block;
}

.admin-drawer__panel {
  position: sticky;
  top: 0;
  width: 390px;
  max-width: 100%;
  max-height: calc(100vh - var(--app-header-height));
  overflow-y: auto;
  padding: 20px 18px 28px;
}

.admin-drawer__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 15px;
}

.admin-drawer__header small {
  display: block;
  margin-bottom: 4px;
  color: var(--color-muted);
  font-size: 9px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.admin-drawer__header h2 {
  margin: 0;
  font-size: 17px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.02em;
}

.admin-drawer__header h2 span {
  color: var(--color-muted);
  font-size: 10px;
}

.admin-drawer__header > button {
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-inner-radius);
  background: var(--color-surface);
  color: var(--color-text-soft);
  font-size: 18px;
}

.matchup {
  padding: 13px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
}

.matchup > div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.matchup__person {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 8px;
}

.matchup__person strong {
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.matchup i {
  color: var(--color-muted);
  font-size: 9px;
  font-style: normal;
}

.matchup p {
  margin: 10px 0 0;
  padding-top: 9px;
  border-top: 1px solid var(--color-border);
  color: var(--color-muted);
  font-size: 10px;
}

.timing-choice {
  padding: 0;
  margin: 17px 0 0;
  border: 0;
}

.timing-choice legend {
  margin-bottom: 9px;
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
}

.timing-choice > div {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}

.timing-choice button {
  min-height: 82px;
  padding: 11px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  color: var(--color-text);
  text-align: left;
}

.timing-choice button.active {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 6%, white);
}

.timing-choice strong,
.timing-choice span {
  display: block;
}

.timing-choice strong {
  font-size: 12px;
}

.timing-choice span {
  margin-top: 3px;
  color: var(--color-muted);
  font-size: 10px;
  line-height: 1.4;
}

.drawer-section {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--color-border);
}

.drawer-section__label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.drawer-section__label strong {
  font-size: 11px;
}

.drawer-section__label span {
  color: var(--color-muted);
  font-size: 9px;
}

.rules-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-inner-radius);
}

.rules-card > span {
  display: grid;
  min-width: 0;
}

.rules-card strong {
  font-size: 11px;
}

.rules-card small {
  margin-top: 2px;
  color: var(--color-muted);
  font-size: 10px;
}

.rules-card button,
.override-note button {
  padding: 4px;
  border: 0;
  background: transparent;
  color: var(--color-primary-strong);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
}

.override-note {
  margin: 6px 0 0;
  color: var(--color-muted);
  font-size: 9px;
}

.override-editor {
  display: grid;
  gap: 8px;
  margin-top: 9px;
  padding: 11px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-inner-radius);
  background: var(--color-surface-soft);
}

.override-editor label,
.court-field,
.schedule-fields label {
  display: grid;
  gap: 5px;
  color: var(--color-text-soft);
  font-size: 10px;
  font-weight: var(--font-weight-medium);
}

.override-editor select,
.court-field select,
.court-field input,
.schedule-fields input {
  width: 100%;
  min-height: 42px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-inner-radius);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 11px;
}

.override-editor__save {
  min-height: 38px;
  border: 0;
  border-radius: var(--app-inner-radius);
  background: var(--color-primary);
  color: white;
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
}

.schedule-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}

.selected-day {
  margin: 8px 0 0;
  padding: 8px 10px;
  border-radius: var(--app-inner-radius);
  background: var(--color-surface-soft);
  color: var(--color-text-soft);
  font-size: 10px;
  font-weight: var(--font-weight-medium);
}

.schedule-summary {
  display: grid;
  gap: 2px;
  margin-top: 11px;
  padding: 11px 12px;
  border-radius: var(--app-inner-radius);
  background: color-mix(in srgb, var(--color-primary) 4%, white);
}

.schedule-summary small,
.schedule-summary span {
  color: var(--color-muted);
  font-size: 9px;
}

.schedule-summary strong {
  font-size: 11px;
  line-height: 1.45;
}

.court-field > span small {
  color: var(--color-muted);
  font-weight: var(--font-weight-regular);
}

.drawer-error {
  margin: 12px 0 0;
  color: #9a554f;
  font-size: 10px;
}

.drawer-primary,
.drawer-secondary {
  width: 100%;
  min-height: 44px;
  margin-top: 12px;
  border-radius: var(--app-inner-radius);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
}

.drawer-primary {
  border: 1px solid var(--color-primary);
  background: var(--color-primary);
  color: white;
}

.drawer-primary:disabled {
  border-color: color-mix(in srgb, var(--color-primary) 32%, white);
  background: color-mix(in srgb, var(--color-primary) 32%, white);
  cursor: not-allowed;
}

.drawer-secondary {
  margin-top: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-soft);
}

.drawer-success {
  padding: 24px 4px 4px;
  text-align: center;
}

.drawer-success__check {
  display: grid;
  width: 50px;
  height: 50px;
  margin: 0 auto 12px;
  place-items: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-primary) 10%, white);
  color: var(--color-primary-strong);
  font-size: 22px;
}

.drawer-success h2,
.drawer-success p {
  margin: 0;
}

.drawer-success h2 {
  font-size: 17px;
}

.drawer-success p {
  margin-top: 6px;
  color: var(--color-muted);
  font-size: 11px;
}

.drawer-success > div {
  display: grid;
  gap: 3px;
  margin-top: 16px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  text-align: left;
}

.drawer-success > div strong {
  font-size: 11px;
}

.drawer-success > div span {
  color: var(--color-muted);
  font-size: 10px;
}

@media (max-width: 1180px) {
  .admin-drawer {
    position: fixed;
    inset: 0;
    z-index: 90;
    padding-top: 56px;
    background: rgba(15, 34, 24, 0.2);
  }

  .admin-drawer__panel {
    position: absolute;
    inset: 0 0 0 auto;
    width: min(390px, 92vw);
    max-height: 100%;
    background: var(--color-surface);
    box-shadow: -14px 0 40px rgba(15, 34, 24, 0.1);
  }
}

@media (max-width: 767px) {
  .admin-drawer {
    align-items: end;
    padding-top: 48px;
  }

  .admin-drawer--open {
    display: flex;
  }

  .admin-drawer__panel {
    position: relative;
    inset: auto;
    width: 100%;
    max-width: none;
    max-height: calc(100vh - 48px);
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -12px 36px rgba(15, 34, 24, 0.11);
  }

  .timing-choice > div {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin-drawer,
  .admin-drawer__panel {
    scroll-behavior: auto;
  }
}
</style>
