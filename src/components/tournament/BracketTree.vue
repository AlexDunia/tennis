<script setup>
import BracketNode from './BracketNode.vue'

defineProps({
  knockout: {
    type: Object,
    required: true,
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
      <BracketNode v-for="match in knockout.quarterFinals" :key="match.id" :match="match" @score="emit('score', $event)" />
    </section>
    <section v-if="knockout.semiFinals?.length">
      <h3>Semifinals</h3>
      <BracketNode v-for="match in knockout.semiFinals" :key="match.id" :match="match" @score="emit('score', $event)" />
    </section>
    <section v-if="knockout.final">
      <h3>Final</h3>
      <BracketNode :match="knockout.final" @score="emit('score', $event)" />
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
  font-weight: 900;
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
