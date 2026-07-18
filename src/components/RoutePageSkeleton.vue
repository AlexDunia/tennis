<script setup>
import { computed } from 'vue'

const props = defineProps({
  routeName: { type: String, default: '' },
  friendlyStep: { type: String, default: '' },
  friendlyMatchType: { type: String, default: '' },
  friendlyTiming: { type: String, default: '' },
  freshDashboard: { type: Boolean, default: false },
  opponentCount: { type: Number, default: 3 },
})

const variant = computed(() => {
  if (props.friendlyStep === 'format' && props.friendlyMatchType === 'friendly')
    return 'friendly-match-format'
  if (props.friendlyStep === 'customFormat' && props.friendlyMatchType === 'friendly')
    return 'friendly-custom-format'
  if (props.friendlyStep === 'scoring' && props.friendlyMatchType === 'friendly')
    return 'friendly-format'
  if (
    props.friendlyStep === 'opponent' &&
    props.friendlyMatchType === 'friendly' &&
    props.friendlyTiming === 'later'
  )
    return 'friendly-opponent-later'
  if (props.friendlyStep) return `friendly-${props.friendlyStep}`
  if (props.routeName === 'Dashboard') return props.freshDashboard ? 'dashboard-fresh' : 'dashboard'

  return (
    {
      Rankings: 'rankings',
      Tournaments: 'tournaments',
      TournamentCreate: 'tournament-create',
      TournamentOverview: 'tournament-overview',
      TournamentCategory: 'tournament-category',
      TournamentSchedule: 'tournament-schedule',
      TournamentGallery: 'tournament-gallery',
      TournamentMatchDetails: 'match-details',
      MatchDetails: 'match-details',
      Challenges: 'challenges',
      CreateChallenge: 'challenge-create',
      Notifications: 'notifications',
      Profile: 'profile',
      PlayMatch: 'live-scoreboard',
      AdminSetup: 'onboarding-admin',
      PlayerClubJoin: 'onboarding-join',
    }[props.routeName] || 'list'
  )
})

const rows = Object.freeze([1, 2, 3, 4, 5, 6])
const opponentRows = computed(() =>
  Array.from({ length: Math.max(1, props.opponentCount) }, (_, index) => index + 1),
)
</script>

