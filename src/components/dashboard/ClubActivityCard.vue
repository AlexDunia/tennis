<script setup>
import PersonAvatar from '../PersonAvatar.vue'

const props = defineProps({
  activity: { type: Object, required: true },
})

const emit = defineEmits({
  open: (activity) => Boolean(activity?.id),
})
</script>

<template>
  <button
    class="club-activity-card"
    type="button"
    :aria-label="`Open ${activity.title}`"
    @click="emit('open', props.activity)"
  >
    <span class="club-activity-card__image-wrap">
      <img :src="activity.image" alt="" loading="lazy" />
    </span>

    <span class="club-activity-card__body">
      <span class="club-activity-card__avatars" aria-hidden="true">
        <PersonAvatar
          v-for="person in activity.people.slice(0, 2)"
          :key="person.id || person.name"
          :name="person.name"
          :image="person.image"
          :size="32"
        />
      </span>

      <span class="club-activity-card__category">{{ activity.category }}</span>
      <strong>{{ activity.title }}</strong>

      <span v-if="activity.location" class="club-activity-card__location">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 17s5-4.55 5-9a5 5 0 1 0-10 0c0 4.45 5 9 5 9Z" />
          <circle cx="10" cy="8" r="1.7" />
        </svg>
        {{ activity.location }}
      </span>

      <span class="club-activity-card__chip" :class="`club-activity-card__chip--${activity.tone || 'green'}`">
        {{ activity.chip }}
      </span>
    </span>
  </button>
</template>

<style scoped>
.club-activity-card {
  display: grid;
  min-width: 0;
  min-height: 246px;
  grid-template-rows: 104px minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: calc(var(--app-card-radius) * 1.8);
  padding: 0;
  background: var(--color-surface);
  box-shadow: var(--flow-shadow-quiet);
  color: var(--color-text);
  text-align: left;
  white-space: normal;
}

.club-activity-card:hover {
  border-color: var(--color-border-strong);
  box-shadow: var(--flow-shadow-hover);
  transform: translateY(-2px);
}

.club-activity-card__image-wrap {
  display: block;
  width: 100%;
  height: 104px;
  overflow: hidden;
  background: var(--color-surface-soft);
}

.club-activity-card__image-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--motion-card) var(--motion-curve);
}

.club-activity-card:hover .club-activity-card__image-wrap img {
  transform: scale(1.025);
}

.club-activity-card__body {
  position: relative;
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  padding: 27px 15px 14px;
}

.club-activity-card__avatars {
  position: absolute;
  top: -17px;
  left: 14px;
  display: flex;
  padding-left: 1px;
}

.club-activity-card__avatars :deep(.person-avatar) {
  border: 2px solid var(--color-surface);
  background: var(--color-surface-soft);
  font-size: 0.65rem;
}

.club-activity-card__avatars :deep(.person-avatar + .person-avatar) {
  margin-left: -9px;
}

.club-activity-card__category {
  color: var(--color-primary-strong);
  font-size: 9.5px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.055em;
  line-height: 1.2;
  text-transform: uppercase;
}

.club-activity-card__body > strong {
  display: -webkit-box;
  min-height: 35px;
  margin-top: 5px;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.club-activity-card__location {
  display: flex;
  max-width: 100%;
  align-items: center;
  gap: 4px;
  margin-top: 5px;
  overflow: hidden;
  color: var(--color-muted);
  font-size: 10px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.club-activity-card__location svg {
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
}

.club-activity-card__chip {
  display: inline-flex;
  max-width: 100%;
  min-height: 24px;
  align-items: center;
  margin-top: auto;
  overflow: hidden;
  border-radius: 999px;
  padding: 5px 8px;
  font-size: 9px;
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.club-activity-card__chip--amber {
  background: rgba(255, 211, 61, 0.24);
  color: #795900;
}

.club-activity-card__chip--green {
  background: rgba(0, 181, 26, 0.1);
  color: var(--color-primary-strong);
}

@media (max-width: 767px) {
  .club-activity-card {
    min-height: 226px;
    grid-template-rows: 90px minmax(0, 1fr);
    scroll-snap-align: start;
  }

  .club-activity-card__image-wrap {
    height: 90px;
  }

  .club-activity-card__body {
    padding: 25px 11px 11px;
  }

  .club-activity-card__avatars {
    left: 10px;
  }

  .club-activity-card__category {
    font-size: 8px;
  }

  .club-activity-card__body > strong {
    min-height: 32px;
    font-size: 11.5px;
  }

  .club-activity-card__location {
    font-size: 8.5px;
  }

  .club-activity-card__chip {
    min-height: 22px;
    padding-inline: 7px;
    font-size: 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .club-activity-card,
  .club-activity-card__image-wrap img {
    transition: none;
  }
}
</style>
