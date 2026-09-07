<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import PersonAvatar from '../PersonAvatar.vue'
import MatchFormatEditor from '../match/MatchFormatEditor.vue'
import { createStandardMatchRulesSnapshot } from '../../domain/matchRules.js'
import { ladderRulesToMatchRulesSnapshot } from '../../domain/ruleAdapters/ladderMatchRules.js'
import { formatMatchRulesSummary } from '../../utils/matchRulesSummary.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  ladder: { type: Object, default: null },
  playerA: { type: Object, default: null },
  playerB: { type: Object, default: null },
  ladderRules: { type: Object, required: true },
  rulesEditable: { type: Boolean, default: true },
  courts: { type: Array, default: () => [] },
  submitting: { type: Boolean, default: false },
  error: { type: String, default: '' },
  result: { type: Object, default: null },
})

const emit = defineEmits(['close', 'submit', 'view', 'done'])
const closeButton = ref(null)
const revealing = ref(false)
let revealTimer = null

function stopReveal() {
  window.clearTimeout(revealTimer)
  revealTimer = null
  revealing.value = false
}
const timing = ref('')
const courtId = ref('')
const scheduleDate = ref('')
const scheduleTime = ref('')
const overrideOpen = ref(false)
const matchRuleSource = ref('ladder_default')
const overrideRulesSnapshot = ref(createStandardMatchRulesSnapshot())

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
const ladderRuleResult = computed(() =>
  ladderRulesToMatchRulesSnapshot({ matchConfig: props.ladderRules }),
)
const ladderRulesSnapshot = computed(() =>
  ladderRuleResult.value.ok ? ladderRuleResult.value.snapshot : createStandardMatchRulesSnapshot(),
)
const currentRulesSnapshot = computed(() =>
  matchRuleSource.value === 'admin_override'
    ? overrideRulesSnapshot.value
    : ladderRulesSnapshot.value,
)
const currentRulesSummary = computed(() => formatMatchRulesSummary(currentRulesSnapshot.value))
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

function reset() {
  timing.value = ''
  courtId.value = ''
  scheduleDate.value = ''
  scheduleTime.value = ''
  overrideOpen.value = false
  matchRuleSource.value = 'ladder_default'
  overrideRulesSnapshot.value = ladderRulesSnapshot.value
}

function openRulesEditor() {
  overrideRulesSnapshot.value = currentRulesSnapshot.value
  overrideOpen.value = true
}

function saveOverride(rulesSnapshot) {
  overrideRulesSnapshot.value = rulesSnapshot
  matchRuleSource.value = 'admin_override'
  overrideOpen.value = false
}

function useLadderDefault() {
  matchRuleSource.value = 'ladder_default'
  overrideRulesSnapshot.value = ladderRulesSnapshot.value
  overrideOpen.value = false
}

function submit() {
  if (!canSubmit.value) return
  emit('submit', {
    timing: timing.value,
    scheduledAt: timing.value === 'scheduled' ? scheduledDateTime.value.toISOString() : null,
    courtId: courtId.value || null,
    matchRuleSource: matchRuleSource.value,
    rulesSnapshot: currentRulesSnapshot.value,
  })
}

function handleKeydown(event) {
  if (!props.open || event.key !== 'Escape' || props.submitting) return
  if (overrideOpen.value) overrideOpen.value = false
  else emit('close')
}

watch(
  () => props.open,
  async (isOpen) => {
    stopReveal()
    if (!isOpen) return
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      revealing.value = true
      revealTimer = window.setTimeout(stopReveal, 110)
    }
    reset()
    await nextTick()
    if (props.open) closeButton.value?.focus({ preventScroll: true })
  },
)

watch(
  () => props.ladderRules,
  () => {
    if (matchRuleSource.value === 'ladder_default') {
      overrideRulesSnapshot.value = ladderRulesSnapshot.value
    }
  },
  { immediate: true, deep: true },
)

onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => {
  stopReveal()
  document.removeEventListener('keydown', handleKeydown)
})
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
      :class="{ 'admin-drawer__panel--revealing': revealing }"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-ladder-drawer-title"
    >
      <div v-if="revealing" class="drawer-reveal-mask" aria-hidden="true">
        <div v-for="section in 4" :key="section" class="drawer-detail-skeleton__section">
          <span></span><span></span>
        </div>
      </div>
      <div v-if="open && (!playerA || !playerB)" class="drawer-detail-skeleton" role="status" aria-label="Loading match details" aria-busy="true">
        <div v-for="section in 4" :key="section" class="drawer-detail-skeleton__section" aria-hidden="true">
          <span></span>
          <span></span>
        </div>
      </div>
      <template v-else-if="!result">
        <header class="admin-drawer__header">
          <div>
            <small>Ladder match</small>
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
              <span class="timing-choice__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="m9 5 10 7-10 7V5Z" /></svg>
              </span>
              <span class="timing-choice__copy">
                <strong>Play now</strong>
                <small>Start when both players are ready.</small>
              </span>
              <span class="timing-choice__check" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg>
              </span>
            </button>
            <button
              type="button"
              :class="{ active: timing === 'scheduled' }"
              :aria-pressed="timing === 'scheduled'"
              @click="timing = 'scheduled'"
            >
              <span class="timing-choice__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4m8-4v4M4 11h16" /></svg>
              </span>
              <span class="timing-choice__copy">
                <strong>Schedule</strong>
                <small>Choose when they will play.</small>
              </span>
              <span class="timing-choice__check" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg>
              </span>
            </button>
          </div>
        </fieldset>

        <section v-if="timing" class="drawer-section">
          <div class="drawer-section__label">
            <strong>Scoring rules</strong>
            <span>{{
              matchRuleSource === 'admin_override' ? 'Admin override' : 'Ladder default'
            }}</span>
          </div>
          <div class="rules-card rules-card--tennis">
            <div class="rules-card__tennis-summary">
              <strong>{{ currentRulesSummary.match }}</strong>

              <dl>
                <div
                  v-for="row in currentRulesSummary.rows"
                  :key="row.key"
                >
                  <dt>{{ row.label }}</dt>
                  <dd>{{ row.value }}</dd>
                </div>
              </dl>
            </div>

            <button
              v-if="rulesEditable"
              type="button"
              @click="openRulesEditor"
            >
              Customize
            </button>
          </div>
          <p v-if="matchRuleSource === 'admin_override'" class="override-note">
            This admin override applies to this match only.
            <button type="button" @click="useLadderDefault">Use Ladder default</button>
          </p>
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
  <Teleport to="body">
    <div
      v-if="open && overrideOpen"
      class="rules-modal"
      role="presentation"
      @click.self="overrideOpen = false"
    >
      <section
        class="rules-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Customize match format"
      >
        <button
          type="button"
          class="rules-modal__close"
          aria-label="Close match format"
          @click="overrideOpen = false"
        >
          ×
        </button>
        <MatchFormatEditor
          :model-value="overrideRulesSnapshot"
          :editable="rulesEditable"
          :show-save="rulesEditable"
          :allow-standalone-tiebreak="false"
          :read-only-label="`Controlled by ${ladder?.name || 'this Ladder'}`"
          save-label="Apply to this match"
          @save="saveOverride"
        />
      </section>
    </div>
  </Teleport>
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

.admin-drawer__header > div,
.drawer-section,
.rules-card,
.rules-card > span,
.schedule-fields,
.schedule-fields label {
  min-width: 0;
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
  min-width: 0;
  padding: 0;
  margin: 24px 0 0;
  border: 0;
}

.timing-choice legend {
  margin-bottom: 16px;
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
}

.timing-choice > div {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

.timing-choice button {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 18px;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-width: 0;
  min-height: 104px;
  height: auto;
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  color: var(--color-text);
  text-align: left;
  white-space: normal;
  overflow: visible;
}

.timing-choice__icon {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 10px;
  background: var(--color-surface-soft);
  color: #163d2b;
}

.timing-choice svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.timing-choice__copy {
  display: grid;
  min-width: 0;
  gap: 4px;
  overflow-wrap: anywhere;
}

.timing-choice__copy strong {
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.35;
}

.timing-choice__copy small {
  color: var(--color-muted);
  font-size: 12px;
  font-weight: var(--font-weight-regular);
  line-height: 1.5;
}

.timing-choice__check {
  display: grid;
  place-items: center;
  visibility: hidden;
}

.timing-choice button.active {
  border-color: #163d2b;
  background: #163d2b;
  color: #fff;
}

.timing-choice button.active .timing-choice__copy small {
  color: #fff;
}

.timing-choice button.active .timing-choice__icon {
  background: rgba(216, 255, 71, 0.12);
  color: #d8ff47;
}

.timing-choice button.active .timing-choice__check {
  visibility: visible;
  color: #d8ff47;
}

@media (hover: hover) and (pointer: fine) {
  .timing-choice button:not(.active):hover {
    background: #f4f8f5;
  }
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
  font-size: 12px;
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
  padding: 13px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-inner-radius);
}