<template>
  <div
    class="route-skeleton"
    :class="`route-skeleton--${variant}`"
    :aria-label="`${routeName || 'Page'} loading`"
  >
    <template v-if="variant === 'onboarding-admin'">
      <div class="onboarding-progress">
        <span class="sk sk-line w-18 thin"></span>
        <span class="sk sk-line progress-line"></span>
      </div>
      <div class="flow-body onboarding-body">
        <div class="intro-block">
          <span class="sk sk-line w-14 thin"></span>
          <span class="sk sk-line w-58 title"></span>
          <span class="sk sk-line w-62"></span>
        </div>
        <span class="sk sk-field onboarding-field"></span>
        <div class="onboarding-actions">
          <span class="sk sk-button"></span><span class="sk sk-button"></span>
        </div>
      </div>
    </template>

    <template v-else-if="variant === 'onboarding-join'">
      <div class="flow-head">
        <span class="sk sk-square"></span><span class="sk sk-line w-22"></span>
      </div>
      <div class="flow-body onboarding-body">
        <div class="intro-block">
          <span class="sk sk-line w-14 thin"></span>
          <span class="sk sk-line w-58 title"></span>
          <span class="sk sk-line w-62"></span>
        </div>
        <div class="stack gap-12">
          <span v-for="row in [1, 2, 3]" :key="row" class="sk sk-choice"></span>
        </div>
        <span class="sk sk-button push"></span>
      </div>
    </template>

    <template v-else-if="variant === 'friendly-type'">
      <div class="flow-head">
        <span class="sk sk-square"></span><span class="sk sk-line w-22"></span
        ><span class="sk sk-line w-8 push"></span>
      </div>
      <div class="flow-body">
        <div class="intro-block">
          <span class="sk sk-line w-10 thin"></span><span class="sk sk-line w-48 title"></span>
        </div>
        <div class="stack gap-12">
          <span v-for="row in [1, 2, 3]" :key="row" class="sk sk-choice"></span>
        </div>
      </div>
    </template>

    <template v-else-if="variant === 'friendly-timing'">
      <div class="flow-head">
        <span class="sk sk-square"></span><span class="sk sk-line w-22"></span
        ><span class="sk sk-line w-8 push"></span>
      </div>
      <div class="flow-body">
        <div class="intro-block">
          <span class="sk sk-line w-14 thin"></span><span class="sk sk-line w-40 title"></span
          ><span class="sk sk-line w-62"></span>
        </div>
        <div class="two-grid">
          <span class="sk sk-format"></span><span class="sk sk-format"></span>
        </div>
      </div>
    </template>

    <template
      v-else-if="
        variant === 'friendly-opponent' ||
        variant === 'friendly-opponent-later' ||
        variant === 'friendly-clubOpponent'
      "
    >
      <div class="flow-head">
        <span class="sk sk-square"></span><span class="sk sk-line w-24"></span
        ><span class="sk sk-line w-8 push"></span>
      </div>
      <div class="flow-body">
        <div class="intro-block">
          <span class="sk sk-line w-18 thin"></span><span class="sk sk-line w-38 title"></span
          ><span class="sk sk-line w-52"></span>
        </div>
        <span class="sk sk-notice"></span>
        <span class="sk sk-search"></span>
        <div class="stack gap-9">
          <span v-for="row in opponentRows" :key="row" class="sk sk-person"></span>
        </div>
        <div v-if="variant === 'friendly-opponent-later'" class="three-grid fields">
          <span class="sk sk-field"></span><span class="sk sk-field"></span
          ><span class="sk sk-field"></span>
        </div>
        <span class="sk sk-button push"></span>
      </div>
    </template>

    <template v-else-if="variant === 'friendly-join'">
      <div class="flow-head">
        <span class="sk sk-square"></span><span class="sk sk-line w-22"></span
        ><span class="sk sk-line w-8 push"></span>
      </div>
      <div class="flow-body narrow-flow">
        <div class="intro-block">
          <span class="sk sk-line w-14 thin"></span><span class="sk sk-line w-42 title"></span
          ><span class="sk sk-line w-62"></span>
        </div>
        <span class="sk sk-notice"></span><span class="sk sk-qr sk-qr--single center"></span
        ><span class="sk sk-button center"></span>
      </div>
    </template>

    <template v-else-if="variant === 'friendly-schedule'">
      <div class="flow-head">
        <span class="sk sk-square"></span><span class="sk sk-line w-22"></span
        ><span class="sk sk-line w-8 push"></span>
      </div>
      <div class="flow-body">
        <div class="intro-block">
          <span class="sk sk-line w-14 thin"></span><span class="sk sk-line w-42 title"></span
          ><span class="sk sk-line w-58"></span>
        </div>
        <div class="three-grid fields">
          <span class="sk sk-field"></span><span class="sk sk-field"></span
          ><span class="sk sk-field"></span>
        </div>
        <span class="sk sk-button push"></span>
      </div>
    </template>

    <template v-else-if="variant === 'friendly-review'">
      <div class="flow-head">
        <span class="sk sk-square"></span><span class="sk sk-line w-22"></span
        ><span class="sk sk-line w-8 push"></span>
      </div>
      <div class="flow-body">
        <div class="intro-block">
          <span class="sk sk-line w-14 thin"></span><span class="sk sk-line w-40 title"></span
          ><span class="sk sk-line w-62"></span>
        </div>
        <div class="stack gap-0 review-skeleton">
          <span
            v-for="row in friendlyTiming === 'later' ? [1, 2, 3, 4] : [1, 2, 3]"
            :key="row"
            class="sk sk-review-row"
          ></span>
        </div>
        <span class="sk sk-button push"></span>
      </div>
    </template>

    <template v-else-if="variant === 'friendly-match-format'">
      <div class="flow-head">
        <span class="sk sk-square"></span><span class="sk sk-line w-22"></span
        ><span class="sk sk-line w-8 push"></span>
      </div>
      <div class="flow-body">
        <div class="intro-block">
          <span class="sk sk-line w-14 thin"></span><span class="sk sk-line w-40 title"></span
          ><span class="sk sk-line w-58"></span>
        </div>
        <div class="stack gap-12">
          <span v-for="row in [1, 2, 3, 4]" :key="row" class="sk sk-choice"></span>
        </div>
        <span class="sk sk-button push"></span>
      </div>
    </template>

    <template v-else-if="variant === 'friendly-custom-format'">
      <div class="flow-head">
        <span class="sk sk-square"></span><span class="sk sk-line w-22"></span
        ><span class="sk sk-line w-8 push"></span>
      </div>
      <div class="flow-body">
        <div class="intro-block">
          <span class="sk sk-line w-14 thin"></span><span class="sk sk-line w-40 title"></span
          ><span class="sk sk-line w-58"></span>
        </div>
        <span class="sk sk-custom-summary"></span>
        <div class="three-grid custom-format-chip-skeletons">
          <span v-for="choice in [1, 2, 3]" :key="choice" class="sk sk-custom-chip"></span>
        </div>
        <span class="sk sk-custom-setting"></span>
        <span class="sk sk-custom-setting"></span>
        <span class="sk sk-custom-setting short"></span>
        <span class="sk sk-button push"></span>
      </div>
    </template>

    <template v-else-if="variant === 'friendly-scheduled' || variant === 'friendly-externalJoin'">
      <div class="flow-head">
        <span class="sk sk-square"></span><span class="sk sk-line w-22"></span>
      </div>
      <div class="flow-body narrow-flow">
        <div class="intro-block">
          <span class="sk sk-line w-14 thin"></span><span class="sk sk-line w-40 title"></span
          ><span class="sk sk-line w-58"></span>
        </div>
        <span class="sk sk-status-card"></span><span class="sk sk-button"></span>
      </div>
    </template>

    <template v-else-if="variant === 'friendly-format'">
      <div class="flow-head">
        <span class="sk sk-square"></span><span class="sk sk-line w-22"></span
        ><span class="sk sk-line w-8 push"></span>
      </div>
      <div class="flow-body">
        <div class="intro-block">
          <span class="sk sk-line w-14 thin"></span><span class="sk sk-line w-40 title"></span
          ><span class="sk sk-line w-62"></span>
        </div>
        <div class="two-grid">
          <span class="sk sk-format"></span><span class="sk sk-format"></span>
        </div>
      </div>
    </template>

    <template v-else-if="variant === 'friendly-live'">
      <div class="flow-head"><span class="sk sk-square"></span></div>
      <div class="live-title">
        <div class="stack gap-7">
          <span class="sk sk-line w-14 thin"></span><span class="sk sk-line w-36 title"></span>
        </div>
        <span class="sk sk-pill"></span>
      </div>
      <span class="sk sk-status"></span>
      <div class="two-grid">
        <span class="sk sk-player"></span><span class="sk sk-player"></span>
      </div>
      <span class="sk sk-line w-18 center thin"></span>
    </template>

    <template v-else-if="variant === 'dashboard-fresh'">
      <div class="member-head">
        <div class="stack gap-7">
          <span class="sk sk-line w-14 thin"></span><span class="sk sk-line w-28 title"></span>
        </div>
        <span class="sk sk-pill wide"></span>
      </div>
      <div class="fresh-empty">
        <span class="sk sk-line w-18 center"></span><span class="sk sk-line w-36 center thin"></span
        ><span class="sk sk-button center"></span>
      </div>
      <span class="sk sk-line w-12 thin"></span>
      <div class="two-grid dashboard-grid">
        <span class="sk sk-card mid"></span><span class="sk sk-card mid"></span>
      </div>
      <span class="sk sk-card activity"></span>
    </template>

    <template v-else-if="variant === 'dashboard'">
      <span class="sk sk-hero"></span>
      <div class="three-grid">
        <span v-for="row in [1, 2, 3]" :key="row" class="sk sk-stat"></span>
      </div>
      <span class="sk sk-line w-12 thin"></span>
      <div class="three-grid dashboard-grid">
        <span v-for="row in [1, 2, 3]" :key="row" class="sk sk-card mid"></span>
      </div>
      <span class="sk sk-card activity"></span>
    </template>

    <template v-else-if="variant === 'rankings'">
      <div class="toolbar">
        <span class="sk sk-search"></span><span class="sk sk-filter"></span
        ><span class="sk sk-filter"></span>
      </div>
      <div class="ladder-shell">
        <div class="table-head">
          <span class="sk sk-line w-8 thin"></span><span class="sk sk-line w-20 thin"></span
          ><span class="sk sk-line w-12 thin push"></span>
        </div>
        <span v-for="row in rows" :key="row" class="sk sk-ladder-row"></span>
      </div>
    </template>

    <template v-else-if="variant === 'tournaments'">
      <div class="toolbar">
        <span class="sk sk-search"></span><span class="sk sk-filter"></span
        ><span class="sk sk-button"></span>
      </div>
      <div class="tabs">
        <span v-for="tab in [1, 2, 3, 4]" :key="tab" class="sk sk-line tab"></span>
      </div>
      <div class="three-grid tournament-grid">
        <span v-for="card in [1, 2, 3, 4, 5, 6]" :key="card" class="sk sk-tournament-card"></span>
      </div>
    </template>

    <template v-else-if="variant === 'tournament-create'">
      <div class="create-layout">
        <aside class="create-rail">
          <span class="sk sk-line w-50 thin"></span
          ><span v-for="row in [1, 2, 3, 4]" :key="row" class="sk sk-step"></span>
        </aside>
        <section class="form-shell">
          <span class="sk sk-line w-34 title"></span><span class="sk sk-line w-58"></span>
          <div class="two-grid fields">
            <span class="sk sk-field"></span><span class="sk sk-field"></span
            ><span class="sk sk-field"></span><span class="sk sk-field"></span>
          </div>
          <span class="sk sk-textarea"></span><span class="sk sk-button push"></span>
        </section>
      </div>
    </template>

    <template v-else-if="variant === 'tournament-overview'">
      <span class="sk sk-tournament-hero"></span>
      <div class="three-grid">
        <span v-for="card in [1, 2, 3]" :key="card" class="sk sk-stat"></span>
      </div>
      <div class="two-grid">
        <span class="sk sk-card tall"></span><span class="sk sk-card tall"></span>
      </div>
    </template>

    <template v-else-if="variant === 'tournament-category'">
      <div class="tabs">
        <span v-for="tab in [1, 2, 3, 4]" :key="tab" class="sk sk-line tab"></span>
      </div>
      <div class="category-layout">
        <div class="stack gap-9">
          <span class="sk sk-card tall"></span><span class="sk sk-card mid"></span>
        </div>
        <div class="stack gap-9">
          <span v-for="row in [1, 2, 3, 4]" :key="row" class="sk sk-match-row"></span>
        </div>
      </div>
    </template>

    <template v-else-if="variant === 'tournament-schedule'">
      <div class="toolbar">
        <span class="sk sk-search"></span><span class="sk sk-filter"></span
        ><span class="sk sk-filter"></span>
      </div>
      <div v-for="day in [1, 2]" :key="day" class="schedule-day">
        <span class="sk sk-line w-18"></span
        ><span v-for="row in [1, 2, 3]" :key="row" class="sk sk-match-row"></span>
      </div>
    </template>

    <template v-else-if="variant === 'tournament-gallery'">
      <div class="toolbar">
        <span class="sk sk-line w-28"></span><span class="sk sk-button push"></span>
      </div>
      <div class="three-grid gallery-grid">
        <span
          v-for="photo in [1, 2, 3, 4, 5, 6]"
          :key="photo"
          class="sk sk-photo"
          :class="{ tall: photo === 2 || photo === 4 }"
        ></span>
      </div>
    </template>

    <template v-else-if="variant === 'challenges'">
      <div class="three-grid">
        <span v-for="card in [1, 2, 3]" :key="card" class="sk sk-stat"></span>
      </div>
      <div class="tabs">
        <span v-for="tab in [1, 2, 3, 4]" :key="tab" class="sk sk-line tab"></span>
      </div>
      <div class="stack gap-9">
        <span v-for="row in [1, 2, 3, 4]" :key="row" class="sk sk-challenge-row"></span>
      </div>
    </template>

    <template v-else-if="variant === 'challenge-create'">
      <div class="create-challenge-layout">
        <section class="form-shell">
          <span class="sk sk-line w-42 title"></span><span class="sk sk-notice"></span
          ><span class="sk sk-field"></span><span class="sk sk-field"></span
          ><span class="sk sk-button push"></span>
        </section>
        <aside class="stack gap-9">
          <span class="sk sk-card mid"></span><span class="sk sk-card mid"></span>
        </aside>
      </div>
    </template>

    <template v-else-if="variant === 'match-details'">
      <span class="sk sk-score-summary"></span>
      <div class="two-grid">
        <span class="sk sk-card tall"></span><span class="sk sk-card tall"></span>
      </div>
      <span class="sk sk-card mid"></span>
    </template>

    <template v-else-if="variant === 'notifications'">
      <div class="tabs">
        <span v-for="tab in [1, 2, 3, 4]" :key="tab" class="sk sk-line tab"></span>
      </div>
      <div class="stack gap-0 notification-list">
        <span v-for="row in rows" :key="row" class="sk sk-notification-row"></span>
      </div>
    </template>

    <template v-else-if="variant === 'profile'">
      <span class="sk sk-profile-hero"></span>
      <div class="four-grid">
        <span v-for="card in [1, 2, 3, 4]" :key="card" class="sk sk-stat"></span>
      </div>
      <div class="two-grid">
        <span class="sk sk-card tall"></span><span class="sk sk-card tall"></span>
      </div>
    </template>

    <template v-else-if="variant === 'live-scoreboard'">
      <div class="live-title">
        <span class="sk sk-line w-34 title"></span><span class="sk sk-pill"></span>
      </div>
      <span class="sk sk-status"></span>
      <div class="two-grid">
        <span class="sk sk-player large"></span><span class="sk sk-player large"></span>
      </div>
      <div class="toolbar center-actions">
        <span class="sk sk-button"></span><span class="sk sk-button"></span>
      </div>
    </template>

    <template v-else>
      <div class="toolbar">
        <span class="sk sk-search"></span><span class="sk sk-filter"></span>
      </div>
      <div class="stack gap-9">
        <span v-for="row in rows" :key="row" class="sk sk-list-row"></span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.route-skeleton {
  --sk-base: rgba(218, 228, 239, 0.96);
  --sk-highlight: rgba(255, 255, 255, 0.48);
  display: grid;
  width: min(100%, 1140px);
  margin: 0 auto;
  gap: 22px;
}

