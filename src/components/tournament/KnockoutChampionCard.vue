<script setup>
defineProps({
  champion: {
    type: Object,
    required: true,
  },
  categoryName: {
    type: String,
    required: true,
  },
  tournamentName: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <article class="knockout-champion-card">
    <p>Champion</p>
    <h2>{{ champion.name }}</h2>
    <span>Category: {{ categoryName }} - {{ tournamentName }}</span>
  </article>
</template>

<style scoped>
.knockout-champion-card {
  display: grid;
  gap: 6px;
  padding: 28px;
  border: none;
  border-radius: var(--app-card-radius);
  background: linear-gradient(135deg, #087524, #00b51a);
  color: #ffffff;
  text-align: center;
  box-shadow: 0 14px 34px rgba(0, 181, 26, 0.18);
}

p,
h2,
span {
  margin: 0;
}

p {
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h2 {
  color: #ffffff;
  font-size: 28px;
  font-weight: 900;
  letter-spacing: -0.04em;
}

span {
  color: rgba(255, 255, 255, 0.72);
  font-size: 13px;
  font-weight: 700;
}
</style>
