<template>
  <div class="layout">
    <aside v-if="showSidebar" class="sidebar">
      <a
        class="brand"
        :href="getNavigationHref({ name: 'Dashboard' })"
        aria-label="GORRA Home"
        @click="handleNavigationClick({ name: 'Dashboard' }, $event)"
      >
        <span class="brand__mark" aria-hidden="true">G</span>
        <span class="brand__name">GORRA</span>
      </a>

      <nav class="primary-nav" aria-label="Primary navigation">
        <a
          v-for="item in navigationItems"
          :key="item.section"
          :href="getNavigationHref(item.to)"
          class="nav-link"
          :class="{ active: isNavigationActive(item.section) }"
          :aria-current="isNavigationActive(item.section) ? 'page' : undefined"
          :title="item.label"
          @click="handleNavigationClick(item.to, $event)"
        >
          <span class="icon" v-html="item.icon"></span>
          <span class="label">{{ item.label }}</span>
        </a>
      </nav>

      <div class="sidebar-club">
        <span class="sidebar-club__mark" aria-hidden="true">{{ clubInitials }}</span>
        <span>
          <small>Active club</small>
          <strong>{{ currentClubName }}</strong>
        </span>
      </div>
    </aside>

    <main
      class="main"
      :class="{
        'main--with-sidebar': showSidebar,
        'main--wide': isWideWorkspace,
        'main--fullscreen': isImmersiveRoute || isFocusedFlow,
        'main--public': isPublicRoute,
      }"
    >
      <header
        v-if="showHeader"
        class="app-header"
        :class="{ 'app-header--with-sidebar': showSidebar }"
      >
        <div class="global-identity">
          <span class="global-identity__brand" aria-hidden="true">GORRA</span>
          <div class="club-control">
            <label v-if="adminStore.hasMultipleClubs">
              <span class="visually-hidden">Current tennis club</span>
              <select
                :value="adminStore.activeClubId"
                :disabled="adminStore.isLoading"
                aria-label="Switch active tennis club"
                @change="switchClub"
              >
                <option v-for="club in adminStore.clubOptions" :key="club.id" :value="club.id">
                  {{ club.name }}
                </option>
              </select>
            </label>
            <span v-else class="club-control__name">{{ currentClubName }}</span>
          </div>
        </div>

        <div class="header-main">
          <button
            v-if="headerBackLabel"
            class="header-back"
            type="button"
            :aria-label="headerBackLabel"
            :title="headerBackLabel"
            @click="handleHeaderBack"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </button>

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

          <div v-else class="page-context">
            <h1>{{ currentTitle }}</h1>
            <p>{{ currentSubtitle }}</p>
          </div>
        </div>

        <div class="header-actions">
          <a
            :href="getNavigationHref({ name: 'Notifications' })"
            class="header-icon-button"
            :aria-label="unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'"
            title="Notifications"
            @click="handleNavigationClick({ name: 'Notifications' }, $event)"
          >
            <span class="icon" v-html="bellIcon"></span>
            <span v-if="unreadCount" class="notification-dot" aria-hidden="true"></span>
          </a>

          <div ref="accountMenuRoot" class="account">
            <button
              class="account-trigger"
              type="button"
              :aria-expanded="accountMenuOpen"
              aria-haspopup="menu"
              aria-label="Open account menu"
              @click="accountMenuOpen = !accountMenuOpen"
            >
              <span class="account-avatar" aria-hidden="true">{{ accountInitials }}</span>
              <span class="account-copy">
                <strong>{{ currentPlayer?.name || authStore.user?.name || 'Player' }}</strong>
                <small>{{ authStore.accessProfile.roleLabel || 'Player' }}</small>
              </span>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg>
            </button>

            <Transition name="menu">
              <div v-if="accountMenuOpen" class="account-menu" role="menu" aria-label="Account">
                <div class="account-menu__identity">
                  <span class="account-avatar" aria-hidden="true">{{ accountInitials }}</span>
                  <span>
                    <strong>{{ currentPlayer?.name || authStore.user?.name || 'Player' }}</strong>
                    <small>{{ authStore.user?.email || authStore.accessProfile.roleLabel }}</small>
                  </span>
                </div>

                <a
                  v-for="item in accountItems"
                  :key="item.label"
                  :href="getNavigationHref(item.to)"
                  role="menuitem"
                  @click="handleNavigationClick(item.to, $event)"
                >
                  <span class="icon" v-html="item.icon"></span>
                  <span>{{ item.label }}</span>
                </a>

                <button type="button" role="menuitem" @click="signOut">
                  <span class="icon" v-html="logoutIcon"></span>
                  <span>Sign out</span>
                </button>
              </div>
            </Transition>
          </div>
        </div>
      </header>

      <div
        class="content"
        :class="{
          'content--wide': isWideWorkspace,
          'content--fullscreen': isImmersiveRoute || isFocusedFlow,
          'content--public': isPublicRoute,
          'content--tournament-rail': usesTournamentCreateRail,
        }"
      >
        <nav
          v-if="showContextualNavigation"
          class="context-nav"
          :aria-label="`${activePrimaryLabel} navigation`"
        >
          <a
            v-for="item in contextualItems"
            :key="item.label"
            :href="getNavigationHref(item.to)"
            :class="{ active: isContextItemActive(item) }"
            :aria-current="isContextItemActive(item) ? 'page' : undefined"
            @click="handleNavigationClick(item.to, $event)"
          >
            {{ item.label }}
          </a>
        </nav>

        <div class="watch-only">
          <strong>Rank #{{ currentPlayer?.rank || '-' }}</strong>
          <span>{{ currentPlayer?.name || 'Player' }}</span>
          <span>{{ unreadCount }} unread</span>
        </div>

        <div
          class="page-shell"
          :class="{
            'page-shell--public': isPublicRoute,
            'page-shell--ready': !pageSkeletonActive,
          }"
        >
          <div v-if="pageSkeletonActive" class="page-skeleton-overlay" aria-hidden="true">
            <RoutePageSkeleton
              :route-name="String(route.name || '')"
              :friendly-step="String(route.meta.friendlyStep || '')"
              :friendly-match-type="friendlyMatchStore.draft.matchType"
              :friendly-timing="friendlyMatchStore.draft.timing"
              :fresh-dashboard="isFreshDashboardSkeleton"
              :opponent-count="
                friendlyMatchStore.draft.matchType === 'ladder'
                  ? friendlyMatchStore.ladderOpponents.length
                  : friendlyMatchStore.opponents.length
              "
            />
          </div>

          <RouterView v-slot="{ Component }">
            <Transition name="page" mode="out-in" appear>
              <component
                :is="Component"
                :key="
                  route.meta.onboardingFlow
                    ? 'onboarding-flow'
                    : route.meta.friendlyFlow
                      ? 'friendly-match-flow'
                      : route.fullPath
                "
              />
            </Transition>
          </RouterView>
        </div>
      </div>
    </main>

    <nav v-if="showBottomNav" class="bottom-nav" aria-label="Primary navigation">
      <a
        v-for="item in navigationItems"
        :key="`bottom-${item.section}`"
        :href="getNavigationHref(item.to)"
        class="bottom-nav__item"
        :class="{ active: isNavigationActive(item.section) }"
        :aria-current="isNavigationActive(item.section) ? 'page' : undefined"
        @click="handleNavigationClick(item.to, $event)"
      >
        <span class="icon" v-html="item.icon"></span>
        <span class="label">{{ item.label }}</span>
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
import { useFriendlyMatchStore } from '../stores/friendlyMatch'
import { usePlayerStore } from '../stores/player'
import { useTournamentStore } from '../stores/tournament'
import { useAuthStore } from '../stores/auth'
import { useAdminStore } from '../stores/admin'
import ToastShelf from '../components/ToastShelf.vue'
import RoutePageSkeleton from '../components/RoutePageSkeleton.vue'
import { APP_DATA_MODES, appDataMode } from '../dataMode'

