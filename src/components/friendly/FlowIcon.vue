<script setup>
defineProps({
  name: { type: String, required: true },
})
</script>

<template>
  <svg class="flow-icon" viewBox="0 0 24 24" aria-hidden="true">
    <template v-if="name === 'friendly'">
      <circle cx="12" cy="12" r="7.5" />
      <path d="M6.4 8.5c3.5 1 6.9 4.4 8.9 8.7M17.6 7c-2.3.8-4.5 2.7-5.8 5" />
    </template>
    <template v-else-if="name === 'ladder'">
      <path d="M7 20V4M17 20V4M7 8h10M7 13h10M7 18h10" />
    </template>
    <template v-else-if="name === 'trophy'">
      <path d="M8 4h8v3.5c0 3-1.5 5-4 5s-4-2-4-5V4Z" />
      <path
        d="M8 6H5v1.5c0 2 1.2 3.2 3.4 3.4M16 6h3v1.5c0 2-1.2 3.2-3.4 3.4M12 12.5V17M8.5 20h7M10 17h4"
      />
    </template>
    <template v-else-if="name === 'play'">
      <path d="m9 7 8 5-8 5V7Z" />
    </template>
    <template v-else-if="name === 'calendar'">
      <rect x="4" y="5.5" width="16" height="14" rx="2" />
      <path d="M8 3.5v4M16 3.5v4M4 10h16M8 14h3" />
    </template>
    <template v-else-if="name === 'users'">
      <circle cx="9" cy="9" r="3" />
      <path
        d="M3.5 20c.5-3.4 2.3-5 5.5-5s5 1.6 5.5 5M15.5 6.5a3 3 0 0 1 0 5.8M16 15c2.7.2 4.1 1.8 4.5 5"
      />
    </template>
    <template v-else-if="name === 'copy'">
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </template>
    <template v-else-if="name === 'spark'">
      <path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z" />
      <path d="m18.5 15 .7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1Z" />
    </template>
    <template v-else-if="name === 'arrow-right'">
      <path d="M5 12h14M14 7l5 5-5 5" />
    </template>
    <template v-else-if="name === 'share'">
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" />
    </template>
    <template v-else-if="name === 'download'">
      <path d="M12 4v11M8 11l4 4 4-4M5 20h14" />
    </template>
    <template v-else-if="name === 'link'">
      <path
        d="m10 14 4-4M8.5 17.5l-1 1a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0M15.5 6.5l1-1a3.5 3.5 0 0 1 5 5l-3 3a3.5 3.5 0 0 1-5 0"
      />
    </template>
    <template v-else-if="name === 'close'">
      <path d="m7 7 10 10M17 7 7 17" />
    </template>
    <template v-else-if="name === 'login'">
      <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M13 8l4 4-4 4M8 12h9" />
    </template>
    <template v-else-if="name === 'home'">
      <path d="m4 11 8-7 8 7M6.5 9.5V20h11V9.5M10 20v-6h4v6" />
    </template>
    <template v-else-if="name === 'advantage'">
      <path d="M6 16V8M18 16V8M9 12h6" />
      <circle cx="6" cy="6" r="1.5" />
      <circle cx="18" cy="18" r="1.5" />
    </template>
    <template v-else-if="name === 'no-ad'">
      <path d="M5 12h14M12 5l7 7-7 7" />
      <circle cx="5" cy="12" r="2" />
    </template>
    <template v-else-if="name === 'sets'">
      <path d="M5 6h14M5 12h14M5 18h14" />
      <path d="M8 4v4M12 10v4M16 16v4" />
    </template>
    <template v-else-if="name === 'one-set'">
      <rect x="5" y="6" width="14" height="12" rx="2" />
      <path d="M9 12h6" />
    </template>
    <template v-else-if="name === 'tiebreak'">
      <circle cx="8" cy="12" r="4" />
      <circle cx="16" cy="12" r="4" />
      <path d="M10.5 9h3M10.5 15h3" />
    </template>
    <template v-else-if="name === 'bookmark'">
      <path d="M7 4h10v16l-5-3-5 3V4Z" />
    </template>
    <template v-else-if="name === 'sliders'">
      <path d="M4 7h5M15 7h5M4 17h9M17 17h3" />
      <circle cx="12" cy="7" r="3" />
      <circle cx="15" cy="17" r="2" />
    </template>
    <template v-else-if="name === 'send'">
      <path d="m4 5 16 7-16 7 3-7-3-7Z" />
      <path d="M7 12h13" />
    </template>
    <template v-else-if="name === 'check'">
      <path d="m5 12 4 4L19 6" />
    </template>
    <template v-else-if="name === 'plus'">
      <path d="M12 5v14M5 12h14" />
    </template>
  </svg>
</template>

<style scoped>
.flow-icon {
  display: block;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
