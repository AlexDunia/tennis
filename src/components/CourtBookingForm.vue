<script setup>
// IMPORTS
import { computed, ref } from 'vue'

// PROPS
const props = defineProps({
  slots: {
    type: Array,
    default: () => [],
  },
})

// EMITS
const emit = defineEmits(['book'])

// ROUTER / ROUTE
// none

// STORES
// none

// REACTIVE STATE
const selectedDate = ref(new Date().toISOString().slice(0, 10))
const selectedHour = ref(null)
const selectedDuration = ref(1)
const customDescription = ref('')
const isSubmitting = ref(false)
const errorMessage = ref('')

// COMPUTED PROPERTIES
const availableSlots = computed(() => props.slots.filter((slot) => slot.date === selectedDate.value))
const selectedSlotLabel = computed(() => {
  const current = availableSlots.value.find((slot) => slot.hour === selectedHour.value && slot.duration === selectedDuration.value)
  return current ? current.label : 'Select a slot'
})
const isBookingReady = computed(() => Boolean(selectedHour.value) && Boolean(selectedDuration.value))

// METHODS
async function handleSubmit() {
  try {
    if (!isBookingReady.value) {
      throw new Error('Choose a slot before booking')
    }
    isSubmitting.value = true
    errorMessage.value = ''
    emit('book', {
      date: selectedDate.value,
      startHour: selectedHour.value,
      duration: selectedDuration.value,
      description: customDescription.value,
    })
  } catch (error) {
    errorMessage.value = error.message ?? 'Unable to submit booking'
  } finally {
    isSubmitting.value = false
  }
}

function handleSlotSelect(slot) {
  selectedHour.value = slot.hour
  selectedDuration.value = slot.duration
}

// WATCHERS
// none

// LIFECYCLE HOOKS
// none
</script>

<template>
  <form class="court-booking-form" @submit.prevent="handleSubmit">
    <div class="court-booking-form__group">
      <label class="court-booking-form__label" for="booking-date">Date</label>
      <input
        class="court-booking-form__input"
        id="booking-date"
        type="date"
        :value="selectedDate"
        @input="(event) => (selectedDate = event.target.value)"
      />
    </div>
    <div class="court-booking-form__slots">
      <p class="court-booking-form__slots-title">Available slots</p>
      <div class="court-booking-form__slot" v-for="slot in availableSlots" :key="`${slot.hour}-${slot.duration}-${slot.date}`">
        <button
          class="court-booking-form__slot-button"
          type="button"
          :class="{ 'court-booking-form__slot-button--active': selectedHour === slot.hour && selectedDuration === slot.duration }"
          @click="handleSlotSelect(slot)"
        >
          {{ slot.label }}
        </button>
      </div>
      <p class="court-booking-form__selected">{{ selectedSlotLabel }}</p>
    </div>
    <div class="court-booking-form__group">
      <label class="court-booking-form__label">Duration</label>
      <div class="court-booking-form__radios">
        <label class="court-booking-form__radio">
          <input
            class="court-booking-form__radio-input"
            type="radio"
            value="1"
            v-model.number="selectedDuration"
          />
          1 hour
        </label>
        <label class="court-booking-form__radio">
          <input
            class="court-booking-form__radio-input"
            type="radio"
            value="2"
            v-model.number="selectedDuration"
          />
          2 hours
        </label>
      </div>
    </div>
    <div class="court-booking-form__group">
      <label class="court-booking-form__label" for="booking-description">Notes</label>
      <textarea
        class="court-booking-form__textarea"
        id="booking-description"
        rows="3"
        v-model="customDescription"
        placeholder="Add a partner request or goal"
      ></textarea>
    </div>
    <p v-if="errorMessage" class="court-booking-form__error">{{ errorMessage }}</p>
    <button class="court-booking-form__submit" type="submit" :disabled="isSubmitting">
      {{ isSubmitting ? 'Booking court...' : 'Book Court' }}
    </button>
  </form>
</template>

<style scoped>
.court-booking-form {
  background: #ffffff;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.court-booking-form__group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.court-booking-form__label {
  font-weight: 600;
  color: #222;
}
.court-booking-form__input,
.court-booking-form__textarea {
  border-radius: 0.5rem;
  border: 1px solid rgba(0, 0, 0, 0.15);
  padding: 0.65rem;
  font-size: 1rem;
  font-family: inherit;
}
.court-booking-form__slots-title {
  font-weight: 600;
  margin-bottom: 0.35rem;
}
.court-booking-form__slots {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.court-booking-form__slot {
  display: flex;
}
.court-booking-form__slot-button {
  flex: 1;
  border: 1px solid rgba(0, 0, 0, 0.3);
  background: #fafafa;
  padding: 0.65rem 0.9rem;
  font-weight: 600;
  border-radius: 0.75rem;
  cursor: pointer;
}
.court-booking-form__slot-button--active {
  border-color: #bf0a30;
  background: #fff0f2;
}
.court-booking-form__selected {
  font-size: 0.85rem;
  color: rgba(0, 0, 0, 0.7);
}
.court-booking-form__radios {
  display: flex;
  gap: 1rem;
}
.court-booking-form__radio {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 500;
}
.court-booking-form__submit {
  border: none;
  background: #bf0a30;
  color: #fff;
  padding: 0.85rem;
  font-size: 1rem;
  border-radius: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}
.court-booking-form__submit:disabled {
  background: rgba(191, 10, 48, 0.5);
  cursor: not-allowed;
}
.court-booking-form__error {
  margin: 0;
  color: #bf0a30;
  font-weight: 600;
}
</style>
