<template>
  <div
    class="layout"
    :class="{
      'layout--sidebar-collapsed': sidebarCollapsed,
      'layout--migrated': isMigratedSurface,
      'layout--club-theme': String(route.name || '').startsWith('Club') || route.name === 'Settings',
    }"
  >
    <aside v-if="showSidebar" class="sidebar">
      <div class="brand-row">
        <a
          class="brand"
          :href="getNavigationHref({ name: 'Dashboard' })"
          aria-label="GORRA Home"
          @click="handleNavigationClick({ name: 'Dashboard' }, $event)"
        >
          <AppLogo class="brand__logo" :on-dark="false" />
          <span class="brand__mark" aria-hidden="true">G</span>
        </a>
        <button
          class="sidebar-toggle"
          type="button"
          :aria-label="sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'"
          :title="sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'"
          @click="toggleSidebar"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path :d="sidebarCollapsed ? 'm9 6 6 6-6 6' : 'm15 6-6 6 6 6'" />
          </svg>
        </button>
      </div>

      <div ref="clubMenuRoot" class="club-switcher">
        <button
          class="club-switcher__trigger"
          type="button"
          aria-haspopup="menu"
          :aria-expanded="clubMenuOpen"
          :disabled="adminStore.isLoading || !adminStore.activeClub"
          @click="clubMenuOpen = !clubMenuOpen"
        >
          <span class="club-switcher__mark" aria-hidden="true">{{ currentClubInitials }}</span>
          <span class="club-switcher__copy">
            <small>Active club</small>
            <strong>{{ currentClubName }}</strong>
          </span>
          <svg class="club-switcher__chevron" viewBox="0 0 20 20" aria-hidden="true">
            <path d="m6 8 4 4 4-4" />
          </svg>
        </button>

        <Transition name="menu">
          <div v-if="clubMenuOpen" class="club-menu" role="menu" aria-label="Switch active club">
            <button
              v-for="club in adminStore.clubOptions"
              :key="club.id"
              class="club-menu__item"
              type="button"
              role="menuitem"
              :disabled="adminStore.isLoading"
              @click="switchClub(club.id)"
            >
              <span class="club-menu__copy">
                <strong>{{ club.name }}</strong>
                <small>{{ formatClubRole(club.role) }}</small>
              </span>
              <svg
                v-if="club.id === adminStore.activeClubId"
                class="club-menu__check"
                viewBox="0 0 20 20"
                aria-label="Current club"
              >
                <path d="m4 10 4 4 8-9" />
              </svg>
              <span
                v-else-if="switchingClubId === club.id"
                class="club-menu__loading"
                aria-label="Switching club"
              ></span>
            </button>

            <a
              :href="getNavigationHref({ name: 'Clubs' })"
              class="club-menu__all"
              role="menuitem"
              @click="handleNavigationClick({ name: 'Clubs' }, $event)"
            >
              <span>All clubs</span>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="m8 5 5 5-5 5" />
              </svg>
            </a>
          </div>
        </Transition>
      </div>

      <nav class="primary-nav" aria-label="Primary navigation" :style="primaryMotionStyle">
        <span
          v-if="primaryMotion.active"
          :key="`primary-motion-${primaryMotion.revision}`"
          class="primary-nav__motion"
          aria-hidden="true"
        ></span>
        <template v-for="item in navigationItems" :key="item.section">
          <a
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
        </template>
      </nav>
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
        :class="{
          'app-header--with-sidebar': showSidebar,
          'app-header--section': showSectionHeaderContext,
        }"
      >
        <div class="header-content">
          <a
            class="global-identity"
            :href="getNavigationHref({ name: 'Dashboard' })"
            aria-label="GORRA Home"
            @click="handleNavigationClick({ name: 'Dashboard' }, $event)"
          >
            <AppLogo class="global-identity__logo" :on-dark="false" />
          </a>

          <div class="header-main" :class="{ 'header-main--nested': nestedHeader }">
            <div v-if="nestedHeader" class="nested-header-context">
              <button
                class="nested-header-back"
                type="button"
                @click="handleHeaderBack"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                <span>{{ nestedHeader.label }}</span>
              </button>

              <ol
                v-if="nestedHeader.crumbs.length"
                class="nested-header-crumbs"
                aria-label="Breadcrumb"
              >
                <li
                  v-for="(crumb, index) in nestedHeader.crumbs"
                  :key="`${crumb.label}-${index}`"
                >
                  <a
                    v-if="crumb.to"
                    :href="getNavigationHref(crumb.to)"
                    @click="handleNavigationClick(crumb.to, $event)"
                  >
                    {{ crumb.label }}
                  </a>

                  <span v-else>{{ crumb.label }}</span>

                  <i
                    v-if="index < nestedHeader.crumbs.length - 1"
                    aria-hidden="true"
                  >
                    ›
                  </i>
                </li>
              </ol>
            </div>

            <template v-else>
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

              <div v-else-if="showRoutePageContext" class="page-context">
                <h1>{{ currentTitle }}</h1>
                <p>{{ currentSubtitle }}</p>
              </div>
            </template>
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
                  <small>{{ adminStore.activeClubRoleLabel }}</small>
                </span>
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg>
              </button>

              <Transition name="menu">
                <div v-if="accountMenuOpen" class="account-menu" role="menu" aria-label="Account">
                  <div class="account-menu__identity">
                    <span class="account-avatar" aria-hidden="true">{{ accountInitials }}</span>
                    <span>
                      <strong>{{ currentPlayer?.name || authStore.user?.name || 'Player' }}</strong>
                      <small>{{ authStore.user?.email || adminStore.activeClubRoleLabel }}</small>
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
        </div>
      </header>

      <div
        class="content"
        :class="{
          'content--wide': isWideWorkspace,
          'content--fullscreen': isImmersiveRoute || isFocusedFlow,
          'content--public': isPublicRoute,
          'content--ladder': isLadderWorkspace,
        }"
      >
        <nav
          v-if="showContextualNavigation"
          class="context-nav"
          :class="{ 'context-nav--club': activePrimarySection === 'club' }"
          :aria-label="`${activePrimaryLabel} navigation`"
          :style="contextMotionStyle"
        >
          <span
            v-if="contextMotion.active"
            :key="`context-motion-${contextMotion.revision}`"
            class="context-nav__motion"
            aria-hidden="true"
          ></span>
          <a
            v-for="item in contextualItems"
            :key="item.label"
            :href="getNavigationHref(item.to)"
            :class="{ active: isContextItemActive(item) }"
            :aria-current="isContextItemActive(item) ? 'page' : undefined"
            @click="handleNavigationClick(item.to, $event)"
          >
            <span class="context-nav__icon" aria-hidden="true" v-html="item.icon"></span>
            <span>{{ item.label }}</span>
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
              :fresh-dashboard="false"
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
                      : `${route.fullPath}:${adminStore.activeClubId || 'no-club'}`
                "
              />
            </Transition>
          </RouterView>
        </div>
      </div>
    </main>

    <nav
      v-if="showBottomNav"
      class="bottom-nav"
      aria-label="Primary navigation"
      :style="primaryMotionStyle"
    >
      <span
        v-if="primaryMotion.active"
        :key="`bottom-motion-${primaryMotion.revision}`"
        class="bottom-nav__motion"
        aria-hidden="true"
      ></span>
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
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
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
import AppLogo from '../components/AppLogo.vue'

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
const clubMenuRoot = ref(null)
const nestedHeader = ref(null)
const accountMenuOpen = ref(false)
const clubMenuOpen = ref(false)
const switchingClubId = ref('')
const mobileMediaQuery =
  typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)') : null
