# GORRA UI Psychology, Motion, and Visual Discipline

Canonical product-feeling guidance for GORRA. Last verified against the active repository on 2026-07-30.

Related documents: [product features and workflows](../APP_FEATURES.md) and [technical architecture](../ARCHITECTURE.md).

This document is normative about how GORRA should feel and factual about what the active UI currently implements. Labels mean **Implemented**, **Partially implemented**, **Prototype or mock**, **Planned**, **Legacy or inactive**, and **Needs verification** as defined in the other core documents.

## Reference Map

- `UI-TOKENS` - `src/assets/main.css`: shared palette, weights, hairline/radius/button/motion/focus tokens and base interaction rules.
- `UI-SHELL` - `src/layouts/DefaultLayout.vue`: sidebar, active club, fixed header, contextual tabs, mobile footer, content rail, route skeleton timing, navigation motion, account menus, and reduced motion.
- `UI-ROUTES` - `src/router/index.js`: route-aware title/subtitle, primary section, public/focused/immersive metadata.
- `UI-SKELETON` - `src/components/RoutePageSkeleton.vue`: destination-shaped loading variants and reduced-motion shimmer rule.
- `UI-FEEDBACK` - `src/components/EmptyState.vue`, `src/components/tournament/TournamentEmptyState.vue`, `src/components/ToastShelf.vue`, `src/stores/notification.js`: empty, error-adjacent, toast, feed, and accessibility patterns.
- `UI-CONTROLS` - `src/components/BaseButton.vue`, `src/components/BaseInput.vue`, `src/utils/formSafety.js`: baseline controls, focus, disabled state, and input safety.
- `UI-ICONS` - `src/components/friendly/FlowIcon.vue`, `src/components/compete/TennisNavIcon.vue`, plus inline monochrome SVGs in `src/layouts/DefaultLayout.vue`.
- `UI-COMPETE` - `src/components/compete/CompeteSectionShell.vue`, `src/views/compete/LadderView.vue`, `src/views/compete/ChallengesQueueView.vue`, `src/views/compete/TournamentsListView.vue`.
- `UI-FLOWS` - `src/views/FriendlyMatchFlowView.vue`, `src/views/ClubsView.vue`, `src/views/MemberOnboardingView.vue`, `src/components/friendly/MatchResultModal.vue`.
- `UI-ADMIN` - `src/views/ClubView.vue`, `src/views/SettingsView.vue`, `src/views/TournamentCreate.vue`, `src/views/TournamentCategory.vue`, `src/views/TournamentSchedule.vue`, `src/views/TournamentGallery.vue`, `src/components/tournament/TournamentMatchModal.vue`.
- `UI-TOURNAMENT` - `src/assets/tournament.css`, `src/components/tournament/BracketTree.vue`, `src/components/tournament/BracketTreeMobile.vue`, `src/components/tournament/StandingsTable.vue`, `src/components/tournament/MatchFixtureCard.vue`.
- `UI-PUBLIC` - `src/views/LandingView.vue`, `src/views/LoginView.vue`, `src/assets/landing.css`.

## The product feeling

GORRA should feel like a calm, well-run tennis club:

- Clear enough that a first-time member can act without instruction.
- Alive enough that intentional actions visibly register.
- Quiet enough that motion and decoration never compete with the task.
- Structured enough that location, club, role, status, and next step are easy to recover.
- Human enough that the interface sounds like a helpful club organizer.
- Safe enough that an administrator can predict the effect of a consequential action.
- Cohesive enough that member and admin screens are unmistakably one product.

The governing principle remains:

> **Quiet at rest. Alive on intent. Clear at every step.**

Polish comes from relationships - alignment, information order, language, spacing, state, permission, and feedback - rather than ornamental effects.

## Psychology by audience

### Member psychology

Within a few seconds, a member should understand:

