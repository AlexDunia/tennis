<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import FlowIcon from '../components/friendly/FlowIcon.vue'
import { useAdminStore } from '../stores/admin'
import { useNotificationStore } from '../stores/notification'
import { useTournamentStore } from '../stores/tournament'
import { collectClubMembers } from '../utils/club/memberData.js'

const router = useRouter()
const adminStore = useAdminStore()
const tournamentStore = useTournamentStore()
const notificationStore = useNotificationStore()

const pageError = ref('')
const clubPicker = ref(null)
const switchingClubId = ref('')
const inviteOptionsOpen = ref(false)
const inviteMenuRoot = ref(null)
const clubSwitcherTrigger = ref(null)
const clubSwitcherVisible = ref(false)
const club = computed(() => adminStore.activeClub)
const setup = computed(() => club.value?.setup || null)
const workspace = computed(() => setup.value?.workspace || {})
const members = computed(() => collectClubMembers(setup.value || {}))
const activeLadders = computed(
  () => setup.value?.ladders?.filter((ladder) => ladder.enabled && !ladder.archived) || [],
)
const tournaments = computed(() =>
  tournamentStore.tournaments.filter(
    (tournament) => tournament.clubId && tournament.clubId === club.value?.id,
  ),
)
const canManage = computed(() => adminStore.hasActiveClubPermission('club.manage'))
const heroRoleLabel = computed(() => {
  const role = String(adminStore.activeClubRoleLabel || 'member').toLowerCase()
  return `You're ${['admin', 'owner'].includes(role) ? 'an' : 'a'} ${role}`
})
const pickerClubs = computed(() => adminStore.clubOptions.map((item) => { const record = adminStore.clubs.find((club) => club.id === item.id); return { ...item, city: record?.setup?.workspace?.city || record?.setup?.workspace?.location || 'Local courts' } }))

const manageGroups = computed(() => {
  const memberCount = members.value.length
  const ladderCount = activeLadders.value.length
  const tournamentCount = tournaments.value.length

  const groups = [
    {
      id: 'people',
      items: [
        {
          icon: 'users',
          title: 'Members',
          copy: `${memberCount} ${memberCount === 1 ? 'member' : 'members'} \u00b7 invite, import and manage people`,
          action: 'Open',
          to: { name: 'ClubMembers' },
        },
      ],
    },
    {
      id: 'competition',
      title: 'Competition',
      copy: 'Everything that controls how members compete.',
      items: [
        {
          icon: 'ladder',
          title: 'Ladders',
          copy: `${ladderCount} active \u00b7 positions, challenges and movement rules`,
          action: 'Open',
          to: { name: 'Rankings' },
        },
        {
          icon: 'trophy',
          title: 'Tournaments',
          copy: tournamentCount
            ? `${tournamentCount} active \u00b7 events, draws and results`
            : 'No active tournament \u00b7 events, draws and results',
          action: tournamentCount ? 'Open' : 'Create',
          to: { name: 'Tournaments' },
        },
      ],
    },
  ]

  groups.push({
    id: 'club',
    title: 'Club',
    copy: 'Shared information and scheduled activity for this club.',
    items: [
      {
        icon: 'calendar',
        title: 'Calendar',
        copy: 'Scheduled Ladder and Tournament matches',
        action: 'Open',
        to: { name: 'ClubCalendar' },
      },
    ],
  })

  if (canManage.value) {
    groups[0].items.push({
      icon: 'users',
      title: 'Access & roles',
      copy: 'Admins, co-admins and member permissions',
      action: 'Manage',
      to: { name: 'ClubMembers' },
    })
    groups[2].items.push({
      icon: 'home',
      title: 'Club details',
      copy: 'Name, location, logo and club appearance',
      action: 'Edit',
      to: { name: 'Settings' },
    })
  }

  return groups
})

function open(to) {
  router.push(to)
}

function clubInitials(name) { return String(name || 'Club').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() }
function roleCopy(role) { const value = String(role || '').toLowerCase(); return ['admin', 'co-admin', 'owner'].includes(value) ? 'You run this one' : value === 'captain' ? "You're the captain" : 'You play here' }
function openClubPicker() { pageError.value = ''; clubPicker.value?.showModal() }
function closeClubPicker() { if (!switchingClubId.value) clubPicker.value?.close() }
async function switchClub(clubId) { if (!clubId || clubId === adminStore.activeClubId) return closeClubPicker(); switchingClubId.value = clubId; try { await adminStore.switchClub(clubId); await tournamentStore.fetchTournaments(); clubPicker.value?.close(); notificationStore.addToast({ message: (club.value?.name || 'That club') + ' is now in play.', type: 'success' }) } catch (cause) { pageError.value = cause?.message || 'That club would not switch just now. Try another swing.' } finally { switchingClubId.value = '' } }
function openClubFlow(view) { closeClubPicker(); router.push({ name: 'Clubs', query: { view } }) }
function openHeroInvite(option) {
  inviteOptionsOpen.value = false

  const routes = {
    invite: { name: 'ClubMembers', query: { invite: '1' } },
    import: { name: 'ClubMemberImport' },
    manual: { name: 'ClubMemberManual' },
  }

  router.push(routes[option])
}

