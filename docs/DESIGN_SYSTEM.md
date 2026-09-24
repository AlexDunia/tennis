# GORRA Design System

This document is the implementation contract for the visual system in
`src/assets/design-system.css`. The goal is a calm, legible tennis product:
one primary green, understated surfaces, clear hierarchy, and no decorative
variation that obscures a player's next action.

## Foundations

| Concern | Rule | Token / utility |
| --- | --- | --- |
| Page width | Full workspaces may use 1200px; reading and forms should stop at 860px. | `.ds-page`, `.ds-page--narrow` |
| Body copy | 15px, 1.6 line-height, never wider than 68 characters in a heading group. | `--type-body`, `--measure-copy` |
| Hierarchy | One page title, section titles for groups, card titles for individual items, muted metadata last. | `--type-page-title` through `--type-meta` |
| Spacing | Use the four-point rhythm; default group gaps are 16px and sections are fluid 28-56px. | `--space-*`, `.ds-stack`, `.ds-section` |
| Radius | 8px small elements, 12px controls, 16px cards, pill only for tags and avatars. | `--radius-*` |
| Elevation | Borders group; a quiet shadow lifts a card; strong or floating shadows are only for menus and dialogs. | `--shadow-*` |
| Actions | 44px primary controls, 36px compact controls, green is reserved for primary action and selected state. | `--app-control-*` |

## Building a screen

Start a new operational screen with `.ds-page`, create groups with
`.ds-section`, and use `.ds-page-heading` or `.ds-section-heading` for a title
plus supporting copy. `.ds-card` is the default card; use `.ds-card--raised`
only where elevation communicates clickability or priority.

Use `.ds-eyebrow` for terse category labels, `.ds-mono` for scores, ranks, and
dates, and `.ds-prose` for long-form guidance. Do not introduce a one-off font
family, shadow, or border-radius in route CSS.

## Status and accessibility

Use the semantic success, warning, danger, and info tokens rather than inventing
feature-local status colors. Every interactive element must retain the shared
focus ring, and animation must stay usable with reduced motion enabled.

## Existing surfaces

Club, Compete, Ladder, and Tournament CSS keep their feature-specific markup,
but their theme variables now alias the core tokens. This preserves specialized
layouts while making type, color, surfaces, controls, and cards feel like one
product.