const isMobileViewport = ref(mobileMediaQuery?.matches ?? false)
const pageSkeletonActive = ref(true)
const sidebarCollapsed = ref(false)
const sidebarWasCollapsedBeforeAdminMatch = ref(false)
const adminMatchDrawerOwnsSidebar = ref(false)
let pageSkeletonTimer = null
const PAGE_SKELETON_DURATION = 900
const FRIENDLY_FLOW_SKELETON_DURATION = 650
const primaryMotion = ref({ active: false, from: 0, to: 0, revision: 0 })
const contextMotion = ref({ active: false, from: 0, to: 0, revision: 0 })
let primaryMotionTimer = null
let contextMotionTimer = null

const homeIcon =
  '<svg viewBox="0 0 24 24" fill="none"><path d="m3 11 9-7 9 7v9H6v-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.5 20v-6h5v6" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'
const playIcon =
  '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8"/><path d="m10 8.5 5 3.5-5 3.5v-7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'
const competeIcon =
  '<svg viewBox="0 0 24 24" fill="none"><path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" stroke="currentColor" stroke-width="1.8"/><path d="M8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 11v5M8.5 20h7M9 16h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
const clubIcon =
  '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20V9l8-5 8 5v11H4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 20v-6h6v6M8 10h.01M12 10h.01M16 10h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
const overviewIcon =
  '<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.7"/><rect x="14" y="4" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.7"/><rect x="4" y="14" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.7"/><rect x="14" y="14" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.7"/></svg>'
const membersIcon =
  '<svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="9" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 20c.5-3.4 2.3-5 5.5-5s5 1.6 5.5 5M15.5 6.5a3 3 0 0 1 0 5.8M16 15c2.7.2 4.1 1.8 4.5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'
const rulesIcon =
  '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h5M15 7h5M4 17h9M17 17h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="7" r="3" stroke="currentColor" stroke-width="1.7"/><circle cx="15" cy="17" r="2" stroke="currentColor" stroke-width="1.7"/></svg>'
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
const tournamentIcon =
  '<svg viewBox="0 0 24 24" fill="none"><path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" stroke="currentColor" stroke-width="1.8"/><path d="M8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 11v5M8.5 20h7M9 16h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'

