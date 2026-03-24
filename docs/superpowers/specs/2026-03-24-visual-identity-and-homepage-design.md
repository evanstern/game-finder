# Visual Identity & Homepage Design Spec

## Overview

Establish the visual identity for Game Finder — logo, favicon, color palette, homepage layout, and responsive behavior. The aesthetic is **playful & thematic** with a classic adventure feel: navy & amber palette, map-themed backgrounds, and tabletop game iconography woven into the typography.

This redesign replaces the current warm-brown/gold theme (Cinzel + DM Sans fonts, `#0f0d0b` background, `#b8922e` primary) with a navy & amber adventure-map theme.

## Color Palette

All colors defined in hex. Implementation should use hex values in `globals.css` (matching the existing pattern).

### Primary Colors

| Token | Hex | Usage |
|-------|-----|-------|
| Navy (deep) | `#0a1628` | Primary background, darkest tone |
| Navy (mid) | `#132240` | Gradient endpoints, card backgrounds |
| Navy (light) | `#1a2d4a` | Subtle elevated surfaces |
| Amber (primary) | `#ffbf47` | Primary accent, CTAs, logo, highlights |
| Amber (dark) | `#d4a030` | Hover states, pressed buttons |
| Amber (glow) | `rgba(255,191,71,0.06)` | Background radial glow |

### Full Semantic Token Map

Replaces all existing tokens in `globals.css :root`. Every token the current theme defines gets a new value:

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#0a1628` | Page background |
| `--foreground` | `#e8edf5` | Primary text (slightly warm white) |
| `--card` | `#0f1d35` | Card/panel backgrounds |
| `--card-foreground` | `#e8edf5` | Text on cards |
| `--popover` | `#0f1d35` | Popover backgrounds |
| `--popover-foreground` | `#e8edf5` | Text in popovers |
| `--primary` | `#ffbf47` | Buttons, links, accents |
| `--primary-foreground` | `#0a1628` | Text on amber backgrounds |
| `--secondary` | `#132240` | Secondary backgrounds |
| `--secondary-foreground` | `#e8edf5` | Text on secondary backgrounds |
| `--muted` | `#132240` | Muted backgrounds |
| `--muted-foreground` | `#7a8ba3` | Secondary/muted text |
| `--accent` | `#1a2d4a` | Accent backgrounds |
| `--accent-foreground` | `#e8edf5` | Text on accent backgrounds |
| `--destructive` | `#c44545` | Error states (unchanged) |
| `--destructive-foreground` | `#fde8e8` | Error text (unchanged) |
| `--border` | `rgba(255,191,71,0.15)` | Card/input borders |
| `--input` | `rgba(255,191,71,0.15)` | Input borders |
| `--ring` | `rgba(255,191,71,0.3)` | Focus rings |

### Tag/Chip Colors

- Background: `rgba(255,191,71,0.1)` with `rgba(255,191,71,0.15)` border
- Text: Amber primary

## Typography

### Font Migration

**Remove** the Google Fonts import for Cinzel and DM Sans. Replace with:
- `--font-body`: `system-ui, -apple-system, sans-serif` (body text, logo text)
- **Remove** `--font-display` and the `.font-display` utility class entirely

The logo wordmark uses `system-ui` sans-serif. No custom fonts are needed — the sword/die SVG elements provide all the visual distinctiveness.

All existing uses of `font-display` class in `nav.tsx` and `home.tsx` will be replaced as part of this work. The `login.tsx` and `signup.tsx` files also use `font-display` — once the class is removed from CSS, these will silently fall back to the body font (`system-ui`), which is the intended outcome. No changes needed in those files.

### Scale

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Hero logo text | 48px | 700 | White (`game`) + amber (`finder`) |
| Nav logo text | 18px | 700 | White (`game`) + amber (`finder`) |
| Subtitle | 14px | 400 | `var(--muted-foreground)` |
| Tagline | 11px | 400 | Amber 50% opacity, uppercase, 3px letter-spacing |
| Section label | 10px | 400 | Amber 50% opacity, uppercase, 3px letter-spacing |
| Body text | 14px | 400 | `var(--foreground)` |
| Button text | 13px | 700 | `var(--primary-foreground)` on amber |
| Tag text | 11px | 400 | Amber |
| Footer text | 9px | 400 | `rgba(255,255,255,0.2)` |

## Logo

### Wordmark: `g🎲mef⚔️nder`

Lowercase sans-serif (`system-ui`) wordmark with two character substitutions:

1. **"a" → Tilted D6**: The letter "a" in "game" is replaced by a small amber d6 die showing 5 pips (quincunx pattern). The die is rotated ~5 degrees counter-clockwise with a subtle drop shadow. Navy pips on amber background.

2. **"i" → Zelda-style Sword**: The letter "i" in "finder" is replaced by a vertical sword with:
   - Silver blade (`#c0c8d4`) with a lighter highlight edge (`#dce3ed`)
   - Amber crossguard (`#ffbf47`)
   - Brown grip (`#8B5E3C`) with lighter band details (`#a06e42`)
   - Amber pommel with navy center dot

