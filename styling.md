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
/* Primary Colors */
--color-primary: #00b51a (Green - Primary Action) --color-primary-strong: #008f15 (darker green)
  --color-secondary: [derived from primary] --color-accent: #ffd33d (Yellow - Secondary Accent)
  --color-accent-strong: #ffb400 (darker yellow) --color-accent-bright: #00b51a (bright green)
  --color-accent-support: #ffd33d (yellow support) /* Tennis Court Theme */ --color-clay: #ff7f32
  (Orange - Tennis Court Clay) /* Neutral Colors */ --color-text: #162218 (dark text)
  --color-text-soft: #425044 (softer text) --color-muted: #6d7a70 (muted/secondary text)
  --color-dark: #0f1419 (very dark - sidebar background) --color-dark-soft: #1a1a1a (dark variants)
  --color-light: #ffffff (white) /* Backgrounds & Surfaces */ --color-bg: #ffffff (main background)
  --color-bg-muted: #f7f8fa (muted background) --color-surface: #ffffff (card/surface background)
  --color-surface-muted: #fbfcfd (muted surface) --color-surface-soft: #f4f7f5 (soft surface)
  /* Borders */ --color-border: #e7ece8 (standard border) --color-border-strong: #d7dfd8
  (stronger border);
```

#### Shadow System

```css
--shadow-soft: 0 2px 8px rgba(0, 0, 0, 0.04) (hover state elevation) --shadow-strong: 0 6px 18px
  rgba(0, 0, 0, 0.06) (pressed state elevation);
```

#### Spacing & Typography

```css
--radius: 0.5rem (standard border radius) --radius-lg: 0.75rem (large border radius for cards);
```

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

**External Assets:** No external CSS frameworks. **All styling is internal** using CSS variables and scoped component styles.

---

## Navigation Architecture

### NavBar Component

**File:** `src/components/NavBar.vue`

#### Structure

The navbar is rendered in the main `App.vue` via the `DefaultLayout` component, appearing at the top of the application.

#### Styling Breakdown

```css
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  color: #ffffff;
  border-bottom: 4px solid rgba(245, 158, 11, 0.9); /* golden accent line */
}

.navbar__brand {
  display: flex;
  flex-direction: column;
}

.navbar__logo {
  font-size: 1.25rem;
  font-weight: 700;
  color: #ffffff;
  text-decoration: none;
}

.navbar__tagline {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.85);
}

.navbar__links {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.navbar__link {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.92);
  text-decoration: none;
  padding: 0.45rem 0.85rem;
  border-radius: 999px;
  transition:
    background 0.2s ease,
    color 0.2s ease;
}

.navbar__link--active,
.navbar__link:hover {
  background: rgba(255, 255, 255, 0.16); /* translucent white on hover/active */
  color: #ffffff;
}

.navbar__actions {
  display: flex;
  align-items: center;
}

.navbar__cta {
  background: rgba(245, 158, 11, 1); /* golden yellow button */
  color: #0f172a;
  border: none;
  padding: 0.55rem 1rem;
  font-weight: 700;
  cursor: pointer;
  border-radius: 999px;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.navbar__cta:hover {
  transform: translateY(-1px); /* subtle lift effect */
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.18);
}
```

#### Color Flow for Navbar

- **Background:** Green to Secondary gradient (`var(--color-primary)` to `var(--color-secondary)`)
- **Text:** White (`#ffffff`)
- **Active/Hover Link:** Translucent white overlay
- **CTA Button:** Golden yellow (`rgba(245, 158, 11, 1)`)

#### Responsive Behavior

```css
@media (max-width: 720px) {
  .navbar {
    justify-content: center; /* center alignment on mobile */
  }
  .navbar__links {
    justify-content: center;
    width: 100%;
  }
}
```

---

## Layout System

### DefaultLayout Component

**File:** `src/layouts/DefaultLayout.vue`

This is the **main layout wrapper** for all authenticated views. It includes the sidebar and shell structure.

#### Two-Column Grid Layout

```css
.layout {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 270px minmax(0, 1fr); /* sidebar + main content */
  background: var(--color-bg);
}
```

