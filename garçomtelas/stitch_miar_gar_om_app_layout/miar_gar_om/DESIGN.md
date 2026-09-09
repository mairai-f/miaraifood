---
name: MIAR Garçom
colors:
  surface: '#081421'
  surface-dim: '#081421'
  surface-bright: '#2e3a48'
  surface-container-lowest: '#040f1b'
  surface-container-low: '#101c29'
  surface-container: '#15202d'
  surface-container-high: '#1f2b38'
  surface-container-highest: '#2a3643'
  on-surface: '#d7e3f5'
  on-surface-variant: '#d3c5ab'
  inverse-surface: '#d7e3f5'
  inverse-on-surface: '#26313f'
  outline: '#9c8f78'
  outline-variant: '#4f4632'
  surface-tint: '#f8be00'
  primary: '#ffe5b2'
  on-primary: '#3f2e00'
  primary-container: '#ffc300'
  on-primary-container: '#6d5200'
  inverse-primary: '#785a00'
  secondary: '#fff0c4'
  on-secondary: '#3b2f00'
  secondary-container: '#fad100'
  on-secondary-container: '#6d5a00'
  tertiary: '#d4ebff'
  on-tertiary: '#00344d'
  tertiary-container: '#97d3ff'
  on-tertiary-container: '#005c85'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdf9a'
  primary-fixed-dim: '#f8be00'
  on-primary-fixed: '#251a00'
  on-primary-fixed-variant: '#5a4300'
  secondary-fixed: '#ffe171'
  secondary-fixed-dim: '#e9c400'
  on-secondary-fixed: '#221b00'
  on-secondary-fixed-variant: '#554600'
  tertiary-fixed: '#c9e6ff'
  tertiary-fixed-dim: '#89ceff'
  on-tertiary-fixed: '#001e2f'
  on-tertiary-fixed-variant: '#004c6e'
  background: '#081421'
  on-background: '#d7e3f5'
  surface-variant: '#2a3643'
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 26px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0.005em
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.03em
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.06em
  numeric-table:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 32px
    letterSpacing: -0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  space-2xs: 0.25rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.25rem
  space-xl: 1.5rem
  space-2xl: 2rem
  touch-target-min: 3rem
  touch-target-comfortable: 3.5rem
  screen-margin-mobile: 1rem
  screen-margin-tablet: 1.5rem
---

## Brand & Style

This design system targets high-tempo hospitality environments where waitstaff, runners, and floor managers require split-second situational awareness under varied lighting—from dim dining rooms to bright terrace shifts. The aesthetic is ultra-modern, high-contrast, and utilitarian, fusing technical dark-mode precision with tactical hospitality ergonomics. 

The design combines **Deep Tone Layering** with **Tactile Glass Accents**:
- **Speed & Legibility:** Zero visual ambiguity. Status badges, table indicators, and dish states pop immediately against deep space navy backdrops.
- **One-Thumb Operation:** Touch zones, order fire buttons, and table switches prioritize bottom-half mobile ergonomics, decreasing physical friction during peak service rushes.
- **Controlled Luminescence:** Warm amber and golden accents evoke culinary refinement without sacrificing the tactical clarity of mission-critical software.

## Colors

The palette leverages a strict dark hierarchy that reduces battery draw on handheld OLED devices and protects the server's night vision in ambient dining rooms.

- **Background (`#000814`)**: Pitch obsidian-navy canvas grounding all views.
- **Surface Navy (`#001d3d`)**: First-tier container backing for persistent sections, bottom sheets, and app navigation bars.
- **Elevated Navy (`#003566`)**: Interactive table cards, active order items, and floating modal elements.
- **Primary Amber (`#ffc300`) & Bright Gold (`#ffd60a`)**: The focal engines of the interface. Reserved for fire-order buttons, active filters, selected states, and unread call-waiter chimes.
- **Semantic Triad**:
  - `status-ready` (`#10b981`): Dishes ready for pickup, tables vacant, paid checks.
  - `status-prep` (`#0ea5e9`): Kitchen working, bar ticket running.
  - `status-alert` (`#ef4444`): Delays exceeding SLA thresholds, void requests, table calling urgently.

## Typography

Typography establishes instant information priority under quick-glance conditions.

- **Plus Jakarta Sans** delivers high legibility and geometric weight for table identities, currency totals, customer names, and quick-scroll category headers.
- **Inter** handles data-dense labels, modifier badges (e.g., "NO ONIONS", "MEDIUM RARE"), ticket timers, and micro-metrics.
- **Numeric Table (`numeric-table`)**: Specialized oversized style calibrated exclusively for floor table numbers and seat markers, visible from arm's length.
- **Tabular Figures**: All pricing, quantities, and elapsed service clocks must enable `font-variant-numeric: tabular-nums` to eliminate layout jank during live countdowns.

