<script setup>
import '../../../assets/tournament-creation.css'

const model = defineModel({ type: Object, required: true })

defineProps({
  today: { type: String, required: true },
  errors: { type: Object, default: () => ({}) },
  timezone: { type: String, default: 'Africa/Lagos' },
})

const emit = defineEmits({
  continue: () => true,
  'date-change': (field) => Boolean(field),
})
</script>

<template>
  <section class="creation-step" aria-labelledby="details-heading">
    <header class="step-heading">
      <h1 id="details-heading">Create tournament</h1>
      <p>Start with the few details everyone needs.</p>
    </header>

    <section class="creation-block">
      <label class="creation-field">
        <span>Tournament name</span>
        <input
          v-model.trim="model.name"
          type="text"
          maxlength="120"
          autocomplete="off"
          placeholder="Enter tournament name"
          :aria-invalid="Boolean(errors.name)"
          :aria-describedby="errors.name ? 'tournament-name-error' : undefined"
        />
        <small v-if="errors.name" id="tournament-name-error" class="field-error">{{
          errors.name
        }}</small>
      </label>

      <fieldset class="creation-fieldset">
        <legend>Tournament dates</legend>
        <div class="two-column-fields">
          <label class="creation-field">
            <span>Start date</span>
            <input
              v-model="model.start"
              type="date"
              :min="today"
              :aria-invalid="Boolean(errors.start)"
              @change="emit('date-change', 'start')"
            />
            <small v-if="errors.start" class="field-error">{{ errors.start }}</small>
          </label>
          <label class="creation-field">
            <span>End date</span>
            <input
              v-model="model.end"
              type="date"
              :min="model.start || today"
              :aria-invalid="Boolean(errors.end)"
              @change="emit('date-change', 'end')"
            />
            <small v-if="errors.end" class="field-error">{{ errors.end }}</small>
          </label>
        </div>
      </fieldset>

      <fieldset class="creation-fieldset">
        <legend>When people can enter this tournament.</legend>
        <div class="two-column-fields">
          <label class="creation-field">
            <span>Sign-up opens</span>
            <input
              v-model="model.signupOpen"
              type="date"
              :min="today"
              :max="model.start || undefined"
              :aria-invalid="Boolean(errors.signupOpen)"
              @change="emit('date-change', 'signupOpen')"
            />
            <small v-if="errors.signupOpen" class="field-error">{{ errors.signupOpen }}</small>
          </label>
          <label class="creation-field">
            <span>Sign-up closes</span>
            <input
              v-model="model.signupClose"
              type="date"
              :min="model.signupOpen || today"
              :max="model.start || undefined"
              :aria-invalid="Boolean(errors.signupClose)"
              @change="emit('date-change', 'signupClose')"
            />
            <small class="field-note">Closes 11:59 PM, club time ({{ timezone }})</small>
            <small v-if="errors.signupClose" class="field-error">{{ errors.signupClose }}</small>
          </label>
        </div>
        <div class="quiet-info">
          <span aria-hidden="true">i</span>
          <p>You can review who signed up before creating the draw.</p>
        </div>
      </fieldset>
    </section>

    <button class="button-primary step-primary" type="button" @click="emit('continue')">
      Continue
    </button>
  </section>
</template>