function dismissInviteOptionsOnOutsidePointer(event) {
  if (!inviteOptionsOpen.value) return
  if (!inviteMenuRoot.value?.contains(event.target)) {
    inviteOptionsOpen.value = false
  }
}

function setClubSwitcherTrigger(element) {
  if (element) clubSwitcherTrigger.value = element
}

function syncClubSwitcher() {
  const trigger = clubSwitcherTrigger.value
  const headerHeight = document.querySelector('.app-header')?.getBoundingClientRect().height || 76
  clubSwitcherVisible.value = Boolean(trigger && trigger.getBoundingClientRect().top <= headerHeight)
}

onMounted(async () => {
  pageError.value = ''

  try {
    await adminStore.loadClubs()
    if (adminStore.activeClub) await tournamentStore.fetchTournaments()
  } catch (error) {
    pageError.value = error?.message || 'We could not open this club.'
  } finally {
    await nextTick()
    syncClubSwitcher()
    window.addEventListener('scroll', syncClubSwitcher, { passive: true })
    window.addEventListener('resize', syncClubSwitcher)
    document.addEventListener('pointerdown', dismissInviteOptionsOnOutsidePointer)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', syncClubSwitcher)
  window.removeEventListener('resize', syncClubSwitcher)
  document.removeEventListener('pointerdown', dismissInviteOptionsOnOutsidePointer)
})

</script>

<template>
  <main class="gorra-club-ref ref-page">
    <p v-if="pageError" class="ref-inline-alert" role="alert">{{ pageError }}</p>

    <section v-if="club" class="club-profile">
      <section class="club-signature-hero" :aria-label="club.name">
        <div class="club-signature-hero__main">
          <div class="club-signature-hero__photo-frame">
            <div class="club-signature-hero__photo">
              <img v-if="workspace.logoUrl" :src="workspace.logoUrl" :alt="club.name" />
              <span v-else>{{ clubInitials(club.name) }}</span>
            </div>

            <button
              v-if="canManage"
              class="club-signature-hero__photo-edit"
              type="button"
              aria-label="Edit club appearance"
              @click="router.push({ name: 'Settings' })"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 16.5V20h3.5L18.8 8.7l-3.5-3.5L4 16.5Z" />
                <path d="m13.8 6.7 3.5 3.5" />
              </svg>
            </button>
          </div>

          <div class="club-signature-hero__copy">
            <h1>{{ club.name }}</h1>
            <p class="club-signature-hero__lead">
              Everything that keeps the club moving, in one place.
            </p>

            <div class="club-signature-hero__meta">
              <span>{{ workspace.location || 'Location not added yet' }}</span>
              <i aria-hidden="true"></i>
              <span>{{ heroRoleLabel }}</span>
            </div>
          </div>

          <div v-if="canManage" class="club-signature-hero__actions">
            <div ref="inviteMenuRoot" class="club-invite-menu">
              <button
                class="ref-button primary"
                type="button"
                aria-haspopup="menu"
                :aria-expanded="inviteOptionsOpen"
                @click.stop="inviteOptionsOpen = !inviteOptionsOpen"
              >
                Invite member
              </button>
              <div v-if="inviteOptionsOpen" class="club-invite-menu__panel" role="menu" @click.stop>
                <button type="button" role="menuitem" @click="openHeroInvite('invite')">
                  <FlowIcon name="send" aria-hidden="true" />
                  <span><strong>Invite people</strong><small>Send a club invitation</small></span>
                </button>
                <button type="button" role="menuitem" @click="openHeroInvite('import')">
                  <FlowIcon name="upload" aria-hidden="true" />
                  <span><strong>Import members</strong><small>Bring in an existing list</small></span>
                </button>
                <button type="button" role="menuitem" @click="openHeroInvite('manual')">
                  <FlowIcon name="plus" aria-hidden="true" />
                  <span><strong>Add manually</strong><small>Create one member record</small></span>
                </button>
              </div>
            </div>
            <button class="ref-button" type="button" @click="openClubPicker">Change club</button>
          </div>
        </div>

        <div class="club-signature-hero__rail" aria-label="Club at a glance">
          <RouterLink :to="{ name: 'ClubMembers' }">
            <strong>{{ members.length }}</strong>
            <span>Members</span>
          </RouterLink>
          <RouterLink :to="{ name: 'Rankings' }">
            <strong>{{ activeLadders.length }}</strong>
            <span>Active ladders</span>
          </RouterLink>
          <RouterLink :to="{ name: 'Tournaments' }">
            <strong>{{ tournaments.length || '\u2014' }}</strong>
            <span>{{ tournaments.length ? 'Active tournaments' : 'No tournament running' }}</span>
          </RouterLink>
          <RouterLink :to="{ name: 'Settings', query: { section: 'members' } }">
            <strong>{{ adminStore.activeClubRoleLabel || 'Member' }}</strong>
            <span>Your access</span>
          </RouterLink>
        </div>
      </section>

      <section class="ref-club-manage">
        <header class="ref-section-heading club-profile__section-heading">
          <h2>{{ canManage ? 'Manage your club' : 'Your club' }}</h2>

          <p>
            Everything that keeps {{ club.name }} moving, in one place.
          </p>
        </header>

        <div class="club-profile__manage-groups">
          <template v-for="group in manageGroups" :key="group.id">
            <section
              :ref="group.id === 'people' ? setClubSwitcherTrigger : undefined"
              class="club-profile__manage-group"
              :aria-label="group.id === 'people' ? 'Members' : undefined"
              :aria-labelledby="group.id === 'people' ? undefined : `${group.id}-management-title`"
            >
            <header v-if="group.id !== 'people'" class="club-profile__group-heading">
              <h3 :id="`${group.id}-management-title`">{{ group.title }}</h3>
              <p>{{ group.copy }}</p>
            </header>

            <div class="ref-choice-stack">
              <template v-for="item in group.items" :key="item.title">
                <button
                  v-if="item.appearance"
                  class="ref-choice-row"
                  type="button"
                  :aria-label="`${item.action} ${item.title.toLowerCase()} for ${club.name}`"
                  @click="router.push({ name: 'Settings' })"
                >
                  <span class="ref-feature-icon" aria-hidden="true">
                    <FlowIcon :name="item.icon" />
                  </span>

                  <span class="ref-choice-row-copy">
                    <strong>{{ item.title }}</strong>
                    <span>{{ item.copy }}</span>
                  </span>

                  <FlowIcon name="arrow-right" aria-hidden="true" />
                </button>

                <RouterLink
                  v-else
                  class="ref-choice-row"
                  :to="item.to"
                  :aria-label="`${item.action} ${item.title.toLowerCase()} for ${club.name}`"
                >
                  <span class="ref-feature-icon" aria-hidden="true">
                    <FlowIcon :name="item.icon" />
                  </span>

                  <span class="ref-choice-row-copy">
                    <strong>{{ item.title }}</strong>
                    <span>{{ item.copy }}</span>
                  </span>

                  <FlowIcon name="arrow-right" aria-hidden="true" />
                </RouterLink>
              </template>
              </div>
            </section>

            <section v-if="group.id === 'people'" v-show="clubSwitcherVisible" class="club-profile__switch" aria-label="Active club">
              <div class="club-profile__switch-inner">
                <p>You're playing out of <strong>{{ club.name }}</strong></p>
                <button class="ref-button" type="button" @click="openClubPicker">Change club</button>
              </div>
            </section>
          </template>
        </div>
      </section>
    </section>

    <dialog ref="clubPicker" class="club-picker" aria-labelledby="club-picker-title" @click.self="closeClubPicker">
      <section class="club-picker__sheet">
        <header><div><h2 id="club-picker-title">Your clubs</h2><p>Pick the one you are playing in today.</p></div><button type="button" aria-label="Close your clubs" @click="closeClubPicker"><FlowIcon name="close" /></button></header>
        <div class="club-picker__actions"><button class="club-picker__action club-picker__action--start" type="button" @click="openClubFlow('create')"><span><strong>Start a new club</strong><small>Be the one who runs the ladder.</small></span><FlowIcon name="arrow-right" /></button><button class="club-picker__action club-picker__action--join" type="button" @click="openClubFlow('join')"><span><strong>Join with an invite</strong><small>Got a code from a club? Bring it here.</small></span><FlowIcon name="arrow-right" /></button></div>
        <div class="club-picker__list"><p>Your clubs</p><button v-for="item in pickerClubs" :key="item.id" type="button" :class="{ 'club-picker__club--active': item.id === adminStore.activeClubId }" :disabled="Boolean(switchingClubId)" @click="switchClub(item.id)"><b>{{ clubInitials(item.name) }}</b><span><strong>{{ item.name }}</strong><small>{{ item.city }} � {{ roleCopy(item.role) }}</small></span><FlowIcon v-if="item.id === adminStore.activeClubId" name="check" /></button></div>
      </section>
    </dialog>
    <section v-if="!club" class="ref-page-narrow">
      <div class="ref-flow-head">
        <p class="ref-kicker">Club</p>
        <h1>No active club</h1>
        <p>Choose a club to continue.</p>
      </div>

      <button
        class="ref-button primary"
        type="button"
        @click="open({ name: 'Clubs' })"
      >
        Open your clubs
      </button>
    </section>
  </main>
</template>

<style scoped>
.club-profile__switch { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 18px; border-bottom: 1px solid var(--g-line, #e4e9e5); }
.club-profile__switch p { margin: 0; color: var(--g-muted, #778079); font-size: 13px; }
.club-profile__switch strong { color: var(--g-ink, #28332c); }

.club-signature-hero {
  display: grid;
  gap: 30px;
  padding: 18px 0 34px;
  border-bottom: 1px solid rgba(22, 61, 43, 0.08);
}

.club-signature-hero__main {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) auto;
  align-items: center;
  gap: 22px;
}

.club-signature-hero__photo-frame {
  position: relative;
  width: 92px;
  height: 92px;
  padding: 4px;
  border: 1px solid rgba(22, 61, 43, 0.1);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 22px rgba(22, 61, 43, 0.045);
}

.club-signature-hero__photo {
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  overflow: hidden;
  place-items: center;
  border-radius: 8px;
  background: #163d2b;
  color: #fff;
  isolation: isolate;
}

.club-signature-hero__photo::before,
.club-signature-hero__photo::after {
  position: absolute;
  z-index: 1;
  inset: 15px;
  border: 1px solid rgba(255, 255, 255, 0.48);
  content: '';
}

.club-signature-hero__photo::after {
  inset: 15px 36px;
  border-width: 0 1px;
}

.club-signature-hero__photo img {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.club-signature-hero__photo span {
  position: relative;
  z-index: 2;
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.68);
  border-radius: 4px;
  background: rgba(14, 52, 35, 0.92);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.club-signature-hero__photo-edit {
  position: absolute;
  z-index: 3;
  right: -6px;
  bottom: -6px;
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  padding: 0;
  border: 1px solid rgba(22, 61, 43, 0.1);
  border-radius: 8px;
  background: #fff;
  color: #526057;
  box-shadow: 0 4px 12px rgba(22, 61, 43, 0.08);
}

.club-signature-hero__photo-edit svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.club-signature-hero__copy {
  min-width: 0;
}

.club-signature-hero__eyebrow {
  margin: 0 0 9px;
  color: var(--g-green-strong, #067d20);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.club-signature-hero h1 {
  max-width: 760px;
  margin: 0;
  color: var(--g-ink, #28332c);
  font-size: clamp(30px, 3.6vw, 44px);
  font-weight: 600;
  letter-spacing: -0.048em;
  line-height: 1.04;
}

.club-signature-hero__lead {
  max-width: 560px;
  margin: 12px 0 0;
  color: var(--g-ink-2, #465149);
  font-size: 14px;
  line-height: 1.55;
}

.club-signature-hero__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  color: var(--g-muted, #7d8780);
  font-size: 11px;
  line-height: 1.4;
}

.club-signature-hero__meta i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #bcc5be;
}

.club-signature-hero__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.club-signature-hero__rail {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.club-signature-hero__rail a {
  display: grid;
  min-height: 84px;
  align-content: center;
  gap: 4px;
  padding: 16px 18px;
  border: 1px solid var(--g-line, #e4e9e5);
  border-radius: 12px;
  background: #fff;
  color: inherit;
  text-decoration: none;
  transition: border-color 140ms ease, background-color 140ms ease;
}

.club-signature-hero__rail strong {
  color: var(--g-ink, #28332c);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.15;
}

.club-signature-hero__rail span {
  color: var(--g-muted, #7d8780);
  font-size: 10px;
  line-height: 1.35;
}

.club-signature-hero__rail a:last-child strong {
  font-size: 13px;
  letter-spacing: 0;
}

@media (hover: hover) and (pointer: fine) {
  .club-signature-hero__photo-edit:hover {
    background: #f7faf8;
  }

  .club-signature-hero__rail a:hover {
    border-color: rgba(22, 61, 43, 0.18);
    background: #fbfcfb;
  }
}

@media (max-width: 900px) {
  .club-signature-hero__main {
    grid-template-columns: 88px minmax(0, 1fr);
    align-items: start;
  }

  .club-signature-hero__photo-frame {
    width: 84px;
    height: 84px;
  }

  .club-signature-hero__actions {
    grid-column: 2;
    margin-top: -4px;
  }
}

@media (max-width: 760px) {
  .club-signature-hero {
    gap: 25px;
    padding: 8px 0 28px;
  }

  .club-signature-hero__main {
    grid-template-columns: 74px minmax(0, 1fr);
    gap: 16px;
  }

  .club-signature-hero__photo-frame {
    width: 72px;
    height: 72px;
    padding: 3px;
    border-radius: 9px;
  }

  .club-signature-hero__photo {
    border-radius: 6px;
  }

  .club-signature-hero__photo::before {
    inset: 12px;
  }

  .club-signature-hero__photo::after {
    inset: 12px 29px;
  }

  .club-signature-hero__photo span {
    width: 34px;
    height: 34px;
    font-size: 11px;
  }

  .club-signature-hero h1 {
    font-size: 34px;
  }

  .club-signature-hero__lead {
    margin-top: 10px;
    font-size: 13px;
  }

  .club-signature-hero__actions {
    grid-column: 1 / -1;
    width: 100%;
    margin-top: 2px;
  }

  .club-signature-hero__actions .ref-button {
    flex: 1;
  }

  .club-signature-hero__rail {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .club-signature-hero__rail a {
    min-height: 76px;
    padding: 14px 16px;
  }
}

@media (max-width: 430px) {
  .club-signature-hero h1 {
    font-size: 31px;
  }

  .club-signature-hero__main {
    grid-template-columns: 66px minmax(0, 1fr);
    gap: 14px;
  }

  .club-signature-hero__photo-frame {
    width: 64px;
    height: 64px;
  }

  .club-signature-hero__photo::before {
    inset: 10px;
  }

  .club-signature-hero__photo::after {
    inset: 10px 25px;
  }

  .club-signature-hero__photo span {
    width: 30px;
    height: 30px;
  }

  .club-signature-hero__rail {
    grid-template-columns: 1fr;
  }

  .club-signature-hero__rail a {
    min-height: 62px;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 12px;
  }

  .club-signature-hero__rail strong {
    min-width: 42px;
  }
}

.club-profile {
  display: grid;
  gap: 34px;
  padding-bottom: 42px;
}

.club-profile__section-heading {
  display: grid;
  gap: 4px;
  margin: 0 0 13px;
  padding: 0;
  border: 0;
}

.club-profile__section-heading::after {
  display: none;
}

.club-profile__section-heading h2 {
  margin: 0;
  color: var(--g-ink, #28332c);
  font-size: 18px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.015em;
  line-height: 1.35;
}

.club-profile__section-heading p {
  margin: 0;
  color: var(--g-muted, #778079);
  font-size: 13px;
  line-height: 1.5;
}

.club-profile__manage-groups {
  display: grid;
  gap: 46px;
}

.club-profile__manage-group {
  padding-top: 0;
  border-top: 0;
}

.club-profile__manage-group + .club-profile__manage-group {
  padding-top: 36px;
  border-top: 1px solid rgba(22, 61, 43, 0.08);
}

.club-profile__group-heading {
  margin: 0 0 22px;
}

.club-profile__group-heading h3 {
  margin: 0;
  color: var(--g-ink, #28332c);
  font-size: 16px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.015em;
  line-height: 1.35;
}

.club-profile__group-heading p {
  margin: 4px 0 0;
  color: var(--g-muted, #778079);
  font-size: 13px;
  line-height: 1.5;
}

/* Active Club navigation is allowed to use the desktop width.
   The /clubs DIRECTORY remains stacked; this is a different surface. */
.club-profile .ref-choice-stack {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.club-profile .ref-choice-row {
  display: grid;
  min-width: 0;
  min-height: 112px;
  grid-template-columns: 42px minmax(0, 1fr) 30px;
  align-items: center;
  gap: 14px;
  padding: 22px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  margin-block: 2px;
  background: #f5f8f6;
  box-shadow: none;
  text-align: left;
  transform: translateZ(0);
  transition:
    background-color 160ms ease,
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1);
}

.club-profile .ref-choice-row:nth-child(1) {
  background: #eef7f0;
}

.club-profile .ref-choice-row + .ref-choice-row {
  border-top: 1px solid var(--color-border);
}

.club-profile .ref-feature-icon {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 12px;
  background: rgba(8, 173, 43, 0.075);
  color: #078c2f;
}

.club-profile .ref-feature-icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.club-profile .ref-choice-row-copy {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.club-profile .ref-choice-row-copy strong {
  color: var(--g-ink, #28332c);
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.35;
}

.club-profile .ref-choice-row-copy > span {
  color: var(--g-muted, #778079);
  font-size: 12px;
  line-height: 1.5;
}

.club-profile .ref-choice-row-copy small {
  margin-top: 3px;
  color: #078c2f;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
}

.club-profile .ref-choice-row > .flow-icon {
  width: 15px;
  height: 15px;
  justify-self: end;
  color: #7b877f;
  transition:
    color 150ms ease,
    transform 180ms cubic-bezier(0.23, 1, 0.32, 1);
}

@media (hover: hover) and (pointer: fine) {
  .club-profile .ref-choice-row:hover {
    background: #edf5ef;
    box-shadow: none;
    transform: translateZ(0);
  }

  .club-profile .ref-choice-row:hover > .flow-icon {
    color: #163d2b;
    transform: translateX(2px);
  }
}

.club-profile .ref-choice-row:active {
  transform: scale(0.988) translateZ(0);
}
@media (max-width: 760px) {
  .club-profile__switch { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 18px; border-bottom: 1px solid var(--g-line, #e4e9e5); }
.club-profile__switch p { margin: 0; color: var(--g-muted, #778079); font-size: 13px; }
.club-profile__switch strong { color: var(--g-ink, #28332c); }

.club-profile {
    gap: 27px;
  }

  .club-profile__manage-groups {
    gap: 38px;
  }

  .club-profile__manage-group {
    padding-top: 0;
  }

  .club-profile__manage-group + .club-profile__manage-group {
    padding-top: 28px;
  }

  .club-profile .ref-choice-stack {
    grid-template-columns: 1fr;
    gap: 24px;
    }

  .club-profile .ref-choice-row {
    min-height: 104px;
    grid-template-columns: 38px minmax(0, 1fr) 28px;
    padding: 18px;
  }

  .club-profile .ref-feature-icon {
    width: 38px;
    height: 38px;
    border-radius: 11px;
  }
}

@media (max-width: 620px) {
  .club-appearance-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .club-appearance-actions .ref-button {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .club-profile .ref-choice-row,
  .club-profile .ref-choice-row > .flow-icon {
    transition:
      background-color 120ms ease,
      color 120ms ease;
    transform: none !important;
  }
}

/* Gorra card hover colors. */
@media (hover: hover) and (pointer: fine) {
  .club-profile .ref-choice-row:hover:not(:disabled) {
    border-color: #163d2b;
    background: #163d2b;
    color: #fff;
  }

  .club-profile .ref-choice-row:hover:not(:disabled) .ref-choice-row-copy strong,
  .club-profile .ref-choice-row:hover:not(:disabled) .ref-choice-row-copy > span {
    color: #fff;
  }

  .club-profile .ref-choice-row:hover:not(:disabled) .ref-choice-row-copy small,
  .club-profile .ref-choice-row:hover:not(:disabled) > .flow-icon {
    color: #d8ff47;
  }

  .club-profile .ref-choice-row:hover:not(:disabled) .ref-feature-icon {
    background: rgba(216, 255, 71, 0.12);
    color: #d8ff47;
  }
}
.club-profile .ref-choice-row { text-decoration: none; }
.gorra-club-ref.ref-page { padding-top: 8px; padding-bottom: 22px; }
.club-profile__switch { position: sticky; top: var(--app-header-height, 76px); z-index: 12; margin-inline: calc(50% - 50vw); padding: 12px max(20px, calc((100vw - var(--app-header-content-width, 1100px)) / 2)); background: var(--color-bg, #fff); transition: background-color 160ms ease, color 160ms ease; }
.club-profile__switch--stuck { background: #163d2b; color: #fff; box-shadow: 0 8px 18px rgba(10, 36, 23, .12); }
.club-profile__switch--stuck p, .club-profile__switch--stuck strong { color: #fff; }.club-profile__switch--stuck strong { text-decoration: underline; text-decoration-color: #d8ff47; text-underline-offset: 3px; }.club-profile__switch--stuck .ref-button { border-color: #d8ff47; color: #163d2b; background: #d8ff47; }
.club-picker { width: min(480px, 100vw); height: 100%; max-height: none; margin: 0 0 0 auto; padding: 0; border: 0; background: transparent; }.club-picker::backdrop { background: rgba(18, 32, 23, .32); }.club-picker__sheet { display: grid; height: 100%; grid-template-rows: auto auto 1fr; background: #fff; box-shadow: -16px 0 44px rgba(13,38,23,.14); }.club-picker header { display: flex; justify-content: space-between; gap: 16px; padding: 28px; border-bottom: 1px solid var(--g-line, #e4e9e5); }.club-picker h2, .club-picker p { margin: 0; }.club-picker header p { margin-top: 5px; color: var(--g-muted,#778079); font-size: 13px; }.club-picker header button { width: 38px; height: 38px; border: 1px solid var(--g-line,#e4e9e5); border-radius: 10px; background: #fff; }.club-picker__actions { display: grid; padding: 12px 18px; border-bottom: 1px solid var(--g-line,#e4e9e5); }.club-picker__actions button { display: grid; grid-template-columns: 1fr 20px; align-items: center; gap: 12px; padding: 14px 4px; border: 0; color: inherit; background: transparent; text-align: left; }.club-picker__actions button + button { border-top: 1px solid var(--g-line,#e4e9e5); }.club-picker__actions span, .club-picker__list span { display: grid; gap: 3px; }.club-picker small { color: var(--g-muted,#778079); font-size: 11px; }.club-picker__list { display: grid; align-content: start; gap: 6px; padding: 18px; overflow: auto; }.club-picker__list > p { color: var(--g-muted,#778079); font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }.club-picker__list button { display: grid; grid-template-columns: 46px 1fr auto; align-items: center; gap: 12px; min-height: 70px; padding: 10px; border: 0; border-radius: 12px; color: inherit; background: transparent; text-align: left; }.club-picker__list button:hover { background: #f2f7f3; }.club-picker__list b { display: grid; width: 46px; height: 46px; place-items: center; border-radius: 13px; color: #25703e; background: #e8f1e9; font-size: 13px; }/* Compact, fixed Club picker aligned to the authenticated app scale. */
.club-picker { position: fixed; inset: 0 0 0 auto; z-index: 1000; width: min(410px, 100vw); height: 100dvh; margin: 0; }
.club-picker__sheet { position: relative; z-index: 1001; }
.club-picker header { align-items: flex-start; gap: 12px; padding: 18px 20px 15px; }
.club-picker h2 { font-size: 18px; font-weight: var(--font-weight-semibold, 600); line-height: 1.25; letter-spacing: -0.02em; }
.club-picker header p { margin-top: 3px; font-size: 11px; line-height: 1.45; }
.club-picker header button { width: 32px; height: 32px; min-height: 32px; border-radius: 9px; }
.club-picker header button :deep(svg) { width: 15px; height: 15px; }
.club-picker__actions { padding: 8px 14px; }
.club-picker__actions button { gap: 10px; padding: 10px 6px; }
.club-picker__actions strong, .club-picker__list strong { font-size: 12px; font-weight: var(--font-weight-semibold, 600); line-height: 1.35; }
.club-picker small { font-size: 10px; line-height: 1.35; }
.club-picker__list { gap: 3px; padding: 12px 14px 18px; }
.club-picker__list > p { margin: 4px 6px 6px; font-size: 9px; }
.club-picker__list button { grid-template-columns: 38px minmax(0, 1fr) 18px; gap: 10px; min-height: 58px; padding: 8px 6px; border-radius: 10px; }
.club-picker__list b { width: 38px; height: 38px; border-radius: 10px; font-size: 11px; }
.club-picker__list button :deep(.flow-icon) { width: 16px; height: 16px; }.club-picker__actions { gap: 8px; padding: 14px; }
.club-picker__actions .club-picker__action { min-height: 64px; padding: 12px; border: 1px solid transparent; border-radius: 11px; transition: background-color 150ms ease, border-color 150ms ease, transform 150ms ease; }
.club-picker__actions .club-picker__action + .club-picker__action { border-top: 1px solid var(--g-line, #e4e9e5); }
.club-picker__action--start { color: #fff !important; background: #163d2b !important; border-color: #163d2b !important; }
.club-picker__action--start strong { color: #fff; }.club-picker__action--start small { color: rgba(255,255,255,.68); }.club-picker__action--start :deep(.flow-icon) { color: #d8ff47; }
.club-picker__action--join { background: #f1f4f2 !important; border-color: #e1e7e2 !important; color: #415046; }.club-picker__action--join strong { color: #2f4035; }.club-picker__action--join small { color: #728077; }
.club-picker__club--active { background: rgba(8, 173, 43, .10) !important; }.club-picker__club--active:hover { background: rgba(8, 173, 43, .14) !important; }.club-picker__club--active b { background: rgba(8, 173, 43, .16); color: #087c29; }.club-picker__club--active :deep(.flow-icon) { color: #087c29; }
/* Keep the active-club context available throughout the Club workspace. */
.club-profile__switch-slot { min-height: 64px; }
.club-profile__switch {
  position: fixed;
  z-index: 24;
  top: var(--app-header-height, 76px);
  right: 0;
  left: 0;
  min-height: 64px;
  margin: 0;
  padding: 12px max(20px, calc((100vw - var(--app-header-content-width, 1100px)) / 2));
  border-bottom: 1px solid var(--g-line, #e4e9e5);
  background: var(--color-bg, #fff);
  box-shadow: 0 6px 16px rgba(10, 36, 23, .045);
}
@media (max-width: 520px) {
  .club-profile__switch-slot { min-height: 62px; }
  .club-profile__switch { min-height: 62px; padding-inline: 16px; }
  .club-profile__switch p { font-size: 12px; }
}

/* The active-club bar starts in management context, after access and roles. */
.club-profile__switch-slot {
  display: none;
}

.club-profile__switch {
  position: sticky;
  z-index: 24;
  top: var(--app-header-height, 76px);
  min-height: 64px;
  margin: 0 calc(50% - 50vw);
  padding: 0;
  border: 0;
  background: #163d2b;
  box-shadow: 0 8px 18px rgba(10, 36, 23, 0.14);
}

.club-profile__switch-inner {
  display: flex;
  width: var(--app-header-content-width);
  min-height: 64px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 0 auto;
}

.club-profile__switch p,
.club-profile__switch strong {
  color: #fff;
}

.club-profile__switch p {
  margin: 0;
  font-size: 13px;
}

.club-profile__switch strong {
  text-decoration: underline;
  text-decoration-color: #d8ff47;
  text-underline-offset: 3px;
}

.club-profile__switch .ref-button {
  border-color: #d8ff47;
  background: #d8ff47;
  color: #163d2b;
}

.club-invite-menu {
  position: relative;
}

.club-invite-menu > .ref-button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}


.club-invite-menu__panel {
  position: absolute;
  z-index: 30;
  top: calc(100% + 8px);
  right: 0;
  display: grid;
  width: 260px;
  padding: 7px;
  border: 1px solid var(--g-line, #e4e9e5);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 14px 32px rgba(13, 38, 23, 0.16);
}

.club-invite-menu__panel button {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #2f4035;
  text-align: left;
}

.club-invite-menu__panel button:hover {
  background: #f1f6f2;
}

.club-invite-menu__panel span {
  display: grid;
  gap: 2px;
}

.club-invite-menu__panel strong {
  font-size: 12px;
  font-weight: var(--font-weight-semibold, 600);
}

.club-invite-menu__panel small {
  color: var(--g-muted, #778079);
  font-size: 10px;
}

.club-invite-menu__panel :deep(.flow-icon) {
  width: 16px;
  height: 16px;
  color: #078c2f;
}

@media (max-width: 760px) {
  .club-profile__switch,
  .club-profile__switch-inner {
    min-height: 62px;
  }

  .club-profile__switch p {
    font-size: 12px;
  }

  .club-invite-menu,
  .club-invite-menu > .ref-button {
    width: 100%;
  }

  .club-invite-menu__panel {
    right: auto;
    left: 0;
    width: min(280px, calc(100vw - 32px));
  }
}
/* Fixed only after the people section reaches the global header. */
.club-profile__switch {
  position: fixed;
  z-index: 39;
  top: var(--app-header-height, 76px);
  right: 0;
  left: var(--app-sidebar-width, 0px);
  min-height: 64px;
  margin: 0;
  padding: 0;
  border: 0;
  background: #163d2b;
  box-shadow: 0 8px 18px rgba(10, 36, 23, 0.14);
}

.club-profile__switch-inner {
  width: 90%;
  max-width: none;
  margin-inline: auto;
}

@media (max-width: 800px) {
  .club-profile__switch {
    left: 0;
  }

  .club-profile__switch-inner {
    width: var(--app-shell-content-width);
  }
}</style>