.route-skeleton--onboarding-admin,
.route-skeleton--onboarding-join,
.route-skeleton--friendly-type,
.route-skeleton--friendly-timing,
.route-skeleton--friendly-opponent,
.route-skeleton--friendly-opponent-later,
.route-skeleton--friendly-clubOpponent,
.route-skeleton--friendly-schedule,
.route-skeleton--friendly-join,
.route-skeleton--friendly-review,
.route-skeleton--friendly-match-format,
.route-skeleton--friendly-custom-format,
.route-skeleton--friendly-scheduled,
.route-skeleton--friendly-externalJoin,
.route-skeleton--friendly-format,
.route-skeleton--friendly-live {
  width: min(1140px, 100%);
  min-height: 100svh;
  padding: clamp(18px, 3vw, 34px) clamp(20px, 3.5vw, 40px) 44px;
}
.onboarding-progress {
  display: grid;
  gap: 12px;
}
.progress-line {
  width: 100%;
  height: 4px;
}
.onboarding-body {
  width: min(100%, 860px);
  margin-inline: auto;
}
.onboarding-field {
  width: 100%;
  height: 58px;
}
.onboarding-actions {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  margin-top: 32px;
  padding-top: 20px;
  border-top: var(--app-hairline);
}
.sk-custom-summary {
  width: 100%;
  height: 67px;
}
.custom-format-chip-skeletons {
  width: 100%;
}
.sk-custom-chip {
  height: 76px;
}
.sk-custom-setting {
  width: 100%;
  height: 68px;
}
.sk-custom-setting.short {
  height: 64px;
}