1. Which club and product area are active.
2. Where they stand: ladder rank, tournament group/seed, current score, or match status.
3. What needs attention: challenge response, match, result review, or invitation.
4. Who they can play and why an option is enabled or unavailable.
5. What happens next after a choice.
6. How the action affected their position, match, invitation, or notification state.

Home provides the summary; Play starts/continues matches; Compete explains ladder/challenge/tournament state; Club explains shared context. Focused flows remove global chrome to reduce choice load, but their back action, progress, and final route must preserve orientation.

Implementation: `UI-SHELL`, `UI-COMPETE`, `UI-FLOWS`. Status: **Implemented** in structure, **Partially implemented** where product permissions or workflows break continuity.

### Admin psychology

Within a few seconds, an administrator should understand:

1. Which club is active and what their club role permits.
2. What needs attention: setup, members, rules, fixtures, scores, gallery, or tournament stage.
3. What changed after the previous action.
4. Which member, ladder, category, match, or setting is being edited.
5. Which actions are reversible, which need confirmation, and which publish durable local changes.
6. The scope and effect of a save, role change, invite rotation, result edit, walkover, or stage close.

Admin pages should increase information density without increasing anxiety. Use summaries before editors, clear section tabs, scoped save actions, validation next to the affected context, and explicit success copy. Never hide the active club while presenting management controls.

Implementation: `UI-SHELL`, `UI-ADMIN`, `UI-TOURNAMENT`. Status: **Implemented** as a local prototype; production-grade audit/undo language is **Planned**.

### One product, two operating modes

Members and admins share the same Home/Play/Compete/Club shell, active club selector, account controls, route header, colors, type weights, icons, tabs, lists, modals, and feedback. Admin capability should appear as an added layer of authority, not a different visual brand.

Continuity pattern:

```text
Active club and route header
-> personal or operational summary
-> list/table/form using shared domain names
-> role-appropriate action
-> modal or focused flow when concentration is needed
-> store/service state change
-> toast/notification/status update
-> return to the same shared club context
```

## Cognitive load and information order

Every screen should answer four questions in order:

1. Where am I?
2. What context am I operating in?
3. What matters now?
4. What can I safely do next?

Use this content order:

1. Route-aware header: page identity.
2. Section tabs or focused-flow progress: mode.
3. Personal/admin context: active club, position, stage, score, or summary.
4. Main task/data.
5. Secondary actions and explanation.
6. Loading, empty, disabled, error, success, or completed feedback in the position the content would occupy.

Do not repeat the fixed header's title as another large body title. Focused/public routes without the standard header may own their title in the body.

## Location awareness and one content rail

The shell is the spatial memory of GORRA.

- Desktop sidebar width is `220px`; standard content/header inset is `30px`.
- Tablet from 768-1023 px contracts the sidebar to `76px`.
- Mobile below 768 px hides the sidebar and uses a fixed four-item bottom navigation.
- Standard mobile header, content, and bottom-navigation inner area use an `85%` rail with `7.5vw` sides.
- Wide tournament workspaces may expand, and focused/public/immersive routes use full width by design.
- Tournament creation Players/Review steps may replace the global sidebar with a task-specific rail; the active step and exit remain explicit.

Align header copy, tabs, summaries, filters, cards, lists, forms, empty states, and primary actions to the same rail for that mode. A centered true empty state is allowed; arbitrary neighboring offsets are not.

Implementation: `UI-SHELL`, `UI-COMPETE`, `UI-TOURNAMENT`. Status: **Implemented** at the shared-shell level; individual view CSS still needs periodic overflow/alignment review.

## Route-aware headers, tabs, and navigation

The header owns page identity on standard routes. Route metadata supplies title/subtitle, while tournament routes can derive identity from the loaded tournament/category/match.

- Primary navigation: Home, Play, Compete, Club.
- Compete tabs: Ladder, Challenges, Tournaments, always three equal columns.
- Club tabs: Overview, Members, Rules, plus Manage for active-club managers.
- Account menu: Profile, Match history, Account settings, and manager-only Club settings.
- Mobile uses the same four primary destinations and active-state semantics.

