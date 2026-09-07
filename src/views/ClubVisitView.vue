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
const openSection = computed(() => {
  const section = String(route.params.section || '')
  if (['members', 'ladders', 'tournaments'].includes(section)) return section
  return route.query.collapsed === '1' ? '' : 'members'
})

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
  () => adminStore.activeClub?.name || 'Your current club',
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

const memberPreview = computed(() => members.value.slice(0, 6))
const ladderPreview = computed(() => activeLadders.value.slice(0, 5))
const tournamentPreview = computed(() => tournaments.value.slice(0, 5))

function toggleSection(section) {
  const collapsed = openSection.value === section
  const query = { ...route.query }
  delete query.collapsed
  if (collapsed) query.collapsed = '1'
  router.push({
    name: 'ClubVisit',
    params: { clubId: clubId.value, section: collapsed ? undefined : section },
    query,
  })
}

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
      (entry) => entry.ladderId === ladder.id || entry.ladderName === ladder.name,
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
    pageError.value = error?.message || 'We could not switch clubs.'
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
    pageError.value = error?.message || 'We could not open this club.'
  }

  try {
    const response = await getTournaments()

    if (!response.success) {
      throw new Error(response.message || 'Could not load tournaments.')
    }

    allTournaments.value = Array.isArray(response.data) ? response.data : []
  } catch (error) {
    tournamentError.value = error?.message || 'Could not load tournaments.'
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

    <Teleport to="#app-context-strip-root">
      <section
        v-if="club && relationship"
        class="club-preview-context"
        aria-label="Club viewing context"
      >
        <div class="club-preview-context__inner">
          <span
            class="club-preview-context__icon"
            aria-hidden="true"
          >
            <FlowIcon name="club" />
          </span>

          <p>
            <strong>You’re viewing {{ club.name }}.</strong>

            <span>
              {{ activeClubName }} is your active club.
              <button
                class="club-preview-context__link"
                type="button"
                :disabled="switching"
                @click="makeActive"
              >
                {{
                  switching
                    ? `Switching to ${club.name}…`
                    : `Switch to ${club.name}`
                }}
              </button>
              to use your {{ relationshipLabel }} access.
            </span>
          </p>
        </div>
      </section>
    </Teleport>

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
      class="club-preview-accordion"
      :class="{
        'club-preview-accordion--open': openSection === 'members',
      }"
    >
      <button
        class="club-preview-accordion__trigger"
        type="button"
        :aria-expanded="openSection === 'members'"
        aria-controls="club-preview-members-panel"
        @click="toggleSection('members')"
      >
        <span
          class="club-preview-accordion__icon"
          aria-hidden="true"
        >
          <FlowIcon name="users" />
        </span>

        <span class="club-preview-accordion__copy">
          <strong>Members</strong>
          <small>
            {{ members.length }}
            {{ members.length === 1 ? 'member' : 'members' }}
          </small>
        </span>

        <span
          class="club-preview-accordion__chevron"
          aria-hidden="true"
        >
          <FlowIcon name="chevron-down" />
        </span>
      </button>

      <div
        v-show="openSection === 'members'"
        id="club-preview-members-panel"
        class="club-preview-accordion__panel"
      >
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
              <strong>{{ person.name || 'Club member' }}</strong>
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
      </div>
    </section>

    <section
      class="club-preview-accordion"
      :class="{
        'club-preview-accordion--open': openSection === 'ladders',
      }"
    >
      <button
        class="club-preview-accordion__trigger"
        type="button"
        :aria-expanded="openSection === 'ladders'"
        aria-controls="club-preview-ladders-panel"
        @click="toggleSection('ladders')"
      >
        <span
          class="club-preview-accordion__icon"
          aria-hidden="true"
        >
          <FlowIcon name="ladder" />
        </span>

        <span class="club-preview-accordion__copy">
          <strong>Ladders</strong>
          <small>
            {{ activeLadders.length }}
            {{ activeLadders.length === 1 ? 'ladder' : 'ladders' }}
          </small>
        </span>

        <span
          class="club-preview-accordion__chevron"
          aria-hidden="true"
        >
          <FlowIcon name="chevron-down" />
        </span>
      </button>

      <div
        v-show="openSection === 'ladders'"
        id="club-preview-ladders-panel"
        class="club-preview-accordion__panel"
      >
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
                {{ ladder.matchType === 'doubles' ? 'Doubles' : 'Singles' }}
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
      </div>
    </section>

    <section
      class="club-preview-accordion"
      :class="{
        'club-preview-accordion--open': openSection === 'tournaments',
      }"
    >
      <button
        class="club-preview-accordion__trigger"
        type="button"
        :aria-expanded="openSection === 'tournaments'"
        aria-controls="club-preview-tournaments-panel"
        @click="toggleSection('tournaments')"
      >
        <span
          class="club-preview-accordion__icon"
          aria-hidden="true"
        >
          <FlowIcon name="trophy" />
        </span>

        <span class="club-preview-accordion__copy">
          <strong>Tournaments</strong>
          <small>
            {{
              loadingTournaments
                ? 'Loading…'
                : `${tournaments.length} ${tournaments.length === 1 ? 'tournament' : 'tournaments'}`
            }}
          </small>
        </span>

        <span
          class="club-preview-accordion__chevron"
          aria-hidden="true"
        >
          <FlowIcon name="chevron-down" />
        </span>
      </button>

      <div
        v-show="openSection === 'tournaments'"
        id="club-preview-tournaments-panel"
        class="club-preview-accordion__panel"
      >
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
              <small>{{ event.status || 'Tournament' }}</small>
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
      </div>
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
        <p>Open one of the clubs you belong to.</p>
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
  gap: 24px;
  padding-top: 8px;
  padding-bottom: 44px;
}

