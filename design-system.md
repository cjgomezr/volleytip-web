# Design System: VolleyTip

This file is the visual source of truth. With a mockup, the ui-reviewer
compares against the mockup; **without a mockup, it reviews against this
file**. Keep every rule concrete and verifiable. No "should look nice".

**Mockups live in `docs/mockups/`**, one PNG per screen and state, named
`<Pantalla>--<estado>.png` (see `docs/mockups/README.md` for the full table
and which epic owns each screen). That is where `write-ticket` points its
`Mockup:` field and where the ui-reviewer looks for its Mode A reference.

Every value below was read from the mockup sources in
`docs/mockups/source/*.dc.html`. They are exact, not estimated. The tokens
live in code in `src/app.css` (`@theme`); a new value is added here first and
there second. `src/design-tokens.test.ts` fails if the brand colors drift.

Two rules settle conflicts:

- Mockups rule on how things look. The SRD rules on how things behave. If they
  contradict, the SRD wins. Known differences are listed in
  `docs/mockups/README.md` ("Diferencias conocidas con el SRD").
- A screen with no mobile mockup is built from its desktop mockup plus this
  file (SRD, NFR-007).

## Tokens

### Color

The site is dark by default, with light zones (store, cart, checkout, admin).
There is no separate light theme and no user theme switch.

| Role                | Token            | Value     | Usage                                                              |
| ------------------- | ---------------- | --------- | ------------------------------------------------------------------ |
| Brand red           | `brand-red`      | `#FC0035` | Primary actions, accents in headings, error state                  |
| Brand indigo        | `brand-indigo`   | `#221761` | Cards and panels on dark zones, borders on dark                    |
| Brand night         | `brand-night`    | `#140A35` | Page background on dark zones; text on light zones and on red/lime |
| Brand lime          | `brand-lime`     | `#CDF980` | Announcement bar, highlights, success state, focus ring, hover     |
| Brand mist          | `brand-mist`     | `#D9E6E8` | Text on dark zones; page background on light zones                 |
| Muted text on dark  | `ink-muted`      | `#B3B0D4` | Secondary text and metadata on dark zones                          |
| Muted text on light | `ink-subtle`     | `#5B5680` | Secondary text and metadata on light zones                         |
| Surface on light    | `surface-light`  | `#FFFFFF` | Cards and inputs on light zones                                    |
| Divider on light    | `line-light`     | `#EEF4F5` | Dividers and table rows on light zones                             |
| Deep red            | `brand-red-deep` | `#B0002A` | Error text on light zones (red text on mist fails contrast)        |

Rules:

- Text on `brand-red` and on `brand-lime` is always `brand-night`, never
  white. White on `#FC0035` is 3.9:1 and fails AA.
- `brand-red` is the one accent for actions. `brand-lime` marks state and
  emphasis; it is not a second button color.
- Red as error and lime as success always come with an icon or text, never
  color alone.
- Never place text on a background with contrast below 4.5:1 (3:1 for text of
  24px or more).
- A new color is not invented in a ticket: it is added to this table first.

### Spacing

Scale read from the mockups: **4 / 8 / 10 / 12 / 14 / 16 / 20 / 24 / 28 / 32 /
48 / 64 px**. Every margin, padding and gap comes from this scale. Same
relationship means same spacing: all cards in a grid share one gap, and the
label-to-input distance is always 6px (the one exception to the scale, fixed
by the `.lb` rule of the mockups).

Layout: content is centered with a maximum width of 1280px and 24px of side
padding (16px under 390px).

### Typography

Two families, self-hosted (no request to Google Fonts):

- **Anton** for display text: page titles and section headings. Always
  uppercase, weight 400, line height 0.95.
- **Archivo** for everything else. Weights 400, 500, 600 and 700.

