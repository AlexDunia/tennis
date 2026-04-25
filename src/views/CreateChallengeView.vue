<script setup>
// 1. IMPORTS
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChallengeStore } from '../stores/challenge'
import { usePlayerStore } from '../stores/player'
import { useNotificationStore } from '../stores/notification'
import BaseButton from '../components/BaseButton.vue'
import PersonAvatar from '../components/PersonAvatar.vue'

// 2. ROUTER / ROUTE
const route = useRoute()
const router = useRouter()

// 3. STORES
const playerStore = usePlayerStore()
const challengeStore = useChallengeStore()
const notificationStore = useNotificationStore()

// 4. REACTIVE STATE

// -- Opponent picker UI
const showPlayerPicker = ref(false)
const pickerSearch = ref('')

// -- Who
const opponentId = ref(route.query.opponent || '')

// -- Match type
const matchType = ref('singles') // 'singles' | 'doubles'

// -- Match format
const matchFormat = ref('best_of_3') // 'best_of_3' | 'best_of_5' | 'custom'
const customSets = ref(3)

// -- Set win rule
// 'standard'    = tiebreak at 6-6
// 'no_tiebreak' = keep playing until someone leads by 2
const setWinRule = ref('standard')

// -- Game scoring rule
// 'normal'       = 15, 30, 40, deuce, advantage
// 'sudden_death' = next point at deuce wins
const gameScoringRule = ref('normal')

// -- Final set rule
// 'same'            = same as other sets
// 'super_tiebreak'  = first to 10 points
const finalSetRule = ref('same')

// -- Doubles partners
const teammateId = ref('')
const opponentTeammateId = ref('')

// -- Scorer & note
const scorerId = ref('')
const note = ref('')

// -- Submit state
const isSubmitting = ref(false)

// 5. COMPUTED PROPERTIES

const currentPlayer = computed(() => playerStore.currentPlayer)
const allPlayers = computed(() => playerStore.players)

const opponentOptions = computed(() =>
  playerStore.availableOpponents.filter((p) =>
    p.name.toLowerCase().includes(pickerSearch.value.toLowerCase()),
  ),
)

const selectedOpponent = computed(
  () => allPlayers.value.find((p) => p.id === opponentId.value) ?? null,
)

const partnerPool = computed(() =>
  allPlayers.value.filter((p) => p.id !== currentPlayer.value?.id && p.id !== opponentId.value),
)

const scorerOptions = computed(() =>
  allPlayers.value.filter((p) => p.id !== currentPlayer.value?.id && p.id !== opponentId.value),
)

// Human-readable format for the VS preview pill
const formatLabel = computed(() => {
  const type = matchType.value === 'singles' ? 'Singles' : 'Doubles'
  if (matchFormat.value === 'custom') return `${type} · Best of ${customSets.value}`
  const sets = matchFormat.value === 'best_of_3' ? 3 : 5
  return `${type} · Best of ${sets}`
})

// Single source of truth for the payload
const matchConfig = computed(() => ({
  matchType: matchType.value,
  matchFormat: matchFormat.value === 'custom' ? `best_of_${customSets.value}` : matchFormat.value,
  setWinRule: setWinRule.value,
  gameScoringRule: gameScoringRule.value,
  finalSetRule: finalSetRule.value,
}))

const teams = computed(() => {
  if (matchType.value === 'singles') {
    return {
      teamA: [currentPlayer.value?.id].filter(Boolean),
      teamB: [opponentId.value].filter(Boolean),
    }
  }
  return {
    teamA: [currentPlayer.value?.id, teammateId.value].filter(Boolean),
    teamB: [opponentId.value, opponentTeammateId.value].filter(Boolean),
  }
})

const canSubmit = computed(() => {
  if (!opponentId.value || !currentPlayer.value || isSubmitting.value) return false
  if (matchType.value === 'doubles') {
    return Boolean(teammateId.value) && Boolean(opponentTeammateId.value)
  }
  return true
})

// 6. METHODS

const openPicker = () => {
  pickerSearch.value = ''
  showPlayerPicker.value = true
}

const closePicker = () => {
  showPlayerPicker.value = false
}

const selectOpponent = (id) => {
  opponentId.value = id
  closePicker()
}

