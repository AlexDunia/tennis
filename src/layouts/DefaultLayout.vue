<template>
  <div class="layout">
    <aside v-if="showSidebar" class="sidebar">
      <div class="logo">
        <img
          src="https://res.cloudinary.com/dnuhjsckk/image/upload/v1776503502/RENAISSANCE-AFRICA-ENERGY-LOGO-update_s4eb9u.png"
          alt="Renaissance Africa Tennis Club Port Harcourt"
          class="logo-img cloudinary-img"
        />
      </div>

      <nav class="nav">
        <a
          v-for="item in navigationItems"
          :key="item.routeName"
          :href="getNavigationHref(item.to)"
          class="nav-link"
          :class="{ active: isNavigationActive(item.routeName) }"
          @click="handleNavigationClick(item.to, $event)"
        >
          <span class="icon" v-html="item.icon"></span>
          <span class="label">{{ item.label }}</span>
        </a>

        <!-- PROFILE -->
        <a
          :href="getNavigationHref({ name: 'Profile' })"
          class="nav-link"
          :class="{ active: isNavigationActive('Profile') }"
          @click="handleNavigationClick({ name: 'Profile' }, $event)"
        >
          <span class="icon" v-html="profileIcon"></span>
          <span class="label">Profile</span>
        </a>

        <!-- NOTIFICATIONS -->
        <a
          :href="getNavigationHref({ name: 'Notifications' })"
          class="nav-link"
          :class="{ active: isNavigationActive('Notifications') }"
          @click="handleNavigationClick({ name: 'Notifications' }, $event)"
        >
          <span class="icon" v-html="bellIcon"></span>
          <span class="label">Notifications</span>
          <span v-if="unreadCount" class="badge">{{ unreadCount }}</span>
        </a>
      </nav>
    </aside>

    <main
      class="main"
      :class="{
        'main--wide': isWideWorkspace,
        'main--fullscreen': isLiveFullscreen,
        'main--public': isPublicRoute,
      }"
    >
      <div v-if="showHeader" class="header" :class="{ 'header--wide': isWideWorkspace }">
        <div class="header-main">
          <button
            v-if="headerBackLabel"
            class="header-back"
            type="button"
            :aria-label="headerBackLabel"
            :title="headerBackLabel"
            @click="handleHeaderBack"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div class="header-left" :class="{ 'header-left--wizard': isTournamentCreate }">
            <ol
              v-if="isTournamentCreate"
              class="header-steps"
              aria-label="Tournament creation progress"
            >
              <li
                v-for="(step, index) in tournamentCreateSteps"
                :key="step"
                :class="{
                  'header-step--done': index < tournamentCreateStepIndex,
                  'header-step--active': index === tournamentCreateStepIndex,
                }"
              >
                <span>{{ index < tournamentCreateStepIndex ? 'OK' : index + 1 }}</span>
                <strong>{{ tournamentCreateTitles[step] }}</strong>
              </li>
            </ol>
            <template v-else>
              <h1>{{ currentTitle }}</h1>
              <p>{{ currentSubtitle }}</p>
            </template>
          </div>
        </div>

        <div class="header-actions">
          <div class="user" v-if="currentPlayer">
            <span class="user-name">{{ currentPlayer.name }}</span>
            <span v-if="currentPlayer.isAdmin" class="user-role">Admin</span>
          </div>
        </div>
      </div>

      <div
        class="content"
        :class="{
          'content--wide': isWideWorkspace,
          'content--fullscreen': isLiveFullscreen,
          'content--public': isPublicRoute,
          'content--tournament-rail': usesTournamentCreateRail,
        }"
      >
        <div class="watch-only">
          <strong>Rank #{{ currentPlayer?.rank || '-' }}</strong>
          <span>{{ currentPlayer?.name || 'Player' }}</span>
          <span>{{ unreadCount }} unread</span>
        </div>
        <div class="page-shell" :class="{ 'page-shell--public': isPublicRoute }">
          <div v-if="pageSkeletonActive" class="page-skeleton-overlay" aria-hidden="true">
            <div class="page-skeleton-stack">
              <div class="page-skeleton-row">
                <span class="skeleton skeleton-line" style="width: 52%; height: 18px"></span>
                <span class="skeleton skeleton-line" style="width: 22%; height: 18px"></span>
              </div>
              <div
                class="skeleton skeleton-card"
                style="min-height: 220px; padding: 1rem; gap: 0.9rem; display: grid"
              >
                <span class="skeleton skeleton-line" style="width: 38%; height: 16px"></span>
                <span class="skeleton skeleton-line" style="width: 72%; height: 16px"></span>
                <span class="skeleton skeleton-line" style="width: 44%; height: 16px"></span>
              </div>
              <div class="page-skeleton-grid">
                <span class="skeleton skeleton-card" style="min-height: 120px"></span>
                <span class="skeleton skeleton-card" style="min-height: 120px"></span>
                <span class="skeleton skeleton-card" style="min-height: 120px"></span>
              </div>
            </div>
          </div>

          <RouterView v-slot="{ Component }">
            <Transition name="page" mode="out-in" appear>
              <component :is="Component" :key="route.fullPath" />
            </Transition>
          </RouterView>
        </div>
      </div>
    </main>

    <nav v-if="showBottomNav" class="bottom-nav" aria-label="Primary navigation">
      <a
        v-for="item in navigationItems"
        :key="`bottom-${item.routeName}`"
        :href="getNavigationHref(item.to)"
        class="nav-link"
        :class="{ active: isNavigationActive(item.routeName) }"
        @click="handleNavigationClick(item.to, $event)"
      >
        <span class="icon" v-html="item.icon"></span>
        <span class="label">{{ item.label }}</span>
      </a>

      <a
        :href="getNavigationHref({ name: 'Profile' })"
        class="nav-link"
        :class="{ active: isNavigationActive('Profile') }"
        @click="handleNavigationClick({ name: 'Profile' }, $event)"
      >
        <span class="icon" v-html="profileIcon"></span>
        <span class="label">Profile</span>
      </a>

      <a
        :href="getNavigationHref({ name: 'Notifications' })"
        class="nav-link"
        :class="{ active: isNavigationActive('Notifications') }"
        @click="handleNavigationClick({ name: 'Notifications' }, $event)"
      >
        <span class="icon" v-html="bellIcon"></span>
        <span class="label">Notifications</span>
        <span v-if="unreadCount" class="badge">{{ unreadCount }}</span>
      </a>
    </nav>
  </div>

  <ToastShelf />
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useNotificationStore } from '../stores/notification'
import { useMatchStore } from '../stores/match'
import { usePlayerStore } from '../stores/player'
import { useTournamentStore } from '../stores/tournament'
import ToastShelf from '../components/ToastShelf.vue'

