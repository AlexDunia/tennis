<script setup>
import { computed } from 'vue'

const props = defineProps({
  club: { type: Object, default: null },
  ladders: { type: Array, default: () => [] },
  activeLadderId: { type: String, default: '' },
canManage: { type: Boolean, default: false },
  mode: {
    type: String,
    default: 'individual',
    validator: (value) =>
      ['individual', 'bulk'].includes(value),
  },
})

const emit = defineEmits([
  'select',
  'create',
  'import',
  'mode',
])

const clubName = computed(() => props.club?.name || 'Your tennis club')
const clubLogo = computed(
  () => props.club?.logoUrl || props.club?.avatarUrl || props.club?.setup?.workspace?.logoUrl || '',
)
const clubInitials = computed(() =>
  clubName.value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase(),
)
const yourLadders = computed(() => props.ladders.filter((ladder) => ladder.isMember))
const clubLadders = computed(() => props.ladders.filter((ladder) => !ladder.isMember))

function selectLadder(ladderId) {
  if (ladderId && ladderId !== props.activeLadderId) emit('select', ladderId)
}
</script>

<template>
  <div class="ladder-navigation">
    <div
      v-if="canManage"
      class="ladder-navigation__mobile-actions"
    >
      <button type="button" @click="emit('create')">
        + Add ladder
      </button>
      <button
        v-if="activeLadderId"
        type="button"
        @click="emit('import')"
      >
        Import
      </button>
    </div>

    <label class="ladder-navigation__mobile">
      <span>Ladder</span>
      <select
        :value="activeLadderId"
        aria-label="Choose a club ladder"
        @change="selectLadder($event.target.value)"
      >
        <option v-for="ladder in ladders" :key="ladder.id" :value="ladder.id">
          {{ ladder.name }}
        </option>
      </select>
    </label>
    <div
      v-if="canManage && activeLadderId"
      class="ladder-navigation__mobile-mode"
      aria-label="Ladder scheduling mode"
    >
      <button type="button" :class="{ active: mode === 'individual' }" :aria-pressed="mode === 'individual'" @click="emit('mode', 'individual')">Individual</button>
      <button type="button" :class="{ active: mode === 'bulk' }" :aria-pressed="mode === 'bulk'" @click="emit('mode', 'bulk')">Bulk</button>
    </div>

    <aside class="ladder-rail" aria-label="Club ladders">
      <div class="ladder-rail__club">
        <img v-if="clubLogo" :src="clubLogo" alt="" />
        <span v-else class="ladder-rail__initials" aria-hidden="true">{{ clubInitials }}</span>
        <span class="ladder-rail__club-copy">
          <strong>{{ clubName }}</strong>
          <small>Ladders</small>
        </span>
      </div>
      <div v-if="canManage && activeLadderId" class="ladder-rail__mode-wrap">
        <span class="ladder-rail__mode-label">Match setup mode</span>
        <div class="ladder-rail__mode" aria-label="Ladder scheduling mode">
          <button type="button" :class="{ active: mode === 'individual' }" :aria-pressed="mode === 'individual'" @click="emit('mode', 'individual')">Individual</button>
          <button type="button" :class="{ active: mode === 'bulk' }" :aria-pressed="mode === 'bulk'" @click="emit('mode', 'bulk')">Bulk</button>
        </div>
      </div>

      <div v-if="canManage" class="ladder-rail__actions">
        <button type="button" @click="emit('create')">
          <span>+ Add ladder</span>
        </button>
        <button
          v-if="activeLadderId"
          type="button"
          class="ladder-rail__import"
          @click="emit('import')"
        >
          <span>Import ladder</span>
        </button>
      </div>

      <section v-if="yourLadders.length" class="ladder-rail__group">
        <h2>Your ladders</h2>
        <button
          v-for="ladder in yourLadders"
          :key="ladder.id"
          type="button"
          :class="{ active: ladder.id === activeLadderId }"
          :aria-current="ladder.id === activeLadderId ? 'page' : undefined"
          @click="selectLadder(ladder.id)"
        >
          <span><i aria-hidden="true"></i>{{ ladder.name }}</span>
          <small>
  {{ ladder.status === 'setup' ? 'Setup' : ladder.playerCount }}
</small>
        </button>
      </section>

      <section v-if="clubLadders.length" class="ladder-rail__group">
        <h2>Club ladders</h2>
        <button
          v-for="ladder in clubLadders"
          :key="ladder.id"
          type="button"
          :class="{ active: ladder.id === activeLadderId }"
          :aria-current="ladder.id === activeLadderId ? 'page' : undefined"
          @click="selectLadder(ladder.id)"
        >
          <span><i aria-hidden="true"></i>{{ ladder.name }}</span>
          <small>
  {{ ladder.status === 'setup' ? 'Setup' : ladder.playerCount }}
</small>
        </button>
      </section>
    </aside>
  </div>
</template>

<style scoped>
.ladder-navigation {
  min-width: 0;
}

.ladder-navigation__mobile {
  display: none;
}

.ladder-rail {
  width: 236px;
  position: sticky;
  top: var(--app-header-height);
  height: calc(100dvh - var(--app-header-height));
  min-height: 0;
  overflow-y: auto;
  scrollbar-gutter: auto;
  scrollbar-width: thin;
  overscroll-behavior: contain;
  padding: 22px 14px;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
}


.ladder-rail::-webkit-scrollbar { width: 6px; }
.ladder-rail::-webkit-scrollbar-track { background: transparent; }
.ladder-rail::-webkit-scrollbar-thumb { border-radius: 999px; background: rgba(22, 61, 43, .18); }
.ladder-rail__club {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 4px 7px 17px;
  border-bottom: 1px solid var(--color-border);
}

