<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNotificationStore } from '../stores/notification'
import { usePlayerStore } from '../stores/player'
import { useTournamentStore } from '../stores/tournament'
import { useTournamentGalleryStore } from '../stores/tournamentGallery'
import TournamentEmptyState from '../components/tournament/TournamentEmptyState.vue'
import TournamentGalleryCard from '../components/tournament/TournamentGalleryCard.vue'
import TournamentGalleryFolder from '../components/tournament/TournamentGalleryFolder.vue'
import TournamentImageAddModal from '../components/tournament/TournamentImageAddModal.vue'
import TournamentImageLightbox from '../components/tournament/TournamentImageLightbox.vue'

const route = useRoute()
const router = useRouter()
const notificationStore = useNotificationStore()
const playerStore = usePlayerStore()
const tournamentStore = useTournamentStore()
const galleryStore = useTournamentGalleryStore()

const showAddModal = ref(false)
const hasLoaded = ref(false)

const tournamentId = computed(() => String(route.params.tournamentId || ''))
const selectedImageId = computed(() => String(route.query.image || ''))
const activeFolderKey = computed(() => String(route.query.folder || ''))
const tournament = computed(() =>
  tournamentStore.activeTournament?.id === tournamentId.value ? tournamentStore.activeTournament : null,
)
const editionYear = computed(() =>
  tournament.value?.roundRobinStart ? new Date(tournament.value.roundRobinStart).getFullYear() : '',
)
const canManageImages = computed(() => playerStore.currentPlayerCan('tournaments.images.manage'))
const categoriesById = computed(() =>
  Object.fromEntries((tournament.value?.categories || []).map((category) => [category.id, category])),
)
const galleryImages = computed(() =>
  galleryStore.images.map((image) => ({
    ...image,
    categoryName: image.categoryId ? categoriesById.value[image.categoryId]?.name || 'Uncategorized' : '',
  })),
)
const folders = computed(() => [
  {
    id: 'all',
    name: 'All',
    isAll: true,
    count: galleryImages.value.length,
    coverUrl: galleryImages.value[0]?.thumbnailUrl || galleryImages.value[0]?.url || '',
    lastUploadedAt: galleryImages.value[0]?.uploadedAt || '',
  },
  ...(tournament.value?.categories || []).map((category) => {
    const categoryImages = galleryImages.value.filter((image) => image.categoryId === category.id)
    return {
      id: category.id,
      name: category.name,
      count: categoryImages.length,
      coverUrl: categoryImages[0]?.thumbnailUrl || categoryImages[0]?.url || '',
      lastUploadedAt: categoryImages[0]?.uploadedAt || '',
    }
  }),
])
const activeFolder = computed(() =>
  folders.value.find((folder) => folder.id === activeFolderKey.value) || folders.value[0],
)
const filteredImages = computed(() => {
  return galleryImages.value.filter((image) => {
    return (
      activeFolderKey.value === 'all' ||
      !activeFolderKey.value ||
      image.categoryId === activeFolderKey.value
    )
  })
})
const selectedIndex = computed(() =>
  filteredImages.value.findIndex((image) => image.id === selectedImageId.value),
)
const selectedImage = computed(() =>
  selectedIndex.value >= 0 ? filteredImages.value[selectedIndex.value] : null,
)

function openImage(image) {
  router.replace({ query: { ...route.query, image: image.id } })
}

function openFolder(folder) {
  const query = { ...route.query }
  delete query.image
  query.folder = folder.id
  router.replace({ query })
}

function showFolders() {
  const query = { ...route.query }
  delete query.folder
  delete query.image
  router.replace({ query })
}

function closeImage() {
  const query = { ...route.query }
  delete query.image
  router.replace({ query })
}

function moveImage(direction) {
  if (!filteredImages.value.length) return
  const nextIndex =
    (selectedIndex.value + direction + filteredImages.value.length) % filteredImages.value.length
  openImage(filteredImages.value[nextIndex])
}

