<script setup>
import { computed } from 'vue'
import {
  PRESET_EVENTS,
  formatLabel,
  unitForType,
} from '../../../utils/tournament/tournamentCreation'

const props = defineProps({
  events: { type: Array, default: () => [] },
  error: { type: String, default: '' },
})

const emit = defineEmits({
  open: (payload) => Boolean(payload),
  continue: () => true,
})

const singles = PRESET_EVENTS.filter((event) => event.group === 'Singles')
const doubles = PRESET_EVENTS.filter((event) => event.group === 'Doubles')
const customEvents = computed(() => props.events.filter((event) => event.custom))

function configuredEvent(id) {
  return props.events.find((event) => event.id === id)
}

function summary(event) {
  const parts = []
  if (event.age !== 'Open') parts.push(event.age)
  if (event.ability !== 'Open') parts.push(event.ability)
  parts.push(formatLabel(event.format))
  parts.push(`${event.capacity} ${unitForType(event.type)} max`)
  return parts.join(' · ')
}
</script>

<template>
  <section class="creation-step" aria-labelledby="events-heading">
    <header class="step-heading">
      <h1 id="events-heading">Events</h1>
      <p>Pick what people can enter. Tap an event to set it up.</p>
    </header>

    <section class="event-group">
      <h2>Singles</h2>
      <div class="event-list">
        <button
          v-for="preset in singles"
          :key="preset.id"
          class="event-row"
          :class="{ 'event-row--configured': configuredEvent(preset.id) }"
          type="button"
          @click="emit('open', { preset, event: configuredEvent(preset.id) })"
        >
          <span class="event-state" aria-hidden="true">✓</span>
          <span class="event-row__copy">
            <strong>{{ preset.name }}</strong>
            <small>{{
              configuredEvent(preset.id) ? summary(configuredEvent(preset.id)) : 'Tap to set up'
            }}</small>
          </span>
          <span class="event-chevron" aria-hidden="true">›</span>
        </button>
      </div>
    </section>

    <section class="event-group">
      <h2>Doubles</h2>
      <div class="event-list">
        <button
          v-for="preset in doubles"
          :key="preset.id"
          class="event-row"
          :class="{ 'event-row--configured': configuredEvent(preset.id) }"
          type="button"
          @click="emit('open', { preset, event: configuredEvent(preset.id) })"
        >
          <span class="event-state" aria-hidden="true">✓</span>
          <span class="event-row__copy">
            <strong>{{ preset.name }}</strong>
            <small>{{
              configuredEvent(preset.id) ? summary(configuredEvent(preset.id)) : 'Tap to set up'
            }}</small>
          </span>
          <span class="event-chevron" aria-hidden="true">›</span>
        </button>
      </div>
    </section>

    <section v-if="customEvents.length" class="event-group">
      <h2>Other events</h2>
      <div class="event-list">
        <button
          v-for="event in customEvents"
          :key="event.id"
          class="event-row event-row--configured"
          type="button"
          @click="emit('open', { event, custom: true })"
        >
          <span class="event-state" aria-hidden="true">✓</span>
          <span class="event-row__copy">
            <strong>{{ event.name }}</strong>
            <small>{{ summary(event) }}</small>
          </span>
          <span class="event-chevron" aria-hidden="true">›</span>
        </button>
      </div>
    </section>

    <button class="add-event-button" type="button" @click="emit('open', { custom: true })">
      <span aria-hidden="true">+</span> Add another event
    </button>
    <small v-if="error" class="field-error" role="alert">{{ error }}</small>

    <button
      class="button-primary step-primary"
      type="button"
      :disabled="!events.length"
      @click="emit('continue')"
    >
      Review tournament
    </button>
  </section>
</template>
