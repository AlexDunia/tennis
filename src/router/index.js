import { createRouter, createWebHashHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import RankingsView from '../views/RankingsView.vue'
import ChallengesView from '../views/ChallengesView.vue'
import MatchDetailsView from '../views/MatchDetailsView.vue'
import CreateChallengeView from '../views/CreateChallengeView.vue'
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
    },
  },
  {
    path: '/create-challenge',
    name: 'CreateChallenge',
    component: CreateChallengeView,
    meta: {
      title: 'Create Challenge',
      subtitle: 'Set up a new ladder challenge against an eligible higher-ranked opponent.',
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
  history: createWebHashHistory(import.meta.env.BASE_URL), // 👈 changed
  routes,
  scrollBehavior() {
    return { top: 0, left: 0 }
  },
})

router.afterEach(() => {
  window.setTimeout(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, 0)
})

export default router
