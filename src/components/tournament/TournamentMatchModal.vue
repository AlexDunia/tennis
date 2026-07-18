<script setup>
import { computed, reactive, watch } from 'vue'

const props = defineProps({
  match: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits({
  close: null,
  save: (payload) => payload && typeof payload === 'object',
  schedule: (payload) => payload && typeof payload === 'object',
})

const form = reactive({
  date: '',
  time: '',
  court: '',
  note: '',
  p1Sets: 2,
  p2Sets: 0,
  p1Games: '',
  p2Games: '',
  isWalkover: false,
  winnerId: '',
})

const isAlreadyScheduled = computed(() => Boolean(props.match.scheduledDate || props.match.scheduledAt))
const isEditingResult = computed(() =>
  ['completed', 'walkover'].includes(props.match.status) && Boolean(props.match.winnerId),
)
const hasScheduleChange = computed(() => Boolean(form.date || form.time || form.court))
const hasScore = computed(() => form.p1Sets !== '' && form.p2Sets !== '')
const winnerName = computed(() =>
  form.winnerId === props.match.player1Id ? props.match.player1Name : props.match.player2Name,
)
const modalInstruction = computed(() =>
  isEditingResult.value
    ? 'Update the saved result, adjust the schedule, or correct both at once.'
    : 'Enter the score, schedule the match, or do both at once.',
)
const submitLabel = computed(() => (isEditingResult.value ? 'Update Result' : 'Save Result'))
const scoreModeCopy = computed(() =>
  'Manual result uses total sets and total games. Use Live Board when you need deuce, advantage, or tie-break point history.',
)
const scoreError = computed(() => {
  const p1Sets = Number(form.p1Sets)
  const p2Sets = Number(form.p2Sets)
  const isValidScore =
    (p1Sets === 2 && [0, 1].includes(p2Sets)) || (p2Sets === 2 && [0, 1].includes(p1Sets))

  if (!isValidScore) {
    return 'Invalid set score. Use 2-0, 2-1, 0-2, or 1-2.'
  }

  if ((form.p1Games && !form.p2Games) || (!form.p1Games && form.p2Games)) {
    return 'Enter games for both players, or leave both blank.'
  }

  const hasGameTotals = form.p1Games !== '' && form.p2Games !== ''
  if (hasGameTotals && (Number(form.p1Games) < 0 || Number(form.p2Games) < 0)) {
    return 'Games cannot be negative.'
  }

  return ''
})
const isScheduleValid = computed(() => {
  if (!hasScheduleChange.value) return false
  if (isAlreadyScheduled.value && !form.note.trim()) return false
  return true
})
const isScoreValid = computed(() => hasScore.value && !scoreError.value && Boolean(form.winnerId))
const canSubmit = computed(() => isScheduleValid.value || isScoreValid.value)
const roundLabel = computed(() => props.match.matchCode || (props.match.groupId ? `Group ${props.match.groupId}` : props.match.round))

function setDefaults() {
  form.date = props.match.scheduledDate || ''
  form.time = props.match.scheduledTime || ''
  form.court = props.match.court || ''
  form.note = ''
  form.p1Sets = props.match.p1Sets ?? 2
  form.p2Sets = props.match.p2Sets ?? 0
  form.p1Games = props.match.p1Games ?? ''
  form.p2Games = props.match.p2Games ?? ''
  form.isWalkover = props.match.status === 'walkover'
  form.winnerId = props.match.winnerId || props.match.player1Id
}

function submitModal() {
  if (!canSubmit.value) return

  if (isScheduleValid.value) {
    emit('schedule', {
      date: form.date,
      time: form.time,
      court: form.court,
      note: form.note,
    })
  }

  if (isScoreValid.value) {
    emit('save', {
      p1Sets: Number(form.p1Sets),
      p2Sets: Number(form.p2Sets),
      p1Games: form.p1Games === '' ? null : Number(form.p1Games),
      p2Games: form.p2Games === '' ? null : Number(form.p2Games),
      winnerId: form.winnerId,
      status: form.isWalkover ? 'walkover' : 'completed',
    })
  }
}

watch(
  () => [form.p1Sets, form.p2Sets],
  () => {
    if (Number(form.p1Sets) > Number(form.p2Sets)) {
      form.winnerId = props.match.player1Id
    } else if (Number(form.p2Sets) > Number(form.p1Sets)) {
      form.winnerId = props.match.player2Id
    }
  },
)

watch(
  () => form.isWalkover,
  (isWalkover) => {
    if (isWalkover) {
      form.p1Sets = 2
      form.p2Sets = 0
      form.p1Games = 12
      form.p2Games = 0
      form.winnerId = props.match.player1Id
    }
  },
)

setDefaults()
</script>

<template>
  <div class="tournament-match-modal" role="dialog" aria-modal="true">
    <div class="tournament-match-modal__panel">
      <header class="tournament-match-modal__header">
        <div>
          <span class="t-section-kicker">{{ roundLabel }}</span>
          <h2>{{ match.player1Name }} vs {{ match.player2Name }}</h2>
          <p>{{ modalInstruction }}</p>
        </div>
        <button type="button" class="tournament-match-modal__close" aria-label="Close" @click="emit('close')">
          x
        </button>
      </header>

      <section class="tournament-match-modal__section">
        <h3>Score</h3>
        <div class="tournament-match-modal__score-entry">
          <label class="tournament-match-modal__score-player">
            <span>{{ match.player1Name }}</span>
            <input
              v-model.number="form.p1Sets"
              :class="{ 'tournament-match-modal__winner-input': form.winnerId === match.player1Id }"
              min="0"
              max="3"
              type="number"
            />
            <small>Sets</small>
          </label>
          <strong>vs</strong>
          <label class="tournament-match-modal__score-player">
            <span>{{ match.player2Name }}</span>
            <input
              v-model.number="form.p2Sets"
              :class="{ 'tournament-match-modal__winner-input': form.winnerId === match.player2Id }"
              min="0"
              max="3"
              type="number"
            />
            <small>Sets</small>
          </label>
        </div>
        <p class="tournament-match-modal__winner">Winner: {{ winnerName }}</p>
        <p v-if="scoreError" class="tournament-match-modal__error">{{ scoreError }}</p>

        <label class="tournament-match-modal__toggle">
          <input v-model="form.isWalkover" type="checkbox" />
          <span>Mark as walkover (opponent did not show)</span>
        </label>

        <div class="tournament-match-modal__subsection">
          <span>Games (optional - for standings tiebreakers)</span>
          <p class="tournament-match-modal__mode-copy">{{ scoreModeCopy }}</p>
          <div class="tournament-match-modal__grid">
            <label>
              <span>{{ match.player1Name }} games</span>
              <input v-model="form.p1Games" min="0" type="number" />
            </label>
            <label>
              <span>{{ match.player2Name }} games</span>
              <input v-model="form.p2Games" min="0" type="number" />
            </label>
          </div>
        </div>
      </section>

      <section class="tournament-match-modal__section">
        <h3>Schedule</h3>
        <div class="tournament-match-modal__grid">
          <label>
            <span>Date</span>
            <input v-model="form.date" type="date" />
          </label>
          <label>
            <span>Time</span>
            <input v-model="form.time" type="time" step="900" />
          </label>
          <label>
            <span>Court</span>
            <select v-model="form.court">
              <option value="">Select court</option>
              <option>Court 1</option>
              <option>Court 2</option>
              <option>Court 3</option>
              <option>Court 4</option>
              <option>Other</option>
            </select>
          </label>
        </div>
        <label class="tournament-match-modal__full">
          <span>Reschedule note</span>
          <textarea v-model="form.note" placeholder="Required when changing an existing schedule" />
        </label>
      </section>

      <footer class="tournament-match-modal__footer">
        <button type="button" class="t-button t-button--secondary" @click="emit('close')">
          Cancel
        </button>
        <button type="button" :disabled="!canSubmit" class="t-button t-button--primary" @click="submitModal">
          {{ submitLabel }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.tournament-match-modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  background: #ffffff;
  animation: modalBackdropIn 180ms ease both;
}

.tournament-match-modal__panel {
  display: grid;
  align-content: start;
  gap: 18px;
  overflow: auto;
  padding: 20px;
  background: #ffffff;
  animation: modalPanelIn 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.tournament-match-modal__header,
.tournament-match-modal__footer {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.tournament-match-modal__header h2,
.tournament-match-modal__header p,
.tournament-match-modal__section h3,
.tournament-match-modal__winner,
.tournament-match-modal__error {
  margin: 0;
}

.tournament-match-modal__header h2 {
  margin-top: 4px;
  color: var(--tournament-ink);
  font-size: 18px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.02em;
}

.tournament-match-modal__header p {
  margin-top: 4px;
  color: var(--tournament-muted);
  font-size: 13px;
}

.tournament-match-modal__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: var(--tournament-shell);
  color: var(--tournament-muted);
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
}

.tournament-match-modal__section,
.tournament-match-modal__subsection {
  display: grid;
  gap: 12px;
  border: 0.5px solid var(--tournament-line);
  border-radius: var(--app-card-radius);
  padding: 16px;
  background: #ffffff;
  animation: modalSectionIn 260ms ease both;
}

.tournament-match-modal__section h3 {
  font-size: 15px;
  font-weight: var(--font-weight-semibold);
}

.tournament-match-modal__subsection {
  border: none;
  background: var(--tournament-shell);
}

.tournament-match-modal__subsection > span {
  color: var(--tournament-muted);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.tournament-match-modal__mode-copy {
  margin: 0;
  color: var(--tournament-muted);
  font-size: 12px;
  font-weight: var(--font-weight-bold);
  line-height: 1.45;
}

.tournament-match-modal__grid {
  display: grid;
  gap: 12px;
}

.tournament-match-modal label {
  display: grid;
  gap: 6px;
  color: var(--tournament-muted);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
}

.tournament-match-modal input,
.tournament-match-modal select,
.tournament-match-modal textarea {
  min-height: 40px;
  width: 100%;
  border: 0.5px solid var(--tournament-line);
  border-radius: 10px;
  background: #ffffff;
  padding: 9px 12px;
  color: var(--tournament-ink);
  font-size: 14px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;
}

.tournament-match-modal input:focus,
.tournament-match-modal select:focus,
.tournament-match-modal textarea:focus {
  outline: none;
  border-color: var(--tournament-green);
  box-shadow: none;
}

.tournament-match-modal textarea {
  min-height: 72px;
  resize: vertical;
}

.tournament-match-modal__score-entry {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 16px;
  align-items: center;
}

.tournament-match-modal__score-player {
  justify-items: center;
  text-align: center;
}

.tournament-match-modal__score-player span {
  max-width: 100%;
  overflow: hidden;
  color: var(--tournament-ink);
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tournament-match-modal__score-player input {
  width: 70px;
  height: 62px;
  border-width: 2px;
  text-align: center;
  font-size: 24px;
  font-weight: var(--font-weight-semibold);
}

.tournament-match-modal__score-player input:focus {
  transform: translateY(-1px);
}

.tournament-match-modal__score-player small {
  color: var(--tournament-faint);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
}

.tournament-match-modal__winner-input {
  border-color: var(--tournament-green) !important;
  background: var(--tournament-green-soft) !important;
  box-shadow: none;
}

.tournament-match-modal__score-entry > strong {
  color: var(--tournament-faint);
  font-size: 20px;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
}

.tournament-match-modal__winner {
  color: var(--tournament-green-dark);
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
  text-align: center;
}

.tournament-match-modal__error {
  color: var(--tournament-red);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  text-align: center;
}

.tournament-match-modal__toggle {
  display: flex !important;
  grid-template-columns: auto 1fr;
  align-items: center;
  justify-content: flex-start;
  color: var(--tournament-ink) !important;
}

.tournament-match-modal__toggle input {
  width: 18px;
  min-height: 18px;
  accent-color: var(--tournament-green);
}

.tournament-match-modal__footer {
  align-items: center;
  padding-top: 2px;
}

@media (min-width: 768px) {
  .tournament-match-modal {
    place-items: center;
    background: rgba(0, 0, 0, 0.42);
    padding: 20px;
  }

  .tournament-match-modal__panel {
    width: min(520px, calc(100vw - 40px));
    max-height: min(90vh, 760px);
    border-radius: 18px;
    box-shadow: none;
  }

  .tournament-match-modal__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .tournament-match-modal__footer {
    flex-direction: column;
  }
}

@keyframes modalBackdropIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes modalPanelIn {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.985);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes modalSectionIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
