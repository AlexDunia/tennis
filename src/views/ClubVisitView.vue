<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import ClubIdentityHero from '../components/club/ClubIdentityHero.vue'
import FlowIcon from '../components/friendly/FlowIcon.vue'
import { useAdminStore } from '../stores/admin'
import { useShellNestedHeader } from '../composables/useShellNestedHeader.js'
import { collectClubMembers } from '../utils/club/memberData.js'
import { getTournaments } from '../services/TournamentService'
import { effectiveLadderRoster } from '../services/LadderAdminService.js'
import { resolveLadderConfigFromSetup, ladderMatchConfig } from '../config/ladder.js'
import { ladderRulesToMatchRulesSnapshot } from '../domain/ruleAdapters/ladderMatchRules.js'
import { formatMatchRulesSummary } from '../utils/matchRulesSummary.js'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()
const switching = ref(false)
const error = ref('')
const tournamentError = ref('')
const loadingTournaments = ref(true)
const allTournaments = ref([])
const search = ref('')
const clubId = computed(() => String(route.params.clubId || ''))
const club = computed(() => adminStore.clubs.find((item) => item.id === clubId.value))
const setup = computed(() => club.value?.setup || {})
const workspace = computed(() => setup.value.workspace || {})
const visiting = computed(() => clubId.value !== adminStore.activeClubId)
const section = computed(() => String(route.params.section || ''))
const members = computed(() => collectClubMembers(setup.value))
const visibleMembers = computed(() => members.value.filter((member) =>
  `${member.name || ''} ${member.email || ''}`.toLowerCase().includes(search.value.toLowerCase()),
))
const ladders = computed(() => (setup.value.ladders || []).filter((item) => item.enabled !== false && !item.archived))
const tournaments = computed(() => allTournaments.value.filter((item) => item.clubId === clubId.value))
const canManage = computed(() => adminStore.hasClubPermission(clubId.value, 'club.manage'))
const member = computed(() => members.value.find((item) => item.id === route.query.member))
const tournament = computed(() => tournaments.value.find((item) => item.id === route.query.tournament))
const ladder = computed(() => ladders.value.find((item) => item.id === route.query.ladder) || ladders.value[0])
const ladderRules = computed(() => resolveLadderConfigFromSetup(setup.value, ladder.value?.id || ''))
const scoring = computed(() => {
  const result = ladderRulesToMatchRulesSnapshot({ matchConfig: ladderMatchConfig(ladderRules.value) })
  return result.ok ? formatMatchRulesSummary(result.snapshot).rows : []
})
const ladderPlayers = computed(() => {
  if (!ladder.value) return []
  const current = ladder.value
  const explicitIds = current.playerIds || current.memberIds
  const roster = members.value.filter((person) => {
    if (Array.isArray(explicitIds)) return explicitIds.includes(person.id)
    if (Array.isArray(person.ladderIds)) return person.ladderIds.includes(current.id)
    if (person.ladderMemberships?.length) return person.ladderMemberships.some((entry) =>
      entry.ladderId === current.id || entry.ladderName === current.name,
    )
    return current.id === (setup.value.primaryLadderId || ladders.value[0]?.id)
  }).map((person) => ({
    ...person,
    rank: person.ladderMemberships?.find((entry) => entry.ladderId === current.id || entry.ladderName === current.name)?.position || person.ladderRank || person.rank,
  })).sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity))
  return effectiveLadderRoster({ clubId: clubId.value, ladderId: current.id }, roster)
})
const pages = computed(() => [
  { section: '', title: 'Overview', action: 'Open club', icon: 'friendly', to: 'Club' },
  { section: 'members', title: 'Members', action: 'Open members', icon: 'users', to: 'ClubMembers' },
  { section: 'ladders', title: 'Ladders', action: 'Open ladders', icon: 'ladder', to: 'Rankings' },
  { section: 'tournaments', title: 'Tournaments', action: 'Open tournaments', icon: 'trophy', to: 'Tournaments' },
  ...(canManage.value ? [{ section: 'settings', title: 'Club settings', action: 'Open settings', icon: 'sliders', to: 'ClubSettingsHub' }] : []),
])
function visitLink(nextSection = '', query = {}) {
  return { name: 'ClubVisit', params: { clubId: clubId.value, section: nextSection || undefined }, query }
}
async function makeActive() {
  if (switching.value || !club.value) return
  const targetClubId = clubId.value
  const destination = pages.value.find((page) => page.section === section.value)?.to || 'Club'
  switching.value = true
  error.value = ''
  try {
    await adminStore.switchClub(targetClubId)
    await router.replace({ name: destination })
  } catch (cause) {
    error.value = cause?.message || 'We could not switch clubs.'
  } finally {
    switching.value = false
  }
}
useShellNestedHeader(() => ({
  label: club.value?.name || 'Visiting club',
  backLabel: section.value ? 'Back to club' : 'Back to clubs',
  back: () => router.push(section.value ? visitLink() : { name: 'Clubs' }),
  crumbs: [{ label: 'Clubs' }, { label: club.value?.name || 'Club' }, { label: pages.value.find((page) => page.section === section.value)?.title || 'Overview' }],
}))
onMounted(async () => {
  try {
    const response = await getTournaments()
    if (!response.success) throw new Error(response.message || 'Could not load tournaments.')
    allTournaments.value = Array.isArray(response.data) ? response.data : []
  } catch (cause) {
    tournamentError.value = cause?.message || 'Could not load tournaments.'
  } finally {
    loadingTournaments.value = false
  }
})
</script>