const handleSubmit = async () => {
  if (!canSubmit.value) return
  isSubmitting.value = true

  const payload = {
    challengerId: currentPlayer.value.id,
    defenderId: opponentId.value,
    teams: teams.value,
    matchConfig: matchConfig.value,
    scorerId: scorerId.value || null,
    note: note.value.trim() || null,
  }

  const result = await challengeStore.createChallenge(payload)
  isSubmitting.value = false

  if (result) {
    notificationStore.addToast({
      message: 'Challenge sent! Awaiting response from your opponent.',
      type: 'success',
    })
    notificationStore.addNotification({
      title: 'Challenge created',
      message: `Your challenge against ${selectedOpponent.value?.name ?? 'your opponent'} has been sent.`,
      type: 'info',
    })
    router.push({ name: 'Challenges' })
  }
}

// 7. LIFECYCLE
onMounted(async () => {
  await playerStore.loadPlayers()
})
</script>

<template>
  <section class="create-challenge">
    <!-- ── Page intro ── -->
    <div class="intro">
      <h1 class="intro__heading">Send a Challenge</h1>
      <p class="intro__sub">Pick your opponent, set your terms, and let the ladder decide.</p>
    </div>

    <div class="layout">
      <!-- ══════════════════════════
           LEFT — Identity card
           ══════════════════════════ -->
      <div class="section-card identity-card">
        <!-- You -->
        <p class="kicker">Challenging as</p>
        <div class="player-row">
          <PersonAvatar
            :image="currentPlayer?.imageUrl || ''"
            :name="currentPlayer?.name || '?'"
            :size="48"
          />
          <div class="player-row__info">
            <p class="player-row__name">{{ currentPlayer?.name || 'Loading…' }}</p>
            <p class="player-row__rank">Rank #{{ currentPlayer?.rank || '—' }}</p>
          </div>
        </div>

        <div class="stat-row">
          <div class="stat stat--win">
            <span class="stat__value">{{ currentPlayer?.wins ?? '—' }}</span>
            <span class="stat__label">Wins</span>
          </div>
          <div class="stat stat--loss">
            <span class="stat__value">{{ currentPlayer?.losses ?? '—' }}</span>
            <span class="stat__label">Losses</span>
          </div>
          <div class="stat stat--neutral">
            <span class="stat__value">{{ currentPlayer?.matchesPlayed ?? '—' }}</span>
            <span class="stat__label">Played</span>
          </div>
        </div>

        <!-- VS preview — shown after opponent is selected -->
        <Transition name="slide-down">
          <div v-if="selectedOpponent" class="opponent-preview">
            <div class="opponent-preview__vs-badge">VS</div>

            <div class="player-row">
              <PersonAvatar
                :image="selectedOpponent.imageUrl || ''"
                :name="selectedOpponent.name"
                :size="48"
              />
              <div class="player-row__info">
                <p class="player-row__name">{{ selectedOpponent.name }}</p>
                <p class="player-row__rank">Rank #{{ selectedOpponent.rank }}</p>
              </div>
            </div>

            <div class="stat-row">
              <div class="stat stat--win">
                <span class="stat__value">{{ selectedOpponent.wins ?? '—' }}</span>
                <span class="stat__label">Wins</span>
              </div>
              <div class="stat stat--loss">
                <span class="stat__value">{{ selectedOpponent.losses ?? '—' }}</span>
                <span class="stat__label">Losses</span>
              </div>
              <div class="stat stat--neutral">
                <span class="stat__value">{{ selectedOpponent.matchesPlayed ?? '—' }}</span>
                <span class="stat__label">Played</span>
              </div>
            </div>

            <div class="format-pill">
              <span>🎾</span>
              <span>{{ formatLabel }}</span>
            </div>
          </div>
        </Transition>

        <!-- Nudge when no opponent chosen yet -->
        <p v-if="!selectedOpponent" class="identity-nudge">
          Select an opponent to see the matchup here.
        </p>
      </div>

      <!-- ══════════════════════════
           RIGHT — Challenge form
           ══════════════════════════ -->
      <div class="section-card challenge-form">
        <h3 class="form-heading">Challenge details</h3>

        <!-- ── OPPONENT ── -->
        <div class="form-field">
          <label class="form-field__label">
            Opponent
            <span class="form-field__hint">Within 3 ranks above you</span>
          </label>

          <!-- Selected strip -->
          <Transition name="fade">
            <div
              v-if="selectedOpponent"
              class="selected-strip"
              role="button"
              tabindex="0"
              @click="openPicker"
              @keydown.enter="openPicker"
            >
              <PersonAvatar
                :image="selectedOpponent.imageUrl || ''"
                :name="selectedOpponent.name"
                :size="32"
              />
              <div class="selected-strip__info">
                <span class="selected-strip__name">{{ selectedOpponent.name }}</span>
                <span class="selected-strip__meta">
                  Rank #{{ selectedOpponent.rank }} · {{ selectedOpponent.wins }}W
                  {{ selectedOpponent.losses }}L
                </span>
              </div>
              <span class="selected-strip__change">Change ›</span>
            </div>
          </Transition>

          <!-- Trigger when nothing selected -->
          <button v-if="!selectedOpponent" type="button" class="picker-trigger" @click="openPicker">
            <span class="picker-trigger__icon">👤</span>
            <span>Choose your opponent</span>
            <span class="picker-trigger__arrow">›</span>
          </button>

          <!-- Picker dropdown -->
          <Transition name="slide-down">
            <div v-if="showPlayerPicker" class="player-picker">
              <div class="player-picker__header">
                <input
                  v-model="pickerSearch"
                  class="player-picker__search"
                  placeholder="Search players…"
                  autofocus
                />
                <button type="button" class="player-picker__close" @click="closePicker">✕</button>
              </div>

              <div class="player-picker__list">
                <button
                  v-for="player in opponentOptions"
                  :key="player.id"
                  type="button"
                  :class="['picker-option', { 'picker-option--active': opponentId === player.id }]"
                  @click="selectOpponent(player.id)"
                >
                  <PersonAvatar :image="player.imageUrl || ''" :name="player.name" :size="36" />
                  <div class="picker-option__copy">
                    <span class="picker-option__name">{{ player.name }}</span>
                    <span class="picker-option__meta">
                      Rank #{{ player.rank }} · {{ player.wins }}W {{ player.losses }}L
                    </span>
                  </div>
                  <span v-if="opponentId === player.id" class="picker-option__check">✓</span>
                </button>

                <p v-if="opponentOptions.length === 0" class="picker-empty">No players found.</p>
              </div>
            </div>
          </Transition>
        </div>

        <!-- ── MATCH TYPE ── -->
        <div class="form-field">
          <label class="form-field__label">Who's playing?</label>
          <div class="toggle-group">
            <button
              type="button"
              :class="['toggle-opt', { 'toggle-opt--on': matchType === 'singles' }]"
              @click="matchType = 'singles'"
            >
              1 vs 1 &mdash; Singles
            </button>
            <button
              type="button"
              :class="['toggle-opt', { 'toggle-opt--on': matchType === 'doubles' }]"
              @click="matchType = 'doubles'"
            >
              2 vs 2 &mdash; Doubles
            </button>
          </div>
        </div>

        <!-- Doubles partner selectors -->
        <Transition name="slide-down">
          <div v-if="matchType === 'doubles'" class="inset-block">
            <p class="inset-block__label">Pick your teams</p>
            <div class="doubles-grid">
              <div class="form-field">
                <label class="form-field__label form-field__label--sm">Your partner</label>
                <select v-model="teammateId" class="form-select">
                  <option value="">Select partner</option>
                  <option v-for="p in partnerPool" :key="p.id" :value="p.id">
                    #{{ p.rank }} {{ p.name }}
                  </option>
                </select>
              </div>
              <div class="form-field">
                <label class="form-field__label form-field__label--sm">Their partner</label>
                <select v-model="opponentTeammateId" class="form-select">
                  <option value="">Select partner</option>
                  <option v-for="p in partnerPool" :key="p.id" :value="p.id">
                    #{{ p.rank }} {{ p.name }}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </Transition>

        <!-- ── HOW MANY SETS? ── -->
        <div class="form-field">
          <label class="form-field__label">How many sets to win the match?</label>
          <p class="form-field__desc">First player to win this many sets wins the match.</p>
          <div class="toggle-group">
            <button
              type="button"
              :class="['toggle-opt', { 'toggle-opt--on': matchFormat === 'best_of_3' }]"
              @click="matchFormat = 'best_of_3'"
            >
              First to 2 sets
            </button>
            <button
              type="button"
              :class="['toggle-opt', { 'toggle-opt--on': matchFormat === 'best_of_5' }]"
              @click="matchFormat = 'best_of_5'"
            >
              First to 3 sets
            </button>
            <button
              type="button"
              :class="['toggle-opt', { 'toggle-opt--on': matchFormat === 'custom' }]"
              @click="matchFormat = 'custom'"
            >
              Custom
            </button>
          </div>

          <!-- Custom stepper -->
          <Transition name="fade">
            <div v-if="matchFormat === 'custom'" class="inset-block">
              <p class="form-field__label form-field__label--sm">First to win how many sets?</p>
              <div class="stepper">
                <button
                  type="button"
                  class="stepper__btn"
                  :disabled="customSets <= 1"
                  @click="customSets--"
                >
                  −
                </button>
                <span class="stepper__value">{{ customSets }}</span>
                <button type="button" class="stepper__btn" @click="customSets++">+</button>
              </div>
            </div>
          </Transition>
        </div>

        <!-- ── WHAT HAPPENS AT 6–6? ── -->
        <div class="form-field">
          <label class="form-field__label">If a set reaches 6 games all, what happens?</label>
          <div class="toggle-group">
            <button
              type="button"
              :class="['toggle-opt', { 'toggle-opt--on': setWinRule === 'standard' }]"
              @click="setWinRule = 'standard'"
            >
              Play a tiebreak — first to 7 points wins
            </button>
            <button
              type="button"
              :class="['toggle-opt', { 'toggle-opt--on': setWinRule === 'no_tiebreak' }]"
              @click="setWinRule = 'no_tiebreak'"
            >
              Keep playing until someone leads by 2 games
            </button>
          </div>
        </div>

        <!-- ── DEUCE RULE ── -->
        <div class="form-field">
          <label class="form-field__label">When a game is tied at 40–40, who wins the game?</label>
          <div class="toggle-group">
            <button
              type="button"
              :class="['toggle-opt', { 'toggle-opt--on': gameScoringRule === 'normal' }]"
              @click="gameScoringRule = 'normal'"
            >
              First to win 2 points in a row
            </button>
            <button
              type="button"
              :class="['toggle-opt', { 'toggle-opt--on': gameScoringRule === 'sudden_death' }]"
              @click="gameScoringRule = 'sudden_death'"
            >
              Next point wins the game
            </button>
          </div>
        </div>

        <!-- ── FINAL SET RULE ── -->
        <div class="form-field">
          <label class="form-field__label">How should the final set end?</label>
          <p class="form-field__desc">
            This only applies to the deciding set if the match is tied.
          </p>
          <div class="toggle-group">
            <button
              type="button"
              :class="['toggle-opt', { 'toggle-opt--on': finalSetRule === 'same' }]"
              @click="finalSetRule = 'same'"
            >
              Same rules as other sets
            </button>
            <button
              type="button"
              :class="['toggle-opt', { 'toggle-opt--on': finalSetRule === 'super_tiebreak' }]"
              @click="finalSetRule = 'super_tiebreak'"
            >
              Super tiebreak — first to 10 points wins
            </button>
          </div>
        </div>

        <!-- ── SCORER ── -->
        <div class="form-field">
          <label class="form-field__label">
            Who will keep score?
            <span class="form-field__hint">Optional</span>
          </label>
          <select v-model="scorerId" class="form-select">
            <option value="">Decide on the day</option>
            <option v-for="p in scorerOptions" :key="p.id" :value="p.id">
              #{{ p.rank }} {{ p.name }}
            </option>
          </select>
        </div>

        <!-- ── NOTE ── -->
        <div class="form-field">
          <label class="form-field__label">
            Message to opponent
            <span class="form-field__hint">Optional</span>
          </label>
          <textarea
            v-model="note"
            class="form-textarea"
            placeholder="Add a note for your opponent…"
            rows="3"
          />
        </div>

        <!-- ── SUBMIT ── -->
        <BaseButton
          variant="primary"
          :disabled="!canSubmit"
          :loading="isSubmitting"
          full-width
          @click="handleSubmit"
        >
          <span v-if="isSubmitting">Sending…</span>
          <span v-else>Send Challenge</span>
        </BaseButton>

        <p class="disclaimer">Your opponent will be notified and has 48 hours to respond.</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ── Page ── */
