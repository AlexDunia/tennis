<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import QRCode from 'qrcode'
import { useRouter } from 'vue-router'
import { useAdminStore } from '../stores/admin.js'
import { useChallengeStore } from '../stores/challenge.js'
import { useFriendlyMatchStore } from '../stores/friendlyMatch.js'
import { useMatchStore } from '../stores/match.js'
import MatchFormatEditor from '../components/match/MatchFormatEditor.vue'
import { ladderRosterFromSetup } from '../domain/competitionScope.js'
import { effectiveLadderRoster } from '../services/LadderAdminService.js'
import { evaluateLadderMatchup, getLadderPlayerAvailability } from '../services/LadderAccessService.js'
import { ladderMatchConfig, ladderWindowFor, resolveLadderConfigFromSetup } from '../config/ladder.js'
import { freezeMatchRulesSnapshot, validateMatchRulesSnapshot } from '../domain/matchRules.js'
import { ladderRulesToMatchRulesSnapshot, matchRulesSnapshotToLegacyLadderConfig } from '../domain/ruleAdapters/ladderMatchRules.js'
import { formatMatchRulesSummary } from '../utils/matchRulesSummary.js'
import { collectClubMembers } from '../utils/club/memberData.js'
import { startOrResumeLadderMatch } from '../services/LadderLiveMatchService.js'

const router = useRouter()
const adminStore = useAdminStore()
const challengeStore = useChallengeStore()
const friendlyMatchStore = useFriendlyMatchStore()
const matchStore = useMatchStore()
const loading = ref(true)
const stage = ref('opponent')
const activeLadderId = ref('')
const selectedOpponentId = ref('')
const ruleMode = ref('ladder')
const customRulesSnapshot = ref(null)
const customRulesSaved = ref(false)
const timing = ref('now')
const createdChallengeId = ref('')
const qrDataUrl = ref('')
const copyStatus = ref('')
const error = ref('')
const submitting = ref(false)
const schedule = reactive({ date: '', time: '', court: '' })
let waitTimer = null

const setup = computed(() => adminStore.activeClub?.setup || {})
const key = (value) => String(value || '').trim().toLowerCase()
const currentMember = computed(() => {
  const memberId = key(adminStore.activeMembership?.memberId)
  if (!memberId) return null
  return collectClubMembers(setup.value).find(
    (member) => key(member.id) === memberId,
  ) || null
})
const activeLadders = computed(() => Array.isArray(adminStore.activeLadders) ? adminStore.activeLadders : [])
function scope(ladder) {
  return { clubId: adminStore.activeClubId || '', ladderId: String(ladder?.id || '') }
}
function rosterFor(ladder) {
  if (!ladder?.id) return []
  const raw = ladderRosterFromSetup({ setup: setup.value, ladderId: ladder.id }).roster
  return effectiveLadderRoster(scope(ladder), raw)
}
const memberLadders = computed(() => activeLadders.value
  .map((ladder) => ({ ladder, roster: rosterFor(ladder) }))
  .filter(({ roster }) => roster.some((player) => key(player.id) === key(currentMember.value?.id))))
const activeLadderEntry = computed(() =>
  memberLadders.value.find(({ ladder }) => ladder.id === activeLadderId.value) ||
  memberLadders.value[0] || null)
const activeLadder = computed(() => activeLadderEntry.value?.ladder || null)
const roster = computed(() => activeLadderEntry.value?.roster || [])
const currentLadderPlayer = computed(() =>
  roster.value.find((player) => key(player.id) === key(currentMember.value?.id)) || null)
const activeLadderConfig = computed(() =>
  activeLadder.value ? resolveLadderConfigFromSetup(setup.value, activeLadder.value.id) : null)
const ladderWindow = computed(() =>
  currentLadderPlayer.value && activeLadderConfig.value
    ? ladderWindowFor(currentLadderPlayer.value, activeLadderConfig.value) : null)
const selectedOpponent = computed(() =>
  roster.value.find((player) => player.id === selectedOpponentId.value) || null)