3. **Color split**: "game" (including the die-a) renders in white. "finder" (including the sword-i) renders in amber (`#ffbf47`).

4. **Dice pip divider** (hero size only): Below the wordmark, three amber dots (●●●) flanked by thin amber lines serve as a decorative separator.

### Logo Sizes

| Context | Font Size | Die Size | Sword Height |
|---------|-----------|----------|--------------|
| Hero (large) | 48px | 32×32px | ~50px |
| Nav bar | 18px | 13×13px | ~20px |

### Logo Component

Create `packages/ui/src/components/logo.tsx`:
- Accepts a `size` prop: `"sm"` (nav) or `"lg"` (hero)
- Renders inline SVG for the sword and die elements
- Uses CSS variables for colors so it adapts to theme context
- The die and sword are SVG, the surrounding text is actual text for accessibility
- The dice pip divider only renders at `"lg"` size

## Favicon

### "gf" Monogram on Tilted Die

- Shape: Rounded square (amber `#ffbf47`), rotated ~5 degrees
- Content: Bold "gf" initials in navy (`#0a1628`), `system-ui` font, weight 900
- Detail: At 32px+, subtle navy corner pips (top-left, bottom-right) at 30% opacity
- Sizes to generate: 16×16, 32×32, 180×180 (Apple touch), 192×192 (Android)
- On white backgrounds: Die shape renders without additional border (amber is high-contrast on white)

### Favicon Files

- Master SVG: `apps/web/public/favicon.svg`
- Generated PNGs: `apps/web/public/favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png` (180px), `android-chrome-192x192.png`
- Add `<link>` tags in `apps/web/app/root.tsx` for all sizes

## Homepage Layout

### Nav Bar

