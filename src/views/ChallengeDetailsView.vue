<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '../components/EmptyState.vue'
import PersonAvatar from '../components/PersonAvatar.vue'
import { useChallengeStore } from '../stores/challenge'
import { useMatchStore } from '../stores/match'
import { useNotificationStore } from '../stores/notification'
import { usePlayerStore } from '../stores/player'
import { formatAppDateTime } from '../utils/dateFormat'
import {
  canStartChallenge,
  challengeStateCopy,
  challengeViewState,
  isChallengeParticipant,
  TERMINAL_CHALLENGE_STATUSES,
} from '../utils/challenge/challengeLifecycle'

const route = useRoute()
const router = useRouter()
const challengeStore = useChallengeStore()
const matchStore = useMatchStore()
const notificationStore = useNotificationStore()
const playerStore = usePlayerStore()

const now = ref(Date.now())
const hasLoaded = ref(false)
const actionError = ref('')
const actionPending = ref(false)
const scheduleForm = reactive({ scheduledAt: '', court: '' })
let clockTimer = null

const challengeId = computed(() => String(route.params.challengeId || ''))
const challenge = computed(
  () => challengeStore.challenges.find((item) => item.id === challengeId.value) || null,
)
const match = computed(
  () => matchStore.matches.find((item) => item.challengeId === challengeId.value) || null,
)
const currentPlayer = computed(() => playerStore.currentPlayer)
const isParticipant = computed(() =>
  isChallengeParticipant(challenge.value, currentPlayer.value?.id),
)
const isChallenger = computed(() => challenge.value?.challengerId === currentPlayer.value?.id)
const opponentId = computed(() =>
  isChallenger.value ? challenge.value?.defenderId : challenge.value?.challengerId,
)
const opponent = computed(
  () => playerStore.players.find((player) => player.id === opponentId.value) || null,
)
const opponentName = computed(
  () =>
    opponent.value?.name ||
    (isChallenger.value ? challenge.value?.defenderName : challenge.value?.challengerName) ||
    'Club player',
)
const state = computed(() =>
  challengeViewState(challenge.value, match.value, currentPlayer.value?.id, now.value),
)
const stateCopy = computed(() => challengeStateCopy(state.value))
const isTerminal = computed(() => TERMINAL_CHALLENGE_STATUSES.includes(state.value))
const canStart = computed(() =>
  canStartChallenge(challenge.value, match.value, currentPlayer.value?.id, now.value),
)
const canConfirmResult = computed(
  () =>
    state.value === 'pending_review' &&
    match.value?.resultSubmittedBy &&
    match.value.resultSubmittedBy !== currentPlayer.value?.id,
)
const winnerName = computed(() => {
  if (!match.value?.winnerId) return ''
  return match.value.winnerId === challenge.value?.challengerId
    ? challenge.value?.challengerName
    : challenge.value?.defenderName
})
const myStartingRank = computed(() =>
  isChallenger.value
    ? challenge.value?.preMatchPositions?.challenger || challenge.value?.challengerRank
    : challenge.value?.preMatchPositions?.defender || challenge.value?.defenderRank,
)
const opponentStartingRank = computed(() =>
  isChallenger.value
    ? challenge.value?.preMatchPositions?.defender || challenge.value?.defenderRank
    : challenge.value?.preMatchPositions?.challenger || challenge.value?.challengerRank,
)
const myCurrentRank = computed(() => currentPlayer.value?.rank || myStartingRank.value)
const opponentCurrentRank = computed(() => opponent.value?.rank || opponentStartingRank.value)

function toLocalDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

async function runAction(action, successMessage) {
  actionError.value = ''
  actionPending.value = true
  try {
    const result = await action()
    if (!result) throw new Error(challengeStore.error || 'Unable to update this challenge.')
    if (successMessage) notificationStore.addToast({ message: successMessage, type: 'success' })
    await Promise.all([challengeStore.loadChallenges(), matchStore.loadMatches()])
    return result
  } catch (error) {
    actionError.value = error?.message || 'Unable to update this challenge.'
    return null
  } finally {
    actionPending.value = false
  }
}