Tabs express peer modes, not generic buttons. Selected state uses green text/indicator and `aria-current`; avoid oversized pill filters when a stable underline is clearer. Route changes must preserve active club and make the next title/subtitle accurate.

Implementation: `UI-ROUTES`, `UI-SHELL`, `UI-COMPETE`. Status: **Implemented**.

## Typography and human copy

### Typography

The canonical product voice uses the shared 400/500/600/700 weight vocabulary. Use bold sparingly for route/major section identity, semibold for labels/actions/card headings, medium for compact values, and regular for body/helper text. Routine UI should not depend on 800/900 weight.

Target direction: one approachable sans-serif family across the product, with Poppins as the established shell language. Current implementation is inconsistent:

- `main.css` body uses Inter/system.
- `DefaultLayout.vue` applies Poppins to the shell.
- `tournament.css` applies DM Sans with Poppins fallback.
- login/onboarding include Georgia for selected brand display text.
- several active views import Poppins independently.

Therefore “Poppins everywhere” is not a factual current claim. Unifying the active type stack is **Planned / Needs verification**; do not add another family.

### Human copy rules

- Use familiar words.
- Put one idea in each sentence.
- Start actions with direct verbs.
- Keep subtitles short.
- Use human status names such as “Waiting for a response,” not raw enum values.
- State the next step and, for consequential actions, the effect.
- Make errors useful: what happened, what remains safe, what to do next.
- Make empty states calm and specific.
- Make warnings clear without dramatizing.
- Do not expose endpoint, database, adapter, token, or stack language to users.
- Do not force slogans, SEO repetition, or motivational copy into operational screens.
- Use GORRA consistently; stale ShellTennis text is an implementation defect, not voice guidance.

Implementation: route copy in `UI-ROUTES`, focused/admin copy in `UI-FLOWS` and `UI-ADMIN`. Status: **Partially implemented** because some motivational, demo, and stale product copy remains.

## Color, spacing, surfaces, and depth

### Color roles

`UI-TOKENS` currently defines:

- White/near-white backgrounds and surfaces.
- Dark green-black primary text and muted green-gray support text.
- Bright green `#00b51a` and strong green `#008f15` for active/action/focus state.
- Yellow, amber, and clay as support/accent colors.
- Dark sidebar/workspace values for contrast.

Reserve green for selection, action, success, live/active emphasis, and focus. Do not turn every decorative object green. Danger/warning colors must communicate real consequence and never be the only cue.

### Spacing rhythm

Use whitespace to group before adding boxes. Standard controls are 44 px high; common card/inner radii are 10 px/7 px. Focused flows use the shared flow width/section spacing. Lists should have a stable row rhythm; forms should group label, input, help, and error as one unit.

### Surfaces, borders, shadows, radii

- Use the `0.5px` hairline token for quiet separation where supported.
- Use low-opacity or white surfaces only when they establish grouping.
- Use 10 px cards and 7 px inner/button geometry as the shared default.
- Shadows should be extremely subtle and should not make every row float.
- Hover may lift a clickable control by approximately 0.5 px; avoid dramatic elevation.
- Modals/lightboxes may use stronger depth because they establish a temporary layer.
- Pills are appropriate for compact status/count/filter choices, not every container.

Implementation: `UI-TOKENS`, `UI-SHELL`, `UI-TOURNAMENT`. Status: **Implemented** as tokens, **Partially implemented** because BaseButton/BaseInput and some views retain larger one-off radii/shadows.

## Controls, forms, lists, and modals

### Buttons

- Primary: one clear next/commit action per local decision area.
- Secondary: safe alternative or supporting action.
- Ghost: navigation, dismissal, or low-priority utility.
- Destructive: explicit verb, clear target, and confirmation when the change is hard to reverse.
- Disabled: visually distinct, `disabled`/`aria-disabled`, and accompanied by a reason when users cannot infer it.