.rules-card > span {
  display: grid;
  min-width: 0;
}

.rules-card strong {
  font-size: 12px;
}

.rules-card small {
  margin-top: 2px;
  color: var(--color-muted);
  font-size: 11px;
  line-height: 1.45;
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

.rules-card--tennis {
  align-items: flex-start;
}

.rules-card__tennis-summary {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 8px;
}

.rules-card__tennis-summary > strong {
  font-size: 11.5px;
  font-weight: 650;
}

.rules-card__tennis-summary dl {
  display: grid;
  margin: 0;
}

.rules-card__tennis-summary dl > div {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 8px;
  padding: 5px 0;
  border-top: 1px solid
    color-mix(
      in srgb,
      var(--color-border) 70%,
      transparent
    );
}

.rules-card__tennis-summary dt {
  color: var(--color-muted);
  font-size: 8.7px;
}

.rules-card__tennis-summary dd {
  margin: 0;
  color: var(--color-text-soft);
  font-size: 9.4px;
  font-weight: 600;
  line-height: 1.4;
}

.override-note {
  margin: 6px 0 0;
  color: var(--color-muted);
  font-size: 9px;
}

.court-field,
.schedule-fields label {
  display: grid;
  gap: 5px;
  color: var(--color-text-soft);
  font-size: 10px;
  font-weight: var(--font-weight-medium);
}

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

.rules-modal {
  position: fixed;
  inset: 0;
  z-index: 140;
  display: grid;
  padding: clamp(18px, 4vw, 40px);
  place-items: center;
  background: rgba(15, 34, 24, 0.36);
}

.rules-modal__panel {
  position: relative;
  width: min(780px, 100%);
  min-width: 0;
  max-height: calc(100vh - clamp(36px, 8vw, 80px));
  overscroll-behavior: contain;
  overflow: hidden;
  padding: 0;
  border: var(--app-hairline);
  border-radius: 18px;
  background: var(--color-bg);
  box-shadow: var(--shadow-strong, 0 24px 64px rgba(15, 34, 24, 0.18));
}

.rules-modal__close {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 1;
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-text-soft);
  font-size: 20px;
}

@media (max-width: 640px) {
  .rules-modal {
    padding: 0;
    place-items: end stretch;
  }

  .rules-modal__panel {
    max-height: calc(100vh - 48px);
    padding: 0;
    border-radius: 16px 16px 0 0;
  }

  .rules-modal__close {
    top: 12px;
    right: 14px;
  }
}

@media (max-width: 420px) {
  .rules-card--tennis {
    display: grid;
  }

  .rules-card__tennis-summary dl > div {
    grid-template-columns: 68px minmax(0, 1fr);
  }

  .admin-drawer__panel {
    padding-inline: 14px;
    padding-bottom: max(24px, env(safe-area-inset-bottom));
  }

  .schedule-fields {
    grid-template-columns: 1fr;
  }

  .rules-card {
    align-items: stretch;
    flex-direction: column;
  }

  .rules-card button {
    min-height: 44px;
    padding: 10px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--app-inner-radius);
    text-align: center;
  }
}

