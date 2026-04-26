<script setup>
// 1. IMPORTS
import { computed, onMounted, ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useChallengeStore } from '../stores/challenge'
import { useMatchStore } from '../stores/match'
import { usePlayerStore } from '../stores/player'
import { useNotificationStore } from '../stores/notification'
import ChallengeCard from '../components/ChallengeCard.vue'

// 4. ROUTER
const router = useRouter()

// 5. STORES
const challengeStore = useChallengeStore()
const matchStore = useMatchStore()
const playerStore = usePlayerStore()
const notificationStore = useNotificationStore()

// 6. REACTIVE STATE
const tabs = [
  { label: 'All', value: 'all' },
  { label: 'Awaiting', value: 'awaiting' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Pending Review', value: 'pending_review' },
]

const highlightedId = ref(null) // which card gets the focus ring
const modalChallenge = ref(null) // challenge shown in popup
const cardRefs = ref({}) // map of challenge.id → DOM element

// 7. COMPUTED
const visibleChallenges = computed(() => challengeStore.filteredChallenges)

const tabCount = computed(() => ({
  all: challengeStore.challenges.length,
  awaiting: challengeStore.summaryCounts.awaiting,
  scheduled: challengeStore.summaryCounts.scheduled,
  pending_review: challengeStore.summaryCounts.pendingReview,
}))

const currentPlayer = computed(() => playerStore.currentPlayer)

const heroInitials = computed(() => {
  if (!currentPlayer.value?.name) return '??'
  const parts = currentPlayer.value.name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return currentPlayer.value.name.slice(0, 2).toUpperCase()
})

const pendingChallenge = computed(
  () => challengeStore.challenges.find((c) => c.status === 'awaiting') ?? null,
)

// 8. METHODS

// "View" in pending reply card → scroll + highlight → then open modal
const handlePendingView = async () => {
  const challenge = pendingChallenge.value
  if (!challenge) return

  // Switch to the "All" tab so the card is visible
  challengeStore.setFilter('all')

  await nextTick()

  const el = cardRefs.value[challenge.id]
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    highlightedId.value = challenge.id

    // After 3.5s open the modal, remove highlight
    setTimeout(() => {
      modalChallenge.value = challenge
      highlightedId.value = null
    }, 3500)
  }
}

const closeModal = () => {
  modalChallenge.value = null
}

const handleAccept = (challengeId) => {
  challengeStore.acceptChallenge(challengeId).then((data) => {
    if (data) {
      closeModal()
      matchStore.loadMatches()
      notificationStore.addToast({
        message: 'Challenge accepted. Match has been scheduled.',
        type: 'success',
      })
      notificationStore.addNotification({
        title: 'Challenge accepted',
        message: 'You accepted a challenge and the match is now scheduled.',
        type: 'success',
      })
    }
  })
}

const handleDecline = (challengeId) => {
  challengeStore.declineChallenge(challengeId).then((data) => {
    if (data) {
      closeModal()
      notificationStore.addToast({ message: 'Challenge declined.', type: 'warning' })
      notificationStore.addNotification({
        title: 'Challenge declined',
        message: 'You declined the invitation, and the challenger has been notified.',
        type: 'warning',
      })
    }
  })
}

const handleReview = (challengeId) => {
  challengeStore.reviewChallenge(challengeId).then((data) => {
    if (data) {
      closeModal()
      matchStore.loadMatches()
      notificationStore.addToast({
        message: 'Match review complete. Ladder standings updated.',
        type: 'success',
      })
      notificationStore.addNotification({
        title: 'Match reviewed',
        message: 'The result has been reviewed and ladder rankings updated.',
        type: 'info',
      })
    }
  })
}

const handleDetails = (challengeId) => {
  const match = matchStore.matches.find((item) => item.challengeId === challengeId)
  if (match) {
    router.push({ name: 'MatchDetails', params: { matchId: match.id } })
  }
}

const loadChallengesView = async () => {
  await Promise.all([challengeStore.loadChallenges(), matchStore.loadMatches()])
}

// 10. LIFECYCLE
onMounted(() => loadChallengesView())

// (already declared above — these are accessed via template expressions)

const getInitials = (name) => {
  const parts = (name ?? '').trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (name ?? '').slice(0, 2).toUpperCase()
}

