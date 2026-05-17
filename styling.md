# ShellTennis PH - Complete Styling Architecture Guide

## Table of Contents

1. [Global Styles & Design System](#global-styles--design-system)
2. [Navigation Architecture](#navigation-architecture)
3. [Layout System](#layout-system)
4. [Component Styling](#component-styling)
5. [View-Level Styling](#view-level-styling)
6. [Responsive Design](#responsive-design)
7. [Design Intent & Rules](#-design-intent--rules-ai-interpretation-layer)
8. [Styling Flow & Dependencies](#styling-flow--dependencies)

---

## Global Styles & Design System

### CSS Variables (Foundation)

**File:** `src/assets/main.css`

All styling is built on CSS custom properties defined at the `:root` level. This creates a single source of truth for the entire application's visual design.

#### Color Palette

```css
/* Primary / brand */
--color-primary: #00b51a;
--color-primary-strong: #008f15;
--color-accent-bright: #00b51a;

/* Support accents */
--color-accent: #ffd33d;
--color-accent-strong: #ffb400;
--color-accent-support: #ffd33d;
--color-clay: #ff7f32;

/* Text and neutrals */
--color-text: #162218;
--color-text-soft: #425044;
--color-muted: #6d7a70;
--color-dark: #0f1419;
--color-dark-soft: #1a1a1a;
--color-light: #ffffff;

/* Backgrounds and surfaces */
--color-bg: #ffffff;
--color-bg-muted: #f7f8fa;
--color-surface: #ffffff;
--color-surface-muted: #fbfcfd;
--color-surface-soft: #f4f7f5;

/* Borders */
--color-border: #e7ece8;
--color-border-strong: #d7dfd8;
```

Current app note:

- the global token system is still active
- many active views also define local one-off colors directly in their component CSS
- several routed views import Poppins from Google Fonts inside the view-level stylesheet
- `DefaultLayout.vue` currently uses direct hex values for the sidebar/header instead of only global tokens

#### Shadow System

```css
--shadow-soft: 0 2px 8px rgba(0, 0, 0, 0.04);
--shadow-strong: 0 6px 18px rgba(0, 0, 0, 0.06);
```

Active pages often use stronger local shadows, especially on dashboard cards, challenge cards, ranking cards, modals, and toasts.

#### Spacing & Typography

```css
--radius: 0.5rem;
--radius-lg: 0.75rem;
```

The global body font is Inter/Avenir/Segoe UI, but most active routed pages override to Poppins locally.

### Global HTML/Body Styling

```css
* {
  box-sizing: border-box; /* includes padding/borders in width */
}

html {
  scroll-behavior: smooth; /* smooth scrolling */
}

body {
  font-family: Inter, 'Avenir Next', 'Segoe UI', sans-serif;
  line-height: 1.55;
  text-rendering: optimizeLegibility;
  color: var(--color-text);
  background: var(--color-bg);
}

::selection {
  background: rgba(255, 211, 61, 0.34); /* yellow highlight on text selection */
  color: var(--color-text);
}
```

### Reusable CSS Classes

```css
.container {
  width: min(1160px, calc(100% - 2rem)); /* max 1160px with 1rem side margins */
  margin: 0 auto;
}

.surface-card,
.section-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-soft);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

/* Hover elevation effect */
.surface-card:hover,
.section-card:hover {
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-strong);
}
```

**External Assets:** No external CSS frameworks are used. Styling is mostly local Vue CSS plus global CSS variables, with some active views importing Google Fonts and Cloudinary images.

---

## Navigation Architecture

### Current Sidebar Navigation

**File:** `src/layouts/DefaultLayout.vue`

The active app no longer uses the top `NavBar.vue` as the primary navigation. The live shell uses a fixed left sidebar with icon + label links.

#### Structure

The sidebar is rendered inside `DefaultLayout.vue`, which is rendered directly by `App.vue`.

Active sidebar links:

- Dashboard
- Rankings
- Challenges
- Profile
- Notifications

Notifications also show an unread badge from `notificationStore.unreadCount`.

#### Styling Breakdown

```css
.layout {
  font-family: 'Poppins', sans-serif;
  display: flex;
  min-height: 100vh;
}

.sidebar {
  position: fixed;
  width: 240px;
  top: 0;
  bottom: 0;
  padding: 28px 20px;
  background: #fff;
  border-right: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 28px;
  box-shadow: 4px 0 18px rgba(0, 0, 0, 0.04);
  z-index: 30;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 500;
  color: #7b8794;
  text-decoration: none;
}

.nav-link:hover {
  background: #f3f6f3;
  color: #0f1720;
}

.nav-link.active {
  background: rgba(0, 200, 83, 0.05);
  color: #007a32;
}

.badge {
  margin-left: auto;
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 20px;
  background: rgba(0, 200, 83, 0.12);
  color: #007a32;
}
```

#### Color Flow for Current Navigation

- **Sidebar background:** white
- **Default link text:** muted gray `#7b8794`
- **Hover background:** pale gray-green `#f3f6f3`
- **Active state:** pale green background with dark green text
- **Badge:** pale green background with dark green text

#### Responsive Behavior

`DefaultLayout.vue` currently does not define responsive sidebar breakpoints. The shell remains a fixed 240px sidebar with the main area offset by `margin-left: 240px`.

This is important for future UI work:

- the active pages contain their own responsive rules
- the shell itself still needs a mobile/tablet navigation strategy if the app must work comfortably on narrow screens

### Legacy NavBar Component

**File:** `src/components/NavBar.vue`

`NavBar.vue` still exists in the repo, but it is not part of the active routed dashboard shell. Treat it as secondary or legacy unless it is reintroduced in `App.vue` or `DefaultLayout.vue`.

---

## Layout System

### DefaultLayout Component

**File:** `src/layouts/DefaultLayout.vue`

This is the main layout wrapper for the active app. It includes the fixed sidebar, sticky top header, route content area, and toast shelf.

#### Two-Column Flex Layout

```css
.layout {
  font-family: 'Poppins', sans-serif;
  display: flex;
  min-height: 100vh;
}
```

### Sidebar Component (Part of DefaultLayout)

**Location:** `src/layouts/DefaultLayout.vue` (scoped styles)

#### Styling Architecture

```css
.sidebar {
  position: fixed;
  width: 240px;
  top: 0;
  bottom: 0;
  padding: 28px 20px;
  background: #fff;
  border-right: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 28px;
  box-shadow: 4px 0 18px rgba(0, 0, 0, 0.04);
  z-index: 30;
}
```

**Key Design Elements:**

1. **Logo**

```css
.logo {
  display: flex;
  align-items: center;
}

.logo-img {
  width: 100%;
  max-width: 160px;
  object-fit: contain;
}
```

2. **Navigation Links**

```css
.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 500;
  color: #7b8794;
  text-decoration: none;
}

.icon {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-link.active {
  background: rgba(0, 200, 83, 0.05);
  color: #007a32;
}
```

3. **Notification Badge**

```css
.badge {
  margin-left: auto;
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 20px;
  background: rgba(0, 200, 83, 0.12);
  color: #007a32;
}
```

### Shell (Main Content Area)

```css
.main {
  margin-left: 240px;
  flex: 1;
  display: flex;
  flex-direction: column;
}
```

The `margin-left` is the layout offset that keeps route content from sitting under the fixed sidebar.

### Page Header (Inside Shell)

```css
.header {
  position: sticky;
  top: 0;
  background: #fff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  padding: 24px 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 10;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
}

.header-left h1 {
  font-size: 20px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.8);
  margin: 0;
  line-height: 1.25;
  letter-spacing: -0.2px;
}

.header-left p {
  font-size: 12.5px;
  color: #7b8794;
  margin: 0;
  line-height: 1.4;
}

.user {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00c853, #4cd964);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### Main Content Container

```css
.content {
  padding: 32px;
}
```

#### Layout Responsive Breakpoints

Current shell-level responsive breakpoints:

- `DefaultLayout.vue` does not currently include media queries.
- The fixed sidebar and `margin-left: 240px` stay active at all viewport widths.
- Page-level components do have responsive rules, documented later in this file.

Recommended future shell cue:

- add a tablet/mobile navigation pattern before relying on this shell for narrow screens.

---

## Component Styling

### BaseButton Component

**File:** `src/components/BaseButton.vue`

Provides three button variants used throughout the application.

```css
.base-button {
  border: 1px solid transparent;
  border-radius: 0.5rem;
  min-height: 38px;
  padding: 0 14px;
  font-size: 0.95rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition:
    background 0.12s ease-in-out,
    border-color 0.12s ease-in-out,
    color 0.12s ease-in-out,
    transform 0.12s ease-in-out,
    box-shadow 0.12s ease-in-out;
}

.base-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
}

.base-button:active:not(:disabled) {
  transform: scale(0.98);
}

.base-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
```

**Variants:**

1. **Primary Button**

```css
.base-button--primary {
  background: var(--color-accent-bright); /* green */
  color: var(--color-light); /* white text */
  border-color: transparent;
}
```

2. **Secondary Button**

```css
.base-button--secondary {
  background: transparent;
  color: var(--color-accent-bright); /* green text */
  border-color: var(--color-accent-bright); /* green border */
}
```

3. **Ghost Button**

```css
.base-button--ghost {
  background: transparent;
  color: var(--color-text);
  border-color: var(--color-border);
}
```

### BaseInput Component

**File:** `src/components/BaseInput.vue`

Form input styling with focus states.

```css
.field {
  display: grid;
  gap: 0.45rem;
}

.field__label {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-text);
}

.field__input {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 0.9rem;
  padding: 0.88rem 0.95rem;
  background: #ffffff;
  color: var(--color-text);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.field__input:focus {
  outline: none;
  border-color: rgba(0, 181, 26, 0.35); /* green focus outline */
  box-shadow: 0 0 0 4px rgba(0, 181, 26, 0.08); /* green glow */
}
```

### PersonAvatar Component

**File:** `src/components/PersonAvatar.vue`

Used in the Create Challenge flow for current player and opponent identity display.

```css
.person-avatar {
  border-radius: 999px;
  background: var(--color-surface-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--color-text);
}

.person-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

Responsive cue:

- sizing is passed by prop, so the component adapts through inline width and height
- it does not define breakpoints internally

### ToastShelf Component

**File:** `src/components/ToastShelf.vue`

Toasts are rendered globally from `DefaultLayout.vue`.

```css
.toast-shelf {
  position: fixed;
  top: 1rem;
  right: 1rem;
  display: grid;
  gap: 0.75rem;
  z-index: 10000;
  width: min(360px, calc(100vw - 2rem));
}

.toast {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.95rem 1rem;
  border-radius: 1rem;
  box-shadow: 0 28px 80px rgba(15, 23, 42, 0.14);
  color: #0f172a;
  background: #f8fafc;
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.toast--success {
  background: #ecfdf5;
  border-color: rgba(16, 185, 129, 0.2);
}

.toast--warning {
  background: #fffbeb;
  border-color: rgba(234, 179, 8, 0.3);
}

.toast--info {
  background: #eff6ff;
  border-color: rgba(59, 130, 246, 0.25);
}
```

Responsive cue:

- toast width uses `min(360px, calc(100vw - 2rem))`, so it stays inside narrow screens
- transitions are subtle: opacity and `translateY(-10px)` over 180ms

### PlayerCard Component

**File:** `src/components/PlayerCard.vue`

Current status:

- `PlayerCard.vue` exists in the repo, but the active Rankings page currently uses its own inline leaderboard row/card styles instead of this component.
- Keep this section as secondary component documentation, not as the active leaderboard styling source.

Displays individual player information in a card format.

```css
.player-card {
  background: var(--color-surface);
  border-radius: 0.75rem;
  padding: 1.25rem;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-soft);
  transition:
    transform 0.12s ease-in-out,
    box-shadow 0.12s ease-in-out;
}

.player-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-strong);
}

.player-card__identity {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.player-card__rank-badge {
  min-width: 3rem;
  height: 3rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.9rem;
  background: rgba(0, 181, 26, 0.12); /* light green background */
  color: var(--color-primary-strong);
  font-size: 0.95rem;
  font-weight: 800;
}

.player-card__name {
  margin: 0;
  font-size: 1rem;
}

.player-card__record {
  margin: 0.3rem 0 0;
  color: var(--color-muted);
  font-size: 0.9rem;
}

.player-card__meta {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  flex-wrap: wrap;
  justify-content: end;
}

.player-card__meta-pill {
  padding: 0.45rem 0.85rem;
  border-radius: 999px;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  color: var(--color-text-soft);
  font-size: 0.84rem;
  font-weight: 600;
}
```

**Mobile Responsive:**

```css
@media (max-width: 720px) {
  .player-card {
    flex-direction: column;
    align-items: start;
  }
  .player-card__meta {
    justify-content: start;
  }
}
```

### ChallengeCard Component

**File:** `src/components/ChallengeCard.vue`

This is active in `ChallengesView.vue`. The current component uses the `cc` class family, not the older `challenge-card` class family.

```css
.cc {
  background: #fff;
  border-radius: 18px;
  padding: 22px 24px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  font-family: 'Poppins', sans-serif;
  color: #0f1720;
  display: flex;
  flex-direction: column;
  gap: 18px;
  transition:
    transform 0.22s cubic-bezier(0.22, 0.61, 0.36, 1),
    box-shadow 0.22s ease;
}

.cc:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.08);
}

.cc__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.cc__matchup {
  display: flex;
  align-items: center;
  gap: 16px;
}

.cc__player {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.cc__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.cc__avatar--green {
  background: rgba(0, 200, 83, 0.1);
  color: #007a32;
}

.cc__avatar--blue {
  background: #e8f0fe;
  color: #1a56c4;
}

.cc__info-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  padding: 14px 0;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.cc-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  border: none;
}
```

Status pill colors:

- awaiting uses amber
- scheduled uses green
- pending review uses blue
- completed uses gray

Responsive cue:

```css
@media (max-width: 640px) {
  .cc__matchup {
    gap: 10px;
  }

  .cc__actions {
    width: 100%;
  }

  .cc-btn {
    flex: 1;
    justify-content: center;
  }

  .cc__player--right {
    flex-direction: row;
    text-align: left;
  }
}
```

---

## View-Level Styling

### Dashboard View

**File:** `src/views/DashboardView.vue`

The active dashboard is no longer the older stat-card/featured-match layout. It now uses an image hero, glass KPI cards, an overview grid, a performance chart, and a recent activity card.

Current primary classes:

- `.dashboard`
- `.hero`
- `.hero-top`
- `.hero__title`
- `.cta`
- `.kpi.inside`
- `.card.glass`
- `.section-group`
- `.grid`
- `.action-row`
- `.insights`
- `.activity-item`

Important styling cues:

- Poppins is imported locally.
- `.dashboard` is centered with `max-width: 1100px`.
- `.hero` uses a Cloudinary tennis court background image.
- `.hero::before`, `.hero::after`, and `.hero-scrim` create image, green tint, and dark readability layers.
- KPI cards inside the hero use translucent green-tinted glass styling.
- CTA button uses solid `#00c853`.
- Activity rows use subtle hover translation.

Responsive cues:

```css
@media (max-width: 768px) {
  .kpi.inside {
    grid-template-columns: repeat(2, 1fr);
  }

  .grid {
    grid-template-columns: 1fr;
  }

  .hero-top {
    flex-direction: column;
  }

  .hero__title {
    font-size: 24px;
  }
}
```

---

### Rankings View

**File:** `src/views/RankingsView.vue`

The active Rankings page uses local leaderboard styling, not `PlayerCard.vue`.

Current primary classes:

- `.rankings`
- `.card.primary`
- `.position-body`
- `.expanded-stats`
- `.leaderboard-container`
- `.leaderboard-top`
- `.leaderboard-controls`
- `.search-wrap`
- `.share-wrap`
- `.share-dropdown`
- `.leaderboard-row`
- `.zone-bar`
- `.share-card-overlay`
- `.share-card-inner`

Important styling cues:

- Poppins is imported locally.
- The current player card uses a green/yellow gradient with a faint tennis ball image.
- The leaderboard uses fixed grid columns for rank, player, wins, losses, win rate, and action.
- Challengeable players use a pale green row background.
- The current user row uses a pale amber row background and `YOU` tag.
- Search has a fixed width on desktop to prevent control shifting.
- The share-card modal uses a dark sports-poster style with green accents.

Responsive cues:

```css
@media (max-width: 900px) {
  .position-body {
    flex-direction: column;
    align-items: flex-start;
  }

  .expanded-stats {
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    padding-left: 0;
    padding-top: 16px;
    width: 100%;
  }
}

@media (max-width: 640px) {
  .leaderboard-top {
    flex-wrap: wrap;
  }

  .leaderboard-controls {
    width: 100%;
    margin-left: 0;
  }

  .search-wrap {
    flex: 1;
    width: auto;
    min-width: 0;
  }
}

@media (max-width: 600px) {
  .leaderboard-header {
    display: none;
  }
}
```

---

### Challenges View

**File:** `src/views/ChallengesView.vue`

The active Challenges page uses a summary row, segmented tabs, challenge cards, and a detail modal.

Current primary classes:

- `.challenges`
- `.summary-row`
- `.hero-card`
- `.next-card`
- `.tabs-wrap`
- `.ch-tab`
- `.cards-list`
- `.card-wrapper`
- `.modal-backdrop`
- `.modal`
- `.modal__details`

Important styling cues:

- Poppins is imported locally.
- The summary hero card uses a Cloudinary tennis image with a dark overlay.
- The pending reply card is a white card with a pale green pending row.
- Tabs use a gray outer container and white active tab.
- The selected/active challenge highlight is applied to `.card-wrapper--highlighted`.
- The modal uses a blurred backdrop, rounded white panel, player matchup row, and compact detail grid.

Responsive cues:

```css
@media (max-width: 900px) {
  .summary-row {
    grid-template-columns: 1fr;
  }

  .tabs-wrap {
    align-self: stretch;
  }

  .tabs-row {
    flex-wrap: wrap;
  }
}

@media (max-width: 560px) {
  .modal {
    padding: 20px;
    border-radius: 18px;
  }

  .modal__details {
    grid-template-columns: 1fr;
  }

  .modal__actions {
    flex-direction: column;
  }
}
```

---

### Create Challenge View

**File:** `src/views/CreateChallengeView.vue`

The active Create Challenge page uses a two-column layout with an identity card on the left and the challenge form on the right.

Current primary classes:

- `.create-challenge`
- `.intro`
- `.layout`
- `.section-card`
- `.identity-card`
- `.challenge-form`
- `.player-row`
- `.stat-row`
- `.opponent-preview`
- `.selected-strip`
- `.player-picker`
- `.toggle-group`
- `.toggle-opt`
- `.inset-block`
- `.stepper`
- `.form-select`
- `.form-textarea`

Important styling cues:

- The form relies on compact controls and segmented toggle groups.
- Opponent picker is a custom dropdown-style panel with search.
- Selected opponent appears as a green-tinted strip.
- Doubles and custom-set controls reveal inside pale inset blocks.
- The submit button uses `BaseButton`.

Responsive cue:

```css
@media (max-width: 860px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .doubles-grid {
    grid-template-columns: 1fr;
  }
}
```

---

### Play View And TennisScoreboard

**Files:** `src/views/PlayView.vue`, `src/components/TennisScoreboard.vue`

Current primary classes:

- `.play`
- `.play__meta-card`
- `.play__wrapper`
- `.tennis-scoreboard`
- `.tennis-scoreboard__players`
- `.tennis-scoreboard__sets`
- `.tennis-scoreboard__controls`

Responsive cues:

```css
@media (max-width: 900px) {
  .play__meta-card {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .tennis-scoreboard__players,
  .tennis-scoreboard__controls {
    grid-template-columns: 1fr;
  }
}
```

---

### Match Details View

**File:** `src/views/MatchDetailsView.vue`

Current primary classes:

- `.match-details`
- `.match-grid`
- `.match-summary`
- `.result-panel`
- `.field`
- `.submit-button`

Responsive cue:

```css
@media (max-width: 900px) {
  .match-grid {
    grid-template-columns: 1fr;
  }
}
```

---

### Profile View

**File:** `src/views/ProfileView.vue`

Current primary classes:

- `.profile`
- `.profile__hero`
- `.profile__avatar`
- `.profile__stats`
- `.profile__stat`
- `.profile__card`
- `.profile__row`

Responsive cues:

```css
@media (max-width: 640px) {
  .profile__stats {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 400px) {
  .profile__stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

---

### Notifications View

**File:** `src/views/NotificationsView.vue`

Current primary classes:

- `.notifications-page`
- `.page-header`
- `.page-header__actions`
- `.unread-badge`
- `.feed`
- `.feed-group`
- `.notification-card`
- `.notif-icon`
- `.notif-btn`

Responsive cue:

```css
@media (max-width: 600px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .notification-card {
    grid-template-columns: 36px 1fr;
    gap: 0.75rem;
    padding: 0.9rem 1rem;
  }
}
```

---

## Responsive Design

### Breakpoint Strategy

The application uses page-level responsive rules more than shell-level responsive rules.

Important current reality:

- `DefaultLayout.vue` currently has no responsive media queries.
- The sidebar remains fixed at 240px.
- The main content remains offset with `margin-left: 240px`.
- Individual pages do include responsive rules.

#### 1. **Dashboard Mobile (max-width: 768px)**

- KPI grid changes from 4 columns to 2 columns.
- Overview grid becomes one column.
- Hero top area stacks vertically.
- Hero title gets smaller.

#### 2. **Rankings Tablet/Mobile (max-width: 900px, 640px, 600px)**

- At 900px, the current-player card stacks its identity and stats.
- At 640px, leaderboard controls wrap and search becomes flexible.
- At 600px, the leaderboard header is hidden.

#### 3. **Challenges Tablet/Mobile (max-width: 900px, 560px)**

- At 900px, the summary row stacks and tabs can wrap.
- At 560px, modal detail grids become one column and modal actions stack.

#### 4. **Create Challenge Tablet (max-width: 860px)**

```css
@media (max-width: 860px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .doubles-grid {
    grid-template-columns: 1fr;
  }
}
```

#### 5. **Play / Scoreboard (max-width: 900px, 720px)**

- At 900px, the Play meta card stacks.
- At 720px, scoreboard player panels and scoring buttons stack.

#### 6. **Profile (max-width: 640px, 400px)**

- At 640px, profile stat cards move to 3 columns.
- At 400px, profile stat cards move to 2 columns.

#### 7. **Notifications (max-width: 600px)**

```css
@media (max-width: 600px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .notification-card {
    grid-template-columns: 36px 1fr;
    gap: 0.75rem;
    padding: 0.9rem 1rem;
  }
}
```

#### 8. **Toast Shelf**

- Uses width `min(360px, calc(100vw - 2rem))`.
- This prevents toast cards from overflowing narrow viewports.

### Fluid Typography

The active shell currently does not use `clamp()` in the page header. Header title sizing is fixed at `20px` in `DefaultLayout.vue`.

Some page-level typography changes at breakpoints, such as the Dashboard hero title shrinking at `max-width: 768px`.

### Flexible Container Width

Global `.container` still exists:

```css
.container {
  width: min(1160px, calc(100% - 2rem));
  margin: 0 auto;
}
```

Current active shell note:

- routed pages are placed inside `.content { padding: 32px; }`
- many active views define their own max widths and grids instead of relying on `.container`

---

## 🧠 Design Intent & Rules (AI Interpretation Layer)

This section defines how the UI should be interpreted and modified.

### 1. Highlighting Rule

If an element already has emphasis (color, position, or weight), do NOT add another layer of emphasis.

### 2. Icon Rule

Icons must:

- usually be monochrome
- stay small and functional
- use background containers only when the surrounding UI already establishes that pattern

### 3. Card Rule

- Avoid nesting cards inside cards
- Lists should be lightweight, not boxed
- Cards are currently used for dashboard panels, challenge cards, ranking panels, profile stats, notification items, and modals
- When adding new UI, match the local page pattern before introducing another card style

### 4. Hierarchy Rule

- Tier 1 → strongest contrast
- Tier 2 → structured but calm
- Tier 3 → minimal and quiet
- Hero image sections are allowed on current Dashboard and Challenges pages
- Operational controls should stay compact and readable

### 5. Motion Rule

- All animations must be subtle
- No bounce, no exaggerated motion
- Current motion is mostly hover lift, small translate, fade, modal transition, and toast slide/fade

### 6. Simplicity Rule

If something can be removed without losing meaning → remove it

### 7. Consistency Rule

All similar elements must:

- share spacing
- share sizing
- share interaction behavior

---

## Styling Flow & Dependencies

### Component Hierarchy & Style Inheritance

```
App.vue
  ├─ DefaultLayout.vue (Layout styles)
  │   ├─ Fixed Sidebar Navigation
  │   ├─ Sticky Route Header
  │   ├─ ToastShelf.vue
  │   └─ Main Content Area / RouterView
  │       ├─ RouterView (loads current page)
  │       │   ├─ DashboardView.vue
  │       │   │   ├─ PerformanceChart.vue
  │       │   │   └─ Hero/KPI/activity local styles
  │       │   ├─ RankingsView.vue
  │       │   │   └─ Local leaderboard + share-card styles
  │       │   ├─ ChallengesView.vue
  │       │   │   ├─ Tab buttons
  │       │   │   ├─ ChallengeCard.vue
  │       │   │   └─ Modal styles
  │       │   ├─ CreateChallengeView.vue
  │       │   │   ├─ PersonAvatar.vue
  │       │   │   └─ BaseButton.vue
  │       │   ├─ PlayView.vue
  │       │   │   └─ TennisScoreboard.vue
  │       │   ├─ MatchDetailsView.vue
  │       │   ├─ ProfileView.vue
  │       │   └─ NotificationsView.vue
```

### CSS Import Order

1. **Global Styles** (`main.css`):
   - `:root` CSS variables (all design tokens)
   - HTML/body resets
   - Reusable utility classes (`.container`, `.surface-card`, `.section-card`)

2. **Component Scoped Styles**:
   - Each `.vue` file has `<style scoped>` section
   - Uses global CSS variables via `var(--color-*)`, `var(--shadow-*)`
   - Scoped styles don't conflict with each other

3. **View-Level Styles**:
   - Each view file has scoped styles
   - Some active views use unscoped `<style>` blocks
   - Many active views import Poppins directly
   - Inherits components used within the route page

### Design Token System

**All colors, spacing, shadows centralize to CSS variables:**

```
src/assets/main.css ──► :root { CSS Variables }
                            ↓
                    All component files reference
                    var(--color-*), var(--shadow-*)
                    var(--radius), etc.
                            ↓
                    Single source of truth for design
```

**Example Flow:**

```
User clicks sidebar link
  ↓
.nav-link.active styles apply
  ↓
Uses pale green background and dark green text
  ↓
Style currently lives in DefaultLayout.vue
  ↓
Change DefaultLayout.vue to update active sidebar navigation
```

### No External CSS Framework Dependencies

- ✅ No Tailwind CSS
- ✅ No Bootstrap
- ✅ No CSS-in-JS libraries
- ✅ Custom CSS variables system
- ✅ Scoped component styles (Vue feature)
- ✅ Chart.js is used for the performance chart
- ✅ Some pages import Google Fonts via CSS `@import`

---

## Summary Table: Component-to-CSS Mapping

| Component / View        | File                                | Primary Classes                                      | Current Styling Source                                           |
| ----------------------- | ----------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| DefaultLayout           | `src/layouts/DefaultLayout.vue`     | `.layout`, `.sidebar`, `.nav-link`, `.header`        | Mostly local hex values plus Poppins                             |
| ToastShelf              | `src/components/ToastShelf.vue`     | `.toast-shelf`, `.toast`, `.toast--*`                | Local toast colors and fixed positioning                         |
| BaseButton              | `src/components/BaseButton.vue`     | `.base-button`, `.base-button--*`                    | Global tokens for accent, border, light, shadow                  |
| BaseInput               | `src/components/BaseInput.vue`      | `.field`, `.field__input`                            | Global tokens for border/text and local green focus glow         |
| PersonAvatar            | `src/components/PersonAvatar.vue`   | `.person-avatar`                                     | Global surface/text tokens                                       |
| ChallengeCard           | `src/components/ChallengeCard.vue`  | `.cc`, `.cc__*`, `.cc-btn`                           | Mostly local colors, Poppins, status-specific pills              |
| TennisScoreboard        | `src/components/TennisScoreboard.vue` | `.tennis-scoreboard`, `.tennis-scoreboard__*`      | Global tokens plus local left/right player button colors         |
| PerformanceChart        | `src/components/charts/PerformanceChart.vue` | `.performance-card`, `.chart-wrapper`, `.custom-tooltip` | Chart.js plus local chart/card styles                      |
| DashboardView           | `src/views/DashboardView.vue`       | `.dashboard`, `.hero`, `.kpi`, `.activity-item`      | Local image hero, glass cards, Poppins                           |
| RankingsView            | `src/views/RankingsView.vue`        | `.rankings`, `.leaderboard-*`, `.share-card-*`       | Local leaderboard and share modal styles                         |
| ChallengesView          | `src/views/ChallengesView.vue`      | `.challenges`, `.summary-row`, `.ch-tab`, `.modal`   | Local cards, tabs, hero image, modal styles                      |
| CreateChallengeView     | `src/views/CreateChallengeView.vue` | `.create-challenge`, `.section-card`, `.toggle-*`    | Global tokens mixed with local form styles                       |
| PlayView                | `src/views/PlayView.vue`            | `.play`, `.play__meta-card`, `.play__wrapper`        | Global section-card tokens and local layout                      |
| MatchDetailsView        | `src/views/MatchDetailsView.vue`    | `.match-details`, `.match-grid`, `.result-panel`     | Global tokens and local form styles                              |
| ProfileView             | `src/views/ProfileView.vue`         | `.profile`, `.profile__stats`, `.profile__card`      | Local Poppins profile styling                                    |
| NotificationsView       | `src/views/NotificationsView.vue`   | `.notifications-page`, `.notification-card`          | Local feed, badge, and type-icon styling                         |

---

## Color Scheme Reference

### Brand Colors

- **Primary Green:** #00b51a (actions, accents)
- **Secondary Green:** #008f15 (darker shade)
- **Accent Yellow:** #ffd33d (secondary highlights)
- **Clay Orange:** #ff7f32 (tennis theme)
- **Active App Green:** #00c853 appears often in route-level CSS

### Neutral Colors

- **Current Sidebar:** #ffffff with muted gray text
- **Legacy Dark Sidebar Token:** #0f1419 still exists as `--color-dark`
- **White Surfaces:** #ffffff
- **Light Gray Backgrounds:** #f7f8fa
- **Medium Gray Text:** #6d7a70
- **Current Layout Muted Gray:** #7b8794 appears often in route-level CSS

### Interactive States

- **Hover Elevation:** `var(--shadow-soft)`
- **Active Elevation:** `var(--shadow-strong)`
- **Focus Glow:** Green with opacity `rgba(0, 181, 26, 0.08)`
- **Current Sidebar Active:** `rgba(0, 200, 83, 0.05)` background with `#007a32` text

---

End of Styling Documentation