.sk {
  position: relative;
  display: block;
  overflow: hidden;
  border-radius: var(--app-card-radius);
  background: var(--sk-base);
}
.sk::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, var(--sk-highlight), transparent);
  transform: translateX(-100%);
  animation: routeSkeletonShimmer 1.15s ease-in-out infinite;
}

.stack {
  display: grid;
}
.gap-0 {
  gap: 0;
}
.gap-7 {
  gap: 7px;
}
.gap-9 {
  gap: 9px;
}
.gap-12 {
  gap: 12px;
}
.push {
  margin-left: auto;
}
.center {
  margin-inline: auto;
}
.w-8 {
  width: 8%;
}
.w-10 {
  width: 10%;
}
.w-12 {
  width: 12%;
}
.w-14 {
  width: 14%;
}
.w-18 {
  width: 18%;
}
.w-20 {
  width: 20%;
}
.w-22 {
  width: 22%;
}
.w-24 {
  width: 24%;
}
.w-28 {
  width: 28%;
}
.w-34 {
  width: 34%;
}
.w-36 {
  width: 36%;
}
.w-38 {
  width: 38%;
}
.w-40 {
  width: 40%;
}
.w-42 {
  width: 42%;
}
.w-48 {
  width: 48%;
}
.w-50 {
  width: 50%;
}
.w-52 {
  width: 52%;
}
.w-58 {
  width: 58%;
}
.w-62 {
  width: 62%;
}
.sk-line {
  height: 16px;
  border-radius: 999px;
}
.sk-line.thin {
  height: 10px;
}
.sk-line.title {
  height: 30px;
}
.sk-square {
  width: 44px;
  height: 44px;
}
.sk-pill {
  width: 48px;
  height: 26px;
  border-radius: 999px;
}
.sk-pill.wide {
  width: 112px;
}
.sk-button {
  width: 220px;
  height: 48px;
}
.sk-filter {
  width: 132px;
  height: 50px;
}
.sk-search {
  width: min(100%, 560px);
  height: 50px;
}
.sk-field {
  height: 54px;
}
.sk-textarea {
  height: 130px;
}
.sk-notice {
  height: 46px;
}
.sk-status {
  height: 60px;
}
.sk-choice {
  height: 86px;
}
.sk-person {
  height: 72px;
}
.sk-format {
  height: 160px;
}
.sk-player {
  height: 250px;
}
.sk-qr {
  width: 100%;
  min-height: 360px;
}
.sk-qr--single {
  width: min(100%, 480px);
}
.sk-join-status {
  min-height: 360px;
}
.sk-review-row {
  height: 66px;
  border-radius: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.5);
}
.sk-status-card {
  width: min(100%, 680px);
  height: 116px;
}
.sk-player.large {
  height: 330px;
}
.sk-card.mid {
  height: 210px;
}
.sk-card.tall {
  height: 290px;
}
.sk-card.activity {
  height: 210px;
}
.sk-stat {
  height: 108px;
}
.sk-hero {
  height: 290px;
}
.sk-tournament-hero {
  height: 190px;
}
.sk-profile-hero {
  height: 190px;
}
.sk-score-summary {
  height: 230px;
}
.sk-tournament-card {
  height: 230px;
}
.sk-photo {
  height: 210px;
}
.sk-photo.tall {
  height: 280px;
}
.sk-step {
  height: 42px;
}
.sk-ladder-row {
  height: 64px;
  border-radius: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.5);
}
.sk-match-row {
  height: 76px;
}
.sk-challenge-row {
  height: 108px;
}
.sk-notification-row {
  height: 82px;
  border-radius: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.5);
}
.sk-list-row {
  height: 82px;
}

