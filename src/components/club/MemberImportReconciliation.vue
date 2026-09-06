<script setup>
import { computed } from 'vue'

const props = defineProps({
  preview: {
    type: Object,
    required: true,
  },
  resolutions: {
    type: Object,
    default: () => ({}),
  },
  busy: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['resolve', 'apply'])

const summary = computed(() => props.preview?.summary || {})
const conflicts = computed(() => props.preview?.conflicts || [])
const blocking = computed(() => props.preview?.blockingConflicts || [])

function selected(conflict) {
  return props.resolutions?.[conflict.id] === 'incoming' ? 'incoming' : 'keep'
}
</script>

<template>
  <section class="member-import-reconciliation">
    <header class="member-import-reconciliation__head">
      <h2>Check what will change</h2>
      <p>
        Gorra keeps your existing club data unless you explicitly choose the imported value.
      </p>
    </header>

    <p class="member-import-reconciliation__summary" aria-live="polite">
      <strong>{{ summary.newCount || 0 }}</strong> new
      <span>·</span>
      <strong>{{ summary.existingCount || 0 }}</strong> already in your club
      <span>·</span>
      <strong>{{ summary.fillCount || 0 }}</strong> missing details will be filled
      <span>·</span>
      <strong>{{ conflicts.length }}</strong>
      {{ conflicts.length === 1 ? 'difference' : 'differences' }}
    </p>

    <section
      v-if="blocking.length"
      class="member-import-reconciliation__blocking"
      aria-label="Import blockers"
    >
      <h3>{{ blocking.length }} {{ blocking.length === 1 ? 'item needs' : 'items need' }} attention</h3>

      <article v-for="item in blocking" :key="item.id">
        <strong>{{ item.personName || 'Imported member' }}</strong>
        <p>{{ item.message }}</p>
      </article>

      <p class="member-import-reconciliation__hint">
        Use the back arrow to return to the table and correct these values.
      </p>
    </section>

    <div v-if="conflicts.length" class="member-import-reconciliation__list">
      <article
        v-for="conflict in conflicts"
        :key="conflict.id"
        class="member-import-conflict"
      >
        <header class="member-import-conflict__head">
          <div>
            <strong>{{ conflict.personName || 'Imported member' }}</strong>
            <span>{{ conflict.fieldLabel }}</span>
          </div>

          <small v-if="conflict.ladderName">{{ conflict.ladderName }}</small>
        </header>

        <div class="member-import-conflict__values">
          <button
            class="member-import-conflict__value"
            :class="{ active: selected(conflict) === 'keep' }"
            type="button"
            :disabled="busy"
            @click="emit('resolve', conflict.id, 'keep')"
          >
            <small>{{ conflict.currentLabel || 'Current club record' }}</small>
            <strong>{{ conflict.currentValue || 'Empty' }}</strong>
            <span>{{ selected(conflict) === 'keep' ? 'Keeping this' : 'Keep this' }}</span>
          </button>

          <button
            class="member-import-conflict__value"
            :class="{ active: selected(conflict) === 'incoming' }"
            type="button"
            :disabled="busy || conflict.canUseIncoming === false"
            @click="emit('resolve', conflict.id, 'incoming')"
          >
            <small>{{ conflict.incomingLabel || 'Imported file' }}</small>
            <strong>{{ conflict.incomingValue || 'Empty' }}</strong>
            <span>
              {{
                conflict.canUseIncoming === false
                  ? 'Cannot replace here'
                  : selected(conflict) === 'incoming'
                    ? 'Using this'
                    : 'Use this'
              }}
            </span>
          </button>
        </div>

        <p v-if="conflict.message" class="member-import-conflict__message">
          {{ conflict.message }}
        </p>
      </article>
    </div>

    <div v-else-if="!blocking.length" class="member-import-reconciliation__quiet">
      <strong>No conflicting values.</strong>
      <span>
        Gorra will add new people and fill only information that is currently missing.
      </span>
    </div>

    <footer class="member-import-reconciliation__footer">
      <p>
        Account links, club roles, record IDs and current status are never replaced by this import.
      </p>

      <button
        class="ref-button primary"
        type="button"
        :disabled="busy || blocking.length"
        @click="emit('apply')"
      >
        {{ busy ? 'Applying…' : 'Apply import' }}
      </button>
    </footer>
  </section>
</template>

<style scoped>
.member-import-reconciliation {
  width: 100%;
}

.member-import-reconciliation__head h2,
.member-import-reconciliation__head p {
  margin: 0;
}

.member-import-reconciliation__head h2 {
  color: var(--g-ink, #28332c);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.015em;
}

.member-import-reconciliation__head p {
  max-width: 680px;
  margin-top: 5px;
  color: var(--g-muted, #7d8780);
  font-size: 11.5px;
  line-height: 1.5;
}

.member-import-reconciliation__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 18px 0 0;
  color: #78837b;
  font-size: 10.5px;
  line-height: 1.5;
}

.member-import-reconciliation__summary strong {
  color: #4c5a51;
  font-weight: 600;
}

.member-import-reconciliation__blocking {
  margin-top: 18px;
  padding: 15px;
  border: 1px solid rgba(166, 72, 64, 0.2);
  border-radius: 11px;
  background: rgba(166, 72, 64, 0.035);
}

.member-import-reconciliation__blocking h3 {
  margin: 0;
  color: #7e3934;
  font-size: 12px;
  font-weight: 600;
}

.member-import-reconciliation__blocking article {
  padding-top: 11px;
}

.member-import-reconciliation__blocking article + article {
  margin-top: 10px;
  border-top: 1px solid rgba(166, 72, 64, 0.1);
}

.member-import-reconciliation__blocking article strong {
  font-size: 10.8px;
}

.member-import-reconciliation__blocking article p,
.member-import-reconciliation__hint {
  margin: 3px 0 0;
  color: #7d6662;
  font-size: 10px;
  line-height: 1.45;
}

.member-import-reconciliation__list {
  display: grid;
  gap: 14px;
  margin-top: 20px;
}

.member-import-conflict {
  padding: 16px;
  border: 1px solid var(--g-line, #e4e9e5);
  border-radius: 12px;
  background: #fff;
}

.member-import-conflict__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.member-import-conflict__head > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.member-import-conflict__head strong {
  color: var(--g-ink, #28332c);
  font-size: 11.5px;
  font-weight: 600;
}

.member-import-conflict__head span,
.member-import-conflict__head small {
  color: var(--g-muted, #7d8780);
  font-size: 9.8px;
}

.member-import-conflict__values {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 13px;
}

.member-import-conflict__value {
  display: grid;
  min-width: 0;
  gap: 4px;
  padding: 12px;
  border: 1px solid #e1e7e2;
  border-radius: 10px;
  background: #fbfcfb;
  color: #556159;
  text-align: left;
}

.member-import-conflict__value.active {
  border-color: rgba(8, 173, 43, 0.32);
  background: #f5fbf6;
  box-shadow: inset 0 0 0 1px rgba(8, 173, 43, 0.05);
}

.member-import-conflict__value:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.member-import-conflict__value small {
  color: #8c958f;
  font-size: 8.8px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.member-import-conflict__value strong {
  overflow-wrap: anywhere;
  color: #3f4c43;
  font-size: 11.5px;
  font-weight: 600;
}

.member-import-conflict__value span {
  color: #728078;
  font-size: 9.5px;
}

.member-import-conflict__message {
  margin: 9px 0 0;
  color: #7b857e;
  font-size: 9.8px;
  line-height: 1.45;
}

.member-import-reconciliation__quiet {
  display: grid;
  gap: 3px;
  margin-top: 20px;
  padding: 15px;
  border-radius: 11px;
  background: #f7faf7;
}

.member-import-reconciliation__quiet strong {
  font-size: 11.5px;
}

.member-import-reconciliation__quiet span {
  color: var(--g-muted, #7d8780);
  font-size: 10.5px;
  line-height: 1.45;
}

.member-import-reconciliation__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--g-line, #e4e9e5);
}

.member-import-reconciliation__footer p {
  max-width: 620px;
  margin: 0;
  color: #8a938d;
  font-size: 9.8px;
  line-height: 1.45;
}

.member-import-reconciliation__footer .ref-button {
  flex: 0 0 auto;
}

@media (max-width: 620px) {
  .member-import-conflict__values {
    grid-template-columns: 1fr;
  }

  .member-import-reconciliation__footer {
    display: grid;
  }

  .member-import-reconciliation__footer .ref-button {
    width: 100%;
  }
}
</style>