const route = useRoute()
const router = useRouter()
const notificationStore = useNotificationStore()
const matchStore = useMatchStore()
const friendlyMatchStore = useFriendlyMatchStore()
const playerStore = usePlayerStore()
const tournamentStore = useTournamentStore()
const authStore = useAuthStore()
const adminStore = useAdminStore()

const accountMenuRoot = ref(null)
const accountMenuOpen = ref(false)
const mobileMediaQuery =
  typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)') : null
const isMobileViewport = ref(mobileMediaQuery?.matches ?? false)
const pageSkeletonActive = ref(true)
let pageSkeletonTimer = null
const PAGE_SKELETON_DURATION = 900
const FRIENDLY_FLOW_SKELETON_DURATION = 650

const homeIcon =
  '<svg viewBox="0 0 24 24" fill="none"><path d="m3 11 9-7 9 7v9H6v-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.5 20v-6h5v6" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'
const playIcon =
  '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8"/><path d="m10 8.5 5 3.5-5 3.5v-7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'
const competeIcon =
  '<svg viewBox="0 0 24 24" fill="none"><path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" stroke="currentColor" stroke-width="1.8"/><path d="M8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 11v5M8.5 20h7M9 16h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
const clubIcon =
  '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20V9l8-5 8 5v11H4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 20v-6h6v6M8 10h.01M12 10h.01M16 10h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