Pressed state may scale to about `0.97`; hover is small; focus must remain visible. Icon-only controls require accessible names.

### Forms

Use persistent labels, sensible input types, short help, inline errors, and stable action placement. Keep user input when validation fails. Mark busy actions and prevent double submission. Admin forms should save by meaningful section when the screen contains independent domains.

### Lists and tables

Put identity first, then status/context, then the action. Stable columns improve scan speed. Current-player or active-club emphasis should not reorder data unexpectedly. On mobile, preserve meaning before density: stack metadata or use a purpose-built card/table variation.

### Modals

Use a modal when the user needs local focus without losing route context: match result, tournament score/schedule, image add/lightbox. The title must name the object/action; closing must be obvious; important saves report success in the underlying page. Do not hide a full multi-step workflow inside a modal.

Implementation: `UI-CONTROLS`, `UI-ADMIN`, `UI-TOURNAMENT`. Status: **Partially implemented**; reusable patterns exist alongside view-specific controls.

## Icon system

Use professional monochrome line SVGs from the existing visual language. `FlowIcon` covers guided/body concepts; `TennisNavIcon` covers Compete; the shell uses inline line SVGs for stable global destinations.

- Place icons before labels in actions/navigation and above true empty-state titles.
- Keep icon columns stable in repeated rows.
- Use approximately 16-20 px for compact controls and 20-24 px for primary navigation unless the component already establishes a size.
- Animate only when the parent is interactive or the icon confirms selection.
- Never use emoji/sticker icons, mixed filled/outline families, or decorative icons without meaning.

Implementation: `UI-ICONS`, `UI-SHELL`, `UI-COMPETE`. Status: **Implemented** in active shared paths.

## Motion language

Motion has four permitted jobs:

1. Explain movement between related navigation states.
2. Confirm an intentional action.
3. Reveal newly available content without disorienting the user.
4. Maintain continuity while data is loading.

### Tokens and timing

Active shared tokens include 90-110 ms press/short interactions, approximately 140 ms page transitions, 240 ms card changes, a calm ease curve, and a restrained spring curve. Navigation tracks run about 580 ms, clear around 620 ms, and destination icon swings run about 650 ms. Route skeleton shimmer is about 1.15 s.

These longer directional animations are personality moments, not defaults for every control.

### Current-to-destination navigation

Primary, contextual, and Compete navigation must animate from the actual previous index to the actual next index. Never restart from Home or the first tab. One low-opacity track explains the movement, the destination receives one swing/settle, and the interface becomes still.

### Content reveal

The shell can stagger the first few children after a route skeleton resolves. Keep translation/scale/opacity subtle and short. Do not stagger large data tables indefinitely or replay motion on every reactive update.

### Hover and pressed state

Clickable controls may lift minimally on hover and compress on press. Non-clickable cards/data must not animate as though actionable. General icon hover/tap motion must not fight the stronger selected-navigation swing.

### Reduced motion

When `prefers-reduced-motion: reduce` is active:

- remove navigation tracks, swings, menu transition, content stagger, and skeleton shimmer;
- preserve final selected, loaded, focused, and completed state;
- do not replace motion with a flashing color change.

Shared shell/skeleton/Compete/EmptyState and several active views implement this. Coverage across every view-specific animation is **Partially implemented**.

Implementation: `UI-TOKENS`, `UI-SHELL`, `UI-SKELETON`, `UI-COMPETE`.

## Loading and skeleton psychology

Loading feedback says, “GORRA knows where you are going and is preparing that structure.” Use route-shaped skeletons rather than a generic spinner for full pages.

- Match the destination's broad geometry: ladder rows, tournament cards, schedule rows, gallery tiles, match summary, onboarding steps, friendly choices, or scoreboard.
- Keep the skeleton on the same content rail as final content.
- Use the shared route overlay for navigation-level waiting; use local loading only for a contained async region.
- Do not show a populated empty state before loading is resolved.
- Set appropriate live/busy semantics where the loading state needs announcement.
- Disable shimmer for reduced motion.