.ladder-rail__club img,
.ladder-rail__initials {
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  border-radius: 9px;
}

.ladder-rail__club img {
  object-fit: cover;
}

.ladder-rail__initials {
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--color-primary) 9%, white);
  color: var(--color-primary-strong);
  font-size: 11px;
  font-weight: var(--font-weight-bold);
}

.ladder-rail__club-copy {
  display: grid;
  min-width: 0;
}

.ladder-rail__club-copy strong {
  overflow: hidden;
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ladder-rail__club-copy small {
  margin-top: 2px;
  color: var(--color-muted);
  font-size: 10px;
}


.ladder-rail__mode-wrap { display: none; }
.ladder-rail__mode-label { display: block; padding: 0 9px 6px; color: var(--color-muted); font-size: 9px; font-weight: var(--font-weight-semibold); letter-spacing: .08em; text-transform: uppercase; }
.ladder-rail__mode-wrap .ladder-rail__mode { margin: 0 0 4px; }
.ladder-rail__mode { display:grid; grid-template-columns:1fr 1fr; gap:4px; margin:14px 0 4px; padding:4px; border-radius:10px; background:color-mix(in srgb,var(--color-text) 4%,white); }
.ladder-rail__mode button { min-height:34px; padding:0 8px; border:0; border-radius:7px; background:transparent; color:var(--color-muted); font-size:10px; font-weight:var(--font-weight-semibold); }
.ladder-rail__mode button.active { background:#111; color:#fff; box-shadow:0 2px 8px rgba(0,0,0,.16); }
.ladder-navigation__mobile-mode { display:none; }.ladder-rail__group {
  margin-top: 20px;
}

.ladder-rail__group h2 {
  margin: 0;
  padding: 0 9px 8px;
  color: var(--color-muted);
  font-size: 9px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.ladder-rail__group button {
  display: flex;
  width: 100%;
  min-height: 44px;
  margin: 2px 0;
  align-items: center;
  justify-content: space-between;
  gap: 9px;
  padding: 0 9px;
  border: 0;
  border-radius: var(--app-inner-radius);
  background: transparent;
  color: var(--color-text-soft);
  font-size: 12px;
  font-weight: var(--font-weight-medium);
  text-align: left;
}

.ladder-rail__group button:hover {
  background: var(--color-surface-soft);
}

.ladder-rail__group button.active {
  background: color-mix(in srgb, var(--color-primary) 8%, white);
  color: var(--color-primary-strong);
}

.ladder-rail__group button > span {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ladder-rail__group i {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border: 1px solid var(--color-border-strong);
  border-radius: 50%;
}

.ladder-rail__group button.active i {
  border-color: var(--color-primary);
  background: var(--color-primary);
}

.ladder-rail__group button small {
  color: var(--color-muted);
  font-size: 10px;
}

.ladder-rail__actions {
  display: grid;
  gap: 6px;
  margin-top: 14px;
  padding: 0 1px 5px;
}

.ladder-rail__actions button {
  min-height: 40px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-control-radius, 9px);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  text-align: left;
}

.ladder-rail__actions button:hover {
  border-color: var(--color-border-strong);
  background: var(--color-surface-soft);
}

.ladder-rail__actions .ladder-rail__import {
  border-color: transparent;
  color: var(--color-primary-strong);
}

.ladder-navigation__mobile-actions {
  display: none;
}

@media (max-width: 767px) {  .ladder-navigation__mobile-mode { display:grid; grid-template-columns:1fr 1fr; gap:4px; margin:10px 12px 0; padding:4px; border-radius:10px; background:color-mix(in srgb,var(--color-text) 4%,white); }
  .ladder-navigation__mobile-mode button { min-height:38px; border:0; border-radius:7px; background:transparent; color:var(--color-muted); font-size:11px; font-weight:var(--font-weight-semibold); }
  .ladder-navigation__mobile-mode button.active { background:#111; color:#fff; box-shadow:0 2px 8px rgba(0,0,0,.16); }
  .ladder-navigation__mobile-actions {
    display: flex;
    gap: 8px;
    padding: 14px 12px 0;
  }

  .ladder-navigation__mobile-actions button {
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--app-control-radius, 9px);
    background: var(--color-surface);
    color: var(--color-text);
    font-family: inherit;
    font-size: 12px;
    font-weight: var(--font-weight-semibold);
  }

  .ladder-navigation__mobile select {
    padding:
      0
      var(--app-select-padding-right, 38px)
      0
      var(--app-control-padding-inline, 12px);
  }

  .ladder-navigation__mobile {
    display: grid;
    gap: 6px;
    padding: 16px 12px 0;
  }

  .ladder-navigation__mobile span {
    color: var(--color-muted);
    font-size: 10px;
    font-weight: var(--font-weight-semibold);
    text-transform: uppercase;
  }

  .ladder-navigation__mobile select {
    width: 100%;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--app-inner-radius);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 13px;
    font-weight: var(--font-weight-semibold);
  }

  .ladder-rail {
    display: none;
  }
}

/* Ladder selection changes only on click; selected ladders share one clear state. */
.ladder-rail__group button,
.ladder-rail__mode button,
.ladder-navigation__mobile-mode button {
  transition: none;
}

.ladder-rail__group button:hover,
.ladder-rail__actions button:hover {
  background: transparent;
  border-color: inherit;
}

.ladder-rail__group button.active {
  background: #111;
  color: #fff;
}

.ladder-rail__group button.active small {
  color: rgba(255, 255, 255, .72);
}

.ladder-rail__group button.active i {
  border-color: #fff;
  background: #fff;
}
</style>