.club-preview-context {
  width: 100%;
  min-width: 0;
  background: #163d2b;
  color: #fff;
  box-shadow: none;
}

.club-preview-context__inner {
  display: flex;
  width: var(--app-header-content-width);
  min-height: 48px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-inline: auto;
  padding: 9px 0;
  text-align: center;
}

.club-preview-context__icon {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  place-items: center;
  border-radius: 8px;
  background: rgba(216, 255, 71, 0.11);
  color: #d8ff47;
}

.club-preview-context__icon :deep(svg) {
  width: 13px;
  height: 13px;
}

.club-preview-context p {
  min-width: 0;
  margin: 0;
  color: rgba(255, 255, 255, 0.72);
  font-size: 9.8px;
  line-height: 1.5;
}

.club-preview-context strong {
  margin-right: 3px;
  color: #fff;
  font-size: 10.2px;
  font-weight: 650;
}

.club-preview-context__link {
  display: inline;
  padding: 0;
  border: 0;
  background: transparent;
  color: #d8ff47;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  cursor: pointer;
}

@media (hover: hover) and (pointer: fine) {
  .club-preview-context__link:hover {
    color: #e9ff9b;
  }
}

.club-preview-context__link:focus-visible {
  border-radius: 3px;
  outline: 2px solid rgba(216, 255, 71, 0.42);
  outline-offset: 2px;
}

.club-preview-context__link:disabled {
  cursor: wait;
  opacity: 0.58;
}

.club-preview-accordion {
  overflow: visible;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: #f7f9f7;
  transition: background-color 160ms ease;
}

.club-preview-accordion--open {
  background: #f1f7f2;
}

.club-preview-accordion__trigger {
  display: grid;
  width: 100%;
  min-height: 112px;
  grid-template-columns: 38px minmax(0, 1fr) 34px;
  align-items: center;
  gap: 14px;
  padding: 22px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--color-text);
  text-align: left;
}

.club-preview-accordion__trigger:focus-visible {
  outline: 2px solid rgba(8, 173, 43, 0.16);
  outline-offset: 2px;
}

.club-preview-accordion__icon {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 12px;
  background: rgba(8, 173, 43, 0.075);
  color: #078c2f;
}

.club-preview-accordion__icon :deep(svg) {
  width: 17px;
  height: 17px;
}

