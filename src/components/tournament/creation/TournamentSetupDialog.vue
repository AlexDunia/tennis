<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  templates: { type: Array, default: () => [] },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits({
  close: () => true,
  save: (name) => Boolean(String(name || '').trim()),
  load: (template) => Boolean(template?.id),
  delete: (templateId) => typeof templateId === 'string',
})

const name = ref('')
const confirmDeleteId = ref('')

watch(
  () => props.open,
  (open) => {
    if (open) {
      name.value = ''
      confirmDeleteId.value = ''
    }
  },
)

function onKeydown(event) {
  if (event.key === 'Escape') emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="creation-overlay" @click.self="emit('close')" @keydown="onKeydown">
      <section
        class="creation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-dialog-title"
      >
        <header class="dialog-header">
          <div>
            <h2 id="setup-dialog-title">Reusable tournament setups</h2>
            <p>
              Save event and court preferences for this club. Dates and live availability are always
              refreshed.
            </p>
          </div>
          <button class="icon-close" type="button" aria-label="Close" @click="emit('close')">
            ×
          </button>
        </header>

        <section class="dialog-section">
          <label class="creation-field">
            <span>Save current setup as</span>
            <div class="save-setup-row">
              <input
                v-model.trim="name"
                type="text"
                maxlength="80"
                placeholder="e.g. Weekend Club Knockout"
              />
              <button
                class="button-primary"
                type="button"
                :disabled="busy || !name"
                @click="emit('save', name)"
              >
                Save setup
              </button>
            </div>
          </label>
          <p v-if="error" class="field-error" role="alert">{{ error }}</p>
        </section>

        <section class="dialog-section">
          <header class="block-heading">
            <strong>Saved setups</strong>
            <span>Club-scoped shortcuts for a new tournament.</span>
          </header>
          <div v-if="templates.length" class="saved-setup-list">
            <article v-for="template in templates" :key="template.id" class="saved-setup-row">
              <span
                ><strong>{{ template.name }}</strong
                ><small>Saved {{ new Date(template.updatedAt).toLocaleDateString() }}</small></span
              >
              <div v-if="confirmDeleteId !== template.id">
                <button
                  class="button-secondary"
                  type="button"
                  :disabled="busy"
                  @click="emit('load', template)"
                >
                  Use
                </button>
                <button
                  class="button-ghost"
                  type="button"
                  :disabled="busy"
                  @click="confirmDeleteId = template.id"
                >
                  Delete
                </button>
              </div>
              <div v-else>
                <button class="button-secondary" type="button" @click="confirmDeleteId = ''">
                  Keep
                </button>
                <button
                  class="danger-button"
                  type="button"
                  :disabled="busy"
                  @click="emit('delete', template.id)"
                >
                  Delete setup
                </button>
              </div>
            </article>
          </div>
          <p v-else class="empty-copy">No reusable setups saved for this club yet.</p>
        </section>

        <footer class="dialog-actions">
          <button class="button-secondary" type="button" @click="emit('close')">Close</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