.create-challenge {
  display: grid;
  gap: 1.75rem;
}

.intro {
  display: grid;
  gap: 0.3rem;
}

.intro__heading {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: -0.3px;
}

.intro__sub {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-muted);
}

.layout {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 1.25rem;
  align-items: start;
}

/* ── Card ── */
.section-card {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 18px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  padding: 1.5rem;
}

/* ── Identity card ── */
.identity-card {
  display: grid;
  gap: 1rem;
}

.kicker {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-muted);
}

.player-row {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.player-row__info {
  display: grid;
  gap: 0.1rem;
}

.player-row__name {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.player-row__rank {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-muted);
}

/* ── Stats ── */
.stat-row {
  display: flex;
  gap: 0.5rem;
}

.stat {
  flex: 1;
  text-align: center;
  padding: 0.55rem 0.4rem;
  border-radius: 10px;
  display: grid;
  gap: 0.1rem;
  border: 1px solid transparent;
}

.stat--win {
  background: rgba(0, 200, 83, 0.07);
  border-color: rgba(0, 200, 83, 0.12);
}

.stat--loss {
  background: rgba(239, 68, 68, 0.06);
  border-color: rgba(239, 68, 68, 0.1);
}

.stat--neutral {
  background: var(--color-surface-soft, #f6f7f8);
  border-color: var(--color-border);
}

.stat__value {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1;
}

.stat__label {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-muted);
}

/* ── Opponent preview ── */
.opponent-preview {
  display: grid;
  gap: 0.9rem;
  padding-top: 1rem;
  border-top: 1px dashed rgba(0, 0, 0, 0.08);
}

.opponent-preview__vs-badge {
  margin: 0 auto;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--color-muted);
  background: var(--color-surface-soft, #f6f7f8);
  border: 1px solid var(--color-border);
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  width: fit-content;
}

.format-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.77rem;
  font-weight: 600;
  color: #007a32;
  background: rgba(0, 200, 83, 0.09);
  border: 1px solid rgba(0, 200, 83, 0.18);
  padding: 0.28rem 0.75rem;
  border-radius: 999px;
  width: fit-content;
}

