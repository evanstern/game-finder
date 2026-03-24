# Visual Identity & Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current warm-brown/gold theme with a navy & amber adventure-map visual identity, including a new logo with sword/die typography, favicon, map-themed homepage, and responsive layout.

**Architecture:** Update the shared theme tokens in `globals.css`, create a reusable `Logo` SVG component in the UI package, create a `MapBackground` component in the web app, then rebuild the homepage and nav bar using these new pieces. All visual — no backend changes.

**Tech Stack:** React, TypeScript, Tailwind CSS 4, Shadcn UI, inline SVG

**Spec:** `docs/superpowers/specs/2026-03-24-visual-identity-and-homepage-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `packages/ui/src/styles/globals.css` | Theme tokens, font migration, utility cleanup |
| Modify | `apps/web/app/root.tsx` | Remove Google Fonts preconnect, add favicon links |
| Create | `packages/ui/src/components/logo.tsx` | Reusable Logo component (sm/lg sizes) with sword + die SVGs |
| Create | `apps/web/public/favicon.svg` | Master favicon SVG |
| Create | `apps/web/app/components/map-background.tsx` | Grid lines, radial glow, compass rose background |
| Modify | `apps/web/app/components/nav.tsx` | Replace D20Icon with Logo, add Browse/Post links |
| Modify | `apps/web/app/routes/home.tsx` | Full homepage rebuild with new design |

---

## Task 1: Update Theme Tokens in globals.css

**Files:**
- Modify: `packages/ui/src/styles/globals.css`

- [ ] **Step 1: Remove Google Fonts import and old font variables**

Replace line 1 (the `@import url(...)` for Cinzel + DM Sans) with nothing — just delete it.

In the `@theme extend` block, replace:
```css
--font-display: 'Cinzel', Georgia, serif;
--font-body: 'DM Sans', system-ui, sans-serif;
```
with:
```css
--font-body: system-ui, -apple-system, sans-serif;
```

Remove the `--font-display` line entirely (do not replace it).

- [ ] **Step 2: Replace all :root token values with navy/amber palette**

Replace the entire `:root` block contents with:
```css
:root {
    --background: #0a1628;
    --foreground: #e8edf5;
    --card: #0f1d35;
    --card-foreground: #e8edf5;
    --popover: #0f1d35;
    --popover-foreground: #e8edf5;
    --primary: #ffbf47;
    --primary-foreground: #0a1628;
    --secondary: #132240;
    --secondary-foreground: #e8edf5;
    --muted: #132240;
    --muted-foreground: #7a8ba3;
    --accent: #1a2d4a;
    --accent-foreground: #e8edf5;
    --destructive: #c44545;
    --destructive-foreground: #fde8e8;
    --border: rgba(255,191,71,0.15);
    --input: rgba(255,191,71,0.15);
    --ring: rgba(255,191,71,0.3);
    --radius: 0.5rem;
}
```

- [ ] **Step 3: Remove old utility classes, keep useful ones**

Remove these utility classes from the `@layer utilities` block:
- `.font-display`
- `.text-gradient-amber`
- `.glow-amber`
- `.text-teal`, `.text-copper`, `.text-plum`
- `.border-teal`, `.border-copper`, `.border-plum`

**Keep** these (do not remove):
- `.bg-noise`
- `.animate-fade-in-up`, `.animate-fade-in`, `.animate-glow-breathe`
- `.animation-delay-100`, `.animation-delay-200`, `.animation-delay-300`
- All `@keyframes` blocks

- [ ] **Step 4: Verify the app still runs**

Run: `pnpm dev` from the monorepo root.
Expected: App starts without CSS errors. Colors will look different (navy backgrounds). Existing pages (login, signup) will inherit new tokens — they'll look different but not broken. The `font-display` and `glow-amber` classnames in login/signup become no-ops, which is fine.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/styles/globals.css
git commit -m "style: replace warm-brown theme with navy/amber palette

Remove Google Fonts (Cinzel, DM Sans), migrate to system-ui.
Replace all semantic tokens with navy/amber adventure-map theme.
Remove unused utility classes (gradient-amber, teal/copper/plum)."
```