### Sidebar Component (Part of DefaultLayout)

**Location:** `src/layouts/DefaultLayout.vue` (scoped styles)

#### Styling Architecture

```css
.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.5rem 1rem;
  background: var(--color-dark); /* dark background */
  border-right: 1px solid var(--color-border);
}
```

**Key Design Elements:**

1. **Sidebar Brand/Logo**

```css
.sidebar__brand {
  padding: 0.25rem 0.35rem 0.75rem;
}

.sidebar__logo {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.sidebar__logo-text {
  display: block;
  color: var(--color-light); /* white text */
}

.sidebar__logo-copy {
  display: block;
  color: var(--color-light);
}
```

2. **Sidebar Logo Marks (SVG Circles)**

```css
.sidebar__logo-mark {
  position: relative;
  width: 2.5rem;
  height: 2.5rem;
}

.sidebar__logo-arc {
  position: absolute;
  border-radius: 999px;
}

.sidebar__logo-arc--accent {
  /* Yellow arc */
  inset: 0.15rem auto auto 0;
  width: 1.8rem;
  height: 1.8rem;
  border: 0.34rem solid var(--color-accent); /* yellow border */
  border-right-color: transparent;
  border-bottom-color: transparent;
  transform: rotate(-18deg);
}

.sidebar__logo-arc--warm {
  /* Orange arc */
  right: 0;
  bottom: 0.2rem;
  width: 1.25rem;
  height: 1.25rem;
  border: 0.32rem solid var(--color-clay); /* orange border */
  border-left-color: transparent;
  border-top-color: transparent;
  transform: rotate(12deg);
}
```

3. **Navigation Links**

```css
.sidebar__nav {
  display: grid;
  gap: 0.375rem;
}

.sidebar__link {
  display: grid;
  grid-template-columns: 2.35rem minmax(0, 1fr);
  gap: 0.75rem;
  align-items: center;
  padding: 0 12px;
  min-height: 40px;
  border-radius: 0.5rem;
  color: var(--color-light);
  border: 1px solid transparent;
  transition:
    background 0.12s ease-in-out,
    border-color 0.12s ease-in-out,
    color 0.12s ease-in-out;
}

.sidebar__link.router-link-active,
.sidebar__link:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: var(--color-light);
}

.sidebar__icon {
  width: 2.35rem;
  height: 2.35rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: var(--color-light);
}

.sidebar__link.router-link-active .sidebar__icon {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
}

.sidebar__link-copy {
  display: grid;
  gap: 0.08rem;
}

.sidebar__label {
  font-weight: 700;
  font-size: 0.94rem;
}
```

4. **Sidebar CTA (Call-to-action Box)**

```css
.sidebar__footer {
  margin-top: auto; /* pushes to bottom */
  display: grid;
  gap: 0.7rem;
}

.sidebar__cta {
  display: grid;
  gap: 0.25rem;
  padding: 1rem;
  border-radius: 1rem;
  background: linear-gradient(135deg, rgba(255, 211, 61, 0.16), rgba(255, 127, 50, 0.12));
  border: 1px solid rgba(255, 127, 50, 0.16);
}

.sidebar__cta-title {
  font-size: 0.95rem;
  font-weight: 700;
}

.sidebar__cta-copy {
  color: var(--color-text-soft);
  font-size: 0.84rem;
}
```

### Shell (Main Content Area)

```css
.shell {
  min-width: 0;
  display: grid;
  grid-template-rows: auto 1fr;
  background: var(--color-bg);
}
```

### Page Header (Inside Shell)

```css
.page-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.4rem 1.75rem;
  background: #ffffff;
  border-bottom: 1px solid var(--color-border);
}

.page-header__copy {
  min-width: 0;
}

.page-header__title {
  margin: 0;
  font-size: clamp(1.55rem, 2vw, 1.95rem); /* fluid typography */
  line-height: 1.15;
  letter-spacing: -0.04em;
}

.page-header__subtitle {
  max-width: 44rem;
  margin: 0.5rem 0 0;
  color: var(--color-muted);
  font-size: 0.95rem;
}
```

