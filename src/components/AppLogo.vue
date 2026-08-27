<script setup>
import { computed } from 'vue'
import { GORRA_LOGO_ON_DARK_URL, GORRA_LOGO_URL } from '../config/branding'

const props = defineProps({
  onDark: {
    type: Boolean,
    default: false,
  },
})

const logoSource = computed(() => (props.onDark ? GORRA_LOGO_ON_DARK_URL : GORRA_LOGO_URL))
</script>

<template>
  <img
    class="app-logo cloudinary-img"
    :class="onDark ? 'app-logo--on-dark' : 'app-logo--on-light'"
    :src="logoSource"
    alt="Gorra"
    decoding="async"
  />
</template>

<style scoped>
.app-logo {
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
}

.app-logo--on-light {
  filter: brightness(0) saturate(100%);
}

.app-logo--on-dark {
  filter: none;
}
</style>