async function acceptChallenge() {
  await runAction(
    () => challengeStore.acceptChallenge(challengeId.value, null, currentPlayer.value?.id),
    'Challenge accepted. Agree the match schedule next.',
  )
}

async function declineChallenge() {
  await runAction(
    () => challengeStore.declineChallenge(challengeId.value, currentPlayer.value?.id),
    'Challenge declined.',
  )
}

async function withdrawChallenge() {
  await runAction(
    () => challengeStore.withdrawChallenge(challengeId.value, currentPlayer.value?.id),
    'Challenge cancelled.',
  )
}

async function scheduleChallenge() {
  if (!scheduleForm.scheduledAt) {
    actionError.value = 'Choose a date and time for the match.'
    return
  }
  await runAction(
    () =>
      challengeStore.scheduleChallenge(challengeId.value, {
        actorId: currentPlayer.value?.id,
        scheduledAt: new Date(scheduleForm.scheduledAt).toISOString(),
        court: scheduleForm.court.trim(),
      }),
    'Match schedule confirmed.',
  )
}

async function startChallenge() {
  const result = await runAction(
    () => challengeStore.startChallenge(challengeId.value, currentPlayer.value?.id),
    'Match started.',
  )
  const matchId = result?.match?.id || match.value?.id
  if (matchId) router.push({ name: 'PlayMatch', params: { matchId } })
}

async function confirmResult() {
  await runAction(
    () => challengeStore.reviewChallenge(challengeId.value, currentPlayer.value?.id),
    'Result confirmed. Ladder positions are updated.',
  )
  await playerStore.loadPlayers()
}

function openMatchDetails() {
  if (match.value?.id) router.push({ name: 'MatchDetails', params: { matchId: match.value.id } })
}

function continueMatch() {
  if (match.value?.id) router.push({ name: 'PlayMatch', params: { matchId: match.value.id } })
}

async function loadDetails() {
  try {
    await Promise.all([
      playerStore.loadPlayers(),
      challengeStore.loadChallenges(),
      matchStore.loadMatches(),
    ])
    scheduleForm.scheduledAt = toLocalDateTime(challenge.value?.scheduledAt)
    scheduleForm.court = challenge.value?.court || match.value?.court || ''
  } finally {
    hasLoaded.value = true
  }
}

onMounted(() => {
  loadDetails()
  clockTimer = window.setInterval(() => {
    now.value = Date.now()
  }, 60_000)
})

onUnmounted(() => {
  if (clockTimer) window.clearInterval(clockTimer)
})
</script>