### Main Content Container

```css
.layout__main {
  min-width: 0;
  padding: 1.5rem 0 2rem;
  background: var(--color-bg);
}

.container {
  width: min(1180px, calc(100% - 2rem));
}
```

#### Layout Responsive Breakpoints

**Tablet (max-width: 1120px):**

```css
.layout {
  grid-template-columns: 1fr; /* single column */
}

.sidebar {
  position: relative;
  height: auto;
  border-right: none;
  border-bottom: 1px solid var(--color-border);
}

.sidebar__nav {
  grid-template-columns: repeat(3, minmax(0, 1fr)); /* horizontal nav */
}

.sidebar__footer {
  margin-top: 0;
}
```

**Mobile (max-width: 760px):**

```css
.sidebar {
  padding: 1rem;
}

.sidebar__nav {
  grid-template-columns: 1fr; /* back to vertical */
}

.page-header {
  flex-direction: column;
  align-items: start;
  padding: 1.1rem 1rem;
}

.layout__main {
  padding-top: 1rem;
}

.container {
  width: min(100%, calc(100% - 1rem));
}
```

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

### PlayerCard Component

**File:** `src/components/PlayerCard.vue`

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

Displays challenge information with action buttons.

```css
.challenge-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  padding: 1.25rem;
  display: grid;
  gap: 1rem;
  box-shadow: var(--shadow-soft);
  transition:
    transform 0.12s ease-in-out,
    box-shadow 0.12s ease-in-out;
}

.challenge-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-strong);
}

.challenge-card__identity {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.challenge-card__ladder {
  min-width: 4.5rem;
  padding: 0.65rem 0.8rem;
  border-radius: 0.5rem;
  background: rgba(255, 211, 61, 0.12); /* light yellow */
  color: #845f00; /* brown text */
  font-size: 0.8rem;
  font-weight: 800;
  text-align: center;
}

.challenge-card__title {
  margin: 0;
  font-size: 1rem;
  color: var(--color-text);
}

.challenge-card__details {
  display: grid;
  gap: 0.3rem;
}

.challenge-card__meta {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.92rem;
  line-height: 1.6;
}

.challenge-card__note {
  margin: 0.25rem 0 0;
  color: var(--color-text-soft);
  font-size: 0.9rem;
}

.challenge-card__actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
```

---

## View-Level Styling

### Dashboard View

**File:** `src/views/DashboardView.vue`

Multi-section layout with stats, pending actions, featured match, and activity feeds.

#### Main Grid Structure

```css
.dashboard {
  display: grid;
  gap: 2rem;
}
```

#### 1. Dashboard Intro Section

```css
.dashboard__intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.4rem;
}

.dashboard__greeting {
  margin: 0;
  font-size: 1.45rem;
  font-weight: 800;
}

.dashboard__subline {
  margin: 0.55rem 0 0;
  color: var(--color-muted);
  font-size: 0.95rem;
}

.dashboard__actions {
  display: flex;
  justify-content: flex-end;
}

.dashboard__action-button {
  border: none;
  border-radius: 0.5rem;
  padding: 0 14px;
  min-height: 38px;
  background: var(--color-accent-bright); /* green */
  color: var(--color-light);
  font-weight: 700;
  transition:
    transform 0.12s ease-in-out,
    box-shadow 0.12s ease-in-out;
}

.dashboard__action-button:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
}
```

#### 2. Stats Grid (3-Column)

```css
.stats-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.stat-card {
  padding: 1.4rem;
}

.stat-card--tier1 {
  background: var(--color-dark); /* dark background */
  color: var(--color-light);
  border-color: var(--color-dark-soft);
}

.stat-card__label {
  margin: 0;
  color: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.stat-card__value {
  margin: 0.85rem 0 0;
  font-size: 2rem;
  font-weight: 800;
}
```

#### 3. Dashboard Grid Section (2-Column)

```css
.dashboard-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.dashboard-panel {
  padding: 1.4rem;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.panel-header h2 {
  margin: 0;
  font-size: 1rem;
}
```

#### 4. Pending Actions List

