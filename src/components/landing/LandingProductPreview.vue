<script setup>
import { computed } from 'vue'
import AppLogo from '../AppLogo.vue'
import { APP_CURRENT_PLAYER } from '../../config/currentPlayer'
import { dashboardFixture } from '../../data/dashboard'

const props = defineProps({
  section: {
    type: String,
    default: 'home',
  },
})

const navigation = Object.freeze([
  { key: 'home', label: 'Home', icon: '⌂' },
  { key: 'play', label: 'Play', icon: '▷' },
  { key: 'compete', label: 'Compete', icon: '◇' },
  { key: 'club', label: 'Club', icon: '▦' },
])

const pageMeta = {
  home: {
    title: 'Home',
    subtitle: 'Your tennis, next actions, and club activity.',
  },
  play: {
    title: 'Play',
    subtitle: 'Start or continue a match.',
  },
  compete: {
    title: 'Ladder',
    subtitle: 'Your rank and nearby players.',
  },
  club: {
    title: 'Club',
    subtitle: 'Your club, members, courts, and rules.',
  },
}

const activeMeta = computed(() => pageMeta[props.section] || pageMeta.home)
const ladder = dashboardFixture.ladders[0]
const playerInitials = APP_CURRENT_PLAYER.name
  .split(' ')
  .map((part) => part[0])
  .join('')
  .slice(0, 2)
  .toUpperCase()
</script>

<template>
  <div class="product-preview">
    <aside class="product-preview__sidebar">
      <AppLogo class="product-preview__logo" />
      <div class="product-preview__club">
        <small>Active club</small>
        <strong>{{ dashboardFixture.activeClub.name }}</strong>
        <span aria-hidden="true">⌄</span>
      </div>
      <nav aria-label="Preview navigation">
        <div
          v-for="item in navigation"
          :key="item.key"
          class="product-preview__nav-item"
          :class="{ active: section === item.key }"
        >
          <span aria-hidden="true">{{ item.icon }}</span>
          <strong>{{ item.label }}</strong>
        </div>
        <div v-if="section === 'compete'" class="product-preview__subnav">
          <span class="active">Ladder</span><span>Challenges</span><span>Tournaments</span>
        </div>
      </nav>
    </aside>

    <div class="product-preview__main">
      <header class="product-preview__header">
        <div>
          <strong>{{ activeMeta.title }}</strong>
          <small>{{ activeMeta.subtitle }}</small>
        </div>
        <div class="product-preview__account">
          <span class="product-preview__bell" aria-hidden="true">○</span>
          <span class="product-preview__avatar">
            <img :src="APP_CURRENT_PLAYER.imageUrl" alt="" />
            <b>{{ playerInitials }}</b>
          </span>
          <span class="product-preview__identity">
            <strong>{{ APP_CURRENT_PLAYER.name }}</strong>
            <small>Player</small>
          </span>
        </div>
      </header>

      <div class="product-preview__content">
        <template v-if="section === 'home'">
          <section class="product-preview__intro">
            <small>YOUR LADDER</small>
            <h3>Welcome back, {{ APP_CURRENT_PLAYER.firstName }}.</h3>
          </section>
          <article class="product-preview__ladder-card">
            <div>
              <small>{{ dashboardFixture.activeClub.name }}</small>
              <strong>You are on the {{ ladder.name }} ladder.</strong>
            </div>
            <p>
              <span>Your position</span><b>#{{ ladder.position }}</b
              ><em>of {{ ladder.playerCount }}</em>
            </p>
          </article>
          <section class="product-preview__quick-grid">
            <article v-for="action in dashboardFixture.quickActions" :key="action.id">
              <span aria-hidden="true">↗</span>
              <strong>{{ action.title }}</strong>
              <small>{{ action.description }}</small>
            </article>
          </section>
          <article class="product-preview__attention">
            <span aria-hidden="true">✓</span>
            <div>
              <small>NEEDS YOUR ATTENTION</small>
              <strong>{{ dashboardFixture.attentionItems[0].title }}</strong>
              <p>{{ dashboardFixture.attentionItems[0].description }}</p>
            </div>
            <b>{{ dashboardFixture.attentionItems[0].actionLabel }}</b>
          </article>
        </template>

        <template v-else-if="section === 'play'">
          <section class="product-preview__intro">
            <small>READY WHEN YOU ARE</small>
            <h3>Get on court.</h3>
            <p>Choose the match you want to play.</p>
          </section>
          <section class="product-preview__play-options">
            <article class="active">
              <span aria-hidden="true">＋</span>
              <div>
                <strong>Start friendly match</strong
                ><small>Play without changing the ladder.</small>
              </div>
              <b>›</b>
            </article>
            <article>
              <span aria-hidden="true">↗</span>
              <div>
                <strong>Start ladder match</strong
                ><small>Use club rules and eligible opponents.</small>
              </div>
              <b>›</b>
            </article>
          </section>
          <section class="product-preview__waiting">
            <small>YOUR MATCHES</small>
            <h4>Ready to continue</h4>
            <article>
              <div>
                <strong>{{ APP_CURRENT_PLAYER.firstName }} vs Sam</strong
                ><small>Result review</small>
              </div>
              <b>Continue</b>
            </article>
          </section>
        </template>

        <template v-else-if="section === 'compete'">
          <section class="product-preview__rank-summary">
            <div><small>RANK</small><strong>#2</strong></div>
            <div>
              <small>YOU</small><strong>{{ APP_CURRENT_PLAYER.name }}</strong>
            </div>
            <div><small>POINTS</small><strong>760</strong></div>
          </section>
          <section class="product-preview__ladder-list">
            <article>
              <b>#1</b><span class="product-preview__person">CO</span>
              <div><strong>Chidi Okafor</strong><small>Challengeable</small></div>
              <em>820 pts</em><button type="button">Challenge</button>
            </article>
            <article class="you">
              <b>#2</b><span class="product-preview__person">{{ playerInitials }}</span>
              <div>
                <strong>{{ APP_CURRENT_PLAYER.name }}</strong
                ><small>You</small>
              </div>
              <em>760 pts</em>
            </article>
            <article>
              <b>#3</b><span class="product-preview__person">AO</span>
              <div><strong>Amara Okoye</strong><small>Nearby player</small></div>
              <em>715 pts</em>
            </article>
          </section>
        </template>

        <template v-else>
          <nav class="product-preview__club-tabs">
            <span class="active">Overview</span><span>Members</span><span>Rules</span
            ><span>Manage</span>
          </nav>
          <section class="product-preview__club-hero">
            <span>GT</span>
            <div>
              <small>YOUR ACTIVE CLUB</small>
              <h3>{{ dashboardFixture.activeClub.name }}</h3>
              <p>Lagos, Nigeria</p>
            </div>
            <button type="button">Manage club</button>
          </section>
          <section class="product-preview__stats">
            <article>
              <small>MEMBERS</small><strong>{{ dashboardFixture.clubSummary.members }}</strong>
            </article>
            <article><small>COURTS</small><strong>3</strong></article>
            <article>
              <small>ACTIVE LADDERS</small
              ><strong>{{ dashboardFixture.clubSummary.activeLadders }}</strong>
            </article>
          </section>
          <section class="product-preview__club-grid">
            <article>
              <small>COURTS</small><strong>Where the club plays</strong>
              <p>● Court 1</p>
              <p>● Court 2</p>
              <p>● Court 3</p>
            </article>
            <article>
              <small>CLUB ACTIVITY</small><strong>Live right now</strong>
              <p>{{ dashboardFixture.clubSummary.liveMatches }} matches across 3 courts</p>
            </article>
          </section>
        </template>
      </div>

      <nav class="product-preview__mobile-nav" aria-label="Preview mobile navigation">
        <span
          v-for="item in navigation"
          :key="item.key"
          :class="{ active: section === item.key }"
          >{{ item.label }}</span
        >
      </nav>
    </div>
  </div>
