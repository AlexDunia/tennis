<script setup>
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import { useRouter } from 'vue-router'
import { APP_CURRENT_PLAYER } from '../config/currentPlayer'
import { dashboardFixture } from '../data/dashboard'
import { useAdminStore } from '../stores/admin'
import { useAuthStore } from '../stores/auth'
import { useChallengeStore } from '../stores/challenge'
import { useFriendlyMatchStore } from '../stores/friendlyMatch'
import { useMatchStore } from '../stores/match'
import { usePlayerStore } from '../stores/player'
import BaseButton from '../components/BaseButton.vue'
import EmptyState from '../components/EmptyState.vue'
import HomePrioritySlot from '../components/dashboard/HomePrioritySlot.vue'
import RoutePageSkeleton from '../components/RoutePageSkeleton.vue'
import { resolveChallengeActionPriority } from '../utils/homePriority/challengeActionPriority'
import { resolveHomeFallbackPriority } from '../utils/homePriority/homeFallbackPriority'
import { getActiveLadderConfig } from '../config/ladder.js'
import { CLUB_DIRECTORY_STORAGE_KEY } from '../config/admin.js'
import { getLadderAdminState } from '../services/LadderAdminService.js'
import { subscribeToCompetitionChanges } from '../services/ApiService.js'
import { homeLiveMatchRoute } from '../utils/homePriority/homeLiveMatchRoute.js'
import { resolveLiveMatchPriority } from '../utils/homePriority/liveMatchPriority'
import { resolveReadyMatchPriority } from '../utils/homePriority/readyMatchPriority'
import { resolveHomePriority } from '../utils/homePriority/resolveHomePriority'
import { resolveResultReviewPriority } from '../utils/homePriority/resultReviewPriority'

const router = useRouter()
const adminStore = useAdminStore()
const authStore = useAuthStore()
const challengeStore = useChallengeStore()
const friendlyMatchStore = useFriendlyMatchStore()
const matchStore = useMatchStore()
const playerStore = usePlayerStore()

const staticNotice = ref('')
const clubReady = ref(false)
const livePriorityMatches = ref([])
const priorityNow = ref(Date.now())
const clubContextRevision = ref(0)

const dashboard = dashboardFixture
const actionIconNames = Object.freeze([
  'play',
  'challenge',
  'tournament',
])

let stopLiveMatchSubscription = null
let priorityClockTimer = null
let stopCompetitionSubscription = null
let homeDisposed = false
let competitionRefresh = null
let competitionRefreshPending = false

const currentPlayerName = computed(() =>
  String(
    authStore.user?.name ||
      playerStore.currentPlayer?.name ||
      APP_CURRENT_PLAYER.name,
  ).trim(),
)

const currentPlayerFirstName = computed(
  () =>
    currentPlayerName.value.split(/\s+/)[0] ||
    APP_CURRENT_PLAYER.firstName,
)

const currentActorId = computed(() =>
  String(
    authStore.user?.playerId ||
      authStore.user?.id ||
      '',
  ).trim(),
)

const activeClub = computed(() => adminStore.activeClub)
const activeClubName = computed(
  () => activeClub.value?.name || '',
)

const liveMatchPriority = computed(() =>
  resolveLiveMatchPriority({
    matches: livePriorityMatches.value,
    actorId: currentActorId.value,
  }),
)

const readyMatchPriority = computed(() =>
  resolveReadyMatchPriority({
    challenges: challengeStore.challenges,
    matches: matchStore.matches,
    actorId: currentActorId.value,
    clubId: adminStore.activeClubId || '',
    now: priorityNow.value,
  }),
)

const challengeActionPriority = computed(() =>
  resolveChallengeActionPriority({
    challenges: challengeStore.challenges,
    matches: matchStore.matches,
    actorId: currentActorId.value,
    clubId: adminStore.activeClubId || '',
    now: priorityNow.value,
  }),
)

const resultReviewPriority = computed(() =>
  resolveResultReviewPriority({
    challenges: challengeStore.challenges,
    matches: matchStore.matches,
    actorId: currentActorId.value,
    clubId: adminStore.activeClubId || '',
    now: priorityNow.value,
  }),
)

