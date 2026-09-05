<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import FlowIcon from '../components/friendly/FlowIcon.vue'
import { useAdminStore } from '../stores/admin'
import { useNotificationStore } from '../stores/notification'
import { useTournamentStore } from '../stores/tournament'
import { collectClubMembers } from '../utils/club/memberData.js'
import { isSafeImageSource } from '../utils/formSafety.js'

const router = useRouter()
const adminStore = useAdminStore()
const tournamentStore = useTournamentStore()
const notificationStore = useNotificationStore()
const photoInput = ref(null)
const pageError = ref('')
const photoBusy = ref(false)

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

const clubInitials = computed(() =>
  String(club.value?.name || 'Club')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase(),
)


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

function chooseClubPhoto() {
  if (canManage.value && !photoBusy.value) photoInput.value?.click()
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('We could not read that image.'))
    reader.readAsDataURL(file)
  })
}

async function updateClubPhoto(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  pageError.value = ''

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    pageError.value = 'Choose a JPG, PNG or WebP image.'
    return
  }

  if (file.size > 1_400_000) {
    pageError.value = 'Choose an image smaller than 1.4 MB.'
    return
  }

  photoBusy.value = true

  try {
    const logoUrl = await readImage(file)
    if (!isSafeImageSource(logoUrl)) throw new Error('That image could not be used safely.')

    await adminStore.updateActiveClub({
      workspace: {
        ...workspace.value,
        logoUrl,
      },
    })

    notificationStore.addToast({
      message: 'Club photo updated.',
      type: 'success',
    })
  } catch (error) {
    pageError.value = error?.message || 'We could not update the club photo.'
  } finally {
    photoBusy.value = false
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
</script>

<template>
  <main class="gorra-club-ref ref-page">
    <p v-if="pageError" class="ref-inline-alert" role="alert">{{ pageError }}</p>

    <section v-if="club" aria-labelledby="active-club-name">
      <section class="ref-club-identity">
        <div class="ref-club-identity-main">
          <button
            class="ref-club-photo"
            type="button"
            :disabled="!canManage || photoBusy"
            :aria-label="canManage ? 'Change club photo' : undefined"
            @click="chooseClubPhoto"
          >
            <img v-if="workspace.logoUrl" :src="workspace.logoUrl" alt="" />
            <span v-else>{{ clubInitials }}</span>
            <span v-if="canManage" class="ref-club-photo-edit" aria-hidden="true">
              <FlowIcon name="profile" />
            </span>
          </button>
          <input
            ref="photoInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            @change="updateClubPhoto"
          />

          <div>
            <h1 id="active-club-name">{{ club.name }}</h1>
            <p>{{ workspace.location || 'Club location not added yet' }}</p>
            <small>{{ adminStore.activeClubRoleLabel }} in this club</small>
          </div>
        </div>

        <div class="ref-club-stats" aria-label="Club summary">
          <span><strong>{{ members.length }}</strong> members</span>
          <i aria-hidden="true"></i>
          <span><strong>{{ activeLadders.length }}</strong> ladders</span>
          <i aria-hidden="true"></i>
          <span><strong>{{ tournaments.length }}</strong> tournaments</span>
        </div>
      </section>


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
            @click="open(item.to)"
          >
            <span class="ref-feature-icon" aria-hidden="true">
              <FlowIcon :name="item.icon" />
            </span>

            <span class="ref-choice-row-copy">
              <strong>{{ item.title }}</strong>
              <span>{{ item.copy }}</span>
              <small>{{ item.action }}</small>
            </span>

            <FlowIcon name="arrow-right" />
          </button>
        </div>
      </section>
    </section>

    <section v-else class="ref-page-narrow">
      <div class="ref-flow-head">
        <p class="ref-kicker">Club</p>
        <h1>No active club</h1>
        <p>Choose a club to continue.</p>
      </div>
      <button class="ref-button primary" type="button" @click="open({ name: 'Clubs' })">
        Open your clubs
      </button>
    </section>
  </main>
</template>