.flow-head {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 62px;
  padding-bottom: 18px;
  border-bottom: var(--app-hairline);
}
.flow-body {
  display: grid;
  gap: 22px;
  padding-top: clamp(30px, 7vw, 58px);
}
.intro-block {
  display: grid;
  width: min(100%, 720px);
  gap: 8px;
}
.live-title,
.member-head,
.toolbar,
.table-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.member-head,
.live-title {
  justify-content: space-between;
  min-height: 76px;
  padding-bottom: 18px;
  border-bottom: var(--app-hairline);
}
.fresh-empty {
  display: grid;
  min-height: 340px;
  align-content: center;
  gap: 10px;
}
.two-grid,
.three-grid,
.four-grid,
.join-grid {
  display: grid;
  gap: 16px;
}
.two-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.join-grid {
  grid-template-columns: minmax(260px, 0.8fr) minmax(0, 1.2fr);
}
.review-skeleton {
  overflow: hidden;
  border: var(--app-hairline);
  border-radius: var(--app-card-radius);
}
.narrow-flow {
  max-width: 780px;
}
.three-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.four-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.toolbar {
  min-height: 54px;
}
.tabs {
  display: flex;
  gap: 24px;
  min-height: 50px;
  align-items: end;
  border-bottom: var(--app-hairline);
}
.sk-line.tab {
  width: 92px;
  height: 13px;
  margin-bottom: 14px;
}
.ladder-shell,
.notification-list,
.form-shell,
.create-rail {
  padding: 18px;
  border: var(--app-hairline);
  border-radius: var(--app-card-radius);
  background: rgba(255, 255, 255, 0.42);
}
.table-head {
  min-height: 44px;
}
.create-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 22px;
}
.create-rail {
  display: grid;
  align-content: start;
  gap: 12px;
  min-height: 520px;
}
.form-shell {
  display: grid;
  align-content: start;
  gap: 20px;
  min-height: 520px;
  padding: 28px;
}
.fields {
  margin-top: 10px;
}
.category-layout,
.create-challenge-layout {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 18px;
}
.schedule-day {
  display: grid;
  gap: 9px;
}
.gallery-grid {
  align-items: start;
}
.center-actions {
  justify-content: center;
}

