<script setup>
import { computed, getCurrentInstance, reactive, ref, watch } from 'vue'
import { MATCH_RULE_LIMITS } from '../../domain/matchRules.js'
import {
  matchRulesDraftToSnapshot,
  matchRulesSnapshotToDraft,
} from '../../domain/matchRulesEditor.js'
import { formatMatchRulesSummary } from '../../utils/matchRulesSummary.js'

const props = defineProps({
  modelValue: { type: Object, required: true },
  editable: { type: Boolean, default: true },
  showSave: { type: Boolean, default: true },
  saveLabel: { type: String, default: 'Save match format' },
  allowStandaloneTiebreak: { type: Boolean, default: true },
  readOnlyLabel: { type: String, default: 'This match format is read-only.' },
})
const emit = defineEmits(['save', 'update:modelValue'])
const uid = getCurrentInstance()?.uid || Math.random().toString(36).slice(2)
const names = Object.freeze({
  matchMode: `match-mode-${uid}`,
  setTie: `set-tie-${uid}`,
  decidingSet: `deciding-set-${uid}`,
  gameMode: `game-mode-${uid}`,
  deuce: `deuce-${uid}`,
})
const draft = reactive({})
const loadErrors = ref([])
const submitErrors = ref([])

function loadSnapshot(snapshot) {
  const result = matchRulesSnapshotToDraft(snapshot)
  loadErrors.value = result.errors || []
  if (result.ok) Object.assign(draft, result.draft)
}

watch(() => props.modelValue, loadSnapshot, { immediate: true, deep: true })

const candidate = computed(() => matchRulesDraftToSnapshot(draft))
const summary = computed(() =>
  formatMatchRulesSummary(candidate.value.ok ? candidate.value.snapshot : props.modelValue),
)
const matchHeader = computed(() => {
  if (draft.matchMode === 'tiebreak') return `First to ${draft.standalonePointsToWin} points`
  return `Win ${draft.setsToWin} ${Number(draft.setsToWin) === 1 ? 'set' : 'sets'}`
})
const setHeader = computed(() => `Win ${draft.gamesToWin} games`)
const gameHeader = computed(() => {
  if (draft.gameMode === 'numeric') return `Simple points · First to ${draft.numericPointsToWin}`
  return `Traditional · ${draft.traditionalDeuce === 'no_ad' ? 'No-Ad' : 'Advantage'}`
})

function save() {
  if (!props.editable) return
  submitErrors.value = candidate.value.errors || []
  if (!candidate.value.ok) return
  emit('update:modelValue', candidate.value.snapshot)
  emit('save', candidate.value.snapshot)
}
</script>

