import { createRouter, createWebHashHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import RankingsView from '../views/RankingsView.vue'
import ChallengesView from '../views/ChallengesView.vue'
import MatchDetailsView from '../views/MatchDetailsView.vue'
import NotificationsView from '../views/NotificationsView.vue'
import PlayView from '../views/PlayView.vue'
import ProfileView from '../views/ProfileView.vue'
import TournamentCategoryView from '../views/TournamentCategory.vue'
import TournamentCreateView from '../views/TournamentCreate.vue'
import TournamentHubView from '../views/TournamentHub.vue'
import TournamentOverviewView from '../views/TournamentOverview.vue'
import TournamentScheduleView from '../views/TournamentSchedule.vue'
import TournamentGalleryView from '../views/TournamentGallery.vue'
import LandingView from '../views/LandingView.vue'
import LoginView from '../views/LoginView.vue'
import FriendlyMatchFlowView from '../views/FriendlyMatchFlowView.vue'
import AdminSetupView from '../views/AdminSetupView.vue'
import PlayerClubJoinView from '../views/PlayerClubJoinView.vue'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: LandingView,
    meta: { title: 'Gorra — The operating system for club tennis', public: true },
  },
  {
    path: '/signin',
    alias: '/login',
    name: 'SignIn',
    component: LoginView,
    meta: { title: 'Sign in to Gorra', public: true, authPage: true, authMode: 'signin' },
  },
  {
    path: '/signup',
    name: 'SignUp',
    component: LoginView,
    meta: { title: 'Join Gorra', public: true, authPage: true, authMode: 'signup' },
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: DashboardView,
    meta: {
      title: 'Dashboard',
      subtitle: 'Overview first, then jump into the exact ladder action that needs attention.',
    },
  },
  {
    path: '/rankings',
    name: 'Rankings',
    component: RankingsView,
    meta: {
      title: 'Rankings',
      subtitle: 'Track the ladder, compare records, and see who you can challenge next.',
    },
  },
  {
    path: '/tournaments',
    name: 'Tournaments',
    component: TournamentHubView,
    meta: {
      title: 'Tournaments',
      subtitle: 'Manage group stages, standings, knockout brackets, and champions.',
    },
  },
  {
    path: '/tournaments/create',
    name: 'TournamentCreate',
    component: TournamentCreateView,
    meta: {
      title: 'Create Tournament',
      subtitle: 'Build a tournament with categories, groups, and rules.',
      permission: 'tournaments.manage',
    },
  },
  {
    path: '/tournaments/:tournamentId',
    name: 'TournamentOverview',
    component: TournamentOverviewView,
    meta: {
      title: 'Tournament Overview',
      subtitle: 'See categories, progress, officials, and the match schedule.',
    },
  },
  {
    path: '/tournaments/:tournamentId/category/:categoryId',
    name: 'TournamentCategory',
    component: TournamentCategoryView,
    meta: {
      title: 'Tournament Category',
      subtitle: 'Work through groups, fixtures, standings, and knockout rounds.',
    },
  },
  {
    path: '/tournaments/:tournamentId/schedule',
    name: 'TournamentSchedule',
    component: TournamentScheduleView,
    meta: {
      title: 'Tournament Schedule',
      subtitle: 'All tournament matches grouped by date and filterable by category.',
    },
  },
  {
    path: '/tournaments/:tournamentId/gallery',
    name: 'TournamentGallery',
    component: TournamentGalleryView,
    meta: {
      title: 'Tournament Gallery',
      subtitle: 'Browse and share moments from this tournament edition.',
    },
  },
  {
    path: '/tournaments/:tournamentId/match/:matchId',
    name: 'TournamentMatchDetails',
    component: MatchDetailsView,
    props: true,
    meta: {
      title: 'Tournament Match',
      subtitle: 'Review the shared match record with tournament context.',
    },
  },
  {
    path: '/friendly-match/type',
    alias: '/ladder-match/type',
    name: 'FriendlyMatchType',
    component: FriendlyMatchFlowView,
    meta: { title: 'New match', friendlyFlow: true, friendlyStep: 'type' },
  },
  {
    path: '/friendly-match/timing',
    alias: '/ladder-match/timing',
    name: 'FriendlyMatchTiming',
    component: FriendlyMatchFlowView,
    meta: { title: 'When are you playing?', friendlyFlow: true, friendlyStep: 'timing' },
  },
  {
    path: '/friendly-match/join',
    alias: '/ladder-match/join',
    name: 'FriendlyMatchJoin',
    component: FriendlyMatchFlowView,
    meta: { title: 'Let your opponent join', friendlyFlow: true, friendlyStep: 'join' },
  },
  {
    path: '/friendly-match/club-opponent',
    alias: '/ladder-match/opponent',
    name: 'FriendlyMatchClubOpponent',
    component: FriendlyMatchFlowView,
    meta: { title: 'Choose opponent from club', friendlyFlow: true, friendlyStep: 'clubOpponent' },
  },
  {
    path: '/friendly-match/schedule',
    alias: '/ladder-match/schedule',
    name: 'FriendlyMatchSchedule',
    component: FriendlyMatchFlowView,
    meta: { title: 'Optional match timing', friendlyFlow: true, friendlyStep: 'schedule' },
  },
  {
    path: '/friendly-match/opponent',
    name: 'FriendlyMatchOpponent',
    component: FriendlyMatchFlowView,
    meta: { title: 'Choose opponent', friendlyFlow: true, friendlyStep: 'opponent' },
  },
  {
    path: '/friendly-match/scoring',
    alias: '/ladder-match/scoring',
    name: 'FriendlyMatchScoring',
    component: FriendlyMatchFlowView,
    meta: { title: 'Scoring', friendlyFlow: true, friendlyStep: 'scoring' },
  },
  {
    path: '/friendly-match/format',
    alias: '/ladder-match/format',
    name: 'FriendlyMatchFormat',
    component: FriendlyMatchFlowView,
    meta: { title: 'Match format', friendlyFlow: true, friendlyStep: 'format' },
  },
  {
    path: '/friendly-match/custom-format',
    name: 'FriendlyMatchCustomFormat',
    component: FriendlyMatchFlowView,
    meta: { title: 'Custom format', friendlyFlow: true, friendlyStep: 'customFormat' },
  },
  {
    path: '/friendly-match/scheduled',
    alias: '/ladder-match/sent',
    name: 'FriendlyMatchScheduled',
    component: FriendlyMatchFlowView,
    meta: { title: 'Invitation sent', friendlyFlow: true, friendlyStep: 'scheduled' },
  },
  {
    path: '/friendly-match/join/:token',
    alias: '/ladder-match/join/:token',
    name: 'FriendlyMatchJoinInvitation',
    component: FriendlyMatchFlowView,
    meta: { title: 'Join friendly match', friendlyFlow: true, friendlyStep: 'externalJoin' },
  },
  {
    path: '/friendly-match/live',
    alias: '/ladder-match/live',
    name: 'FriendlyMatchLive',
    component: FriendlyMatchFlowView,
    meta: { title: 'Live friendly match', friendlyFlow: true, friendlyStep: 'live' },
  },
  {
    path: '/onboarding/join-club',
    name: 'PlayerClubJoin',
    component: PlayerClubJoinView,
    meta: {
      title: 'Join your club',
      onboardingFlow: true,
    },
  },
  {
    path: '/admin/setup',
    name: 'AdminSetup',
    component: AdminSetupView,
    meta: {
      title: 'Club Setup',
      subtitle: 'Answer six simple questions to open your club.',
      permission: 'club.manage',
      onboardingFlow: true,
    },
  },
  {
    path: '/challenges',
    name: 'Challenges',
    component: ChallengesView,
    meta: {
      title: 'Challenges',
      subtitle: 'Accept, review, and monitor every ladder challenge from one focused queue.',
    },
  },
  {
    path: '/profile',
    name: 'Profile',
    component: ProfileView,
    meta: { title: 'Profile', subtitle: 'Your ladder record and stats.' },
  },
  {
    path: '/matches/:matchId',
    name: 'MatchDetails',
    component: MatchDetailsView,
    props: true,
    meta: {
      title: 'Match Details',
      subtitle: 'Confirm the final score, verify the winner, and move the ladder forward.',
    },
  },
  {
    path: '/play/:matchId',
    name: 'PlayMatch',
    component: PlayView,
    props: true,
    meta: {
      title: 'Play',
      subtitle: 'Run the live scoreboard in a focused full-screen match environment.',
      permission: 'matches.live_score',
    },
  },
  {
    path: '/create-challenge',
    name: 'CreateChallenge',
    redirect: (to) => ({
      path: '/ladder-match/type',
      query: { ...to.query, mode: 'ladder' },
    }),
  },
  {
    path: '/notifications',
    name: 'Notifications',
    component: NotificationsView,
    meta: {
      title: 'Notifications',
      subtitle: 'All your app alerts, invitations, and score updates in one place.',
    },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard',
  },
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL), // 👈 changed
  routes,
  scrollBehavior() {
    return { top: 0, left: 0 }
  },
})

router.beforeEach((to) => {
  const authStore = useAuthStore()
  if (!to.meta.public && !authStore.isAuthenticated) {
    return { name: 'SignIn', query: { redirect: to.fullPath } }
  }
  if (to.meta.permission && !authStore.hasPermission(to.meta.permission)) {
    return { name: 'Dashboard', query: { access: 'admin' } }
  }
  return true
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} | Gorra` : 'Gorra'
  window.setTimeout(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, 0)
})

export default router
