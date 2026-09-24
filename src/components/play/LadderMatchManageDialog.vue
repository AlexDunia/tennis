<script setup>
import { computed, ref, watch } from 'vue'
import { useChallengeStore } from '../../stores/challenge'
import { usePlayerStore } from '../../stores/player'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  match: {
    type: Object,
    default: null,
  },
  mode: {
    type: String,
    default: 'reschedule',
  },
  courts: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['close', 'saved', 'cancelled'])

const challengeStore = useChallengeStore()
const playerStore = usePlayerStore()
const date = ref('')
const time = ref('')
const courtId = ref('')
const busy = ref(false)
const formError = ref('')

const isReschedule = computed(() => props.mode === 'reschedule')
const playerOneName = computed(
  () => props.match?.player1Name || props.match?.challengerName || 'Player 1',
)
const playerTwoName = computed(
  () => props.match?.player2Name || props.match?.defenderName || 'Player 2',
)
const today = computed(() => localDateValue(new Date()))
const scheduledDateTime = computed(() => localDateTime(date.value, time.value))
const canSaveSchedule = computed(
  () => Boolean(scheduledDateTime.value && scheduledDateTime.value.getTime() > Date.now()) && !busy.value,
)

function localDateValue(value) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-')
}

function localTimeValue(value) {
  return [String(value.getHours()).padStart(2, '0'), String(value.getMinutes()).padStart(2, '0')].join(
    ':',
  )
}

function localDateTime(dateValue, timeValue) {
  const [year, month, day] = String(dateValue).split('-').map(Number)
  const [hours, minutes] = String(timeValue).split(':').map(Number)

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes)
  ) {
    return null
  }

  const value = new Date(year, month - 1, day, hours, minutes, 0, 0)
  if (
    value.getFullYear() !== year ||
    value.getMonth() !== month - 1 ||
    value.getDate() !== day ||
    value.getHours() !== hours ||
    value.getMinutes() !== minutes
  ) {
    return null
  }

  return value
}

function matchCourtId(match) {
  if (match?.courtId) return String(match.courtId)
  if (typeof match?.court === 'object') return String(match.court?.id || match.court?.value || '')
  return match?.court ? String(match.court) : ''
}

function courtValue(court) {
  if (typeof court === 'object') return String(court?.id || court?.value || '')
  return String(court || '')
}

function courtLabel(court) {
  if (typeof court === 'object') return court?.name || court?.label || court?.id || ''
  return String(court || '')
}

function populateForm() {
  const scheduled = props.match?.scheduledAt ? new Date(props.match.scheduledAt) : null
  date.value = scheduled && !Number.isNaN(scheduled.getTime()) ? localDateValue(scheduled) : ''
  time.value = scheduled && !Number.isNaN(scheduled.getTime()) ? localTimeValue(scheduled) : ''
  courtId.value = matchCourtId(props.match)
  formError.value = ''
}

function close() {
  if (!busy.value) emit('close')
}

async function saveSchedule() {
  const scheduledAt = scheduledDateTime.value
  if (!scheduledAt || scheduledAt.getTime() <= Date.now()) {
    formError.value = 'Choose a future match date and time.'
    return
  }

  formError.value = ''
  busy.value = true

  try {
    const result = await challengeStore.updateAdminLadderMatchSchedule(props.match.challengeId, {
      scheduledAt: scheduledAt.toISOString(),
      courtId: courtId.value,
      actorId: playerStore.currentPlayerId || '',
    })

    if (result) {
      emit('saved', result)
      emit('close')
      return
    }

    formError.value = challengeStore.error || 'Unable to update the match schedule.'
  } catch (error) {
    formError.value = error?.message || 'Unable to update the match schedule.'
  } finally {
    busy.value = false
  }
}

async function cancelMatch() {
  formError.value = ''
  busy.value = true

  try {
    const result = await challengeStore.cancelAdminLadderMatch(props.match.challengeId, {
      actorId: playerStore.currentPlayerId || '',
    })

    if (result) {
      emit('cancelled', result)
      emit('close')
      return
    }

    formError.value = challengeStore.error || 'Unable to cancel this Ladder match.'
  } catch (error) {
    formError.value = error?.message || 'Unable to cancel this Ladder match.'
  } finally {
    busy.value = false
  }
}