const formatDate = (iso) => {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

const modalFormatLabel = computed(() => {
  const cfg = modalChallenge.value?.matchConfig
  if (!cfg) return 'Singles'
  const type = cfg.matchType === 'doubles' ? 'Doubles' : 'Singles'
  const fmt =
    cfg.matchFormat === 'best_of_5'
      ? 'Best of 5'
      : cfg.matchFormat === 'best_of_3'
        ? 'Best of 3'
        : (cfg.matchFormat ?? 'Best of 3')
  return `${type} · ${fmt}`
})

const modalSetLabel = computed(() => {
  const cfg = modalChallenge.value?.matchConfig
  if (!cfg) return ''
  const deuce =
    cfg.gameScoringRule === 'sudden_death' ? 'Sudden death at deuce' : 'Advantage at deuce'
  const tb = cfg.setWinRule === 'no_tiebreak' ? 'No tiebreak' : 'Tiebreak at 6–6'
  const final = cfg.finalSetRule === 'super_tiebreak' ? ' · Super tiebreak final set' : ''
  return `${tb} · ${deuce}${final}`
})
</script>

<template>
  <section class="challenges">
    <!-- ── Summary row ── -->
    <div class="summary-row">
      <!-- Hero card -->
      <div v-if="currentPlayer" class="hero-card">
        <div class="hero-label">Your Position</div>
        <div class="hero-identity">
          <div class="hero-avatar">{{ heroInitials }}</div>
          <div>
            <div class="hero-name">{{ currentPlayer.name }}</div>
            <div class="hero-sub">Rank #{{ currentPlayer.rank }}</div>
          </div>
        </div>
      </div>

      <!-- Pending reply card -->
      <div class="next-card">
        <div class="next-card-label">Pending reply</div>

        <template v-if="pendingChallenge">
          <div class="pending-row">
            <div class="pending-info">
              <div class="pending-name">{{ pendingChallenge.challengerName }}</div>
              <div class="pending-meta">
                Rank #{{ pendingChallenge.challengerRank }} · Awaiting response
              </div>
            </div>
            <button class="ch-btn ch-btn--ghost" @click="handlePendingView">View</button>
          </div>
          <div class="pending-footer">
            <svg
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              style="flex-shrink: 0"
            >
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3.5l2 1.5" stroke-linecap="round" />
            </svg>
            Awaiting your response
          </div>
        </template>

        <p v-else class="no-pending">No pending replies right now.</p>
      </div>
    </div>

    <!-- ── Tabs ── -->
    <div class="tabs-wrap">
      <div class="tabs-row" role="tablist">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          :class="['ch-tab', { 'ch-tab--active': challengeStore.filterStatus === tab.value }]"
          type="button"
          role="tab"
          :aria-selected="challengeStore.filterStatus === tab.value"
          @click="challengeStore.setFilter(tab.value)"
        >
          <svg
            v-if="tab.value === 'all'"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            class="ch-tab__icon"
          >
            <rect x="2" y="2" width="5" height="5" rx="1.2" />
            <rect x="9" y="2" width="5" height="5" rx="1.2" />
            <rect x="2" y="9" width="5" height="5" rx="1.2" />
            <rect x="9" y="9" width="5" height="5" rx="1.2" />
          </svg>
          <svg
            v-else-if="tab.value === 'awaiting'"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            class="ch-tab__icon"
          >
            <circle cx="8" cy="8" r="6" />
            <path d="M8 5v3.5l2 1.5" stroke-linecap="round" />
          </svg>
          <svg
            v-else-if="tab.value === 'scheduled'"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            class="ch-tab__icon"
          >
            <rect x="2" y="3" width="12" height="11" rx="2" />
            <path d="M5 1v3M11 1v3M2 7h12" stroke-linecap="round" />
          </svg>
          <svg
            v-else-if="tab.value === 'pending_review'"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            class="ch-tab__icon"
          >
            <circle cx="8" cy="8" r="6" />
            <path d="M8 5v3M8 11v.5" stroke-linecap="round" />
          </svg>

          {{ tab.label }}
          <span v-if="tabCount[tab.value] > 0" class="ch-tab__chip">{{ tabCount[tab.value] }}</span>
        </button>
      </div>
    </div>

    <!-- ── Loading ── -->
    <div v-if="challengeStore.isLoading" class="ch-loading">
      <svg
        width="28"
        height="28"
        viewBox="0 0 16 16"
        fill="none"
        stroke="#7b8794"
        stroke-width="1.5"
        class="ch-loading__spinner"
      >
        <circle cx="8" cy="8" r="6" stroke-dasharray="28" stroke-dashoffset="10" />
      </svg>
      <p>Loading challenges…</p>
    </div>

    <!-- ── Challenge list ── -->
    <div v-else class="cards-list">
      <div v-if="visibleChallenges.length === 0" class="ch-empty">
        <div class="ch-empty__icon-wrap">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#a8b3bc"
            stroke-width="1.4"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M8 12h8M12 8v8" stroke-linecap="round" />
          </svg>
        </div>
        <p class="ch-empty__title">No challenges here</p>
        <p class="ch-empty__copy">
          {{
            challengeStore.filterStatus === 'all'
              ? 'No challenges yet. Head to Rankings to issue one.'
              : `No challenges with status "${challengeStore.filterStatus}".`
          }}
        </p>
      </div>

      <div
        v-for="(challenge, index) in visibleChallenges"
        :key="challenge.id"
        :ref="
          (el) => {
            if (el) cardRefs[challenge.id] = el
          }
        "
        :class="['card-wrapper', { 'card-wrapper--highlighted': highlightedId === challenge.id }]"
        :style="{ animationDelay: `${index * 60}ms` }"
      >
        <ChallengeCard
          :challenge="challenge"
          :challengerName="challenge.challengerName"
          :defenderName="challenge.defenderName"
          :challengerImage="challenge.challengerImage"
          :defenderImage="challenge.defenderImage"
          :showAccept="challenge.status === 'awaiting'"
          :showDecline="
            challenge.status === 'awaiting' &&
            challenge.defenderId === playerStore.currentPlayer?.id
          "
          :showReview="challenge.status === 'pending_review'"
          :showDetails="challenge.status !== 'awaiting'"
          @accept="handleAccept"
          @decline="handleDecline"
          @review="handleReview"
          @details="handleDetails"
        />
      </div>
    </div>

    <!-- ── Challenge detail modal ── -->
    <Transition name="modal">
      <div v-if="modalChallenge" class="modal-backdrop" @click.self="closeModal">
        <div class="modal">
          <!-- Modal header -->
          <div class="modal__header">
            <div class="modal__title-group">
              <span class="modal__kicker">Challenge details</span>
              <h2 class="modal__title">
                {{ modalChallenge.challengerName }} vs {{ modalChallenge.defenderName }}
              </h2>
            </div>
            <button class="modal__close" @click="closeModal" aria-label="Close">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <!-- Players -->
          <div class="modal__matchup">
            <div class="modal__player">
              <div class="modal__avatar modal__avatar--green">
                {{ getInitials(modalChallenge.challengerName) }}
              </div>
              <div>
                <div class="modal__player-name">{{ modalChallenge.challengerName }}</div>
                <div class="modal__player-meta">
                  Challenger · Rank #{{ modalChallenge.challengerRank }}
                </div>
              </div>
            </div>
            <div class="modal__vs">VS</div>
            <div class="modal__player modal__player--right">
              <div class="modal__avatar modal__avatar--blue">
                {{ getInitials(modalChallenge.defenderName) }}
              </div>
              <div>
                <div class="modal__player-name">{{ modalChallenge.defenderName }}</div>
                <div class="modal__player-meta">
                  Defender · Rank #{{ modalChallenge.defenderRank }}
                </div>
              </div>
            </div>
          </div>

          <!-- Details grid -->
          <div class="modal__details">
            <div class="modal__detail-item">
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="#7b8794"
                stroke-width="1.6"
              >
                <circle cx="8" cy="8" r="6" />
                <path d="M3.5 8 Q5.5 5 8 8 Q10.5 11 12.5 8" stroke-linecap="round" />
              </svg>
              <div>
                <span class="modal__detail-label">Match type</span>
                <span class="modal__detail-value">{{ modalFormatLabel }}</span>
              </div>
            </div>

            <div class="modal__detail-item">
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="#7b8794"
                stroke-width="1.6"
              >
                <path d="M4 13V6M7 13V3M10 13V7M13 13V9" stroke-linecap="round" />
              </svg>
              <div>
                <span class="modal__detail-label">Scorer</span>
                <span
                  class="modal__detail-value"
                  :class="{ 'modal__detail-value--muted': !modalChallenge.scorerName }"
                >
                  {{ modalChallenge.scorerName || 'Not assigned' }}
                </span>
              </div>
            </div>

            <div v-if="modalChallenge.scheduledAt" class="modal__detail-item">
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="#7b8794"
                stroke-width="1.6"
              >
                <rect x="2" y="3" width="12" height="11" rx="2" />
                <path d="M5 1v3M11 1v3M2 7h12" stroke-linecap="round" />
              </svg>
              <div>
                <span class="modal__detail-label">Scheduled</span>
                <span class="modal__detail-value">{{
                  formatDate(modalChallenge.scheduledAt)
                }}</span>
              </div>
            </div>

            <div v-if="modalChallenge.matchConfig" class="modal__detail-item">
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="#7b8794"
                stroke-width="1.6"
              >
                <rect x="2" y="2" width="12" height="12" rx="2" />
                <path d="M5 8h6M8 5v6" stroke-linecap="round" />
              </svg>
              <div>
                <span class="modal__detail-label">Rules</span>
                <span class="modal__detail-value">{{ modalSetLabel }}</span>
              </div>
            </div>

            <div v-if="modalChallenge.note" class="modal__detail-item modal__detail-item--full">
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="#7b8794"
                stroke-width="1.6"
              >
                <path d="M2 4h12M2 8h8M2 12h5" stroke-linecap="round" />
              </svg>
              <div>
                <span class="modal__detail-label">Note</span>
                <span class="modal__detail-value modal__detail-value--note">{{
                  modalChallenge.note
                }}</span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="modal__actions">
            <button
              v-if="modalChallenge.defenderId === playerStore.currentPlayer?.id"
              class="cc-btn cc-btn--danger"
              @click="handleDecline(modalChallenge.id)"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round" />
              </svg>
              Decline
            </button>
            <button
              v-if="modalChallenge.defenderId === playerStore.currentPlayer?.id"
              class="cc-btn cc-btn--primary"
              @click="handleAccept(modalChallenge.id)"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M3 8l4 4 6-7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              Accept challenge
            </button>
            <button v-else class="cc-btn cc-btn--ghost" @click="closeModal">Close</button>
          </div>
        </div>
      </div>
    </Transition>
  </section>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');

/* ── ROOT ── */
.challenges {
  font-family: 'Poppins', sans-serif;
  color: #0f1720;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* ── SUMMARY ROW ── */
.summary-row {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 18px;
}

/* ── HERO CARD ── */
.hero-card {
  position: relative;
  border-radius: 18px;
  overflow: hidden;
  padding: 24px 26px;
  color: #fff;
  min-height: 160px;
}

.hero-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: url('https://res.cloudinary.com/dnuhjsckk/image/upload/v1777007467/tennis-ball-field_ayz5iv.jpg')
    center/cover no-repeat;
  z-index: 0;
}

.hero-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1;
}

