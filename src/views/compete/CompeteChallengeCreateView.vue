<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PersonAvatar from '../../components/PersonAvatar.vue'
import { useAdminStore } from '../../stores/admin'
import { useChallengeStore } from '../../stores/challenge'
import { useNotificationStore } from '../../stores/notification'
import { usePlayerStore } from '../../stores/player'
import {
  ACTIVE_LADDER_CHALLENGE_STATUSES,
  getActiveLadderConfig,
  ladderMatchConfig,
  ladderMovementFor,
  ladderWindowFor,
} from '../../config/ladder'
import { verifyLadderCreationAccess } from '../../services/LadderAccessService'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()
const challengeStore = useChallengeStore()
const notificationStore = useNotificationStore()
const playerStore = usePlayerStore()

const search = ref('')
const selectedOpponentId = ref('')
const accessChecking = ref(true)
const accessDecision = ref({ allowed: false, message: '' })
const submitError = ref('')
const form = reactive({ scheduledAt: '', court: '', note: '' })

const config = computed(() => getActiveLadderConfig())
const lockedMatchConfig = computed(() => ladderMatchConfig(config.value))
const currentPlayer = computed(() => playerStore.currentPlayer)
const activeChallenge = computed(() =>
  challengeStore.challenges.find(
    (challenge) =>
      ACTIVE_LADDER_CHALLENGE_STATUSES.includes(challenge.status) &&
      [challenge.challengerId, challenge.defenderId].includes(currentPlayer.value?.id),
  ),
)
const ladderWindow = computed(() => ladderWindowFor(currentPlayer.value, config.value))
const eligibleOpponents = computed(() => {
  const query = search.value.trim().toLowerCase()
  return playerStore.availableOpponents.filter(
    (player) => !query || `${player.name} ${player.rank}`.toLowerCase().includes(query),
  )
})
const selectedOpponent = computed(
  () => playerStore.players.find((player) => player.id === selectedOpponentId.value) || null,
)
const movement = computed(() =>
  ladderMovementFor(currentPlayer.value, selectedOpponent.value, config.value),
)
const canSubmit = computed(
  () =>
    accessDecision.value.allowed &&
    selectedOpponent.value &&
    !challengeStore.isLoading &&
    !accessChecking.value,
)

function chooseOpponent(player) {
  selectedOpponentId.value = player.id
  submitError.value = ''
}

function selectRequestedOpponent() {
  const requestedId = String(route.query.opponent || '')
  if (playerStore.availableOpponents.some((player) => player.id === requestedId)) {
    selectedOpponentId.value = requestedId
  }
}

async function checkAccess() {
  accessChecking.value = true
  accessDecision.value = await verifyLadderCreationAccess({
    player: currentPlayer.value,
    challenges: challengeStore.challenges,
  })
  accessChecking.value = false
}

async function submitChallenge() {
  if (!canSubmit.value) return
  submitError.value = ''
  const scheduledAt = form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null
  const created = await challengeStore.createChallenge({
    challengerId: currentPlayer.value.id,
    defenderId: selectedOpponent.value.id,
    scheduledAt,
    court: form.court.trim(),
    note: form.note.trim(),
    preMatchPositions: {
      challenger: currentPlayer.value.rank,
      defender: selectedOpponent.value.rank,
    },
    matchConfig: lockedMatchConfig.value,
  })
  if (!created) {
    submitError.value = challengeStore.error || 'Unable to send this challenge.'
    return
  }
  notificationStore.addToast({
    message: `${selectedOpponent.value.name} has been notified of your challenge.`,
    type: 'success',
  })
  router.push({ name: 'ChallengeDetails', params: { challengeId: created.id } })
}

watch(
  () => route.query.opponent,
  () => selectRequestedOpponent(),
)

onMounted(async () => {
  await Promise.all([playerStore.loadPlayers(), challengeStore.loadChallenges()])
  selectRequestedOpponent()
  await checkAccess()
})
</script>