```css
.action-list {
  display: grid;
  gap: 0.75rem;
}

.action-card {
  display: grid;
  gap: 0.35rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  background: var(--color-surface);
  text-align: left;
  transition:
    transform 0.12s ease-in-out,
    box-shadow 0.12s ease-in-out,
    border-color 0.12s ease-in-out;
}

.action-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
}

.action-card__title {
  font-weight: 700;
  color: var(--color-text);
}

.action-card__meta {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.action-card__cta {
  margin-top: 0.35rem;
  color: var(--color-accent-bright);
  font-weight: 700;
  font-size: 0.88rem;
}
```

#### 5. Featured Match Card

```css
.feature-card {
  display: grid;
  gap: 0.75rem;
}

.feature-card__status {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text);
}

.feature-card__copy {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.95rem;
}

.feature-card__button {
  justify-self: start;
  max-width: 14rem;
  border: 1px solid rgba(0, 181, 26, 0.14);
  border-radius: 0.5rem;
  padding: 0 14px;
  min-height: 38px;
  background: rgba(0, 181, 26, 0.08); /* light green */
  color: var(--color-accent-bright);
  font-weight: 700;
}

.feature-card__button:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
}
```

#### 6. Activity Grid (Recent Matches/Challenges)

```css
.activity-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.activity-list {
  display: grid;
  gap: 0.75rem;
}

.activity-item {
  display: grid;
  gap: 0.35rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  background: var(--color-surface);
  text-align: left;
  transition:
    transform 0.12s ease-in-out,
    box-shadow 0.12s ease-in-out,
    border-color 0.12s ease-in-out;
}

.activity-item:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
}

.activity-item__title {
  font-weight: 700;
  color: var(--color-text);
}

.activity-item__meta {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}
```

#### 7. Empty State Card

```css
.empty-panel {
  padding: 1rem;
  border-radius: 0.75rem;
  background: var(--color-surface-muted);
  color: var(--color-muted);
}
```

#### Dashboard Responsive Breakpoints

**Tablet (max-width: 1100px):**

```css
.stats-grid,
.dashboard-grid,
.activity-grid {
  grid-template-columns: 1fr; /* stack vertically */
}

.dashboard__intro {
  flex-direction: column;
}

.dashboard__actions {
  justify-content: stretch;
}

.feature-card__button {
  max-width: none;
}
```

---

### Rankings View

**File:** `src/views/RankingsView.vue`

Displays ladder standings and player challenge opportunities.

```css
.rankings {
  display: grid;
  gap: 2rem;
}

.rankings__summary-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.rankings__summary-card {
  padding: 1.25rem;
}

.stat-card--tier2 {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  transition:
    transform 0.12s ease-in-out,
    box-shadow 0.12s ease-in-out;
}

.stat-card--tier2:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
}

.rankings__kicker {
  margin: 0 0 0.35rem;
  color: var(--color-accent-support); /* yellow */
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.rankings__summary-card h2 {
  margin: 0;
  font-size: 1.2rem;
}

.rankings__summary-copy {
  margin: 0.45rem 0 0;
  color: var(--color-muted);
  font-size: 0.9rem;
}

.player-list {
  display: grid;
  gap: 1rem;
}
```

**Responsive:**

```css
@media (max-width: 900px) {
  .rankings__summary-grid {
    grid-template-columns: 1fr;
  }
}
```

---

### Challenges View

**File:** `src/views/ChallengesView.vue`

Tabbed interface for filtering challenges by status.

```css
.challenges {
  display: grid;
  gap: 2rem;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.tab-button {
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  padding: 0 14px;
  min-height: 38px;
  background: var(--color-surface);
  color: var(--color-muted);
  font-size: 0.9rem;
  font-weight: 600;
  transition:
    background 0.12s ease-in-out,
    border-color 0.12s ease-in-out,
    color 0.12s ease-in-out,
    transform 0.12s ease-in-out;
}

.tab-button:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-soft);
}

.tab-button--active {
  background: rgba(0, 181, 26, 0.08); /* light green */
  color: var(--color-accent-bright);
  border-color: rgba(0, 181, 26, 0.14);
}

.challenge-list {
  display: grid;
  gap: 1rem;
}

.empty-state {
  padding: 1.25rem;
  border-radius: 0.75rem;
  background: var(--color-surface-muted);
  color: var(--color-muted);
  text-align: center;
}
```