/* Compact dialog presentation uses the ladder's existing type, surface and motion tokens. */
.rules-modal__panel {
  animation: rules-panel-in var(--motion-card) var(--motion-curve) both;
}
.rules-modal__close {
  z-index: 3;
  cursor: pointer;
}
.rules-modal__close:hover { background: var(--color-surface-soft); }
.rules-modal__close:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}
.rules-modal__panel :deep(.match-format-editor) {
  max-height: calc(100dvh - clamp(36px, 8vw, 80px));
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border-strong) transparent;
  scroll-padding-block: 150px 88px;
  padding: 0 24px 24px;
  gap: 16px;
}
.rules-modal__panel :deep(.editor-intro) {
  position: sticky;
  top: 0;
  z-index: 2;
  margin-inline: -24px;
  padding: 24px 72px 20px 24px;
  border-bottom: var(--app-hairline);
  background: var(--color-surface);
  box-shadow: var(--flow-shadow-quiet);
}
.rules-modal__panel :deep(.editor-intro h2) {
  font-size: 24px;
  line-height: 1.25;
}
.rules-modal__panel :deep(.editor-intro > p:not(.editor-eyebrow)) {
  font-size: 13px;
  line-height: 1.5;
}
.rules-modal__panel :deep(.editor-eyebrow) {
  margin-bottom: 8px;
  font-size: var(--type-meta);
}
.rules-modal__panel :deep(.editor-fields) { gap: 12px; }
.rules-modal__panel :deep(.rule-card) {
  transition: border-color var(--motion-short) var(--motion-curve),
    box-shadow var(--motion-card) var(--motion-curve);
}
.rules-modal__panel :deep(.rule-card[open]) {
  border-color: var(--color-border-strong);
  box-shadow: var(--flow-shadow-hover);
}
.rules-modal__panel :deep(.rule-card summary) {
  min-height: 66px;
  padding: 12px 16px;
  gap: 12px;
  grid-template-columns: minmax(100px, 1fr) minmax(0, auto) 26px;
  transition: background var(--motion-short) var(--motion-curve);
}
.rules-modal__panel :deep(.rule-card summary:hover) { background: var(--color-surface-soft); }
.rules-modal__panel :deep(.rule-result) {
  padding: 4px 9px;
  border-radius: var(--app-inner-radius);
  background: var(--color-surface-soft);
  font-size: 12px;
}
.rules-modal__panel :deep(.rule-card[open] .rule-result) { color: var(--color-primary-strong); }
.rules-modal__panel :deep(.chevron) {
  transition: transform var(--motion-short) var(--motion-curve);
}
.rules-modal__panel :deep(.rule-body) {
  padding: 18px 16px;
  background: var(--color-surface);
  animation: rules-content-in var(--motion-card) var(--motion-curve);
}
.rules-modal__panel :deep(.help) { margin-bottom: 12px; }
.rules-modal__panel :deep(.inside-divider) { margin-block: 18px; }
.rules-modal__panel :deep(.option) {
  min-height: 78px;
  padding: 12px;
  gap: 10px;
  transition: border-color var(--motion-short) var(--motion-curve),
    background var(--motion-short) var(--motion-curve),
    box-shadow var(--motion-short) var(--motion-curve);
}
.rules-modal__panel :deep(.editor-fields:not(:disabled) .option:hover) {
  border-color: var(--color-border-strong);
  box-shadow: var(--flow-shadow-quiet);
}
.rules-modal__panel :deep(.editor-fields:not(:disabled) .option.active) {
  border-color: var(--color-primary);
}
.rules-modal__panel :deep(.plain-note) {
  margin-top: 12px;
  padding: 10px 12px;
  border: 0;
  border-left: 2px solid var(--color-border-strong);
  background: var(--color-surface-soft);
}
.rules-modal__panel :deep(.sub-rule) {
  padding: 14px;
  border-color: var(--color-border);
  background: var(--color-surface-soft);
  animation: rules-content-in var(--motion-card) var(--motion-curve);
}
.rules-modal__panel :deep(.final-summary) {
  margin-top: 0;
  padding: 16px;
  background: var(--color-surface-soft);
  box-shadow: none;
}
.rules-modal__panel :deep(.final-summary h3) { font-size: var(--type-card-title); }
.rules-modal__panel :deep(.final-summary dl) { margin-top: 12px; }
.rules-modal__panel :deep(.final-summary dl > div) { padding-block: 10px; }
.rules-modal__panel :deep(.final-summary dl > div:last-child) {
  border-bottom: 0;
  padding-bottom: 0;
}
.rules-modal__panel :deep(.editor-save) {
  position: sticky;
  bottom: 0;
  z-index: 2;
  min-height: var(--app-button-height);
  box-shadow: 0 0 0 12px var(--color-surface), var(--shadow-soft);
  cursor: pointer;
  transition: background var(--motion-short) var(--motion-curve),
    transform var(--motion-press) var(--motion-curve);
}
.rules-modal__panel :deep(.editor-save:hover) { background: var(--button-primary-bg-hover); }
.rules-modal__panel :deep(.editor-save:active) { transform: scale(0.99); }
@keyframes rules-panel-in {
  from { opacity: 0; transform: translateY(8px) scale(0.99); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes rules-content-in {
  from { opacity: 0; transform: translateY(3px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (max-width: 640px) {
  .rules-modal__panel { max-height: calc(100dvh - 24px); }
  .rules-modal__panel :deep(.match-format-editor) {
    max-height: calc(100dvh - 24px);
    padding: 0 16px max(24px, env(safe-area-inset-bottom));
  }
  .rules-modal__panel :deep(.editor-intro) {
    margin-inline: -16px;
    padding: 20px 58px 16px 16px;
  }
  .rules-modal__panel :deep(.editor-intro h2) { font-size: var(--type-section-title); }
  .rules-modal__panel :deep(.rule-card summary) {
    grid-template-columns: minmax(0, 1fr) 26px;
    gap: 6px 12px;
  }
  .rules-modal__panel :deep(.rule-result) { justify-self: start; }
}
@media (prefers-reduced-motion: reduce) {
  .rules-modal__panel,
  .rules-modal__close,
  .rules-modal__panel :deep(*) {
    animation: none;
    transition: none;
  }
}

.drawer-detail-skeleton {
  display: grid;
  gap: 24px;
  padding: 20px;
}

.drawer-detail-skeleton__section {
  display: grid;
  gap: 10px;
  min-height: 76px;
}

.drawer-detail-skeleton__section span {
  height: 16px;
  border-radius: 6px;
  background: var(--color-surface-soft);
}

.drawer-detail-skeleton__section span:first-child {
  width: 55%;
}

@media (prefers-reduced-motion: no-preference) {
  .admin-drawer--open .admin-drawer__panel {
    animation: drawer-detail-reveal 180ms cubic-bezier(.22, 1, .36, 1) both;
  }

  .drawer-detail-skeleton__section {
    animation: drawer-detail-pulse 900ms ease-in-out infinite alternate;
  }
}

@keyframes drawer-detail-reveal {
  from { opacity: 0; transform: translateY(2px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes drawer-detail-pulse {
  from { opacity: 0.5; }
  to { opacity: 1; }
}
.drawer-reveal-mask {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: grid;
  align-content: start;
  gap: 24px;
  padding: 20px;
  background: var(--color-surface);
  pointer-events: none;
}

.drawer-reveal-mask .drawer-detail-skeleton__section {
  opacity: 0;
  animation: drawer-mask-in 50ms ease-out 16ms forwards;
}

.admin-drawer__panel--revealing > :not(.drawer-reveal-mask) {
  opacity: 0;
}

@keyframes drawer-mask-in {
  to { opacity: 1; }
}
/* A mobile sheet uses the available screen and keeps actions comfortably tappable. */
@media (max-width: 767px) {
  .admin-drawer {
    padding-top: max(12px, env(safe-area-inset-top));
  }

  .admin-drawer__panel {
    width: 100%;
    max-height: calc(100dvh - max(12px, env(safe-area-inset-top)));
    padding: 20px 16px calc(20px + env(safe-area-inset-bottom));
    overflow-x: hidden;
    overscroll-behavior: contain;
    scroll-padding-bottom: calc(20px + env(safe-area-inset-bottom));
  }

  .admin-drawer__header > button {
    width: 44px;
    height: 44px;
    flex-basis: 44px;
  }

  .admin-drawer__panel :is(input, select, textarea) {
    min-width: 0;
    max-width: 100%;
    min-height: 44px;
    font-size: 16px;
  }

  .admin-drawer__panel button {
    min-height: 44px;
  }

  .drawer-reveal-mask {
    padding: 20px 16px calc(20px + env(safe-area-inset-bottom));
  }
}
/* Long names and labels must remain readable at narrow widths. */
.admin-drawer__header > div,
.matchup__person {
  min-width: 0;
}

.admin-drawer__header h2,
.matchup__person strong {
  white-space: normal;
  overflow: visible;
  overflow-wrap: anywhere;
  text-overflow: clip;
}

@media (max-width: 390px) {
  .matchup > div {
    flex-wrap: wrap;
  }

  .matchup__person {
    flex-basis: 100%;
  }

  .timing-choice button {
    padding: 16px;
    gap: 10px;
  }
}
/* Custom-match dialog: one scrolling settings area and an unobscured action. */
.rules-modal__panel {
  border-radius: 16px;
  background: var(--color-surface);
}

.rules-modal__panel :deep(.match-format-editor) {
  display: flex;
  flex-direction: column;
  height: min(760px, calc(100dvh - 64px));
  max-height: calc(100dvh - 64px);
  overflow: hidden;
  gap: 0;
  padding: 0;
}

.rules-modal__panel :deep(.editor-scroll-content) {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding: 24px;
  gap: 24px;
}

.rules-modal__panel :deep(.editor-intro) {
  position: static;
  margin: 0;
  padding: 0 44px 20px 0;
  border-bottom: 1px solid rgba(22, 61, 43, 0.065);
  box-shadow: none;
}

.rules-modal__panel :deep(.editor-eyebrow),
.rules-modal__panel :deep(.summary-left > small) {
  display: none;
}

.rules-modal__panel :deep(.editor-fields) {
  display: grid;
  min-width: 0;
  gap: 24px;
  flex-shrink: 0;
}

.rules-modal__panel :deep(.rule-card),
.rules-modal__panel :deep(.rule-card[open]) {
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: #f7f9f7;
  box-shadow: none;
}

.rules-modal__panel :deep(.rule-card summary) {
  min-height: 88px;
  padding: 18px;
  grid-template-columns: minmax(0, 1fr) auto 36px;
  gap: 12px;
}

.rules-modal__panel :deep(.summary-left strong) {
  font-size: 16px;
  font-weight: var(--font-weight-semibold);
}

.rules-modal__panel :deep(.chevron) {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  background: rgba(22, 61, 43, 0.05);
  border-radius: 10px;
}

.rules-modal__panel :deep(.rule-body) {
  padding: 20px 18px;
  border-top: 1px solid rgba(22, 61, 43, 0.065);
}

.rules-modal__panel :deep(.options) {
  gap: 16px;
}

.rules-modal__panel :deep(.option) {
  min-width: 0;
  min-height: 104px;
  padding: 18px;
  border-radius: 12px;
  white-space: normal;
}

.rules-modal__panel :deep(.option strong),
.rules-modal__panel :deep(.question) {
  font-size: 14px;
  line-height: 1.4;
}

.rules-modal__panel :deep(.option small),
.rules-modal__panel :deep(.help) {
  font-size: 12px;
  line-height: 1.5;
}

.rules-modal__panel :deep(.editor-fields:not(:disabled) .option.active) {
  border-color: #163d2b;
  background: #163d2b;
  color: #fff;
}

.rules-modal__panel :deep(.option.active strong),
.rules-modal__panel :deep(.option.active small) {
  color: #fff;
}

.rules-modal__panel :deep(.option.active input) {
  accent-color: #d8ff47;
}

.rules-modal__panel :deep(.editor-save) {
  position: static;
  flex: 0 0 auto;
  width: auto;
  min-height: 48px;
  margin: 16px 24px 20px;
  padding: 12px 20px;
  border: 1px solid #163d2b;
  border-radius: 12px;
  background: #163d2b;
  color: #fff;
  box-shadow: none;
  white-space: normal;
}

.rules-modal__panel :deep(.editor-save:hover) {
  background: #1d4432;
}

.rules-modal__close {
  width: 44px;
  height: 44px;
  border-radius: 12px;
}

@media (max-width: 640px) {
  .rules-modal__panel {
    width: 100%;
    max-height: calc(100dvh - env(safe-area-inset-top));
  }

  .rules-modal__panel :deep(.match-format-editor) {
    height: calc(100dvh - max(12px, env(safe-area-inset-top)));
    max-height: none;
    padding: 0;
  }

  .rules-modal__panel :deep(.editor-scroll-content) {
    padding: 20px 16px;
  }

  .rules-modal__panel :deep(.rule-card summary) {
    grid-template-columns: minmax(0, 1fr) 36px;
  }

  .rules-modal__panel :deep(.rule-result) {
    grid-column: 1;
    grid-row: 2;
    max-width: 100%;
    white-space: normal;
  }

  .rules-modal__panel :deep(.chevron) {
    grid-column: 2;
    grid-row: 1 / 3;
  }

  .rules-modal__panel :deep(.options) {
    grid-template-columns: minmax(0, 1fr);
  }

  .rules-modal__panel :deep(.editor-save) {
    margin: 12px 16px calc(16px + env(safe-area-inset-bottom));
  }

  .rules-modal__panel :deep(input[type='number']) {
    max-width: 100%;
    min-height: 44px;
    font-size: 16px;
  }
}
</style>
