# ShellTennis PH - Complete Logic & Architecture Guide

**Purpose:** This document explains the entire application architecture, data flow, and how all systems interconnect. Use this as a reference for extending, debugging, or understanding the app logic.

---

## Table of Contents

1. [🧠 Overall System Flow](#-overall-system-flow)
2. [🧭 Routing System](#-routing-system)
3. [🧱 Layout System (Header + Sidebar)](#-layout-system-header--sidebar)
4. [🧩 Component Breakdown](#-component-breakdown)
5. [💾 State Management (Pinia Stores)](#-state-management-pinia-stores)
6. [🔄 End-to-End Data Flows](#-end-to-end-data-flows)
7. [⚙️ Services Layer](#-services-layer)
8. [🎾 Tennis Scoring Logic](#-tennis-scoring-logic)
9. [🎬 Interactions + UI Logic](#-interactions--ui-logic)
10. [🧱 Styling System](#-styling-system)
11. [🔗 Dependency Map (Global Overview)](#-dependency-map-global-overview)

---

## 🧠 Overall System Flow

### Entry Point: How the App Initializes

**File:** `src/main.js`

```javascript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/main.css'

const app = createApp(App) // ← Step 1: Create Vue app instance
app.use(createPinia()) // ← Step 2: Install state management
app.use(router) // ← Step 3: Install router
router.isReady().then(() => {
  app.mount('#app') // ← Step 4: Mount to #app div in index.html
})
```

### Step-by-Step Initialization Process

```
1. index.html loads
   ↓
2. main.js executes
   ↓
3. createApp(App) → creates Vue 3 instance with App.vue as root
   ↓
4. app.use(createPinia()) → initializes Pinia state management
   - Creates a global store for: auth, player, challenge, match, booking, counter
   - Stores are lazy-loaded (only created when first accessed)
   ↓
5. app.use(router) → registers Vue Router
   - Router reads route definitions from router/index.js
   - Prepares all route components
   ↓
6. router.isReady().then() → waits for router to initialize
   - This prevents mounting the app before routes are ready
   ↓
7. app.mount('#app') → renders App.vue into the DOM
   - Vue takes over the #app div
   - App.vue renders DefaultLayout
```

### What App.vue Does

**File:** `src/App.vue`

```vue
<template>
  <DefaultLayout />
</template>

<script setup>
import DefaultLayout from './layouts/DefaultLayout.vue'
</script>
```

**Purpose:**

- Super simple root component
- Only job: render the DefaultLayout wrapper
- All page content flows through DefaultLayout

### How DefaultLayout Wraps Everything

**File:** `src/layouts/DefaultLayout.vue`

```
DefaultLayout
  ├── Sidebar (sticky left)
  │   ├── Brand/Logo
  │   └── Navigation links
  ├── Shell (main area)
  │   ├── PageHeader (sticky top)
  │   │   └── Page title + subtitle (from route meta)
  │   └── Main content area
  │       └── RouterView
  │           └── Current view component (Dashboard, Rankings, etc)
```

**This is the "layout glue" that:**

- Creates the 2-column grid (sidebar + main)
- Provides sticky header and sidebar
- Reads route `meta` to show page title/subtitle
- Renders `<RouterView />` which loads the current page component

### How Router Works with Views

**File:** `src/router/index.js`

When you navigate (e.g., click sidebar link to `/rankings`):

```
1. User clicks RouterLink with to="/rankings"
   ↓
2. Vue Router changes the URL
   ↓
3. Router matches path to route: { path: '/rankings', name: 'Rankings', component: RankingsView }
   ↓
4. Router injects route.meta into DefaultLayout
   ↓
5. DefaultLayout updates PageHeader title/subtitle from route.meta
   ↓
6. <RouterView /> component changes from old view to RankingsView
   ↓
7. RankingsView mounts, runs onMounted() hook
   ↓
8. onMounted() calls store.loadRankings()
   ↓
9. Data loads from API via service
   ↓
10. Component receives reactive data
   ↓
11. Template renders with new data
```

---

## 🧭 Routing System

### Complete Route Definition

**File:** `src/router/index.js`

```javascript
const routes = [
  {
    path: '/',
    redirect: '/dashboard', // Always start at dashboard
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: DashboardView,
    meta: {
      title: 'Dashboard',
      subtitle: 'Overview first, then jump into the exact ladder action...',
    },
  },
  {
    path: '/rankings',
    name: 'Rankings',
    component: RankingsView,
    meta: {
      title: 'Rankings',
      subtitle: 'Track the ladder, compare records...',
    },
  },
  {
    path: '/challenges',
    name: 'Challenges',
    component: ChallengesView,
    meta: {
      title: 'Challenges',
      subtitle: 'Accept, review, and monitor every ladder challenge...',
    },
  },
  {
    path: '/matches/:matchId',
    name: 'MatchDetails',
    component: MatchDetailsView,
    props: true, // ← Converts route params to component props
    meta: {
      title: 'Match Details',
      subtitle: 'Confirm the final score...',
    },
  },
  {
    path: '/play/:matchId',
    name: 'PlayMatch',
    component: PlayView,
    props: true,
    meta: {
      title: 'Play',
      subtitle: 'Run the live scoreboard...',
    },
  },
  {
    path: '/create-challenge',
    name: 'CreateChallenge',
    component: CreateChallengeView,
    meta: {
      title: 'Create Challenge',
      subtitle: 'Set up a new ladder challenge...',
    },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard', // Catch-all: unknown routes → dashboard
  },
]
```

### Key Concepts

#### 1. Dynamic Routes (with Parameters)

**Example:** `/matches/:matchId`

- `:matchId` is a **parameter placeholder**
- When you navigate to `/matches/match-01`, the param `matchId` = `"match-01"`
- Component receives it via `props: true`, converting route params to props
- Access in component: `const matchId = route.params.matchId` OR `props.matchId` (if props: true)

```javascript
// In MatchDetailsView.vue
const route = useRoute()
const matchId = route.params.matchId // ← Direct route access

// OR (with props: true)
defineProps({
  matchId: String, // ← Automatic prop from route param
})
```

#### 2. Named Routes (for navigation)

**Instead of:**

```javascript
router.push('/matches/match-01') // ← hard to refactor
```

**Use:**

```javascript
router.push({ name: 'MatchDetails', params: { matchId: 'match-01' } }) // ← clear + safe
```

#### 3. Route Meta (for dynamic titles)

**In router:**

```javascript
{
  path: '/rankings',
  meta: {
    title: 'Rankings',
    subtitle: 'Track the ladder...',
  }
}
```

**In DefaultLayout:**

```javascript
const currentTitle = computed(() => route.meta.title || 'ShellTennis PH')
const currentSubtitle = computed(() => route.meta.subtitle || 'Manage the ladder...')
```

The PageHeader displays these dynamically.

### Navigation Flows

#### When User Clicks Sidebar Link

```
1. User clicks <RouterLink to="/rankings">
   ↓
2. @click event fires on sidebar__link element
   ↓
3. Vue Router intercepts (RouterLink handles it internally)
   ↓
4. Route changes: /rankings
   ↓
5. router-link-active class applies to the clicked link (CSS styling)
   ↓
6. <RouterView /> updates:
   - OLD component (DashboardView) unmounts
   - NEW component (RankingsView) mounts
   ↓
7. The new view's onMounted() hook fires
   ↓
8. Data fetching begins (e.g., loadPlayers())
   ↓
9. PageHeader updates with new route.meta
```

#### When User Clicks an Action Button (Programmatic Navigation)

**Example:** Creating a challenge and redirecting

```javascript
// In CreateChallengeView.vue
const handleSubmit = async () => {
  const result = await challengeStore.createChallenge({...})
  if (result) {
    router.push({ name: 'Challenges' })  // ← Push to named route
  }
}
```

**Flow:**

```
1. User clicks "Create challenge" button
   ↓
2. handleSubmit() executes
   ↓
3. challengeStore.createChallenge() makes API call
   ↓
4. If successful, router.push() changes route to /challenges
   ↓
5. ChallengesView mounts
   ↓
6. It runs onMounted() → challengeStore.loadChallenges()
   ↓
7. User sees updated list with the new challenge
```

---

## 🧱 Layout System (Header + Sidebar)

### The Layout Grid Structure

**DefaultLayout.vue uses this CSS Grid:**

```css
.layout {
  display: grid;
  grid-template-columns: 270px minmax(0, 1fr); /* 270px sidebar + flexible main */
  min-height: 100vh;
}
```

**This creates:**

- **Left column (270px wide):** Sidebar (sticky)
- **Right column (flexible):** Shell (main content area)

### Sidebar (Sticky Left Column)

**File:** `src/layouts/DefaultLayout.vue` (scoped styles)

#### Structure

```
.sidebar (sticky position, top: 0, height: 100vh)
├── .sidebar__brand
│   └── Logo with decorative arcs (yellow + orange)
├── .sidebar__nav
│   ├── .sidebar__link (Dashboard)
│   ├── .sidebar__link (Rankings)
│   └── .sidebar__link (Challenges)
└── .sidebar__footer
    └── .sidebar__cta (Call-to-action box)
```

#### How Sticky Sidebar Works

```css
.sidebar {
  position: sticky; /* ← Key: stays at top while scrolling */
  top: 0; /* ← Sticks to top of viewport */
  height: 100vh; /* ← Takes full viewport height */
  overflow-y: auto; /* ← Scrolls internally if content overflows */
}
```

**What this means:**

- On desktop: Sidebar is fixed on left, doesn't move
- On scroll: Sidebar stays visible (doesn't scroll away)
- Content can scroll inside it (e.g., if nav links are too many)

#### Navigation Links in Sidebar

```vue
<RouterLink v-for="item in navigationItems" :key="item.to" :to="item.to" class="sidebar__link">
  <span class="sidebar__icon">{{ item.icon }}</span>
  <span class="sidebar__label">{{ item.label }}</span>
</RouterLink>
```

**React system:**

- RouterLink automatically adds `router-link-active` class to matching route
- CSS targets this: `.sidebar__link.router-link-active { background: rgba(255,255,255,0.1) }`
- Result: Active link highlights visually

### PageHeader (Sticky Top)

**Inside .shell > .page-header**

#### Structure

```css
.page-header {
  position: sticky; /* ← Sticks to top when scrolling */
  top: 0; /* ← Sticks to top of viewport */
  z-index: 10; /* ← Above main content */
  padding: 1.4rem 1.75rem;
  background: #ffffff;
  border-bottom: 1px solid var(--color-border);
}
```

#### Dynamic Title from Route Meta

```javascript
const currentTitle = computed(() => route.meta.title || 'ShellTennis PH')
const currentSubtitle = computed(() => route.meta.subtitle || '...')
```

**What happens:**

1. User navigates to `/rankings`
2. Route changes, `route.meta.title` becomes `'Rankings'`
3. `currentTitle` computed property updates
4. Template re-renders with new title
5. PageHeader shows: "Rankings" + subtitle

**Data source flow:** `router/index.js meta` → `route.meta` → computed property → template

### Main Content Area

```css
.layout__main {
  padding: 1.5rem 0 2rem;
  background: var(--color-bg);
}

.container {
  width: min(1180px, calc(100% - 2rem));
  margin: 0 auto;
}
```

**What this means:**

- All views are centered
- Max width is 1180px
- Always has 1rem margins on sides (responsive)
- `<RouterView />` renders inside `.container`

### Layout Responsive Collapse

**Desktop (normal state):**

```
┌────────────────────────────────┐
│ Sidebar (270px) │ Main (1fr)   │
└────────────────────────────────┘
```

**Tablet (max-width: 1120px):**

```css
/* Sidebar becomes horizontal nav at top */
.layout {
  grid-template-columns: 1fr; /* Single column */
}

.sidebar {
  position: relative; /* No longer sticky */
  height: auto; /* Takes normal height */
}

.sidebar__nav {
  grid-template-columns: repeat(3, 1fr); /* 3 columns horizontally */
}
```

**Result:**

```
┌─────────────────────────┐
│ Nav Link  Nav Link  Nav │  ← Horizontal
├─────────────────────────┤
│ Main Content Area       │
└─────────────────────────┘
```

---

## 🧩 Component Breakdown

### ChallengeCard Component

**File:** `src/components/ChallengeCard.vue`

#### Purpose

Display a single challenge in a card format with action buttons.

#### Props

```javascript
defineProps({
  challenge: { type: Object, required: true },
  challengerName: { type: String, default: '' },
  defenderName: { type: String, default: '' },
  showAccept: { type: Boolean, default: false }, // Show "Accept" button?
  showReview: { type: Boolean, default: false }, // Show "Review" button?
  showDetails: { type: Boolean, default: true }, // Show "Details" button?
})
```

#### Emits

```javascript
const emit = defineEmits()
// On button click, parent receives:
// @accept(challengeId)    - user clicked "Accept" button
// @review(challengeId)    - user clicked "Review" button
// @details(challengeId)   - user clicked "Details" button
```

#### What It Renders

```vue
<article class="challenge-card">
  <div>
    <span class="challenge-card__ladder">#{{ rank1 }} → #{{ rank2 }}</span>
    <h3>{{ challengerName }} vs {{ defenderName }}</h3>
    <p>Status: {{ challenge.statusLabel }}</p>
  </div>
  
  <div class="challenge-card__details">
    <p>Challenger: {{ challengerName }}</p>
    <p>Defender: {{ defenderName }}</p>
    <p v-if="challenge.scheduledAt">Scheduled: {{ challenge.scheduledAt }}</p>
    <p v-if="challenge.note">Note: {{ challenge.note }}</p>
  </div>

  <div class="challenge-card__actions">
    <BaseButton @click="$emit('accept', challenge.id)" v-if="showAccept">Accept</BaseButton>
    <BaseButton @click="$emit('review', challenge.id)" v-if="showReview">Review</BaseButton>
    <BaseButton @click="$emit('details', challenge.id)" v-if="showDetails">Details</BaseButton>
  </div>
</article>
```

#### How It's Used (in ChallengesView)

```vue
<!-- Parent component passes data and handles events -->
<ChallengeCard
  v-for="challenge in visibleChallenges"
  :key="challenge.id"
  :challenge="challenge"
  :challengerName="challenge.challengerName"
  :defenderName="challenge.defenderName"
  :showAccept="challenge.status === 'awaiting'"
  :showReview="challenge.status === 'pending_review'"
  @accept="handleAccept"
  @review="handleReview"
  @details="handleDetails"
/>
```

**Data flow:**

```
ChallengesView.vue
  ├─ Has: useChallengeStore() → challenges array
  ├─ Maps over challenges
  ├─ Passes each challenge to ChallengeCard as prop
  ├─ User clicks button in ChallengeCard
  ├─ Card emits event to parent: @accept(id)
  └─ Parent handler calls: challengeStore.acceptChallenge(id)
```

---

### PlayerCard Component

**File:** `src/components/PlayerCard.vue`

#### Props

```javascript
defineProps({
  player: { type: Object, required: true }, // { id, name, rank, wins, losses, matchesPlayed }
  showChallenge: { type: Boolean, default: false }, // Show "Challenge" button?
})
```

#### Emits

```javascript
emit('challenge', player.id) // When "Challenge" button clicked
```

#### What It Renders

```vue
<article class="player-card">
  <div class="player-card__identity">
    <div class="player-card__rank-badge">#{{ player.rank }}</div>
    <div>
      <h3>{{ player.name }}</h3>
      <p>Record {{ player.wins }}-{{ player.losses }}</p>
    </div>
  </div>

  <div class="player-card__meta">
    <span class="player-card__meta-pill">{{ player.matchesPlayed }} matches</span>
    <BaseButton v-if="showChallenge" @click="$emit('challenge', player.id)">
      Challenge
    </BaseButton>
  </div>
</article>
```

#### Used In

- **RankingsView.vue** → displays all players with "Challenge" button for eligible opponents

**Data flow:**

```
RankingsView.vue (uses playerStore)
  ├─ computed: sortedPlayers = playerStore.sortedLadder
  ├─ v-for player in sortedPlayers
  ├─ <PlayerCard :player="player" :showChallenge="canChallenge(player)" />
  ├─ User clicks "Challenge"
  ├─ PlayerCard emits: @challenge(playerId)
  ├─ RankingsView handler calls: router.push({ name: 'CreateChallenge', query: { opponent: playerId } })
  └─ → Navigates to CreateChallenge with opponent pre-selected
```

---

### TennisScoreboard Component

**File:** `src/components/TennisScoreboard.vue`

#### Props

```javascript
defineProps({
  scoreboard: { type: Object, required: true }, // Scoreboard object from tennisScoring.js
})
```

#### Emits

```javascript
emit('point', playerKey) // 'playerA' or 'playerB' when point awarded
```

#### What It Does

Displays:

1. Current game score (Love, 15, 30, 40, Deuce, Advantage, Tie-break)
2. Games won in each set
3. Completed sets summary
4. Two buttons: "Point for Player A" + "Point for Player B"

#### How It's Used (in PlayView)

```vue
<TennisScoreboard :scoreboard="scoreboardState" @point="handlePoint" />
```

**When user clicks "Point for Player A":**

```
1. TennisScoreboard emits: @point('playerA')
2. PlayView.handlePoint() receives playerKey
3. handlePoint calls: scoreboardState.value = recordPoint(scoreboardState.value, 'playerA')
4. recordPoint() (from utils) returns updated scoreboard
5. TennisScoreboard re-renders with new scores
```

---

### BaseButton Component

**File:** `src/components/BaseButton.vue`

#### Props

```javascript
defineProps({
  type: { type: String, default: 'button' }, // HTML button type
  variant: { type: String, default: 'primary' }, // 'primary' | 'secondary' | 'ghost'
  disabled: { type: Boolean, default: false },
})
```

#### Emits

```javascript
emit('click', event) // When button clicked
```

#### Variants

- **primary:** Green background, white text (used for main actions)
- **secondary:** Transparent, green border + text (less important actions)
- **ghost:** Transparent, gray border + text (tertiary actions)

**Used everywhere:** Dashboard, Rankings, Challenges, all forms

---

### BaseInput Component

**File:** `src/components/BaseInput.vue`

#### Props

```javascript
defineProps({
  modelValue: { type: [String, Number], default: '' }, // v-model binding
  label: { type: String, default: '' }, // Label text above input
  placeholder: { type: String, default: '' }, // Placeholder text
  type: { type: String, default: 'text' }, // 'text', 'email', etc.
  disabled: { type: Boolean, default: false },
})
```

#### Emits

```javascript
emit('update:modelValue', newValue) // When input changes (for v-model)
```

#### Used In

- **CreateChallengeView** → message input field
- Any form that needs text input

**Example usage:**

```vue
<BaseInput v-model:modelValue="note" label="Message" placeholder="Add a note..." />
```

---

## 💾 State Management (Pinia Stores)

### What is Pinia?

Pinia is the **state management library** for Vue 3. It stores data that multiple components need to access without manually passing props/events.

**Why?** Without it, passing data through 5+ nested components is painful. Storesallow any component to access data directly.

### Core Concept: Single Source of Truth

```
API (backend)
  ↓
Service (PlayerService)
  ↓
Store (playerStore)
  ↓
Components read from store
  ↓
Store updates → all components using it update automatically
```

### playerStore (player.js)

**File:** `src/stores/player.js`

#### State (Data)

```javascript
const players = ref([]) // All players fetched from API
const currentPlayerId = ref('player-15') // ID of logged-in player
const isLoading = ref(false) // API call in progress?
const error = ref('') // Error message, if any
```

#### Computed Properties (Getters)

```javascript
// Sort players by rank (1 = best)
const sortedLadder = computed(() => [...players.value].sort((a, b) => a.rank - b.rank))

// Find current player object
const currentPlayer = computed(
  () => players.value.find((p) => p.id === currentPlayerId.value) || null,
)

// Find players that currentPlayer can challenge
// (must be higher-ranked, within 3 spots)
const availableOpponents = computed(() => {
  const me = players.value.find((p) => p.id === currentPlayerId.value)
  if (!me) return []

  return players.value
    .filter((p) => p.rank < me.rank) // Higher-ranked
    .filter((p) => me.rank - p.rank <= 3) // Within 3 spots
    .sort((a, b) => a.rank - b.rank)
})
```

#### Actions (Methods)

```javascript
async function loadPlayers() {
  error.value = ''
  isLoading.value = true

  try {
    const response = await getPlayers() // Calls PlayerService

    if (response.success) {
      players.value = response.data // ← Store the data
      return response.data
    }

    error.value = response.message || 'Unable to load players.'
  } catch (err) {
    error.value = err?.message || 'Unable to load players.'
  } finally {
    isLoading.value = false
  }

  return []
}
```

**How to use in a component:**

```vue
<script setup>
import { usePlayerStore } from '../stores/player'

const playerStore = usePlayerStore()

onMounted(async () => {
  await playerStore.loadPlayers() // Fetch data
})
</script>

<template>
  <!-- Reactively bound to store -->
  <p v-for="p in playerStore.sortedLadder" :key="p.id">{{ p.name }} - #{{ p.rank }}</p>
</template>
```

---

### challengeStore (challenge.js)

**File:** `src/stores/challenge.js`

#### State

```javascript
const challenges = ref([]) // All challenges
const filterStatus = ref('all') // Current filter tab: 'all' | 'awaiting' | 'scheduled' | 'pending_review'
const isLoading = ref(false)
const error = ref('')
```

#### Computed Properties

```javascript
// Filter challenges based on filterStatus
const filteredChallenges = computed(() => {
  if (filterStatus.value === 'all') return challenges.value
  return challenges.value.filter((c) => c.status === filterStatus.value)
})

// Count challenges by status
const summaryCounts = computed(() => ({
  awaiting: challenges.value.filter((c) => c.status === 'awaiting').length,
  scheduled: challenges.value.filter((c) => c.status === 'scheduled').length,
  pendingReview: challenges.value.filter((c) => c.status === 'pending_review').length,
}))
```

#### Actions

```javascript
async function loadChallenges() {
  // Call ChallengeService.getChallenges()
  // Store result in challenges.value
}

async function createChallenge(payload) {
  // payload = { challengerId, defenderId, note }
  // Call ChallengeService.createChallenge(payload)
  // Push new challenge to challenges.value
}

async function acceptChallenge(challengeId, scheduledAt) {
  // Call ChallengeService.acceptChallenge(challengeId, scheduledAt)
  // Update the challenge in challenges.value
  // Also calls playerStore.loadPlayers() (ranks might change)
}

async function reviewChallenge(challengeId) {
  // Call ChallengeService.reviewChallenge(challengeId)
  // Update challenge + player ranking
}

function setFilter(status) {
  // Change filterStatus → filteredChallenges updates automatically
  filterStatus.value = status
}
```

**Key:** When `filterStatus` changes, `filteredChallenges` re-computes and ChallengesView UI updates.

---

### matchStore (match.js)

**File:** `src/stores/match.js`

#### State

```javascript
const matches = ref([]) // All matches
const isLoading = ref(false)
const error = ref('')
```

#### Computed Properties

```javascript
// Get match by ID
const matchById = computed(() => (id) => matches.value.find((m) => m.id === id) || null)

// Only matches that are scheduled
const scheduledMatches = computed(() => matches.value.filter((m) => m.status === 'scheduled'))

// Matches waiting for score review
const pendingReviewMatches = computed(() =>
  matches.value.filter((m) => m.status === 'pending_review'),
)
```

#### Actions

```javascript
async function loadMatches() {
  // Call MatchService.getMatches()
  // Store in matches.value
}

async function submitResult(matchId, payload) {
  // payload = { winner_id, sets, ... }
  // Call MatchService.submitMatchResult(matchId, payload)
  // Update match in matches.value
  // Call playerStore.loadPlayers() (rankings updated)
}
```

---

### authStore (auth.js)

**File:** `src/stores/auth.js`

#### Purpose

Track whether user is logged in.

#### State

```javascript
const isLoggedIn = ref(false)
const user = ref(null) // { name, email, lastLogin, role }
const isAuthLoading = ref(false)
const authMessage = ref('')
```

#### Computed

```javascript
const isAuthenticated = computed(() => isLoggedIn.value && !!user.value)
```

#### Actions

```javascript
async function login(credentials) {
  // credentials = { username, password }
  // Later: call backend API
  // For now: uses fakeRequest() for demo
  user.value = { name, email, ... }
  isLoggedIn.value = true
  localStorage.setItem('sheltennis-auth', JSON.stringify({ isLoggedIn, user }))
}

function logout() {
  isLoggedIn.value = false
  user.value = null
  localStorage.removeItem('sheltennis-auth')
}
```

**Persistence:** Auth state saved to localStorage so user stays logged in on page reload.

---

## 🔄 End-to-End Data Flows

### Flow 1: User Opens Dashboard

**Steps:**

```
1. User navigates to http://localhost:5173/ (or /dashboard)
   ↓
2. Router loads DashboardView component
   ↓
3. DashboardView.onMounted() executes:
   await playerStore.loadPlayers()
   await challengeStore.loadChallenges()
   await matchStore.loadMatches()
   ↓
4. Each store action calls its service:
   playerStore → getPlayers() → ApiService.get('/players')
   challengeStore → getChallenges() → ApiService.get('/challenges')
   matchStore → getMatches() → ApiService.get('/matches')
   ↓
5. Services make HTTP requests to mock API (ApiService)
   ↓
6. Responses return:
   { success: true, data: [...] }
   ↓
7. Stores update their state:
   players.value = response.data
   challenges.value = response.data
   matches.value = response.data
   ↓
8. Vue reactivity detects changes
   ↓
9. Computed properties re-compute:
   sortedLadder, filteredChallenges, etc.
   ↓
10. Template re-renders with new data
   ↓
11. Dashboard displays:
    - Welcome message (from currentPlayer)
    - Stats grid (counts from stores)
    - Pending actions (from challenges + matches)
    - Featured match (from matches)
    - Recent challenges (from challenges)
    - Recent matches (from matches)
```

**Data source flow:**

```
API (mock in ApiService)
  ↓
Service: getPlayers(), getChallenges(), getMatches()
  ↓
Store state: players.value, challenges.value, matches.value
  ↓
Store computed: sortedLadder, filteredChallenges, etc.
  ↓
Component template accesses store data
  ↓
Renders UI
```

---

### Flow 2: User Creates a Challenge

**Steps:**

```
1. User navigates to /create-challenge
   ↓
2. CreateChallengeView mounts:
   await playerStore.loadPlayers()
   ↓
3. Component shows:
   - Current player info (from playerStore.currentPlayer)
   - Opponent dropdown (from playerStore.availableOpponents)
   ↓
4. User selects opponent + writes message
   ↓
5. User clicks "Create challenge"
   ↓
6. handleSubmit() executes:
   const result = await challengeStore.createChallenge({
     challengerId: currentPlayer.id,
     defenderId: opponentId,
     note: message
   })
   ↓
7. Store action calls:
   createChallengeRequest(payload) → ApiService.post('/challenges', payload)
   ↓
8. Service makes POST request → mock backend
   ↓
9. Backend returns:
   {
     success: true,
     data: {
       id: 'challenge-new',
       challengerId: 'player-15',
       defenderId: 'player-08',
       status: 'awaiting',
       ...
     }
   }
   ↓
10. Store updates:
    challenges.value.push(response.data)
    ↓
11. If successful, navigate:
    router.push({ name: 'Challenges' })
    ↓
12. ChallengesView mounts:
    await challengeStore.loadChallenges()
    ↓
13. Challenge list re-loads from API
    ↓
14. User sees new challenge in list (status: 'awaiting')
```

**Key:** The challenge was added to `challenges.value`, store emits update, any component using `challengeStore.challenges` re-renders.

---

### Flow 3: User Accepts a Challenge

**Steps:**

```
1. User is on /challenges page
   ↓
2. Sees challenge with "Accept" button
   ↓
3. Clicks "Accept"
   ↓
4. ChallengeCard emits: @accept(challengeId)
   ↓
5. ChallengesView.handleAccept(challengeId):
   const result = await challengeStore.acceptChallenge(challengeId, scheduledAt)
   ↓
6. Store action calls:
   acceptChallengeRequest(challengeId, scheduledAt)
   → ApiService.post(`/challenges/${challengeId}/accept`, { scheduledAt })
   ↓
7. Backend returns:
   {
     success: true,
     data: {
       challenge: { id, status: 'scheduled', scheduledAt: '2024-04-20T...' },
       match: { id: 'match-new', challengeId, status: 'scheduled', ... }
     }
   }
   ↓
8. Store updates challenge:
   const challengeIndex = challenges.value.findIndex(c => c.id === challengeId)
   challenges.value[challengeIndex] = response.data.challenge
   ↓
9. Also loads updated players (ranks might change):
   playerStore.loadPlayers()
   ↓
10. Challenge in list changes:
    Status: "Awaiting" → Status: "Scheduled"
    No more "Accept" button, shows "Details" button instead
```

---

### Flow 4: User Records Match Score (Tennis Scoreboard)

**Steps:**

```
1. User navigates to /play/:matchId
   ↓
2. PlayView mounts:
   await playerStore.loadPlayers()
   await matchStore.loadMatches()
   ↓
3. Finds current match:
   const currentMatch = matchStore.matchById(matchId)
   ↓
4. Creates scoreboard:
   scoreboardState.value = createScoreboard(
     challenger.name,
     defender.name,
     bestOfSets: 3
   )
   ↓
5. TennisScoreboard displays with current scores
   ↓
6. User clicks "Point for Player A"
   ↓
7. TennisScoreboard emits: @point('playerA')
   ↓
8. PlayView.handlePoint('playerA'):
   scoreboardState.value = recordPoint(scoreboardState.value, 'playerA')
   ↓
9. recordPoint() (from tennisScoring.js):
   - Player A points: 0 → 1
   - Returns updated scoreboard
   ↓
10. scoreboardState updates
    ↓
11. TennisScoreboard re-renders with new score:
    "15" for Player A
    ↓
12. User continues clicking to record all points
    ↓
13. When match ends (scoreboard.matchWinner set):
    - Finals button appears: "Confirm Result"
    - User clicks it
    ↓
14. PlayView submits:
    matchStore.submitResult(matchId, {
      winner_id: winner_player_id,
      sets: [...],
      score: '6-3 6-4'
    })
    ↓
15. Store calls:
    MatchService.submitMatchResult(matchId, payload)
    → ApiService.post(`/matches/${matchId}/result`, payload)
    ↓
16. Backend updates rankings, returns success
    ↓
17. Store updates:
    matches.value[matchIndex] = response.data
    playerStore.loadPlayers()  ← Ranks changed!
    ↓
18. User redirected to /challenges
    ↓
19. Dashboard/Rankings show updated rankings
```

---

## ⚙️ Services Layer

### What is a Service?

A **service** is a utility file that:

- Calls the backend API
- Formats request/response data
- No Vue components, no stores
- Just JavaScript functions

**Why?** Keep API logic separate from store logic.

---

### ApiService (api.js)

**File:** `src/services/api.js`

This is the **low-level HTTP client** for all API requests.

#### How It Works

```javascript
// It's a mock API for demo purposes
// In production, it would use axios to call real backend

export async function fakeRequest(data, delay = 300) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), delay)
  })
}
```

**On mock backend:**

- Stores data in `mockDatabase`
- Has `players`, `challenges`, `matches` arrays
- Methods generate/manipulate data

**Example:**

```javascript
// This "API" generates 20 fake players on first call
const mockDatabase = {}
function ensureData() {
  if (mockDatabase.players.length === 0) {
    mockDatabase.players = createPlayers() // 20 mock players
  }
}
```

---

### PlayerService.js

**File:** `src/services/PlayerService.js`

```javascript
import ApiService from './ApiService'

export async function getPlayers() {
  const response = await ApiService.get('/players')
  return response.data // { success: true, data: [...] }
}

export async function getPlayerById(playerId) {
  const response = await ApiService.get('/players')
  return response.data.data.find((p) => p.id === playerId)
}
```

**Usage in playerStore:**

```javascript
const response = await getPlayers() // Calls PlayerService
if (response.success) {
  players.value = response.data
}
```

---

### ChallengeService.js

**File:** `src/services/ChallengeService.js`

```javascript
export async function getChallenges() {
  const response = await ApiService.get('/challenges')
  return response.data
}

export async function createChallenge(payload) {
  // payload = { challengerId, defenderId, note }
  const response = await ApiService.post('/challenges', payload)
  return response.data
}

export async function acceptChallenge(challengeId, scheduledAt) {
  const response = await ApiService.post(`/challenges/${challengeId}/accept`, { scheduledAt })
  return response.data
}

export async function reviewChallenge(challengeId) {
  const response = await ApiService.post(`/challenges/${challengeId}/review`, {})
  return response.data
}
```

---

### MatchService.js

**File:** `src/services/MatchService.js`

```javascript
export async function getMatches() {
  const response = await ApiService.get('/matches')
  return response.data
}

export async function submitMatchResult(matchId, payload) {
  // payload = { winner_id, sets, score, ... }
  const response = await ApiService.post(`/matches/${matchId}/result`, payload)
  return response.data
}
```

---

## 🎾 Tennis Scoring Logic

### What is tennisScoring.js?

**File:** `src/utils/tennisScoring.js`

A utility file with **pure functions** (no Vue, no stores) that implement tennis scoring rules.

### Tennis Scoring Rules

```
Points:    Love, 15, 30, 40
Games:     First to 6 (with 2+ lead)
Sets:      Best of 3 or 5
Tie-break: At 6-6 games, first to 7 points (with 2+ lead)
```

### Core Functions

#### 1. createScoreboard()

Creates a scoreboard object to track match state.

```javascript
export function createScoreboard(playerA = 'Server', playerB = 'Returner', bestOfSets = 3) {
  return {
    players: { playerA, playerB },
    sets: [
      { games: { playerA: 0, playerB: 0 }, winner: null, tieBreak: null },
      { games: { playerA: 0, playerB: 0 }, winner: null, tieBreak: null },
      { games: { playerA: 0, playerB: 0 }, winner: null, tieBreak: null },
    ],
    currentSetIndex: 0,
    currentGame: {
      points: { playerA: 0, playerB: 0 },
      advantage: null,
      inTieBreak: false,
      tieBreakPoints: { playerA: 0, playerB: 0 },
    },
    completedSets: [],
    matchWinner: null,
    bestOfSets,
  }
}
```

**Object structure:**

- `players`: Names of both players
- `sets`: Array of each set's state
- `currentSetIndex`: Which set we're in (0, 1, 2)
- `currentGame`: Points state in current game
- `completedSets`: Finished sets (for display)
- `matchWinner`: 'playerA' | 'playerB' | null

#### 2. recordPoint()

When a point is awarded, updates scoreboard.

```javascript
export function recordPoint(originalScoreboard, playerKey) {
  // playerKey = 'playerA' or 'playerB'

  const scoreboard = clone(originalScoreboard) // Deep copy (don't mutate original)

  // If match already won, return as-is
  if (scoreboard.matchWinner) return scoreboard

  const opponentKey = getOpponent(playerKey) // Other player

  // If in tie-break (6-6 games)
  if (scoreboard.currentGame.inTieBreak) {
    scoreboard.currentGame.tieBreakPoints[playerKey] += 1
    // First to 7 with 2+ lead wins tie-break
    if (playerPoints >= 7 && playerPoints - opponentPoints >= 2) {
      // Tie-break won → set won → check if match won
    }
  } else {
    // Normal game scoring
    scoreboard.currentGame.points[playerKey] += 1

    // First to 4 points (with 2+ lead) wins game
    if (playerPoints >= 4 && playerPoints - opponentPoints >= 2) {
      set.games[playerKey] += 1 // Increment games
      resetGame(scoreboard) // Reset points to 0-0

      // Check if set won (6 games with 2+ lead)
      if (set.games[playerKey] >= 6 && set.games[playerKey] - set.games[opponentKey] >= 2) {
        finalizeSet(scoreboard, playerKey)
        // Check if match won
      }
    }
  }

  return scoreboard
}
```

**Logic:**

```
Point awarded
  ↓
Check if tie-break (6-6 games)?
  ├─ Yes → tie-break points to 7? → tie-break winner → set winner → match winner?
  └─ No → normal game to 4 points? → game winner → set winner? → match winner?
```

#### 3. describePoint()

Get the display label for current points.

```javascript
export function describePoint(scoreboard, playerKey) {
  const { points, advantage, inTieBreak, tieBreakPoints } = scoreboard.currentGame

  if (inTieBreak) {
    return tieBreakPoints[playerKey].toString() // "7", "8", etc.
  }

  if (points[playerKey] >= 3 && points[opponentKey] >= 3) {
    if (advantage === playerKey) return 'Advantage'
    if (advantage === null) return 'Deuce' // 40-40
    if (advantage === opponentKey) return '40'
  }

  return pointLabels[points[playerKey]] // 'Love', '15', '30', '40'
}
```

**Examples:**

- Points 0-0 → "Love" vs "Love"
- Points 1-0 → "15" vs "Love"
- Points 3-3 → "Deuce"
- Points 4-3 → "Advantage" vs "40"

#### 4. formatSetSummary()

Return display format for completed sets.

```javascript
export function formatSetSummary(scoreboard) {
  return scoreboard.sets.map((set, index) => ({
    label: `Set ${index + 1}`,
    playerAGames: set.games.playerA,
    playerBGames: set.games.playerB,
    winner: set.winner,
    tieBreak: set.tieBreak,
  }))
}
```

**Example output:**

```javascript
;[
  { label: 'Set 1', playerAGames: 6, playerBGames: 3, winner: 'playerA', tieBreak: null },
  { label: 'Set 2', playerAGames: 5, playerBGames: 6, winner: null, tieBreak: null },
]
```

### Tennis Scoring State Machine

```
MATCH STATE
  ├─ currentGame.points: { playerA: 0-3, playerB: 0-3 }
  │   ├─ If both ≥ 3 → Deuce state
  │   │   ├─ Difference of 1 → Advantage
  │   │   ├─ Difference of 2 → Game winner
  │   └─ Else → Standard: Love, 15, 30, 40
  │
  ├─ currentGame.inTieBreak: true/false
  │   └─ If true → tieBreakPoints: { playerA, playerB }
  │       └─ First to 7 with 2+ lead wins
  │
  ├─ currentGame wins → set.games increment
  │   └─ First to 6 games with 2+ lead wins set
  │       └─ Completed sets += 1
  │           └─ First to win majority (best-of-3 → 2) wins match
```

---

## 🎬 Interactions + UI Logic

### Button Click → Action Flow

**Example: User clicks "Accept Challenge" button**

```
1. User sees ChallengeCard with challenge.status = 'awaiting'
   ↓
2. ChallengeCard renders: <BaseButton @click="$emit('accept', challenge.id)">Accept</BaseButton>
   ↓
3. User clicks button
   ↓
4. BaseButton emits: @click event
   ↓
5. ChallengeCard catches click, emits: @accept(challenge.id)
   ↓
6. Parent (ChallengesView) catches: @accept="handleAccept(challengeId)"
   ↓
7. handleAccept() executes:
   challengeStore.acceptChallenge(challengeId)
   ↓
8. Store calls service:
   acceptChallengeRequest(challengeId, scheduledAt)
   ↓
9. Service calls API:
   ApiService.post(`/challenges/${challengeId}/accept`, { scheduledAt })
   ↓
10. Backend updates challenge status: 'awaiting' → 'scheduled'
    ↓
11. Response returns updated challenge object
    ↓
12. Store updates state:
    challenges.value[index] = response.challenge
    ↓
13. Vue reactivity detects change
    ↓
14. ChallengesView template re-renders that challenge
    ↓
15. ChallengeCard now shows:
    status = 'scheduled' (not 'awaiting')
    showAccept = false (no longer shows "Accept" button)
    showDetails = true (shows "Details" button)
    ↓
16. User sees visual update
```

---

### Hover/Active Styling

**CSS handles this without JavaScript:**

```css
/* Sidebar link */
.sidebar__link {
  transition:
    background 0.12s ease-in-out,
    border-color 0.12s ease-in-out;
}

.sidebar__link.router-link-active {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.sidebar__link:hover {
  background: rgba(255, 255, 255, 0.1);
}
```

**How it works:**

- Vue Router automatically applies `router-link-active` to active route link
- CSS selector matches and applies background color
- Hover state triggers on :hover pseudo-class
- 0.12s transition makes it smooth

---

### Form Input → v-model Binding

**Example: Note field in CreateChallengeView**

```vue
<!-- Template -->
<BaseInput v-model:modelValue="note" label="Message" />

<!-- Script -->
const note = ref('Looking forward to a competitive match.')
```

**Flow:**

```
1. Template: v-model:modelValue="note"
   ↓
2. BaseInput has: <input @input="$emit('update:modelValue', $event.target.value)" />
   ↓
3. User types in input
   ↓
4. Input event fires
   ↓
5. @input handler takes event.target.value (new text)
   ↓
6. Emits: @update:modelValue(newText)
   ↓
7. Parent receives update, Vue's v-model directive updates:
   note.value = newText
   ↓
8. note.value is now the text user typed
   ↓
9. When submitting form:
   challengeStore.createChallenge({ note: note.value, ... })
```

---

### Router Navigation Effects

**When URL changes:**

```
URL: /challenges → /create-challenge
  ↓
Router matches route
  ↓
currentRoute changes
  ↓
route.meta updates
  ↓
computed currentTitle / currentSubtitle update
  ↓
PageHeader title changes
  ↓
OLD view (ChallengesView) unmounts
  ↓
OLD view's data/listeners removed (garbage collection)
  ↓
NEW view (CreateChallengeView) mounts
  ↓
NEW view's onMounted() hook runs
  ↓
Data loading begins
  ↓
NEW view renders with fresh data
```

---

## 🧱 Styling System

**See styling.md for detailed CSS reference.**

### How Styles Apply

#### 1. Global Styles (src/assets/main.css)

```css
:root {
  --color-primary: #00b51a;
  --color-accent: #ffd33d;
  /* ... 50+ CSS variables */
}

body {
  font-family: Inter, 'Avenir Next', 'Segoe UI', sans-serif;
  color: var(--color-text);
  background: var(--color-bg);
}

.container {
  width: min(1160px, calc(100% - 2rem));
  margin: 0 auto;
}
```

- Loaded first in main.js
- Defines design tokens (colors, spacing, shadows)
- Applies to all HTML elements

#### 2. Component Scoped Styles

```vue
<style scoped>
.challenge-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
}
</style>
```

- Scoped to component only (doesn't affect other components)
- References global CSS variables
- Vue adds unique class prefix (e.g., `data-v-abc123`)

#### 3. Inline Styles for Dynamic Values

```vue
<div :style="{ color: player.rankColor }">
  {{ player.name }}
</div>
```

- Used for truly dynamic values
- Less common (usually CSS is better)

### Reactive Styling Pattern

```vue
<div :class="{ 'sidebar__link--active': isActive }">
  Link
</div>

<script>
const isActive = computed(() => route.path === '/dashboard')
</script>
```

**When route changes:**

1. `route.path` updates
2. `isActive` computed property re-evaluates
3. `:class` binding re-applies
4. CSS classes update
5. Styles change immediately (Vue reactivity)

---

## 🔗 Dependency Map (Global Overview)

### Complete Component Dependency Tree

```
src/main.js (entry point)
  ├─ createApp(App)
  ├─ createPinia() → stores/
  │   ├─ auth.js
  │   ├─ player.js → services/PlayerService.js
  │   ├─ challenge.js → services/ChallengeService.js
  │   ├─ match.js → services/MatchService.js
  │   └─ ...other stores
  ├─ router (from router/index.js)
  └─ app.mount('#app')

App.vue (root component)
  └─ DefaultLayout.vue
      ├─ Sidebar
      │   └── RouterLink → routes
      ├─ PageHeader
      │   └── Route meta → title/subtitle
      └─ RouterView
          ├─ /dashboard → DashboardView.vue
          │   ├─ uses playerStore, challengeStore, matchStore
          │   ├─ renders ChallengeCard (multiple)
          │   ├─ renders stat cards
          │   └─ onMounted: loads all data
          │
          ├─ /rankings → RankingsView.vue
          │   ├─ uses playerStore
          │   ├─ renders PlayerCard (multiple)
          │   └─ onMounted: loadPlayers()
          │
          ├─ /challenges → ChallengesView.vue
          │   ├─ uses challengeStore, matchStore
          │   ├─ renders ChallengeCard (multiple)
          │   └─ onMounted: loadChallenges(), loadMatches()
          │
          ├─ /create-challenge → CreateChallengeView.vue
          │   ├─ uses playerStore, challengeStore
          │   ├─ renders BaseInput, BaseButton
          │   └─ onMounted: loadPlayers()
          │
          ├─ /matches/:matchId → MatchDetailsView.vue
          │   ├─ uses matchStore
          │   └─ receives matchId via route param
          │
          └─ /play/:matchId → PlayView.vue
              ├─ uses playerStore, matchStore
              ├─ renders TennisScoreboard
              ├─ imports tennisScoring.js (utility)
              └─ onMounted: loads players + matches
```

### Data Flow Tree

```
API (Mock Backend in ApiService)
  │
  ├─ GET /players → PlayerService → playerStore → components:
  │   ├─ DashboardView (currentPlayer, stats)
  │   ├─ RankingsView (sortedLadder)
  │   └─ CreateChallengeView (availableOpponents)
  │
  ├─ GET /challenges → ChallengeService → challengeStore → components:
  │   ├─ DashboardView (pendingActions, recentChallenges)
  │   └─ ChallengesView (filteredChallenges)
  │
  ├─ GET /matches → MatchService → matchStore → components:
  │   ├─ DashboardView (featuredMatch, recentMatches)
  │   ├─ PlayView (currentMatch)
  │   └─ MatchDetailsView (match details)
  │
  ├─ POST /challenges → ChallengeService → challengeStore
  │
  ├─ POST /challenges/:id/accept → ChallengeService → challengeStore + playerStore
  │
  ├─ POST /challenges/:id/review → ChallengeService → challengeStore + playerStore
  │
  └─ POST /matches/:id/result → MatchService → matchStore + playerStore
```

### Component Dependency Relationships

```
BaseButton
  └─ used by: ChallengeCard, CreateChallengeView, DashboardView, every view

BaseInput
  └─ used by: CreateChallengeView

ChallengeCard
  ├─ used by: ChallengesView, DashboardView
  └─ emits: @accept, @review, @details

PlayerCard
  ├─ used by: RankingsView
  └─ emits: @challenge

TennisScoreboard
  ├─ used by: PlayView
  └─ emits: @point

NavBar
  └─ used by: DefaultLayout (header area)

Sidebar
  └─ used by: DefaultLayout (left column)
```

### Store Dependency Relationships

```
playerStore
  ├─ used by: DashboardView, RankingsView, CreateChallengeView, PlayView
  ├─ depends on: PlayerService
  └─ called by: challengeStore.acceptChallenge(), challengeStore.reviewChallenge(), matchStore.submitResult()

challengeStore
  ├─ used by: ChallengesView, DashboardView, CreateChallengeView
  ├─ depends on: ChallengeService, playerStore
  └─ used in flow: create → accept → review → match

matchStore
  ├─ used by: DashboardView, PlayView, MatchDetailsView
  ├─ depends on: MatchService, playerStore
  └─ called by: PlayView (tennis scoring flow)

authStore
  ├─ used by: NavBar (auth state)
  ├─ persists to: localStorage
  └─ not fully integrated (demo only)
```

### Critical Data Paths

```
Path 1: Challenge workflow
  User creates challenge
    ↓ challengeStore.createChallenge()
    ↓ ChallengeService.createChallenge()
    ↓ ApiService.post('/challenges')
    ↓ Mock backend creates challenge
    ↓ Returns { success: true, data: challenge }
    ↓ Store pushes to challenges.value
    ↓ Router redirects to /challenges
    ↓ ChallengesView reloads challenges
    ↓ New challenge appears in list

Path 2: Match scoring
  PlayView mounts
    ↓ Loads players + matches
    ↓ Creates scoreboard state
    ↓ User clicks "Point for Player A"
    ↓ TennisScoreboard emits @point
    ↓ PlayView calls recordPoint()
    ↓ Scoreboard updates (points, games, sets)
    ↓ TennisScoreboard re-renders
    ↓ User sees updated score
    ↓ When match won, user confirms
    ↓ matchStore.submitResult()
    ↓ MatchService posts result
    ↓ playerStore.loadPlayers() (rankings updated)
    ↓ Redirect to challenges
    ↓ Dashboard shows new ladder

Path 3: View mounting + data loading
  Router navigates to view
    ↓ Old view unmounts (cleanup)
    ↓ New view mounts
    ↓ onMounted() hook runs
    ↓ Calls store.load*() actions
    ↓ Services fetch from API
    ↓ Stores update state
    ↓ Computed properties re-evaluate
    ↓ Template re-renders
    ↓ User sees data
```

---

## Design Intent & Rules (from styling.md)

These rules guide how to interpret and extend the UI:

### 1. Highlighting Rule

If an element already has emphasis (color, position, or weight), do NOT add another layer of emphasis.

### 2. Icon Rule

Icons must be monochrome, have no background container, rely on spacing and alignment only.

### 3. Card Rule

Avoid nesting cards inside cards. Lists should be lightweight, not boxed.

### 4. Hierarchy Rule

- Tier 1 → strongest contrast
- Tier 2 → structured but calm
- Tier 3 → minimal and quiet

### 5. Motion Rule

All animations must be subtle. No bounce, no exaggerated motion.

### 6. Simplicity Rule

If something can be removed without losing meaning → remove it.

### 7. Consistency Rule

All similar elements must share spacing, sizing, and interaction behavior.

---

## Summary for AI Integration

**When extending this app:**

1. **New View?** Create in `views/`, use stores in `onMounted()`, access `route.meta` for title
2. **New Component?** Create in `components/`, accept props, emit events, use `:class` for dynamic styling
3. **New Data?** Add action to store, create service function, ensure data flows: API → Service → Store → Component
4. **New Form?** Use BaseInput for text, BaseButton for submit, v-model for binding
5. **New List?** Use existing card components (PlayerCard, ChallengeCard), map over store array
6. **Tennis Scoring?** Use `createScoreboard()`, call `recordPoint()`, display via TennisScoreboard

**Key Principles:**

- Stores are single source of truth
- Services keep API separate
- Components are dumb (just render props)
- router.meta provides context
- CSS variables allow theming
- Scoped styles prevent conflicts

---

End of Logic Documentation