---

## Task 2: Update root.tsx — Remove Preconnect, Add Favicon Links

**Files:**
- Modify: `apps/web/app/root.tsx`

- [ ] **Step 1: Remove Google Fonts preconnect links**

Delete these two lines from the `<head>` section:
```tsx
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
```

- [ ] **Step 2: Add favicon link tags**

Add these in the `<head>` section (after the viewport meta tag):
```tsx
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
<link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png" />
```

Note: The actual favicon files are created in Task 3. The link tags can reference them ahead of time.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/root.tsx
git commit -m "chore(web): remove Google Fonts preconnect, add favicon links"
```

---

## Task 3: Create Favicon SVG

**Files:**
- Create: `apps/web/public/favicon.svg`

- [ ] **Step 1: Create the public directory and master favicon SVG**

The `apps/web/public/` directory does not exist yet. Create it, then create `apps/web/public/favicon.svg` with the "gf" monogram on a tilted amber die:

```bash
mkdir -p apps/web/public
```

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <rect id="die" width="26" height="26" rx="5" fill="#ffbf47"/>
  </defs>
  <g transform="rotate(-5 16 16)">
    <use href="#die" x="3" y="3"/>
    <!-- Corner pips at 30% opacity -->
    <circle cx="9" cy="9" r="1.8" fill="#0a1628" opacity="0.3"/>
    <circle cx="23" cy="23" r="1.8" fill="#0a1628" opacity="0.3"/>
    <!-- "gf" text -->
    <text x="16" y="21" text-anchor="middle" fill="#0a1628"
          font-family="system-ui, sans-serif" font-weight="900" font-size="16">gf</text>
  </g>
</svg>
```

- [ ] **Step 2: Generate PNG favicons from SVG**

Use a quick script to generate the PNG sizes. If `sharp` is not installed, use `npx`:

```bash
npx sharp-cli -i apps/web/public/favicon.svg -o apps/web/public/favicon-16x16.png resize 16 16
npx sharp-cli -i apps/web/public/favicon.svg -o apps/web/public/favicon-32x32.png resize 32 32
npx sharp-cli -i apps/web/public/favicon.svg -o apps/web/public/apple-touch-icon.png resize 180 180
npx sharp-cli -i apps/web/public/favicon.svg -o apps/web/public/android-chrome-192x192.png resize 192 192
```

If `sharp-cli` is problematic, use `rsvg-convert`, Inkscape CLI, or any available tool. The SVG master is what matters — PNGs are nice-to-have fallbacks. If no PNG generator is available, skip the PNGs and rely on the SVG favicon (modern browsers handle it fine).

- [ ] **Step 3: Verify favicon shows in browser**

Run: `pnpm dev` and open the app.
Expected: Browser tab shows the amber "gf" die icon.

- [ ] **Step 4: Commit**

```bash
git add apps/web/public/favicon.svg apps/web/public/favicon-*.png apps/web/public/apple-touch-icon.png apps/web/public/android-chrome-*.png
git commit -m "feat(web): add gf monogram favicon (SVG + PNG sizes)"
```

If PNGs weren't generated, just commit the SVG:
```bash
git add apps/web/public/favicon.svg
git commit -m "feat(web): add gf monogram favicon SVG"
```

---

## Task 4: Create Logo Component

**Files:**
- Create: `packages/ui/src/components/logo.tsx`

- [ ] **Step 1: Create the Logo component**

Create `packages/ui/src/components/logo.tsx`. This component renders the `g🎲mef⚔nder` wordmark with inline SVGs for the die ("a") and sword ("i").

It accepts a `size` prop:
- `"sm"` — 18px font, 13×13px die, ~20px sword (for nav bar)
- `"md"` — 36px font, 24×24px die, ~38px sword (for tablet hero)
- `"lg"` — 48px font, 32×32px die, ~50px sword (for desktop hero), includes dice pip divider below

