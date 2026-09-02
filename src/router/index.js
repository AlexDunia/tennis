import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import RankingsView from '../views/compete/LadderView.vue'
import ChallengesView from '../views/compete/ChallengesQueueView.vue'
import ChallengeDetailsView from '../views/ChallengeDetailsView.vue'
import CompeteChallengeCreateView from '../views/compete/CompeteChallengeCreateView.vue'
import MatchDetailsView from '../views/MatchDetailsView.vue'
import NotificationsView from '../views/NotificationsView.vue'
import PlayView from '../views/PlayView.vue'
import LiveMatchView from '../views/LiveMatchView.vue'
import LiveScoreboardView from '../views/LiveScoreboardView.vue'
import LiveOperationsView from '../views/LiveOperationsView.vue'
import LiveOperationDetailView from '../views/LiveOperationDetailView.vue'
import TvDisplayPairingView from '../views/TvDisplayPairingView.vue'
import TvDisplayLiveView from '../views/TvDisplayLiveView.vue'
import ChairUmpireInvitationView from '../views/ChairUmpireInvitationView.vue'
import PlayHubView from '../views/PlayHubView.vue'
import ProfileView from '../views/ProfileView.vue'
import HistoryView from '../views/HistoryView.vue'
import ClubView from '../views/ClubView.vue'
import AccountSettingsView from '../views/AccountSettingsView.vue'
import TournamentCategoryView from '../views/TournamentCategory.vue'
import TournamentCreateView from '../views/TournamentCreate.vue'
import TournamentHubView from '../views/compete/TournamentsListView.vue'
import TournamentOverviewView from '../views/TournamentOverview.vue'
import TournamentScheduleView from '../views/TournamentSchedule.vue'
import TournamentGalleryView from '../views/TournamentGallery.vue'
import LandingView from '../views/LandingView.vue'
import LegacyLandingView from '../views/LandingView.legacy-2026-08.vue'
import LoginView from '../views/LoginView.vue'
import FriendlyMatchFlowView from '../views/FriendlyMatchFlowView.vue'
import ClubsView from '../views/ClubsView.vue'
import SettingsView from '../views/SettingsView.vue'
import { useAuthStore } from '../stores/auth'
import { useAdminStore } from '../stores/admin'
import { getMatch } from '../services/MatchService.js'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: LandingView,
    meta: { title: 'GORRA — The operating system for club tennis', public: true },
  },
  {
    path: '/signin',
    alias: '/login',
    name: 'SignIn',
    component: LoginView,
    meta: { title: 'Sign in to GORRA', public: true, authPage: true, authMode: 'signin' },
  },
  {
    path: '/landing-legacy',
    alias: '/old-landing',
    name: 'LegacyLanding',
    component: LegacyLandingView,
    meta: { title: 'Previous GORRA landing page', public: true },
  },
  {
    path: '/signup',
    name: 'SignUp',
    component: LoginView,
    meta: { title: 'Join GORRA', public: true, authPage: true, authMode: 'signup' },
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: DashboardView,
    meta: {
      title: 'Home',
      subtitle: 'Your tennis, next actions, and club activity.',
      primarySection: 'home',
    },
  },
  {
    path: '/home',
    redirect: { name: 'Dashboard' },
  },
  {
    path: '/play',
    name: 'Play',
    component: PlayHubView,
    meta: {
      title: 'Play',
      subtitle: 'Start or continue a match.',
      primarySection: 'play',
    },
  },
  {
    path: '/compete',
    redirect: { name: 'Rankings' },
  },
  {
    path: '/rankings',
    name: 'Rankings',
    component: RankingsView,
    meta: {
      title: 'Ladder',
      subtitle: 'Your rank and nearby players.',
      primarySection: 'ladder',
    },
  },
  {
    path: '/tournaments',
    name: 'Tournaments',
    component: TournamentHubView,
    meta: {
      title: 'Tournaments',
      subtitle: 'Active and completed events.',
      primarySection: 'tournament',
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
      activeClubPermission: true,
      primarySection: 'tournament',
      hideBottomNav: true,
    },
  },
  {
    path: '/tournaments/:tournamentId',
    name: 'TournamentOverview',
    component: TournamentOverviewView,
    meta: {
      title: 'Tournament Overview',
      subtitle: 'See categories, progress, officials, and the match schedule.',
      primarySection: 'tournament',
    },
  },
  {
    path: '/tournaments/:tournamentId/category/:categoryId',
    name: 'TournamentCategory',
    component: TournamentCategoryView,
    meta: {
      title: 'Tournament Category',
      subtitle: 'Work through groups, fixtures, standings, and knockout rounds.',
      primarySection: 'tournament',
    },
  },
  {
    path: '/tournaments/:tournamentId/schedule',
    name: 'TournamentSchedule',
    component: TournamentScheduleView,
    meta: {
      title: 'Tournament Schedule',
      subtitle: 'All tournament matches grouped by date and filterable by category.',
      primarySection: 'tournament',
    },
  },
  {
    path: '/tournaments/:tournamentId/gallery',
    name: 'TournamentGallery',
    component: TournamentGalleryView,
    meta: {
      title: 'Tournament Gallery',
      subtitle: 'Browse and share moments from this tournament edition.',
      primarySection: 'tournament',
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
      primarySection: 'tournament',
    },
  },
  {
    path: '/friendly-match/type',
    alias: '/ladder-match/type',
    name: 'FriendlyMatchType',
    component: FriendlyMatchFlowView,
    meta: {
      title: 'New match',
      friendlyFlow: true,
      friendlyStep: 'type',
      primarySection: 'play',
    },
  },
  {
    path: '/friendly-match/timing',
    alias: '/ladder-match/timing',
    name: 'FriendlyMatchTiming',
    component: FriendlyMatchFlowView,
    meta: {
      title: 'When are you playing?',
      friendlyFlow: true,
      friendlyStep: 'timing',
      primarySection: 'play',
    },
  },
  {
    path: '/friendly-match/join',
    alias: '/ladder-match/join',
    name: 'FriendlyMatchJoin',
    component: FriendlyMatchFlowView,
    meta: {
      title: 'Let your opponent join',
      friendlyFlow: true,
      friendlyStep: 'join',
      primarySection: 'play',
    },
  },
  {
    path: '/friendly-match/club-opponent',
    alias: '/ladder-match/opponent',
    name: 'FriendlyMatchClubOpponent',
    component: FriendlyMatchFlowView,
    meta: {
      title: 'Choose opponent from club',
      friendlyFlow: true,
      friendlyStep: 'clubOpponent',
      primarySection: 'play',
    },
  },
  {
    path: '/friendly-match/schedule',
    alias: '/ladder-match/schedule',
    name: 'FriendlyMatchSchedule',
    component: FriendlyMatchFlowView,
    meta: {
      title: 'Optional match timing',
      friendlyFlow: true,
      friendlyStep: 'schedule',
      primarySection: 'play',
    },
  },
  {
    path: '/friendly-match/opponent',
    name: 'FriendlyMatchOpponent',
    component: FriendlyMatchFlowView,
    meta: {
      title: 'Choose opponent',
      friendlyFlow: true,
      friendlyStep: 'opponent',
      primarySection: 'play',
    },
  },
  {
    path: '/friendly-match/scoring',
    alias: '/ladder-match/scoring',
    name: 'FriendlyMatchScoring',
    component: FriendlyMatchFlowView,
    meta: {
      title: 'Scoring',
      friendlyFlow: true,
      friendlyStep: 'scoring',
      primarySection: 'play',
    },
  },
  {
    path: '/friendly-match/format',
    alias: '/ladder-match/format',
    name: 'FriendlyMatchFormat',
    component: FriendlyMatchFlowView,
    meta: {
      title: 'Match format',
      friendlyFlow: true,
      friendlyStep: 'format',
      primarySection: 'play',
    },
  },
  {
    path: '/friendly-match/custom-format',
    name: 'FriendlyMatchCustomFormat',
    component: FriendlyMatchFlowView,
    meta: {
      title: 'Custom format',
      friendlyFlow: true,
      friendlyStep: 'customFormat',
      primarySection: 'play',
    },
  },
  {
    path: '/friendly-match/scheduled',
    alias: '/ladder-match/sent',
    name: 'FriendlyMatchScheduled',
    component: FriendlyMatchFlowView,
    meta: {
      title: 'Invitation sent',
      friendlyFlow: true,
      friendlyStep: 'scheduled',
      primarySection: 'play',
    },
  },
  {
    path: '/friendly-match/join/:token',
    alias: '/ladder-match/join/:token',
    name: 'FriendlyMatchJoinInvitation',
    component: FriendlyMatchFlowView,
    meta: {
      title: 'Join friendly match',
      friendlyFlow: true,
      friendlyStep: 'externalJoin',
      primarySection: 'play',
    },
  },
  {
    path: '/friendly-match/live/:matchId',
    name: 'FriendlyMatchLive',
    component: FriendlyMatchFlowView,
    meta: {
      title: 'Live friendly match',
      friendlyFlow: true,
      friendlyStep: 'live',
      primarySection: 'play',
      immersive: true,
    },
  },
  {
    path: '/ladder-match/live/:matchId',
    name: 'LegacyLadderLive',
    component: LiveMatchView,
    meta: {
      title: 'Live match',
      friendlyFlow: true,
      friendlyStep: 'live',
      primarySection: 'play',
      immersive: true,
    },
  },
  {
    path: '/friendly-match/result/:resultId',
    name: 'FriendlyMatchResult',
    component: FriendlyMatchFlowView,
    meta: {
      title: 'Live friendly match',
      friendlyFlow: true,
      friendlyStep: 'result',
      primarySection: 'play',
      immersive: true,
    },
  },
  {
    path: '/onboarding/join-club',
    name: 'PlayerClubJoin',
    redirect: (to) => ({ name: 'Clubs', query: { ...to.query, view: 'join' } }),
  },
  {
    path: '/admin/setup',
    name: 'AdminSetup',
    component: ClubsView,
    meta: {
      title: 'Club Setup',
      subtitle: 'Create a club or join one with an invite code.',
      permission: 'club.manage',
      onboardingFlow: true,
      primarySection: 'club',
    },
  },
  {
    path: '/clubs',
    name: 'Clubs',
    component: ClubsView,
    meta: {
      title: 'Clubs',
      subtitle: 'The clubs you belong to.',
      primarySection: 'club',
    },
  },
  {
    path: '/club',
    name: 'Club',
    component: ClubView,
    meta: {
      title: 'Club',
      subtitle: 'Your club, members, courts, and rules.',
      primarySection: 'club',
    },
  },
  {
    path: '/settings',
    alias: '/club/settings',
    name: 'Settings',
    component: SettingsView,
    meta: {
      title: 'Club Settings',
      subtitle: 'Manage club details, members, ladders, and rules.',
      permission: 'club.manage',
      activeClubPermission: true,
      primarySection: 'club',
    },
  },
  {
    path: '/account/settings',
    name: 'AccountSettings',
    component: AccountSettingsView,
    meta: {
      title: 'Account Settings',
      subtitle: 'Update your profile, password, and session.',
    },
  },
  {
    path: '/challenges',
    name: 'Challenges',
    component: ChallengesView,
    meta: {
      title: 'Challenges',
      subtitle: 'Challenges sent and received.',
      primarySection: 'ladder',
    },
  },
  {
    path: '/challenges/:challengeId',
    name: 'ChallengeDetails',
    component: ChallengeDetailsView,
    props: true,
    meta: {
      title: 'Challenge Details',
      subtitle: 'Track the next action, match schedule, score, and Ladder result.',
      primarySection: 'ladder',
    },
  },
  {
    path: '/profile',
    name: 'Profile',
    component: ProfileView,
    meta: { title: 'Profile', subtitle: 'Your ladder record and stats.' },
  },
  {
    path: '/history',
    name: 'History',
    component: HistoryView,
    meta: {
      title: 'Match History',
      subtitle: 'Completed matches and court activity.',
    },
  },
  {
    path: '/matches/:matchId/live',
    name: 'LiveMatch',
    component: LiveMatchView,
    props: true,
    meta: {
      title: 'Live match',
      friendlyFlow: true,
      friendlyStep: 'live',
      primarySection: 'play',
      immersive: true,
    },
  },
  {
    path: '/matches/:matchId',
    name: 'MatchDetails',
    component: MatchDetailsView,
    props: true,
    meta: {
      title: 'Match Details',
      subtitle: 'Confirm the final score, verify the winner, and move the ladder forward.',
      primarySection: 'ladder',
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
      activeClubPermission: true,
      primarySection: 'play',
      immersive: true,
    },
  },
  {
    path: '/operations/live',
    name: 'LiveOperations',
    component: LiveOperationsView,
    meta: {
      title: 'Live Operations',
      subtitle: 'See every live court in your club.',
      permission: 'matches.live_score',
      activeClubPermission: true,
      primarySection: 'play',
    },
  },
  {
    path: '/operations/live/:matchId',
    name: 'LiveOperationDetail',
    component: LiveOperationDetailView,
    meta: {
      title: 'Live Match Operations',
      subtitle: 'Review a live court and its Match Control authority.',
      permission: 'matches.live_score',
      activeClubPermission: true,
      primarySection: 'play',
    },
  },
  {
    path: '/live-scoreboard/:matchId',
    name: 'LiveScoreboard',
    component: LiveScoreboardView,
    props: true,
    meta: {
      title: 'Live scoreboard',
      subtitle: 'Read-only match display.',
      immersive: true,
    },
  },
  {
    path: '/display',

    name: 'TvDisplayPairing',

    component: TvDisplayPairingView,

    meta: {
      public: true,

      title: 'Pair live display',

      immersive: true,

      primarySection: 'play',
    },
  },

  {
    path: '/display/live',

    name: 'TvDisplayLive',

    component: TvDisplayLiveView,

    meta: {
      public: true,

      title: 'Live display',

      immersive: true,

      primarySection: 'play',
    },
  },
  {
    path: '/match-umpire/invite/:token',

    name: 'ChairUmpireInvite',

    component: ChairUmpireInvitationView,

    props: (route) => ({
      token: String(route.params.token || ''),

      audience: 'club_member',
    }),

    meta: {
      title: 'Chair umpire invitation',

      immersive: true,

      primarySection: 'play',
    },
  },

  {
    path: '/match-umpire/guest/:token',

    name: 'ChairUmpireGuestInvite',

    component: ChairUmpireInvitationView,

    props: (route) => ({
      token: String(route.params.token || ''),

      audience: 'guest',
    }),

    meta: {
      public: true,

      title: 'Chair umpire invitation',

      immersive: true,

      primarySection: 'play',
    },
  },
  {
    path: '/match-umpire/control/:matchId?',

    name: 'ChairUmpireMatchControl',

    component: FriendlyMatchFlowView,

    meta: {
      public: true,

      title: 'Chair umpire match control',

      friendlyFlow: true,

      friendlyStep: 'live',

      umpireControl: true,

      immersive: true,

      primarySection: 'play',
    },
  },
  {
    path: '/create-challenge',
    name: 'CreateChallenge',
    component: CompeteChallengeCreateView,
    meta: {
      title: 'Create Challenge',
      subtitle: 'Choose an eligible opponent using your club’s fixed Ladder rules.',
      permission: 'challenges.create',
      activeClubPermission: true,
      primarySection: 'ladder',
    },
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
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0, left: 0 }
  },
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  if (!to.meta.public && !authStore.isAuthenticated) {
    return { name: 'SignIn', query: { redirect: to.fullPath } }
  }

  const isClubFlow = ['AdminSetup', 'Clubs'].includes(String(to.name || ''))
  if (!to.meta.public && !isClubFlow) {
    const adminStore = useAdminStore()
    try {
      if (!adminStore.activeClubId) await adminStore.loadClubs()
    } catch {
      // Active-club routes handle unavailable club context below. Other routes
      // must not turn an account-level role into club-level setup authority.
    }
    if (adminStore.hasActiveClubPermission('club.manage') && !adminStore.isConfigured) {
      await adminStore.loadSetup()
      const hasStarted = Number(adminStore.setup?.completedStep || 0) > 0
      return hasStarted
        ? { name: 'AdminSetup', query: { step: adminStore.resumeStep } }
        : { name: 'AdminSetup', query: { view: 'start' } }
    }
  }

  if (to.name === 'PlayMatch') {
    try {
      const response = await getMatch(String(to.params.matchId || ''))
      const match = response?.success ? response.data : null
      if (!match) {
        return { name: 'Dashboard', query: { match: 'not-found' } }
      }
      if (['ladder', 'tournament'].includes(String(match.type || '').toLowerCase())) {
        return { name: 'LiveMatch', params: { matchId: match.id } }
      }
      return {
        name: 'MatchDetails',
        params: { matchId: match.id },
        query: { live: 'unsupported-source' },
      }
    } catch {
      return { name: 'Dashboard', query: { match: 'unavailable' } }
    }
  }

  if (to.meta.activeClubPermission) {
    const adminStore = useAdminStore()
    try {
      if (!adminStore.activeClubId) await adminStore.loadClubs()
    } catch {
      return { name: 'Dashboard', query: { access: 'club' } }
    }
    if (!adminStore.hasActiveClubPermission(to.meta.permission)) {
      return { name: 'Dashboard', query: { access: 'admin' } }
    }
  } else if (to.meta.permission && !authStore.hasPermission(to.meta.permission)) {
    return { name: 'Dashboard', query: { access: 'admin' } }
  }
  return true
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} | GORRA` : 'GORRA'
  window.setTimeout(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, 0)
})

export default router