---

### Create Challenge View

**File:** `src/views/CreateChallengeView.vue`

Two-column layout for challenge creation form.

```css
.create-challenge {
  display: grid;
}

.challenge-panel {
  display: grid;
  gap: 2rem;
  grid-template-columns: 1fr 1.2fr; /* info card + form */
}

.challenge-info,
.challenge-form {
  padding: 1.25rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  transition:
    transform 0.12s ease-in-out,
    box-shadow 0.12s ease-in-out;
}

.challenge-info:hover,
.challenge-form:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
}

.subtitle {
  margin: 0;
  color: var(--color-accent-support); /* yellow */
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.78rem;
}

.challenge-info h2 {
  margin: 0.35rem 0 0;
  font-size: 1.25rem;
}

.challenge-copy {
  margin: 0.45rem 0 0;
  color: var(--color-muted);
  font-size: 0.92rem;
}

.field {
  display: grid;
  gap: 0.55rem;
}

.field__label {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-text);
}

.field__input {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  padding: 0.88rem 0.95rem;
  background: #ffffff;
  color: var(--color-text);
  font-family: inherit;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.field__input:focus {
  outline: none;
  border-color: rgba(0, 181, 26, 0.35);
  box-shadow: 0 0 0 4px rgba(0, 181, 26, 0.08);
}
```

---

## Responsive Design

### Breakpoint Strategy

The application uses a mobile-first responsive approach with CSS media queries at strategic breakpoints:

#### 1. **Tablet Layout (max-width: 1120px)**

- **Sidebar:** Changes from sticky vertical sidebar to horizontal navigation below header
- **Navigation:** 3-column grid layout
- **Grids:** 2-column layouts become single column

```css
@media (max-width: 1120px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .sidebar {
    position: relative;
    height: auto;
  }
  .sidebar__nav {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
```

#### 2. **Mobile Layout (max-width: 760px)**

- **Sidebar Navigation:** Back to single column
- **Page Header:** Flexbox direction changes to column
- **Containers:** Reduced side padding
- **Cards/Panels:** Adapt to narrower layouts

```css
@media (max-width: 760px) {
  .sidebar__nav {
    grid-template-columns: 1fr;
  }
  .page-header {
    flex-direction: column;
    align-items: start;
  }
  .container {
    width: min(100%, calc(100% - 1rem));
  }
}
```

#### 3. **NavBar Mobile (max-width: 720px)**

- **NavBar:** Centers content
- **Links:** Full width with justified centering

```css
@media (max-width: 720px) {
  .navbar {
    justify-content: center;
  }
  .navbar__links {
    justify-content: center;
    width: 100%;
  }
}
```

### Fluid Typography

The page header uses `clamp()` for responsive font sizing:

```css
.page-header__title {
  font-size: clamp(1.55rem, 2vw, 1.95rem);
}
```

**Meaning:**

- Minimum: 1.55rem
- Preferred: 2vw (2% of viewport width)
- Maximum: 1.95rem

### Flexible Container Width

```css
.container {
  width: min(1160px, calc(100% - 2rem));
  margin: 0 auto;
}
```

**Meaning:**

- Use 1160px max width, but never exceed 100% - 2rem padding
- Automatic horizontal centering

---

## 🧠 Design Intent & Rules (AI Interpretation Layer)

This section defines how the UI should be interpreted and modified.

### 1. Highlighting Rule

If an element already has emphasis (color, position, or weight), do NOT add another layer of emphasis.

### 2. Icon Rule

Icons must:

- be monochrome
- have no background container
- rely on spacing and alignment only

### 3. Card Rule

- Avoid nesting cards inside cards
- Lists should be lightweight, not boxed

### 4. Hierarchy Rule

- Tier 1 → strongest contrast
- Tier 2 → structured but calm
- Tier 3 → minimal and quiet

### 5. Motion Rule