| Use                      | Family  | Size                      | Weight | Notes                                  |
| ------------------------ | ------- | ------------------------- | ------ | -------------------------------------- |
| Hero title               | Anton   | 72px desktop, 56px mobile | 400    | Uppercase, line height 0.95            |
| Page and section title   | Anton   | 44 / 48 / 56px            | 400    | Uppercase                              |
| Card and block title     | Anton   | 26 / 28 / 30 / 36 / 40px  | 400    | Uppercase                              |
| Lead text                | Archivo | 18 / 20px                 | 400    | Line height 1.5                        |
| Body                     | Archivo | 15 / 16px                 | 400    | Line height 1.5, max about 70ch        |
| Secondary text           | Archivo | 13 / 14px                 | 400    |                                        |
| Eyebrow and small labels | Archivo | 11 / 12px                 | 700    | Uppercase, letter spacing 0.08–0.12em  |
| Button                   | Archivo | 16 / 17px                 | 700    |                                        |
| Form label               | Archivo | 14px                      | 700    |                                        |
| Input text               | Archivo | 16px                      | 400    | Never under 16px (iOS zooms otherwise) |

Hierarchy comes from family, size and weight, never from color alone.
Mobile menu options are 30px (SRD, FR-002).

### Shape & elevation

Radius depends on the kind of element, and each kind has exactly one:

| Element                                 | Token            | Radius |
| --------------------------------------- | ---------------- | ------ |
| Buttons, chips, badges, language switch | `radius-pill`    | 999px  |
| Inputs, selects, small tiles            | `radius-control` | 12px   |
| Cards, keypad keys                      | `radius-card`    | 16px   |
| Large panels, modals, bottom sheets     | `radius-panel`   | 24px   |

No drop shadows on dark zones: depth comes from `brand-indigo` surfaces on
`brand-night`. On light zones a card is a white surface on `brand-mist`.
A 2px border in `brand-night` marks inputs on light zones.

### Core components (as drawn in the mockups)

| Component        | Spec                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| Primary button   | Height 54px, pill, background `brand-red`, text `brand-night` 700 17px                             |
| Secondary button | Height 50px, pill, 2px border `brand-mist`, transparent, text `brand-mist` 700 16px (on dark)      |
| Input            | Height 52px, radius 12px, 2px border `brand-night`, white background, 16px text, 16px side padding |
| Form label       | Block, 700 14px, 6px above the input                                                               |
| Eyebrow          | 700 12px, uppercase, letter spacing 0.12em                                                         |
| Announcement bar | Background `brand-lime`, text `brand-night` 700 13px uppercase, letter spacing 0.08em              |
| Icon button      | 44×44px circle, 2px border                                                                         |

Base components are built once in W1 on top of these specs. A ticket that
needs a component missing here adds it to this table in the same PR.

## Mandatory component states

Every interactive component ships with ALL of: default, hover, focus-visible
(a 3px `brand-lime` ring with 3px offset; on light zones the ring is
`brand-night`; never `outline: none` without replacement), active, disabled.
Every data view ships with: loading, empty (with helpful message + action),
error (with retry), and long-content (text 3× expected length must not break
layout).

## Responsive

Breakpoints to verify: **360px** (smallest supported, NFR-007), **390px**
(mobile mockups), **768px** (tablet), **1440px** (desktop mockups). Rules: no
horizontal scroll at any breakpoint; touch targets ≥ 44×44px on mobile, 48px
in the mobile menu (FR-002); primary action reachable without scrolling on
mobile when feasible.

To compare against a mockup, use its capture conditions: desktop at 1440px,
scale 1; mobile at 390px, scale 2; full page.

## Accessibility (hard requirements; axe-core enforces most)

Target: WCAG 2.2 AA (NFR-006).

- Contrast per the color rules above.
- Every input has a label; every image has alt; icon-only buttons have
  aria-label.
- Fully keyboard-navigable; logical tab order; focus trapped in modals;
  Escape closes menus and modals.
- No information conveyed by color alone.
- Images reserve their space (width and height set) so the page does not
  jump (FR-123).

## Heuristic review questions (ui-reviewer, no-mockup mode)

1. Is there exactly ONE clear primary action per screen?
2. Do all spacings come from the scale, and do equal relationships have equal
   spacing?
3. Is everything that can be aligned actually aligned (edges, baselines)?
4. Is the visual hierarchy right? Is the most important element also the
   most prominent?
5. Do all mandatory states exist and look intentional?
6. At 360px and 390px: no overflow, no horizontal scroll, targets ≥ 44px?
7. Does any text truncate, overlap or escape its container with real-length
   content?
8. Would this screen look coherent placed next to the mockups in
   `docs/mockups/` (same tokens, same radius per element kind, same spacing
   rhythm, Anton only for titles)?
