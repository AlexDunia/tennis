<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import {
  AGE_OPTIONS,
  FORMAT_OPTIONS,
  LEVEL_OPTIONS,
  SCORING_OPTIONS,
  createDefaultEvent,
  eventHours,
  isPowerOfTwo,
  matchCount,
  matchHours,
  nextPowerOfTwo,
  recommendedGroups,
  unitForType,
} from '../../../utils/tournament/tournamentCreation'

const props = defineProps({
  open: { type: Boolean, default: false },
  event: { type: Object, default: null },
  custom: { type: Boolean, default: false },
  capabilities: { type: Object, required: true },
  availableCourtHours: { type: Number, default: 0 },
})

const emit = defineEmits({
  close: () => true,
  save: (event) => Boolean(event?.name),
  remove: (eventId) => typeof eventId === 'string',
})

const draft = reactive({})
const moreOpen = ref(false)
const dismissedFormatAdvice = ref(false)
const dismissedTimeAdvice = ref(false)
const nameInput = ref(null)
const error = ref('')

const units = computed(() => unitForType(draft.type))
const groups = computed(() => recommendedGroups(Number(draft.capacity || 2)))
const matches = computed(() => matchCount(draft))
const neededHours = computed(() => eventHours(draft))
const isRoundRobinOverCapacity = computed(
  () => draft.format === 'roundrobin' && neededHours.value > props.availableCourtHours,
)
const isAnyFormatOverCapacity = computed(
  () => neededHours.value > props.availableCourtHours && !isRoundRobinOverCapacity.value,
)
const shorterScoringRecommendation = computed(() => {
  if (
    draft.scoring !== 'matchtb' &&
    matches.value * matchHours('matchtb') <= props.availableCourtHours
  ) {
    return { id: 'matchtb', label: 'Switch to 2 sets + match tiebreak' }
  }
  if (
    draft.scoring !== 'oneset' &&
    matches.value * matchHours('oneset') <= props.availableCourtHours
  ) {
    return { id: 'oneset', label: 'Switch to one set' }
  }
  return null
})
const seedingOptions = computed(() =>
  [
    ...(props.capabilities.hasClubLadder ? [{ id: 'ladder', label: 'Club ladder' }] : []),
    ...(props.capabilities.supportsPlayerRatings ? [{ id: 'rating', label: 'Player rating' }] : []),
    { id: 'manual', label: 'Choose later' },
    { id: 'none', label: 'No seeding' },
  ].map((option) => ({
    ...option,
    label: `${option.label}${option.id === props.capabilities.recommendedSeeding ? ' — Recommended' : ''}`,
  })),
)

function reset() {
  const fallback = createDefaultEvent(props.event?.type || 'singles', props.capabilities)
  Object.keys(draft).forEach((key) => delete draft[key])
  Object.assign(draft, fallback, JSON.parse(JSON.stringify(props.event || {})))
  if (!seedingOptions.value.some((option) => option.id === draft.seeding)) {
    draft.seeding = props.capabilities.recommendedSeeding
  }
  moreOpen.value = false
  dismissedFormatAdvice.value = false
  dismissedTimeAdvice.value = false
  error.value = ''
  if (props.custom) nextTick(() => nameInput.value?.focus())
}

function setFormat(format) {
  draft.format = format
  dismissedFormatAdvice.value = false
  dismissedTimeAdvice.value = false
}

function save() {
  const name = String(draft.name || '').trim()
  if (!name) {
    error.value = 'Name this event.'
    nameInput.value?.focus()
    return
  }
  emit('save', {
    ...JSON.parse(JSON.stringify(draft)),
    name,
    capacity: Math.max(2, Math.min(128, Number(draft.capacity) || 2)),
    custom: props.custom,
  })
}

function changeType() {
  if (draft.type === 'singles' && draft.entryRule === 'mixed') draft.entryRule = 'everyone'
}