- All animations must be subtle
- No bounce, no exaggerated motion

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
  │   ├─ NavBar.vue (embedded header)
  │   ├─ Sidebar (embedded navigation)
  │   └─ Main Content Area
  │       ├─ RouterView (loads current page)
  │       │   ├─ DashboardView.vue
  │       │   │   ├─ BaseButton (primary action)
  │       │   │   ├─ ChallengeCard (multiple)
  │       │   │   └─ Various stat cards
  │       │   ├─ RankingsView.vue
  │       │   │   └─ PlayerCard (multiple)
  │       │   ├─ ChallengesView.vue
  │       │   │   ├─ Tab buttons
  │       │   │   └─ ChallengeCard (multiple)
  │       │   └─ CreateChallengeView.vue
  │       │       ├─ BaseInput (form field)
  │       │       └─ BaseButton (submit)
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
   - Inherits components used within (NavBar, Cards, etc.)

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
User clicks navbar link
  ↓
.navbar__link--active styles apply
  ↓
Uses var(--color-primary) for background color
  ↓
Value comes from main.css (#00b51a)
  ↓
Change color in main.css, updates everywhere
```

### No External Dependencies

- ✅ No Tailwind CSS
- ✅ No Bootstrap
- ✅ No CSS-in-JS libraries
- ✅ Custom CSS variables system
- ✅ Scoped component styles (Vue feature)
- ✅ Only external dependencies: Vue 3, Vue Router, Pinia

---

## Summary Table: Component-to-CSS Mapping

| Component               | File                                | Primary Classes                                | CSS Variables Used                                                |
| ----------------------- | ----------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| NavBar                  | `src/components/NavBar.vue`         | `.navbar`, `.navbar__*`                        | `--color-primary`, `--color-secondary`, `--color-light`           |
| DefaultLayout (Sidebar) | `src/layouts/DefaultLayout.vue`     | `.sidebar`, `.sidebar__*`                      | `--color-dark`, `--color-light`, `--color-accent`, `--color-clay` |
| BaseButton              | `src/components/BaseButton.vue`     | `.base-button`, `.base-button--*`              | `--color-accent-bright`, `--color-light`, `--shadow-soft`         |
| BaseInput               | `src/components/BaseInput.vue`      | `.field`, `.field__*`                          | `--color-border`, `--color-text`, accent colors                   |
| PlayerCard              | `src/components/PlayerCard.vue`     | `.player-card`, `.player-card__*`              | `--color-surface`, `--color-border`, `--color-primary`            |
| ChallengeCard           | `src/components/ChallengeCard.vue`  | `.challenge-card`, `.challenge-card__*`        | `--color-surface`, `--color-accent`, `--shadow-soft`              |
| DashboardView           | `src/views/DashboardView.vue`       | `.dashboard`, `.stat-card`, `.dashboard-panel` | All color tokens, shadows                                         |
| RankingsView            | `src/views/RankingsView.vue`        | `.rankings`, `.player-card`                    | Color tokens for tier2 cards                                      |
| ChallengesView          | `src/views/ChallengesView.vue`      | `.challenges`, `.tab-button`                   | `--color-accent-bright`, accent colors                            |
| CreateChallengeView     | `src/views/CreateChallengeView.vue` | `.create-challenge`, `.challenge-panel`        | Surface colors, accent colors                                     |

---

## Color Scheme Reference

### Brand Colors

- **Primary Green:** #00b51a (actions, accents)
- **Secondary Green:** #008f15 (darker shade)
- **Accent Yellow:** #ffd33d (secondary highlights)
- **Clay Orange:** #ff7f32 (tennis theme)

### Neutral Colors

- **Dark Sidebar:** #0f1419
- **White Surfaces:** #ffffff
- **Light Gray Backgrounds:** #f7f8fa
- **Medium Gray Text:** #6d7a70

### Interactive States

- **Hover Elevation:** `var(--shadow-soft)`
- **Active Elevation:** `var(--shadow-strong)`
- **Focus Glow:** Green with opacity `rgba(0, 181, 26, 0.08)`

---

End of Styling Documentation