<template>
  <form class="match-format-editor" novalidate @submit.prevent="save">
    <header class="editor-intro">
      <p class="editor-eyebrow">Custom match</p>
      <h2>Set up how this match is won.</h2>
      <p>
        You only need to answer three things: how to win the match, how to win a set, and how to win
        a game.
      </p>
      <span v-if="!editable" class="read-only-note">{{ readOnlyLabel }}</span>
    </header>
    <p v-if="loadErrors.length" class="editor-error" role="alert">
      The saved match format is invalid and cannot be edited.
    </p>
    <fieldset :disabled="!editable || Boolean(loadErrors.length)" class="editor-fields">
      <details class="rule-card" open>
        <summary>
          <span class="summary-left"><small>First</small><strong>Match</strong></span>
          <span class="rule-result">{{ matchHeader }}</span>
          <span class="chevron" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none">
              <path
                d="m3.5 6 4.5 4 4.5-4"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
        </summary>
        <div class="rule-body">
          <template v-if="allowStandaloneTiebreak">
            <p class="question">What kind of match are you playing?</p>
            <p class="help">Play a match made of sets, or one standalone match tiebreak.</p>
            <div class="options">
              <label class="option" :class="{ active: draft.matchMode === 'sets' }">
                <input
                  v-model="draft.matchMode"
                  :name="names.matchMode"
                  type="radio"
                  value="sets"
                />
                <span
                  ><strong>Sets</strong><small>Win one or more sets to win the match.</small></span
                >
              </label>
              <label class="option" :class="{ active: draft.matchMode === 'tiebreak' }">
                <input
                  v-model="draft.matchMode"
                  :name="names.matchMode"
                  type="radio"
                  value="tiebreak"
                />
                <span
                  ><strong>Match tiebreak</strong
                  ><small>Play one point-based tiebreak.</small></span
                >
              </label>
            </div>
            <div class="inside-divider"></div>
          </template>
          <template v-if="draft.matchMode === 'tiebreak'">
            <p class="question">How should the match tiebreak be won?</p>
            <p class="help">Choose the point target and the lead needed to finish.</p>
            <div class="two-columns">
              <label class="number-field">
                <span>Points to win</span>
                <span class="number-row">
                  <input
                    v-model.number="draft.standalonePointsToWin"
                    type="number"
                    :min="MATCH_RULE_LIMITS.tieBreakPointsToWin.min"
                    :max="MATCH_RULE_LIMITS.tieBreakPointsToWin.max"
                  />
                  <small>points</small>
                </span>
              </label>
              <label class="number-field">
                <span>Win by</span>
                <span class="number-row">
                  <input
                    v-model.number="draft.standaloneWinBy"
                    type="number"
                    :min="MATCH_RULE_LIMITS.tieBreakWinBy.min"
                    :max="MATCH_RULE_LIMITS.tieBreakWinBy.max"
                  />
                  <small>points</small>
                </span>
              </label>
            </div>
          </template>
          <template v-else>
            <p class="question">How many sets should someone win?</p>
            <p class="help">Once a player wins this many sets, the whole match is over.</p>
            <label class="number-field number-field--single">
              <span class="sr-only">Sets to win</span>
              <span class="number-row">
                <input
                  v-model.number="draft.setsToWin"
                  type="number"
                  :min="MATCH_RULE_LIMITS.setsToWin.min"
                  :max="MATCH_RULE_LIMITS.setsToWin.max"
                />
                <small>sets</small>
              </span>
            </label>
            <p class="plain-note">
              Win {{ draft.setsToWin }} {{ Number(draft.setsToWin) === 1 ? 'set' : 'sets' }} to win
              the match. This can take up to {{ Number(draft.setsToWin) * 2 - 1 }} sets.
            </p>
            <template v-if="Number(draft.setsToWin) > 1">
              <div class="inside-divider"></div>
              <p class="question">How should the deciding set be played?</p>
              <p class="help">Choose what happens if both players are one set away from winning.</p>
              <div class="options">
                <label class="option" :class="{ active: draft.decidingSetMode === 'normal_set' }">
                  <input
                    v-model="draft.decidingSetMode"
                    :name="names.decidingSet"
                    type="radio"
                    value="normal_set"
                  />
                  <span
                    ><strong>Play a normal set</strong
                    ><small>Use the set and game rules below.</small></span
                  >
                </label>
                <label
                  class="option"
                  :class="{ active: draft.decidingSetMode === 'match_tiebreak' }"
                >
                  <input
                    v-model="draft.decidingSetMode"
                    :name="names.decidingSet"
                    type="radio"
                    value="match_tiebreak"
                  />
                  <span
                    ><strong>Play a match tiebreak</strong
                    ><small>Replace the deciding set with points.</small></span
                  >
                </label>
              </div>
              <div v-if="draft.decidingSetMode === 'match_tiebreak'" class="sub-rule">
                <p class="sub-rule-title">Deciding match tiebreak</p>
                <p class="help">Choose the point target and lead for the deciding tiebreak.</p>
                <div class="two-columns">
                  <label class="number-field">
                    <span>Points to win</span>
                    <span class="number-row">
                      <input
                        v-model.number="draft.decidingPointsToWin"
                        type="number"
                        :min="MATCH_RULE_LIMITS.decidingMatchTieBreakPointsToWin.min"
                        :max="MATCH_RULE_LIMITS.decidingMatchTieBreakPointsToWin.max"
                      />
                      <small>points</small>
                    </span>
                  </label>
                  <label class="number-field">
                    <span>Win by</span>
                    <span class="number-row">
                      <input
                        v-model.number="draft.decidingWinBy"
                        type="number"
                        :min="MATCH_RULE_LIMITS.decidingMatchTieBreakWinBy.min"
                        :max="MATCH_RULE_LIMITS.decidingMatchTieBreakWinBy.max"
                      />
                      <small>points</small>
                    </span>
                  </label>
                </div>
              </div>
            </template>
          </template>
        </div>
      </details>
      <details v-if="draft.matchMode === 'sets'" class="rule-card">
        <summary>
          <span class="summary-left"><small>Then</small><strong>Set</strong></span>
          <span class="rule-result">{{ setHeader }}</span>
          <span class="chevron" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none">
              <path
                d="m3.5 6 4.5 4 4.5-4"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
        </summary>
        <div class="rule-body">
          <p class="question">How many games should someone win?</p>
          <p class="help">This is the normal target for winning one set.</p>
          <label class="number-field number-field--single">
            <span class="sr-only">Games to win</span>
            <span class="number-row">
              <input
                v-model.number="draft.gamesToWin"
                type="number"
                :min="MATCH_RULE_LIMITS.gamesToWin.min"
                :max="MATCH_RULE_LIMITS.gamesToWin.max"
              />
              <small>games</small>
            </span>
          </label>
          <div class="inside-divider"></div>
          <p class="question">How far ahead should they be?</p>
          <p class="help">For example, “win by 2” means 6–5 is not enough.</p>
          <label class="number-field number-field--single">
            <span class="sr-only">Games ahead</span>
            <span class="number-row">
              <input
                v-model.number="draft.setWinBy"
                type="number"
                :min="MATCH_RULE_LIMITS.setWinBy.min"
                :max="MATCH_RULE_LIMITS.setWinBy.max"
              />
              <small>games ahead</small>
            </span>
          </label>
          <template v-if="Number(draft.setWinBy) > 1">
            <div class="inside-divider"></div>
            <p class="question">
              If it reaches {{ draft.gamesToWin }}–{{ draft.gamesToWin }}, what happens?
            </p>
            <p class="help">Choose how Gorra should settle the tied set.</p>
            <div class="options">
              <label class="option" :class="{ active: draft.setTieMode === 'tiebreak' }">
                <input
                  v-model="draft.setTieMode"
                  :name="names.setTie"
                  type="radio"
                  value="tiebreak"
                />
                <span
                  ><strong>Play a tiebreak</strong
                  ><small>Stop counting games and play a short point-based tiebreak.</small></span
                >
              </label>
              <label class="option" :class="{ active: draft.setTieMode === 'continue' }">
                <input
                  v-model="draft.setTieMode"
                  :name="names.setTie"
                  type="radio"
                  value="continue"
                />
                <span
                  ><strong>Keep playing games</strong
                  ><small>Keep going until someone gets the required lead.</small></span
                >
              </label>
            </div>
            <div v-if="draft.setTieMode === 'tiebreak'" class="sub-rule">
              <p class="sub-rule-title">Tiebreak</p>
              <p class="help">If the set gets tied, how should the tiebreak itself be won?</p>
              <div class="two-columns">
                <label class="number-field">
                  <span>Points to win</span>
                  <span class="number-row">
                    <input
                      v-model.number="draft.tieBreakPointsToWin"
                      type="number"
                      :min="MATCH_RULE_LIMITS.tieBreakPointsToWin.min"
                      :max="MATCH_RULE_LIMITS.tieBreakPointsToWin.max"
                    />
                    <small>points</small>
                  </span>
                </label>
                <label class="number-field">
                  <span>Win by</span>
                  <span class="number-row">
                    <input
                      v-model.number="draft.tieBreakWinBy"
                      type="number"
                      :min="MATCH_RULE_LIMITS.tieBreakWinBy.min"
                      :max="MATCH_RULE_LIMITS.tieBreakWinBy.max"
                    />
                    <small>points</small>
                  </span>
                </label>
              </div>
            </div>
          </template>
          <p v-else class="plain-note">
            No extra tie rule is needed because a one-game lead is already enough to win the set.
          </p>
        </div>
      </details>
      <details v-if="draft.matchMode === 'sets'" class="rule-card">
        <summary>
          <span class="summary-left"><small>Finally</small><strong>Game</strong></span>
          <span class="rule-result">{{ gameHeader }}</span>
          <span class="chevron" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none">
              <path
                d="m3.5 6 4.5 4 4.5-4"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
        </summary>
        <div class="rule-body">
          <p class="question">How should points work inside a game?</p>
          <p class="help">Use normal tennis scoring, or create a simpler point system.</p>
          <div class="options">
            <label class="option" :class="{ active: draft.gameMode === 'traditional' }">
              <input
                v-model="draft.gameMode"
                :name="names.gameMode"
                type="radio"
                value="traditional"
              />
              <span><strong>Traditional tennis</strong><small>0 → 15 → 30 → 40 → Game</small></span>
            </label>
            <label class="option" :class="{ active: draft.gameMode === 'numeric' }">
              <input v-model="draft.gameMode" :name="names.gameMode" type="radio" value="numeric" />
              <span
                ><strong>Simple points</strong><small>Count normally: 1, 2, 3, 4...</small></span
              >
            </label>
          </div>
          <div v-if="draft.gameMode === 'traditional'" class="sub-rule">
            <p class="sub-rule-title">If it reaches 40–40</p>
            <p class="help">Choose what happens when both players reach 40.</p>
            <div class="options">
              <label class="option" :class="{ active: draft.traditionalDeuce === 'advantage' }">
                <input
                  v-model="draft.traditionalDeuce"
                  :name="names.deuce"
                  type="radio"
                  value="advantage"
                />
                <span
                  ><strong>Advantage</strong
                  ><small>A player needs two points in a row from 40–40.</small></span
                >
              </label>
              <label class="option" :class="{ active: draft.traditionalDeuce === 'no_ad' }">
                <input
                  v-model="draft.traditionalDeuce"
                  :name="names.deuce"
                  type="radio"
                  value="no_ad"
                />
                <span
                  ><strong>No-Ad</strong
                  ><small>At 40–40, the next point wins the game.</small></span
                >
              </label>
            </div>
          </div>
          <div v-else class="sub-rule">
            <p class="sub-rule-title">Simple point scoring</p>
            <p class="help">Decide how many normal points are needed to win one game.</p>
            <div class="two-columns">
              <label class="number-field">
                <span>Points to win</span>
                <span class="number-row">
                  <input
                    v-model.number="draft.numericPointsToWin"
                    type="number"
                    :min="MATCH_RULE_LIMITS.numericGamePointsToWin.min"
                    :max="MATCH_RULE_LIMITS.numericGamePointsToWin.max"
                  />
                  <small>points</small>
                </span>
              </label>
              <label class="number-field">
                <span>Win by</span>
                <span class="number-row">
                  <input
                    v-model.number="draft.numericWinBy"
                    type="number"
                    :min="MATCH_RULE_LIMITS.numericGameWinBy.min"
                    :max="MATCH_RULE_LIMITS.numericGameWinBy.max"
                  />
                  <small>points</small>
                </span>
              </label>
            </div>
          </div>
        </div>
      </details>
    </fieldset>
    <section class="final-summary" aria-live="polite">
      <p>YOUR FORMAT</p>
      <h3>Here’s what you’ve set up.</h3>
      <dl>
        <div v-for="row in summary.rows" :key="row.key">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
    </section>
    <slot name="before-actions"></slot>
    <div v-if="submitErrors.length" class="editor-error" role="alert">
      <strong>Check the match format.</strong>
      <ul>
        <li v-for="error in submitErrors" :key="`${error.path}-${error.code}`">
          {{ error.message }}
        </li>
      </ul>
    </div>
    <button v-if="editable && showSave" class="editor-save" type="submit">{{ saveLabel }}</button>
  </form>
