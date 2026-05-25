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
  <div class="bracket-tree-mobile">
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
.bracket-tree-mobile {
  display: grid;
  gap: 1rem;
}

section {
  display: grid;
  gap: 0.75rem;
}

h3 {
  margin: 0;
}

@media (min-width: 1200px) {
  .bracket-tree-mobile {
    display: none;
  }
}
</style>
