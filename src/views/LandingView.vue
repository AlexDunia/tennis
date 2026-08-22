<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppLogo from '../components/AppLogo.vue'
import '../assets/landing-v2.css'
import dashboardImage from '../../artifacts/dashboard-desktop.png'
import ladderImage from '../../docs/screenshots/compete-ladder-refined-desktop.jpg'
import challengesImage from '../../docs/screenshots/compete-challenges-refined-mobile.jpg'
import tournamentsImage from '../../docs/screenshots/compete-tournaments-admin.jpg'

const mobileMenuOpen = ref(false)
const activePreviewKey = ref('dashboard')

const previews = [
  {
    key: 'dashboard',
    label: 'Home',
    eyebrow: 'Member home',
    title: 'Know what needs attention before the club asks.',
    copy: 'The dashboard brings the next match, nearby ladder movement, open challenges and club activity into one calm starting point.',
    image: dashboardImage,
    alt: 'The GORRA member dashboard showing club activity and next actions',
    notes: ['Next action is visible', 'Club activity stays together', 'Members start with context'],
  },
  {
    key: 'ladder',
    label: 'Ladder',
    eyebrow: 'Ladders and rankings',
    title: 'Make the ladder self-explanatory.',
    copy: 'Players can see their position, points and challenge range without asking an organizer to interpret a spreadsheet.',
    image: ladderImage,
    alt: 'The GORRA club ladder with player ranks and challenge actions',
    notes: [
      'Current position highlighted',
      'Eligible opponents are clear',
      'Movement follows confirmed results',
    ],
  },
  {
    key: 'challenges',
    label: 'Challenges',
    eyebrow: 'Challenge flow',
    title: 'A challenge always has a next step.',
    copy: 'Received and sent challenges stay organized by status, so players can respond, schedule, play and review the result in one flow.',
    image: challengesImage,
    alt: 'The GORRA mobile challenge queue showing received challenges',
    notes: [
      'Received and sent are separated',
      'Response state stays visible',
      'Match detail keeps the full history',
    ],
  },
  {
    key: 'tournaments',
    label: 'Tournaments',
    eyebrow: 'Club competition',
    title: 'Give every tournament one reliable home.',
    copy: 'Keep event details, categories, schedules, groups, fixtures, standings and results connected from setup through the final.',
    image: tournamentsImage,
    alt: 'The GORRA tournament management view for club administrators',
    notes: [
      'Events stay easy to find',
      'Competition status is visible',
      'Admins and players share one record',
    ],
  },
]

const activePreview = computed(
  () => previews.find((preview) => preview.key === activePreviewKey.value) || previews[0],
)