</template>

<style scoped>
.match-format-editor {
  display: grid;
  gap: 14px;
  width: min(100%, 760px);
  margin: 0 auto;
  color: var(--color-text);
}
.editor-intro {
  padding: 4px 2px 8px;
}
.editor-eyebrow,
.final-summary > p {
  margin: 0 0 8px;
  color: var(--color-primary-strong);
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.editor-intro h2,
.final-summary h3 {
  margin: 0;
  color: var(--color-text);
  font-size: clamp(22px, 3vw, 31px);
  line-height: 1.16;
}
.editor-intro > p:not(.editor-eyebrow) {
  max-width: 620px;
  margin: 10px 0 0;
  color: var(--color-text-soft);
  font-size: 13px;
  line-height: 1.65;
}
.read-only-note {
  display: inline-flex;
  margin-top: 12px;
  padding: 6px 9px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary) 8%, white);
  color: var(--color-primary-strong);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
}
.editor-fields {
  display: grid;
  gap: 10px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.rule-card {
  overflow: clip;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
}
.rule-card summary {
  display: grid;
  min-height: 66px;
  padding: 14px 16px;
  grid-template-columns: minmax(92px, 1fr) auto 18px;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  list-style: none;
}
.rule-card summary::-webkit-details-marker {
  display: none;
}
.rule-card summary:focus-visible,
.option:focus-within,
.editor-save:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--color-primary) 28%, transparent);
  outline-offset: 2px;
}
.summary-left {
  display: grid;
  gap: 2px;
}
.summary-left small {
  color: var(--color-muted);
  font-size: 9px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.summary-left strong {
  font-size: 14px;
}
.rule-result {
  color: var(--color-text-soft);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  text-align: right;
}
.chevron {
  color: var(--color-muted);
  transform: rotate(0deg);
  transition: transform var(--motion-fast) var(--motion-curve);
}
.rule-card[open] .chevron {
  transform: rotate(180deg);
}
.rule-body {
  padding: 18px 16px 20px;
  border-top: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-bg) 48%, white);
}
.question,
.sub-rule-title {
  margin: 0;
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
}
.help {
  margin: 4px 0 12px;
  color: var(--color-muted);
  font-size: 11px;
  line-height: 1.55;
}
.options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.option {
  position: relative;
  display: flex;
  min-height: 76px;
  padding: 12px;
  align-items: flex-start;
  gap: 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-inner-radius);
  background: var(--color-surface);
  cursor: pointer;
}
.option.active {
  border-color: color-mix(in srgb, var(--color-primary) 58%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 5%, white);
}
.option input {
  width: 16px;
  height: 16px;
  margin: 2px 0 0;
  accent-color: var(--color-primary);
}
.option > span {
  display: grid;
  gap: 4px;
}
.option strong {
  font-size: 11px;
}
.option small {
  color: var(--color-muted);
  font-size: 10px;
  line-height: 1.45;
}
.inside-divider {
  height: 1px;
  margin: 18px 0;
  background: var(--color-border);
}
.two-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.number-field {
  display: grid;
  gap: 6px;
  color: var(--color-text-soft);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
}
.number-field--single {
  width: min(220px, 100%);
}
.number-row {
  display: flex;
  min-height: 42px;
  align-items: center;
  gap: 9px;
}
.number-row input {
  width: 92px;
  min-height: 42px;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-inner-radius);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: 13px;
}
.number-row input:focus {
  border-color: var(--color-primary);
  outline: 3px solid color-mix(in srgb, var(--color-primary) 16%, transparent);
}
.number-row small {
  color: var(--color-muted);
  font-size: 10px;
  font-weight: var(--font-weight-regular);
}
.plain-note,
.sub-rule {
  margin: 14px 0 0;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 16%, var(--color-border));
  border-radius: var(--app-inner-radius);
  background: color-mix(in srgb, var(--color-primary) 5%, white);
  color: var(--color-text-soft);
  font-size: 10px;
  line-height: 1.55;
}
.sub-rule {
  margin-top: 12px;
}
.sub-rule .help {
  margin-bottom: 10px;
}
.final-summary {
  margin-top: 8px;
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
}
.final-summary h3 {
  font-size: 17px;
}
.final-summary dl {
  margin: 14px 0 0;
  border-top: 1px solid var(--color-border);
}
.final-summary dl > div {
  display: grid;
  padding: 10px 0;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 12px;
  border-bottom: 1px solid var(--color-border);
}
.final-summary dt {
  color: var(--color-muted);
  font-size: 10px;
}
.final-summary dd {
  margin: 0;
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
}
.editor-error {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, #9a554f 25%, var(--color-border));
  border-radius: var(--app-inner-radius);
  background: #fff8f7;
  color: #8a4742;
  font-size: 10px;
  line-height: 1.5;
}
.editor-error ul {
  margin: 5px 0 0;
  padding-left: 18px;
}
.editor-save {
  min-height: 46px;
  border: 1px solid var(--color-primary);
  border-radius: var(--app-inner-radius);
  background: var(--color-primary);
  color: white;
  font: inherit;
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
}
.editor-fields:disabled .option,
.editor-fields:disabled input {
  cursor: default;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}