## Layout & Spacing

This design system uses a **mobile-first fluid grid** structured around rapid thumb reachability.

- **Floor Grid Rhythm:** 
  - Mobile (portrait phones up to 480px): 2-column or 3-column auto-flow grid for table layout overviews. 
  - Tablet/Terminal (768px+): Adaptive multi-column grid with a fixed 380px contextual ticket summary drawer.
- **Thumb-Zone Law:** High-impact execution actions (e.g., "Send to Kitchen", "Split Check", "Call Runner") reside strictly within the bottom 25% of the mobile viewport. Top zones are restricted to visual scanning (floor status, table search).
- **Physical Touch Target Minimums:** 48px (`3rem`) absolute floor for all interactive elements; primary order modifier buttons and quick-tally steppers scale to 56px (`3.5rem`) to eliminate mis-taps during rush hours.

## Elevation & Depth

Visual hierarchy uses **tonal layer nesting** accented by **subtle luminous glass outlines** rather than fuzzy ambient drop shadows, preventing visual mud on low-brightness displays.

- **Level 0 (Floor Canvas):** Solid `#000814`.
- **Level 1 (Section & Rails):** `#001d3d` with a top-edge 1px stroke of `rgba(255, 255, 255, 0.05)`.
- **Level 2 (Interactive Cards & Table Tiles):** `#003566` bordered by `rgba(255, 255, 255, 0.08)`. Hover or tap-down transitions inject an inner amber glow (`box-shadow: inset 0 0 0 1px #ffc300`).
- **Level 3 (Modals, Overlays & Sticky Trays):** Glassmorphic `#001d3d` backed by `backdrop-filter: blur(16px)` and a crisp outer border of `rgba(255, 255, 255, 0.12)`.
- **Alert Elevation:** Urgently delayed tickets utilize a pulsating perimeter shadow: `0 0 12px rgba(239, 68, 68, 0.35)`.

## Shapes

The interface balances sleek hardware-inspired curvature with dense spatial efficiency:

- **Cards & Sheets (`rounded-2xl` / 1rem to 1.5rem):** Floor cards, ticket summaries, and customer detail drawers utilize confident rounded borders that soften dense screen states.
- **Action Buttons & Badges (`rounded-xl` to Full Pill):** Primary action buttons utilize standard 0.75rem to 1rem radii for tactile affordance. Badges, timers, and status chips are full pills (`9999px`) to immediately distinguish informational status from tap-ready cards.

## Components

### Buttons
- **Primary CTA ("Send Order", "Pay Now"):** Background `#ffc300`, text `#000814` (weight 700), height 56px, roundedness `rounded-xl`. When pressed, drops to `#ffd60a` with a slight scale transform (`scale(0.98)`).
- **Secondary Action:** Transparent background with an elevated border (`rgba(255, 195, 0, 0.5)`), text `#ffd60a`.
- **Ghost/Tertiary:** Background `rgba(255, 255, 255, 0.05)`, text `#94a3b8`, used for secondary utility actions (e.g., "Add Note").

### Status Badges & Chips
- Compact pills (`label-sm`, uppercase, font-weight 700) featuring high-contrast colored backgrounds:
  - *Ready:* `#10b981` text over `rgba(16, 185, 129, 0.15)` backdrop.
  - *Delay/Urgent:* `#ef4444` text over `rgba(239, 68, 68, 0.18)` backdrop with an active dot indicator.
  - *Kitchen:* `#0ea5e9` text over `rgba(14, 165, 233, 0.15)` backdrop.

### Table Cards (Floor Plan)
- Built on Level 2 `#003566`.
- Features top-left bold table number (`numeric-table`), top-right elapsed occupancy timer, center guest count icon chip, and bottom status badge.
- Active table with ready kitchen items features a flashing golden accent border (`border-color: #ffd60a`).

### Order Line Items
- Clean list rows with 12px separation. Item count contained in a high-contrast pill (`#001d3d` inside elevated container), title in `#f8fafc` (`body-lg`), price right-aligned in tabular numbers. Modifiers rendered in `body-sm` (`#94a3b8`) with red or green prefix icons for omissions and additions.

### Quick Input & Steppers
- Quantity selectors (+ / -) feature high-surface buttons with 48px touch footprints to prevent order miscounts.
- Numeric keypads (pin authorization, bill split) use flat high-contrast grid layouts embedded directly in bottom-sheet panels.