@keyframes routeSkeletonShimmer {
  to {
    transform: translateX(100%);
  }
}

@media (max-width: 767px) {
  .route-skeleton {
    gap: 16px;
  }
  .route-skeleton--onboarding-admin,
  .route-skeleton--onboarding-join,
  .route-skeleton--friendly-type,
  .route-skeleton--friendly-timing,
  .route-skeleton--friendly-opponent,
  .route-skeleton--friendly-opponent-later,
  .route-skeleton--friendly-clubOpponent,
  .route-skeleton--friendly-schedule,
  .route-skeleton--friendly-join,
  .route-skeleton--friendly-review,
  .route-skeleton--friendly-match-format,
  .route-skeleton--friendly-custom-format,
  .route-skeleton--friendly-scheduled,
  .route-skeleton--friendly-externalJoin,
  .route-skeleton--friendly-format,
  .route-skeleton--friendly-live {
    padding: 12px 16px 34px;
  }
  .two-grid,
  .three-grid,
  .join-grid,
  .category-layout,
  .create-challenge-layout {
    grid-template-columns: 1fr;
  }
  .four-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .custom-format-chip-skeletons {
    grid-template-columns: 1fr;
  }
  .sk-custom-chip {
    height: 62px;
  }
  .tournament-grid,
  .gallery-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .create-layout {
    grid-template-columns: 1fr;
  }
  .create-rail {
    min-height: 120px;
    grid-template-columns: repeat(4, 1fr);
  }
  .create-rail .sk-line {
    grid-column: 1 / -1;
  }
  .sk-format {
    height: 120px;
  }
  .sk-player {
    height: 180px;
  }
  .sk-player.large {
    height: 220px;
  }
  .sk-button {
    width: 100%;
  }
  .toolbar {
    flex-wrap: wrap;
  }
  .sk-search {
    flex-basis: 100%;
  }
  .tabs {
    overflow: hidden;
    gap: 16px;
  }
  .sk-line.tab {
    min-width: 72px;
  }
}

@media (max-width: 480px) {
  .tournament-grid,
  .gallery-grid {
    grid-template-columns: 1fr;
  }
  .w-48,
  .w-52,
  .w-58,
  .w-62 {
    width: 82%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sk::after {
    animation: none;
  }
}
</style>
