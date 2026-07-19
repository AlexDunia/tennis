<script setup>
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import '../assets/landing.css'
import scanToJoinImage from '../assets/landing/scan-to-join.jpg'
import playTheMatchImage from '../assets/landing/play-the-match.jpg'

const problems = [
  [
    'The score exists. Somewhere.',
    'It was posted in a chat on Tuesday. The ladder still says otherwise on Sunday.',
  ],
  [
    'The fixture was announced.',
    'Then forty-seven messages arrived, and the one that mattered disappeared.',
  ],
  [
    'Everybody knows the ranking.',
    'Until two people remember it differently and the administrator becomes the court of appeal.',
  ],
  [
    'The challenge was accepted.',
    'But who is confirming the date, recording the result, and moving the ladder?',
  ],
]

onMounted(() => {
  document.title = 'Gorra | Tennis club management, without the chasing'
  const description =
    document.querySelector('meta[name="description"]') ||
    document.head.appendChild(document.createElement('meta'))
  description.setAttribute('name', 'description')
  description.setAttribute(
    'content',
    'Run your tennis ladder, challenges, tournaments, fixtures and match scores from one clear club operating system.',
  )
})
</script>

<template>
  <div class="marketing-home">
    <a class="skip-link" href="#main-content">Skip to content</a>
    <header class="public-nav">
      <RouterLink class="brand" to="/" aria-label="Gorra home"
        ><i>G</i><span>GORRA</span></RouterLink
      >
      <nav aria-label="Public navigation">
        <a href="#players">How it works</a><a href="#tournaments">Tournaments</a
        ><a href="#why-gorra">Why Gorra</a>
      </nav>
      <RouterLink class="member-link" to="/signin" data-track="start_sign_in"
        >Member sign in ↗</RouterLink
      >
    </header>

    <main id="main-content">
      <section class="mk-hero">
        <div class="mk-hero__copy">
          <p class="eyebrow">HELPING TENNIS CLUBS KEEP EVERY MATCH MOVING</p>
          <h1>
            <span class="mk-hero__title-primary">TENNIS CLUB MANAGEMENT,</span>
            <span class="mk-hero__title-accent">WITHOUT THE CHASING.</span>
          </h1>
          <p class="lead">
            GORRA is tennis club management software for scoring matches, running ladders and
            tournaments, and keeping every player up to date.
          </p>
          <div class="actions">
            <a
              class="primary"
              href="mailto:hello@gorra.club?subject=Show%20me%20Gorra"
              data-track="request_demo"
              >See GORRA in action →</a
            ><a href="#product">Explore the club flow ↓</a>
          </div>
          <small
            >✓ One shared record for the ladder, challenges, fixtures, scores and
            tournaments.</small
          >
        </div>
        <div class="dashboard" aria-label="Gorra member dashboard preview">
          <header>
            <div>
              <small>GOOD MORNING, AMARA</small><strong>Here’s what needs your attention.</strong>
            </div>
            <b>●</b>
          </header>
          <div class="stats">
            <article><small>LADDER RANK</small><b>#8</b><em>↑ 2 places</em></article>
            <article><small>SEASON RECORD</small><b>12–4</b><em>75% win rate</em></article>
            <article><small>NEXT MATCH</small><b>Sat · 4:30</b><em>Court 2</em></article>
          </div>
          <section class="attention">
            <small>YOUR NEXT ACTION</small>
            <h3>Challenge waiting for your response</h3>
            <div class="match">
              <i>TA</i>
              <p><b>Tunde Akinyemi</b><small>Rank #6</small></p>
              <span>VS</span><i>AO</i>
              <p><b>Amara Okafor</b><small>Rank #8 · You</small></p>
            </div>
            <button>Accept challenge</button><button class="ghost">View details</button>
          </section>
          <section class="movement">
            <header><b>Recent movement</b><small>View ladder</small></header>
            <p><b>7</b><span>Nneka Eze</span><em>—</em></p>
            <p class="you"><b>8</b><span>You</span><em>↑ 2</em></p>
            <p><b>9</b><span>Bola Idris</span><em>↓ 1</em></p>
          </section>
        </div>
      </section>

      <section class="hero-capabilities" aria-labelledby="hero-capabilities-title">
        <p id="hero-capabilities-title" class="hero-capabilities__promise">
          <strong>Everything your club needs, in one place.</strong>
        </p>
        <div class="hero-capabilities__grid">
          <article>
            <span class="hero-capabilities__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="m13 2-7 11h6l-1 9 7-12h-6z" /></svg>
            </span>
            <h2>Live Match Scoring</h2>
          </article>
          <article>
            <span class="hero-capabilities__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 5h16v14H4zM4 10h16M9 10v9M14 10v9M7 7h10" />
              </svg>
            </span>
            <h2>Ladders &amp; Rankings</h2>
          </article>
          <article>
            <span class="hero-capabilities__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path
                  d="M8 4h8v3a4 4 0 0 1-8 0V4ZM8 5H5v1a4 4 0 0 0 4 4M16 5h3v1a4 4 0 0 1-4 4M12 11v5M8 20h8M9 16h6v4H9z"
                />
              </svg>
            </span>
            <h2>Tournament Management</h2>
          </article>
          <article>
            <span class="hero-capabilities__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 4a5 5 0 0 1 5 5v4l2 2H5l2-2V9a5 5 0 0 1 5-5ZM10 19h4" />
              </svg>
            </span>
            <h2>Player Updates</h2>
          </article>
        </div>
      </section>

      <section id="players" class="mk-section players player-flow">
        <div class="intro centered">
          <p class="eyebrow">One match. Three steps.</p>
          <h2>How it works</h2>
          <p>
            One player opens the match. The other scans the code. Then you play. Gorra saves the
            result.
          </p>
        </div>
        <div class="simple-flow-grid" aria-label="Three simple steps to play a match">
          <article class="simple-flow-card">
            <header><span>01</span><small>JOIN THE MATCH</small></header>
            <figure>
              <img
                :src="scanToJoinImage"
                alt="One tennis player scanning another player’s match code"
                loading="lazy"
              /><i>Scan</i>
            </figure>
            <div>
              <h3>Scan and accept</h3>
              <p>Scan once and your match is confirmed. No forms. No back-and-forth.</p>
            </div>
          </article>
          <article class="simple-flow-card">
            <header><span>02</span><small>JUST PLAY</small></header>
            <figure>
              <img :src="playTheMatchImage" alt="Two club players playing tennis" loading="lazy" />
              <div class="simple-live-score"><small>● LIVE</small><b>3–2</b></div>
              <i>Play</i>
            </figure>
            <div>
              <h3>Stay in the game</h3>
              <p>
                Focus on the tennis. Keep score as you play, let someone else score for you, or add
                the result when you finish.
              </p>
            </div>
          </article>
          <article class="simple-flow-card">
            <header><span>03</span><small>GORRA REMEMBERS</small></header>
            <figure class="saved-visual">
              <img :src="playTheMatchImage" alt="" loading="lazy" />
              <div class="simple-result">
                <small>FINAL SCORE</small><b>Amara won</b><strong>6–4 · 7–5</strong><em>✓ Saved</em>
              </div>
              <i>Done</i>
            </figure>
            <div>
              <h3>Save and share</h3>
              <p>
                Your result is saved, the table updates and can be shared, everyone knows where they
                stand.
              </p>
            </div>
          </article>
        </div>
        <p class="simple-flow-note">
          The same three steps work for friendly matches, ladders, and tournaments.
        </p>
      </section>

      <section id="why-gorra" class="mk-section friction">
        <div class="intro">
          <p class="eyebrow">Let’s call it what it is</p>
          <h2>The club is being held together by one very patient person.</h2>
          <p>
            And everybody knows who that person is. The one updating the sheet, sending the
            reminders, finding the score, and answering “who do I play next?” for the fourth time
            today.
          </p>
        </div>
        <div class="problems">
          <article v-for="(problem, index) in problems" :key="problem[0]">
            <small>0{{ index + 1 }}</small>
            <h3>{{ problem[0] }}</h3>
            <p>{{ problem[1] }}</p>
          </article>
        </div>
        <div class="truth">
          <b>Gorra does not ask your club to become more organized.</b
          ><span>It gives the club somewhere for the organization to live.</span>
        </div>
      </section>

      <section id="product" class="mk-section record">
        <div>
          <p class="eyebrow">One version of the truth</p>
          <h2>If it happened at the club, Gorra remembers it.</h2>
          <p>
            Who challenged whom. Who accepted. When the match is due. What the final score was. Who
            moved up. What is still waiting. One visible record means fewer explanations—and fewer
            arguments.
          </p>
          <ul>
            <li>✓ Rules stay visible, not assumed</li>
            <li>✓ Results become official, not anecdotal</li>
            <li>✓ The next action has a name and an owner</li>
          </ul>
        </div>
        <article class="official">
          <header>
            <div><small>OFFICIAL MATCH RECORD</small><b>Saturday Ladder Challenge</b></div>
            <span>Completed</span>
          </header>
          <div class="score">
            <p><i>TA</i><b>Tunde Akinyemi</b><small>Rank #6</small></p>
            <strong>4 : 6</strong>
            <p><i>AO</i><b>Amara Okafor</b><small>Rank #8 · Winner</small></p>
          </div>
          <div class="sets"><small>SET 1</small><b>4–6</b><small>SET 2</small><b>6–7</b></div>
          <footer>✓ Result confirmed by both players <span>22 June · Court 2</span></footer>
        </article>
      </section>

      <section id="tournaments" class="mk-section tournament">
        <div class="tournament-copy">
          <div>
            <p class="eyebrow">Tournament control</p>
            <h2>Four steps in. A whole tournament out.</h2>
          </div>
          <p>
            Categories, players, formats, group stages, knockout paths and scores—organized from one
            control area, even when tournament day gets busy.
          </p>
        </div>
        <div class="wizard">
          <aside>
            <small>NEW TOURNAMENT</small>
            <h3>Renaissance Club Championship</h3>
            <p>✓ <b>Basics</b></p>
            <p>✓ <b>Categories</b></p>
            <p class="active">03 <b>Players</b></p>
            <p>04 <b>Review</b></p>
          </aside>
          <section>
            <header>
              <div>
                <small>STEP 3 OF 4</small>
                <h3>Place your players</h3>
              </div>
              <span>24 selected</span>
            </header>
            <div class="tabs">
              <b>Men’s A · 8</b><span>Men’s B · 8</span><span>Women’s Open · 8</span>
            </div>
            <p><b>Chidi Obi</b><span>#2</span><span>Men’s A</span><em>Placed</em></p>
            <p><b>Tunde Akinyemi</b><span>#6</span><span>Men’s A</span><em>Placed</em></p>
            <p><b>Amara Okafor</b><span>#8</span><span>Men’s A</span><em>Placed</em></p>
            <button>Continue to review →</button>
          </section>
        </div>
      </section>

      <section class="mk-section scoring">
        <div class="scoreboard">
          <header><b>● LIVE · COURT 1</b><small>MEN’S A · SEMI-FINAL</small></header>
          <p><span>Chidi Obi</span><b>1</b><b>5</b><em>AD</em></p>
          <p><span>Tunde Akinyemi</span><b>0</b><b>4</b><em>40</em></p>
        </div>
        <div>
          <p class="eyebrow">It knows tennis</p>
          <h2>Love. Deuce. Advantage. And the record after match point.</h2>
          <p>
            A focused live scoreboard handles real tennis scoring, while match details keep the
            players, schedule, score, winner and tournament context together.
          </p>
          <ul>
            <li><b>LIVE</b> Follow the match as it happens</li>
            <li><b>FINAL</b> Keep the official result after it ends</li>
          </ul>
        </div>
      </section>

      <section class="mk-section notifications">
        <div>
          <p class="eyebrow">Less chasing, naturally</p>
          <h2>The reminder has already been sent. You can put your phone down.</h2>
          <p>
            Gorra keeps members aware of challenges, result reviews, schedule changes and tournament
            activity—without turning the administrator into the club’s full-time notification
            service.
          </p>
        </div>
        <article class="notice-card">
          <header><b>Notifications</b><span>3 unread</span></header>
          <p>
            <i>↗</i
            ><span><b>Challenge received</b><small>Tunde Akinyemi has challenged you</small></span
            ><em>Now</em>
          </p>
          <p>
            <i>✓</i
            ><span><b>Result ready for review</b><small>Confirm the score from Court 2</small></span
            ><em>12m</em>
          </p>
          <p>
            <i>◷</i
            ><span
              ><b>Tournament fixture updated</b><small>Quarter-final moved to 4:30 PM</small></span
            ><em>1h</em>
          </p>
        </article>
      </section>

      <section class="mk-section trust">
        <p class="eyebrow">What you are really buying</p>
        <h2>Not software. <em>Peace at the club.</em></h2>
        <div>
          <article>
            <small>01</small>
            <h3>Fairness people can see</h3>
            <p>
              Clear eligibility, visible rankings, and official results make decisions easier to
              understand.
            </p>
          </article>
          <article>
            <small>02</small>
            <h3>Time returned to the organizer</h3>
            <p>
              Less collecting, reminding, checking and explaining. More room to run the club
              properly.
            </p>
          </article>
          <article>
            <small>03</small>
            <h3>A record that outlives the chat</h3>
            <p>
              Club history stays with the club—not on one phone, in one spreadsheet, or in one
              person’s head.
            </p>
          </article>
        </div>
        <blockquote>
          “Good clubs run on trust. Trust runs on everyone seeing the same thing.”
        </blockquote>
      </section>

      <section class="final">
        <p class="eyebrow">Your members came to play tennis</p>
        <h2>Let Gorra handle the part before the serve.</h2>
        <p>
          One place where players know what to do, administrators know what is happening, and the
          game keeps moving.
        </p>
        <div class="actions">
          <a
            class="primary"
            href="mailto:hello@gorra.club?subject=Gorra%20club%20demonstration"
            data-track="request_demo_final"
            >Show me Gorra →</a
          ><RouterLink to="/dashboard" data-track="explore_demo">Explore the product ↗</RouterLink>
        </div>
      </section>
    </main>
    <footer class="public-footer">
      <RouterLink class="brand" to="/"><i>G</i><span>GORRA</span></RouterLink>
      <p>The operating system for club tennis.</p>
      <nav>
        <a href="#players">How it works</a><a href="#tournaments">Tournaments</a
        ><a href="mailto:hello@gorra.club">Contact</a>
      </nav>
      <small>© {{ new Date().getFullYear() }} Gorra. Built for the good of the game.</small>
    </footer>
  </div>
</template>
