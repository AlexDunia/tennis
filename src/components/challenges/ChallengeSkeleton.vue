<template>
  <section class="challenge-skeleton" role="status" aria-label="Loading challenges">
    <span class="challenge-skeleton__sr">Loading challenges</span>

    <div class="challenge-skeleton__summary">
      <article v-for="index in 2" :key="`summary-${index}`" class="challenge-skeleton__panel">
        <span class="skeleton skeleton-line challenge-skeleton__eyebrow"></span>
        <div class="challenge-skeleton__identity">
          <span class="skeleton skeleton-shape challenge-skeleton__avatar"></span>
          <div class="challenge-skeleton__copy">
            <span class="skeleton skeleton-line challenge-skeleton__name"></span>
            <span class="skeleton skeleton-line challenge-skeleton__meta"></span>
          </div>
        </div>
      </article>
    </div>

    <div class="challenge-skeleton__tabs" aria-hidden="true">
      <span v-for="width in ['72px', '94px', '102px', '126px']" :key="width" class="skeleton skeleton-shape" :style="{ width }"></span>
    </div>

    <div class="challenge-skeleton__list">
      <article v-for="index in 3" :key="`row-${index}`" class="challenge-skeleton__row">
        <span class="skeleton skeleton-shape challenge-skeleton__avatar"></span>
        <div class="challenge-skeleton__copy">
          <span class="skeleton skeleton-line challenge-skeleton__row-title" :style="{ width: index === 2 ? '48%' : '58%' }"></span>
          <span class="skeleton skeleton-line challenge-skeleton__row-meta" :style="{ width: index === 3 ? '62%' : '72%' }"></span>
        </div>
        <span class="skeleton skeleton-shape challenge-skeleton__button"></span>
      </article>
    </div>
  </section>
</template>

<style scoped>
.challenge-skeleton {
  display: grid;
  gap: 22px;
  width: 100%;
  padding-bottom: 24px;
}

.challenge-skeleton__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.challenge-skeleton__summary {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 18px;
}

.challenge-skeleton__panel,
.challenge-skeleton__row {
  border: var(--app-hairline);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
}

.challenge-skeleton__panel {
  min-height: 158px;
  padding: 24px;
}

.challenge-skeleton__eyebrow {
  width: 92px;
  min-height: 10px;
}

.challenge-skeleton__identity {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 22px;
}

.challenge-skeleton__avatar {
  width: 46px;
  height: 46px;
  flex: 0 0 46px;
  border-radius: 50%;
}

.challenge-skeleton__copy {
  display: grid;
  flex: 1;
  gap: 9px;
}

.challenge-skeleton__name {
  width: 46%;
  min-height: 14px;
}

.challenge-skeleton__meta {
  width: 68%;
  min-height: 11px;
}

.challenge-skeleton__tabs {
  display: flex;
  gap: 7px;
  width: fit-content;
  padding: 4px;
  border-radius: var(--app-card-radius);
  background: var(--color-surface-soft);
}

.challenge-skeleton__tabs .skeleton-shape {
  height: 36px;
  border-radius: var(--app-inner-radius);
}

.challenge-skeleton__list {
  display: grid;
  gap: 12px;
}

.challenge-skeleton__row {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) 104px;
  align-items: center;
  gap: 15px;
  min-height: 96px;
  padding: 20px;
}

.challenge-skeleton__row-title {
  min-height: 14px;
}

.challenge-skeleton__row-meta {
  min-height: 11px;
}

.challenge-skeleton__button {
  width: 104px;
  height: 42px;
  border-radius: var(--app-inner-radius);
}

@media (max-width: 760px) {
  .challenge-skeleton__summary {
    grid-template-columns: 1fr;
  }

  .challenge-skeleton__tabs {
    width: 100%;
    overflow: hidden;
  }

  .challenge-skeleton__tabs .skeleton-shape {
    flex: 1 0 72px;
  }
}

@media (max-width: 520px) {
  .challenge-skeleton__row {
    grid-template-columns: 42px minmax(0, 1fr);
    padding: 16px;
  }

  .challenge-skeleton__avatar {
    width: 42px;
    height: 42px;
    flex-basis: 42px;
  }

  .challenge-skeleton__button {
    grid-column: 2;
    width: min(140px, 100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .challenge-skeleton :deep(.skeleton)::before,
  .challenge-skeleton :deep(.skeleton-line)::before,
  .challenge-skeleton :deep(.skeleton-shape)::before {
    animation: none;
  }
}
</style>