const fallbackPriority = computed(() =>
  resolveHomeFallbackPriority({
    club: activeClub.value,
    activeLadders: activeClub.value?.setup?.ladders || [],
    players: playerStore.players,
    actorId: currentActorId.value,
    userId: authStore.user?.id || '',
    currentPlayerName: currentPlayerName.value,
    challenges: challengeStore.challenges,
    isAdmin: adminStore.hasActiveClubPermission('club.manage'),
    challengeConfig: getActiveLadderConfig(),
    canCreateChallenge: !challengeStore.error && adminStore.hasActiveClubPermission('challenges.create'),
    dataReady: clubReady.value && !adminStore.error && !playerStore.error,
    ladderStateFor: (scope) => {
      clubContextRevision.value
      return getLadderAdminState(scope)
    },
  }),
)

const homeHero = computed(() =>
  resolveHomePriority([
    liveMatchPriority.value,
    readyMatchPriority.value,
    challengeActionPriority.value,
    resultReviewPriority.value,
    fallbackPriority.value,
  ]),
)

function isActionIcon(action, index) {
  return action.icon === actionIconNames[index]
}

function isReviewItem(item) {
  return item.icon === 'review'
}

function eventDateLabel(item) {
  return `${item.month} ${item.day}`
}

function openRoute(to) {
  if (to) router.push(to)
}

function handleAction(action) {
  if (action?.to) {
    openRoute(action.to)
    return
  }

  staticNotice.value =
    action?.unavailableMessage ||
    'This action is not connected yet.'
}

function openCalendar() {
  staticNotice.value =
    'The club calendar is not connected yet.'
}

function joinClub() {
  router.push({
    name: 'Clubs',
    query: { view: 'join' },
  })
}

function createClub() {
  router.push({
    name: 'Clubs',
    query: { view: 'create' },
  })
}

function handleHomeHeroOpen(priority) {
  if (!priority) return

  if (
    priority.action === 'open_live_match' &&
    priority.matchId
  ) {
    refreshHomeLiveMatches()
    const current = liveMatchPriority.value
    if (!current || current.matchId !== priority.matchId) return
    router.push(homeLiveMatchRoute(current))
    return
  }

  if (
    [
      'open_ready_match',
      'open_result_review',
      'open_challenge',
    ].includes(priority.action) &&
    priority.challengeId
  ) {
    router.push({
      name: 'ChallengeDetails',
      params: {
        challengeId: priority.challengeId,
      },
    })
    return
  }

  if (priority.action === 'create_challenge') {
    router.push({ name: 'CreateChallenge' })
    return
  }

  if (priority.action === 'open_ladder') {
    router.push({ name: 'Rankings', query: priority.ladderId ? { ladder: priority.ladderId } : {} })
    return
  }

  if (priority.action === 'add_members') {
    router.push({ name: 'ClubMembers' })
    return
  }

  if (priority.action === 'open_club') {
    router.push({
      name: 'Club',
      params: activeClub.value?.id
        ? { clubId: activeClub.value.id }
        : {},
    })
    return
  }

  if (priority.action === 'open_play') {
    router.push({ name: 'Play' })
    return
  }

  staticNotice.value =
    'This Home action is not connected yet.'
}

function refreshPriorityClock() {
  priorityNow.value = Date.now()
}

function handlePriorityVisibilityChange() {
  if (document.visibilityState === 'visible') {
    refreshPriorityClock()
    refreshHomeLiveMatches()
    refreshHomeClub()
    refreshHomeCompetition()
  }
}

function refreshHomeClub() {
  clubContextRevision.value += 1
  return adminStore.loadClubs().catch(() => {})
}

function handleHomeClubStorage(event) {
  if (event.key === null || event.key === CLUB_DIRECTORY_STORAGE_KEY || event.key === 'gorra.ladder.adminState.v1') {
    refreshHomeClub()
  }
}

function refreshHomeCompetition() {
  if (homeDisposed) return
  if (competitionRefresh) {
    competitionRefreshPending = true
    return competitionRefresh
  }
  competitionRefresh = Promise.allSettled([
    challengeStore.loadChallenges(),
    matchStore.loadMatches(),
    playerStore.loadPlayers(),
  ]).finally(() => {
    competitionRefresh = null
    if (!homeDisposed) refreshHomeLiveMatches()
    if (competitionRefreshPending && !homeDisposed) {
      competitionRefreshPending = false
      refreshHomeCompetition()
    }
  })
  return competitionRefresh
}