function availabilityFor(player) {
  if (!player || !activeLadder.value || !activeLadderConfig.value) {
    return { available: false, label: 'Unavailable', blocking: null }
  }
  return getLadderPlayerAvailability({
    player,
    challenges: challengeStore.challenges,
    config: activeLadderConfig.value,
    clubId: adminStore.activeClubId || '',
    ladderId: activeLadder.value.id,
  })
}
const currentPlayerAvailability = computed(() => availabilityFor(currentLadderPlayer.value))
function blockingChallenge(availability) {
  return availability?.blocking?.kind === 'challenge'
    ? challengeStore.challenges.find((challenge) => challenge.id === availability.blocking.id) || null
    : null
}
function otherPlayerName(challenge, player) {
  if (!challenge) return ''
  const otherId = key(challenge.challengerId) === key(player?.id)
    ? challenge.defenderId : challenge.challengerId
  return roster.value.find((candidate) => key(candidate.id) === key(otherId))?.name || ''
}
function dateTime(value) {
  const date = new Date(value || '')
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(date)
}
function availabilityDetail(player, availability) {
  const challenge = blockingChallenge(availability)
  if (!challenge) return { primary: availability?.label || 'Unavailable', secondary: '' }
  const opponent = otherPlayerName(challenge, player)
  if (challenge.status === 'live') {
    return { primary: 'Playing now', secondary: opponent ? 'vs ' + opponent : '' }
  }
  if (challenge.status === 'scheduled') {
    const when = dateTime(challenge.scheduledAt)
    return { primary: when ? 'Scheduled - ' + when : 'Match scheduled', secondary: opponent ? 'vs ' + opponent : '' }
  }
  return { primary: availability?.label || 'Unavailable', secondary: opponent ? 'vs ' + opponent : '' }
}
const challengeRows = computed(() => {
  const window = ladderWindow.value
  if (!window || !currentLadderPlayer.value) return []
  return roster.value
    .filter((player) => key(player.id) !== key(currentLadderPlayer.value.id))
    .filter((player) => {
      const rank = Number(player.rank || player.ladderRank)
      return Number.isFinite(rank) && rank >= window.highest && rank <= window.lowest
    })
    .map((player) => {
      const availability = availabilityFor(player)
      return { player, availability, detail: availabilityDetail(player, availability) }
    })
})
const ladderRulesSnapshot = computed(() => {
  if (!activeLadderConfig.value) return null
  const adapted = ladderRulesToMatchRulesSnapshot({
    ladderConfigSnapshot: activeLadderConfig.value,
    matchConfig: ladderMatchConfig(activeLadderConfig.value),
  })
  return adapted.ok ? freezeMatchRulesSnapshot(adapted.snapshot) : null
})
const selectedRulesSnapshot = computed(() =>
  ruleMode.value === 'ladder'
    ? ladderRulesSnapshot.value
    : customRulesSaved.value ? customRulesSnapshot.value : null)
const rulesSummary = computed(() =>
  selectedRulesSnapshot.value ? formatMatchRulesSummary(selectedRulesSnapshot.value) : null)
const currentChallenge = computed(() =>
  challengeStore.challenges.find((challenge) => challenge.id === createdChallengeId.value) || null)
const currentMatch = computed(() =>
  matchStore.matches.find((match) => match.challengeId === createdChallengeId.value) || null)
const activeInvitation = computed(() =>
  friendlyMatchStore.invitations.find((item) => item.challengeId === createdChallengeId.value) || null)
const joinUrl = computed(() => {
  const token = activeInvitation.value?.token
  if (!token || typeof window === 'undefined') return ''
  const href = router.resolve({ name: 'FriendlyMatchJoinInvitation', params: { token } }).href
  return new URL(href, window.location.href).href
})