.identity-nudge {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-muted);
  text-align: center;
  padding: 0.75rem;
  border-radius: 10px;
  border: 1px dashed rgba(0, 0, 0, 0.08);
  background: var(--color-surface-soft, #f6f7f8);
}

/* ── Challenge form ── */
.challenge-form {
  display: grid;
  gap: 1.25rem;
}

.form-heading {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
}

/* ── Form field ── */
.form-field {
  display: grid;
  gap: 0.45rem;
}

.form-field__label {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.form-field__label--sm {
  font-size: 0.8rem;
}

.form-field__hint {
  font-size: 0.74rem;
  font-weight: 500;
  color: var(--color-muted);
}

.form-field__desc {
  margin: 0;
  font-size: 0.78rem;
  color: var(--color-muted);
  line-height: 1.5;
}

/* ── Picker trigger ── */
.picker-trigger {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  border: 1px dashed rgba(0, 0, 0, 0.1);
  background: var(--color-surface-soft, #f6f7f8);
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--color-muted);
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;
}

.picker-trigger:hover {
  border-color: rgba(0, 200, 83, 0.35);
  background: rgba(0, 200, 83, 0.03);
  color: var(--color-text);
}

.picker-trigger__icon {
  font-size: 1rem;
}

.picker-trigger__arrow {
  margin-left: auto;
  font-size: 1.1rem;
  color: var(--color-muted);
}

/* ── Selected strip ── */
.selected-strip {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.9rem;
  border-radius: 12px;
  border: 1px solid rgba(0, 200, 83, 0.28);
  background: rgba(0, 200, 83, 0.04);
  cursor: pointer;
  transition: background 0.14s ease;
}

.selected-strip:hover {
  background: rgba(0, 200, 83, 0.07);
}

.selected-strip__info {
  flex: 1;
  display: grid;
  gap: 0.1rem;
}

.selected-strip__name {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-text);
}

