<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppLogo from '../components/AppLogo.vue'
import LandingProductPreview from '../components/landing/LandingProductPreview.vue'
import '../assets/landing-v2.css'
import scanToJoinImage from '../assets/landing/scan-to-join.jpg'
import playTheMatchImage from '../assets/landing/play-the-match.jpg'

const mobileMenuOpen = ref(false)
const activePreviewKey = ref('home')
const navDocked = ref(false)
const floatingCtaVisible = ref(false)
const workflowSection = ref(null)
const scoreboardSection = ref(null)
const scoreCallActive = ref(false)
const voiceSupported = ref(false)
const cookieSettingsOpen = ref(false)
const consentKey = 'gorra-cookie-consent'
const defaultCookiePreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
  timestamp: null,
}
const cookiePreferences = ref({ ...defaultCookiePreferences })
const showCookieBanner = ref(false)
let previewTimer
let scoreboardObserver
let scoreCallTimer

function closeMobileMenu() {
  mobileMenuOpen.value = false
}

function syncLandingHeaderState() {
  const workflowTop = workflowSection.value?.offsetTop ?? Number.POSITIVE_INFINITY
  navDocked.value = window.scrollY >= workflowTop - 84
  floatingCtaVisible.value = window.scrollY > 260
}

function persistCookieConsent(nextPreferences) {
  const payload = {
    ...defaultCookiePreferences,
    ...nextPreferences,
    timestamp: Date.now(),
  }

  cookiePreferences.value = payload
  localStorage.setItem(consentKey, JSON.stringify(payload))
  window.gorraCookieConsent = payload
  document.body.dataset.cookieConsent =
    payload.analytics || payload.marketing ? 'accepted' : 'rejected'
  showCookieBanner.value = false
  cookieSettingsOpen.value = false
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function acceptCookies() {
  persistCookieConsent({
    necessary: true,
    analytics: true,
    marketing: true,
  })
}

function rejectCookies() {
  persistCookieConsent({
    necessary: true,
    analytics: false,
    marketing: false,
  })
}

function toggleCookieSettings() {
  cookieSettingsOpen.value = !cookieSettingsOpen.value
}

function manageCookiePreferences() {
  showCookieBanner.value = true
  cookieSettingsOpen.value = true
}

function rotatePreview() {
  const currentIndex = previews.findIndex((preview) => preview.key === activePreviewKey.value)
  activePreviewKey.value = previews[(currentIndex + 1) % previews.length].key
}

function startPreviewRotation() {
  window.clearInterval(previewTimer)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  previewTimer = window.setInterval(rotatePreview, 4200)
}

function selectPreview(key) {
  activePreviewKey.value = key
  startPreviewRotation()
}

function speakScoreCall() {
  if (!voiceSupported.value) return
  window.speechSynthesis.cancel()
  const call = new SpeechSynthesisUtterance('Advantage, Chidi Obi. Court one.')
  call.rate = 0.92
  call.pitch = 0.96
  scoreCallActive.value = true
  call.onend = () => {
    scoreCallActive.value = false
  }
  call.onerror = () => {
    scoreCallActive.value = false
  }
  window.speechSynthesis.speak(call)
}

function readCookieConsent() {
  try {
    const stored = localStorage.getItem(consentKey)
    if (!stored) {
      showCookieBanner.value = true
      window.gorraCookieConsent = { ...defaultCookiePreferences }
      document.body.dataset.cookieConsent = 'unset'
      return
    }

    const parsed = JSON.parse(stored)
    cookiePreferences.value = { ...defaultCookiePreferences, ...parsed }
    window.gorraCookieConsent = cookiePreferences.value
    document.body.dataset.cookieConsent =
      cookiePreferences.value.analytics || cookiePreferences.value.marketing
        ? 'accepted'
        : 'rejected'
    showCookieBanner.value = false
  } catch {
    showCookieBanner.value = true
    window.gorraCookieConsent = { ...defaultCookiePreferences }
    document.body.dataset.cookieConsent = 'unset'
  }
}

function setMeta(name, content) {
  const selector = `meta[name=${name}]`
  const meta =
    document.querySelector(selector) || document.head.appendChild(document.createElement('meta'))
  meta.setAttribute('name', name)
  meta.setAttribute('content', content)
}

onMounted(() => {
  document.title = 'GORRA | Club tennis, tournaments and ladders made simple'
  setMeta(
    'description',
    'GORRA connects tennis ladders, challenges, match schedules, live scoring, tournaments and club updates in one clear flow.',
  )
  setMeta('theme-color', '#052e20')
  setMeta('apple-mobile-web-app-status-bar-style', 'black-translucent')
  readCookieConsent()
  syncLandingHeaderState()
  voiceSupported.value = 'speechSynthesis' in window
  startPreviewRotation()

  if ('IntersectionObserver' in window && scoreboardSection.value) {
    scoreboardObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || scoreCallActive.value) return
        scoreboardObserver.disconnect()
        scoreCallTimer = window.setTimeout(speakScoreCall, 700)
      },
      { threshold: 0.55 },
    )
    scoreboardObserver.observe(scoreboardSection.value)
  }

  window.addEventListener('scroll', syncLandingHeaderState, { passive: true })
  window.addEventListener('resize', syncLandingHeaderState)
})

