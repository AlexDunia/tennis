<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ClubIdentityHero from '../components/club/ClubIdentityHero.vue'
import PersonAvatar from '../components/PersonAvatar.vue'
import FlowIcon from '../components/friendly/FlowIcon.vue'
import { useShellNestedHeader } from '../composables/useShellNestedHeader.js'
import { useAdminStore } from '../stores/admin'
import { useNotificationStore } from '../stores/notification'
import { collectClubMembers } from '../utils/club/memberData.js'
import { getTournaments } from '../services/TournamentService'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()
const notificationStore = useNotificationStore()

const switching = ref(false)
const loadingTournaments = ref(true)
const pageError = ref('')
const tournamentError = ref('')
const allTournaments = ref([])

const clubId = computed(() => String(route.params.clubId || ''))
const club = computed(() =>
  adminStore.clubs.find((item) => item.id === clubId.value) || null,
)
const setup = computed(() => club.value?.setup || {})
const workspace = computed(() => setup.value.workspace || {})
const relationship = computed(() => adminStore.membershipForClub(clubId.value))
const relationshipLabel = computed(
  () => adminStore.clubRoleLabel(clubId.value) || 'Member',
)
const activeClubName = computed(
  () => adminStore.activeClub?.name || 'your current club',
)

const location = computed(() => {
  if (workspace.value.location) return workspace.value.location

  return [workspace.value.city, workspace.value.country]
    .filter(Boolean)
    .join(', ')
})

const members = computed(() => collectClubMembers(setup.value))
const activeLadders = computed(() =>
  (setup.value.ladders || []).filter(
    (ladder) => ladder.enabled !== false && !ladder.archived,
  ),
)
const tournaments = computed(() =>
  allTournaments.value.filter((tournament) => tournament.clubId === clubId.value),
)

const memberPreview = computed(() => members.value.slice(0, 5))
const ladderPreview = computed(() => activeLadders.value.slice(0, 4))
const tournamentPreview = computed(() => tournaments.value.slice(0, 4))

function ladderPlayerCount(ladder) {
  const explicitIds = ladder.playerIds || ladder.memberIds

  if (Array.isArray(explicitIds)) {
    return new Set(explicitIds).size
  }

  return members.value.filter((member) => {
    if (Array.isArray(member.ladderIds)) {
      return member.ladderIds.includes(ladder.id)
    }

    return (member.ladderMemberships || []).some(
      (entry) =>
        entry.ladderId === ladder.id ||
        entry.ladderName === ladder.name,
    )
  }).length
}

async function makeActive() {
  if (
    switching.value ||
    !club.value ||
    club.value.id === adminStore.activeClubId
  ) {
    return
  }

  switching.value = true
  pageError.value = ''

  try {
    const clubName = club.value.name

    await adminStore.switchClub(club.value.id)

    notificationStore.addToast({
      title: 'Club switched',
      message: `${clubName} is now your active club.`,
      type: 'success',
    })

    await router.replace({ name: 'Club' })
  } catch (error) {
    pageError.value =
      error?.message ||
      'We could not switch clubs.'
  } finally {
    switching.value = false
  }
}

useShellNestedHeader(() => ({
  label: club.value?.name || 'Club',
  subtitle: 'Club preview',
  backLabel: 'Back to clubs',
  back: () => router.push({ name: 'Clubs' }),
  crumbs: [
    { label: 'Club' },
    { label: club.value?.name || 'Club' },
  ],
}))

onMounted(async () => {
  pageError.value = ''

  try {
    if (!adminStore.clubs.length) {
      await adminStore.loadClubs()
    }
  } catch (error) {
    pageError.value =
      error?.message ||
      'We could not open this club.'
  }

  try {
    const response = await getTournaments()

    if (!response.success) {
      throw new Error(
        response.message ||
          'Could not load tournaments.',
      )
    }

    allTournaments.value =
      Array.isArray(response.data)
        ? response.data
        : []
  } catch (error) {
    tournamentError.value =
      error?.message ||
      'Could not load tournaments.'
  } finally {
    loadingTournaments.value = false
  }
})
</script>