function refreshHomeLiveMatches() {
  const clubId =
    adminStore.activeClubId ||
    activeClub.value?.id ||
    ''
  const actorId = currentActorId.value

  if (!clubId || !actorId) {
    livePriorityMatches.value = []
    return
  }

  livePriorityMatches.value =
    friendlyMatchStore.listLiveMatchesForUser({
      clubId,
      actorId,
    })
}

watch(
  [
    () => adminStore.activeClubId,
    currentActorId,
  ],
  () => {
    refreshHomeLiveMatches()
  },
)

onMounted(async () => {
  try {
    await Promise.allSettled([
      adminStore.loadClubs(),
      playerStore.players.length
        ? Promise.resolve()
        : playerStore.loadPlayers(),
      challengeStore.loadChallenges(),
      matchStore.loadMatches(),
    ])

    if (homeDisposed) return
    refreshHomeLiveMatches()
    stopCompetitionSubscription = subscribeToCompetitionChanges(refreshHomeCompetition)

    stopLiveMatchSubscription =
      friendlyMatchStore.subscribeToLiveMatchChanges(
        refreshHomeLiveMatches,
      )

    priorityClockTimer = window.setInterval(
      refreshPriorityClock,
      1_000,
    )

    window.addEventListener('storage', handleHomeClubStorage)
    window.addEventListener('focus', handlePriorityVisibilityChange)
    document.addEventListener(
      'visibilitychange',
      handlePriorityVisibilityChange,
    )
  } finally {
    clubReady.value = true
  }
})

onUnmounted(() => {
  homeDisposed = true
  stopCompetitionSubscription?.()
  if (typeof stopLiveMatchSubscription === 'function') {
    stopLiveMatchSubscription()
  }

  stopLiveMatchSubscription = null

  if (priorityClockTimer) {
    window.clearInterval(priorityClockTimer)
  }

  priorityClockTimer = null

  window.removeEventListener('storage', handleHomeClubStorage)
  window.removeEventListener('focus', handlePriorityVisibilityChange)
  document.removeEventListener(
    'visibilitychange',
    handlePriorityVisibilityChange,
  )
})
</script>

