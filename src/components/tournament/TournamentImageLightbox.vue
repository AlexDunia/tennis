<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  image: {
    type: Object,
    required: true,
  },
  position: {
    type: Number,
    required: true,
  },
  total: {
    type: Number,
    required: true,
  },
  canDelete: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits({
  close: null,
  previous: null,
  next: null,
  share: (image) => Boolean(image),
  delete: (image) => Boolean(image),
})

const zoom = ref(1)
const zoomLabel = computed(() => `${Math.round(zoom.value * 100)}%`)

function adjustZoom(amount) {
  zoom.value = Math.min(3, Math.max(1, Number((zoom.value + amount).toFixed(1))))
}

function handleKeydown(event) {
  if (event.key === 'Escape') emit('close')
  if (event.key === 'ArrowLeft') emit('previous')
  if (event.key === 'ArrowRight') emit('next')
  if (event.key === '+' || event.key === '=') adjustZoom(0.25)
  if (event.key === '-') adjustZoom(-0.25)
}

watch(
  () => props.image.id,
  () => {
    zoom.value = 1
  },
)

onMounted(() => {
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.body.style.overflow = ''
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="tournament-lightbox" role="dialog" aria-modal="true" :aria-label="image.caption || 'Tournament image viewer'">
    <header class="tournament-lightbox__header">
      <div>
        <strong>{{ image.caption || 'Tournament moment' }}</strong>
        <span>{{ position + 1 }} of {{ total }} · {{ zoomLabel }}</span>
      </div>
      <div class="tournament-lightbox__actions">
        <button type="button" aria-label="Zoom out" @click="adjustZoom(-0.25)">−</button>
        <button type="button" aria-label="Reset zoom" @click="zoom = 1">Reset</button>
        <button type="button" aria-label="Zoom in" @click="adjustZoom(0.25)">+</button>
        <button type="button" @click="emit('share', image)">Share</button>
        <button v-if="canDelete" type="button" class="tournament-lightbox__delete" @click="emit('delete', image)">Delete</button>
        <button type="button" aria-label="Close image viewer" @click="emit('close')">x</button>
      </div>
    </header>

    <button type="button" class="tournament-lightbox__nav tournament-lightbox__nav--previous" aria-label="Previous image" @click="emit('previous')">‹</button>
    <div class="tournament-lightbox__stage">
      <img :src="image.url" :alt="image.caption || 'Tournament image'" :style="{ transform: `scale(${zoom})` }" />
    </div>
    <button type="button" class="tournament-lightbox__nav tournament-lightbox__nav--next" aria-label="Next image" @click="emit('next')">›</button>

    <footer class="tournament-lightbox__footer">
      <span>{{ image.categoryName || 'All tournament images' }}</span>
      <small>Added by {{ image.uploadedByName || 'Tournament admin' }}</small>
    </footer>
  </div>
</template>

<style scoped>
.tournament-lightbox {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  background: rgba(3, 8, 5, 0.96);
  color: #fff;
}

.tournament-lightbox__header,
.tournament-lightbox__footer {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
}

.tournament-lightbox__header > div:first-child {
  display: grid;
}

.tournament-lightbox__header span,
.tournament-lightbox__footer,
.tournament-lightbox__footer small {
  color: rgba(255, 255, 255, 0.62);
  font-size: 11px;
  font-weight: 700;
}

.tournament-lightbox__actions,
.tournament-lightbox__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.tournament-lightbox button {
  min-height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  padding: 7px 11px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
}

.tournament-lightbox__delete {
  color: #ffaaa3 !important;
}

.tournament-lightbox__stage {
  overflow: auto;
  display: grid;
  place-items: center;
  padding: 18px 64px;
}

.tournament-lightbox__stage img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transition: transform 0.18s ease;
}

.tournament-lightbox__nav {
  position: fixed;
  z-index: 3;
  top: 50%;
  width: 44px;
  height: 56px;
  padding: 0 !important;
  font-size: 30px !important;
}

.tournament-lightbox__nav--previous {
  left: 12px;
}

.tournament-lightbox__nav--next {
  right: 12px;
}

@media (max-width: 720px) {
  .tournament-lightbox__header {
    align-items: stretch;
    flex-direction: column;
  }

  .tournament-lightbox__actions {
    overflow-x: auto;
    flex-wrap: nowrap;
  }

  .tournament-lightbox__stage {
    padding: 12px 46px;
  }
}
</style>