.selected-strip__meta {
  font-size: 0.75rem;
  color: var(--color-muted);
}

.selected-strip__change {
  font-size: 0.76rem;
  font-weight: 600;
  color: #007a32;
}

/* ── Player picker ── */
.player-picker {
  border: 1px solid rgba(0, 0, 0, 0.07);
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.09);
  overflow: hidden;
}

.player-picker__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0.9rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.player-picker__search {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.88rem;
  font-family: inherit;
  color: var(--color-text);
  outline: none;
}

.player-picker__search::placeholder {
  color: var(--color-muted);
}

.player-picker__close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--color-muted);
  padding: 0.2rem 0.4rem;
  border-radius: 6px;
  font-family: inherit;
  transition: background 0.12s ease;
}

.player-picker__close:hover {
  background: rgba(0, 0, 0, 0.05);
}

.player-picker__list {
  max-height: 220px;
  overflow-y: auto;
  padding: 0.4rem;
}

/* ── Picker option ── */
.picker-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition:
    background 0.12s ease,
    transform 0.12s ease;
}

.picker-option:hover {
  background: var(--color-surface-soft, #f6f7f8);
  transform: translateX(2px);
}

.picker-option--active {
  background: rgba(0, 200, 83, 0.06);
}

.picker-option__copy {
  flex: 1;
  display: grid;
  gap: 0.1rem;
}

.picker-option__name {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-text);
}