function initials(name = '') {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}
function clone(value) {
  if (!value) return null
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value))
}
function resetUncommittedFlow() {
  stage.value = 'opponent'
  selectedOpponentId.value = ''
  ruleMode.value = 'ladder'
  customRulesSnapshot.value = null
  customRulesSaved.value = false
  timing.value = 'now'
  createdChallengeId.value = ''
  qrDataUrl.value = ''
  copyStatus.value = ''
  error.value = ''
  Object.assign(schedule, { date: '', time: '', court: '' })
  stopWaiting()
}
function chooseLadder(id) {
  if (id === activeLadderId.value) return
  activeLadderId.value = id
  resetUncommittedFlow()
}
function matchup(challenger, opponent) {
  return evaluateLadderMatchup({
    challenger, opponent, players: roster.value, challenges: challengeStore.challenges,
    config: activeLadderConfig.value, clubId: adminStore.activeClubId || '', ladderId: activeLadder.value?.id || '',
  })
}
async function chooseOpponent(player) {
  error.value = ''
  await challengeStore.loadChallenges()
  const challenger = roster.value.find((item) => key(item.id) === key(currentLadderPlayer.value?.id))
  const opponent = roster.value.find((item) => key(item.id) === key(player.id))
  const decision = challenger && opponent && activeLadderConfig.value ? matchup(challenger, opponent) : null
  if (!decision?.allowed) {
    error.value = decision?.message || 'This player is no longer available.'
    return
  }
  selectedOpponentId.value = opponent.id
  ruleMode.value = 'ladder'
  customRulesSnapshot.value = clone(ladderRulesSnapshot.value)
  customRulesSaved.value = false
  friendlyMatchStore.beginMatch()
  friendlyMatchStore.chooseMatchType('ladder', { ladderConfig: activeLadderConfig.value })
  friendlyMatchStore.bindSetupClub(adminStore.activeClubId)
  friendlyMatchStore.chooseOpponent(opponent)
  stage.value = 'setup'
}
function chooseRuleMode(mode) {
  if (!['ladder', 'custom'].includes(mode)) return
  ruleMode.value = mode
  if (mode === 'custom') {
    customRulesSnapshot.value = clone(ladderRulesSnapshot.value)
    customRulesSaved.value = false
  }
}
function saveCustomRules(snapshot) {
  if (!validateMatchRulesSnapshot(snapshot).valid) return
  customRulesSnapshot.value = freezeMatchRulesSnapshot(snapshot)
  customRulesSaved.value = true
  error.value = ''
}
function scheduleIso() {
  if (timing.value !== 'later' || !schedule.date || !schedule.time) return null
  const date = new Date(schedule.date + 'T' + schedule.time)
  return Number.isNaN(date.getTime()) || date.getTime() <= Date.now() ? null : date.toISOString()
}
async function submitChallenge() {
  if (submitting.value || !selectedOpponent.value || !currentLadderPlayer.value || !activeLadder.value) return
  error.value = ''
  const rules = selectedRulesSnapshot.value
  if (!rules) {
    error.value = ruleMode.value === 'custom'
      ? 'Save the custom rules before sending the challenge.'
      : 'Choose valid match rules before continuing.'
    return
  }
  if (!validateMatchRulesSnapshot(rules).valid) {
    error.value = 'These match rules are not valid.'
    return
  }
  const scheduledAt = scheduleIso()
  if (timing.value === 'later' && !scheduledAt) {
    error.value = 'Choose a future date and time.'
    return
  }
  const matchConfig = matchRulesSnapshotToLegacyLadderConfig(rules)
  if (!matchConfig) {
    error.value = 'These match rules could not be prepared.'
    return
  }
  submitting.value = true
  try {
    await challengeStore.loadChallenges()
    const challenger = roster.value.find((item) => key(item.id) === key(currentLadderPlayer.value?.id))
    const opponent = roster.value.find((item) => key(item.id) === key(selectedOpponent.value?.id))
    const decision = challenger && opponent ? matchup(challenger, opponent) : null
    if (!decision?.allowed) {
      error.value = decision?.message || 'This challenge is no longer available.'
      stage.value = 'opponent'
      return
    }
    if (ruleMode.value === 'ladder') friendlyMatchStore.applyLadderRules(activeLadderConfig.value)
    else friendlyMatchStore.selectCustomFormat({ name: 'Match agreement', rulesSnapshot: rules })
    if (timing.value === 'later') {
      friendlyMatchStore.updateSchedule('date', schedule.date)
      friendlyMatchStore.updateSchedule('time', schedule.time)
      friendlyMatchStore.updateSchedule('court', schedule.court)
    }
    const challenge = await challengeStore.createChallenge({
      clubId: adminStore.activeClubId,
      ladderId: activeLadder.value.id,
      challengerId: challenger.id,
      defenderId: opponent.id,
      scorerId: null,
      timing: timing.value,
      scheduledAt: timing.value === 'later' ? scheduledAt : null,
      court: timing.value === 'later' ? schedule.court : '',
      preMatchPositions: { challenger: challenger.rank, defender: opponent.rank },
      ladderConfigSnapshot: { ...activeLadderConfig.value },
      rulesSnapshot: rules,
      matchConfig,
      notifyOpponent: true,
      notificationIntent: 'ladder_challenge_email',
    })
    if (!challenge) {
      error.value = challengeStore.error || 'The challenge could not be created.'
      return
    }
    friendlyMatchStore.linkLadderRecords(challenge)
    const identity = {
      id: challenger.id, name: challenger.name, rank: challenger.rank,
      category: activeLadder.value.name || 'Ladder',
    }
    friendlyMatchStore.chooseTiming(timing.value, identity, { createInvitation: false })
    const invitation = friendlyMatchStore.createLadderInvitation(identity)
    createdChallengeId.value = challenge.id
    stage.value = 'invite'
    if (!invitation) {
      error.value = 'The challenge was created, but its share invitation could not be prepared. Do not submit another challenge.'
      return
    }
    await generateQrCode()
    startWaiting()
  } finally {
    submitting.value = false
  }
}
async function generateQrCode() {
  if (!joinUrl.value) {
    qrDataUrl.value = ''
    return
  }
  try {
    qrDataUrl.value = await QRCode.toDataURL(joinUrl.value, {
      width: 248, margin: 2, color: { dark: '#172319', light: '#ffffff' }, errorCorrectionLevel: 'M',
    })
  } catch {
    qrDataUrl.value = ''
  }
}
async function copyJoinLink() {
  if (!joinUrl.value) return
  try {
    await navigator.clipboard.writeText(joinUrl.value)
    copyStatus.value = 'Invitation link copied.'
  } catch {
    copyStatus.value = 'Select the link to copy it.'
  }
  window.setTimeout(() => { copyStatus.value = '' }, 2200)
}
async function refreshWaitingState() {
  if (stage.value !== 'invite') return
  friendlyMatchStore.refreshInvitations()
  await Promise.all([challengeStore.loadChallenges(), matchStore.loadMatches()])
}
function stopWaiting() {
  if (!waitTimer) return
  window.clearInterval(waitTimer)
  waitTimer = null
}
function startWaiting() {
  stopWaiting()
  waitTimer = window.setInterval(refreshWaitingState, 2600)
}
async function startMatch() {
  if (!currentChallenge.value || !currentMatch.value || !currentLadderPlayer.value || timing.value !== 'now') return
  error.value = ''
  friendlyMatchStore.linkLadderRecords(currentChallenge.value, currentMatch.value)
  const started = await startOrResumeLadderMatch({
    match: currentMatch.value, actorId: currentLadderPlayer.value.id,
    clubId: adminStore.activeClubId || '', explicitStart: true,
  })
  if (!started.ok) {
    error.value = started.message || 'This Ladder match could not be started.'
    return
  }
  if (!friendlyMatchStore.attachCanonicalLiveMatch(started.match, started.canonicalMatch, started.session)) {
    error.value = 'The live Match could not be attached.'
    return
  }
  await Promise.all([challengeStore.loadChallenges(), matchStore.loadMatches()])
  router.push({ name: 'LiveMatch', params: { matchId: started.match.id } })
}
function handleStorage(event) {
  const changed = String(event.key || '')
  if (stage.value === 'invite' && (changed.includes('friendlyMatchInvitations') || changed.includes('ladder'))) {
    refreshWaitingState()
  }
}
function handleVisibility() {
  if (document.visibilityState === 'visible') refreshWaitingState()
}
onMounted(async () => {
  loading.value = true
  try {
    await Promise.all([adminStore.loadClubs(), challengeStore.loadChallenges(), matchStore.loadMatches()])
    const preferred = memberLadders.value.find(({ ladder }) => ladder.id === setup.value.primaryLadderId) || memberLadders.value[0]
    activeLadderId.value = preferred?.ladder?.id || ''
  } catch (loadError) {
    error.value = loadError?.message || 'GORRA could not open your Ladder.'
  } finally {
    loading.value = false
  }
  window.addEventListener('storage', handleStorage)
  window.addEventListener('focus', refreshWaitingState)
  document.addEventListener('visibilitychange', handleVisibility)
})
onUnmounted(() => {
  stopWaiting()
  window.removeEventListener('storage', handleStorage)
  window.removeEventListener('focus', refreshWaitingState)
  document.removeEventListener('visibilitychange', handleVisibility)
})
watch(() => activeInvitation.value?.token, generateQrCode)
watch(stage, (value) => { if (value === 'invite') startWaiting(); else stopWaiting() })
</script>