<template>
  <section class="challenge-details">
    <div v-if="!hasLoaded" class="details-loading" aria-label="Loading challenge">
      <span v-for="index in 4" :key="index" class="skeleton-line"></span>
    </div>

    <EmptyState
      v-else-if="!challenge"
      illustration="matches"
      title="Challenge not found"
      description="This challenge may have been removed or is no longer available."
      primary-action-label="Back to challenges"
      @primary-action="router.push({ name: 'Challenges' })"
    />

    <EmptyState
      v-else-if="!isParticipant"
      illustration="matches"
      title="This challenge is private"
      description="Only the two challenge players can view its match details and actions."
      primary-action-label="Back to challenges"
      @primary-action="router.push({ name: 'Challenges' })"
    />

    <template v-else>
      <RouterLink class="details-back" :to="{ name: 'Challenges' }">← All challenges</RouterLink>

      <section class="challenge-hero">
        <div class="challenge-hero__identity">
          <PersonAvatar
            :name="opponentName"
            :image="
              opponent?.imageUrl ||
              (isChallenger ? challenge.defenderImage : challenge.challengerImage)
            "
            :size="58"
          />
          <div>
            <p class="type-eyebrow">{{ stateCopy.label }}</p>
            <h1>{{ stateCopy.title }}</h1>
            <p>{{ stateCopy.description }}</p>
          </div>
        </div>
        <span class="status-pill" :data-state="state">{{ stateCopy.label }}</span>
      </section>

      <div class="details-grid">
        <section class="details-card opponent-card">
          <div class="card-heading">
            <div>
              <p class="type-eyebrow">Opponent</p>
              <h2>{{ opponentName }}</h2>
            </div>
            <span>Rank #{{ opponentCurrentRank || '—' }}</span>
          </div>
          <dl class="rank-grid">
            <div>
              <dt>Your starting position</dt>
              <dd>#{{ myStartingRank || '—' }}</dd>
            </div>
            <div>
              <dt>{{ opponentName }}’s starting position</dt>
              <dd>#{{ opponentStartingRank || '—' }}</dd>
            </div>
            <div v-if="state === 'completed'">
              <dt>Your current position</dt>
              <dd>#{{ myCurrentRank || '—' }}</dd>
            </div>
            <div v-if="state === 'completed'">
              <dt>{{ opponentName }}’s current position</dt>
              <dd>#{{ opponentCurrentRank || '—' }}</dd>
            </div>
          </dl>
        </section>

        <section class="details-card match-card">
          <div class="card-heading">
            <div>
              <p class="type-eyebrow">Match details</p>
              <h2>Club Ladder match</h2>
            </div>
          </div>
          <dl class="detail-rows">
            <div>
              <dt>Format</dt>
              <dd>
                {{ challenge.ladderConfigSnapshot?.matchFormatLabel || 'Best of 3 tie-break sets' }}
              </dd>
            </div>
            <div>
              <dt>Scoring</dt>
              <dd>
                {{
                  challenge.ladderConfigSnapshot?.scoring === 'noad'
                    ? 'No-ad scoring'
                    : 'Advantage scoring'
                }}
              </dd>
            </div>
            <div>
              <dt>Scheduled</dt>
              <dd>
                {{
                  challenge.scheduledAt
                    ? formatAppDateTime(challenge.scheduledAt)
                    : 'Not agreed yet'
                }}
              </dd>
            </div>
            <div>
              <dt>Court</dt>
              <dd>{{ challenge.court || match?.court || 'To be agreed' }}</dd>
            </div>
            <div v-if="challenge.playDeadline">
              <dt>Complete by</dt>
              <dd>{{ formatAppDateTime(challenge.playDeadline) }}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section class="details-card action-card" aria-live="polite">
        <p v-if="actionError" class="action-error" role="alert">{{ actionError }}</p>

        <div v-if="state === 'sent'" class="action-layout">
          <div>
            <h2>Waiting for {{ opponentName }}</h2>
            <p>You can cancel while the challenge is unanswered.</p>
          </div>
          <button
            class="button-secondary danger-action"
            type="button"
            :disabled="actionPending"
            @click="withdrawChallenge"
          >
            Cancel challenge
          </button>
        </div>

        <div v-else-if="state === 'received'" class="action-layout">
          <div>
            <h2>Respond to this challenge</h2>
            <p>
              Accepting keeps the club’s fixed match rules and moves both players to scheduling.
            </p>
          </div>
          <div class="action-buttons">
            <button
              class="button-secondary danger-action"
              type="button"
              :disabled="actionPending"
              @click="declineChallenge"
            >
              Decline
            </button>
            <button
              class="button-primary"
              type="button"
              :disabled="actionPending"
              @click="acceptChallenge"
            >
              Accept challenge
            </button>
          </div>
        </div>

        <form
          v-else-if="state === 'accepted_unscheduled'"
          class="schedule-form"
          @submit.prevent="scheduleChallenge"
        >
          <div>
            <h2>Agree the match schedule</h2>
            <p>Either player can enter the date, time, and optional court you agreed.</p>
          </div>
          <div class="schedule-fields">
            <label
              ><span>Date and time</span
              ><input v-model="scheduleForm.scheduledAt" type="datetime-local" required
            /></label>
            <label
              ><span>Court (optional)</span
              ><input
                v-model="scheduleForm.court"
                type="text"
                maxlength="80"
                placeholder="For example, Court 3"
            /></label>
          </div>
          <button class="button-primary" type="submit" :disabled="actionPending">
            Confirm schedule
          </button>
        </form>

        <div v-else-if="state === 'scheduled'" class="action-layout">
          <div>
            <h2>Scheduled for {{ formatAppDateTime(challenge.scheduledAt) }}</h2>
            <p>Start becomes available thirty minutes before your match.</p>
          </div>
          <span class="quiet-action">Waiting for match time</span>
        </div>

        <div v-else-if="state === 'ready'" class="action-layout">
          <div>
            <h2>Both players are ready</h2>
            <p>Start the shared live scoreboard when you are together on court.</p>
          </div>
          <button
            class="button-primary"
            type="button"
            :disabled="actionPending || !canStart"
            @click="startChallenge"
          >
            Start match
          </button>
        </div>

        <div v-else-if="state === 'live'" class="action-layout">
          <div>
            <h2>Match in progress</h2>
            <p>Continue scoring live, or open the result page once play is complete.</p>
          </div>
          <div class="action-buttons">
            <button class="button-secondary" type="button" @click="openMatchDetails">
              Record final result
            </button>
            <button class="button-primary" type="button" @click="continueMatch">
              Continue match
            </button>
          </div>
        </div>

        <div v-else-if="state === 'pending_review'" class="result-review">
          <div>
            <p class="type-eyebrow">Submitted result</p>
            <h2>{{ winnerName }} won</h2>
            <p class="final-score">{{ match?.score || 'Score awaiting review' }}</p>
          </div>
          <div class="action-buttons">
            <button class="button-secondary" type="button" @click="openMatchDetails">
              View result
            </button>
            <button
              v-if="canConfirmResult"
              class="button-primary"
              type="button"
              :disabled="actionPending"
              @click="confirmResult"
            >
              Confirm result
            </button>
            <span v-else class="quiet-action">Waiting for {{ opponentName }} to confirm</span>
          </div>
        </div>

        <div v-else-if="state === 'completed'" class="result-review">
          <div>
            <p class="type-eyebrow">Final result</p>
            <h2>{{ winnerName }} won</h2>
            <p class="final-score">{{ match?.score || 'Result confirmed' }}</p>
          </div>
          <div class="action-buttons">
            <button class="button-secondary" type="button" @click="openMatchDetails">
              View result
            </button>
            <RouterLink class="button-primary" :to="{ name: 'CreateChallenge' }"
              >Create another challenge</RouterLink
            >
          </div>
        </div>

        <div v-else-if="isTerminal" class="action-layout">
          <div>
            <h2>{{ stateCopy.title }}</h2>
            <p>{{ stateCopy.description }}</p>
          </div>
          <RouterLink class="button-primary" :to="{ name: 'CreateChallenge' }"
            >Create another challenge</RouterLink
          >
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.challenge-details,
.details-loading {
  display: grid;
  gap: 20px;
}
.details-back {
  width: fit-content;
  color: var(--color-primary-strong);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
}
.details-loading {
  padding: 24px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
}
.challenge-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 26px;
  border: 1px solid rgba(0, 181, 26, 0.16);
  border-radius: var(--app-card-radius);
  background: linear-gradient(135deg, rgba(0, 181, 26, 0.07), rgba(255, 211, 61, 0.09));
}
.challenge-hero__identity {
  display: flex;
  align-items: center;
  gap: 17px;
  min-width: 0;
}
.challenge-hero h1,
.challenge-hero p,
.card-heading h2,
.card-heading p,
.action-card h2,
.action-card p {
  margin: 0;
}
.challenge-hero h1 {
  margin-top: 5px;
  font-size: clamp(24px, 3.3vw, 34px);
}
.challenge-hero__identity > div > p:last-child {
  max-width: 680px;
  margin-top: 9px;
  color: var(--color-muted);
  font-size: 13px;
  line-height: 1.65;
}
.type-eyebrow {
  color: var(--color-primary-strong);
  font-size: 10px;
}
.status-pill {
  flex: 0 0 auto;
  padding: 7px 10px;
  border: 1px solid rgba(0, 181, 26, 0.2);
  border-radius: 999px;
  background: rgba(0, 181, 26, 0.08);
  color: var(--color-primary-strong);
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.status-pill[data-state='declined'],
.status-pill[data-state='cancelled'],
.status-pill[data-state='expired'] {
  border-color: var(--color-border);
  background: var(--color-surface);
  color: var(--color-muted);
}
.details-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.details-card {
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  box-shadow: var(--flow-shadow-quiet);
}
.card-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 17px;
}
.card-heading > div {
  display: grid;
  gap: 5px;
}
.card-heading h2 {
  font-size: 18px;
}
.card-heading > span {
  color: var(--color-primary-strong);
  font-size: 13px;
  font-weight: var(--font-weight-bold);
}
.rank-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
}
.rank-grid > div {
  display: grid;
  gap: 4px;
  padding: 12px;
  border-radius: var(--app-inner-radius);
  background: var(--color-surface-soft);
}
.rank-grid dt,
.detail-rows dt {
  color: var(--color-muted);
  font-size: 10px;
}
.rank-grid dd {
  margin: 0;
  color: var(--color-text);
  font-size: 19px;
  font-weight: var(--font-weight-bold);
}
.detail-rows {
  display: grid;
  margin: 0;
}
.detail-rows > div {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  padding: 9px 0;
  border-bottom: 1px solid var(--color-border);
}
.detail-rows > div:last-child {
  border-bottom: 0;
}
.detail-rows dd {
  margin: 0;
  color: var(--color-text-soft);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  text-align: right;
}
.action-card {
  padding: 22px;
}
.action-layout,
.result-review {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}
.action-card h2 {
  font-size: 18px;
}
.action-card h2 + p {
  margin-top: 7px;
  color: var(--color-muted);
  font-size: 12px;
  line-height: 1.55;
}
.action-buttons {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
.danger-action {
  color: #9a554f;
}
.quiet-action {
  color: var(--color-muted);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
}
.action-error {
  margin: 0 0 14px !important;
  padding: 10px 12px;
  border-radius: var(--app-inner-radius);
  background: rgba(154, 85, 79, 0.08);
  color: #9a554f !important;
  font-size: 11px !important;
}
.schedule-form {
  display: grid;
  gap: 17px;
}
.schedule-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.schedule-fields label {
  display: grid;
  gap: 6px;
}
.schedule-fields label span {
  color: var(--color-text-soft);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
}
.schedule-fields input {
  width: 100%;
  min-height: 44px;
  padding: 9px 11px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-inner-radius);
  background: var(--color-surface);
  color: var(--color-text);
}
.schedule-form > .button-primary {
  width: fit-content;
}
.result-review .type-eyebrow {
  margin-bottom: 5px;
}
.final-score {
  margin-top: 8px !important;
  color: var(--color-text) !important;
  font-size: 20px !important;
  font-weight: var(--font-weight-bold);
}
@media (max-width: 760px) {
  .challenge-hero,
  .challenge-hero__identity,
  .action-layout,
  .result-review {
    align-items: stretch;
    flex-direction: column;
  }
  .challenge-hero__identity {
    display: grid;
  }
  .status-pill {
    width: fit-content;
  }
  .details-grid,
  .schedule-fields {
    grid-template-columns: 1fr;
  }
  .action-buttons {
    justify-content: flex-start;
  }
  .action-buttons > * {
    flex: 1;
  }
  .schedule-form > .button-primary {
    width: 100%;
  }
}
@media (max-width: 430px) {
  .challenge-hero,
  .details-card {
    padding: 17px;
  }
  .rank-grid {
    grid-template-columns: 1fr;
  }
}
</style>