<template>
  <section class="challenge-create">
    <header class="create-heading">
      <div>
        <p class="type-eyebrow">Club Ladder</p>
        <h1>Create a challenge</h1>
        <p>Choose an eligible opponent. Your club’s Ladder rules are applied automatically.</p>
      </div>
      <RouterLink class="button-secondary" :to="{ name: 'Rankings' }">Back to Ladder</RouterLink>
    </header>

    <div
      v-if="accessChecking || playerStore.isLoading"
      class="create-loading"
      aria-label="Checking Ladder access"
    >
      <span v-for="index in 4" :key="index" class="skeleton-line"></span>
    </div>

    <section v-else-if="!accessDecision.allowed" class="access-blocker" role="status">
      <div>
        <p class="type-eyebrow">Active challenge</p>
        <h2>Finish your current challenge first</h2>
        <p>{{ accessDecision.message }}</p>
      </div>
      <RouterLink
        v-if="activeChallenge"
        class="button-primary"
        :to="{ name: 'ChallengeDetails', params: { challengeId: activeChallenge.id } }"
        >View active challenge</RouterLink
      >
    </section>

    <form v-else class="create-layout" @submit.prevent="submitChallenge">
      <div class="create-main">
        <section class="create-card opponent-picker">
          <div class="card-heading">
            <div>
              <p class="type-eyebrow">1 · Opponent</p>
              <h2>Choose who to challenge</h2>
              <p v-if="ladderWindow">
                Your eligible window is rank #{{ ladderWindow.highest }}–#{{ ladderWindow.lowest }}.
              </p>
            </div>
          </div>
          <label class="search-field">
            <span class="visually-hidden">Search eligible players</span>
            <input
              v-model="search"
              type="search"
              placeholder="Search eligible players"
              autocomplete="off"
            />
          </label>
          <div
            v-if="eligibleOpponents.length"
            class="opponent-list"
            role="radiogroup"
            aria-label="Eligible Ladder opponents"
          >
            <button
              v-for="player in eligibleOpponents"
              :key="player.id"
              type="button"
              class="opponent-row"
              :class="{ 'opponent-row--selected': selectedOpponentId === player.id }"
              role="radio"
              :aria-checked="selectedOpponentId === player.id"
              @click="chooseOpponent(player)"
            >
              <PersonAvatar :name="player.name" :image="player.imageUrl" :size="42" />
              <span class="opponent-row__copy"
                ><strong>{{ player.name }}</strong
                ><small
                  >Rank #{{ player.rank }} · {{ player.division || 'Club Ladder' }}</small
                ></span
              >
              <span class="opponent-row__select">{{
                selectedOpponentId === player.id ? 'Selected' : 'Choose'
              }}</span>
            </button>
          </div>
          <p v-else class="empty-opponents">No eligible players match this search.</p>
        </section>

        <section class="create-card schedule-card">
          <div class="card-heading">
            <div>
              <p class="type-eyebrow">2 · Timing</p>
              <h2>Propose a schedule</h2>
              <p>Optional. Your opponent can accept first and agree the details later.</p>
            </div>
          </div>
          <div class="form-grid">
            <label
              ><span>Date and time</span><input v-model="form.scheduledAt" type="datetime-local"
            /></label>
            <label
              ><span>Court</span
              ><input
                v-model="form.court"
                type="text"
                maxlength="80"
                placeholder="For example, Court 3"
            /></label>
          </div>
          <label class="note-field"
            ><span>Message to opponent</span
            ><textarea
              v-model="form.note"
              rows="3"
              maxlength="500"
              placeholder="Add a short note (optional)"
            ></textarea>
          </label>
        </section>
      </div>

      <aside class="create-sidebar">
        <section class="rules-card">
          <div class="rules-card__heading">
            <span aria-hidden="true">🔒</span>
            <div>
              <p class="type-eyebrow">Club rules</p>
              <h2>Fixed by {{ adminStore.activeClub?.name || 'your club' }}</h2>
            </div>
          </div>
          <dl>
            <div>
              <dt>Match type</dt>
              <dd>Singles</dd>
            </div>
            <div>
              <dt>Format</dt>
              <dd>{{ config.matchFormatLabel }}</dd>
            </div>
            <div>
              <dt>Scoring</dt>
              <dd>{{ config.scoring === 'noad' ? 'No-ad' : 'Advantage' }}</dd>
            </div>
            <div>
              <dt>Reply within</dt>
              <dd>{{ config.responseHours }} hours</dd>
            </div>
            <div>
              <dt>Complete within</dt>
              <dd>{{ config.completionDays }} days</dd>
            </div>
          </dl>
          <p class="rules-note">
            Players cannot customize Ladder scoring. This keeps every match consistent with club
            administration.
          </p>
        </section>

        <section v-if="selectedOpponent" class="selection-summary">
          <p class="type-eyebrow">Challenge summary</p>
          <h2>You vs {{ selectedOpponent.name }}</h2>
          <p>{{ movement.label }}</p>
          <span
            >{{ selectedOpponent.name }} will be tagged and see this in Received challenges.</span
          >
        </section>

        <p v-if="submitError" class="submit-error" role="alert">{{ submitError }}</p>
        <button class="button-primary submit-challenge" type="submit" :disabled="!canSubmit">
          {{ challengeStore.isLoading ? 'Sending…' : 'Send challenge' }}
        </button>
      </aside>
    </form>
  </section>
</template>