<template>
  <main class="play-ladder">
    <header class="play-ladder__header">
      <div>
        <p class="play-ladder__eyebrow">Ladder match</p>
        <h1>{{ stage === 'opponent' ? 'Who are you playing?' : stage === 'setup' ? 'Set up this match.' : 'Invite your opponent.' }}</h1>
        <p>{{ stage === 'opponent' ? 'Choose someone in your challenge range.' : stage === 'setup' ? 'Confirm the rules and when you want to play.' : 'Your challenge is ready. Your opponent can open the invitation or scan the QR code.' }}</p>
      </div>
      <span class="play-ladder__step">{{ stage === 'opponent' ? '1 of 3' : stage === 'setup' ? '2 of 3' : '3 of 3' }}</span>
    </header>

    <p v-if="error" class="play-ladder__error" role="alert">{{ error }}</p>
    <section v-if="loading" class="play-ladder__empty">Opening your Ladder...</section>
    <section v-else-if="!currentMember" class="play-ladder__empty">
      <h2>Your Club member profile needs attention.</h2>
      <p>This account does not yet have one connected Club member record.</p>
    </section>
    <section v-else-if="!memberLadders.length" class="play-ladder__empty">
      <h2>You are not on an active Ladder yet.</h2>
      <p>Join an active Ladder before creating a Ladder challenge.</p>
      <button type="button" class="play-ladder-button secondary" @click="router.push({ name: 'Rankings' })">Open Ladder</button>
    </section>

    <template v-else>
      <label v-if="memberLadders.length > 1" class="play-ladder__switcher">
        <span>Ladder</span>
        <select :value="activeLadderId" @change="chooseLadder($event.target.value)">
          <option v-for="{ ladder } in memberLadders" :key="ladder.id" :value="ladder.id">{{ ladder.name }}</option>
        </select>
      </label>

      <section v-if="stage === 'opponent'" class="play-ladder__section">
        <article class="play-ladder-self">
          <span class="play-ladder-rank">#{{ currentLadderPlayer?.rank }}</span>
          <span class="play-ladder-avatar">{{ initials(currentLadderPlayer?.name) }}</span>
          <span class="play-ladder-player-copy"><strong>{{ currentLadderPlayer?.name }}</strong><small>{{ activeLadder?.name }} - You</small></span>
        </article>
        <p v-if="!currentPlayerAvailability.available" class="play-ladder__notice">{{ currentPlayerAvailability.label || 'Finish your current Ladder commitment before creating another challenge.' }}</p>
        <div class="play-ladder__section-head">
          <h2>Players you can challenge</h2>
          <p v-if="ladderWindow">Your challenge range is #{{ ladderWindow.highest }}-#{{ ladderWindow.lowest }}.</p>
        </div>
        <div class="play-ladder-list">
          <article v-for="row in challengeRows" :key="row.player.id" class="play-ladder-player" :class="{ 'is-unavailable': !row.availability.available }">
            <span class="play-ladder-rank">#{{ row.player.rank }}</span>
            <span class="play-ladder-avatar">{{ initials(row.player.name) }}</span>
            <span class="play-ladder-player-copy">
              <strong>{{ row.player.name }}</strong>
              <small v-if="row.availability.available">Available</small>
              <small v-else>{{ row.detail.primary }}<template v-if="row.detail.secondary"> - {{ row.detail.secondary }}</template></small>
            </span>
            <button v-if="row.availability.available && currentPlayerAvailability.available" type="button" class="play-ladder-button primary compact" @click="chooseOpponent(row.player)">Challenge</button>
            <span v-else class="play-ladder-player__state">{{ row.detail.primary }}</span>
          </article>
          <p v-if="!challengeRows.length" class="play-ladder__quiet">No players are currently inside your challenge range.</p>
        </div>
      </section>

      <section v-else class="play-ladder__section">
        <article class="play-ladder-matchup">
          <div><small>You</small><strong>{{ currentLadderPlayer?.name }}</strong><span>#{{ currentLadderPlayer?.rank }}</span></div>
          <b>vs</b>
          <div><small>Opponent</small><strong>{{ selectedOpponent?.name }}</strong><span>#{{ selectedOpponent?.rank }}</span></div>
        </article>
        <button v-if="stage === 'setup'" type="button" class="play-ladder-text-action" @click="resetUncommittedFlow">Change opponent</button>

        <div v-if="stage === 'setup'" class="play-ladder-setup">
          <section class="play-ladder-block">
            <header><small>Match rules</small><h2>How should this match be played?</h2></header>
            <div class="play-ladder-choice-grid">
              <button type="button" class="play-ladder-choice" :class="{ active: ruleMode === 'ladder' }" @click="chooseRuleMode('ladder')"><strong>Ladder rules</strong><small>Use the match rules set for {{ activeLadder?.name }}.</small></button>
              <button type="button" class="play-ladder-choice" :class="{ active: ruleMode === 'custom' }" @click="chooseRuleMode('custom')"><strong>Custom for this match</strong><small>Use different scoring rules agreed with {{ selectedOpponent?.name }}.</small></button>
            </div>
            <div v-if="ruleMode === 'ladder' && rulesSummary?.valid" class="play-ladder-rules">
              <span v-for="row in rulesSummary.rows" :key="row.key"><small>{{ row.label }}</small><strong>{{ row.value }}</strong></span>
            </div>
            <template v-else-if="ruleMode === 'custom' && customRulesSnapshot">
              <p v-if="!customRulesSaved" class="play-ladder__notice">Save your custom rules with "Use these rules" before sending the challenge.</p>
              <MatchFormatEditor :model-value="customRulesSnapshot" save-label="Use these rules" @save="saveCustomRules" />
            </template>
          </section>

          <section class="play-ladder-block">
            <header><small>When</small><h2>When are you playing?</h2></header>
            <div class="play-ladder-choice-grid">
              <button type="button" class="play-ladder-choice" :class="{ active: timing === 'now' }" @click="timing = 'now'"><strong>Play now</strong><small>Invite them to join now.</small></button>
              <button type="button" class="play-ladder-choice" :class="{ active: timing === 'later' }" @click="timing = 'later'"><strong>Schedule</strong><small>Choose a time for later.</small></button>
            </div>
            <div v-if="timing === 'later'" class="play-ladder-schedule">
              <label><span>Date</span><input v-model="schedule.date" type="date" /></label>
              <label><span>Time</span><input v-model="schedule.time" type="time" /></label>
              <label><span>Court</span><input v-model="schedule.court" type="text" maxlength="80" placeholder="Optional" /></label>
            </div>
          </section>
          <footer class="play-ladder-actions">
            <button type="button" class="play-ladder-button primary" :disabled="submitting" @click="submitChallenge">{{ submitting ? 'Creating...' : timing === 'now' ? 'Invite ' + (selectedOpponent?.name || 'opponent') : 'Send challenge' }}</button>
          </footer>
        </div>

        <section v-else class="play-ladder-invite">
          <template v-if="timing === 'now' && currentChallenge?.status === 'accepted' && currentMatch">
            <div class="play-ladder-ready"><span aria-hidden="true">OK</span><div><strong>{{ selectedOpponent?.name }} joined.</strong><small>You are ready to play.</small></div></div>
            <button type="button" class="play-ladder-button primary" @click="startMatch">Start match</button>
          </template>
          <template v-else-if="timing === 'later' && currentChallenge?.status === 'scheduled'">
            <div class="play-ladder-ready"><span aria-hidden="true">OK</span><div><strong>Match scheduled.</strong><small>{{ dateTime(currentChallenge.scheduledAt) }}<template v-if="currentChallenge.court"> - {{ currentChallenge.court }}</template></small></div></div>
          </template>
          <template v-else>
            <header><small>Invitation</small><h2>Waiting for {{ selectedOpponent?.name }}</h2><p>They can open the invitation or scan the QR code.</p></header>
            <div class="play-ladder-invite__body">
              <div v-if="qrDataUrl" class="play-ladder-qr"><img :src="qrDataUrl" alt="Ladder challenge QR code" /></div>
              <div class="play-ladder-invite__copy"><p>Email notification requested. You can also share this link directly.</p><button type="button" class="play-ladder-button secondary" @click="copyJoinLink">Copy invitation link</button><small v-if="copyStatus" role="status">{{ copyStatus }}</small></div>
            </div>
          </template>
        </section>
      </section>
    </template>
  </main>