onUnmounted(() => {
  window.clearInterval(previewTimer)
  window.clearTimeout(scoreCallTimer)
  scoreboardObserver?.disconnect()
  if (scoreCallActive.value) window.speechSynthesis?.cancel()
  window.removeEventListener('scroll', syncLandingHeaderState)
  window.removeEventListener('resize', syncLandingHeaderState)
})

const previews = [
  {
    key: 'home',
    label: 'Home',
    eyebrow: 'Member home',
    title: 'Your tennis and club activity in one place.',
    copy: 'Henry sees his Greenview ladder position, quick actions and anything waiting for his attention.',
    notes: ['Henry Dunia at rank #2', 'Greenview Tennis Club', 'Current quick-action flow'],
  },
  {
    key: 'play',
    label: 'Play',
    eyebrow: 'Matches and challenges',
    title: 'Move every match from invite to result.',
    copy: 'Players can accept, schedule and complete a match without losing the next action in a group chat.',
    notes: [
      'Start a friendly match',
      'Start a ladder match',
      'Continue matches already in progress',
    ],
  },
  {
    key: 'compete',
    label: 'Compete',
    eyebrow: 'Ladders and rankings',
    title: 'Make club competition easy to follow.',
    copy: 'Players see their rank, challenge range and movement clearly, while organizers keep the rules and results in one system.',
    notes: [
      'Henry highlighted at rank #2',
      'Nearby players use the current roster',
      'Ladder, Challenges and Tournaments stay together',
    ],
  },
  {
    key: 'club',
    label: 'Club',
    eyebrow: 'Club operations',
    title: 'Run tournaments without scattered admin.',
    copy: 'Keep categories, schedules, fixtures, standings and results connected from setup through the final.',
    notes: [
      'Current Overview, Members and Rules flow',
      'Club activity and court summary',
      'Management stays in the active club',
    ],
  },
]

const activePreview = computed(
  () => previews.find((preview) => preview.key === activePreviewKey.value) || previews[0],
)

const workflow = [
  {
    number: '01',
    label: 'Join the match',
    title: 'Scan and accept',
    copy: 'Scan the code, check the match details and get ready for court.',
    image: scanToJoinImage,
    alt: 'A tennis player scanning a match code',
    badge: 'Scan',
  },
  {
    number: '02',
    label: 'Just play',
    title: 'Stay in the game',
    copy: 'Keep score as you play, ask someone courtside to help, or enter the result when the match ends.',
    image: playTheMatchImage,
    alt: 'Two club players playing tennis',
    badge: 'Play',
    live: true,
  },
  {
    number: '03',
    label: 'GORRA remembers',
    title: 'Save and share',
    copy: 'The result is saved, the ladder updates and everyone can see where they stand.',
    image: playTheMatchImage,
    alt: '',
    badge: 'Done',
    result: true,
  },
]