<template>
  <main class="dashboard-page">
    <RoutePageSkeleton v-if="!clubReady" route-name="Dashboard" />

    <template v-else-if="!activeClub">
      <section class="dashboard-panel no-club" aria-label="No club membership">
        <EmptyState
          illustration="club"
          title="You're not in a club yet"
          description="Join a club or create one to see club activity here."
          primary-action-label="Join a club"
          secondary-action-label="Create a club"
          @primary-action="joinClub"
          @secondary-action="createClub"
        />
      </section>

      <section class="dashboard-panel friendly-access" aria-labelledby="friendly-access-title">
        <div>
          <h2 id="friendly-access-title">Play without a club</h2>
          <p>You can still start a friendly match.</p>
        </div>
        <BaseButton variant="secondary" @click="openRoute({ name: 'Play' })">
          Start friendly match
        </BaseButton>
      </section>
    </template>

    <div v-else class="dashboard-stack">
      <HomePrioritySlot
        v-if="homeHero"
        class="dashboard-panel"
        :priority="homeHero"
        :club-name="activeClubName"
        @open="handleHomeHeroOpen"
      />

      <section class="dashboard-panel dashboard-section" aria-labelledby="quick-title">
        <header class="section-heading">
          <h2 id="quick-title">What would you like to do?</h2>
        </header>

        <div class="quick-grid">
          <button
            v-for="action in dashboard.quickActions"
            :key="action.id"
            class="quick-card"
            type="button"
            @click="handleAction(action)"
          >
            <span class="feature-icon" aria-hidden="true">
              <svg v-if="isActionIcon(action, 0)" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8.5" />
                <path d="m10 8.5 5.5 3.5-5.5 3.5Z" />
              </svg>
              <svg v-else-if="isActionIcon(action, 1)" viewBox="0 0 24 24">
                <path d="M5 19 17 5M7 5l12 14" />
                <ellipse cx="7" cy="6" rx="2.5" ry="3.5" transform="rotate(-35 7 6)" />
                <ellipse cx="17" cy="6" rx="2.5" ry="3.5" transform="rotate(35 17 6)" />
              </svg>
              <svg v-else viewBox="0 0 24 24">
                <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
                <path d="M6 5H4v2a4 4 0 0 0 4 4M18 5h2v2a4 4 0 0 1-4 4M12 12v5M8 20h8" />
              </svg>
            </span>
            <span>
              <strong>{{ action.title }}</strong>
              <small>{{ action.description }}</small>
            </span>
          </button>
        </div>
      </section>

      <section
        v-if="dashboard.attentionItems.length"
        class="dashboard-panel dashboard-section"
        aria-labelledby="attention-title"
      >
        <header class="section-heading">
          <h2 id="attention-title">Needs your attention</h2>
        </header>

        <div class="row-surface">
          <article v-for="item in dashboard.attentionItems" :key="item.id" class="action-row">
            <span class="feature-icon" aria-hidden="true">
              <svg v-if="isReviewItem(item)" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8.5" />
                <path d="m8.5 12 2.3 2.3 4.8-5" />
              </svg>
              <svg v-else viewBox="0 0 24 24">
                <rect x="4" y="5" width="16" height="15" rx="2" />
                <path d="M8 3v4M16 3v4M4 9h16" />
              </svg>
            </span>
            <div>
              <strong>{{ item.title }}</strong>
              <p>{{ item.description }}</p>
            </div>
            <BaseButton variant="secondary" @click="handleAction(item)">
              {{ item.actionLabel }}
            </BaseButton>
          </article>
        </div>
      </section>

      <section class="dashboard-panel dashboard-section" aria-labelledby="upcoming-title">
        <header class="section-heading section-heading--split">
          <div>
            <h2 id="upcoming-title">Coming up at {{ activeClubName }}</h2>
          </div>
          <button class="text-action" type="button" @click="openCalendar">Open calendar</button>
        </header>

        <div class="row-surface upcoming-list">
          <article v-for="item in dashboard.upcomingItems" :key="item.id" class="event-row">
            <time :aria-label="eventDateLabel(item)">
              <span>{{ item.month }}</span>
              <strong>{{ item.day }}</strong>
              <small>{{ item.weekday }}</small>
            </time>
            <div>
              <h3>{{ item.title }}</h3>
              <p>{{ item.description }}</p>
            </div>
          </article>
        </div>
      </section>

      <section class="dashboard-panel dashboard-section" aria-labelledby="glance-title">
        <header class="section-heading">
          <h2 id="glance-title">Club at a glance</h2>
        </header>

        <div class="summary-grid">
          <article>
            <span>Members</span>
            <strong>{{ dashboard.clubSummary.members }}</strong>
            <small>{{ dashboard.clubSummary.newMembersLabel }}</small>
          </article>
          <article>
            <span>Live matches</span>
            <strong>{{ dashboard.clubSummary.liveMatches }}</strong>
            <small>{{ dashboard.clubSummary.liveMatchesLabel }}</small>
          </article>
          <article>
            <span>Active ladders</span>
            <strong>{{ dashboard.clubSummary.activeLadders }}</strong>
            <small>{{ dashboard.clubSummary.activeLaddersLabel }}</small>
          </article>
        </div>
      </section>
    </div>

    <p class="dashboard-status" role="status" aria-live="polite">{{ staticNotice }}</p>
  </main>
</template>

<style scoped>
.dashboard-page {
  width: 100%;
  padding: 4px 0 42px;
  color: var(--color-text);
}

.dashboard-stack {
  display: grid;
  gap: clamp(40px, 5vw, 52px);
}

.dashboard-panel {
  animation: dashboard-reveal 190ms var(--motion-curve) both;
}

.dashboard-section {
  display: grid;
  gap: 16px;
}


