<script setup>
import BracketNode from './BracketNode.vue'

defineProps({
  knockout: {
    type: Object,
    required: true,
  },
  canManage: {
    type: Boolean,
    default: false,
  },
  currentPlayerId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits({
  score: (match) => Boolean(match),
})
</script>

<template>
  <div class="bracket-tree">
    <section v-if="knockout.quarterFinals?.length">
      <h3>Quarterfinals</h3>
      <BracketNode
        v-for="match in knockout.quarterFinals"
        :key="match.id"
        :can-manage="canManage"
        :current-player-id="currentPlayerId"
        :match="match"
        @score="emit('score', $event)"
      />
    </section>
    <section v-if="knockout.semiFinals?.length">
      <h3>Semifinals</h3>
      <BracketNode
        v-for="match in knockout.semiFinals"
        :key="match.id"
        :can-manage="canManage"
        :current-player-id="currentPlayerId"
        :match="match"
        @score="emit('score', $event)"
      />
    </section>
    <section v-if="knockout.final">
      <h3>Final</h3>
      <BracketNode
        :can-manage="canManage"
        :current-player-id="currentPlayerId"
        :match="knockout.final"
        @score="emit('score', $event)"
      />
    </section>
  </div>
</template>

<style scoped>
.bracket-tree {
  display: none;
  gap: 1.25rem;
  align-items: center;
  overflow-x: auto;
  padding: 8px 0;
}

section {
  display: grid;
  gap: 1rem;
  min-width: 180px;
}

h3 {
  margin: 0;
  color: var(--tournament-faint);
  font-size: 11px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.07em;
  text-align: center;
  text-transform: uppercase;
}

@media (min-width: 1200px) {
  .bracket-tree {
    display: grid;
    grid-template-columns: repeat(3, max-content);
  }
}
</style>
