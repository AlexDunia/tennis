<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import FlowIcon from '../components/friendly/FlowIcon.vue'
import ClubIdentityHero from '../components/club/ClubIdentityHero.vue'
import ClubMediaEditor from '../components/club/ClubMediaEditor.vue'
import { useShellNestedHeader } from '../composables/useShellNestedHeader.js'
import { useAdminStore } from '../stores/admin'
import { useNotificationStore } from '../stores/notification'
import { useTournamentStore } from '../stores/tournament'
import { collectClubMembers } from '../utils/club/memberData.js'
import { DEFAULT_CLUB_COVER_PRESET } from '../utils/club/clubMedia.js'

const router = useRouter()
const adminStore = useAdminStore()
const tournamentStore = useTournamentStore()
const notificationStore = useNotificationStore()

const appearanceDialog = ref(null)
const pageError = ref('')
const appearanceBusy = ref(false)
const clubPicker = ref(null)
const switchingClubId = ref('')
const switchLine = ref(null)
const switchLineStuck = ref(false)

const appearanceDraft = reactive({
  logoUrl: '',
  coverUrl: '',
  coverPreset: DEFAULT_CLUB_COVER_PRESET,
})

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
const pickerClubs = computed(() => adminStore.clubOptions.map((item) => { const record = adminStore.clubs.find((club) => club.id === item.id); return { ...item, city: record?.setup?.workspace?.city || record?.setup?.workspace?.location || 'Local courts' } }))

