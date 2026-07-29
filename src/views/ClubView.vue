<script setup>
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminStore } from '../stores/admin'
import { useAuthStore } from '../stores/auth'
import EmptyState from '../components/EmptyState.vue'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()
const authStore = useAuthStore()

const activeClub = computed(() => adminStore.activeClub)
const setup = computed(() => activeClub.value?.setup || null)
const workspace = computed(() => setup.value?.workspace || {})
const rules = computed(() => setup.value?.rules || {})
const isManager = computed(() => authStore.hasPermission('club.manage'))
const section = computed(() => {
  const value = String(route.query.section || 'overview')
  return ['overview', 'members', 'rules'].includes(value) ? value : 'overview'
})

const members = computed(() => {
  const membership = setup.value?.membership || {}
  const source = [
    ...(membership.roster || []),
    ...(membership.manualMembers || []),
    ...(membership.importedMembers || []),
  ]
  const seen = new Set()
  return source.filter((member) => {
    const key = String(
      member.userId || member.id || member.email || member.phone || member.name || '',
    )
      .trim()
      .toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
})

const ruleItems = computed(() => [
  {
    label: 'Challenge range',
    value: `Up to ${rules.value.challengeRangeUp || 3} places above`,
  },
  {
    label: 'Response time',
    value: `${rules.value.responseHours || 48} hours`,
  },
  {
    label: 'Match window',
    value: `${rules.value.completionDays || 7} days`,
  },
  {
    label: 'Scoring',
    value: rules.value.scoring === 'no-ad' ? 'No-ad scoring' : 'Advantage scoring',
  },
])

function openJoinOrManage() {
  router.push(
    isManager.value ? { name: 'Clubs', query: { view: 'start' } } : { name: 'PlayerClubJoin' },
  )
}

onMounted(() => {
  adminStore.loadClubs().catch(() => {})
})
</script>

<template>
  <section class="club-page" aria-labelledby="club-page-title">
    <div v-if="adminStore.isLoading && !activeClub" class="club-loading" aria-live="polite">
      <span class="skeleton skeleton-line"></span>
      <span class="skeleton skeleton-line"></span>
    </div>

    <EmptyState
      v-else-if="!activeClub"
      variant="first-use"
      illustration="club"
      title="Connect your tennis club"
      description="Join your club to see its members, courts, ladder rules, and announcements here."
      :primary-action-label="isManager ? 'Open club setup' : 'Join a club'"
      @primary-action="openJoinOrManage"
    />

    <template v-else>
      <header class="club-hero">
        <div class="club-hero__mark" aria-hidden="true">
          {{ activeClub.name.slice(0, 2).toUpperCase() }}
        </div>
        <div class="club-hero__copy">
          <p>Your active club</p>
          <h1 id="club-page-title">{{ activeClub.name }}</h1>
          <span>{{ workspace.location || 'Club location not added yet' }}</span>
        </div>
        <div v-if="isManager" class="club-hero__actions">
          <RouterLink class="button-secondary" :to="{ name: 'Clubs', query: { view: 'start' } }">
            Switch or add club
          </RouterLink>
          <RouterLink class="button-primary" :to="{ name: 'Settings' }"> Manage club </RouterLink>
        </div>
      </header>

      <section v-if="section === 'overview'" class="club-overview">
        <div class="club-stats" aria-label="Club summary">
          <article>
            <span>Members</span>
            <strong>{{ members.length }}</strong>
          </article>
          <article>
            <span>Courts</span>
            <strong>{{ workspace.courts?.length || 0 }}</strong>
          </article>
          <article>
            <span>Active ladders</span>
            <strong>{{
              setup.ladders?.filter((ladder) => ladder.enabled && !ladder.archived).length || 0
            }}</strong>
          </article>
        </div>

        <div class="club-grid">
          <article class="club-card">
            <div class="club-card__heading">
              <div>
                <p>Courts</p>
                <h2>Where the club plays</h2>
              </div>
            </div>
            <ul v-if="workspace.courts?.length" class="club-list">
              <li v-for="court in workspace.courts" :key="court">
                <span class="club-list__dot" aria-hidden="true"></span>
                <span>{{ court }}</span>
              </li>
            </ul>
            <p v-else class="club-card__empty">No courts have been added yet.</p>
          </article>

          <article class="club-card">
            <div class="club-card__heading">
              <div>
                <p>Season</p>
                <h2>Club calendar</h2>
              </div>
            </div>
            <dl class="club-details">
              <div>
                <dt>Starts</dt>
                <dd>{{ workspace.seasonStart || 'Not set' }}</dd>
              </div>
              <div>
                <dt>Ends</dt>
                <dd>{{ workspace.seasonEnd || 'Not set' }}</dd>
              </div>
            </dl>
          </article>
        </div>
      </section>

      <section v-else-if="section === 'members'" class="club-card club-card--wide">
        <div class="club-card__heading">
          <div>
            <p>Directory</p>
            <h2>Club members</h2>
          </div>
          <RouterLink v-if="isManager" class="button-secondary" :to="{ name: 'Settings' }">
            Manage members
          </RouterLink>
        </div>
        <ul v-if="members.length" class="member-list">
          <li v-for="member in members" :key="member.userId || member.id || member.name">
            <span class="member-avatar" aria-hidden="true">
              {{
                String(member.name || 'Member')
                  .slice(0, 2)
                  .toUpperCase()
              }}
            </span>
            <span
              ><strong>{{ member.name || 'Club member' }}</strong
              ><small>{{ member.role || 'Player' }}</small></span
            >
          </li>
        </ul>
        <EmptyState
          v-else
          compact
          variant="data-dependent"
          illustration="members"
          title="No member directory yet"
          description="Members will appear after the club roster is added."
        />
      </section>

      <section v-else class="club-card club-card--wide">
        <div class="club-card__heading">
          <div>
            <p>Competition rules</p>
            <h2>How matches work here</h2>
          </div>
          <RouterLink v-if="isManager" class="button-secondary" :to="{ name: 'Settings' }">
            Edit rules
          </RouterLink>
        </div>
        <dl class="rule-list">
          <div v-for="item in ruleItems" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
      </section>
    </template>
  </section>
</template>

<style scoped>
.club-page {
  display: grid;
  gap: 24px;
  width: min(100%, 1080px);
}

.club-loading {
  display: grid;
  gap: 10px;
  padding: 28px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
}

.club-hero {
  display: flex;
  align-items: center;
  gap: 18px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--color-border);
}

.club-hero__mark {
  display: grid;
  flex: 0 0 62px;
  width: 62px;
  height: 62px;
  place-items: center;
  border-radius: 16px;
  background: var(--color-surface-soft);
  color: var(--color-primary-strong);
  font-weight: var(--font-weight-bold);
}

.club-hero__copy {
  display: grid;
  flex: 1;
  gap: 2px;
  min-width: 0;
}

.club-hero__copy p,
.club-hero__copy h1,
.club-hero__copy span {
  margin: 0;
}

.club-hero__copy p,
.club-card__heading p {
  color: var(--color-primary-strong);
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.club-hero__copy h1 {
  overflow: hidden;
  color: var(--color-text);
  font-size: clamp(24px, 4vw, 34px);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.club-hero__copy span {
  color: var(--color-muted);
  font-size: 13px;
}

.club-hero__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.club-overview {
  display: grid;
  gap: 18px;
}

.club-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
}

.club-stats article {
  display: grid;
  gap: 4px;
  padding: 20px;
  border-right: 1px solid var(--color-border);
}

.club-stats article:last-child {
  border-right: 0;
}

.club-stats span {
  color: var(--color-muted);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
}

.club-stats strong {
  color: var(--color-text);
  font-size: 24px;
}

.club-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.club-card {
  display: grid;
  align-content: start;
  gap: 18px;
  min-width: 0;
  padding: 22px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
}

.club-card--wide {
  width: min(100%, 880px);
}

.club-card__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.club-card__heading p,
.club-card__heading h2 {
  margin: 0;
}

.club-card__heading h2 {
  font-size: 18px;
}

.club-list,
.member-list {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.club-list li,
.member-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 54px;
  border-top: 1px solid var(--color-border);
}

.club-list__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
}

.club-card__empty {
  margin: 0;
  color: var(--color-muted);
}

.club-details,
.rule-list {
  display: grid;
  gap: 0;
  margin: 0;
}

.club-details > div,
.rule-list > div {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  padding: 13px 0;
  border-top: 1px solid var(--color-border);
}

.club-details dt,
.rule-list dt {
  color: var(--color-muted);
}

.club-details dd,
.rule-list dd {
  margin: 0;
  color: var(--color-text);
  font-weight: var(--font-weight-semibold);
  text-align: right;
}

.member-avatar {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 50%;
  background: var(--color-surface-soft);
  color: var(--color-primary-strong);
  font-size: 11px;
  font-weight: var(--font-weight-bold);
}

.member-list li > span:last-child {
  display: grid;
  gap: 1px;
}

.member-list small {
  color: var(--color-muted);
  text-transform: capitalize;
}

@media (max-width: 720px) {
  .club-hero {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .club-hero__actions {
    width: 100%;
    justify-content: flex-start;
  }

  .club-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .club-stats {
    grid-template-columns: 1fr;
  }

  .club-stats article {
    grid-template-columns: 1fr auto;
    align-items: center;
    border-right: 0;
    border-bottom: 1px solid var(--color-border);
  }

  .club-stats article:last-child {
    border-bottom: 0;
  }

  .club-card__heading {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