async function shareImage(image) {
  const shareUrl = new URL(
    router.resolve({
      name: 'TournamentGallery',
      params: { tournamentId: tournamentId.value },
      query: { image: image.id },
    }).href,
    window.location.origin,
  ).href
  const shareData = {
    title: image.caption || tournament.value?.name || 'Tournament image',
    text: `View this image from ${tournament.value?.name || 'the tournament'}.`,
    url: shareUrl,
  }

  try {
    if (navigator.share) {
      await navigator.share(shareData)
    } else {
      await navigator.clipboard.writeText(shareUrl)
      notificationStore.addToast({ message: 'Image link copied.', type: 'success' })
    }
  } catch (error) {
    if (error?.name !== 'AbortError') {
      notificationStore.addToast({ message: 'Unable to share this image.', type: 'error' })
    }
  }
}

async function addImage(payload) {
  const image = await galleryStore.addImage(tournamentId.value, {
    ...payload,
    uploadedBy: playerStore.currentPlayerId,
    uploadedByName: playerStore.currentPlayer?.name || 'Tournament admin',
  })
  if (!image) return
  showAddModal.value = false
  notificationStore.addToast({ message: 'Image added to the tournament gallery.', type: 'success' })
}

async function removeImage(image) {
  if (!window.confirm(`Remove "${image.caption || 'this image'}" from the gallery?`)) return
  const removed = await galleryStore.removeImage(tournamentId.value, image.id)
  if (!removed) return
  closeImage()
  notificationStore.addToast({ message: 'Image removed from the gallery.', type: 'success' })
}

watch(
  tournamentId,
  async (nextTournamentId) => {
    hasLoaded.value = false
    await Promise.all([
      tournamentStore.fetchTournament(nextTournamentId),
      galleryStore.fetchImages(nextTournamentId),
      playerStore.players.length ? Promise.resolve() : playerStore.loadPlayers(),
    ])
    hasLoaded.value = true
  },
  { immediate: true },
)
</script>

<template>
  <section v-if="tournament" class="tournament-gallery">
    <header v-if="!activeFolderKey" class="tournament-gallery__intro">
      <div class="tournament-gallery__intro-top">
        <div>
          <span class="t-section-kicker">{{ editionYear }} edition</span>
          <h2>{{ tournament.name }}</h2>
          <p>Browse tournament photos by folder or view every image in upload order.</p>
        </div>
        <div class="tournament-gallery__hero-actions">
          <button v-if="canManageImages" type="button" class="t-button t-button--primary" @click="showAddModal = true">
            Add image
          </button>
        </div>
      </div>
      <div class="tournament-gallery__summary">
        <div class="tournament-gallery__summary-card tournament-gallery__summary-card--green">
          <span>Images</span>
          <strong>{{ galleryStore.images.length }}</strong>
        </div>
        <div class="tournament-gallery__summary-card tournament-gallery__summary-card--yellow">
          <span>Folders</span>
          <strong>{{ tournament.categories.length + 1 }}</strong>
        </div>
        <div class="tournament-gallery__summary-card tournament-gallery__summary-card--blue">
          <span>Edition</span>
          <strong>{{ editionYear }}</strong>
        </div>
      </div>
    </header>

    <section v-if="!activeFolderKey && !galleryStore.loading" class="tournament-gallery__folders">
      <div class="t-section-header">
        <div>
          <h3 class="t-section-title">Gallery folders</h3>
          <p class="t-muted">Open All for the latest uploads, or choose a tournament category.</p>
        </div>
      </div>
      <div class="tournament-gallery__folder-grid">
        <TournamentGalleryFolder v-for="folder in folders" :key="folder.id" :folder="folder" @open="openFolder" />
      </div>
    </section>

    <div v-if="activeFolderKey" class="tournament-gallery__folder-header">
      <button type="button" class="tournament-gallery__back" @click="showFolders">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Gallery folders
      </button>
      <h2>{{ activeFolder.name }}</h2>
    </div>

    <section v-if="galleryStore.loading" class="tournament-gallery__grid">
      <div v-for="index in 6" :key="index" class="tournament-gallery__skeleton t-skeleton"></div>
    </section>

    <p v-else-if="galleryStore.error" class="t-shell-card tournament-gallery__error">
      {{ galleryStore.error }}
      <button type="button" class="t-button t-button--secondary" @click="galleryStore.fetchImages(tournamentId)">Retry</button>
    </p>

    <section v-else-if="activeFolderKey && filteredImages.length" class="tournament-gallery__grid">
      <TournamentGalleryCard v-for="image in filteredImages" :key="image.id" :image="image" @open="openImage" />
    </section>

    <TournamentEmptyState
      v-else-if="activeFolderKey || !galleryStore.images.length"
      icon="Gallery"
      :title="galleryStore.images.length ? 'No matching images' : 'No tournament images yet'"
      :message="galleryStore.images.length ? 'This folder has no images yet. Open another folder or add one here.' : 'Tournament photos will appear here after an administrator adds them.'"
      @action="showAddModal = true"
    >
      <template v-if="canManageImages && !galleryStore.images.length" #action>Add first image</template>
    </TournamentEmptyState>

    <TournamentImageLightbox
      v-if="selectedImage"
      :image="selectedImage"
      :position="selectedIndex"
      :total="filteredImages.length"
      :can-delete="canManageImages"
      @close="closeImage"
      @previous="moveImage(-1)"
      @next="moveImage(1)"
      @share="shareImage"
      @delete="removeImage"
    />

    <TournamentImageAddModal
      v-if="showAddModal"
      :saving="galleryStore.saving"
      :categories="tournament.categories"
      @close="showAddModal = false"
      @save="addImage"
    />
  </section>

  <section v-else-if="!hasLoaded || tournamentStore.loading" class="tournament-gallery">
    <div class="t-shell-card tournament-gallery__loading">
      <span class="t-skeleton"></span>
      <span class="t-skeleton"></span>
      <span class="t-skeleton"></span>
    </div>
  </section>

  <section v-else class="tournament-gallery">
    <TournamentEmptyState
      title="Tournament not found"
      message="This gallery is not available. Open the tournaments page and choose an available tournament."
      @action="router.push('/tournaments')"
    >
      <template #action>Back to tournaments</template>
    </TournamentEmptyState>
  </section>