</template>

<style scoped>
.product-preview {
  container-type: inline-size;
  display: grid;
  width: 100%;
  min-height: 465px;
  grid-template-columns: 142px minmax(0, 1fr);
  overflow: hidden;
  background: #f7f8fa;
  color: #162218;
  font-family: Poppins, 'Segoe UI', sans-serif;
}

.product-preview * {
  box-sizing: border-box;
}

.product-preview__sidebar {
  padding: 20px 14px;
  border-right: 1px solid #e7ece8;
  background: #fff;
}

.product-preview__logo {
  width: 72px;
  margin: 0 7px 23px;
}

.product-preview__club {
  position: relative;
  display: grid;
  gap: 2px;
  margin-bottom: 19px;
  padding: 10px 24px 10px 10px;
  border: 1px solid #e7ece8;
  border-radius: 7px;
}

.product-preview__club small,
.product-preview__header small,
.product-preview__identity small,
.product-preview__content small {
  color: #778079;
  font-size: 7px;
  line-height: 1.35;
}

.product-preview__club strong {
  overflow: hidden;
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-preview__club > span {
  position: absolute;
  top: 13px;
  right: 9px;
  color: #66736a;
}

.product-preview__sidebar nav {
  display: grid;
  gap: 4px;
}

.product-preview__nav-item {
  display: flex;
  min-height: 34px;
  align-items: center;
  gap: 9px;
  padding: 0 10px;
  border-radius: 6px;
  color: #67726a;
  font-size: 8px;
}

.product-preview__nav-item > span {
  display: grid;
  width: 17px;
  height: 17px;
  place-items: center;
  color: #465149;
  font-size: 13px;
}

.product-preview__nav-item.active {
  background: #edf8ef;
  color: #008f15;
}

.product-preview__subnav {
  display: grid;
  gap: 3px;
  margin: 0 0 4px 25px;
  padding-left: 10px;
  border-left: 1px solid #dfe8e1;
}

.product-preview__subnav span {
  padding: 4px 0;
  color: #7b857e;
  font-size: 7px;
}

.product-preview__subnav span.active {
  color: #008f15;
  font-weight: 700;
}

.product-preview__main {
  display: grid;
  min-width: 0;
  grid-template-rows: auto 1fr;
}

.product-preview__header {
  display: flex;
  min-height: 66px;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 0 22px;
  border-bottom: 1px solid #e7ece8;
  background: #fff;
}

.product-preview__header > div:first-child {
  display: grid;
  gap: 3px;
}

.product-preview__header > div:first-child > strong {
  font-size: 13px;
}

.product-preview__account {
  display: flex;
  align-items: center;
  gap: 7px;
}

.product-preview__bell {
  color: #59665d;
  font-size: 16px;
}

.product-preview__avatar,
.product-preview__person {
  display: grid;
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: #e8f3eb;
  color: #176127;
  font-size: 7px;
  font-weight: 700;
}

.product-preview__avatar {
  position: relative;
}

.product-preview__avatar img {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-preview__avatar b {
  position: absolute;
}

.product-preview__identity {
  display: grid;
  gap: 1px;
}

.product-preview__identity strong {
  font-size: 8px;
}

.product-preview__content {
  display: grid;
  align-content: start;
  gap: 13px;
  min-width: 0;
  padding: 20px 22px 25px;
  overflow: hidden;
}

.product-preview__intro {
  display: grid;
  gap: 3px;
}

.product-preview__intro h3,
.product-preview__intro p,
.product-preview__club-hero h3,
.product-preview__club-hero p {
  margin: 0;
}

.product-preview__intro > small,
.product-preview__content article > small,
.product-preview__club-hero small {
  color: #008f15;
  font-weight: 700;
  letter-spacing: 0.09em;
}

.product-preview__intro h3 {
  font-size: 15px;
}

.product-preview__intro p {
  color: #6d7a70;
  font-size: 8px;
}

.product-preview__ladder-card {
  display: flex;
  min-height: 96px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 17px 20px;
  border-radius: 9px;
  background: linear-gradient(135deg, #063c2b, #052e20);
  color: #fff;
}

.product-preview__ladder-card > div {
  display: grid;
  gap: 5px;
}

.product-preview__ladder-card > div small {
  color: #b9d5c3;
}

.product-preview__ladder-card > div strong {
  font-size: 11px;
}

.product-preview__ladder-card p {
  display: grid;
  grid-template-columns: auto auto;
  align-items: end;
  gap: 0 6px;
  margin: 0;
}

.product-preview__ladder-card p span {
  grid-column: 1 / -1;
  color: #b9d5c3;
  font-size: 7px;
}

.product-preview__ladder-card p b {
  color: #d9f77b;
  font-size: 27px;
}

.product-preview__ladder-card p em {
  padding-bottom: 5px;
  color: #b9d5c3;
  font-size: 7px;
  font-style: normal;
}

.product-preview__quick-grid,
.product-preview__stats,
.product-preview__club-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.product-preview__quick-grid article,
.product-preview__stats article,
.product-preview__club-grid article {
  display: grid;
  gap: 5px;
  padding: 12px;
  border: 1px solid #e3e9e4;
  border-radius: 8px;
  background: #fff;
}

.product-preview__quick-grid article > span {
  color: #00a719;
  font-size: 12px;
}

.product-preview__quick-grid strong,
.product-preview__club-grid strong {
  font-size: 8px;
}

.product-preview__attention {
  display: grid;
  grid-template-columns: 24px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 11px 13px;
  border: 1px solid #e3e9e4;
  border-radius: 8px;
  background: #fff;
}

.product-preview__attention > span {
  display: grid;
  width: 23px;
  height: 23px;
  place-items: center;
  border-radius: 50%;
  background: #edf8ef;
  color: #008f15;
  font-size: 8px;
}

.product-preview__attention > div {
  display: grid;
  gap: 2px;
}

.product-preview__attention strong {
  font-size: 8px;
}

.product-preview__attention p {
  margin: 0;
  color: #6d7a70;
  font-size: 7px;
}

.product-preview__attention > b,
.product-preview__waiting article > b {
  color: #008f15;
  font-size: 7px;
}

.product-preview__play-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.product-preview__play-options article {
  display: grid;
  min-height: 92px;
  grid-template-columns: 30px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 14px;
  border: 1px solid #e3e9e4;
  border-radius: 8px;
  background: #fff;
}

.product-preview__play-options article.active {
  border-color: rgba(0, 181, 26, 0.4);
}

.product-preview__play-options article > span {
  display: grid;
  width: 29px;
  height: 29px;
  place-items: center;
  border-radius: 50%;
  background: #edf8ef;
  color: #008f15;
}

.product-preview__play-options article > div,
.product-preview__waiting,
.product-preview__waiting article > div {
  display: grid;
  gap: 3px;
}

.product-preview__play-options strong,
.product-preview__waiting strong {
  font-size: 8px;
}

.product-preview__waiting {
  margin-top: 8px;
}

.product-preview__waiting h4 {
  margin: 0 0 4px;
  font-size: 11px;
}

.product-preview__waiting article {
  display: flex;
  min-height: 60px;
  align-items: center;
  justify-content: space-between;
  padding: 11px 14px;
  border: 1px solid #e3e9e4;
  border-radius: 8px;
  background: #fff;
}

.product-preview__rank-summary {
  display: grid;
  grid-template-columns: 0.65fr 1.5fr 0.8fr;
  overflow: hidden;
  border: 1px solid #dfe8e1;
  border-radius: 9px;
  background: #fff;
}

.product-preview__rank-summary > div {
  display: grid;
  gap: 3px;
  padding: 15px;
  border-right: 1px solid #e7ece8;
}

.product-preview__rank-summary > div:last-child {
  border-right: 0;
}

.product-preview__rank-summary strong {
  font-size: 15px;
}

.product-preview__ladder-list {
  overflow: hidden;
  border: 1px solid #dfe8e1;
  border-radius: 9px;
  background: #fff;
}

.product-preview__ladder-list article {
  display: grid;
  min-height: 62px;
  grid-template-columns: 25px 26px 1fr auto auto;
  align-items: center;
  gap: 9px;
  padding: 9px 13px;
  border-bottom: 1px solid #e7ece8;
}

.product-preview__ladder-list article:last-child {
  border-bottom: 0;
}

.product-preview__ladder-list article.you {
  background: #f0f8f1;
}

.product-preview__ladder-list article > b,
.product-preview__ladder-list article strong {
  font-size: 8px;
}

.product-preview__ladder-list article > div {
  display: grid;
  gap: 2px;
}

.product-preview__ladder-list em {
  color: #66736a;
  font-size: 7px;
  font-style: normal;
}

.product-preview__ladder-list button,
.product-preview__club-hero button {
  min-height: 27px;
  padding: 0 9px;
  border: 0;
  border-radius: 6px;
  background: #00b51a;
  color: #fff;
  font-size: 7px;
  font-weight: 700;
}

.product-preview__club-tabs {
  display: flex;
  gap: 18px;
  padding-bottom: 9px;
  border-bottom: 1px solid #dfe8e1;
  color: #778079;
  font-size: 7px;
}

.product-preview__club-tabs span.active {
  color: #008f15;
  font-weight: 700;
}

.product-preview__club-hero {
  display: grid;
  grid-template-columns: 42px 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid #dfe8e1;
  border-radius: 9px;
  background: #fff;
}

.product-preview__club-hero > span {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 10px;
  background: #052e20;
  color: #d9f77b;
  font-size: 10px;
  font-weight: 700;
}

.product-preview__club-hero h3 {
  font-size: 12px;
}

.product-preview__club-hero p {
  color: #6d7a70;
  font-size: 7px;
}

.product-preview__stats article {
  gap: 4px;
}

.product-preview__stats strong {
  color: #052e20;
  font-size: 17px;
}

.product-preview__club-grid {
  grid-template-columns: 1fr 1fr;
}

.product-preview__club-grid p {
  margin: 1px 0 0;
  color: #66736a;
  font-size: 7px;
}

.product-preview__mobile-nav {
  display: none;
}

@container (max-width: 560px) {
  .product-preview {
    min-height: 500px;
    grid-template-columns: 1fr;
  }

  .product-preview__sidebar,
  .product-preview__identity {
    display: none;
  }

  .product-preview__main {
    grid-template-rows: auto 1fr auto;
  }

  .product-preview__header {
    min-height: 58px;
    padding-inline: 16px;
  }

  .product-preview__content {
    padding: 16px;
  }

  .product-preview__quick-grid {
    grid-template-columns: 1fr;
  }

  .product-preview__quick-grid article:nth-child(n + 3) {
    display: none;
  }

  .product-preview__play-options {
    grid-template-columns: 1fr;
  }

  .product-preview__mobile-nav {
    display: grid;
    min-height: 45px;
    grid-template-columns: repeat(4, 1fr);
    place-items: center;
    border-top: 1px solid #e7ece8;
    background: #fff;
    color: #778079;
    font-size: 7px;
  }

  .product-preview__mobile-nav span.active {
    color: #008f15;
    font-weight: 700;
  }
}
</style>
