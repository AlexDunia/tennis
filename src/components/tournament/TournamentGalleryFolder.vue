<script setup>
import { computed } from 'vue'

const props = defineProps({
  folder: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits({
  open: (folder) => Boolean(folder),
})

const lastUploadedLabel = computed(() => {
  if (!props.folder.lastUploadedAt) return 'No uploads yet'
  return `Last uploaded ${new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(props.folder.lastUploadedAt))}`
})
</script>

<template>
  <button
    type="button"
    class="tournament-gallery-folder"
    :aria-label="`Open ${folder.name} folder`"
    @click="emit('open', folder)"
  >
    <span class="tournament-gallery-folder__preview">
      <img v-if="folder.coverUrl" :src="folder.coverUrl" :alt="`${folder.name} folder cover`" loading="lazy" />
      <span class="tournament-gallery-folder__overlay"></span>
      <span class="tournament-gallery-folder__title">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3.5 7.5h6l2-2h9v13h-17z" />
        </svg>
        <strong>{{ folder.name }}</strong>
        <small>{{ folder.count }} image{{ folder.count === 1 ? '' : 's' }}</small>
      </span>
    </span>
    <span class="tournament-gallery-folder__details">{{ lastUploadedLabel }}</span>
  </button>
</template>

<style scoped>
.tournament-gallery-folder {
  overflow: hidden;
  display: grid;
  min-width: 0;
  border: 0;
  border-radius: var(--app-card-radius);
  padding: 0 0 7px;
  background: transparent;
  color: var(--tournament-ink);
  text-align: left;
  transition: transform 0.2s var(--motion-curve);
}

.tournament-gallery-folder__preview {
  position: relative;
  overflow: hidden;
  display: grid;
  place-items: center;
  height: 168px;
  border-radius: var(--app-card-radius);
  background: rgba(0, 181, 26, 0.07);
  box-shadow: 0 8px 22px rgba(15, 34, 24, 0.08);
}

.tournament-gallery-folder__preview img,
.tournament-gallery-folder__overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.tournament-gallery-folder__preview img {
  object-fit: cover;
  transition: transform 0.3s var(--motion-curve);
}

.tournament-gallery-folder__overlay {
  background:
    linear-gradient(180deg, rgba(4, 10, 6, 0.12), rgba(4, 10, 6, 0.76)),
    linear-gradient(135deg, rgba(0, 181, 26, 0.08), transparent 55%);
}

.tournament-gallery-folder__title {
  position: relative;
  z-index: 1;
  display: grid;
  justify-items: center;
  gap: 3px;
  padding: 14px;
  color: #fff;
  text-align: center;
}

.tournament-gallery-folder__title svg {
  width: 19px;
  height: 19px;
  margin-bottom: 2px;
  fill: rgba(255, 255, 255, 0.1);
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linejoin: round;
}

.tournament-gallery-folder__title strong {
  font-size: 15px;
}

.tournament-gallery-folder__title small {
  color: rgba(255, 255, 255, 0.72);
  font-size: 10px;
  font-weight: 800;
}

.tournament-gallery-folder__details {
  padding: 8px 2px 0;
  color: var(--tournament-muted);
  font-size: 10px;
  font-weight: 700;
}

.tournament-gallery-folder:hover {
  transform: translateY(-2px);
}

.tournament-gallery-folder:hover img {
  transform: scale(1.04);
}
</style>