.hero-card * {
  position: relative;
  z-index: 2;
}

.hero-label {
  font-size: 11.5px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.72);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin-bottom: 16px;
}

.hero-identity {
  display: flex;
  align-items: center;
  gap: 14px;
}

.hero-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  border: 1.5px solid rgba(255, 255, 255, 0.3);
}

.hero-name {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.2px;
}

.hero-sub {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
  margin-top: 2px;
}

/* ── NEXT CARD ── */
.next-card {
  background: #fff;
  border-radius: 18px;
  padding: 24px 22px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.next-card-label {
  font-size: 11.5px;
  font-weight: 500;
  color: #a8b3bc;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.pending-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(0, 200, 83, 0.05);
  border-radius: 12px;
  padding: 14px 16px;
  gap: 10px;
}

.pending-name {
  font-size: 14px;
  font-weight: 600;
  color: #0f1720;
}
.pending-meta {
  font-size: 12px;
  color: #7b8794;
  margin-top: 2px;
}

.pending-footer {
  font-size: 12px;
  color: #7b8794;
  display: flex;
  align-items: center;
  gap: 6px;
}

.no-pending {
  font-size: 13px;
  color: #7b8794;
}

/* ── TABS ── */
.tabs-wrap {
  background: #f3f5f7;
  border-radius: 12px;
  padding: 4px;
  display: inline-flex;
  align-self: flex-start;
}

.tabs-row {
  display: flex;
  gap: 2px;
}

.ch-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 500;
  font-family: 'Poppins', sans-serif;
  color: #7b8794;
  background: transparent;
  border: none;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    box-shadow 0.15s;
  white-space: nowrap;
}

