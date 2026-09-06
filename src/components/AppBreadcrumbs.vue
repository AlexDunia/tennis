<script setup>
import { RouterLink } from 'vue-router'
defineProps({ items: { type: Array, default: () => [] } })
</script>

<template>
  <nav v-if="items.length > 1" class="app-breadcrumbs" aria-label="Breadcrumb">
    <ol>
      <li v-for="(item, index) in items" :key="`${index}-${item.label}`">
        <span v-if="index" class="app-breadcrumbs__separator" aria-hidden="true">&rsaquo;</span>
        <RouterLink v-if="item.to" :to="item.to" :title="item.label">{{ item.label }}</RouterLink>
        <span v-else aria-current="page" :title="item.label">{{ item.label }}</span>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.app-breadcrumbs { min-width: 0; max-width: 100%; margin-bottom: 6px; overflow-x: auto; scrollbar-width: none; }
.app-breadcrumbs ol { display: flex; flex-wrap: nowrap; width: max-content; align-items: center; gap: 3px 7px; margin: 0; padding: 0; list-style: none; }
.app-breadcrumbs li { display: inline-flex; align-items: center; gap: 7px; min-width: 0; max-width: 100%; flex-shrink: 0; font-size: 10px; font-weight: var(--font-weight-regular); line-height: 1.4; }
.app-breadcrumbs a, .app-breadcrumbs span[aria-current] { overflow: hidden; max-width: 200px; white-space: nowrap; text-overflow: ellipsis; color: var(--color-muted); text-decoration: none; }
.app-breadcrumbs a { transition: color var(--motion-short) var(--motion-curve); }
.app-breadcrumbs a:hover { color: var(--color-primary-strong); }
.app-breadcrumbs a:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; border-radius: 2px; }
.app-breadcrumbs span[aria-current] { color: var(--color-text-soft); }
.app-breadcrumbs__separator { color: var(--color-border-strong); }
@media (max-width: 640px) { .app-breadcrumbs a, .app-breadcrumbs span[aria-current] { max-width: 130px; } }
@media (prefers-reduced-motion: reduce) { .app-breadcrumbs a { transition: none; } }
</style>