watch(
  () => [props.open, props.match, props.mode],
  ([open, match]) => {
    if (open && match) populateForm()
  },
  { immediate: true },
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && match"
      class="ladder-match-manage-dialog__overlay"
      role="presentation"
      @click.self="close"
    >
      <section
        class="ladder-match-manage-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="isReschedule ? 'reschedule-match-title' : 'cancel-match-title'"
      >
        <form v-if="isReschedule" @submit.prevent="saveSchedule">
          <header class="ladder-match-manage-dialog__header">
            <div>
              <h2 id="reschedule-match-title">Reschedule match</h2>
              <p>{{ playerOneName }} <span>vs</span> {{ playerTwoName }}</p>
            </div>
          </header>

          <div class="ladder-match-manage-dialog__fields">
            <label>
              <span>Date</span>
              <input v-model="date" type="date" :min="today" :disabled="busy" required />
            </label>

            <label>
              <span>Time</span>
              <input v-model="time" type="time" :disabled="busy" required />
            </label>

            <label v-if="courts.length">
              <span>Court</span>
              <select v-model="courtId" :disabled="busy">
                <option value="">No court selected</option>
                <option v-for="court in courts" :key="courtValue(court)" :value="courtValue(court)">
                  {{ courtLabel(court) }}
                </option>
              </select>
            </label>
          </div>

          <p v-if="formError" class="ladder-match-manage-dialog__error" role="alert">
            {{ formError }}
          </p>

          <footer class="ladder-match-manage-dialog__actions">
            <button class="ladder-match-manage-dialog__button" type="button" :disabled="busy" @click="close">
              Close
            </button>
            <button
              class="ladder-match-manage-dialog__button ladder-match-manage-dialog__button--primary"
              type="submit"
              :disabled="!canSaveSchedule"
            >
              {{ busy ? 'Saving...' : 'Save schedule' }}
            </button>
          </footer>
        </form>

        <form v-else @submit.prevent="cancelMatch">
          <header class="ladder-match-manage-dialog__header">
            <div>
              <h2 id="cancel-match-title">Cancel match</h2>
              <p>{{ playerOneName }} <span>vs</span> {{ playerTwoName }}</p>
            </div>
          </header>

          <p class="ladder-match-manage-dialog__warning">
            This removes the match from the active Play list. The existing record is kept as cancelled.
          </p>

          <p v-if="formError" class="ladder-match-manage-dialog__error" role="alert">
            {{ formError }}
          </p>

          <footer class="ladder-match-manage-dialog__actions">
            <button class="ladder-match-manage-dialog__button" type="button" :disabled="busy" @click="close">
              Keep match
            </button>
            <button
              class="ladder-match-manage-dialog__button ladder-match-manage-dialog__button--danger"
              type="submit"
              :disabled="busy"
            >
              {{ busy ? 'Cancelling...' : 'Cancel match' }}
            </button>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.ladder-match-manage-dialog__overlay {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(18, 30, 22, 0.28);
}

.ladder-match-manage-dialog {
  width: min(480px, 100%);
  padding: 0;
  border: 1px solid var(--color-border, #dfe5e0);
  border-radius: 13px;
  background: #fff;
  box-shadow: 0 26px 80px rgba(19, 34, 24, 0.2);
}

.ladder-match-manage-dialog form {
  display: grid;
  gap: 18px;
  padding: 21px;
}

.ladder-match-manage-dialog__header h2,
.ladder-match-manage-dialog__header p,
.ladder-match-manage-dialog__warning,
.ladder-match-manage-dialog__error {
  margin: 0;
}

.ladder-match-manage-dialog__header h2 {
  color: #344039;
  font-size: 17px;
  font-weight: 600;
}

.ladder-match-manage-dialog__header p {
  margin-top: 5px;
  color: var(--color-muted, #738078);
  font-size: 12px;
}

.ladder-match-manage-dialog__header p span {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.ladder-match-manage-dialog__fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.ladder-match-manage-dialog__fields label {
  display: grid;
  gap: 6px;
}

.ladder-match-manage-dialog__fields label:last-child:nth-child(3) {
  grid-column: 1 / -1;
}

.ladder-match-manage-dialog__fields span {
  color: #5f6b63;
  font-size: 11px;
  font-weight: 600;
}

.ladder-match-manage-dialog__fields input,
.ladder-match-manage-dialog__fields select {
  width: 100%;
  min-height: 42px;
  padding: 0 10px;
  border: 1px solid #dfe5e0;
  border-radius: 8px;
  background: #fff;
  color: #465149;
  font: inherit;
}

.ladder-match-manage-dialog__warning {
  color: #66726a;
  font-size: 12px;
  line-height: 1.5;
}

.ladder-match-manage-dialog__error {
  color: #a0443c;
  font-size: 12px;
  line-height: 1.4;
}

.ladder-match-manage-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
}

.ladder-match-manage-dialog__button {
  min-height: 36px;
  padding: 0 13px;
  border: 1px solid #d8e0da;
  border-radius: 8px;
  background: #fff;
  color: #58645d;
  font-size: 11px;
  font-weight: 600;
}

.ladder-match-manage-dialog__button--primary {
  border-color: var(--color-primary, #167548);
  background: var(--color-primary, #167548);
  color: #fff;
}

.ladder-match-manage-dialog__button--danger {
  border-color: #d7b2ad;
  color: #9a4038;
}

.ladder-match-manage-dialog__button:focus-visible,
.ladder-match-manage-dialog__fields input:focus-visible,
.ladder-match-manage-dialog__fields select:focus-visible {
  outline: 2px solid var(--color-primary, #167548);
  outline-offset: 2px;
}

@media (max-width: 520px) {
  .ladder-match-manage-dialog__overlay {
    align-items: end;
    padding: 12px;
  }

  .ladder-match-manage-dialog form {
    padding: 18px;
  }

  .ladder-match-manage-dialog__fields {
    grid-template-columns: 1fr;
  }

  .ladder-match-manage-dialog__fields label:last-child:nth-child(3) {
    grid-column: auto;
  }

  .ladder-match-manage-dialog__actions {
    display: grid;
  }
}
</style>