<template>
  <main v-if="club" class="gorra-club-ref ref-page club-visit" :class="{ 'club-visit--away': visiting }">
    <aside v-if="visiting" class="club-visit-banner" aria-label="Visiting another club">
      <span>Current club: <strong>{{ adminStore.activeClub?.name || 'None selected' }}</strong></span>
      <span>Visiting: <strong>{{ club.name }}</strong></span>
      <button type="button" :disabled="switching" @click="makeActive">
        {{ switching ? 'Switching...' : `Switch to ${club.name}` }}
      </button>
    </aside>
    <p v-if="error" class="ref-inline-alert" role="alert">{{ error }}</p>
    <nav class="club-visit-nav" aria-label="Visiting club sections">
      <RouterLink v-for="page in pages" :key="page.section" :to="visitLink(page.section)" :aria-current="section === page.section ? 'page' : undefined">
        {{ page.title }}
      </RouterLink>
    </nav>

    <template v-if="!section">
      <ClubIdentityHero :name="club.name" :location="workspace.location || ''" :logo-url="workspace.logoUrl || ''" :cover-url="workspace.coverUrl || ''" :cover-preset="workspace.coverPreset || 'court-green'" :member-count="members.length" :ladder-count="ladders.length" :tournament-count="tournaments.length" :editable="false" />
      <section class="ref-club-manage">
        <header class="ref-section-heading"><h2>Explore {{ club.name }}</h2></header>
        <div class="ref-choice-stack">
          <RouterLink v-for="page in pages.filter((item) => item.section)" :key="page.section" class="ref-choice-row visit-choice" :to="visitLink(page.section)">
            <span class="ref-feature-icon"><FlowIcon :name="page.icon" /></span>
            <strong>{{ page.title }}</strong>
            <span class="ref-button primary">{{ page.action }} <FlowIcon name="arrow-right" /></span>
          </RouterLink>
        </div>
      </section>
    </template>

    <section v-else-if="section === 'members'" class="visit-section">
      <h1>Members of {{ club.name }}</h1>
      <template v-if="member">
        <RouterLink :to="visitLink('members')">Back to members</RouterLink>
        <article class="visit-card"><h2>{{ member.name }}</h2><p>{{ member.role || 'Member' }}</p><p>{{ member.email || 'No email added' }}</p><p>{{ member.phone || 'No phone added' }}</p></article>
      </template>
      <template v-else>
        <label class="ref-search"><FlowIcon name="search" /><input v-model="search" type="search" placeholder="Search members" aria-label="Search this club's members" /></label>
        <RouterLink v-for="person in visibleMembers" :key="person.id" class="visit-card visit-member" :to="visitLink('members', { member: person.id })">
          <span><strong>{{ person.name || 'Club member' }}</strong><small>{{ person.role || 'Member' }}</small></span><span class="visit-link">View member <FlowIcon name="arrow-right" /></span>
        </RouterLink>
        <p v-if="!visibleMembers.length">{{ search ? 'No members match your search.' : 'No members have been added to this club.' }}</p>
      </template>
    </section>

    <section v-else-if="section === 'ladders'" class="visit-section">
      <h1>Ladders at {{ club.name }}</h1>
      <nav class="club-visit-nav" aria-label="Choose a ladder"><RouterLink v-for="item in ladders" :key="item.id" :to="visitLink('ladders', { ladder: item.id })" :aria-current="ladder?.id === item.id ? 'page' : undefined">{{ item.name }}</RouterLink></nav>
      <template v-if="ladder">
        <h2>{{ ladder.name }}</h2>
        <article v-for="person in ladderPlayers" :key="person.id" class="visit-card visit-member"><span>#{{ person.rank }} &nbsp; {{ person.name }}</span><small v-if="person.challengePaused">Paused</small></article>
        <p v-if="!ladderPlayers.length">No players on this ladder yet.</p>
        <details class="visit-card"><summary>Rules for {{ ladder.name }}</summary><p>Challenge up to {{ ladderRules.challengeRangeUp }} positions above.</p><dl><div v-for="row in scoring" :key="row.key"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div></dl></details>
      </template>
      <p v-else>No ladders have been added to this club.</p>
    </section>

    <section v-else-if="section === 'tournaments'" class="visit-section">
      <h1>Tournaments at {{ club.name }}</h1>
      <p v-if="loadingTournaments" role="status">Loading tournaments...</p>
      <p v-else-if="tournamentError" role="alert">{{ tournamentError }}</p>
      <template v-else-if="tournament">
        <RouterLink :to="visitLink('tournaments')">Back to tournaments</RouterLink>
        <article class="visit-card"><h2>{{ tournament.name }}</h2><p>{{ tournament.description }}</p><p>{{ tournament.startDate }} <template v-if="tournament.endDate">to {{ tournament.endDate }}</template></p><p>{{ tournament.venue?.name || tournament.location }}</p></article>
        <article v-for="event in tournament.categories || tournament.events || []" :key="event.id || event.name" class="visit-card"><h3>{{ event.name }}</h3><p>{{ event.status || event.format }}</p></article>
      </template>
      <template v-else>
        <RouterLink v-for="event in tournaments" :key="event.id" class="visit-card visit-member" :to="visitLink('tournaments', { tournament: event.id })"><strong>{{ event.name }}</strong><span class="visit-link">View tournament <FlowIcon name="arrow-right" /></span></RouterLink>
        <p v-if="!tournaments.length">No tournaments have been added to this club.</p>
      </template>
    </section>

    <section v-else-if="section === 'settings' && canManage" class="visit-section">
      <h1>Settings for {{ club.name }}</h1>
      <article class="visit-card"><h2>Club details</h2><dl><div><dt>Name</dt><dd>{{ club.name }}</dd></div><div><dt>Location</dt><dd>{{ workspace.location || 'Not set' }}</dd></div><div><dt>Time zone</dt><dd>{{ workspace.timezone || 'Not set' }}</dd></div></dl></article>
      <article class="visit-card"><h2>Courts</h2><p v-for="(court, index) in workspace.courts || []" :key="court.id || index">{{ court.name || court }}</p><p v-if="!workspace.courts?.length">No courts added.</p></article>
      <p>Switch to {{ club.name }} to manage its settings.</p>
    </section>
  </main>