<template>
  <main
    v-if="club && relationship"
    class="gorra-club-ref ref-page club-preview"
  >
    <p
      v-if="pageError"
      class="ref-inline-alert"
      role="alert"
    >
      {{ pageError }}
    </p>

    <ClubIdentityHero
      :name="club.name"
      :location="location"
      :role-label="`${relationshipLabel} in this club`"
      :logo-url="workspace.logoUrl || ''"
      :cover-url="workspace.coverUrl || ''"
      :cover-preset="workspace.coverPreset || 'court-green'"
      :member-count="members.length"
      :ladder-count="activeLadders.length"
      :tournament-count="tournaments.length"
      :editable="false"
    />

    <section
      class="club-preview-context"
      aria-label="Club context"
    >
      <div class="club-preview-context__copy">
        <span
          class="club-preview-context__icon"
          aria-hidden="true"
        >
          <FlowIcon name="home" />
        </span>

        <span>
          <strong>
            You’re viewing {{ club.name }}.
          </strong>

          <small>
            {{ activeClubName }} remains your active club.
          </small>
        </span>
      </div>

      <button
        class="ref-button primary club-preview-context__switch"
        type="button"
        :disabled="switching"
        @click="makeActive"
      >
        {{
          switching
            ? 'Switching…'
            : 'Switch to this club'
        }}

        <FlowIcon
          name="arrow-right"
          aria-hidden="true"
        />
      </button>
    </section>

    <section
      class="club-preview-section"
      aria-labelledby="club-preview-members"
    >
      <header class="club-preview-section__head">
        <div>
          <p>Members</p>
          <h2 id="club-preview-members">
            People in this club
          </h2>
        </div>

        <span>
          {{ members.length }}
          {{
            members.length === 1
              ? 'member'
              : 'members'
          }}
        </span>
      </header>

      <div
        v-if="memberPreview.length"
        class="club-preview-list"
      >
        <article
          v-for="person in memberPreview"
          :key="person.id"
          class="club-preview-person"
        >
          <PersonAvatar
            :name="person.name || 'Club member'"
            :image="person.photoUrl || person.imageUrl || ''"
            :size="38"
          />

          <span>
            <strong>
              {{ person.name || 'Club member' }}
            </strong>

            <small>
              {{
                person.role === 'co-admin'
                  ? 'Co-admin'
                  : person.role === 'admin'
                    ? 'Admin'
                    : 'Member'
              }}
            </small>
          </span>
        </article>

        <p
          v-if="members.length > memberPreview.length"
          class="club-preview-more"
        >
          +{{ members.length - memberPreview.length }} more members
        </p>
      </div>

      <p
        v-else
        class="club-preview-empty"
      >
        No members have been added yet.
      </p>
    </section>

    <section
      class="club-preview-section"
      aria-labelledby="club-preview-ladders"
    >
      <header class="club-preview-section__head">
        <div>
          <p>Ladders</p>
          <h2 id="club-preview-ladders">
            Active ladders
          </h2>
        </div>

        <span>{{ activeLadders.length }}</span>
      </header>

      <div
        v-if="ladderPreview.length"
        class="club-preview-list"
      >
        <article
          v-for="ladder in ladderPreview"
          :key="ladder.id"
          class="club-preview-row"
        >
          <span
            class="club-preview-row__icon"
            aria-hidden="true"
          >
            <FlowIcon name="ladder" />
          </span>

          <span>
            <strong>{{ ladder.name }}</strong>

            <small>
              {{
                ladder.matchType === 'doubles'
                  ? 'Doubles'
                  : 'Singles'
              }}
              · {{ ladderPlayerCount(ladder) }} players
            </small>
          </span>
        </article>

        <p
          v-if="activeLadders.length > ladderPreview.length"
          class="club-preview-more"
        >
          +{{ activeLadders.length - ladderPreview.length }} more ladders
        </p>
      </div>

      <p
        v-else
        class="club-preview-empty"
      >
        No active ladders yet.
      </p>
    </section>

    <section
      class="club-preview-section"
      aria-labelledby="club-preview-tournaments"
    >
      <header class="club-preview-section__head">
        <div>
          <p>Tournaments</p>
          <h2 id="club-preview-tournaments">
            Club tournaments
          </h2>
        </div>

        <span>
          {{
            loadingTournaments
              ? '…'
              : tournaments.length
          }}
        </span>
      </header>

      <p
        v-if="loadingTournaments"
        class="club-preview-empty"
        role="status"
      >
        Loading tournaments…
      </p>

      <p
        v-else-if="tournamentError"
        class="club-preview-empty"
        role="alert"
      >
        {{ tournamentError }}
      </p>

      <div
        v-else-if="tournamentPreview.length"
        class="club-preview-list"
      >
        <article
          v-for="event in tournamentPreview"
          :key="event.id"
          class="club-preview-row"
        >
          <span
            class="club-preview-row__icon"
            aria-hidden="true"
          >
            <FlowIcon name="trophy" />
          </span>

          <span>
            <strong>{{ event.name }}</strong>
            <small>
              {{ event.status || 'Tournament' }}
            </small>
          </span>
        </article>

        <p
          v-if="tournaments.length > tournamentPreview.length"
          class="club-preview-more"
        >
          +{{ tournaments.length - tournamentPreview.length }} more tournaments
        </p>
      </div>

      <p
        v-else
        class="club-preview-empty"
      >
        No tournaments have been added yet.
      </p>
    </section>
  </main>

  <main
    v-else
    class="gorra-club-ref ref-page"
  >
    <section class="ref-page-narrow">
      <div class="ref-flow-head">
        <p class="ref-kicker">Club</p>
        <h1>Club unavailable</h1>
        <p>
          Open one of the clubs you belong to.
        </p>
      </div>

      <button
        class="ref-button primary"
        type="button"
        @click="router.push({ name: 'Clubs' })"
      >
        Back to your clubs
      </button>
    </section>
  </main>