.ch-tab:hover {
  color: #0f1720;
}

.ch-tab--active {
  background: #fff;
  color: #007a32;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.ch-tab__icon {
  opacity: 0.45;
  flex-shrink: 0;
}
.ch-tab--active .ch-tab__icon {
  opacity: 1;
  stroke: #007a32;
}

.ch-tab__chip {
  font-size: 10.5px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.06);
  color: #7b8794;
}

.ch-tab--active .ch-tab__chip {
  background: rgba(0, 200, 83, 0.12);
  color: #007a32;
}

/* ── LOADING ── */
.ch-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 3rem;
  color: #7b8794;
  font-size: 13px;
}

.ch-loading__spinner {
  animation: spin 1.2s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* ── CARDS LIST ── */
.cards-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── CARD WRAPPER (for highlight ring) ── */
.card-wrapper {
  border-radius: 18px;
  animation: ccIn 0.32s ease both;
}

@keyframes ccIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.card-wrapper--highlighted {
  box-shadow:
    0 0 0 2px rgba(0, 200, 83, 0.35),
    0 8px 28px rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.3s ease;
}

/* ── EMPTY STATE ── */
.ch-empty {
  padding: 3rem 2rem;
  border-radius: 18px;
  background: #fff;
  border: 1px dashed rgba(0, 0, 0, 0.08);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.ch-empty__icon-wrap {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: #f6f7f8;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}

.ch-empty__title {
  font-size: 1rem;
  font-weight: 600;
  color: #0f1720;
  margin: 0;
}
.ch-empty__copy {
  color: #7b8794;
  font-size: 0.88rem;
  margin: 0;
}

/* ── SHARED BUTTONS ── */
.ch-btn {
  padding: 7px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  font-family: 'Poppins', sans-serif;
  cursor: pointer;
  border: none;
  transition:
    background 0.15s ease,
    transform 0.15s ease;
}

.ch-btn--ghost {
  background: #f3f5f7;
  color: #0f1720;
}
.ch-btn--ghost:hover {
  background: #eaecef;
  transform: translateY(-1px);
}

/* ══ MODAL ══ */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 32, 0.45);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.modal {
  background: #fff;
  border-radius: 22px;
  padding: 28px;
  width: 100%;
  max-width: 520px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.14);
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Modal header */
.modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.modal__kicker {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #a8b3bc;
  margin-bottom: 4px;
}

.modal__title {
  font-size: 17px;
  font-weight: 600;
  color: #0f1720;
  letter-spacing: -0.3px;
  margin: 0;
}

.modal__close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: #f3f5f7;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #7b8794;
  transition: background 0.15s;
}

.modal__close:hover {
  background: #eaecef;
}

/* Modal matchup */
.modal__matchup {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px;
  background: #f8faf8;
  border-radius: 14px;
}

.modal__player {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.modal__player--right {
  flex-direction: row-reverse;
  text-align: right;
}

.modal__avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}

.modal__avatar--green {
  background: rgba(0, 200, 83, 0.12);
  color: #007a32;
}
.modal__avatar--blue {
  background: #e8f0fe;
  color: #1a56c4;
}

.modal__player-name {
  font-size: 14px;
  font-weight: 600;
  color: #0f1720;
}

.modal__player-meta {
  font-size: 12px;
  color: #7b8794;
  margin-top: 2px;
}

.modal__vs {
  font-size: 11px;
  font-weight: 700;
  color: #a8b3bc;
  letter-spacing: 0.1em;
  flex-shrink: 0;
}

/* Modal details grid */
.modal__details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.modal__detail-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.modal__detail-item svg {
  flex-shrink: 0;
  margin-top: 2px;
}

.modal__detail-item--full {
  grid-column: 1 / -1;
}

.modal__detail-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #a8b3bc;
  margin-bottom: 3px;
}

