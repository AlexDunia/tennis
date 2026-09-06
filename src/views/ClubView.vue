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

function openAppearance() {
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
  label: 'Back to clubs',
  backLabel: 'Back to clubs',
  back: () => router.push({ name: 'Clubs' }),
  crumbs: [
    { label: 'Club' },
    { label: club.value?.name || 'Current club' },
  ],
}))
</script>

<template>
  <main class="gorra-club-ref ref-page">
    <p v-if="pageError" class="ref-inline-alert" role="alert">{{ pageError }}</p>

    <section v-if="club">
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
        <header class="ref-section-heading">
          <h2>Manage your club</h2>
        </header>

        <div class="ref-choice-stack">
          <button
            v-for="item in manageItems"
            :key="item.title"
            class="ref-choice-row"
            type="button"
            :aria-label="`${item.action} for ${club.name}`"
            @click="open(item.to)"
          >
            <span class="ref-feature-icon" aria-hidden="true">
              <FlowIcon :name="item.icon" />
            </span>

            <span class="ref-choice-row-copy">
              <strong>{{ item.title }}</strong>
              <span>{{ item.copy }}</span>
            </span>

            <span class="ref-button primary club-manage-action">
              {{ item.action }}
              <FlowIcon name="arrow-right" aria-hidden="true" />
            </span>
          </button>
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
              {{ appearanceBusy ? 'Saving…' : 'Save appearance' }}
            </button>
          </footer>
        </div>
      </dialog>
    </section>

    <section v-else class="ref-page-narrow">
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
.club-appearance-dialog {
  width: min(620px, 88vw);
}

.club-appearance-actions {
  margin-top: 20px;
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

.ref-club-manage .ref-choice-row {
  grid-template-columns: 42px minmax(0, 1fr) auto;
}

.club-manage-action {
  white-space: nowrap;
}

@media (max-width: 600px) {
  .ref-club-manage .ref-choice-row {
    grid-template-columns: 42px minmax(0, 1fr);
  }

  .club-manage-action {
    grid-column: 2;
    justify-self: start;
  }
}
</style>