const profileIcon =
  '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.7"/><path d="M4 20c1.5-3.5 5-5 8-5s6.5 1.5 8 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'
const historyIcon =
  '<svg viewBox="0 0 24 24" fill="none"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M4 4v4.6h4.6M12 7.5V12l3 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
const settingsIcon =
  '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M12 3v2M12 19v2M21 12h-2M5 12H3M18.4 5.6 17 7M7 17l-1.4 1.4M18.4 18.4 17 17M7 7 5.6 5.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'
const bellIcon =
  '<svg viewBox="0 0 24 24" fill="none"><path d="M12 4.5A4.5 4.5 0 0 1 16.5 9v3.5l1.7 2v.7H5.8v-.7l1.7-2V9A4.5 4.5 0 0 1 12 4.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'
const logoutIcon =
  '<svg viewBox="0 0 24 24" fill="none"><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'

const navigationItems = Object.freeze([
  { to: { name: 'Dashboard' }, section: 'home', label: 'Home', icon: homeIcon },
  { to: { name: 'Play' }, section: 'play', label: 'Play', icon: playIcon },
  { to: { name: 'Rankings' }, section: 'compete', label: 'Compete', icon: competeIcon },
  { to: { name: 'Club' }, section: 'club', label: 'Club', icon: clubIcon },
])

const accountItems = computed(() => {
  const items = [
    { to: { name: 'Profile' }, label: 'View profile', icon: profileIcon },
    { to: { name: 'History' }, label: 'Match history', icon: historyIcon },
    { to: { name: 'AccountSettings' }, label: 'Account settings', icon: settingsIcon },
  ]
  if (authStore.hasPermission('club.manage')) {
    items.push({
      to: { name: 'Settings' },
      label: 'Club settings',
      icon: clubIcon,
    })
  }
  return items
})

const currentPlayer = computed(() => playerStore.currentPlayer)
const unreadCount = computed(() => notificationStore.unreadCount)
const currentClubName = computed(() => adminStore.activeClub?.name || 'Your tennis club')
const clubInitials = computed(() =>
  currentClubName.value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase(),
)
const accountInitials = computed(() => {
  const name = currentPlayer.value?.name || authStore.user?.name || 'Player'
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : name.slice(0, 2)).toUpperCase()
})
const isFreshDashboardSkeleton = computed(
  () =>
    route.name === 'Dashboard' && appDataMode.value === APP_DATA_MODES.EMPTY && !authStore.isAdmin,
)

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
const isPublicRoute = computed(() => route.meta.public === true)
const isFriendlyFlow = computed(() => route.meta.friendlyFlow === true)
const isOnboardingFlow = computed(() => route.meta.onboardingFlow === true)
const isFocusedFlow = computed(() => isFriendlyFlow.value || isOnboardingFlow.value)
const isImmersiveRoute = computed(() => route.meta.immersive === true)
const isWideWorkspace = computed(() => isTournamentCreate.value || isTournamentViewer.value)
const showAppChrome = computed(
  () => !isPublicRoute.value && !isFocusedFlow.value && !isImmersiveRoute.value,
)
const showSidebar = computed(
  () => showAppChrome.value && !usesTournamentCreateRail.value && !isMobileViewport.value,
)
const showHeader = computed(() => showAppChrome.value)
const showBottomNav = computed(() => showAppChrome.value && isMobileViewport.value)

