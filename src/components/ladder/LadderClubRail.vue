<script setup>
import { computed } from 'vue'

const props = defineProps({
  club: { type: Object, default: null },
  ladders: { type: Array, default: () => [] },
  activeLadderId: { type: String, default: '' },
})

const emit = defineEmits(['select'])

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

    <aside class="ladder-rail" aria-label="Club ladders">
      <div class="ladder-rail__club">
        <img v-if="clubLogo" :src="clubLogo" alt="" />
        <span v-else class="ladder-rail__initials" aria-hidden="true">{{ clubInitials }}</span>
        <span class="ladder-rail__club-copy">
          <strong>{{ clubName }}</strong>
          <small>Ladders</small>
        </span>
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
          <small>{{ ladder.playerCount }}</small>
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
          <small>{{ ladder.playerCount }}</small>
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
  height: 100%;
  min-height: calc(100vh - var(--app-header-height));
  padding: 22px 14px;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
}

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

.ladder-rail__group {
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

@media (max-width: 767px) {
  .ladder-navigation__mobile {
    display: grid;
    gap: 6px;
    padding: 14px 7.5vw 0;
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
</style>