const route = useRoute()
const router = useRouter()
const notificationStore = useNotificationStore()
const matchStore = useMatchStore()
const playerStore = usePlayerStore()
const tournamentStore = useTournamentStore()

const pageSkeletonActive = ref(true)
let pageSkeletonTimer = null
const PAGE_SKELETON_DURATION = 2000

const schedulePageSkeleton = () => {
  pageSkeletonActive.value = true
  if (pageSkeletonTimer) {
    window.clearTimeout(pageSkeletonTimer)
  }
  pageSkeletonTimer = window.setTimeout(() => {
    pageSkeletonActive.value = false
    pageSkeletonTimer = null
  }, PAGE_SKELETON_DURATION)
}

onMounted(() => {
  if (!isPublicRoute.value && !playerStore.players.length) {
    playerStore.loadPlayers()
  }

  if (isPublicRoute.value) pageSkeletonActive.value = false
  else schedulePageSkeleton()
})

const removeRouteAfterEach = router.afterEach(() => {
  if (isPublicRoute.value) pageSkeletonActive.value = false
  else schedulePageSkeleton()
})

onUnmounted(() => {
  if (pageSkeletonTimer) {
    window.clearTimeout(pageSkeletonTimer)
  }
  if (typeof removeRouteAfterEach === 'function') {
    removeRouteAfterEach()
  }
})