The existing `Nav` component (`apps/web/app/components/nav.tsx`) is updated in-place:
- Replace the D20Icon + "Game Finder" text with the `<Logo size="sm" />` component
- **Preserve existing auth-aware behavior**: show username + Log Out when authenticated, show Log In + Sign Up when not
- Restyle to match new theme: `bg-card/80 backdrop-blur-md` stays, border color picks up new `--border` token automatically
- The Sign Up button inherits new primary amber from theme tokens
- Add "Browse" and "Post a Game" links (these can link to `#` for now — the routes don't exist yet)

### Homepage Structure (top to bottom)

The existing `home.tsx` is rewritten. It currently has two states (authenticated / unauthenticated). Both are redesigned:

**Unauthenticated state:**

```
┌─────────────────────────────────────┐
│  Nav Bar (existing, restyled)       │
├─────────────────────────────────────┤
│  [Map Background]                   │
│                                     │
│         [Large Logo]                │
│          ● ● ●                      │
│    "Navigate to tabletop            │
│     adventures in your area"        │
│    EVERY GAME NIGHT IS A NEW QUEST  │
│                                     │
│   ┌─────────────────────────┐       │
│   │ 📍 Zip    🔍 Game type │       │
│   │ [  Begin Your Search  ] │       │
│   └─────────────────────────┘       │
│                                     │
│   [⚔ D&D 5e] [🎲 Board Games]     │
│   [⚔ Warhammer] [🃏 MTG]          │
│   [🎲 Pathfinder]                  │
│                                     │
│    📍12  📍23  📍8  📍5            │
│                                     │
├─────────────────────────────────────┤
│  HOW IT WORKS                       │
│  🔍 Search → 📜 Browse → ⚔ Join   │
├─────────────────────────────────────┤
│  © 2026 gamefinder    About|Privacy │
└─────────────────────────────────────┘
```

**Authenticated state:**

Same layout, but the hero text changes:
- Tagline becomes "Welcome back, {displayName}"
- Subtitle becomes "Find your next game night"
- Search card and everything below remain the same (authenticated users also want to search)

### Background Treatment

- **Grid lines**: 32×32px CSS grid using `background-image` with `linear-gradient`, `rgba(255,191,71,0.05)` — evokes a treasure map / adventure grid
- **Radial glow**: Centered behind hero content, amber at 6% opacity, elliptical, ~500×400px
- **Compass rose**: Bottom-right corner, 70×70px circle with cardinal points (N/S/E/W) and crosshair lines, all at very low opacity (`rgba(255,191,71,0.12–0.3)`)
- **Gradient**: Top-to-bottom `linear-gradient(180deg, #0a1628 0%, #132240 60%, #0d1a30 100%)`

### Search Card

- Floating card: `rgba(255,255,255,0.04)` bg, `rgba(255,191,71,0.15)` border, 12px radius
- Two input fields side by side:
  - Zip code (with 📍 icon prefix), placeholder: "Zip code"
  - Game type (with 🔍 icon prefix), placeholder: "D&D, board games, Warhammer..."
- Full-width amber CTA button: "Begin Your Search"
- Max width: 420px, centered

**Search behavior**: Clicking "Begin Your Search" navigates to `/search?zip={zip}&q={query}`. The `/search` route does not exist yet — it will 404 or show a "coming soon" message. No input validation is needed at this stage; this is visual scaffolding. Popular tag clicks populate the game type field (do not navigate directly).

### Popular Tags

Horizontal row of pill-shaped tags with specific emoji mappings:

| Tag | Emoji |
|-----|-------|
| D&D 5e | ⚔ |
| Board Games | 🎲 |
| Warhammer | ⚔ |
| MTG | 🃏 |
| Pathfinder | 🎲 |

Clicking a tag populates the search card's game type field with the tag text.

### Map Pin Indicators

Hardcoded placeholder data — purely decorative, no API call needed. Exactly 4 pins:

| Pin | Label | Opacity | Font size |
|-----|-------|---------|-----------|
| 1 | 12 games | 0.5 | 20px |
| 2 | 23 games | 0.8 | 24px |
| 3 | 8 games | 0.6 | 20px |
| 4 | 5 games | 0.4 | 18px |

### "How It Works" Section

Three steps in a horizontal row:

| Step | Icon | Label | Description |
|------|------|-------|-------------|
| 1 | 🔍 | Search | Find games by zip code & type |
| 2 | 📜 | Browse | Read details & check availability |
| 3 | ⚔ | Join | Contact the host & roll initiative |

Each step: 36px circular icon container (amber-bordered), label below, description below that. Muted amber arrows (→) between steps on desktop.

### Footer

- Minimal single-line footer
- Left: "© 2026 gamefinder" (plain text, not the logo component)
- Right: About, Privacy, Contact links (link to `#` for now)
- Very low opacity text (`rgba(255,255,255,0.2)`)

## Responsive Behavior

### Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Desktop | ≥1024px | Full layout as designed |
| Tablet | 768–1023px | Reduce padding, slightly smaller hero logo |
| Mobile | <768px | Significant layout changes (see below) |

### Mobile (<768px)

- **Hero logo removed entirely** — nav-bar logo serves as the sole brand presence
- **Search card** moves up to be the first thing visible below nav, no scroll required
- **Grid background** maintained but grid size reduced to 24px
- **Compass rose** hidden
- **Map pins** hidden
- **Popular tags** wrap to 2 rows, smaller pills
- **"How It Works"** stacks vertically (no arrows, steps listed top-to-bottom)
- **Nav** collapses to hamburger menu for Browse/Post a Game/auth links
- **Search inputs** stack vertically (zip above game type)

### Tablet (768–1023px)

- Hero logo scales to ~36px font size
- Search card max-width reduces to 360px
- Compass rose remains but at 50px
- Everything else flexes naturally with padding adjustments

## Implementation Notes

### MapBackground Component

Create `apps/web/app/components/map-background.tsx` (app-specific, not in `packages/ui`):
- Renders the grid lines, radial glow, compass rose, and gradient
- Accepts optional props: `showCompass?: boolean` (default true), `showGlow?: boolean` (default true)
- Pure CSS — no images to load
- Lives in `apps/web` because it's specific to the web app's page layouts, not a generic UI primitive

### Theme Integration

Update `packages/ui/src/styles/globals.css`:
1. **Remove** the Google Fonts import line (Cinzel + DM Sans) from `globals.css`, and remove the corresponding `<link rel="preconnect">` tags for `fonts.googleapis.com` and `fonts.gstatic.com` from `apps/web/app/root.tsx`
2. **Replace** `--font-display` and `--font-body` with a single `--font-body: system-ui, -apple-system, sans-serif`
3. **Remove** the `.font-display` utility class
4. **Replace** all `:root` token values with the new navy/amber values from the Full Semantic Token Map above
5. **Remove** unused utility classes from the old theme: `.text-gradient-amber`, `.glow-amber`, `.text-teal`, `.text-copper`, `.text-plum`, `.border-teal`, `.border-copper`, `.border-plum`. Note: `login.tsx` and `signup.tsx` reference `glow-amber` — these become no-op classnames, which is acceptable. They can be cleaned up in a follow-up pass.
6. **Keep** the `.bg-noise` utility (still useful for subtle texture)
7. **Keep** the animation keyframes and utilities (`animate-fade-in-up`, `animate-fade-in`, `animate-glow-breathe`, animation delays) — these are useful and theme-independent

### Favicon Generation

- Create the master favicon as SVG in `apps/web/public/`
- Use a build script or manual export to generate PNGs at 16, 32, 180, 192
- Add `<link>` tags in `apps/web/app/root.tsx`

## Assets to Create

1. `packages/ui/src/components/logo.tsx` — Logo component (SVG-based, two sizes)
2. `apps/web/public/favicon.svg` + generated PNG sizes
3. `apps/web/app/components/map-background.tsx` — MapBackground component
4. Updated `packages/ui/src/styles/globals.css` with navy/amber tokens
5. Rebuilt `apps/web/app/routes/home.tsx` using all of the above
6. Updated `apps/web/app/components/nav.tsx` with new Logo component

## Out of Scope

- Light mode theme (dark navy is the primary and only theme for now)
- Animation/transitions beyond what already exists (existing fade-in animations are kept)
- Other pages beyond homepage (search results, game detail, auth pages will inherit the new theme tokens but are not redesigned here)
- Login/signup page restyling (they will pick up the new color tokens automatically via CSS variables)
- Search functionality (the search card is visual scaffolding; actual search is a future epic)
