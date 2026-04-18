<template>
  <div class="countdown">
    <p class="countdown__label">{{ label }}</p>
    <p class="countdown__value">{{ formattedRemaining }}</p>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  targetDate: { type: String, required: true },
  label: { type: String, default: 'Countdown' },
})

const remaining = ref(getRemaining())
let timer = null

function getRemaining() {
  const target = new Date(props.targetDate)
  const difference = Math.max(0, target.getTime() - Date.now())
  return {
    days: Math.floor(difference / 86400000),
    hours: Math.floor((difference % 86400000) / 3600000),
    minutes: Math.floor((difference % 3600000) / 60000),
    seconds: Math.floor((difference % 60000) / 1000),
  }
}

function updateRemaining() {
  remaining.value = getRemaining()
}

onMounted(() => {
  timer = setInterval(updateRemaining, 1000)
})

onBeforeUnmount(() => {
  clearInterval(timer)
})

const formattedRemaining = computed(() => {
  const { days, hours, minutes, seconds } = remaining.value
  return `${days}d ${hours}h ${minutes}m ${seconds}s`
})
</script>

<style scoped>
.countdown {
  border-radius: 1rem;
  background: #eef2ff;
  padding: 1rem 1.2rem;
  display: inline-flex;
  flex-direction: column;
  gap: 0.35rem;
}
.countdown__label {
  margin: 0;
  font-size: 0.9rem;
  color: #4f46e5;
  font-weight: 700;
}
.countdown__value {
  margin: 0;
  font-size: 1.25rem;
  color: #1f2937;
}
</style>