<style scoped>
.challenge-create {
  display: grid;
  gap: 22px;
}
.create-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 10px 0 2px;
}
.create-heading > div {
  display: grid;
  max-width: 700px;
  gap: 9px;
}
.create-heading h1,
.create-heading p,
.card-heading h2,
.card-heading p,
.access-blocker h2,
.access-blocker p,
.rules-card h2,
.rules-card p,
.selection-summary h2,
.selection-summary p {
  margin: 0;
}
.create-heading h1 {
  font-size: clamp(28px, 4vw, 40px);
}
.create-heading > div > p:last-child {
  color: var(--color-muted);
  font-size: 14px;
  line-height: 1.6;
}
.type-eyebrow {
  color: var(--color-primary-strong);
  font-size: 10px;
}
.create-loading {
  display: grid;
  gap: 16px;
  padding: 24px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
}
.access-blocker {
  display: flex;
  min-height: 220px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 26px;
  border: 1px solid rgba(255, 211, 61, 0.3);
  border-radius: var(--app-card-radius);
  background: rgba(255, 211, 61, 0.08);
}
.access-blocker > div {
  display: grid;
  max-width: 650px;
  gap: 8px;
}
.access-blocker h2 {
  font-size: 22px;
}
.access-blocker p:last-child {
  color: var(--color-muted);
  font-size: 13px;
}
.create-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.7fr);
  align-items: start;
  gap: 18px;
}
.create-main,
.create-sidebar {
  display: grid;
  gap: 16px;
}
.create-sidebar {
  position: sticky;
  top: calc(var(--app-header-height) + 18px);
}
.create-card,
.rules-card,
.selection-summary {
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  box-shadow: var(--flow-shadow-quiet);
}
.card-heading {
  margin-bottom: 16px;
}
.card-heading > div {
  display: grid;
  gap: 6px;
}
.card-heading h2,
.rules-card h2,
.selection-summary h2 {
  font-size: 17px;
}
.card-heading p:last-child,
.rules-note,
.selection-summary p,
.selection-summary span {
  color: var(--color-muted);
  font-size: 11px;
  line-height: 1.55;
}
.search-field input,
.form-grid input,
.note-field textarea {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-inner-radius);
  background: var(--color-surface);
  color: var(--color-text);
}
.opponent-list {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}
.opponent-row {
  display: grid;
  width: 100%;
  min-height: 68px;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 11px 12px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  text-align: left;
}
.opponent-row--selected {
  border-color: rgba(0, 181, 26, 0.4);
  background: rgba(0, 181, 26, 0.035);
}
.opponent-row__copy {
  display: grid;
  min-width: 0;
  gap: 5px;
}
.opponent-row__copy strong,
.opponent-row__copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.opponent-row__copy strong {
  color: var(--color-text);
  font-size: 13px;
}
.opponent-row__copy small {
  color: var(--color-muted);
  font-size: 10px;
}
.opponent-row__select {
  color: var(--color-primary-strong);
  font-size: 10px;
  font-weight: var(--font-weight-bold);
}
.empty-opponents {
  margin: 14px 0 0;
  color: var(--color-muted);
  font-size: 12px;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.form-grid label,
.note-field {
  display: grid;
  gap: 6px;
}
.form-grid label > span,
.note-field > span {
  color: var(--color-text-soft);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
}
.note-field {
  margin-top: 12px;
}
.note-field textarea {
  resize: vertical;
}
.rules-card__heading {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 15px;
}
.rules-card__heading > div {
  display: grid;
  gap: 5px;
}
.rules-card dl {
  display: grid;
  margin: 0;
}
.rules-card dl > div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 9px 0;
  border-bottom: 1px solid var(--color-border);
}
.rules-card dt {
  color: var(--color-muted);
  font-size: 10px;
}
.rules-card dd {
  margin: 0;
  color: var(--color-text-soft);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  text-align: right;
}
.rules-note {
  margin-top: 14px !important;
  padding: 11px;
  border-radius: var(--app-inner-radius);
  background: var(--color-surface-soft);
}
.selection-summary {
  display: grid;
  gap: 7px;
}
.selection-summary span {
  margin-top: 3px;
}
.submit-error {
  margin: 0;
  padding: 10px 12px;
  border-radius: var(--app-inner-radius);
  background: rgba(154, 85, 79, 0.08);
  color: #9a554f;
  font-size: 11px;
}
.submit-challenge {
  width: 100%;
  min-height: 48px;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
@media (max-width: 900px) {
  .create-layout {
    grid-template-columns: 1fr;
  }
  .create-sidebar {
    position: static;
  }
}
@media (max-width: 620px) {
  .create-heading,
  .access-blocker {
    align-items: stretch;
    flex-direction: column;
  }
  .create-heading > .button-secondary,
  .access-blocker > .button-primary {
    width: 100%;
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
  .create-card,
  .rules-card,
  .selection-summary,
  .access-blocker {
    padding: 17px;
  }
}
</style>
