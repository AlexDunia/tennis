<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { liveMatchPresenceService } from '../../services/LiveMatchPresenceService.js'

const props = defineProps({
  matchId: { type: String, default: '' },
  actorId: { type: String, default: '' },
  actorName: { type: String, default: '' },
  role: { type: String, default: 'viewer' },
  announce: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
})

const emit = defineEmits(['joined'])
const entries = ref([])
let stopSubscription = () => {}
let presence = null
let ownPresenceId = ''

const visibleEntries = computed(() => entries.value.filter((entry) => entry.presenceId !== ownPresenceId))
const displayedNames = computed(() => visibleEntries.value.slice(0, 3))
const extraCount = computed(() => Math.max(0, visibleEntries.value.length - displayedNames.value.length))
const watchingLabel = computed(() => {
  const count = visibleEntries.value.length
  if (!count) return ''
  if (props.compact) return `${count} watching`
  const names = displayedNames.value.map((entry) => entry.actorName || 'Someone').join(', ')
  return extraCount.value ? `${names} +${extraCount.value} watching` : `${names} watching`
})

function leavePresence() {
  presence?.leave()
  presence = null
  ownPresenceId = ''
}

function bind() {
  stopSubscription()
  leavePresence()
  entries.value = []
  if (!props.matchId) return
  stopSubscription = liveMatchPresenceService.subscribe(props.matchId, (nextEntries, event) => {
    entries.value = nextEntries
    if (event.type === 'join' && event.entry?.presenceId !== ownPresenceId && event.entry?.actorId !== props.actorId) emit('joined', event.entry)
  })
  if (props.announce && props.actorId) {
    presence = liveMatchPresenceService.join({
      matchId: props.matchId,
      actorId: props.actorId,
      actorName: props.actorName,
      role: props.role,
    })
    ownPresenceId = presence.presenceId
  }
}

watch(() => [props.matchId, props.actorId, props.actorName, props.announce], bind, { immediate: true })
watch(() => props.role, (role) => presence?.updateRole(role))

onBeforeUnmount(() => {
  stopSubscription()
  leavePresence()
})
</script>

<template>
  <p v-if="watchingLabel" class="live-presence-strip" :class="{ 'live-presence-strip--compact': compact }" aria-live="polite">
    <span aria-hidden="true">●</span>
    {{ watchingLabel }}
  </p>
</template>

<style scoped>
.live-presence-strip {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0.8rem 0 0;
  color: var(--color-muted);
  font-size: 0.78rem;
}
.live-presence-strip > span { color: var(--color-accent-bright); font-size: 0.62rem; }
.live-presence-strip--compact { margin: 0; font-size: 0.72rem; }
</style>