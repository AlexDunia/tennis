<script setup>
import PersonAvatar from '../PersonAvatar.vue'

defineProps({
  rows: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits({
  challenge: (player) => Boolean(player?.id),
})
</script>

<template>
  <section class="member-ladder" aria-labelledby="member-ladder-title">
    <header class="member-ladder__header">
      <div>
        <h2 id="member-ladder-title">Where you stand</h2>
        <p>Your ladder position</p>
      </div>
    </header>

    <div v-if="loading" class="member-ladder__skeleton" aria-label="Ladder position loading">
      <div v-for="row in 4" :key="row" class="member-ladder__skeleton-row">
        <span class="member-ladder__skeleton-rank"></span>
        <span class="member-ladder__skeleton-avatar"></span>
        <span class="member-ladder__skeleton-copy"></span>
        <span class="member-ladder__skeleton-action"></span>
      </div>
    </div>

    <div v-else-if="error && !rows.length" class="member-ladder__message" role="status">
      <strong>Ladder unavailable</strong>
      <span>{{ error }}</span>
    </div>

    <div v-else-if="!rows.length" class="member-ladder__message" role="status">
      <strong>No active ladder position yet</strong>
      <span>Your nearby challenge range will appear here once your club ranks you.</span>
    </div>

    <ol v-else class="member-ladder__rows" aria-label="Nearby ladder positions">
      <li
        v-for="(row, index) in rows"
        :key="row.id"
        class="member-ladder__row"
        :class="{ 'member-ladder__row--current': row.isCurrent }"
      >
        <div
          class="member-ladder__rank-column"
          :class="{ 'member-ladder__rank-column--last': index === rows.length - 1 }"
          aria-hidden="true"
        >
          <span class="member-ladder__rank" :class="{ 'member-ladder__rank--current': row.isCurrent }">
            {{ row.rank }}
          </span>
        </div>

        <PersonAvatar :name="row.avatarName || row.name" :image="row.image" :size="42" />

        <div class="member-ladder__identity">
          <strong :class="{ 'member-ladder__you': row.isCurrent }">{{ row.name }}</strong>
          <span>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="m10 2.8 2.05 4.15 4.58.67-3.31 3.22.78 4.56L10 13.25 5.9 15.4l.78-4.56-3.31-3.22 4.58-.67L10 2.8Z" />
            </svg>
            {{ row.metric }}
          </span>
        </div>

        <div class="member-ladder__action">
          <button
            v-if="row.canChallenge"
            type="button"
            :aria-label="`Challenge ${row.avatarName || row.name}`"
            @click="emit('challenge', row)"
          >
            Challenge
          </button>
          <span v-else class="member-ladder__status" :class="{ 'member-ladder__status--current': row.isCurrent }">
            {{ row.status }}
          </span>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.member-ladder {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: calc(var(--app-card-radius) * 2.2);
  background: var(--color-surface);
  box-shadow: var(--flow-shadow-quiet);
}

.member-ladder__header {
  padding: 22px 24px 18px;
  border-bottom: 1px solid var(--color-border);
}

.member-ladder__header h2,
.member-ladder__header p {
  margin: 0;
}

.member-ladder__header h2 {
  font-size: clamp(19px, 2vw, 23px);
  line-height: 1.2;
}

.member-ladder__header p {
  margin-top: 3px;
  color: var(--color-muted);
  font-size: 12.5px;
  line-height: 1.45;
}

.member-ladder__rows {
  margin: 0;
  padding: 0;
  list-style: none;
}

.member-ladder__row {
  display: grid;
  min-height: 76px;
  grid-template-columns: 34px 42px minmax(0, 1fr) minmax(88px, auto);
  align-items: center;
  gap: 12px;
  padding: 10px 22px;
  border-bottom: 1px solid var(--color-border);
}

.member-ladder__row:last-child {
  border-bottom: 0;
}

.member-ladder__row--current {
  background: rgba(0, 181, 26, 0.075);
}

.member-ladder__rank-column {
  position: relative;
  display: grid;
  height: 100%;
  place-items: center;
}

.member-ladder__rank-column::after {
  content: '';
  position: absolute;
  top: calc(50% + 15px);
  left: 50%;
  width: 1px;
  height: calc(50% + 32px);
  background: var(--color-border-strong);
  transform: translateX(-50%);
}

.member-ladder__rank-column--last::after {
  display: none;
}

.member-ladder__rank {
  position: relative;
  z-index: 1;
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1px solid var(--color-border-strong);
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-text-soft);
  font-size: 12px;
  font-weight: var(--font-weight-bold);
  line-height: 1;
}

.member-ladder__rank--current {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-light);
}