function onKeydown(event) {
  if (event.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  (open) => {
    if (open) reset()
  },
)
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="creation-overlay" @click.self="emit('close')" @keydown="onKeydown">
      <section
        class="creation-dialog creation-dialog--event"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-dialog-title"
      >
        <header class="dialog-header">
          <div>
            <h2 id="event-dialog-title">{{ event?.name || 'Add event' }}</h2>
            <p>
              {{
                custom ? "Create an event that isn't in the list." : 'Set how this event will work.'
              }}
            </p>
          </div>
          <button class="icon-close" type="button" aria-label="Close" @click="emit('close')">
            ×
          </button>
        </header>

        <section v-if="custom" class="dialog-section">
          <header class="block-heading">
            <strong>Event</strong>
            <span>Name it and choose how people play.</span>
          </header>
          <div class="two-column-fields">
            <label class="creation-field">
              <span>Event name</span>
              <input
                ref="nameInput"
                v-model.trim="draft.name"
                type="text"
                maxlength="80"
                placeholder="e.g. Men's 40+ Singles"
              />
              <small v-if="error" class="field-error">{{ error }}</small>
            </label>
            <label class="creation-field">
              <span>Playing as</span>
              <select v-model="draft.type" @change="changeType">
                <option value="singles">Singles</option>
                <option value="doubles">Doubles</option>
              </select>
            </label>
          </div>
        </section>

        <section class="dialog-section">
          <header class="block-heading">
            <strong>Max {{ units }}</strong>
            <span
              >The most {{ units }} who can enter. The final draw uses whoever actually signs
              up.</span
            >
          </header>
          <input
            v-model.number="draft.capacity"
            class="capacity-input"
            type="number"
            min="2"
            max="128"
          />
        </section>

        <section class="dialog-section">
          <header class="block-heading">
            <strong>How should they compete?</strong>
            <span>Pick how this event is played.</span>
          </header>
          <div class="format-list">
            <button
              v-for="option in FORMAT_OPTIONS"
              :key="option.id"
              class="format-option"
              :class="{ 'format-option--active': draft.format === option.id }"
              type="button"
              :aria-pressed="draft.format === option.id"
              @click="setFormat(option.id)"
            >
              <strong>{{ option.label }}</strong>
              <span>{{ option.description }}</span>
            </button>
          </div>

          <div
            v-if="draft.format === 'rrplayoff' && Number(draft.capacity) >= 6"
            class="format-plan"
          >
            <strong>{{ groups.groups }} groups · Top 2 advance</strong>
            <span
              >{{ groups.sizes.join(' · ') }} {{ units }} per group. Gorra balances the groups and
              builds the knockout after registration closes.</span
            >
          </div>
          <div
            v-else-if="draft.format === 'single' && !isPowerOfTwo(Number(draft.capacity))"
            class="format-plan"
          >
            <strong>If all {{ draft.capacity }} places fill</strong>
            <span
              >{{ nextPowerOfTwo(Number(draft.capacity)) - Number(draft.capacity) }}
              {{
                nextPowerOfTwo(Number(draft.capacity)) - Number(draft.capacity) === 1
                  ? units.slice(0, -1)
                  : units
              }}
              will skip the first round. Gorra handles that automatically.</span
            >
          </div>

          <div
            v-if="
              draft.format === 'rrplayoff' && Number(draft.capacity) < 6 && !dismissedFormatAdvice
            "
            class="event-advice"
          >
            <strong>{{ draft.capacity }} {{ units }} is a small field for groups.</strong>
            <p>Knockout or round robin will be simpler.</p>
            <div class="notice-actions">
              <button
                class="notice-action notice-action--recommended"
                type="button"
                @click="setFormat('roundrobin')"
              >
                Switch to round robin
              </button>
              <button class="notice-action" type="button" @click="dismissedFormatAdvice = true">
                Keep groups + knockout
              </button>
            </div>
          </div>

          <div v-if="isRoundRobinOverCapacity && !dismissedFormatAdvice" class="event-advice">
            <strong>{{ draft.capacity }} {{ units }} means {{ matches }} matches.</strong>
            <p>
              That is more court time than you set in Step 2. Groups + knockout will usually fit
              better.
            </p>
            <div class="notice-actions">
              <button
                class="notice-action notice-action--recommended"
                type="button"
                @click="setFormat('rrplayoff')"
              >
                Switch to groups + knockout
              </button>
              <button class="notice-action" type="button" @click="dismissedFormatAdvice = true">
                Keep round robin
              </button>
            </div>
          </div>
        </section>

        <section class="dialog-section">
          <div class="two-column-fields">
            <label class="creation-field">
              <span>How is each match played?</span>
              <select v-model="draft.scoring" @change="dismissedTimeAdvice = false">
                <option v-for="option in SCORING_OPTIONS" :key="option.id" :value="option.id">
                  {{ option.label }}
                </option>
              </select>
            </label>
            <label v-if="draft.format !== 'roundrobin'" class="creation-field">
              <span>How should {{ units }} be seeded?</span>
              <select v-model="draft.seeding">
                <option v-for="option in seedingOptions" :key="option.id" :value="option.id">
                  {{ option.label }}
                </option>
              </select>
              <small class="field-note"
                >Gorra uses this after registration closes. You can change it before the draw is
                made.</small
              >
            </label>
            <div v-else class="creation-field">
              <span>Seeding</span>
              <div class="round-robin-note">Not needed here. Everyone plays everyone.</div>
            </div>
          </div>

          <div v-if="isAnyFormatOverCapacity && !dismissedTimeAdvice" class="event-advice">
            <strong>This may need more court time.</strong>
            <p>
              About {{ Math.ceil(neededHours) }} court hours for this event. You set about
              {{ Math.round(availableCourtHours) }} in Step 2.
            </p>
            <div class="notice-actions">
              <button
                v-if="shorterScoringRecommendation"
                class="notice-action notice-action--recommended"
                type="button"
                @click="draft.scoring = shorterScoringRecommendation.id"
              >
                {{ shorterScoringRecommendation.label }}
              </button>
              <button class="notice-action" type="button" @click="dismissedTimeAdvice = true">
                Keep this setup
              </button>
            </div>
          </div>
        </section>

        <section class="dialog-section">
          <button
            class="more-trigger"
            type="button"
            :aria-expanded="moreOpen"
            @click="moreOpen = !moreOpen"
          >
            <span>More options</span><span aria-hidden="true">{{ moreOpen ? '−' : '+' }}</span>
          </button>
          <div v-if="moreOpen" class="more-options" :class="{ 'more-options--custom': custom }">
            <label v-if="custom" class="creation-field">
              <span>Who can enter?</span>
              <select v-model="draft.entryRule">
                <option value="everyone">Everyone</option>
                <option value="men">Men</option>
                <option value="women">Women</option>
                <option v-if="draft.type === 'doubles'" value="mixed">Mixed pairs</option>
              </select>
            </label>
            <label class="creation-field">
              <span>Age</span>
              <select v-model="draft.age">
                <option v-for="option in AGE_OPTIONS" :key="option" :value="option">
                  {{ option === 'Open' ? 'All ages' : option }}
                </option>
              </select>
            </label>
            <label class="creation-field">
              <span>Level</span>
              <select v-model="draft.ability">
                <option v-for="option in LEVEL_OPTIONS" :key="option" :value="option">
                  {{ option === 'Open' ? 'All levels' : option }}
                </option>
              </select>
            </label>
          </div>
        </section>

        <footer class="dialog-actions">
          <button class="button-secondary" type="button" @click="emit('close')">Cancel</button>
          <button class="button-primary" type="button" @click="save">
            {{ event?.configured ? 'Save changes' : 'Add event' }}
          </button>
        </footer>
        <button
          v-if="event?.configured"
          class="remove-link"
          type="button"
          @click="emit('remove', event.id)"
        >
          Remove event
        </button>
      </section>
    </div>
  </Teleport>
</template>
