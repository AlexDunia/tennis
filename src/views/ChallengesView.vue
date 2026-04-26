<script setup>
// 1. IMPORTS
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChallengeStore } from '../stores/challenge'
import { useMatchStore } from '../stores/match'
import { usePlayerStore } from '../stores/player'
import { useNotificationStore } from '../stores/notification'
import ChallengeCard from '../components/ChallengeCard.vue'

// 4. ROUTER / ROUTE
const router = useRouter()

// 5. STORES
const challengeStore = useChallengeStore()
const matchStore = useMatchStore()
const playerStore = usePlayerStore()
const notificationStore = useNotificationStore()

// 6. REACTIVE STATE
const tabs = [
  { label: 'All', value: 'all', emoji: '🎾' },
  { label: 'Awaiting', value: 'awaiting', emoji: '⏳' },
  { label: 'Scheduled', value: 'scheduled', emoji: '📅' },
  { label: 'Pending Review', value: 'pending_review', emoji: '🔍' },
]

// 7. COMPUTED PROPERTIES
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
const handleAccept = (challengeId) => {
  challengeStore.acceptChallenge(challengeId).then((data) => {
    if (data) {
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

// 10. LIFECYCLE HOOKS
onMounted(() => {
  loadChallengesView()
})
</script>

<template>
  <section class="challenges">
    <!-- Summary row -->
    <div class="summary-row">
      <!-- Hero card (your position) -->
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
            <button class="btn btn-ghost" @click="handleDetails(pendingChallenge.id)">View</button>
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

    <!-- Tabs -->
    <div class="tabs-row">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        :class="['tab', { active: challengeStore.filterStatus === tab.value }]"
        type="button"
        @click="challengeStore.setFilter(tab.value)"
      >
        <span class="tab-emoji">{{ tab.emoji }}</span>
        {{ tab.label }}
        <span v-if="tabCount[tab.value] > 0" class="chip">{{ tabCount[tab.value] }}</span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="challengeStore.isLoading" class="challenges__loading">
      <span class="loading-ball">🎾</span>
      <p>Loading challenges…</p>
    </div>

    <!-- Challenge list -->
    <div v-else class="cards">
      <div v-if="visibleChallenges.length === 0" class="empty-state">
        <p class="empty-state__emoji">🎾</p>
        <p class="empty-state__title">No challenges here</p>
        <p class="empty-state__copy">
          {{
            challengeStore.filterStatus === 'all'
              ? 'No challenges yet. Head to Rankings to issue a challenge!'
              : `No challenges with status "${challengeStore.filterStatus}".`
          }}
        </p>
      </div>

      <ChallengeCard
        v-for="(challenge, index) in visibleChallenges"
        :key="challenge.id"
        :challenge="challenge"
        :challengerName="challenge.challengerName"
        :defenderName="challenge.defenderName"
        :challengerImage="challenge.challengerImage"
        :defenderImage="challenge.defenderImage"
        :showAccept="challenge.status === 'awaiting'"
        :showDecline="
          challenge.status === 'awaiting' && challenge.defenderId === playerStore.currentPlayer?.id
        "
        :showReview="challenge.status === 'pending_review'"
        :showDetails="challenge.status !== 'awaiting'"
        :style="{ animationDelay: `${index * 60}ms` }"
        @accept="handleAccept"
        @decline="handleDecline"
        @review="handleReview"
        @details="handleDetails"
      />
    </div>
  </section>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');

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
  margin-bottom: 18px;
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

/* ── PENDING REPLY CARD ── */
.next-card {
  background: #fff;
  border-radius: 18px;
  padding: 24px 22px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
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
  padding: 12px 0;
}

/* ── TABS ── */
.tabs-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.tab {
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  font-family: 'Poppins', sans-serif;
  color: #7b8794;
  background: transparent;
  border: none;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tab:hover {
  background: #fff;
  color: #0f1720;
}

.tab.active {
  background: #fff;
  color: #007a32;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}

.tab-emoji {
  font-size: 13px;
  line-height: 1;
}

.chip {
  display: inline-block;
  margin-left: 2px;
  font-size: 10.5px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 20px;
  background: rgba(0, 200, 83, 0.12);
  color: #007a32;
}

.tab:not(.active) .chip {
  background: rgba(0, 0, 0, 0.05);
  color: #7b8794;
}

/* ── LOADING ── */
.challenges__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  color: #7b8794;
  font-size: 0.92rem;
}

.loading-ball {
  font-size: 2rem;
  animation: spin 1.4s linear infinite;
  display: block;
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
.cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── EMPTY STATE ── */
.empty-state {
  padding: 3rem 2rem;
  border-radius: 18px;
  background: #fff;
  border: 1px dashed rgba(0, 0, 0, 0.08);
  text-align: center;
  display: grid;
  gap: 0.4rem;
}

.empty-state__emoji {
  font-size: 2.5rem;
  margin: 0;
  line-height: 1;
}

.empty-state__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #0f1720;
}

.empty-state__copy {
  margin: 0;
  color: #7b8794;
  font-size: 0.9rem;
}

/* ── RESPONSIVE ── */
@media (max-width: 900px) {
  .summary-row {
    grid-template-columns: 1fr;
  }
}
</style>