const navigationItems = [
  {
    to: { name: 'Dashboard' },
    routeName: 'Dashboard',
    label: 'Dashboard',
    icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="2" width="5" height="5" rx="1.2"/><rect x="9" y="2" width="5" height="5" rx="1.2"/><rect x="2" y="9" width="5" height="5" rx="1.2"/><rect x="9" y="9" width="5" height="5" rx="1.2"/></svg>',
  },
  {
    to: { name: 'Rankings' },
    routeName: 'Rankings',
    label: 'Rankings',
    icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 13V6M7 13V3M11 13V8" stroke-linecap="round"/></svg>',
  },
  {
    to: { name: 'Tournaments' },
    routeName: 'Tournaments',
    label: 'Tournaments',
    icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 3h6v2a3 3 0 0 1-6 0V3Z"/><path d="M4 3H2v1a2 2 0 0 0 2 2M12 3h2v1a2 2 0 0 1-2 2M8 8v3M6 13h4" stroke-linecap="round"/></svg>',
  },
  {
    to: { name: 'Challenges' },
    routeName: 'Challenges',
    label: 'Challenges',
    icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="5.5"/><path d="M5.5 8h5M8 5.5v5" stroke-linecap="round"/></svg>',
  },
]

const profileIcon =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.6"/><path d="M4 20c1.5-3.5 5-5 8-5s6.5 1.5 8 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'

const bellIcon =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5a4 4 0 0 1 4 4v3.5l1.5 1.5v.5H6v-.5L7.5 12.5V9a4 4 0 0 1 4-4Z" stroke="currentColor" stroke-width="1.7"/></svg>'

const tournamentCreateSteps = ['basics', 'categories', 'players', 'review']
const tournamentCreateTitles = {
  basics: 'Basics',
  categories: 'Categories',
  players: 'Players',
  review: 'Review',
}
const tournamentCreateSubtitles = {
  basics: 'Name the event and set the tournament dates.',
  categories: 'Choose the categories this tournament will use.',
  players: 'Select players and let the ladder help with placement.',
  review: 'Pick formats, check groups, then generate the tournament.',
}
const isTournamentCreate = computed(() => route.name === 'TournamentCreate')
const usesTournamentCreateRail = computed(
  () =>
    isTournamentCreate.value &&
    ['players', 'review'].includes(String(route.query.step || 'basics')),
)
const isTournamentViewer = computed(
  () => route.path.startsWith('/tournaments/') && route.name !== 'TournamentCreate',
)
const isLiveFullscreen = computed(
  () => route.name === 'PlayMatch' && route.query.fullscreen === '1',
)
const isPublicRoute = computed(() => route.meta.public === true)
const isWideWorkspace = computed(() => isTournamentCreate.value || isTournamentViewer.value)
const showSidebar = computed(() => !isPublicRoute.value && !isLiveFullscreen.value && !usesTournamentCreateRail.value)
const showHeader = computed(() => !isPublicRoute.value && !isLiveFullscreen.value)
const showBottomNav = computed(() => !isPublicRoute.value && !isLiveFullscreen.value)
const tournamentCreateStep = computed(() => {
  const step = String(route.query.step || 'basics')
  return tournamentCreateSteps.includes(step) ? step : 'basics'
})
const tournamentCreateStepIndex = computed(() =>
  Math.max(0, tournamentCreateSteps.indexOf(tournamentCreateStep.value)),
)
const activeTournament = computed(() =>
  tournamentStore.activeTournament?.id === route.params.tournamentId
    ? tournamentStore.activeTournament
    : null,
)
const activeCategory = computed(
  () =>
    activeTournament.value?.categories.find(
      (category) => category.id === route.params.categoryId,
    ) || null,
)
const activeMatch = computed(() =>
  route.params.matchId ? matchStore.matchById(route.params.matchId) : null,
)