const workflow = [
  ['Challenge', 'A player starts with an eligible opponent and clear club rules.'],
  ['Schedule', 'Both sides know the agreed time, court and next action.'],
  ['Score', 'Run the live scoreboard or record the result after the match.'],
  ['Confirm', 'The result becomes a shared match record, not a chat message.'],
  ['Move', 'The ladder, history and club activity reflect what happened.'],
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

function closeMobileMenu() {
  mobileMenuOpen.value = false
}

function setMeta(name, content) {
  const selector = `meta[name=${name}]`
  const meta =
    document.querySelector(selector) || document.head.appendChild(document.createElement('meta'))
  meta.setAttribute('name', name)
  meta.setAttribute('content', content)
}

onMounted(() => {
  document.title = 'GORRA | Run the club. Keep everyone playing.'
  setMeta(
    'description',
    'GORRA connects tennis ladders, challenges, match schedules, live scoring, tournaments and club updates in one clear flow.',
  )
  setMeta('theme-color', '#052e20')
  setMeta('apple-mobile-web-app-status-bar-style', 'black-translucent')
})
</script>

<template>
  <div class="gorra-landing">
    <a class="lp-skip" href="#landing-main">Skip to content</a>
    <header class="lp-nav">
      <div class="lp-container lp-nav__inner">
        <RouterLink class="lp-brand" to="/" aria-label="GORRA home" @click="closeMobileMenu">
          <AppLogo class="lp-brand__logo" on-dark />
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
        <div id="landing-navigation" class="lp-nav__links" :class="{ open: mobileMenuOpen }">
          <nav aria-label="Landing page navigation">
            <a href="#workflow" @click="closeMobileMenu">How it works</a>
            <a href="#product" @click="closeMobileMenu">Product</a>
            <a href="#clubs" @click="closeMobileMenu">For your club</a>
            <a href="#faq" @click="closeMobileMenu">Questions</a>
          </nav>
          <div class="lp-nav__actions">
            <RouterLink class="lp-text-link" to="/signin" @click="closeMobileMenu"
              >Member sign in</RouterLink
            >
            <RouterLink class="lp-button lp-button--light" to="/signup" @click="closeMobileMenu">
              Start with GORRA <span aria-hidden="true">&rarr;</span>
            </RouterLink>
          </div>
        </div>
      </div>
    </header>

    <main id="landing-main">
      <section class="lp-hero">
        <div class="lp-container lp-hero__grid">
          <div class="lp-hero__copy">
            <p class="lp-kicker"><span></span> The operating system for club tennis</p>
            <h1>Run the club.<br /><em>Keep everyone playing.</em></h1>
            <p class="lp-hero__lead">
              GORRA connects the ladder, challenges, match schedules, live scores and tournaments in
              one place - so players know what is next and organizers stop chasing updates.
            </p>
            <div class="lp-hero__actions">
              <RouterLink class="lp-button lp-button--lime" to="/signup">
                Create your account <span aria-hidden="true">&rarr;</span>
              </RouterLink>
              <a class="lp-quiet-link" href="#product">See the real product</a>
            </div>
            <ul class="lp-hero__assurances" aria-label="Product highlights">
              <li><span aria-hidden="true">&#10003;</span> Built for tennis clubs</li>
              <li><span aria-hidden="true">&#10003;</span> One connected match record</li>
              <li><span aria-hidden="true">&#10003;</span> Clear roles for admins and players</li>
            </ul>
          </div>

          <div class="lp-hero__product">
            <div class="lp-window lp-window--hero">
              <div class="lp-window__bar">
                <span></span><span></span><span></span><small>GORRA / Club home</small>
              </div>
              <img
                :src="dashboardImage"
                alt="The actual GORRA club dashboard"
                fetchpriority="high"
                decoding="async"
              />
            </div>
            <div class="lp-product-callout lp-product-callout--top">
              <small>YOUR NEXT ACTION</small><strong>Visible at a glance</strong>
            </div>
            <div class="lp-product-callout lp-product-callout--bottom">
              <span aria-hidden="true">&#10003;</span>
              <div><small>ONE CLUB RECORD</small><strong>Everyone sees the same thing</strong></div>
            </div>
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
            <p>
              Club tennis gets messy when the score lives in a chat, the fixture lives in a
              calendar, the ranking lives in a sheet and the next action lives in one person's head.
            </p>
            <p>
              GORRA gives every match a clear path from challenge to confirmed result, with the club
              record moving alongside it.
            </p>
          </div>
        </div>
        <div class="lp-container lp-outcomes">
          <article>
            <strong>One next action</strong><span>Players know what to do now.</span>
          </article>
          <article>
            <strong>One official result</strong><span>The club keeps a trusted record.</span>
          </article>
          <article>
            <strong>One place to look</strong><span>Organizers answer fewer repeat questions.</span>
          </article>
        </div>
      </section>

      <section id="workflow" class="lp-section lp-workflow">
        <div class="lp-container">
          <div class="lp-heading lp-heading--center">
            <p class="lp-eyebrow">From first tap to final score</p>
            <h2>Every match moves forward in five clear steps.</h2>
            <p>Not five tools. Not five reminders. One shared flow for the club and its players.</p>
          </div>
          <ol class="lp-flow">
            <li v-for="(step, index) in workflow" :key="step[0]">
              <span>0{{ index + 1 }}</span>
              <div>
                <h3>{{ step[0] }}</h3>
                <p>{{ step[1] }}</p>
              </div>
            </li>
          </ol>
          <div class="lp-flow__result">
            <p><span aria-hidden="true">&#10003;</span> Result confirmed</p>
            <strong>The club record moves with the match.</strong>
            <div>
              <span>History updated</span><span>Ladder movement visible</span
              ><span>Players notified</span>
            </div>
          </div>
        </div>
      </section>

      <section class="lp-connected" aria-labelledby="connected-title">
        <div class="lp-container">
          <p id="connected-title">The whole club flow, connected</p>
          <div>
            <span>Ladders</span><i></i><span>Challenges</span><i></i><span>Live scoring</span><i></i
            ><span>Tournaments</span><i></i><span>Updates</span>
          </div>
        </div>
      </section>

      <section id="product" class="lp-section lp-product">
        <div class="lp-container">
          <div class="lp-heading lp-product__heading">
            <div>
              <p class="lp-eyebrow">This is GORRA</p>
              <h2>See the product your members will actually use.</h2>
            </div>
            <p>
              Every screen below comes directly from the current GORRA interface, using the same
              navigation, spacing, colors and club data members see inside the app.
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
              @click="activePreviewKey = preview.key"
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
                  <img
                    :key="activePreview.key"
                    :src="activePreview.image"
                    :alt="activePreview.alt"
                    loading="lazy"
                    decoding="async"
                  />
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

    <footer class="lp-footer">
      <div class="lp-container lp-footer__grid">
        <div>
          <AppLogo class="lp-footer__logo" on-dark />
          <p>The operating system for club tennis.</p>
        </div>
        <nav aria-label="Footer navigation">
          <a href="#workflow">How it works</a><a href="#product">Product</a
          ><a href="#clubs">For your club</a>
          <RouterLink to="/landing-legacy">Previous landing page</RouterLink>
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