const audiences = [
  {
    number: '01',
    title: 'For club organizers',
    copy: 'See what is open, what is waiting and what changed - without collecting updates from five different places.',
    points: ['Active-club controls', 'Member and court setup', 'Tournament workspace'],
  },
  {
    number: '02',
    title: 'For competitive players',
    copy: 'Open GORRA and know your rank, who you can challenge, what needs a response and when you play next.',
    points: ['Ladder position', 'Challenge lifecycle', 'Match history'],
  },
  {
    number: '03',
    title: 'For tournament teams',
    copy: 'Keep categories, fixtures, live results, standings and knockout progress visible as the event moves.',
    points: ['Flexible event setup', 'Schedules and standings', 'Live match context'],
  },
]
</script>

<template>
  <div class="gorra-landing">
    <a class="lp-skip" href="#landing-main">Skip to content</a>
    <div class="lp-nav-slot">
      <header class="lp-nav" :class="{ 'lp-nav--docked': navDocked }">
        <div class="lp-container lp-nav__inner">
          <RouterLink class="lp-brand" to="/" aria-label="GORRA home" @click="closeMobileMenu">
            <AppLogo class="lp-brand__logo" on-dark />
          </RouterLink>

          <div id="landing-navigation" class="lp-nav__links" :class="{ open: mobileMenuOpen }">
            <nav aria-label="Landing page navigation">
              <a href="#workflow" @click="closeMobileMenu">How it works</a>
              <a href="#product" @click="closeMobileMenu">Product</a>
              <a href="#clubs" @click="closeMobileMenu">For your club</a>
              <a href="#faq" @click="closeMobileMenu">Questions</a>
            </nav>
          </div>

          <div class="lp-nav__actions">
            <RouterLink class="lp-cta" to="/signup" @click="closeMobileMenu">
              Play Tennis Now
              <span class="lp-cta__arrow" aria-hidden="true">→</span>
            </RouterLink>
            <button
              class="lp-menu-button"
              type="button"
              :aria-expanded="mobileMenuOpen"
              aria-controls="landing-navigation"
              aria-label="Toggle navigation"
              @click="mobileMenuOpen = !mobileMenuOpen"
            >
              <span></span><span></span>
            </button>
          </div>
        </div>
      </header>
    </div>

    <main id="landing-main">
      <section class="lp-hero">
        <div class="lp-container lp-hero__grid">
          <div class="lp-hero__copy">
            <p class="lp-kicker"><span></span> One home for your tennis club</p>
            <h1>Club tennis, tournaments<br /><em>and ladders made simple.</em></h1>
            <p class="lp-hero__lead">
              Run ladders, challenges, match schedules, live scores and tournaments in one place.
              Players know what comes next; organizers spend less time chasing updates.
            </p>
            <div class="lp-hero__actions">
              <RouterLink class="lp-button lp-button--lime" to="/signup">
                Create your account <span aria-hidden="true">&rarr;</span>
              </RouterLink>
              <a class="lp-quiet-link" href="#product">See the real product</a>
            </div>
          </div>

          <div class="lp-hero__product">
            <div class="lp-window lp-window--hero">
              <div class="lp-window__bar">
                <span></span><span></span><span></span><small>GORRA / Club home</small>
              </div>
              <LandingProductPreview section="home" />
            </div>
            <div class="lp-product-callout lp-product-callout--top">
              <small>PLAYER HOME</small><strong>The next match is clear</strong>
            </div>
            <div class="lp-product-callout lp-product-callout--bottom">
              <span aria-hidden="true">&#10003;</span>
              <div><small>ONE CLUB RECORD</small><strong>Everyone sees the same thing</strong></div>
            </div>
          </div>
        </div>
      </section>

      <section class="lp-connected" aria-labelledby="connected-title">
        <div class="lp-container">
          <p id="connected-title">Everything your club needs, in one place</p>
          <div>
            <span>Live scoring</span><i></i><span>Ladders &amp; rankings</span><i></i
            ><span>Tournaments</span><i></i><span>Player updates</span>
          </div>
        </div>
      </section>

      <section id="workflow" ref="workflowSection" class="lp-section lp-workflow">
        <div class="lp-container">
          <div class="lp-heading lp-heading--center">
            <p class="lp-eyebrow">One match. Three steps.</p>
            <h2>How it works</h2>
            <p>
              One player starts, the other joins and you play. GORRA keeps the score and saves the
              result.
            </p>
          </div>
          <ol class="lp-flow" aria-label="Three simple steps to play a match">
            <li v-for="step in workflow" :key="step.number">
              <header>
                <span>{{ step.number }}</span
                ><small>{{ step.label }}</small>
              </header>
              <figure>
                <img :src="step.image" :alt="step.alt" loading="lazy" />
                <div v-if="step.live" class="lp-flow__live"><small>LIVE</small><b>3-2</b></div>
                <div v-if="step.result" class="lp-flow__saved">
                  <small>FINAL SCORE</small><b>Amara won</b><strong>6-4 · 7-5</strong><em>Saved</em>
                </div>
                <i>{{ step.badge }}</i>
              </figure>
              <div>
                <h3>{{ step.title }}</h3>
                <p>{{ step.copy }}</p>
              </div>
            </li>
          </ol>
          <div class="lp-flow__result">
            <p><span aria-hidden="true">&#10003;</span> One simple match flow</p>
            <strong>The same three steps work for friendlies, ladders and tournaments.</strong>
          </div>
        </div>
      </section>

      <section class="lp-section lp-problem">
        <div class="lp-container lp-problem__grid">
          <div>
            <p class="lp-eyebrow">Less club admin. More tennis.</p>
            <h2>The match is simple.<br />Everything around it should be too.</h2>
          </div>
          <div class="lp-problem__copy">
            <p>Replace scattered chats, sheets and calendars with one clear club record.</p>
            <p>
              GORRA connects every challenge, schedule, score and result so players and organizers
              always see the same thing.
            </p>
          </div>
        </div>
        <div class="lp-container lp-outcomes">
          <article>
            <strong>Clear next actions</strong><span>Players always know what to do.</span>
          </article>
          <article>
            <strong>Official results</strong><span>Every score has one trusted record.</span>
          </article>
          <article>
            <strong>Less follow-up</strong><span>Organizers answer fewer repeat questions.</span>
          </article>
        </div>
      </section>

      <section id="product" class="lp-section lp-product">
        <div class="lp-container">
          <div class="lp-heading lp-product__heading">
            <div>
              <p class="lp-eyebrow">Inside GORRA</p>
              <h2>Home, Play, Compete and Club.</h2>
            </div>
            <p>
              Move through the same four areas your members and organizers use to play matches,
              follow competition and run the club.
            </p>
          </div>
          <div class="lp-tabs" role="tablist" aria-label="Product previews">
            <button
              v-for="preview in previews"
              :key="preview.key"
              type="button"
              role="tab"
              :aria-selected="activePreview.key === preview.key"
              :class="{ active: activePreview.key === preview.key }"
              @click="selectPreview(preview.key)"
            >
              {{ preview.label }}
            </button>
          </div>
          <article class="lp-demo-stage">
            <div class="lp-demo-stage__visual" :class="`is-${activePreview.key}`">
              <div class="lp-window">
                <div class="lp-window__bar">
                  <span></span><span></span><span></span
                  ><small>GORRA / {{ activePreview.label }}</small>
                </div>
                <Transition name="lp-preview" mode="out-in">
                  <LandingProductPreview :key="activePreview.key" :section="activePreview.key" />
                </Transition>
              </div>
            </div>
            <div class="lp-demo-stage__copy">
              <p class="lp-eyebrow">{{ activePreview.eyebrow }}</p>
              <h3>{{ activePreview.title }}</h3>
              <p>{{ activePreview.copy }}</p>
              <ul>
                <li v-for="note in activePreview.notes" :key="note">
                  <span aria-hidden="true">&#10003;</span>{{ note }}
                </li>
              </ul>
              <RouterLink class="lp-arrow-link" to="/signup">
                Try this flow <span aria-hidden="true">&rarr;</span>
              </RouterLink>
            </div>
          </article>
        </div>
      </section>

      <section ref="scoreboardSection" class="lp-section lp-scoreboard">
        <div class="lp-container lp-scoreboard__grid">
          <div class="lp-scoreboard__screen" aria-label="Live tennis scoreboard demonstration">
            <header>
              <b><span></span> LIVE · COURT 1</b>
              <small>MEN'S A · SEMI-FINAL</small>
            </header>
            <div class="lp-scoreboard__columns" aria-hidden="true">
              <span>SETS</span><span>GAMES</span><span>POINTS</span>
            </div>
            <p><span>Chidi Obi</span><b>1</b><b>5</b><em>AD</em></p>
            <p><span>Tunde Akinyemi</span><b>0</b><b>4</b><em>40</em></p>
            <footer>
              <span :class="{ active: scoreCallActive }" aria-hidden="true">
                <i></i><i></i><i></i><i></i>
              </span>
              <small>{{
                scoreCallActive ? 'Calling the score...' : 'Voice score calls ready'
              }}</small>
            </footer>
          </div>
          <div class="lp-scoreboard__copy">
            <p class="lp-eyebrow">Live scoreboard</p>
            <h2>A match-day display that knows tennis.</h2>
            <p>
              Show every point on a TV, projector or courtside display. GORRA handles love, deuce,
              advantage and match point, with optional voice calls that keep eyes on court.
            </p>
            <ul>
              <li><b>DISPLAY</b> Connect a TV, projector or second screen</li>
              <li><b>VOICE</b> Hear the score as each point is recorded</li>
              <li><b>RECORD</b> Keep the official result after match point</li>
            </ul>
            <button
              class="lp-button lp-button--dark"
              type="button"
              :disabled="!voiceSupported"
              @click="speakScoreCall"
            >
              {{ scoreCallActive ? 'Calling score...' : 'Hear a score call' }}
            </button>
          </div>
        </div>
      </section>

      <section id="clubs" class="lp-section lp-audiences">
        <div class="lp-container">
          <div class="lp-heading lp-heading--center">
            <p class="lp-eyebrow">Made for the whole club</p>
            <h2>One system. A clearer day for everyone.</h2>
            <p>
              Each person sees the work that belongs to them, while the club keeps one connected
              history.
            </p>
          </div>
          <div class="lp-audience-grid">
            <article v-for="audience in audiences" :key="audience.number">
              <span>{{ audience.number }}</span>
              <h3>{{ audience.title }}</h3>
              <p>{{ audience.copy }}</p>
              <ul>
                <li v-for="point in audience.points" :key="point">{{ point }}</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section class="lp-section lp-standard">
        <div class="lp-container lp-standard__grid">
          <div>
            <p class="lp-eyebrow">The standard for every club moment</p>
            <h2>Clear enough for players. Detailed enough for organizers.</h2>
            <p>
              Good club software should make the next decision obvious without hiding the rules, the
              history or the people involved.
            </p>
            <RouterLink class="lp-button lp-button--dark" to="/signup">
              Bring your club to GORRA <span aria-hidden="true">&rarr;</span>
            </RouterLink>
          </div>
          <div class="lp-standard__list">
            <article>
              <span>01</span>
              <div>
                <h3>Visible rules</h3>
                <p>Eligibility, scoring and match context stay with the action.</p>
              </div>
            </article>
            <article>
              <span>02</span>
              <div>
                <h3>Focused screens</h3>
                <p>Members see what matters now, without crowded admin noise.</p>
              </div>
            </article>
            <article>
              <span>03</span>
              <div>
                <h3>Shared history</h3>
                <p>Challenges, scores, results and movement remain connected.</p>
              </div>
            </article>
            <article>
              <span>04</span>
              <div>
                <h3>Club-level control</h3>
                <p>Roles and active-club context keep responsibilities clear.</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="faq" class="lp-section lp-faq">
        <div class="lp-container lp-faq__grid">
          <div>
            <p class="lp-eyebrow">Before you step on court</p>
            <h2>A few useful answers.</h2>
            <p>
              Still deciding how GORRA fits your club? Start here, then open the product and see the
              flow for yourself.
            </p>
          </div>
          <div class="lp-faq__items">
            <details open>
              <summary>Who is GORRA designed for?</summary>
              <p>
                Club administrators, competitive players and tournament teams who need one clear
                record for organized tennis.
              </p>
            </details>
            <details>
              <summary>Is it only a ladder app?</summary>
              <p>
                No. GORRA connects ladders with challenges, friendly matches, live scoring, match
                history, tournaments, club settings and notifications.
              </p>
            </details>
            <details>
              <summary>Does it replace the club group chat?</summary>
              <p>
                The chat can keep the banter. GORRA gives official club actions and results a
                structured home that is easier to find and trust.
              </p>
            </details>
            <details>
              <summary>Can I see the existing app before committing?</summary>
              <p>
                Yes. Create an account to explore the current product flow, or use member sign in if
                your account already exists.
              </p>
            </details>
          </div>
        </div>
      </section>

      <section class="lp-final">
        <div class="lp-container lp-final__inner">
          <p class="lp-kicker"><span></span> The next club match starts here</p>
          <h2>Less chasing.<br /><em>More playing.</em></h2>
          <p>
            Give every player a clear next step and every organizer one place to see the club move.
          </p>
          <div>
            <RouterLink class="lp-button lp-button--lime" to="/signup">
              Start with GORRA <span aria-hidden="true">&rarr;</span>
            </RouterLink>
            <RouterLink class="lp-quiet-link" to="/signin">Member sign in</RouterLink>
          </div>
        </div>
      </section>
    </main>

    <button
      v-if="floatingCtaVisible && !showCookieBanner"
      type="button"
      class="lp-floating-cta"
      aria-label="Scroll back to top"
      @click="scrollToTop"
    >
      <span class="lp-floating-cta__icon" aria-hidden="true">↑</span>
    </button>

    <div
      v-if="showCookieBanner"
      class="lp-cookie"
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
    >
      <div class="lp-cookie__panel">
        <div class="lp-cookie__text">
          <p class="lp-cookie__label">Cookies</p>
          <h3>We keep it useful, not intrusive.</h3>
          <p>
            We use essential cookies to keep the app secure and functional. Optional analytics and
            marketing cookies help us understand usage and improve the experience. You can change
            your choice any time.
          </p>
        </div>

        <div class="lp-cookie__actions">
          <button
            class="lp-button lp-button--lime lp-cookie__primary"
            type="button"
            @click="acceptCookies"
          >
            Accept cookies
          </button>
          <button
            class="lp-button lp-button--light lp-cookie__secondary"
            type="button"
            @click="rejectCookies"
          >
            Reject
          </button>
          <button class="lp-cookie__link" type="button" @click="toggleCookieSettings">
            Cookie settings
          </button>
        </div>
      </div>

      <div v-if="cookieSettingsOpen" class="lp-cookie__settings">
        <label>
          <input v-model="cookiePreferences.analytics" type="checkbox" />
          <span>Analytics</span>
        </label>
        <label>
          <input v-model="cookiePreferences.marketing" type="checkbox" />
          <span>Marketing</span>
        </label>
        <button
          class="lp-button lp-button--dark"
          type="button"
          @click="persistCookieConsent(cookiePreferences)"
        >
          Save preferences
        </button>
      </div>
    </div>

    <footer class="lp-footer">
      <div class="lp-container lp-footer__grid">
        <div>
          <AppLogo class="lp-footer__logo" on-dark />
          <p>The operating system for club tennis.</p>
        </div>
        <nav aria-label="Footer navigation">
          <a href="#workflow">How it works</a><a href="#product">Product</a
          ><a href="#clubs">For your club</a>
          <button type="button" @click="manageCookiePreferences">Cookie settings</button>
        </nav>
        <div class="lp-footer__meta">
          <a href="mailto:hello@gorra.club">hello@gorra.club</a>
          <small
            >&copy; {{ new Date().getFullYear() }} GORRA. Built for the good of the game.</small
          >
        </div>
      </div>
    </footer>
  </div>
</template>
