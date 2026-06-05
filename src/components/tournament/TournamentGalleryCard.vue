<script setup>
defineProps({
  image: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits({
  open: (image) => Boolean(image),
})
</script>

<template>
  <button
    type="button"
    class="tournament-gallery-card t-fade-up"
    :aria-label="`Open ${image.caption || 'tournament image'}`"
    @click="emit('open', image)"
  >
    <img :src="image.thumbnailUrl || image.url" :alt="image.caption || 'Tournament image'" loading="lazy" />
    <span class="tournament-gallery-card__shade"></span>
    <span class="tournament-gallery-card__content">
      <span>{{ image.categoryName || 'All tournament images' }}</span>
    </span>
  </button>
</template>

<style scoped>
.tournament-gallery-card {
  position: relative;
  overflow: hidden;
  min-height: 250px;
  border: 0;
  border-radius: var(--app-card-radius);
  padding: 0;
  background: var(--tournament-shell);
  cursor: zoom-in;
  text-align: left;
}

.tournament-gallery-card img,
.tournament-gallery-card__shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.tournament-gallery-card img {
  object-fit: cover;
  transition: transform 0.35s var(--motion-curve);
}

.tournament-gallery-card__shade {
  background: linear-gradient(180deg, transparent 68%, rgba(5, 12, 8, 0.38) 100%);
}

.tournament-gallery-card__content {
  position: absolute;
  z-index: 1;
  bottom: 10px;
  left: 10px;
}

.tournament-gallery-card__content span {
  display: inline-flex;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  padding: 3px 7px;
  background: rgba(5, 12, 8, 0.28);
  color: rgba(255, 255, 255, 0.76);
  font-size: 9px;
  font-weight: 700;
  backdrop-filter: blur(5px);
}

.tournament-gallery-card:hover img {
  transform: scale(1.045);
}
</style>
