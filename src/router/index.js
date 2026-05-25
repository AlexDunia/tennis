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

const routes = [
  {
    path: '/',
    redirect: '/dashboard',
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
})

export default router