</template>

<style scoped>
.club-visit--away { padding-top: 76px; }
.club-visit-banner { position: fixed; z-index: 45; top: var(--app-header-height); left: 50%; transform: translateX(-50%); width: max-content; max-width: 85vw; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 5px 14px; padding: 9px 14px; border: 1px solid var(--color-border); border-radius: 0 0 10px 10px; background: #f5faf6; color: var(--color-text-soft); box-shadow: 0 3px 12px rgba(15, 34, 24, .06); font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; }
.club-visit-banner > span { min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.club-visit-banner button { padding: 0; border: 0; background: transparent; color: var(--color-primary-strong); font: inherit; font-weight: 650; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.club-visit-banner button:disabled { opacity: .5; cursor: wait; }
.club-visit-nav { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; }
.club-visit-nav a { padding: 8px 11px; border: 1px solid var(--color-border); border-radius: 8px; color: var(--color-text-soft); font-size: 11px; text-decoration: none; }
.club-visit-nav a[aria-current='page'] { background: #edf7ef; border-color: var(--color-primary); color: var(--color-primary-strong); }
.visit-choice { grid-template-columns: 42px minmax(0, 1fr) auto; text-decoration: none; }
.visit-section { display: grid; gap: 14px; }
.visit-section h1 { margin: 0 0 8px; font-size: 22px; }
.visit-section h2 { font-size: 16px; }
.visit-card { padding: 16px; border: 1px solid var(--color-border); border-radius: 12px; background: #fff; color: var(--color-text); text-decoration: none; font-size: 12px; }
.visit-member { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.visit-member small { display: block; margin-top: 4px; color: var(--color-muted); }
.visit-link { display: inline-flex; align-items: center; gap: 6px; color: var(--color-primary-strong); font-weight: 600; }
.visit-link svg { width: 15px; height: 15px; }
.visit-card dl > div { display: grid; grid-template-columns: 95px minmax(0, 1fr); gap: 12px; padding: 7px 0; }
.visit-card dt { color: var(--color-muted); }
.visit-card dd { margin: 0; overflow-wrap: anywhere; }
@media (max-width: 767px) {
  .club-visit--away { padding-top: 112px; }
  .club-visit-banner { width: 85vw; font-size: 10px; }
  .visit-choice { grid-template-columns: 34px minmax(0, 1fr); }
  .visit-choice > .ref-button { grid-column: 2; justify-self: start; }
  .visit-member { align-items: flex-start; flex-direction: column; }
}
</style>