const navigationItems = Object.freeze([
  { to: { name: 'Dashboard' }, section: 'home', label: 'Home', icon: homeIcon },
  { to: { name: 'Play' }, section: 'play', label: 'Play', icon: playIcon },
  { to: { name: 'Rankings' }, section: 'ladder', label: 'Ladder', icon: competeIcon },
  {
    to: { name: 'Tournaments' },
    section: 'tournament',
    label: 'Tournament',
    icon: tournamentIcon,
  },
  { to: { name: 'Clubs' }, section: 'club', label: 'Club', icon: clubIcon },
])

const accountItems = computed(() => {
  return [
    { to: { name: 'Profile' }, label: 'View profile', icon: profileIcon },
    { to: { name: 'History' }, label: 'Match history', icon: historyIcon },
    { to: { name: 'AccountSettings' }, label: 'Account settings', icon: settingsIcon },
  ]
})

const currentPlayer = computed(() => playerStore.currentPlayer)
const unreadCount = computed(() => notificationStore.unreadCount)
const currentClubName = computed(() => adminStore.activeClub?.name || 'Your tennis club')
const currentClubInitials = computed(() =>
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

const tournamentCreateSteps = ['details', 'where', 'events', 'review']
const tournamentCreateTitles = {
  details: 'Details',
  where: 'Where & When',
  events: 'Events',
  review: 'Review',
}
const tournamentCreateSubtitles = {
  details: 'Name the event and set its dates.',
  where: 'Choose the venue, hours, and usable courts.',
  events: 'Choose events, formats, scoring, and seeding policy.',
  review: 'Check the tournament and derived registration form.',
}

const isTournamentCreate = computed(() => route.name === 'TournamentCreate')
const isLadderWorkspace = computed(() => route.name === 'Rankings')
const isTournamentViewer = computed(
  () => route.path.startsWith('/tournaments/') && route.name !== 'TournamentCreate',
)
const isPublicRoute = computed(() => route.meta.public === true)
const isFriendlyFlow = computed(() => route.meta.friendlyFlow === true)
const isOnboardingFlow = computed(() => route.meta.onboardingFlow === true)
const isFocusedFlow = computed(() => isFriendlyFlow.value || isOnboardingFlow.value)
const isImmersiveRoute = computed(() => route.meta.immersive === true)
const migratedRouteNames = new Set([
  'Dashboard',
  'Play',
  'Clubs',
  'Club',
  'Settings',
  'AccountSettings',
])
const isMigratedSurface = computed(() => migratedRouteNames.has(String(route.name || '')))
const isWideWorkspace = computed(
  () => isTournamentCreate.value || isTournamentViewer.value || isLadderWorkspace.value,
)
const clubOwnsPageHeading = computed(() => {
  const name = String(route.name || '')

  return (
    name === 'Clubs' ||
    name === 'Club' ||
    name === 'ClubMembers' ||
    name === 'ClubMemberImport' ||
    name === 'ClubMemberManual' ||
    name === 'ClubMemberDetail' ||
    name === 'ClubSettingsHub' ||
    name === 'Settings'
  )
})

const competeOwnsPageHeading = computed(() => {
  const name = String(route.name || '')

  return (
    name === 'Challenges' ||
    name === 'CreateChallenge' ||
    name === 'ChallengeDetails'
  )
})

const showRoutePageContext = computed(
  () =>
    !isLadderWorkspace.value &&
    !clubOwnsPageHeading.value &&
    !competeOwnsPageHeading.value,
)

const showAppChrome = computed(
  () => !isPublicRoute.value && !isFocusedFlow.value && !isImmersiveRoute.value,
)
const showSidebar = computed(() => showAppChrome.value && !isMobileViewport.value)
const showHeader = computed(() => showAppChrome.value)
const showBottomNav = computed(
  () => showAppChrome.value && isMobileViewport.value && route.meta.hideBottomNav !== true,
)

const activePrimarySection = computed(() => {
  if (route.meta.primarySection) return String(route.meta.primarySection)
  if (route.path === '/dashboard') return 'home'
  if (route.path === '/play' || route.path.startsWith('/play/')) return 'play'
  if (route.path.startsWith('/friendly-match') || route.path.startsWith('/ladder-match')) {
    return 'play'
  }
  if (route.path.startsWith('/tournaments')) return 'tournament'
  if (
    route.path.startsWith('/rankings') ||
    route.path.startsWith('/challenges') ||
    route.path.startsWith('/matches')
  )
    return 'ladder'
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
const showSectionHeaderContext = computed(() =>
  ['Challenges', 'ChallengeDetails', 'CreateChallenge', 'MatchDetails', 'Tournaments'].includes(
    String(route.name || ''),
  ),
)
const activePrimaryLabel = computed(
  () => navigationItems.find((item) => item.section === activePrimarySection.value)?.label || '',
)
const contextualItems = computed(() => {
  if (activePrimarySection.value === 'club') {
    const items = [
      { label: 'Overview', to: { name: 'Club' }, key: 'overview', icon: overviewIcon },
      {
        label: 'Members',
        to: { name: 'Club', query: { section: 'members' } },
        key: 'members',
        icon: membersIcon,
      },
      {
        label: 'Rules',
        to: { name: 'Club', query: { section: 'rules' } },
        key: 'rules',
        icon: rulesIcon,
      },
    ]
    if (adminStore.hasActiveClubPermission('club.manage')) {
      items.push({ label: 'Manage', to: { name: 'Settings' }, key: 'manage', icon: settingsIcon })
    }
    return items
  }
  return []
})
const showContextualNavigation = computed(
  () =>
    showAppChrome.value &&
    contextualItems.value.length > 0 &&
    !isTournamentCreate.value &&
    activePrimarySection.value !== 'club',
)

const primaryIndex = computed(() =>
  navigationItems.findIndex((item) => item.section === activePrimarySection.value),
)
const activeContextKey = computed(() => {
  if (route.name === 'Settings') return 'manage'
  if (route.name !== 'Club') return ''
  const key = String(route.query.section || 'overview')
  return ['overview', 'members', 'rules'].includes(key) ? key : 'overview'
})
const contextIndex = computed(() =>
  contextualItems.value.findIndex((item) => item.key === activeContextKey.value),
)
function primaryNavigationOffset(index) {
  return index * 51
}

const primaryMotionStyle = computed(() => ({
  '--motion-from': primaryMotion.value.from,
  '--motion-to': primaryMotion.value.to,
  '--motion-from-offset': `${primaryNavigationOffset(primaryMotion.value.from)}px`,
  '--motion-to-offset': `${primaryNavigationOffset(primaryMotion.value.to)}px`,
  '--motion-count': navigationItems.length,
}))
const contextMotionStyle = computed(() => ({
  '--motion-from': contextMotion.value.from,
  '--motion-to': contextMotion.value.to,
  '--motion-count': Math.max(1, contextualItems.value.length),
  '--context-count': Math.max(1, contextualItems.value.length),
}))

watch(primaryIndex, (to, from) => {
  if (from < 0 || to < 0 || from === to) return
  if (primaryMotionTimer) window.clearTimeout(primaryMotionTimer)
  primaryMotion.value = {
    active: true,
    from,
    to,
    revision: primaryMotion.value.revision + 1,
  }
  primaryMotionTimer = window.setTimeout(() => {
    primaryMotion.value = { ...primaryMotion.value, active: false }
    primaryMotionTimer = null
  }, 620)
})

watch(contextIndex, (to, from) => {
  if (from < 0 || to < 0 || from === to) return
  if (contextMotionTimer) window.clearTimeout(contextMotionTimer)
  contextMotion.value = {
    active: true,
    from,
    to,
    revision: contextMotion.value.revision + 1,
  }
  contextMotionTimer = window.setTimeout(() => {
    contextMotion.value = { ...contextMotion.value, active: false }
    contextMotionTimer = null
  }, 620)
})

const tournamentCreateStep = computed(() => {
  const step = String(route.query.step || 'details')
  return tournamentCreateSteps.includes(step) ? step : 'details'
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
  return route.meta.headerTitle || route.meta.title || 'GORRA'
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
  return route.meta.headerSubtitle || route.meta.subtitle || ''
})
const headerBackLabel = computed(() => {
  if (isTournamentViewer.value) return 'Go back'
  if (!isTournamentCreate.value) return ''
  return tournamentCreateStep.value === 'details' ? 'Back to tournaments' : 'Previous step'
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
  if (item.key === 'manage') return route.name === 'Settings'
  if (route.name !== 'Club') return false
  const section = String(route.query.section || 'overview')
  return item.key === section
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

function beginAdminMatchDrawer() {
  if (adminMatchDrawerOwnsSidebar.value || typeof window === 'undefined') return
  if (!window.matchMedia('(min-width: 1024px)').matches) return
  sidebarWasCollapsedBeforeAdminMatch.value = sidebarCollapsed.value
  adminMatchDrawerOwnsSidebar.value = true
  sidebarCollapsed.value = true
}

function endAdminMatchDrawer() {
  if (!adminMatchDrawerOwnsSidebar.value) return
  sidebarCollapsed.value = sidebarWasCollapsedBeforeAdminMatch.value
  adminMatchDrawerOwnsSidebar.value = false
}

function setNestedHeader(owner, config = {}) {
  nestedHeader.value = {
    owner,
    label: String(config.label || ''),
    back: typeof config.back === 'function' ? config.back : null,
    crumbs: Array.isArray(config.crumbs) ? config.crumbs : [],
  }
}

function clearNestedHeader(owner) {
  if (nestedHeader.value?.owner === owner) {
    nestedHeader.value = null
  }
}

provide('gorraShell', {
  beginAdminMatchDrawer,
  endAdminMatchDrawer,
  setNestedHeader,
  clearNestedHeader,
})

function formatClubRole(role) {
  return ['admin', 'co-admin'].includes(role) ? 'Admin' : 'Player'
}

async function switchClub(clubId) {
  if (!clubId) return

  if (clubId === adminStore.activeClubId) {
    clubMenuOpen.value = false
    await router.push({ name: 'Club' }).catch(() => {})
    return
  }

  switchingClubId.value = clubId

  try {
    await adminStore.switchClub(clubId)
    clubMenuOpen.value = false

    notificationStore.addToast({
      message: `${currentClubName.value} is now active.`,
      type: 'success',
    })

    await router.push({ name: 'Club' })
  } catch (error) {
    notificationStore.addToast({
      message: error?.message || 'Unable to switch clubs.',
      type: 'error',
    })
  } finally {
    switchingClubId.value = ''
  }
}

function handleHeaderBack() {
  if (nestedHeader.value?.back) {
    nestedHeader.value.back()
    return
  }

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
  if (clubMenuOpen.value && !clubMenuRoot.value?.contains(event.target)) {
    clubMenuOpen.value = false
  }
  if (accountMenuOpen.value && !accountMenuRoot.value?.contains(event.target)) {
    accountMenuOpen.value = false
  }
}

function handleDocumentKeydown(event) {
  if (event.key === 'Escape') {
    accountMenuOpen.value = false
    clubMenuOpen.value = false
  }
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
  clubMenuOpen.value = false
  if (to.meta.public === true) pageSkeletonActive.value = false
  else schedulePageSkeleton(to)
})

onUnmounted(() => {
  if (pageSkeletonTimer) window.clearTimeout(pageSkeletonTimer)
  if (primaryMotionTimer) window.clearTimeout(primaryMotionTimer)
  if (contextMotionTimer) window.clearTimeout(contextMotionTimer)
  if (typeof removeRouteAfterEach === 'function') removeRouteAfterEach()
  document.removeEventListener('pointerdown', handleDocumentPointer)
  document.removeEventListener('keydown', handleDocumentKeydown)
  mobileMediaQuery?.removeEventListener('change', updateViewportMode)
})
</script>

<style scoped>
.nested-header-context {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.nested-header-back {
  width: fit-content;
  min-height: 28px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text-soft);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
  text-align: left;
}

.nested-header-back:hover {
  color: var(--color-text);
}

.nested-header-back svg {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.nested-header-crumbs {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: color-mix(in srgb, var(--color-text) 43%, transparent);
  font-size: 9.5px;
  font-weight: var(--font-weight-medium);
  line-height: 1.25;
}

.nested-header-crumbs li {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
}

.nested-header-crumbs a,
.nested-header-crumbs span {
  overflow: hidden;
  color: inherit;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nested-header-crumbs a:hover {
  color: var(--color-text-soft);
}

.nested-header-crumbs i {
  color: color-mix(in srgb, var(--color-text) 28%, transparent);
  font-style: normal;
}

.app-header .header-main--nested {
  display: flex;
}

.layout {
  --app-header-height: 76px;
  --app-bottom-nav-height: 66px;
  --app-shell-content-width: min(92%, 1280px);
  min-height: 100vh;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: 'Poppins', sans-serif;
}

.layout--migrated {
  --app-shell-content-width: 87%;
  --color-bg: #fbfcfb;
  --color-bg-muted: #f7fcf8;
  --color-surface: #ffffff;
  --color-surface-muted: #f7fcf8;
  --color-surface-soft: #eef9f0;
  --color-surface-softest: #f7fcf8;
  --color-primary: #08ad2b;
  --color-primary-strong: #067d20;
  --color-accent-bright: #08ad2b;
  --color-text: #28332c;
  --color-text-soft: #465149;
  --color-muted: #7d8780;
  --color-border: #e4e9e5;
  --color-border-strong: #d6ddd8;
  --button-primary-bg: #08ad2b;
  --button-primary-bg-hover: #079624;
  --focus-ring: rgba(8, 173, 43, 0.24);
  --app-card-radius: 12px;
  --app-inner-radius: 9px;
  --flow-shadow-quiet: 0 8px 24px rgba(40, 51, 44, 0.025);
  font-family: Inter, 'Avenir Next', 'Segoe UI', sans-serif;
}

.layout--migrated .main {
  background: var(--color-bg);
}

.layout--sidebar-collapsed {
  --app-sidebar-width: 76px;
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
  gap: 18px;
  padding: 24px 18px;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
  transition:
    width var(--motion-medium) var(--motion-curve),
    padding var(--motion-medium) var(--motion-curve);
}

.brand-row {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  color: var(--color-text);
  text-decoration: none;
}

.brand__logo {
  width: 112px;
  max-height: 40px;
}

.brand__mark {
  display: none;
  color: var(--color-primary-strong);
  font-size: 21px;
  font-weight: var(--font-weight-bold);
}

.sidebar-toggle {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  place-items: center;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--app-inner-radius);
  background: var(--color-surface);
  color: var(--color-muted);
}

.sidebar-toggle:hover {
  background: var(--color-surface-soft);
  color: var(--color-text);
}

.sidebar-toggle svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.club-switcher {
  position: relative;
  width: 100%;
}

.club-switcher__trigger {
  display: flex;
  width: 100%;
  min-height: 54px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-inner-radius);
  background: var(--color-surface-soft);
  color: var(--color-text);
  text-align: left;
}

.club-switcher__trigger:hover:not(:disabled) {
  border-color: var(--color-border-strong);
  background: var(--color-surface);
}

.club-switcher__mark {
  display: none;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  place-items: center;
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-primary) 9%, white);
  color: var(--color-primary-strong);
  font-size: 10px;
  font-weight: var(--font-weight-bold);
}

.club-switcher__copy,
.club-menu__copy {
  display: grid;
  min-width: 0;
}

.club-switcher__copy small {
  color: var(--color-muted);
  font-size: 9px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.club-switcher__copy strong {
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.club-switcher__chevron {
  width: 16px;
  flex: 0 0 16px;
  fill: none;
  stroke: var(--color-muted);
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.club-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 70;
  display: grid;
  width: 100%;
  min-width: 184px;
  overflow: hidden;
  padding: 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  box-shadow: var(--shadow-strong);
}

.club-menu__item,
.club-menu__all {
  display: flex;
  min-height: 46px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 9px;
  border: 0;
  border-radius: var(--app-inner-radius);
  background: transparent;
  color: var(--color-text-soft);
  text-align: left;
  text-decoration: none;
}

.club-menu__item:hover:not(:disabled),
.club-menu__all:hover {
  background: var(--color-surface-soft);
  color: var(--color-text);
}

.club-menu__copy strong {
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.club-menu__copy small {
  color: var(--color-muted);
  font-size: 9px;
}

.club-menu__check,
.club-menu__all svg {
  width: 17px;
  flex: 0 0 17px;
  fill: none;
  stroke: var(--color-primary-strong);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.club-menu__all {
  margin-top: 5px;
  border-top: 1px solid var(--color-border);
  border-radius: 0 0 var(--app-inner-radius) var(--app-inner-radius);
  color: var(--color-primary-strong);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
}

.club-menu__loading {
  width: 15px;
  height: 15px;
  flex: 0 0 15px;
  border: 2px solid var(--color-border-strong);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: clubMenuSpin 700ms linear infinite;
}

@keyframes clubMenuSpin {
  to {
    transform: rotate(360deg);
  }
}

.primary-nav {
  position: relative;
  display: grid;
  overflow: hidden;
  gap: 5px;
}

.primary-nav__motion {
  position: absolute;
  inset: 0 0 auto;
  z-index: 0;
  height: 46px;
  border-radius: var(--app-inner-radius);
  pointer-events: none;
  background: linear-gradient(
    90deg,
    rgba(0, 181, 26, 0.03),
    rgba(0, 181, 26, 0.16),
    rgba(0, 181, 26, 0.03)
  );
  animation: primaryNavTrack 580ms var(--motion-curve) both;
}

.nav-link {
  position: relative;
  display: flex;
  overflow: hidden;
  z-index: 1;
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

.nav-submenu {
  display: grid;
  gap: 2px;
  min-height: 114px;
  margin: -1px 0 5px 23px;
  padding-left: 16px;
  border-left: 1px solid var(--color-border);
}

.nav-sub-link {
  display: flex;
  min-width: 0;
  min-height: 38px;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  border-radius: var(--app-inner-radius);
  color: var(--color-muted);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  transition:
    background var(--motion-short) var(--motion-curve),
    color var(--motion-short) var(--motion-curve);
}

.nav-sub-link:hover {
  background: var(--color-surface-soft);
  color: var(--color-text);
}

.nav-sub-link.active {
  background: color-mix(in srgb, var(--color-primary) 8%, white);
  color: var(--color-primary-strong);
}

@keyframes primaryNavTrack {
  from {
    opacity: 0.18;
    transform: translateY(var(--motion-from-offset));
  }
  48% {
    opacity: 0.68;
  }
  to {
    opacity: 0;
    transform: translateY(var(--motion-to-offset));
  }
}

.nav-link.active .icon {
  animation: tennisNavigationSwing 650ms var(--motion-spring);
}

@keyframes tennisNavigationSwing {
  0%,
  100% {
    transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
  }
  24% {
    transform: translate3d(-3px, 1px, 0) rotate(-19deg) scale(0.96);
  }
  50% {
    transform: translate3d(6px, -4px, 0) rotate(15deg) scale(1.16);
  }
  72% {
    transform: translate3d(0, 1px, 0) rotate(-5deg) scale(0.96);
  }
  88% {
    transform: translate3d(0, -2px, 0) rotate(2deg) scale(1.08);
  }
}

@keyframes tennisOptionSettle {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }
  32% {
    transform: translate3d(-3px, 0, 0) rotate(-1deg);
  }
  62% {
    transform: translate3d(5px, -1px, 0) rotate(1deg);
  }
  82% {
    transform: translate3d(-1px, 0, 0);
  }
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
  transition: margin-left var(--motion-medium) var(--motion-curve);
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
  min-height: var(--app-header-height);
  border-bottom: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 4px 18px rgba(15, 34, 24, 0.035);
  backdrop-filter: blur(14px);
}

.header-content {
  display: grid;
  width: var(--app-shell-content-width);
  min-height: var(--app-header-height);
  grid-template-columns: minmax(170px, auto) minmax(0, 1fr) auto;
  align-items: center;
  gap: 24px;
  margin: 0 auto;
  padding: 14px 0;
}

.app-header--with-sidebar {
  left: var(--app-sidebar-width);
  transition: left var(--motion-medium) var(--motion-curve);
}

@media (min-width: 768px) {
  .content:not(.content--fullscreen):not(.content--public) {
    width: 90%;
  }

  .app-header--with-sidebar .header-content {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .app-header--with-sidebar .global-identity {
    display: none;
  }
}

.global-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  text-decoration: none;
}

.global-identity__logo {
  display: block;
  width: 88px;
  max-width: 28vw;
  max-height: 32px;
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
  font-size: 19px;
  letter-spacing: -0.01em;
}

.page-context p {
  color: var(--color-muted);
  font-size: 13px;
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

.header-create-button {
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 8px 14px;
  border: 1px solid var(--color-primary);
  border-radius: 999px;
  background: var(--color-primary);
  color: var(--color-light);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  transition:
    transform var(--motion-short) var(--motion-curve),
    box-shadow var(--motion-short) var(--motion-curve);
}

.header-create-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 7px 16px rgba(39, 126, 86, 0.18);
}

.header-create-button svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
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
  width: var(--app-shell-content-width);
  min-width: 0;
  margin: 0 auto;
  padding: 26px 0 36px;
}

.content--wide {
  width: var(--app-shell-content-width);
}

.content--ladder {
  width: 100%;
  padding: 0;
}

.layout--sidebar-collapsed .sidebar {
  align-items: center;
  padding-inline: 10px;
}

.layout--sidebar-collapsed .brand-row,
.layout--sidebar-collapsed .brand,
.layout--sidebar-collapsed .primary-nav {
  width: 100%;
}

.layout--sidebar-collapsed .brand-row,
.layout--sidebar-collapsed .brand {
  justify-content: center;
}

.layout--sidebar-collapsed .brand__logo,
.layout--sidebar-collapsed .club-switcher__copy,
.layout--sidebar-collapsed .club-switcher__chevron,
.layout--sidebar-collapsed .nav-link .label {
  display: none;
}

.layout--sidebar-collapsed .brand__mark,
.layout--sidebar-collapsed .club-switcher__mark {
  display: grid;
}

.layout--sidebar-collapsed .sidebar-toggle {
  position: absolute;
  top: 62px;
  width: 28px;
  height: 28px;
}

.layout--sidebar-collapsed .club-switcher__trigger,
.layout--sidebar-collapsed .nav-link {
  justify-content: center;
  padding-inline: 0;
}

.layout--sidebar-collapsed .club-menu {
  top: 0;
  left: calc(100% + 10px);
  width: 220px;
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
  display: grid;
  width: 100%;
  grid-template-columns: repeat(var(--context-count), minmax(0, 1fr));
  gap: 0;
  margin: -26px 0 24px;
  padding: 10px 0 0;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
  overflow: hidden;
  scrollbar-width: none;
}

.context-nav__motion {
  position: absolute;
  inset: 10px auto 0 0;
  width: calc(100% / var(--motion-count));
  pointer-events: none;
  background: linear-gradient(100deg, transparent, rgba(0, 181, 26, 0.14), transparent);
  animation: horizontalNavTrack 580ms var(--motion-curve) both;
}

.context-nav::-webkit-scrollbar {
  display: none;
}

.context-nav a {
  position: relative;
  z-index: 1;
  display: flex;
  min-width: 0;
  min-height: 46px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 14px;
  color: var(--color-muted);
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
}

.context-nav__icon {
  display: grid;
  width: 18px;
  height: 18px;
  place-items: center;
}

.context-nav__icon :deep(svg) {
  width: 18px;
  height: 18px;
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
  animation: tennisOptionSettle 620ms var(--motion-spring);
}

.context-nav a.active::after {
  background: var(--color-primary);
}

.context-nav--club {
  display: flex;
  align-items: stretch;
  justify-content: flex-start;
  gap: clamp(24px, 3vw, 36px);
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(10px);
  overflow-x: auto;
}

.context-nav--club .context-nav__motion {
  display: none;
}

.context-nav--club a {
  flex: 0 0 auto;
  min-width: auto;
  justify-content: flex-start;
  gap: 7px;
  padding: 0 2px;
  color: var(--color-text-soft);
  font-size: 12px;
  font-weight: var(--font-weight-medium);
  opacity: 0.7;
  transition:
    color var(--motion-short) var(--motion-curve),
    opacity var(--motion-short) var(--motion-curve);
}

.context-nav--club a:hover {
  opacity: 0.9;
}

.context-nav--club a.active {
  color: var(--color-primary-strong);
  font-weight: var(--font-weight-semibold);
  opacity: 1;
}

.context-nav--club .context-nav__icon,
.context-nav--club .context-nav__icon :deep(svg) {
  width: 16px;
  height: 16px;
}

.context-nav--club a::after {
  right: 0;
  left: 0;
}

@keyframes horizontalNavTrack {
  from {
    opacity: 0.14;
    transform: translateX(calc(var(--motion-from) * 100%));
  }
  48% {
    opacity: 0.72;
  }
  to {
    opacity: 0;
    transform: translateX(calc(var(--motion-to) * 100%));
  }
}

.page-shell {
  position: relative;
  min-height: 100%;
  font-size: 15px;
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

  .sidebar-toggle {
    display: none;
  }

  .brand {
    width: 100%;
    justify-content: center;
  }

  .brand__logo {
    width: 48px;
    max-height: 26px;
  }

  .club-switcher__copy,
  .club-switcher__chevron,
  .sidebar-club > span:last-child {
    display: none;
  }

  .club-switcher__mark {
    display: grid;
  }

  .primary-nav {
    width: 100%;
  }

  .nav-link {
    justify-content: center;
    padding-inline: 0;
  }

  .nav-submenu {
    min-height: 114px;
    margin-inline: 0;
    padding-left: 0;
    border-left: 0;
  }

  .nav-sub-link {
    justify-content: center;
    padding-inline: 0;
  }

  .nav-sub-link span {
    display: none;
  }

  .club-switcher__trigger {
    min-height: 44px;
    justify-content: center;
    padding-inline: 0;
  }

  .club-menu {
    top: 0;
    left: calc(100% + 10px);
    width: 220px;
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
    --app-header-height: 82px;
    --app-bottom-nav-height: 64px;
  }

  .layout--migrated {
    --app-shell-content-width: calc(100% - 28px);
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
    min-height: var(--app-header-height);
  }

  .header-content,
  .app-header--with-sidebar .header-content {
    width: var(--app-shell-content-width);
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    padding: 10px 0;
  }

  .global-identity {
    gap: 8px;
  }

  .global-identity__logo {
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

  .app-header--section .global-identity {
    display: none;
  }

  .header-main {
    display: none;
  }

  .app-header--section .header-main {
    display: flex;
  }

  .app-header--section .page-context {
    gap: 1px;
  }

  .app-header--section .page-context h1 {
    font-size: 18px;
  }

  .app-header--section .page-context p {
    display: -webkit-box;
    overflow: hidden;
    font-size: 12px;
    line-height: 1.25;
    white-space: normal;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
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
    width: var(--app-shell-content-width);
    margin-inline: auto;
    padding: 18px 0 28px;
  }

  .content--fullscreen,
  .content--public {
    width: 100%;
    margin-inline: 0;
    padding: 0;
  }

  .context-nav {
    top: var(--app-header-height);
    width: 100%;
    margin: -18px 0 18px;
    padding: 6px 0 0;
    background: rgba(255, 255, 255, 0.98);
  }

  .header-create-button {
    width: 42px;
    min-width: 42px;
    min-height: 42px;
    padding: 0;
  }

  .header-create-button span {
    display: none;
  }

  .context-nav a {
    min-height: 44px;
    padding-inline: 12px;
  }

  .nav-submenu {
    min-height: 114px;
    margin-inline: 0;
    padding-left: 0;
    border-left: 0;
  }

  .nav-sub-link {
    justify-content: center;
    padding-inline: 0;
  }

  .nav-sub-link span {
    display: none;
  }

  .bottom-nav {
    position: fixed;
    inset: auto 0 0;
    z-index: 40;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    min-height: calc(var(--app-bottom-nav-height) + env(safe-area-inset-bottom, 0px));
    padding: 3px 7.5vw env(safe-area-inset-bottom, 0px);
    border-top: 1px solid var(--color-border);
    background: rgba(255, 255, 255, 0.98);
    box-shadow: 0 -5px 18px rgba(15, 34, 24, 0.04);
    backdrop-filter: blur(14px);
    overflow: hidden;
  }

  .bottom-nav__motion {
    position: absolute;
    inset: 3px auto env(safe-area-inset-bottom, 0px) 7.5vw;
    width: calc(85% / var(--motion-count));
    pointer-events: none;
    background: linear-gradient(100deg, transparent, rgba(0, 181, 26, 0.15), transparent);
    animation: horizontalNavTrack 580ms var(--motion-curve) both;
  }

  .bottom-nav__item {
    position: relative;
    display: flex;
    overflow: hidden;
    z-index: 1;
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

  .bottom-nav__item.active .icon {
    animation: tennisNavigationSwing 650ms var(--motion-spring);
  }
}

@media (max-width: 390px) {
  .global-identity__logo {
    width: 80px;
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

  .nav-link.active .icon,
  .bottom-nav__item.active .icon,
  .context-nav a.active {
    animation: none !important;
  }

  .menu-enter-active,
  .menu-leave-active {
    transition: none;
  }
}
</style>
