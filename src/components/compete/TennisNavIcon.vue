<script setup>
defineProps({
  kind: {
    type: String,
    default: 'ball',
  },
  size: {
    type: [Number, String],
    default: 18,
  },
})
</script>

<template>
  <span
    class="tennis-nav-icon"
    :class="`tennis-nav-icon--${kind}`"
    :style="{ '--tennis-icon-size': `${size}px` }"
    aria-hidden="true"
  >
    <svg v-if="kind === 'ladder'" viewBox="0 0 24 24">
      <path d="M5 19v-5M11 19V9M17 19V5" />
      <circle cx="19" cy="16" r="3" class="tennis-nav-icon__ball" />
      <path d="M16.8 14.2c1 .2 1.8 1 2.1 2.1M21.2 14.4c-.9.6-1.5 1.5-1.6 2.6" class="tennis-nav-icon__seam" />
    </svg>

    <svg v-else-if="kind === 'challenge'" viewBox="0 0 24 24">
      <ellipse cx="8" cy="7.5" rx="4.2" ry="5.5" transform="rotate(-28 8 7.5)" />
      <path d="m10.2 12-4.4 7.3M5.3 4.3l5.4 6.4M4 7.2l7.7.6" />
      <ellipse cx="16" cy="7.5" rx="4.2" ry="5.5" transform="rotate(28 16 7.5)" />
      <path d="m13.8 12 4.4 7.3M18.7 4.3l-5.4 6.4M20 7.2l-7.7.6" />
      <circle cx="12" cy="18.5" r="2.2" class="tennis-nav-icon__ball" />
    </svg>

    <svg v-else-if="kind === 'trophy'" viewBox="0 0 24 24">
      <path d="M8 4h8v3.2a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 11v5M8.5 20h7M9 16h6" />
    </svg>

    <svg v-else-if="kind === 'calendar'" viewBox="0 0 24 24">
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M8 3v4M16 3v4M4 9h16" />
      <circle cx="12" cy="14.5" r="2.5" class="tennis-nav-icon__ball" />
    </svg>

    <svg v-else viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" class="tennis-nav-icon__ball" />
      <path d="M5 8c4 .7 7.4 4 8 8M19 7c-3.8 2.1-6 5.7-6 10" class="tennis-nav-icon__seam" />
    </svg>
  </span>
</template>

<style scoped>
.tennis-nav-icon {
  display: inline-grid;
  width: var(--tennis-icon-size);
  height: var(--tennis-icon-size);
  flex: 0 0 var(--tennis-icon-size);
  place-items: center;
  color: currentColor;
  transform-origin: 50% 76%;
}

.tennis-nav-icon svg {
  width: 100%;
  height: 100%;
  overflow: visible;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.55;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.tennis-nav-icon__ball {
  fill: none;
  stroke: currentColor;
}

.tennis-nav-icon__seam {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.1;
}
</style>
