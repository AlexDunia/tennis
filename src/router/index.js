import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import RankingsView from '../views/RankingsView.vue'
import ChallengesView from '../views/ChallengesView.vue'
import MatchDetailsView from '../views/MatchDetailsView.vue'
import CreateChallengeView from '../views/CreateChallengeView.vue'
import PlayView from '../views/PlayView.vue'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'Dashboard', component: DashboardView },
  { path: '/rankings', name: 'Rankings', component: RankingsView },
  { path: '/challenges', name: 'Challenges', component: ChallengesView },
  { path: '/matches/:matchId', name: 'MatchDetails', component: MatchDetailsView, props: true },
  { path: '/play/:matchId', name: 'PlayMatch', component: PlayView, props: true },
  { path: '/create-challenge', name: 'CreateChallenge', component: CreateChallengeView },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