.section-heading {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.section-heading--split {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.section-heading h2,
.section-heading p {
  margin: 0;
}

.section-heading h2 {
  color: var(--color-text);
  font-size: 18px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.015em;
  line-height: 1.35;
}

.section-heading > p:first-child {
  color: var(--color-primary-strong);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
}

.ladder-card {
  display: flex;
  min-height: 138px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 24px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 18%, var(--color-border));
  border-radius: 12px;
  background: var(--color-surface-softest);
}

.ladder-card__copy {
  display: grid;
  gap: 3px;
}

.ladder-card__copy span {
  color: var(--color-primary-strong);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.ladder-card__copy h3,
.ladder-card__copy p {
  margin: 0;
}

.ladder-card__copy h3 {
  color: var(--color-text);
  font-size: 16px;
  font-weight: var(--font-weight-semibold);
}

.ladder-card__copy p {
  color: var(--color-muted);
  font-size: 12px;
}

.ladder-card__copy p strong {
  color: var(--color-text);
  font-size: 20px;
}

.quick-grid,
.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.quick-card {
  display: grid;
  min-height: 116px;
  grid-template-columns: 38px minmax(0, 1fr);
  align-items: center;
  justify-content: start;
  gap: 14px;
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  color: var(--color-text);
  text-align: left;
  white-space: normal;
}

.quick-card:hover {
  border-color: var(--color-border-strong);
  transform: translateY(-1px);
}

.quick-card > span:last-child {
  display: grid;
  gap: 4px;
}

.quick-card strong,
.action-row strong,
.event-row h3 {
  color: var(--color-text);
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.35;
}

.quick-card small,
.action-row p,
.event-row p {
  margin: 0;
  color: var(--color-muted);
  font-size: 12px;
  font-weight: var(--font-weight-regular);
  line-height: 1.5;
}

.feature-icon {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 10px;
  background: var(--color-surface-soft);
  color: var(--color-primary-strong);
}

.feature-icon svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.row-surface {
  display: grid;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
}

.action-row {
  display: grid;
  min-height: 82px;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
}

.action-row:first-child,
.event-row:first-child {
  border-top: 0;
}

.action-row > div,
.event-row > div {
  display: grid;
  gap: 3px;
}

.text-action {
  min-height: 42px;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-primary-strong);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
}

.event-row {
  display: grid;
  min-height: 92px;
  grid-template-columns: 52px minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
}

.event-row time {
  display: grid;
  width: 48px;
  height: 58px;
  place-items: center;
  padding: 5px;
  border: 1px solid var(--color-border);
  border-radius: 9px;
  background: var(--color-surface-softest);
  color: var(--color-primary-strong);
  font-style: normal;
  line-height: 1;
}

.event-row time span,
.event-row time small {
  color: var(--color-muted);
  font-size: 9px;
}

.event-row time strong {
  font-size: 18px;
  font-weight: var(--font-weight-semibold);
}

.event-row h3 {
  margin: 0;
}

.summary-grid article {
  display: grid;
  min-height: 106px;
  align-content: center;
  gap: 3px;
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
}

.summary-grid span {
  color: var(--color-muted);
  font-size: 11px;
}

.summary-grid strong {
  color: var(--color-text);
  font-size: 20px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
}

.summary-grid small {
  color: var(--color-muted);
  font-size: 11px;
}

.no-club {
  min-height: min(54vh, 500px);
}

.friendly-access {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 20px 0;
  border-top: 1px solid var(--color-border);
}

.friendly-access h2,
.friendly-access p {
  margin: 0;
}

.friendly-access h2 {
  font-size: 16px;
  font-weight: var(--font-weight-semibold);
}

.friendly-access p {
  color: var(--color-muted);
  font-size: 12px;
}

.dashboard-status {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 80;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--color-border-strong);
  border-radius: 9px;
  background: var(--color-surface);
  color: var(--color-text-soft);
  font-size: 11px;
}

.dashboard-status:empty {
  display: none;
}

@keyframes dashboard-reveal {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: none; }
}

@media (max-width: 760px) {
  .quick-grid,
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .quick-card {
    min-height: 102px;
  }
}

@media (max-width: 520px) {
  .dashboard-stack {
    gap: 40px;
  }

  .ladder-card,
  .friendly-access {
    align-items: flex-start;
    flex-direction: column;
  }

  .action-row {
    grid-template-columns: 38px minmax(0, 1fr);
    padding: 16px;
  }

  .action-row :deep(.base-button) {
    grid-column: 2;
    justify-self: start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dashboard-panel,
  .quick-card {
    animation: none;
    transition: none;
  }
}
@media (hover: hover) and (pointer: fine) {
  .quick-card:hover {
    background: #f4f8f5;
    border-color: var(--color-border);
  }
}
</style>