const currentTitle = computed(() => {
  if (isTournamentCreate.value) {
    return tournamentCreateTitles[tournamentCreateStep.value]
  }

  if (route.name === 'TournamentOverview') {
    return 'Tournament Overview'
  }

  if (route.name === 'TournamentCategory') {
    return activeCategory.value?.name || 'Tournament Division'
  }

  if (route.name === 'TournamentSchedule') {
    return 'Tournament Schedule'
  }

  if (route.name === 'TournamentGallery') {
    return 'Tournament Gallery'
  }

  if (route.name === 'TournamentMatchDetails') {
    return activeMatch.value
      ? `${activeMatch.value.player1Name || activeMatch.value.challengerName || 'Player 1'} vs ${
          activeMatch.value.player2Name || activeMatch.value.defenderName || 'Player 2'
        }`
      : 'Tournament Match'
  }

  if (route.name === 'PlayMatch') {
    return 'Live Scoreboard'
  }

  return route.meta.title || 'Renaissance Africa Tennis Club Port Harcourt'
})
const currentSubtitle = computed(() => {
  if (isTournamentCreate.value) {
    return tournamentCreateSubtitles[tournamentCreateStep.value]
  }

  if (route.name === 'TournamentOverview') {
    return activeTournament.value?.name
      ? `${activeTournament.value.name} progress, divisions, and live status.`
      : 'See divisions, progress, officials, and match status.'
  }

  if (route.name === 'TournamentCategory') {
    return 'Review groups, fixtures, standings, and knockout progress.'
  }

  if (route.name === 'TournamentSchedule') {
    return 'All fixtures across divisions, kept current as scores change.'
  }

  if (route.name === 'TournamentGallery') {
    return activeTournament.value?.name
      ? `Photos and memorable moments from ${activeTournament.value.name}.`
      : 'Browse and share moments from this tournament edition.'
  }

  if (route.name === 'TournamentMatchDetails') {
    return 'Review match status, score, schedule, and tournament context.'
  }

  if (route.name === 'PlayMatch') {
    return 'Projector-ready live scoring for the current match.'
  }

  return route.meta.subtitle || 'Manage the ladder from one calm workspace.'
})

const headerBackLabel = computed(() => {
  if (isLiveFullscreen.value) {
    return ''
  }

  if (isTournamentViewer.value || route.name === 'PlayMatch') {
    return 'Go back'
  }

  if (!isTournamentCreate.value) {
    return ''
  }

  return tournamentCreateStep.value === 'basics' ? 'Back to tournaments' : 'Previous step'
})
function getNavigationHref(to) {
  return router.resolve(to).href
}

function handleNavigationClick(to, event) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  ) {
    return
  }

  event.preventDefault()
  navigateTo(to)
}

function navigateTo(to) {
  const target = router.resolve(to)
  if (target.fullPath === route.fullPath) {
    return
  }

  router.push(to).catch(() => {})
}

function handleHeaderBack() {
  if (isTournamentViewer.value || route.name === 'PlayMatch') {
    if (window.history.length > 1) {
      router.back()
      return
    }

    router.push(
      route.params.tournamentId ? `/tournaments/${route.params.tournamentId}` : '/tournaments',
    )
    return
  }

  if (!isTournamentCreate.value) {
    return
  }

  const currentIndex = tournamentCreateSteps.indexOf(tournamentCreateStep.value)
  if (currentIndex <= 0) {
    router.push('/tournaments')
    return
  }

  router.replace({
    path: route.path,
    query: {
      ...route.query,
      step: tournamentCreateSteps[currentIndex - 1],
    },
  })
}

const unreadCount = computed(() => notificationStore.unreadCount)
const currentPlayer = computed(() => playerStore.currentPlayer)

const isNavigationActive = (routeName) => {
  return routeName === 'Tournaments'
    ? route.path.startsWith('/tournaments')
    : route.name === routeName
}
</script>

<style scoped>
.layout {
  font-family: 'Poppins', sans-serif;
  display: flex;
  min-height: 100vh;
  background: var(--color-bg);
}

/* SIDEBAR */
.sidebar {
  position: fixed;
  width: var(--app-sidebar-width);
  top: 0;
  bottom: 0;
  padding: 32px 22px;
  background: var(--color-sidebar);
  border-right: 0.5px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 28px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.08);
  z-index: 30;
}

.logo {
  display: flex;
  align-items: center;
}

.logo-img {
  width: 100%;
  max-width: 160px;
  height: auto;
  object-fit: contain;
}

/* NAV */
.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-width: 0;
  border: 0;
  padding: 10px 14px;
  border-radius: 10px;
  background: transparent;
  font-size: 13.5px;
  font-weight: 500;
  font-family: inherit;
  color: rgba(255, 255, 255, 0.72);
  text-decoration: none;
  text-align: left;
  cursor: pointer;
  transition:
    background 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;
}

.nav-link:hover {
  transform: translateY(-1px);
}

.nav-link:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(0, 181, 26, 0.18);
}