.club-preview-accordion__copy {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.club-preview-accordion__copy strong {
  color: var(--color-text);
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.35;
}

.club-preview-accordion__copy small {
  color: var(--color-muted);
  font-size: 12px;
  line-height: 1.5;
}

.club-preview-accordion__chevron {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  justify-self: end;
  border-radius: 10px;
  background: rgba(22, 61, 43, 0.04);
  color: #7c8880;
  transition:
    transform 180ms cubic-bezier(0.23, 1, 0.32, 1),
    background-color 150ms ease,
    color 150ms ease;
}

.club-preview-accordion__chevron :deep(svg) {
  width: 15px;
  height: 15px;
}

.club-preview-accordion--open
  .club-preview-accordion__chevron {
  background: rgba(8, 173, 43, 0.09);
  color: #078c2f;
  transform: rotate(180deg);
}

.club-preview-accordion__panel {
  padding: 0 22px 22px;
  border: 0;
}

.club-preview-list {
  display: grid;
  gap: 16px;
  padding-top: 4px;
}

.club-preview-person,
.club-preview-row {
  display: grid;
  min-width: 0;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-height: 50px;
  padding: 7px 9px;
  border: 0;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.62);
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
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.club-preview-person small,
.club-preview-row small {
  color: var(--color-muted);
  font-size: 12px;
  line-height: 1.5;
}

.club-preview-row__icon {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 10px;
  background: rgba(8, 173, 43, 0.06);
  color: #078c2f;
}

.club-preview-row__icon :deep(svg) {
  width: 14px;
  height: 14px;
}

.club-preview-more,
.club-preview-empty {
  margin: 0;
  color: var(--color-muted);
  font-size: 12px;
  line-height: 1.5;
}

.club-preview-more {
  padding: 4px 2px 0;
}

.club-preview-empty {
  padding: 8px 2px 2px;
}

@media (hover: hover) and (pointer: fine) {
  .club-preview-accordion__trigger:hover
    .club-preview-accordion__chevron {
    background: rgba(22, 61, 43, 0.075);
    color: #163d2b;
  }
}

@media (max-width: 700px) {
  .club-preview {
    gap: 24px;
    padding-top: 7px;
    }

  .club-preview-context__inner {
    width: var(--app-header-content-width);
    min-height: 58px;
    align-items: center;
    gap: 7px;
    padding: 9px 0;
  }

  .club-preview-context__icon {
    width: 22px;
    height: 22px;
    flex-basis: 22px;
    border-radius: 7px;
  }

  .club-preview-context p {
    max-width: 46ch;
    font-size: 9.2px;
    line-height: 1.5;
  }

  .club-preview-context strong {
    font-size: 9.5px;
  }

  .club-preview-accordion__trigger {
    grid-template-columns: 34px minmax(0, 1fr) 32px;
    gap: 9px;
    min-height: 104px;
    padding: 18px;
  }

  .club-preview-accordion__icon {
    width: 34px;
    height: 34px;
    border-radius: 11px;
  }

  .club-preview-accordion__panel {
    padding: 0 18px 18px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .club-preview-accordion,
  .club-preview-accordion__chevron {
    transition:
      background-color 120ms ease,
      color 120ms ease;
  }

  .club-preview-accordion__chevron {
    transform: none !important;
  }
}

/* Gorra card hover colors. */
@media (hover: hover) and (pointer: fine) {
  .club-preview-accordion__trigger:hover:not(:disabled) {
    background: #163d2b;
    color: #fff;
  }

  .club-preview-accordion__trigger:hover:not(:disabled) .club-preview-accordion__copy strong,
  .club-preview-accordion__trigger:hover:not(:disabled) .club-preview-accordion__copy small {
    color: #fff;
  }

  .club-preview-accordion__trigger:hover:not(:disabled) .club-preview-accordion__icon,
  .club-preview-accordion__trigger:hover:not(:disabled) .club-preview-accordion__chevron {
    background: rgba(216, 255, 71, 0.12);
    color: #d8ff47;
  }
}
</style>