</template>

<style scoped>
.tournament-gallery__intro {
  display: grid;
  gap: 18px;
}

.tournament-gallery__intro-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.tournament-gallery__intro h2,
.tournament-gallery__intro p {
  margin: 0;
}

.tournament-gallery__intro h2 {
  margin-top: 4px;
  color: var(--tournament-ink);
  font-size: clamp(22px, 4vw, 30px);
  line-height: 1.15;
  letter-spacing: -0.035em;
}

.tournament-gallery__intro p {
  margin-top: 7px;
  color: var(--tournament-muted);
  font-size: 13px;
  font-weight: 500;
}

.tournament-gallery__hero-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.tournament-gallery__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.tournament-gallery__summary-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 72px;
  border: 0.5px solid rgba(15, 34, 24, 0.06);
  border-radius: var(--app-card-radius);
  padding: 14px 16px;
  box-shadow: 0 7px 20px rgba(15, 34, 24, 0.045);
}

.tournament-gallery__summary-card--green {
  background: rgba(0, 181, 26, 0.055);
}

.tournament-gallery__summary-card--yellow {
  background: rgba(255, 211, 61, 0.12);
}

.tournament-gallery__summary-card--blue {
  background: rgba(29, 111, 181, 0.055);
}

.tournament-gallery__summary-card span {
  color: var(--tournament-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.tournament-gallery__summary-card strong {
  color: var(--tournament-ink);
  font-size: 21px;
  line-height: 1;
}

.tournament-gallery__folder-header {
  display: grid;
  gap: 5px;
  padding-bottom: 2px;
}

.tournament-gallery__folder-header h2 {
  margin: 0;
  color: var(--tournament-ink);
  font-size: clamp(22px, 4vw, 28px);
  line-height: 1.15;
  letter-spacing: -0.035em;
}

.tournament-gallery__back {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--tournament-muted);
  font-size: 12px;
  font-weight: 800;
}

.tournament-gallery__back svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.tournament-gallery__folders {
  display: grid;
  gap: 14px;
}

.tournament-gallery__folder-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.tournament-gallery__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.tournament-gallery__skeleton {
  height: 250px;
}

.tournament-gallery__error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  color: var(--tournament-red);
}

.tournament-gallery__loading {
  display: grid;
  gap: 12px;
  padding: 20px;
}

@media (max-width: 980px) {
  .tournament-gallery__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .tournament-gallery__folder-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .tournament-gallery__grid,
  .tournament-gallery__folder-grid {
    grid-template-columns: 1fr;
  }

  .tournament-gallery__intro-top {
    flex-direction: column;
  }

  .tournament-gallery__summary {
    grid-template-columns: 1fr;
  }

  .tournament-gallery__hero-actions {
    display: grid;
    width: 100%;
  }
}
</style>
