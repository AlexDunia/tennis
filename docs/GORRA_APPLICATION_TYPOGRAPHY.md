# GORRA application typography

This is the shared type and vertical-rhythm standard for player, club-admin, and co-admin experiences. It applies to the fixed application shell, Compete pages, Play pages, club management, cards, tables, lists, dialogs, and creation flows.

## Foundation

- App UI: `Inter`, with `Avenir Next` and `Segoe UI` fallbacks.
- Application shell: currently inherits the historical `Poppins` declaration in `DefaultLayout`. New shell work should move toward the app UI stack unless a deliberate brand distinction is approved.
- Heading weight: 700.
- Card, row, label, and action weight: 600.
- Body weight: 400.
- Heading line-height: 1.2.
- Body line-height: 1.65.
- Heading tracking: `-0.025em`.
- Eyebrow tracking: `0.1em`, uppercase.

The shared CSS tokens live in `src/assets/main.css`. Use the token or utility class before adding a one-off size.

## Type roles

| Role             | Token or class                                      | Recommended treatment                   | Spacing                            |
| ---------------- | --------------------------------------------------- | --------------------------------------- | ---------------------------------- |
| Page title       | `--type-page-title`, `.type-page-title`             | 28–40px, 700, tight tracking            | 9px to description                 |
| Page description | `--type-page-description`, `.type-page-description` | 14px, muted, 1.65 line-height           | Belongs in the same heading group  |
| Section title    | `--type-section-title`, `.type-section-title`       | 20px, 700                               | 7–9px to supporting copy           |
| Eyebrow          | `.type-eyebrow`                                     | 10–11px, 600, uppercase, green or muted | 5–7px to title                     |
| Card title       | `--type-card-title`, `.type-card-title`             | 16px, 600                               | 6px to description or metadata     |
| Card description | `.type-body` or component-scoped body copy          | 12–14px, muted, 1.55–1.65               | Keep inside the card heading group |
| List-row title   | `--type-row-title`, `.type-row-title`               | 14px, 600                               | 6px to row metadata/status         |
| Metadata/status  | `--type-meta`, `.type-meta`                         | 11px, regular or 600 for status         | Never touch the title baseline     |
| Button/action    | shared button classes                               | 13px, 600, one-line label               | 7px icon gap; 44px minimum height  |

Use `.type-heading-group` for a title-and-description block and `.type-row-copy` for a row title plus status/metadata. These utilities encode the shared 9px and 6px rhythm.

## Writing and layout rules

1. A page title describes the destination; the description explains what the user can do there.
2. An eyebrow supplies context, not a second title. Examples: “Club Ladder”, “Match details”, and “Final result”.
3. Status text belongs below or beside a row title with at least 6px separation. Do not compress title and “pending”, “scheduled”, or other state labels into a 2px gap.
4. Buttons use sentence case and an action verb: “Send challenge”, “Confirm schedule”, “Start match”.
5. Destructive actions use explicit nouns: “Cancel challenge” and “Decline challenge”, not only “Cancel” or “No”.
6. Supporting paragraphs should normally stay below 70 characters per line on wide layouts.

## Current intentional exceptions

- Tournament hero titles may grow to 46px because they act as editorial discovery headers, while tournament creation steps remain capped at 34px for task focus.
- Immersive Play and onboarding flows use their own focused-flow scale and spacing. They should preserve the same hierarchy, but do not have to use the shell’s page-title size.
- Live scoreboard numerals are functional display data and may be substantially larger than the application type scale.
- Tournament state badges, Ladder ranks, and compact navigation labels may use 9–10px type when their meaning is also conveyed by placement or an accessible label.

## Inconsistencies to retire

- The shell currently declares `Poppins` while the application foundation uses `Inter`. Treat this as legacy, not a precedent for new components.
- Older views mix `rem`, `px`, and bespoke heading sizes. Migrate them when touched; avoid a risky global rewrite.
- Some historical tournament and list-row groups used 2–3px between titles and descriptions/status. New and updated screens use 6–10px depending on hierarchy.
- Legacy button classes sometimes use 11–12px labels or 38px heights. Primary user actions should use the shared 13px/44px standard unless the control is explicitly compact.

## Review checklist

- Page title and description form one clear group.
- Section and card headings do not compete with the page title.
- Row status has at least 6px separation from its title.
- Metadata is visually quieter than body copy.
- All actions meet the 44px shared minimum unless intentionally compact.
- The same role looks consistent for admin, co-admin, and player routes.
- Mobile wrapping preserves hierarchy without truncating the only explanation of an action.