const activePrimarySection = computed(() => {
  if (route.meta.primarySection) return String(route.meta.primarySection)
  if (route.path === '/dashboard') return 'home'
  if (route.path === '/play' || route.path.startsWith('/play/')) return 'play'
  if (route.path.startsWith('/friendly-match') || route.path.startsWith('/ladder-match')) {
    return 'play'
  }
  if (
    route.path.startsWith('/rankings') ||
    route.path.startsWith('/challenges') ||
    route.path.startsWith('/tournaments') ||
    route.path.startsWith('/matches')
  ) {
    return 'compete'
  }
  if (
    route.path === '/club' ||
    route.path.startsWith('/club/') ||
    route.path.startsWith('/clubs') ||
    route.path.startsWith('/admin/setup')
  ) {
    return 'club'
  }
  return ''
})
const activePrimaryLabel = computed(
  () => navigationItems.find((item) => item.section === activePrimarySection.value)?.label || '',
)
const contextualItems = computed(() => {
  if (activePrimarySection.value === 'compete') {
    return [
      { label: 'Ladder', to: { name: 'Rankings' }, key: 'ladder' },
      { label: 'Challenges', to: { name: 'Challenges' }, key: 'challenges' },
      { label: 'Tournaments', to: { name: 'Tournaments' }, key: 'tournaments' },
    ]
  }
  if (activePrimarySection.value === 'club') {
    const items = [
      { label: 'Overview', to: { name: 'Club' }, key: 'overview' },
      {
        label: 'Members',
        to: { name: 'Club', query: { section: 'members' } },
        key: 'members',
      },
      {
        label: 'Rules',
        to: { name: 'Club', query: { section: 'rules' } },
        key: 'rules',
      },
    ]
    if (authStore.hasPermission('club.manage')) {
      items.push({ label: 'Manage', to: { name: 'Settings' }, key: 'manage' })
    }
    return items
  }
  return []
})
const showContextualNavigation = computed(
  () => showAppChrome.value && contextualItems.value.length > 0 && !isTournamentCreate.value,
)

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
  if (isTournamentCreate.value) return tournamentCreateTitles[tournamentCreateStep.value]
  if (route.name === 'TournamentOverview') return 'Tournament Overview'
  if (route.name === 'TournamentCategory') {
    return activeCategory.value?.name || 'Tournament Division'
  }
  if (route.name === 'TournamentSchedule') return 'Tournament Schedule'
  if (route.name === 'TournamentGallery') return 'Tournament Gallery'
  if (route.name === 'TournamentMatchDetails') {
    return activeMatch.value
      ? `${activeMatch.value.player1Name || activeMatch.value.challengerName || 'Player 1'} vs ${
          activeMatch.value.player2Name || activeMatch.value.defenderName || 'Player 2'
        }`
      : 'Tournament Match'
  }
  return route.meta.title || 'GORRA'
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
  return route.meta.subtitle || ''
})
const headerBackLabel = computed(() => {
  if (isTournamentViewer.value) return 'Go back'
  if (!isTournamentCreate.value) return ''
  return tournamentCreateStep.value === 'basics' ? 'Back to tournaments' : 'Previous step'
})

function schedulePageSkeleton(targetRoute = route) {
  pageSkeletonActive.value = true
  if (pageSkeletonTimer) window.clearTimeout(pageSkeletonTimer)
  const duration =
    targetRoute.meta?.friendlyFlow || targetRoute.meta?.onboardingFlow
      ? FRIENDLY_FLOW_SKELETON_DURATION
      : PAGE_SKELETON_DURATION
  pageSkeletonTimer = window.setTimeout(() => {
    pageSkeletonActive.value = false
    pageSkeletonTimer = null
  }, duration)
}

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
  accountMenuOpen.value = false
  const target = router.resolve(to)
  if (target.fullPath !== route.fullPath) router.push(to).catch(() => {})
}

function isNavigationActive(section) {
  return activePrimarySection.value === section
}

function isContextItemActive(item) {
  if (item.key === 'ladder') return route.name === 'Rankings'
  if (item.key === 'challenges') {
    return ['Challenges', 'MatchDetails'].includes(String(route.name || ''))
  }
  if (item.key === 'tournaments') return route.path.startsWith('/tournaments')
  if (item.key === 'manage') return route.name === 'Settings'
  if (route.name !== 'Club') return false
  const section = String(route.query.section || 'overview')
  return item.key === section
}

