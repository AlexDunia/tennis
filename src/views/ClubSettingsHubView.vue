<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import FlowIcon from '../components/friendly/FlowIcon.vue'
import { useAdminStore } from '../stores/admin'
import { collectClubMembers } from '../utils/club/memberData.js'

const router = useRouter()
const adminStore = useAdminStore()

const club = computed(() => adminStore.activeClub)
const members = computed(() => collectClubMembers(club.value?.setup || {}))
const admins = computed(
  () => members.value.filter((member) => ['admin', 'co-admin'].includes(member.role)).length,
)

const items = computed(() => [
  {
    icon: 'home',
    title: 'Club',
    copy: 'Name, location, joining and the member information your club uses.',
    to: { name: 'Settings', query: { section: 'club' } },
  },
  {
    icon: 'users',
    title: 'People',
    copy: 'Members, admins and general club permissions.',
    to: { name: 'Settings', query: { section: 'members' } },
  },
  {
    icon: 'sliders',
    title: 'Play',
    copy: 'Starting match defaults for new ladders and tournaments.',
    to: { name: 'Settings', query: { section: 'rules' } },
  },
  {
    icon: 'calendar',
    title: 'Courts',
    copy: 'Courts, opening hours and basic availability.',
    to: { name: 'Settings', query: { section: 'club', focus: 'courts' } },
  },
])

onMounted(() => {
  adminStore.loadClubs().catch(() => {})
})
</script>

<template>
  <main class="gorra-club-ref ref-page ref-page-narrow">
    <button class="ref-back" type="button" @click="router.push({ name: 'Club' })">
      <FlowIcon name="arrow-right" />
      Back to club
    </button>

    <header class="ref-page-head">
      <div class="ref-page-head-main">
        <p class="ref-kicker">Manage</p>
        <h1>Club settings</h1>
        <p>
          Four places to manage how this club works. Ladders, tournaments and individual matches
          keep their own specific rules.
        </p>
      </div>
    </header>

    <div class="ref-choice-stack">
      <button
        v-for="item in items"
        :key="item.title"
        class="ref-choice-row"
        type="button"
        @click="router.push(item.to)"
      >
        <span class="ref-feature-icon" aria-hidden="true">
          <FlowIcon :name="item.icon" />
        </span>

        <span class="ref-choice-row-copy">
          <strong>{{ item.title }}</strong>
          <span>{{ item.copy }}</span>
        </span>

        <FlowIcon name="arrow-right" />
      </button>
    </div>

    <section style="margin-top: 34px; padding-top: 20px; border-top: 1px solid #e4e9e5">
      <p class="ref-kicker">This club</p>
      <p class="ref-inline-note" style="margin: 0">
        {{ club?.name || 'Club' }} · {{ members.length }} members · {{ admins }} admins
      </p>
    </section>
  </main>
</template>