.picker-option__meta {
  font-size: 0.75rem;
  color: var(--color-muted);
}

.picker-option__check {
  font-size: 0.78rem;
  font-weight: 700;
  color: #007a32;
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 200, 83, 0.12);
  border-radius: 999px;
  flex-shrink: 0;
}

.picker-empty {
  margin: 0;
  padding: 1rem;
  text-align: center;
  font-size: 0.82rem;
  color: var(--color-muted);
}

/* ── Toggle group ── */
.toggle-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  background: var(--color-surface-soft, #f6f7f8);
  border-radius: 10px;
  padding: 3px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.toggle-opt {
  flex: 1;
  padding: 0.48rem 0.75rem;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  font-family: inherit;
  color: var(--color-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}

.toggle-opt:hover:not(.toggle-opt--on) {
  color: var(--color-text);
  background: rgba(0, 0, 0, 0.04);
}

.toggle-opt--on {
  background: #fff;
  color: #007a32;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* ── Inset block (reused for doubles + custom sets) ── */
.inset-block {
  padding: 1rem;
  border-radius: 12px;
  background: var(--color-surface-soft, #f6f7f8);
  border: 1px solid rgba(0, 0, 0, 0.05);
  display: grid;
  gap: 0.75rem;
}

.inset-block__label {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-muted);
}

.doubles-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

/* ── Number stepper ── */
.stepper {
  display: flex;
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
  width: fit-content;
}

.stepper__btn {
  width: 38px;
  height: 38px;
  border: none;
  background: transparent;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text);
  cursor: pointer;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.12s ease,
    color 0.12s ease;
}

.stepper__btn:hover:not(:disabled) {
  background: rgba(0, 200, 83, 0.07);
  color: #007a32;
}

.stepper__btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.stepper__value {
  width: 44px;
  text-align: center;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  border-left: 1px solid var(--color-border);
  border-right: 1px solid var(--color-border);
  line-height: 38px;
}

/* ── Select ── */
.form-select {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: #fff;
  padding: 0 14px;
  min-height: 40px;
  font-size: 0.88rem;
  color: var(--color-text);
  font-family: inherit;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 32px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.form-select:focus {
  outline: none;
  border-color: rgba(0, 200, 83, 0.4);
  box-shadow: 0 0 0 4px rgba(0, 200, 83, 0.08);
}

/* ── Textarea ── */
.form-textarea {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: #fff;
  padding: 0.75rem 0.9rem;
  font-size: 0.88rem;
  color: var(--color-text);
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
  line-height: 1.55;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.form-textarea:focus {
  outline: none;
  border-color: rgba(0, 200, 83, 0.4);
  box-shadow: 0 0 0 4px rgba(0, 200, 83, 0.08);
}

/* ── Disclaimer ── */
.disclaimer {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-muted);
  text-align: center;
}

/* ── Transitions ── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* ── Responsive ── */
@media (max-width: 860px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .doubles-grid {
    grid-template-columns: 1fr;
  }
}
</style>