</template>

<style scoped>
.club-preview {
  display: grid;
  gap: 28px;
  padding-bottom: 42px;
}

.club-preview-context {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 15px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: #fbfcfb;
}

.club-preview-context__copy {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 11px;
}

.club-preview-context__icon {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  place-items: center;
  border-radius: 9px;
  background: rgba(8, 173, 43, 0.075);
  color: var(--color-primary-strong);
}

.club-preview-context__icon :deep(svg) {
  width: 16px;
  height: 16px;
}

.club-preview-context__copy > span:last-child {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.club-preview-context strong {
  overflow: hidden;
  color: var(--color-text);
  font-size: 11.5px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.club-preview-context small {
  color: var(--color-muted);
  font-size: 10px;
  line-height: 1.4;
}

.club-preview-context__switch {
  min-height: 42px;
  flex: 0 0 auto;
  gap: 7px;
  white-space: nowrap;
}

.club-preview-context__switch :deep(svg) {
  width: 14px;
  height: 14px;
}

.club-preview-section {
  display: grid;
  gap: 12px;
}

.club-preview-section__head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
  padding-bottom: 2px;
}

.club-preview-section__head p,
.club-preview-section__head h2 {
  margin: 0;
}

.club-preview-section__head p {
  margin-bottom: 3px;
  color: var(--color-primary-strong);
  font-size: 8.8px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.club-preview-section__head h2 {
  color: var(--color-text);
  font-size: 15px;
  font-weight: 650;
}

.club-preview-section__head > span {
  color: var(--color-muted);
  font-size: 9.5px;
}

.club-preview-list {
  display: grid;
  gap: 8px;
}

.club-preview-person,
.club-preview-row {
  display: grid;
  min-width: 0;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-height: 58px;
  padding: 9px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: #fff;
}

.club-preview-person > span,
.club-preview-row > span:last-child {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.club-preview-person strong,
.club-preview-row strong {
  overflow: hidden;
  color: var(--color-text);
  font-size: 10.8px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.club-preview-person small,
.club-preview-row small {
  color: var(--color-muted);
  font-size: 9.4px;
  line-height: 1.35;
}

.club-preview-row__icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 9px;
  background: var(--color-surface-soft);
  color: var(--color-primary-strong);
}

.club-preview-row__icon :deep(svg) {
  width: 16px;
  height: 16px;
}

.club-preview-more,
.club-preview-empty {
  margin: 0;
  color: var(--color-muted);
  font-size: 9.8px;
  line-height: 1.45;
}

.club-preview-more {
  padding: 3px 2px 0;
}

@media (max-width: 700px) {
  .club-preview {
    gap: 24px;
  }

  .club-preview-context {
    display: grid;
    gap: 12px;
    padding: 13px;
  }

  .club-preview-context__switch {
    width: 100%;
  }

  .club-preview-context strong {
    white-space: normal;
  }

  .club-preview-section__head {
    align-items: start;
  }
}
</style>