.modal__detail-value {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #0f1720;
}

.modal__detail-value--muted {
  color: #a8b3bc;
}

.modal__detail-value--note {
  font-style: italic;
  color: #7b8794;
}

/* Modal actions */
.modal__actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding-top: 4px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

/* ── MODAL TRANSITION ── */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.22s ease;
}
.modal-enter-active .modal,
.modal-leave-active .modal {
  transition:
    transform 0.22s cubic-bezier(0.22, 0.61, 0.36, 1),
    opacity 0.22s ease;
}
.modal-enter-from {
  opacity: 0;
}
.modal-enter-from .modal {
  transform: translateY(16px);
  opacity: 0;
}
.modal-leave-to {
  opacity: 0;
}
.modal-leave-to .modal {
  transform: translateY(8px);
  opacity: 0;
}

/* ── RESPONSIVE ── */
@media (max-width: 900px) {
  .summary-row {
    grid-template-columns: 1fr;
  }
  .tabs-wrap {
    align-self: stretch;
  }
  .tabs-row {
    flex-wrap: wrap;
  }
}

@media (max-width: 560px) {
  .modal {
    padding: 20px;
    border-radius: 18px;
  }
  .modal__details {
    grid-template-columns: 1fr;
  }
  .modal__actions {
    flex-direction: column;
  }
}
</style>