.member-ladder__identity {
  min-width: 0;
}

.member-ladder__identity strong,
.member-ladder__identity span {
  display: flex;
  min-width: 0;
  align-items: center;
}

.member-ladder__identity strong {
  overflow: hidden;
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-ladder__identity .member-ladder__you {
  color: var(--color-primary-strong);
}

.member-ladder__identity span {
  gap: 4px;
  margin-top: 3px;
  color: var(--color-muted);
  font-size: 11.5px;
  line-height: 1.25;
}

.member-ladder__identity svg {
  width: 12px;
  height: 12px;
  fill: var(--color-primary);
}

.member-ladder__action {
  display: flex;
  min-width: 0;
  justify-content: flex-end;
}

.member-ladder__action button {
  min-width: 88px;
  min-height: 38px;
  border: 1px solid var(--color-primary);
  border-radius: var(--app-inner-radius);
  padding: 0 12px;
  background: var(--color-surface);
  color: var(--color-primary-strong);
  font-size: 11.5px;
  font-weight: var(--font-weight-bold);
}

.member-ladder__action button:hover {
  background: rgba(0, 181, 26, 0.06);
}

.member-ladder__status {
  max-width: 112px;
  color: var(--color-muted);
  font-size: 10.5px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.25;
  text-align: right;
}

.member-ladder__status--current {
  padding: 7px 9px;
  border-radius: 999px;
  background: rgba(0, 181, 26, 0.1);
  color: var(--color-primary-strong);
  white-space: nowrap;
}

.member-ladder__message {
  display: grid;
  min-height: 188px;
  place-content: center;
  gap: 5px;
  padding: 28px;
  color: var(--color-muted);
  text-align: center;
}

.member-ladder__message strong {
  color: var(--color-text-soft);
}

.member-ladder__message span {
  max-width: 420px;
  font-size: 13px;
  line-height: 1.5;
}

.member-ladder__skeleton-row {
  display: grid;
  min-height: 76px;
  grid-template-columns: 34px 42px minmax(0, 1fr) 88px;
  align-items: center;
  gap: 12px;
  padding: 10px 22px;
  border-bottom: 1px solid var(--color-border);
}

.member-ladder__skeleton-row:last-child {
  border-bottom: 0;
}

.member-ladder__skeleton-rank,
.member-ladder__skeleton-avatar,
.member-ladder__skeleton-copy,
.member-ladder__skeleton-action {
  display: block;
  background: var(--color-skeleton);
}

.member-ladder__skeleton-rank {
  width: 30px;
  height: 30px;
  border-radius: 50%;
}

.member-ladder__skeleton-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
}

.member-ladder__skeleton-copy {
  width: min(100%, 150px);
  height: 28px;
  border-radius: 8px;
}

.member-ladder__skeleton-action {
  width: 88px;
  height: 38px;
  border-radius: var(--app-inner-radius);
}

@media (max-width: 767px) {
  .member-ladder__header {
    padding: 19px 17px 15px;
  }

  .member-ladder__row,
  .member-ladder__skeleton-row {
    min-height: 72px;
    grid-template-columns: 30px 38px minmax(0, 1fr) minmax(72px, auto);
    gap: 8px;
    padding: 8px 13px;
  }

  .member-ladder__row :deep(.person-avatar) {
    width: 38px !important;
    height: 38px !important;
    font-size: 0.78rem;
  }

  .member-ladder__identity strong {
    font-size: 12.5px;
  }

  .member-ladder__identity span {
    font-size: 10px;
  }

  .member-ladder__action button {
    min-width: 72px;
    min-height: 36px;
    padding: 0 8px;
    font-size: 10.5px;
  }

  .member-ladder__status {
    max-width: 82px;
    font-size: 9.5px;
  }

  .member-ladder__status--current {
    padding: 6px 7px;
  }

  .member-ladder__skeleton-avatar {
    width: 38px;
    height: 38px;
  }

  .member-ladder__skeleton-action {
    width: 72px;
    height: 36px;
  }
}

@media (max-width: 360px) {
  .member-ladder__row,
  .member-ladder__skeleton-row {
    grid-template-columns: 28px 34px minmax(0, 1fr) minmax(64px, auto);
    gap: 6px;
    padding-inline: 10px;
  }

  .member-ladder__row :deep(.person-avatar) {
    width: 34px !important;
    height: 34px !important;
  }

  .member-ladder__action button {
    min-width: 64px;
    padding-inline: 5px;
  }
}
</style>