</template>

<style scoped>
.play-ladder { width: min(100%, 920px); margin: 0 auto; padding: 6px 0 54px; color: var(--color-text); }
.play-ladder__header { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 30px; }
.play-ladder__header h1, .play-ladder__section-head h2, .play-ladder-block h2, .play-ladder-invite h2, .play-ladder__empty h2 { margin: 0; color: var(--color-text); font-weight: var(--font-weight-semibold); letter-spacing: -0.02em; }
.play-ladder__header h1 { font-size: 25px; }
.play-ladder__header p, .play-ladder__section-head p, .play-ladder-invite header p, .play-ladder__empty, .play-ladder__quiet { margin: 7px 0 0; color: var(--color-muted); font-size: 12px; line-height: 1.55; }
.play-ladder__eyebrow, .play-ladder-block header small, .play-ladder-invite header small { display: block; margin-bottom: 7px; color: var(--color-primary-strong); font-size: 10px; font-weight: var(--font-weight-semibold); letter-spacing: 0.08em; text-transform: uppercase; }
.play-ladder__step { color: var(--color-muted); font-size: 11px; }
.play-ladder__section, .play-ladder-setup, .play-ladder-block, .play-ladder-invite, .play-ladder-list { display: grid; gap: 22px; }
.play-ladder-block + .play-ladder-block { padding-top: 28px; border-top: 1px solid var(--color-border); }
.play-ladder-self, .play-ladder-player { display: grid; grid-template-columns: 44px 42px minmax(0, 1fr) auto; align-items: center; gap: 12px; border-radius: var(--app-card-radius); }
.play-ladder-self { min-height: 76px; padding: 14px 18px; border: 1px solid color-mix(in srgb, var(--color-primary) 14%, var(--color-border)); background: color-mix(in srgb, var(--color-primary) 4%, white); }
.play-ladder-player { min-height: 82px; padding: 14px 18px; border: 1px solid var(--color-border); background: var(--color-surface); }
.play-ladder-player.is-unavailable { background: color-mix(in srgb, var(--color-surface-soft) 38%, white); }
.play-ladder-rank { color: var(--color-text-soft); font-size: 12px; font-weight: var(--font-weight-semibold); }
.play-ladder-avatar { display: grid; width: 42px; height: 42px; place-items: center; border-radius: 50%; background: var(--color-surface-soft); color: var(--color-primary-strong); font-size: 10px; font-weight: var(--font-weight-semibold); }
.play-ladder-player-copy { display: grid; min-width: 0; gap: 4px; }
.play-ladder-player-copy strong { overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.play-ladder-player-copy small, .play-ladder-player__state { color: var(--color-muted); font-size: 11px; line-height: 1.4; }
.play-ladder-player__state { text-align: right; }
.play-ladder-button { min-height: 40px; padding: 0 14px; border: 1px solid var(--color-border); border-radius: var(--app-inner-radius); background: var(--color-surface); color: var(--color-text); font: inherit; font-size: 11px; font-weight: var(--font-weight-semibold); }
.play-ladder-button.primary { border-color: var(--color-primary); background: var(--color-primary); color: #fff; }
.play-ladder-button.primary:hover { background: var(--color-primary-strong); }
.play-ladder-button:disabled { cursor: not-allowed; opacity: 0.55; }
.play-ladder-button.compact { min-height: 36px; }
.play-ladder__notice, .play-ladder__error { margin: 0; padding: 12px 14px; border-radius: var(--app-inner-radius); font-size: 11px; line-height: 1.5; }
.play-ladder__notice { border: 1px solid color-mix(in srgb, var(--color-primary) 14%, var(--color-border)); background: color-mix(in srgb, var(--color-primary) 4%, white); color: var(--color-text-soft); }
.play-ladder__error { border: 1px solid #efc8c8; background: #fff7f7; color: #8b2d2d; }
.play-ladder__switcher { display: grid; width: min(100%, 300px); gap: 6px; margin-bottom: 24px; }
.play-ladder__switcher span, .play-ladder-schedule label > span { color: var(--color-muted); font-size: 10px; font-weight: var(--font-weight-semibold); }
.play-ladder__switcher select, .play-ladder-schedule input { width: 100%; min-height: 44px; padding: 0 11px; border: 1px solid var(--color-border); border-radius: var(--app-control-radius); background: var(--color-surface); color: var(--color-text); font: inherit; }
.play-ladder-matchup { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 20px; padding: 18px 20px; border: 1px solid var(--color-border); border-radius: var(--app-card-radius); background: var(--color-surface); }
.play-ladder-matchup > div { display: grid; gap: 3px; }
.play-ladder-matchup > div:last-child { text-align: right; }
.play-ladder-matchup small, .play-ladder-matchup span { color: var(--color-muted); font-size: 10px; }
.play-ladder-matchup strong { font-size: 13px; }
.play-ladder-matchup b { color: var(--color-primary-strong); font-size: 11px; }
.play-ladder-text-action { justify-self: end; margin-top: -14px; padding: 0; border: 0; background: transparent; color: var(--color-primary-strong); font: inherit; font-size: 11px; font-weight: var(--font-weight-semibold); }
.play-ladder-choice-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.play-ladder-choice { display: grid; min-height: 86px; align-content: center; gap: 4px; padding: 15px 16px; border: 1px solid var(--color-border); border-radius: var(--app-card-radius); background: var(--color-surface); color: var(--color-text); text-align: left; }
.play-ladder-choice strong { font-size: 12px; }
.play-ladder-choice small { color: var(--color-muted); font-size: 10px; line-height: 1.45; }
.play-ladder-choice.active { border-color: color-mix(in srgb, var(--color-primary) 42%, var(--color-border)); background: color-mix(in srgb, var(--color-primary) 4%, white); }
.play-ladder-rules { overflow: hidden; border: 1px solid var(--color-border); border-radius: var(--app-card-radius); background: color-mix(in srgb, var(--color-primary) 2%, white); }
.play-ladder-rules > span { display: grid; min-height: 50px; grid-template-columns: 120px minmax(0, 1fr); align-items: center; gap: 16px; padding: 11px 14px; }
.play-ladder-rules > span + span { border-top: 1px solid var(--color-border); }
.play-ladder-rules small { color: var(--color-muted); font-size: 10px; }
.play-ladder-rules strong { color: var(--color-text-soft); font-size: 11px; text-align: right; }
.play-ladder-schedule { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.play-ladder-schedule label { display: grid; gap: 6px; }
.play-ladder-actions { display: flex; justify-content: flex-end; }
.play-ladder-invite__body { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 24px; padding: 22px; border: 1px solid var(--color-border); border-radius: var(--app-card-radius); background: var(--color-surface); }
.play-ladder-qr { display: grid; width: 272px; max-width: 100%; place-items: center; padding: 12px; border: 1px solid var(--color-border); border-radius: var(--app-card-radius); }
.play-ladder-qr img { display: block; width: min(248px, 100%); height: auto; }
.play-ladder-invite__copy { display: grid; justify-items: start; gap: 12px; }
.play-ladder-invite__copy p { margin: 0; color: var(--color-text-soft); font-size: 11px; line-height: 1.55; }
.play-ladder-invite__copy small { color: var(--color-muted); font-size: 10px; }
.play-ladder-ready { display: flex; align-items: center; gap: 12px; padding: 15px 16px; border: 1px solid color-mix(in srgb, var(--color-primary) 20%, var(--color-border)); border-radius: var(--app-card-radius); background: color-mix(in srgb, var(--color-primary) 5%, white); }
.play-ladder-ready > div { display: grid; gap: 3px; }
.play-ladder-ready strong { font-size: 12px; }
.play-ladder-ready small { color: var(--color-muted); font-size: 10px; }
.play-ladder__empty { padding: 34px 0; }
.play-ladder__empty h2 { font-size: 17px; }
.play-ladder__empty p { margin: 7px 0 18px; }
@media (max-width: 767px) {
  .play-ladder { padding-bottom: 42px; }
  .play-ladder__header h1 { font-size: 22px; }
  .play-ladder-self, .play-ladder-player { grid-template-columns: 32px 38px minmax(0, 1fr) auto; gap: 9px; }
  .play-ladder-avatar { width: 38px; height: 38px; }
  .play-ladder-choice-grid, .play-ladder-schedule, .play-ladder-invite__body { grid-template-columns: 1fr; }
  .play-ladder-qr { margin-inline: auto; }
  .play-ladder-invite__copy { justify-items: stretch; text-align: center; }
}
@media (max-width: 430px) {
  .play-ladder-self, .play-ladder-player { grid-template-columns: 28px 36px minmax(0, 1fr); row-gap: 10px; }
  .play-ladder-player > .play-ladder-button, .play-ladder-player > .play-ladder-player__state { grid-column: 3; justify-self: start; text-align: left; }
  .play-ladder-rules > span { grid-template-columns: 1fr; gap: 4px; }
  .play-ladder-rules strong { text-align: left; }
  .play-ladder-actions .play-ladder-button { width: 100%; }
}
</style>