async function switchClub(event) {
  const clubId = event.target.value
  if (!clubId || clubId === adminStore.activeClubId) return
  try {
    await adminStore.switchClub(clubId)
    notificationStore.addToast({
      message: `${currentClubName.value} is now active.`,
      type: 'success',
    })
  } catch (error) {
    notificationStore.addToast({
      message: error?.message || 'Unable to switch clubs.',
      type: 'error',
    })
  }
}

function handleHeaderBack() {
  if (isTournamentViewer.value) {
    if (window.history.length > 1) router.back()
    else {
      router.push(
        route.params.tournamentId ? `/tournaments/${route.params.tournamentId}` : '/tournaments',
      )
    }
    return
  }
  if (!isTournamentCreate.value) return
  const currentIndex = tournamentCreateSteps.indexOf(tournamentCreateStep.value)
  if (currentIndex <= 0) {
    router.push('/tournaments')
    return
  }
  router.replace({
    path: route.path,
    query: { ...route.query, step: tournamentCreateSteps[currentIndex - 1] },
  })
}

async function signOut() {
  accountMenuOpen.value = false
  authStore.logout()
  await router.replace({ name: 'SignIn' })
}

function handleDocumentPointer(event) {
  if (accountMenuOpen.value && !accountMenuRoot.value?.contains(event.target)) {
    accountMenuOpen.value = false
  }
}

function handleDocumentKeydown(event) {
  if (event.key === 'Escape') accountMenuOpen.value = false
}

function updateViewportMode(event) {
  isMobileViewport.value = event.matches
}

onMounted(() => {
  if (!isPublicRoute.value && !playerStore.players.length) playerStore.loadPlayers()
  if (!isPublicRoute.value) adminStore.loadClubs().catch(() => {})
  if (isPublicRoute.value) pageSkeletonActive.value = false
  else schedulePageSkeleton(route)
  document.addEventListener('pointerdown', handleDocumentPointer)
  document.addEventListener('keydown', handleDocumentKeydown)
  mobileMediaQuery?.addEventListener('change', updateViewportMode)
})

const removeRouteAfterEach = router.afterEach((to) => {
  accountMenuOpen.value = false
  if (to.meta.public === true) pageSkeletonActive.value = false
  else schedulePageSkeleton(to)
})

onUnmounted(() => {
  if (pageSkeletonTimer) window.clearTimeout(pageSkeletonTimer)
  if (typeof removeRouteAfterEach === 'function') removeRouteAfterEach()
  document.removeEventListener('pointerdown', handleDocumentPointer)
  document.removeEventListener('keydown', handleDocumentKeydown)
  mobileMediaQuery?.removeEventListener('change', updateViewportMode)
})
</script>

<style scoped>
.layout {
  --app-header-height: 76px;
  --app-bottom-nav-height: 66px;
  min-height: 100vh;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: 'Poppins', sans-serif;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 30;
  display: flex;
  width: var(--app-sidebar-width);
  flex-direction: column;
  gap: 30px;
  padding: 24px 18px;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  color: var(--color-text);
  text-decoration: none;
}

.brand__mark {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  font-weight: var(--font-weight-bold);
}

.brand__name {
  font-size: 16px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.08em;
}

.primary-nav {
  display: grid;
  gap: 5px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 46px;
  padding: 10px 12px;
  border-radius: var(--app-inner-radius);
  color: var(--color-text-soft);
  text-decoration: none;
  transition:
    background var(--motion-short) var(--motion-curve),
    color var(--motion-short) var(--motion-curve);
}

.nav-link:hover {
  background: var(--color-surface-soft);
  color: var(--color-text);
}

.nav-link.active {
  background: color-mix(in srgb, var(--color-primary) 8%, white);
  color: var(--color-primary-strong);
}

.icon {
  display: grid;
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
  place-items: center;
}

.icon :deep(svg) {
  width: 21px;
  height: 21px;
}

.label {
  min-width: 0;
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
}

.sidebar-club {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  margin-top: auto;
  padding: 12px 8px 0;
  border-top: 1px solid var(--color-border);
}