const manageItems = computed(() => {
  const items = [
    {
      icon: 'users',
      title: 'Members',
      copy: 'Invite, import and manage your people.',
      action: 'Open members',
      to: { name: 'ClubMembers' },
    },
    {
      icon: 'ladder',
      title: 'Ladders',
      copy: 'Positions, rules, challenges and activity.',
      action: 'Open ladders',
      to: { name: 'Rankings' },
    },
    {
      icon: 'trophy',
      title: 'Tournaments',
      copy: 'Events, draws, fixtures and results.',
      action: 'Open tournaments',
      to: { name: 'Tournaments' },
    },
  ]

  if (canManage.value) {
    items.push({
      icon: 'sliders',
      title: 'Club settings',
      copy: 'Club, people, play defaults and courts.',
      action: 'Open settings',
      to: { name: 'ClubSettingsHub' },
    })
  }

  return items
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
function updateStickyState() { const top = switchLine.value?.getBoundingClientRect().top; switchLineStuck.value = Boolean(top !== undefined && top <= 78) }function openAppearance() {
  if (!canManage.value || appearanceBusy.value) return

  Object.assign(appearanceDraft, {
    logoUrl: workspace.value.logoUrl || '',
    coverUrl: workspace.value.coverUrl || '',
    coverPreset: workspace.value.coverPreset || DEFAULT_CLUB_COVER_PRESET,
  })

  pageError.value = ''
  appearanceDialog.value?.showModal()
}

function closeAppearance() {
  if (appearanceBusy.value) return
  appearanceDialog.value?.close()
}

async function saveAppearance() {
  if (!canManage.value || appearanceBusy.value) return

  appearanceBusy.value = true
  pageError.value = ''

  try {
    await adminStore.updateActiveClub({
      workspace: {
        ...workspace.value,
        logoUrl: appearanceDraft.logoUrl,
        coverUrl: appearanceDraft.coverUrl,
        coverPreset: appearanceDraft.coverPreset,
      },
    })

    notificationStore.addToast({
      message: 'Club appearance updated.',
      type: 'success',
    })

    appearanceDialog.value?.close()
  } catch (error) {
    pageError.value = error?.message || 'We could not update the club appearance.'
  } finally {
    appearanceBusy.value = false
  }
}

onMounted(async () => {
  window.addEventListener('scroll', updateStickyState, { passive: true })
  window.addEventListener('scroll', updateStickyState, { passive: true })
  pageError.value = ''

  try {
    await adminStore.loadClubs()
    if (!adminStore.activeClub) return
    await tournamentStore.fetchTournaments()
  } catch (error) {
    pageError.value = error?.message || 'We could not open this club.'
  }
})

useShellNestedHeader(() => ({
  label: club.value?.name || 'Club',
  backLabel: 'Back',
  back: () => router.back(),
  crumbs: [
    { label: 'Club' },
    { label: club.value?.name || 'Current club' },
  ],
}))
</script>

<template>
  <main class="gorra-club-ref ref-page">
    <p v-if="pageError" class="ref-inline-alert" role="alert">{{ pageError }}</p>

    <section v-if="club" class="club-profile">
      <div ref="switchLine" class="club-profile__switch" :class="{ 'club-profile__switch--stuck': switchLineStuck }"><p>You're playing out of <strong>{{ club.name }}</strong></p><button class="ref-button" type="button" @click="openClubPicker">Change club</button></div>
      <ClubIdentityHero
        :name="club.name"
        :location="workspace.location || ''"
        :role-label="`${adminStore.activeClubRoleLabel} in this club`"
        :logo-url="workspace.logoUrl || ''"
        :cover-url="workspace.coverUrl || ''"
        :cover-preset="workspace.coverPreset || DEFAULT_CLUB_COVER_PRESET"
        :member-count="members.length"
        :ladder-count="activeLadders.length"
        :tournament-count="tournaments.length"
        :editable="canManage"
        @edit-appearance="openAppearance"
      />

      <section class="ref-club-manage">
        <header class="ref-section-heading club-profile__section-heading">
          <h2>
            {{
              canManage
                ? 'Manage your club'
                : 'Your club'
            }}
          </h2>

          <p>
            Members, ladders and tournaments in {{ club.name }}.
          </p>
        </header>

        <div class="ref-choice-stack">
          <RouterLink
            v-for="item in manageItems"
            :key="item.title"
            class="ref-choice-row"
            :to="item.to"
            :aria-label="`${item.action} for ${club.name}`"
          >
            <span class="ref-feature-icon" aria-hidden="true">
              <FlowIcon :name="item.icon" />
            </span>

            <span class="ref-choice-row-copy">
              <strong>{{ item.title }}</strong>
              <span>{{ item.copy }}</span>
              <small>{{ item.action }}</small>
            </span>

            <FlowIcon
              name="arrow-right"
              aria-hidden="true"
            />
          </RouterLink>
        </div>
      </section>

      <dialog ref="appearanceDialog" class="ref-dialog club-appearance-dialog">
        <div class="ref-dialog-inner">
          <header class="ref-dialog-head">
            <div>
              <h2>Club appearance</h2>
              <p>Choose how this club appears across Gorra.</p>
            </div>

            <button
              class="ref-dialog-close"
              type="button"
              aria-label="Close"
              :disabled="appearanceBusy"
              @click="closeAppearance"
            >
              <FlowIcon name="close" />
            </button>
          </header>

          <ClubMediaEditor
            :logo-url="appearanceDraft.logoUrl"
            :cover-url="appearanceDraft.coverUrl"
            :cover-preset="appearanceDraft.coverPreset"
            :disabled="appearanceBusy"
            @update:logo-url="appearanceDraft.logoUrl = $event"
            @update:cover-url="appearanceDraft.coverUrl = $event"
            @update:cover-preset="appearanceDraft.coverPreset = $event"
          />

          <footer class="ref-form-actions club-appearance-actions">
            <button
              class="ref-button"
              type="button"
              :disabled="appearanceBusy"
              @click="closeAppearance"
            >
              Cancel
            </button>

            <button
              class="ref-button primary"
              type="button"
              :disabled="appearanceBusy"
              @click="saveAppearance"
            >
              {{ appearanceBusy ? 'Savingâ€¦' : 'Save appearance' }}
            </button>
          </footer>
        </div>
      </dialog>
    </section>

    <dialog ref="clubPicker" class="club-picker" aria-labelledby="club-picker-title" @click.self="closeClubPicker">
      <section class="club-picker__sheet">
        <header><div><h2 id="club-picker-title">Your clubs</h2><p>Pick the one you are playing in today.</p></div><button type="button" aria-label="Close your clubs" @click="closeClubPicker"><FlowIcon name="close" /></button></header>
        <div class="club-picker__actions"><button class="club-picker__action club-picker__action--start" type="button" @click="openClubFlow('create')"><span><strong>Start a new club</strong><small>Be the one who runs the ladder.</small></span><FlowIcon name="arrow-right" /></button><button class="club-picker__action club-picker__action--join" type="button" @click="openClubFlow('join')"><span><strong>Join with an invite</strong><small>Got a code from a club? Bring it here.</small></span><FlowIcon name="arrow-right" /></button></div>
        <div class="club-picker__list"><p>Your clubs</p><button v-for="item in pickerClubs" :key="item.id" type="button" :class="{ 'club-picker__club--active': item.id === adminStore.activeClubId }" :disabled="Boolean(switchingClubId)" @click="switchClub(item.id)"><b>{{ clubInitials(item.name) }}</b><span><strong>{{ item.name }}</strong><small>{{ item.city }} · {{ roleCopy(item.role) }}</small></span><FlowIcon v-if="item.id === adminStore.activeClubId" name="check" /></button></div>
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

.club-appearance-dialog {
  width: min(620px, 88vw);
}

.club-appearance-actions {
  margin-top: 20px;
}

@media (max-width: 760px) {
  .club-profile__switch { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 18px; border-bottom: 1px solid var(--g-line, #e4e9e5); }
.club-profile__switch p { margin: 0; color: var(--g-muted, #778079); font-size: 13px; }
.club-profile__switch strong { color: var(--g-ink, #28332c); }

.club-profile {
    gap: 27px;
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
.club-picker__club--active { background: rgba(8, 173, 43, .10) !important; }.club-picker__club--active:hover { background: rgba(8, 173, 43, .14) !important; }.club-picker__club--active b { background: rgba(8, 173, 43, .16); color: #087c29; }.club-picker__club--active :deep(.flow-icon) { color: #087c29; }</style>