The shell currently shows standard skeletons for 900 ms and focused/onboarding skeletons for 650 ms even when local data may already be ready. This produces predictable transitions but is a fixed-delay prototype, not measured network progress.

Implementation: `UI-SKELETON`, `UI-SHELL`. Status: **Implemented**.

## Empty, error, disabled, success, and completed states

### Empty

An empty state uses a line icon, a short title, one calm explanatory sentence, and at most one primary next action. Distinguish “nothing exists yet” from “filters found nothing” and “you do not have access.” Do not seed fake rows merely to avoid emptiness.

### Error

Name the failed task in human terms. Preserve user input. Offer Retry when the same operation is safe, Back when context is invalid, or an alternate manual action (for example, select text when clipboard is unavailable). Avoid raw exceptions and backend terminology.

### Disabled

Disabled controls must remain legible. When permission, eligibility, missing data, or workflow order causes the state, adjacent copy should explain it. A silent redirect to Dashboard is insufficient for a high-value action; the target page should display the access reason.

### Success

Use a concise toast for immediate confirmation. Add a persistent notification when the event matters after the moment. Update the affected row/summary before or with navigation so users can connect cause and effect.

### Completed

Replace input controls with score/winner/champion/confirmation context and the next useful action. Do not keep an enabled submit button after completion. If edits are allowed for an admin, label them as edits and show scope.

Implementation: `UI-FEEDBACK`, `UI-ADMIN`, `UI-COMPETE`. Status: **Implemented** in shared patterns; route-specific explanations are **Partially implemented**.

## Accessibility

Minimum standards:

- Semantic buttons/links for actions/navigation; no click-only generic containers.
- Visible `:focus-visible` ring using the shared green focus token.
- Accurate `aria-current`, `aria-expanded`, menu roles, labels for icon-only actions, and `aria-live` for important async status.
- Keyboard Escape closes shell menus; modals should preserve equivalent keyboard behavior and sensible focus movement.
- Color never carries status alone; pair it with text/icon/shape.
- Touch targets should meet the shared 44 px control height where practical.
- Text and controls must remain readable on photo/dark surfaces.
- Images need useful alt text or intentional empty alt when decorative.
- Content must not overflow horizontally at supported widths.
- Reduced motion must preserve clarity.

Current code has good focus tokens, semantic shell controls, live regions in several flows, and reduced-motion rules. A full focus-trap, contrast, screen-reader, and keyboard audit is **Needs verification**; do not claim WCAG conformance.

## Responsive behavior

### Desktop

Use sidebar + fixed header + aligned content rail. Dense admin/tournament information may use columns/tables and wide workspace modes. Keep the active club and route identity visible.

### Tablet

The sidebar contracts to icon emphasis at 768-1023 px. Avoid relying on hidden sidebar labels for location; the header and active state remain explicit. Convert wide forms/tables before text becomes cramped.

### Mobile

- Use the four-item bottom navigation and shared 85% rail.
- Preserve safe-area bottom padding.
- Keep header identity concise; Compete shows the route title/subtitle treatment.
- Stack forms/cards, but keep actions close to the content they affect.
- Use mobile bracket/table/card variants rather than shrinking desktop structures.
- Keep focused/onboarding/immersive flows full width when their own padding system is active.
- At extremely narrow watch-like widths (current rule below 162 px), the shell shows a watch-only state rather than broken navigation.

Breakpoints vary across views (480/520/560/620/640/700/720/768/800/860/900/980 px). Shared shell breakpoints are authoritative for chrome; domain breakpoints may adapt local content. Consolidation is **Planned**, not a reason to ignore existing active behavior.

Implementation: `UI-SHELL`, `UI-TOURNAMENT`, `UI-FLOWS`.

## Member/admin continuity checks