.sidebar-club__mark {
  display: grid;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 9px;
  background: var(--color-surface-soft);
  color: var(--color-primary-strong);
  font-size: 10px;
  font-weight: var(--font-weight-bold);
}

.sidebar-club > span:last-child {
  display: grid;
  min-width: 0;
}

.sidebar-club small {
  color: var(--color-muted);
  font-size: 9px;
  text-transform: uppercase;
}

.sidebar-club strong {
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.main {
  min-width: 0;
  min-height: 100vh;
  padding-top: var(--app-header-height);
}

.main--with-sidebar {
  margin-left: var(--app-sidebar-width);
}

.main--fullscreen,
.main--public {
  margin-left: 0;
  padding: 0;
}

.app-header {
  position: fixed;
  inset: 0 0 auto 0;
  z-index: 40;
  display: grid;
  grid-template-columns: minmax(170px, auto) minmax(0, 1fr) auto;
  align-items: center;
  min-height: var(--app-header-height);
  gap: 24px;
  padding: 12px 26px;
  border-bottom: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 4px 18px rgba(15, 34, 24, 0.035);
  backdrop-filter: blur(14px);
}

.app-header--with-sidebar {
  left: var(--app-sidebar-width);
}

.global-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.global-identity__brand {
  display: none;
  color: var(--color-text);
  font-size: 13px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.08em;
}

.club-control {
  min-width: 0;
}

.club-control label {
  display: block;
}

.club-control select,
.club-control__name {
  display: block;
  max-width: 220px;
  min-height: 36px;
  overflow: hidden;
  padding: 8px 28px 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-inner-radius);
  background: var(--color-surface);
  color: var(--color-text-soft);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.club-control__name {
  min-height: auto;
  padding: 0;
  border: 0;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.page-context {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.page-context h1,
.page-context p {
  overflow: hidden;
  margin: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-context h1 {
  color: var(--color-text);
  font-size: 17px;
  letter-spacing: -0.01em;
}

.page-context p {
  color: var(--color-muted);
  font-size: 11px;
}

.header-back {
  display: grid;
  width: 40px;
  min-width: 40px;
  min-height: 40px;
  padding: 0;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-text-soft);
}

.header-back svg {
  width: 19px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.header-steps {
  display: flex;
  align-items: center;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.header-steps li {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--color-muted);
  font-size: 11px;
}

.header-steps li::after {
  content: '';
  width: 26px;
  height: 1px;
  margin: 0 9px;
  background: var(--color-border-strong);
}

.header-steps li:last-child::after {
  display: none;
}

.header-steps span {
  display: grid;
  width: 27px;
  height: 27px;
  place-items: center;
  border-radius: 50%;
  background: var(--color-surface-soft);
  font-size: 9px;
}

.header-step--done span {
  background: var(--color-primary);
  color: #fff;
}

.header-step--active {
  color: var(--color-primary-strong) !important;
}

.header-step--active span {
  border: 2px solid var(--color-primary);
  background: #fff;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon-button,
.account-trigger {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-soft);
}

.header-icon-button {
  position: relative;
  display: grid;
  width: 44px;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  place-items: center;
  border-radius: 50%;
  text-decoration: none;
}

.notification-dot {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 8px;
  height: 8px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: var(--color-primary);
}

.account {
  position: relative;
}

.account-trigger {
  display: flex;
  min-height: 46px;
  gap: 9px;
  padding: 4px 8px 4px 5px;
  border-radius: 24px;
}

.account-avatar {
  display: grid;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 50%;
  background: var(--color-surface-soft);
  color: var(--color-primary-strong);
  font-size: 10px;
  font-weight: var(--font-weight-bold);
}

.account-copy {
  display: grid;
  min-width: 0;
  text-align: left;
}

.account-copy strong,
.account-copy small {
  max-width: 125px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-copy strong {
  color: var(--color-text);
  font-size: 11px;
}

.account-copy small {
  color: var(--color-muted);
  font-size: 9px;
}

.account-trigger > svg {
  width: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.account-menu {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 60;
  display: grid;
  width: min(280px, calc(100vw - 24px));
  overflow: hidden;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  box-shadow: 0 18px 44px rgba(15, 34, 24, 0.12);
}

.account-menu__identity {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 8px 9px 12px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--color-border);
}

.account-menu__identity > span:last-child {
  display: grid;
  min-width: 0;
}

.account-menu__identity strong,
.account-menu__identity small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-menu__identity strong {
  font-size: 12px;
}

.account-menu__identity small {
  color: var(--color-muted);
  font-size: 10px;
}

.account-menu > a,
.account-menu > button {
  display: flex;
  justify-content: flex-start;
  min-height: 43px;
  gap: 10px;
  padding: 9px 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--color-text-soft);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
}

.account-menu > a:hover,
.account-menu > button:hover {
  background: var(--color-surface-soft);
  color: var(--color-text);
}

.menu-enter-active,
.menu-leave-active {
  transition:
    opacity var(--motion-short) ease,
    transform var(--motion-short) var(--motion-curve);
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

.content {
  position: relative;
  min-width: 0;
  padding: 26px 30px 36px;
}

.content--wide {
  width: min(100%, 1440px);
  margin: 0 auto;
}

.content--fullscreen,
.content--public {
  width: 100%;
  min-height: 100vh;
  padding: 0;
}

.context-nav {
  position: sticky;
  top: var(--app-header-height);
  z-index: 22;
  display: flex;
  width: 100%;
  gap: 4px;
  margin: -26px 0 24px;
  padding: 10px 0 0;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
  overflow-x: auto;
  scrollbar-width: none;
}

.context-nav::-webkit-scrollbar {
  display: none;
}

.context-nav a {
  position: relative;
  display: grid;
  min-width: max-content;
  min-height: 46px;
  padding: 0 14px;
  place-items: center;
  color: var(--color-muted);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
}

.context-nav a::after {
  content: '';
  position: absolute;
  inset: auto 12px -1px;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: transparent;
}

.context-nav a.active {
  color: var(--color-primary-strong);
}

.context-nav a.active::after {
  background: var(--color-primary);
}

.page-shell {
  position: relative;
  min-height: 100%;
}

.page-shell--public {
  min-height: 100vh;
}

.page-skeleton-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  min-height: 100%;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.985);
  backdrop-filter: blur(5px);
  animation: pageSkeletonFade 180ms ease both;
}

@keyframes pageSkeletonFade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes contentSettleIn {
  0% {
    opacity: 0;
    transform: translate3d(0, 7px, 0) scale(0.992);
  }
  68% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1.002);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

.page-shell--ready :deep(.dashboard > *),
.page-shell--ready :deep(.friendly-home > *),
.page-shell--ready :deep(.section-group .grid > *),
.page-shell--ready :deep(.dashboard-alerts__list > *),
.page-shell--ready :deep(.friendly-flow__screen > *),
.page-shell--ready :deep(.friendly-flow__choices > *),
.page-shell--ready :deep(.opponent-list > *),
.page-shell--ready :deep(.friendly-live > *),
.page-shell--ready :deep(.friendly-live__players > *) {
  animation: contentSettleIn 440ms var(--motion-curve) both;
  animation-delay: calc(var(--reveal-order, 0) * 55ms);
  transform-origin: center;
}

.page-shell--ready :deep(* > :nth-child(1)) {
  --reveal-order: 0;
}
.page-shell--ready :deep(* > :nth-child(2)) {
  --reveal-order: 1;
}
.page-shell--ready :deep(* > :nth-child(3)) {
  --reveal-order: 2;
}
.page-shell--ready :deep(* > :nth-child(4)) {
  --reveal-order: 3;
}
.page-shell--ready :deep(* > :nth-child(5)) {
  --reveal-order: 4;
}
.page-shell--ready :deep(* > :nth-child(6)) {
  --reveal-order: 5;
}

.watch-only,
.bottom-nav {
  display: none;
}

@media (min-width: 768px) and (max-width: 1023px) {
  .layout {
    --app-sidebar-width: 76px;
  }

  .sidebar {
    align-items: center;
    padding-inline: 10px;
  }

  .brand__name,
  .nav-link .label,
  .sidebar-club > span:last-child {
    display: none;
  }

  .primary-nav {
    width: 100%;
  }

  .nav-link {
    justify-content: center;
    padding-inline: 0;
  }

  .sidebar-club {
    justify-content: center;
    width: 100%;
    padding-inline: 0;
  }

  .account-copy {
    display: none;
  }
}

@media (max-width: 767px) {
  .layout {
    --app-header-height: 68px;
    --app-bottom-nav-height: 64px;
  }

  .sidebar {
    display: none;
  }

  .main,
  .main--with-sidebar {
    margin-left: 0;
    padding-top: var(--app-header-height);
    padding-bottom: calc(var(--app-bottom-nav-height) + env(safe-area-inset-bottom, 0px));
  }

  .main--fullscreen,
  .main--public {
    padding: 0;
  }

  .app-header,
  .app-header--with-sidebar {
    left: 0;
    grid-template-columns: minmax(0, 1fr) auto;
    min-height: var(--app-header-height);
    gap: 10px;
    padding: 9px 14px;
  }

  .global-identity {
    gap: 8px;
  }

  .global-identity__brand {
    display: block;
  }

  .club-control__name,
  .club-control select {
    max-width: min(45vw, 190px);
    font-size: 10.5px;
  }

  .club-control select {
    min-height: 38px;
  }

  .header-main {
    display: none;
  }

  .account-copy,
  .account-trigger > svg {
    display: none;
  }

  .account-trigger {
    width: 44px;
    min-width: 44px;
    padding: 4px;
    border-radius: 50%;
  }

  .account-avatar {
    width: 34px;
    height: 34px;
  }

  .content {
    padding: 18px 16px 28px;
  }

  .content--fullscreen,
  .content--public {
    padding: 0;
  }

  .context-nav {
    top: var(--app-header-height);
    margin: -18px -16px 18px;
    width: calc(100% + 32px);
    padding: 6px 8px 0;
    background: rgba(255, 255, 255, 0.98);
  }

  .context-nav a {
    min-height: 44px;
    padding-inline: 12px;
  }

  .bottom-nav {
    position: fixed;
    inset: auto 0 0;
    z-index: 40;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    min-height: calc(var(--app-bottom-nav-height) + env(safe-area-inset-bottom, 0px));
    padding: 3px 6px env(safe-area-inset-bottom, 0px);
    border-top: 1px solid var(--color-border);
    background: rgba(255, 255, 255, 0.98);
    box-shadow: 0 -5px 18px rgba(15, 34, 24, 0.04);
    backdrop-filter: blur(14px);
  }

  .bottom-nav__item {
    display: flex;
    min-width: 0;
    min-height: 58px;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 3px;
    padding: 6px 3px 5px;
    border-radius: 0;
    background: transparent;
    color: var(--color-muted);
    text-align: center;
    text-decoration: none;
  }

  .bottom-nav__item .icon {
    width: 21px;
    height: 21px;
  }

  .bottom-nav__item .label {
    width: 100%;
    overflow: visible;
    font-size: 10px;
    line-height: 1.1;
    text-overflow: clip;
    white-space: nowrap;
  }

  .bottom-nav__item.active {
    color: var(--color-primary-strong);
  }
}

@media (max-width: 390px) {
  .global-identity__brand {
    font-size: 11px;
  }

  .club-control__name,
  .club-control select {
    max-width: 39vw;
  }

  .header-actions {
    gap: 5px;
  }

  .header-icon-button,
  .account-trigger {
    width: 42px;
    min-width: 42px;
    min-height: 42px;
  }
}

@media (max-width: 162px) {
  .sidebar,
  .app-header,
  .bottom-nav,
  .content > *:not(.watch-only) {
    display: none;
  }

  .main {
    margin-left: 0;
    padding: 0;
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

@media (prefers-reduced-motion: reduce) {
  .page-shell--ready :deep(.dashboard > *),
  .page-shell--ready :deep(.friendly-home > *),
  .page-shell--ready :deep(.section-group .grid > *),
  .page-shell--ready :deep(.dashboard-alerts__list > *),
  .page-shell--ready :deep(.friendly-flow__screen > *),
  .page-shell--ready :deep(.friendly-flow__choices > *),
  .page-shell--ready :deep(.opponent-list > *),
  .page-shell--ready :deep(.friendly-live > *),
  .page-shell--ready :deep(.friendly-live__players > *) {
    animation: none !important;
  }

  .menu-enter-active,
  .menu-leave-active {
    transition: none;
  }
}
</style>