.icon {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon :deep(svg) {
  width: 16px;
  height: 16px;
}

.label {
  line-height: 1;
  min-width: 0;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
}

.nav-link.active {
  background: rgba(0, 181, 26, 0.18);
  color: #5cff93;
}

.badge {
  margin-left: auto;
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 20px;
  background: rgba(0, 200, 83, 0.12);
  color: #007a32;
}

/* MAIN */
.main {
  margin-left: var(--app-sidebar-width);
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding-top: 96px;
  position: relative;
}

.main--wide {
  margin-left: var(--app-sidebar-width);
}

.main--fullscreen {
  margin-left: 0;
  padding-top: 0;
}

.main.main--public {
  margin-left: 0;
  padding: 0;
}

/* HEADER (MORE PREMIUM SPACING) */
.header {
  position: fixed;
  top: 0;
  left: var(--app-sidebar-width);
  right: 0;
  background: rgba(255, 255, 255, 0.96);
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(18px);
  padding: 24px 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 40;
  box-shadow: 0 18px 48px rgba(15, 34, 24, 0.06);
  transition:
    padding 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.header-main {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 28px;
  min-width: 0;
}

.header--wide {
  left: var(--app-sidebar-width);
  min-height: 96px;
}

.header-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 38px;
  width: 38px;
  min-width: 38px;
  max-width: 38px;
  height: 38px;
  min-height: 38px;
  max-height: 38px;
  aspect-ratio: 1;
  border: 0.5px solid rgba(29, 111, 181, 0.18);
  border-radius: 50%;
  padding: 0;
  margin-right: 2px;
  overflow: visible;
  background: #e8f4ff;
  color: #1d6fb5;
  cursor: pointer;
  transition:
    transform 0.16s ease,
    background 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}

.header-back svg {
  flex: 0 0 19px;
  display: block;
  width: 19px;
  min-width: 19px;
  height: 19px;
  min-height: 19px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.header-back:hover {
  transform: none;
  border-color: rgba(29, 111, 181, 0.2);
  background: #dceeff;
  box-shadow: none;
}

.header-left {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.header-left h1 {
  font-size: 20px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.8);
  margin: 0;
  line-height: 1.25;
  letter-spacing: 0;
}

.header-left p {
  font-size: 12.5px;
  color: #7b8794;
  margin: 0;
  line-height: 1.4;
}

.header-steps {
  display: flex;
  align-items: center;
  gap: 0;
  min-width: 0;
  padding: 0;
  margin: 0;
  list-style: none;
}

.header-steps li {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: #8a96a5;
  font-size: 12px;
  font-weight: 800;
}

.header-steps li::after {
  content: '';
  width: 42px;
  height: 2px;
  margin: 0 12px;
  background: #dbe3ec;
}

.header-steps li:last-child::after {
  display: none;
}

.header-steps span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #eef2f6;
  color: #7b8794;
  font-size: 10px;
  line-height: 1;
  transition:
    transform 0.16s ease,
    background 0.16s ease,
    color 0.16s ease;
}

.header-steps strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-step--done,
.header-step--active {
  color: #007a32;
}

.header-step--done span {
  background: #00b51a;
  color: #ffffff;
}

.header-step--active span {
  transform: translateY(-1px);
  border: 2px solid #00b51a;
  background: rgba(0, 181, 26, 0.08);
  color: #007a32;
}

/* USER */
.user {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.header-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.user-name {
  font-size: 13px;
  font-weight: 500;
  color: #0f1720;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-role {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 3px 8px;
  background: rgba(0, 181, 26, 0.1);
  color: #007a32;
  font-size: 10px;
  font-weight: 800;
}

/* CONTENT */
.content {
  position: relative;
  padding: 32px;
  min-width: 0;
}

.content--wide {
  width: min(100%, 1440px);
  margin: 0 auto;
  padding: 28px;
}

.content--fullscreen {
  width: 100%;
  min-height: 100vh;
  padding: 0;
}

.content.content--public {
  width: 100%;
  min-height: 100vh;
  padding: 0;
}

.page-shell--public {
  min-height: 100vh;
}

.page-shell {
  position: relative;
  min-height: 100%;
}

.page-skeleton-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: radial-gradient(
    circle at top left,
    rgba(249, 251, 253, 0.98),
    rgba(229, 236, 245, 0.98)
  );
  backdrop-filter: blur(10px);
  display: grid;
  place-items: center;
  padding: 2rem;
  gap: 1.2rem;
  animation: pageSkeletonFade 180ms ease both;
}

@keyframes pageSkeletonFade {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.page-skeleton-stack {
  width: min(100%, 1080px);
  display: grid;
  gap: 1rem;
}

.page-skeleton-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.page-skeleton-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.page-skeleton-overlay .skeleton {
  background: rgba(218, 228, 239, 0.96);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.4);
}

.page-skeleton-overlay .skeleton::before {
  opacity: 0.28;
}

.page-skeleton-overlay .page-skeleton-row .skeleton {
  animation-delay: 80ms;
}

.page-skeleton-overlay .page-skeleton-grid .skeleton {
  animation-delay: 120ms;
}

.watch-only,
.bottom-nav {
  display: none;
}

@media (min-width: 768px) and (max-width: 1024px) {
  .layout {
    --app-sidebar-width: 68px;
  }

  .sidebar {
    padding: 24px 10px;
    align-items: center;
  }

  .logo-img {
    max-width: 44px;
  }

  .nav {
    width: 100%;
    align-items: center;
  }

  .nav-link {
    width: 48px;
    min-height: 44px;
    justify-content: center;
    padding: 10px;
    gap: 0;
  }

  .nav-link .label {
    display: none;
  }

  .nav-link .badge {
    position: absolute;
    top: 2px;
    right: 2px;
    margin-left: 0;
  }

  .main {
    padding-top: 96px;
  }

  .main--wide {
    margin-left: var(--app-sidebar-width);
  }

  .content {
    padding: 20px;
  }
}

@media (max-width: 767px) {
  .sidebar {
    display: none;
  }

  .main,
  .main--wide {
    margin-left: 0;
    padding-top: 82px;
    padding-bottom: 60px;
  }

  .main--fullscreen {
    padding-top: 0;
    padding-bottom: 0;
  }

  .header,
  .header--wide {
    left: 0;
    right: 0;
    width: 100%;
    padding: 18px 20px;
  }

  .header-main {
    gap: 14px;
  }

  .header-steps {
    max-width: min(52vw, 340px);
    overflow: hidden;
  }

  .header-steps strong {
    display: none;
  }

  .header-steps li::after {
    width: 10px;
    margin: 0 6px;
  }

  .user-name {
    display: none;
  }

  .content {
    padding: 16px;
  }

  .content--wide {
    width: 100%;
    padding: 16px;
  }

  .content--fullscreen {
    padding: 0;
  }

  .bottom-nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: 62px;
    background: rgba(11, 13, 12, 0.98);
    border-top: 0.5px solid rgba(255, 255, 255, 0.08);
    z-index: 40;
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    box-shadow: 0 14px 32px rgba(0, 0, 0, 0.18);
    border-radius: 16px 16px 0 0;
  }

  .bottom-nav .nav-link {
    transition:
      background 0.16s ease,
      color 0.16s ease,
      transform 0.16s ease;
    color: rgba(255, 255, 255, 0.82);
  }

  .bottom-nav .nav-link:hover {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.08);
  }

  .bottom-nav .nav-link {
    position: relative;
    min-width: 44px;
    min-height: 44px;
    height: 60px;
    justify-content: center;
    flex-direction: column;
    gap: 4px;
    padding: 7px 2px 6px;
    border-radius: 0;
    font-size: 10px;
    line-height: 1.1;
    text-align: center;
    background: transparent;
  }

  .bottom-nav .icon {
    width: 18px;
    height: 18px;
  }

  .bottom-nav .label {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bottom-nav .badge {
    position: absolute;
    top: 4px;
    right: calc(50% - 20px);
    margin-left: 0;
  }
}

@media (max-width: 480px) {
  .header {
    padding: 14px 16px;
    gap: 10px;
  }

  .header-back {
    flex-basis: 36px;
    width: 36px;
    min-width: 36px;
    max-width: 36px;
    height: 36px;
    min-height: 36px;
    max-height: 36px;
  }

  .header-left h1 {
    font-size: clamp(15px, 4vw, 20px);
  }

  .header-steps span {
    width: 26px;
    height: 26px;
  }

  .header-left p {
    font-size: 11.5px;
  }

  .user-name {
    display: none;
  }
}

@media (max-width: 162px) {
  .sidebar,
  .bottom-nav,
  .content > *:not(.watch-only) {
    display: none;
  }

  .header {
    display: flex;
    padding: 8px;
  }

  .header-actions {
    display: none;
  }

  .main {
    margin-left: 0;
    padding-bottom: 0;
  }

  .content {
    padding: 0;
  }

  .watch-only {
    display: flex;
    min-height: 100vh;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px;
    font-size: 9px;
    text-align: center;
  }
}
</style>