@media (max-width: 640px) {
  .rule-card summary {
    grid-template-columns: minmax(78px, 1fr) minmax(0, auto) 14px;
    padding: 13px;
    gap: 8px;
  }
  .rule-result {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rule-body {
    padding: 15px 13px 17px;
  }
  .options,
  .two-columns {
    grid-template-columns: 1fr;
  }
  .option {
    min-height: 68px;
  }
  .final-summary {
    padding: 15px;
  }
  .final-summary dl > div {
    grid-template-columns: 82px minmax(0, 1fr);
  }
}
@media (prefers-reduced-motion: reduce) {
  .chevron {
    transition: none;
  }
}

/*
 * Match Format uses the authenticated Gorra rhythm and control scale.
 * These component-level rules intentionally reuse the shared application
 * tokens instead of creating a separate editor theme.
 */
.match-format-editor {
  gap: 20px;
  width: min(100%, 860px);
  font-family: inherit;
}

.editor-intro {
  padding: 4px 2px 10px;
}

.editor-eyebrow,
.final-summary > p {
  margin-bottom: var(--space-heading-copy);
  font-size: 11px;
  letter-spacing: 0.11em;
}

.editor-intro h2,
.final-summary h3 {
  font-size: clamp(24px, 3.2vw, 34px);
  font-weight: var(--font-weight-bold);
  line-height: 1.2;
  letter-spacing: -0.025em;
}

.editor-intro > p:not(.editor-eyebrow) {
  max-width: 650px;
  margin-top: var(--space-heading-copy);
  font-size: var(--type-page-description);
}

.read-only-note {
  min-height: 32px;
  margin-top: 16px;
  padding: 7px 11px;
  align-items: center;
  border: 1px solid color-mix(in srgb, var(--color-primary) 20%, var(--color-border));
  font-size: 12px;
}

.editor-fields {
  gap: 14px;
}

.editor-fields:disabled {
  opacity: 1;
}

.rule-card {
  border: var(--app-hairline);
  box-shadow: var(--flow-shadow-quiet);
}

.rule-card summary {
  min-height: 80px;
  padding: 18px 20px;
  grid-template-columns: minmax(140px, 1fr) minmax(0, auto) 22px;
  gap: 18px;
}

.summary-left {
  min-width: 0;
}

.summary-left small {
  font-size: 10px;
}

.summary-left strong {
  font-size: 16px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.35;
}

.rule-result {
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  line-height: 1.45;
}

.chevron {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  transform-origin: center;
}

.chevron svg {
  display: block;
  width: 18px;
  height: 18px;
}

.rule-body {
  padding: 24px 20px 26px;
  border-top: var(--app-hairline);
}

.question,
.sub-rule-title {
  font-size: 14px;
  line-height: 1.45;
}

.help {
  margin: var(--space-row-copy) 0 16px;
  font-size: 12px;
  line-height: 1.6;
}

.options {
  gap: var(--flow-control-space);
}

.option {
  min-height: 92px;
  padding: 16px;
  gap: 12px;
}

.option input {
  width: 18px;
  height: 18px;
  margin-top: 2px;
  flex: 0 0 18px;
}

.option > span {
  min-width: 0;
  gap: 5px;
}

.option strong {
  font-size: 13px;
  line-height: 1.4;
}

.option small {
  font-size: 12px;
  line-height: 1.5;
}

.inside-divider {
  margin: 24px 0;
}

.two-columns {
  gap: 14px;
}

.number-field {
  gap: 8px;
  font-size: 12px;
}

.number-field--single {
  width: min(240px, 100%);
}

.number-row {
  min-height: var(--app-button-height);
  gap: 10px;
}

.number-row input {
  width: 104px;
  min-height: var(--app-button-height);
  padding: 9px 12px;
  font-size: 14px;
}

.number-row small {
  font-size: 12px;
}

.plain-note,
.sub-rule {
  margin-top: 18px;
  padding: 16px;
  font-size: 12px;
  line-height: 1.6;
}

.sub-rule {
  margin-top: 16px;
}

.sub-rule .help {
  margin-bottom: 14px;
}

.final-summary {
  margin-top: 4px;
  padding: 22px 20px;
  border: var(--app-hairline);
  box-shadow: var(--flow-shadow-quiet);
}

.final-summary h3 {
  font-size: 20px;
}

.final-summary dl {
  margin-top: 18px;
  border-top: var(--app-hairline);
}

.final-summary dl > div {
  padding: 13px 0;
  grid-template-columns: 120px minmax(0, 1fr);
  align-items: baseline;
  gap: 16px;
  border-bottom: var(--app-hairline);
}

.final-summary dt {
  font-size: 11px;
  font-weight: var(--font-weight-medium);
}

.final-summary dd {
  font-size: 13px;
  line-height: 1.5;
}

.editor-error {
  padding: 12px 14px;
  font-size: 12px;
}

.editor-save {
  min-height: 48px;
  font-size: 13px;
}

.editor-fields:disabled .option,
.editor-fields:disabled input {
  opacity: 1;
  cursor: default;
}

.editor-fields:disabled input {
  background: var(--color-surface);
  color: var(--color-text);
  -webkit-text-fill-color: var(--color-text);
}

@media (max-width: 640px) {
  .match-format-editor {
    gap: 16px;
  }

  .editor-intro h2 {
    font-size: clamp(23px, 7vw, 29px);
  }

  .rule-card summary {
    min-height: 82px;
    padding: 15px 16px;
    grid-template-areas:
      'title chevron'
      'result result';
    grid-template-columns: minmax(0, 1fr) 22px;
    row-gap: 5px;
    column-gap: 12px;
  }

  .summary-left {
    grid-area: title;
  }

  .rule-result {
    grid-area: result;
    overflow: visible;
    text-align: left;
    text-overflow: clip;
    white-space: normal;
  }

  .chevron {
    grid-area: chevron;
    align-self: center;
  }

  .rule-body {
    padding: 20px 16px 22px;
  }

  .option {
    min-height: 82px;
  }

  .final-summary {
    padding: 20px 16px;
  }

  .final-summary dl > div {
    grid-template-columns: 92px minmax(0, 1fr);
    gap: 12px;
  }
}
</style>