Key implementation details:
- The die is a `<svg>` element showing 5 pips (quincunx) on an amber rounded square, rotated -5deg with a drop shadow
- The sword is a `<svg>` element with: silver blade (`#c0c8d4`), highlight edge (`#dce3ed`), amber crossguard, brown grip (`#8B5E3C`), amber pommel
- Text "g" and "me" are white (`text-foreground`), "f" and "nder" are amber (`text-primary`)
- Die and sword are positioned inline with the text using `inline-flex` and `align-items: baseline`
- The pip divider (lg only) renders three `#ffbf47` dots flanked by thin lines below the wordmark
- Use `cn()` for class merging, follow the existing Shadcn component pattern (forwardRef, className prop)

The component signature:
```tsx
import { cn } from '@game-finder/ui/lib/utils'

interface LogoProps {
  size: 'sm' | 'md' | 'lg'
  className?: string
}

export function Logo({ size, className }: LogoProps) {
  const isLg = size === 'lg'
  // ... render logic
}
```

For the SVG elements, define the die and sword as sub-components or inline SVGs scaled by the `size` prop. Use a dimension lookup:

```tsx
const dims = {
  sm: { fontSize: 18, die: 13, swordH: 20, swordW: 9 },
  md: { fontSize: 36, die: 24, swordH: 38, swordW: 17 },
  lg: { fontSize: 48, die: 32, swordH: 50, swordW: 22 },
}
```

Note: The `packages/ui` package uses wildcard exports (`"./components/*": "./src/components/*.tsx"`), so no `package.json` update is needed — the new `logo.tsx` file is automatically exported.

Refer to the spec (Logo section, lines 81-113) for exact colors and the mockups from the brainstorming session for the visual reference.

- [ ] **Step 2: Verify the component renders at both sizes**

Temporarily import and render `<Logo size="lg" />` and `<Logo size="sm" />` in `home.tsx` to visually confirm both sizes render correctly.

Run: `pnpm dev` and check the homepage.
Expected: Both logo sizes render with the die replacing "a", sword replacing "i", correct colors, pip divider on lg only.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/logo.tsx
git commit -m "feat(ui): add Logo component with sword/die wordmark SVGs"
```

---

## Task 5: Create MapBackground Component

**Files:**
- Create: `apps/web/app/components/map-background.tsx`

- [ ] **Step 1: Create the MapBackground component**

Create `apps/web/app/components/map-background.tsx`. This is a purely decorative component that renders behind page content.

```tsx
interface MapBackgroundProps {
  showCompass?: boolean
  showGlow?: boolean
}

