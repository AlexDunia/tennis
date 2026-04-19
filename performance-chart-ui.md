# Performance Chart UI Walkthrough

## General Idea of the App

This is a **tennis sports management app** built with Vue.js, designed for players to track their performance, manage challenges, book courts, and compete in matches. It features a ranking system where players can challenge higher-ranked opponents, submit match results, and view analytics. The app emphasizes data-driven insights to help players improve, with a clean, professional UI that feels like a premium sports analytics platform. Key features include player profiles, match scheduling, booking systems, and detailed dashboards for tracking progress.

## Dashboard Structure

The dashboard (`DashboardView.vue`) is the main hub for logged-in players, structured as a vertical grid with 2rem gaps between sections. It provides an at-a-glance overview of the player's status and recent activity. Sections include:

1. **Hero Section**: Top banner with player name, rank, record (wins-losses), upcoming matches, and a "Start challenge" CTA button. Uses flexbox for left-right layout.
2. **KPI Section**: Four cards in a grid (Matches played, Wins, Losses, Win rate). Each card has a label and large metric number.
3. **Grid Section**: Two-column layout (1:1.2 ratio). Left: "Action required" panel (urgent tasks like pending challenges). Right: "Performance" panel (the chart we're detailing).
4. **Activity Section**: Bottom panel with a feed of recent matches and challenges, clickable for details.

The dashboard loads data on mount from stores (players, matches, challenges, bookings) and computes derived metrics like win rate.

## Data Shown on the Dashboard

The dashboard displays real-time data from Pinia stores:

- **Player Data**: Current player (name, rank, wins, losses) from `playerStore`.
- **Match Data**: Completed and scheduled matches from `matchStore` (10 mock matches added for demo).
- **Challenge Data**: Pending/awaiting challenges from `challengeStore`.
- **Booking Data**: Court bookings from `bookingStore`.
- **Computed Metrics**: Win rate (wins/total matches), upcoming matches count, activity feed (last 6 items).

Data is fetched asynchronously on load, with error handling. The Performance panel specifically uses `matchStore.matches` (filtered for completed ones) and `playerStore.currentPlayerId` to show personalized results.

## Performance Panel Overview

The Performance panel is the right column in the grid, styled with `panel--performance` (grid layout, 1.25rem gaps). It transforms raw match data into visual insights, answering "Am I improving?" with a hybrid chart. Data flows: matches → filtered/sorted → chart datasets → rendered visualization.

## Performance Chart UI Walkthrough

### 1. Overall Context and Placement in the App

- **Location**: The Performance Chart lives inside the "Performance" panel on the Dashboard view (`DashboardView.vue`). This panel is the second item in a 2-column grid layout (right column, spanning the full width of that column).
- **Panel Structure**: The panel uses a CSS class `panel--performance`, which applies a grid layout with 1.25rem gaps between sections. It has a subtle border, rounded corners (var(--radius-lg)), and a soft background (var(--color-surface)).
- **Dimensions**: The entire panel is responsive but typically ~400-500px wide (depending on screen size). The chart itself is 260px tall with 0.5rem top padding, making it feel spacious without wasting space.
- **Intuitiveness**: It's positioned after the KPI cards and action items, so users naturally scroll down to see their performance data. The title "Performance" with subtext immediately explains the purpose, reducing cognitive load.
- **Detail Level**: Every element serves a purpose—no fluff. The panel feels like a mini-analytics dashboard, not just a chart.

### 2. Header Section (Title, Subtext, and Metric Highlight)

- **Layout**: Uses `panel__header panel__header--stack`, which stacks elements vertically on the left and right-aligns a highlight metric. Flexbox with `justify-content: space-between` and `align-items: flex-start`.
- **Title**: "Performance" in a standard h2 tag. Font size: ~1.25rem (responsive), weight: 600, color: var(--color-text) (dark). Clean sans-serif font (inherits from app's base).
- **Subtext**: Below the title, in a `panel__subtext` class. Text: "Your match results over time. Track momentum, identify streaks, and adjust your play." Font size: 0.9rem, color: var(--color-muted) (grayish), line-height: 1.5, max-width: 28rem (prevents overflow on wide screens). This adds context without clutter.
- **Highlight Metric**: Right-aligned in `panel__highlight`. Shows "70%" (example win rate) in a large font (1.6rem, letter-spacing: -0.02em for elegance), followed by "win rate" in smaller text (0.8rem, muted color). This draws the eye immediately—users see their key stat first.
- **Visual Design**: Clean hierarchy (title → subtext → metric). No icons or decorations—just typography. Spacing: 0.35rem between title and subtext, 1rem gap from left content to metric.
- **Intuitiveness**: The subtext explains what the chart below represents, making it self-documenting. The right-aligned metric feels like a dashboard KPI.
- **Detail & Structure**: Well-structured for skimming—users can ignore subtext if they know the chart, or read it for context. No redundancy.

### 3. Chart Section (The Core Visualization)

- **Type**: Hybrid chart using Chart.js—combines bar chart (for individual match results) and line chart (for win rate trend). Rendered in a `<Chart type="bar">` component with mixed datasets.
- **Dimensions**: 260px height, full width of the panel (~400px), with 0.5rem top padding for breathing room. Maintains aspect ratio responsively.
- **Background & Canvas**: White/light background (inherits from panel). Canvas has a `cursor: crosshair` on hover, signaling interactivity. No grid lines on X-axis; subtle horizontal grid lines (rgba(0,0,0,0.05)) on Y-axis.
- **Axes**:
  - **X-Axis**: Labels are simple numbers ("1", "2", ..., "10") for match sequence. No grid, clean ticks in muted color (#6d7a70). Starts from 0, no padding.
  - **Y-Axis**: Single scale from 0% to 100% (max: 100). Ticks show percentages (e.g., "0%", "20%", "40%"). Muted color, subtle grid. This unifies the bars and line, making it intuitive.
- **Bars (Match Results)**:
  - **Data**: Each bar represents a match—1 (green) for win, 0 (orange) for loss. Bars are thin (barThickness: 14px) and rounded (borderRadius: 6px).
  - **Colors**: Wins: rgba(0, 181, 26, 0.35) (soft green). Losses: rgba(255, 127, 50, 0.35) (soft orange). Semi-transparent for subtlety.
  - **Visual Design**: Bars sit at the bottom of the chart, creating a "floor" effect. They vary in height but are uniform width, making patterns easy to spot (e.g., streaks of green).
  - **Intuitiveness**: Instantly clear—green = good, orange = bad. No legend needed; colors are universal.
- **Line (Win Rate Trend)**:
  - **Data**: Smooth curve (tension: 0.35) showing cumulative win rate (e.g., starts at 100%, dips to 60%, rises to 70%).
  - **Styling**: Green line (#00b51a), 2px thick. Points: 4px radius, 6px on hover. No fill.
  - **Visual Design**: Overlays the bars, creating depth. The curve tells a story—users can trace improvement or decline.
  - **Intuitiveness**: Line represents "progress over time," a common chart pattern. Hovering shows exact values.
- **Tooltips**:
  - **Trigger**: Hover over any bar or line point.
  - **Appearance**: Dark background (#0f1419), 12px padding, 6px border radius, no color boxes. Clean, professional.
  - **Content**: Title: Opponent name (e.g., "Opponent 5"). Body: "Win (6-2)" and "Win rate: 80%". Reads like a sentence—no jargon.
  - **Visual Design**: White text, subtle caret. Positioned dynamically to avoid edges.
  - **Intuitiveness**: Contextual—shows exactly what happened in that match. No overwhelming info; just essentials.
- **Interactivity**: Hover changes cursor to crosshair. No clicks (we removed that). Smooth, non-intrusive.
- **Drawing Quality**: High—Chart.js renders crisp vectors. Bars have subtle rounded edges for polish. Line is smooth but not overly curved. Grid is minimal (only Y-axis) to reduce noise. Overall, it looks like a premium analytics chart (e.g., from Google Analytics or Figma), not a basic library default.

### 4. Insights Section (Footer)

- **Layout**: Below the chart, in `panel__insights`. Flexbox with `justify-content: space-between`, 0.85rem font size, muted color. Thin top border (1px solid var(--color-border)) for separation.
- **Content**: "10 matches played" (left) and "2 upcoming matches" (right). Dynamic from store data.
- **Visual Design**: Small text, aligned to chart edges. Feels like metadata, not primary content.
- **Intuitiveness**: Provides quick context—total matches vs. future ones. Users can gauge activity level.
- **Detail**: No icons; relies on typography. Consistent with app's muted style.

### 5. Point Detail Overlay (If Active—Currently Disabled)

- **Note**: In the current code, click handlers are removed, so this doesn't appear. But for completeness:
- **Layout**: Slides in below the chart with a 0.2s animation (opacity + translateY).
- **Appearance**: Soft background (var(--color-surface-soft)), border (primary color), rounded corners. Header with opponent name and close button (×).
- **Content**: Grid of details (Result, Score, Win Rate). Green highlight for wins.
- **Visual Design**: Card-like, with subtle shadows implied by borders. Clean, modal-esque.
- **Intuitiveness**: Drill-down for curious users. Close button is obvious.

### 6. Overall Visual Design & Aesthetics

- **Color Palette**: Greens/oranges for data (nature-inspired, positive/negative). Muted grays for UI elements. No bright colors—feels professional and calming.
- **Typography**: Consistent with app—sans-serif, readable. Hierarchy via size/weight/color.
- **Spacing**: Generous (1.25rem gaps in panel, 0.5rem in details). No crowding.
- **Animations**: Subtle—tooltip fades, potential point detail slides. No flashy effects.
- **Responsiveness**: Scales well on mobile (chart shrinks, text stacks).
- **Theme Integration**: Uses CSS variables (e.g., --color-muted), so it adapts to light/dark themes.

### 7. Intuitiveness, Detail, Structure, and Drawing Quality

- **Intuitiveness**: 9/10. Users instantly understand "bars = individual matches, line = overall trend." Tooltips guide exploration. No learning curve—feels like native app features.
- **Detail Level**: High. Every pixel matters—rounded bars, smooth lines, contextual text. No generic chart; it's tailored to tennis matches.
- **Structure**: Excellent. Header → Chart → Insights creates a logical flow (explain → show → summarize). Modular CSS classes make it maintainable.
- **Drawing Quality**: 9/10. Chart.js + custom styling = polished. Bars aren't pixelated; line is fluid. Looks hand-drawn by a designer, not auto-generated. The hybrid approach adds visual interest without confusion.
- **Potential Improvements**: Add a legend if colors aren't obvious, or animate the line on load for wow-factor.

This UI transforms raw data into an engaging, story-driven experience. Users can "read" their performance like a book—seeing wins/losses as chapters and the line as the plot arc.