For any feature that both audiences touch, verify:

| Element | Member view | Admin view | Continuity requirement |
| --- | --- | --- | --- |
| Club | Name/role/context | Same name plus switch/manage authority | Never show an unlabeled admin workspace |
| Match | Opponent, schedule, score, next action | Same record plus edit/score/schedule actions | Status and player names must match |
| Tournament | Placement, fixture, standings, champion | Same event plus creation/progression controls | Admin actions update member-facing data immediately |
| Challenge | Sent/received and participant actions | Same participant behavior when admin is playing | Admin privilege does not silently bypass participant rules |
| Feedback | Human toast/notification | Same language plus scope/effect for risky actions | One status vocabulary across surfaces |
| Navigation | Home/Play/Compete/Club | Same shell plus Manage/create controls | Capability appears as addition, not a new brand |

## Anti-patterns to reject

- Duplicate route title/subtitle in the body.
- Header, tabs, summary, and rows on unrelated horizontal rails.
- Static “GORRA” header where route identity is needed.
- Active club hidden during an admin operation.
- Permission represented only by hidden UI when the service requires enforcement.
- Navigation motion starting from the wrong tab or replaying continuously.
- Looping bounce, swing, shimmer, or decorative motion.
- Emoji, sticker icons, mixed icon families, or unlabeled icon-only actions.
- Heavy shadows, thick opaque card stacks, excessive pills, or oversized typography.
- Hover motion on non-clickable data.
- Error text that exposes code/API/storage details.
- Empty states without an icon, explanation, or safe next step.
- Generic skeletons unrelated to destination geometry.
- Shimmer/stagger that ignores reduced motion.
- Destructive or publishing action without scope/effect/confirmation.
- Forced slogan/SEO copy inside operational UI.
- New one-off colors, radii, shadows, weights, or fonts when an active token/pattern fits.
- Presenting prototype localStorage behavior as secure, synced, or production-ready.

## Implementation checklist

Before changing a GORRA screen:

1. Confirm the active route/view and whether it is public, standard, focused, immersive, or wide.
2. Read its header title/subtitle and primary/context section.
3. Identify actor, active club, permission source, domain record, current state, and next valid transition.
4. Keep all major content on the mode's shared rail.
5. Reuse active tokens, icons, controls, empty states, skeletons, and feedback.
6. Design loading, empty, filtered-empty, error, disabled, success, completed, hover, pressed, focus, mobile, and reduced-motion behavior.
7. If the action is consequential, state scope/effect and add confirmation or a safe reversal where the product supports it.
8. Verify the mutation changes the same data the next member/admin screen reads.
9. Check keyboard access, accessible names, live feedback, contrast, and overflow.
10. Confirm the interface returns to rest after feedback.

## Current implementation mismatches

- Typography is mixed (Inter, Poppins, DM Sans, selected Georgia usage); target unification **Needs verification**.
- BaseButton/BaseInput geometry does not fully match the newer 7 px/10 px system.
- Some active screens retain one-off styling and motivational/demo copy.
- Player onboarding reports success without establishing shared club context.
- Play hub offers player continuation while the routed scoreboard is manager-gated.
- Some permission failures redirect rather than explaining the disabled action in place.
- Fixed skeleton delay is not tied to actual data readiness.
- Reduced-motion coverage is strong in shared components but not proven for every view animation.
- No completed accessibility audit establishes conformance.

These are documented facts, not permission to create another parallel design system.

## Final standard

The finished GORRA experience should leave a member thinking:

- “I know where I stand.”
- “I know what needs attention.”
- “I know who I can play and what happens next.”
- “GORRA noticed my action and showed the result.”

It should leave an administrator thinking:

- “I know which club and record I am changing.”
- “I know what needs attention.”
- “I can tell what is safe to edit.”
- “I understand the effect of this decision.”

For both audiences, the lasting feeling is the same: **quiet at rest, alive on intent, clear at every step.**