export function MapBackground({
  showCompass = true,
  showGlow = true,
}: MapBackgroundProps) {
  // Render: absolute positioned, pointer-events-none, covers parent
}
```

The component renders these layers (all absolutely positioned, `pointer-events-none`):

1. **Gradient base**: `linear-gradient(180deg, #0a1628 0%, #132240 60%, #0d1a30 100%)`
2. **Grid lines**: `background-image` with two `linear-gradient`s creating a grid in `rgba(255,191,71,0.05)`. Use Tailwind's mobile-first approach: base style is 24×24px grid (mobile), then `md:` applies 32×32px (desktop). Implement via a `style` prop or two grid divs toggled with `md:hidden` / `hidden md:block`.
3. **Radial glow** (if `showGlow`): centered at top third, 500×400px ellipse, `rgba(255,191,71,0.06)`
4. **Compass rose** (if `showCompass`): bottom-right, 70×70px circle with `rgba(255,191,71,0.12)` border. Contains N/S/E/W labels and crosshair lines at very low opacity. Hidden on mobile (`hidden md:flex`). On tablet, 50px.

All pure CSS/Tailwind — no images. The component wraps content as a relative container or is placed as an absolute sibling.

- [ ] **Step 2: Verify visually**

Temporarily import and render `<MapBackground />` in `home.tsx` wrapping the existing content.

Run: `pnpm dev` and check.
Expected: Navy gradient background with faint amber grid lines, subtle glow behind center, compass rose in bottom-right.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/components/map-background.tsx
git commit -m "feat(web): add MapBackground component with grid, glow, compass"
```

---

## Task 6: Update Nav Component

**Files:**
- Modify: `apps/web/app/components/nav.tsx`

- [ ] **Step 1: Replace D20Icon and title with Logo component**

Remove the `D20Icon` function entirely.

Replace the nav logo section:
```tsx
<Link to="/" className="group flex items-center gap-2">
  <D20Icon className="h-4.5 w-4.5 text-primary transition-transform duration-300 group-hover:rotate-[60deg]" />
  <span className="font-display text-base tracking-wide text-foreground">
    Game Finder
  </span>
</Link>
```

With:
```tsx
<Link to="/" className="flex items-center">
  <Logo size="sm" />
</Link>
```

Import: `import { Logo } from '@game-finder/ui/components/logo'`

- [ ] **Step 2: Add Browse and Post a Game links (desktop)**

In the right side of the nav, add two new links before the auth section. These are hidden on mobile (`hidden md:flex`):

```tsx
<div className="hidden md:flex items-center gap-5">
  <Link to="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
    Browse
  </Link>
  <Link to="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
    Post a Game
  </Link>
  {/* Existing auth links (loading, user, guest) stay here */}
</div>
```

These link to `#` for now — the routes don't exist yet. Preserve all existing auth-aware rendering (user loading state, authenticated user display name + Log Out, guest Log In + Sign Up).

- [ ] **Step 3: Add mobile hamburger menu**

Add a hamburger button visible only on mobile (`md:hidden`) that toggles a dropdown/drawer with all nav links:

```tsx
import { useState } from 'react'

// Inside Nav component:
const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

// In JSX, after the Logo link:
<button
  type="button"
  className="md:hidden text-muted-foreground"
  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
  aria-label="Toggle menu"
>
  {mobileMenuOpen ? '✕' : '☰'}
</button>

// Below the nav bar, conditionally render the mobile menu:
{mobileMenuOpen && (
  <div className="md:hidden border-t border-border bg-card/95 backdrop-blur-md px-6 py-4 flex flex-col gap-3">
    <Link to="#" className="text-sm text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>Browse</Link>
    <Link to="#" className="text-sm text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>Post a Game</Link>
    {/* Auth links: same as desktop but rendered vertically */}
    {user ? (
      <>
        <span className="text-sm font-medium text-primary">{user.displayName}</span>
        <button type="button" onClick={() => { logoutMutation.mutate(); setMobileMenuOpen(false) }}
          className="text-sm text-muted-foreground text-left">Log Out</button>
      </>
    ) : (
      <>
        <Link to="/login" className="text-sm text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>Log In</Link>
        <Link to="/signup" className="text-sm text-primary font-semibold" onClick={() => setMobileMenuOpen(false)}>Sign Up</Link>
      </>
    )}
  </div>
)}
```

The nav structure becomes: `<nav>` wrapping the top bar (logo + hamburger on mobile, logo + full links on desktop) plus the conditional mobile dropdown below.

- [ ] **Step 4: Verify nav looks correct**

Run: `pnpm dev` and check:
- Desktop: Nav shows the sword/die logo on left, "Browse", "Post a Game", and auth links on right.
- Mobile (~375px): Nav shows logo on left, hamburger on right. Tapping hamburger reveals dropdown with all links.
- Auth behavior unchanged in both views.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/components/nav.tsx
git commit -m "feat(web): replace nav logo with Logo component, add Browse/Post links"
```

---

## Task 7: Rebuild Homepage

**Files:**
- Modify: `apps/web/app/routes/home.tsx`

This is the largest task. Rewrite the homepage to match the spec layout.

- [ ] **Step 1: Scaffold the new homepage structure**

Replace the entire contents of `home.tsx`. The new structure:

```tsx
import { Logo } from '@game-finder/ui/components/logo'
import { useQuery } from '@tanstack/react-query'
import { Fragment, useState } from 'react'
import { useNavigate } from 'react-router'
import { MapBackground } from '../components/map-background.js'
import { useTRPC } from '../trpc/provider.js'

// Constants
const POPULAR_TAGS = [
  { label: 'D&D 5e', emoji: '⚔' },
  { label: 'Board Games', emoji: '🎲' },
  { label: 'Warhammer', emoji: '⚔' },
  { label: 'MTG', emoji: '🃏' },
  { label: 'Pathfinder', emoji: '🎲' },
]

const MAP_PINS = [
  { label: '12 games', opacity: 0.5, size: 20 },
  { label: '23 games', opacity: 0.8, size: 24 },
  { label: '8 games', opacity: 0.6, size: 20 },
  { label: '5 games', opacity: 0.4, size: 18 },
]

const HOW_IT_WORKS = [
  { icon: '🔍', label: 'Search', desc: 'Find games by zip code & type' },
  { icon: '📜', label: 'Browse', desc: 'Read details & check availability' },
  { icon: '⚔', label: 'Join', desc: 'Contact the host & roll initiative' },
]
```

- [ ] **Step 2: Implement the search card with state**

Add a `SearchCard` component inside `home.tsx` (not a separate file — it's homepage-specific):

```tsx
function SearchCard() {
  const [zip, setZip] = useState('')
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  function handleSearch() {
    const params = new URLSearchParams()
    if (zip) params.set('zip', zip)
    if (query) params.set('q', query)
    navigate(`/search?${params.toString()}`)
  }

  function handleTagClick(tag: string) {
    setQuery(tag)
  }

  // Renders the floating search card, inputs, button, and popular tags
  // See spec lines 193-216 for exact layout
}
```

Key styling:
- Card: `bg-white/[0.04] border border-[rgba(255,191,71,0.15)] rounded-xl p-5 max-w-[420px] mx-auto`
- Inputs: `bg-black/30 border border-[rgba(255,191,71,0.15)] rounded-lg` side by side on desktop, stacked on mobile (`flex-col md:flex-row`)
- Button: `bg-primary text-primary-foreground rounded-lg font-bold`
- Tags: `bg-[rgba(255,191,71,0.1)] border border-[rgba(255,191,71,0.15)] text-primary rounded-full` with `cursor-pointer` and `onClick` to populate query

- [ ] **Step 3: Implement the hero section**

The main `Home` component:

```tsx
export default function Home() {
  const trpc = useTRPC()
  const { data: user, isLoading } = useQuery(trpc.auth.me.queryOptions())

  if (isLoading) return null

  return (
    <div className="relative min-h-[calc(100vh-65px)]">
      <MapBackground />

      <div className="relative z-10">
        {/* Hero section */}
        <div className="px-6 pt-12 pb-8 text-center md:pt-20 md:pb-12">
          {/* Large logo — hidden on mobile, md on tablet, lg on desktop */}
          <div className="hidden md:block lg:hidden mb-4">
            <Logo size="md" />
          </div>
          <div className="hidden lg:block mb-4">
            <Logo size="lg" />
          </div>

          {/* Tagline — changes based on auth state */}
          {user ? (
            <>
              <p className="text-sm text-[rgba(255,191,71,0.5)] uppercase tracking-[3px] mb-2">
                Welcome back, {user.displayName}
              </p>
              <p className="text-muted-foreground text-sm">
                Find your next game night
              </p>
            </>
          ) : (
            <>
              <p className="text-muted-foreground text-sm mb-1.5">
                Navigate to tabletop adventures in your area.
              </p>
              <p className="text-[11px] text-[rgba(255,191,71,0.5)] uppercase tracking-[3px]">
                Every game night is a new quest
              </p>
            </>
          )}
        </div>

        {/* Search card */}
        <SearchCard />

        {/* Map pins — hidden on mobile */}
        <div className="hidden md:flex gap-7 justify-center items-center mt-8">
          {MAP_PINS.map((pin) => (
            <div key={pin.label} className="text-center" style={{ opacity: pin.opacity }}>
              <div style={{ fontSize: pin.size }}>📍</div>
              <div className="text-[rgba(255,255,255,0.3)] text-[9px]">{pin.label}</div>
            </div>
          ))}
        </div>

        {/* How It Works */}
        {/* ... */}

        {/* Footer */}
        {/* ... */}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implement "How It Works" section**

Below the map pins:

```tsx
<div className="border-t border-[rgba(255,191,71,0.08)] mt-10 pt-8 pb-6 px-6">
  <p className="text-center text-[10px] text-[rgba(255,191,71,0.5)] uppercase tracking-[3px] mb-5">
    How It Works
  </p>
  <div className="flex flex-col md:flex-row gap-4 md:gap-4 justify-center items-center max-w-lg mx-auto">
    {HOW_IT_WORKS.map((step, i) => (
      <Fragment key={step.label}>
        <div className="text-center flex-1">
          <div className="w-9 h-9 mx-auto mb-2 rounded-full border border-[rgba(255,191,71,0.2)] bg-[rgba(255,191,71,0.1)] flex items-center justify-center text-base">
            {step.icon}
          </div>
          <div className="text-foreground text-[11px] font-semibold mb-0.5">{step.label}</div>
          <div className="text-[rgba(255,255,255,0.35)] text-[9px] leading-snug">{step.desc}</div>
        </div>
        {i < HOW_IT_WORKS.length - 1 && (
          <div className="hidden md:block text-[rgba(255,191,71,0.25)] pb-5">→</div>
        )}
      </Fragment>
    ))}
  </div>
</div>
```

(`Fragment` is already imported in Step 1's scaffold.)

- [ ] **Step 5: Implement footer**

Below "How It Works":

```tsx
<div className="border-t border-[rgba(255,191,71,0.06)] px-6 py-3.5 flex justify-between items-center">
  <span className="text-[rgba(255,255,255,0.2)] text-[9px]">© 2026 gamefinder</span>
  <div className="flex gap-3.5">
    <a href="#" className="text-[rgba(255,255,255,0.2)] text-[9px] hover:text-[rgba(255,255,255,0.4)]">About</a>
    <a href="#" className="text-[rgba(255,255,255,0.2)] text-[9px] hover:text-[rgba(255,255,255,0.4)]">Privacy</a>
    <a href="#" className="text-[rgba(255,255,255,0.2)] text-[9px] hover:text-[rgba(255,255,255,0.4)]">Contact</a>
  </div>
</div>
```

- [ ] **Step 6: Full visual review**

Run: `pnpm dev` and thoroughly check:
- Desktop: Full layout with hero logo, search card, tags, map pins, how it works, footer
- Tablet (resize to ~800px): Logo slightly smaller, compass rose smaller, otherwise similar
- Mobile (resize to ~375px): No hero logo, search card immediately visible, stacked inputs, no map pins, vertical how-it-works
- Auth state: Log in and verify "Welcome back" variation works
- Guest state: Verify default tagline text

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/routes/home.tsx
git commit -m "feat(web): rebuild homepage with map-themed hero and search card

Navy/amber adventure-map design with large logo, search card,
popular game tags, map pin indicators, and how-it-works section.
Responsive: mobile drops hero logo, stacks search inputs."
```

---

## Task 8: Final Polish and Verification

- [ ] **Step 1: Cross-page check**

Navigate to `/login` and `/signup`. Verify they render with the new navy/amber tokens. The `font-display` and `glow-amber` classnames are now no-ops — confirm the pages still look reasonable (navy background, amber accents, readable text).

- [ ] **Step 2: Check for console errors**

Open browser dev tools. Confirm no CSS errors, missing asset warnings, or React errors in console.

- [ ] **Step 3: Check favicon in browser tab**

Confirm the amber "gf" die icon appears in the browser tab.

- [ ] **Step 4: Final commit (if any tweaks needed)**

If any small fixes were needed during review:
```bash
git add -A
git commit -m "fix(web): visual polish from final review"
```
