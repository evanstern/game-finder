# Design Consistency Pass

**Date**: 2026-03-24
**Goal**: Propagate the home page's visual identity (MapBackground, navy+amber theme) to all pages, standardize spacing/padding across the app, and scale up the home page's undersized text to match interior pages.

## Approach

Page-by-page sweep. Update MapBackground once (add grid fade, remove compass), then touch each page file to swap backgrounds and normalize spacing.

## 1. MapBackground Update

### Current state
- Navy gradient, grid lines (24px mobile / 32px desktop), radial amber glow, compass rose
- Props: `showCompass` (default true), `showGlow` (default true)

### Changes
- **Remove**: Compass rose element and `showCompass` prop entirely
- **Add**: Radial CSS mask on the grid layer so grid lines fade to transparent toward the viewport center. Use `mask-image: radial-gradient(ellipse at center, transparent 30%, black 70%)` (or similar) so the center content area is clean and grid is visible at the edges.
- **Keep**: Navy gradient background (`#0a1628` -> `#132240` -> `#0d1a30`), `showGlow` prop with subtle amber radial glow

### Resulting component API
```tsx
<MapBackground showGlow?: boolean />
```

## 2. Standardized Spacing System

All pages adopt these consistent values:

| Token | Value | Usage |
|-------|-------|-------|
| Container horizontal padding | `px-6` | All pages (replaces px-4) |
| Content max-width (standard) | `max-w-4xl` | Dashboard, gathering detail/edit/new |
| Content max-width (wide) | `max-w-5xl` | Search results (sidebar needs width) |
| Auth card max-width | `max-w-sm` | Login/signup (intentionally narrow) |
| Top/bottom padding | `py-10` | All interior pages (replaces py-8) |
| Card content padding | `p-5` | All card interiors |
| Major section gaps | `space-y-8` | Between page sections |
| Form field gaps | `space-y-5` | Between form fields |

## 3. Home Page Upscale

Scale up undersized text and spacing to match interior page conventions:

| Element | Current | New |
|---------|---------|-----|
| Subtitle / tagline | `text-sm` | `text-sm` (keep) |
| Tracking labels | `tracking-[3px]` | `tracking-[0.2em]` |
| "How It Works" heading | `text-[10px]` | `text-xs` |
| "How It Works" step descriptions | `text-[9px]` | `text-xs` |
| "How It Works" step labels | `text-[11px]` | `text-sm` |
| Step icon circles | `w-9 h-9` | `w-10 h-10` |
| Footer text | `text-[9px]` | `text-[11px]` |
| Map pin labels | `text-[9px]` | `text-xs` |
| Popular tag pill text | `text-[10px]` | `text-xs` |
| Welcome-back label | `text-sm` with `tracking-[3px]` | `text-xs` with `tracking-[0.2em]` |
| "Every game night" tagline | `text-[11px]` with `tracking-[3px]` | `text-xs` with `tracking-[0.2em]` |

Hero padding (`pt-12 md:pt-20`) stays — the hero needs breathing room.

## 4. Per-Page Changes

### Login (`/login`)
- Replace old bg-noise + glow div with `<MapBackground />`
- `px-4` -> `px-6`
- Remove old background div (the `pointer-events-none` div with bg-noise and primary glow)

### Signup (`/signup`)
- Same as login: replace old bg div with `<MapBackground />`
- `px-4` -> `px-6`
- Remove old background div

### Search (`/search`)
- Add `<MapBackground />` (currently has no background at all)
- `py-8` -> `py-10`
- Wrap content in `relative z-10` to sit above MapBackground
- Style raw `<select>` element to match Input component styling (border-input, bg-transparent, rounded-md)

### Dashboard (`/dashboard`)
- Replace old bg-noise + glow div with `<MapBackground />`
- `px-4` -> `px-6`
- `max-w-3xl` -> `max-w-4xl`
- Remove old background div

### Gathering Details (`/gatherings/:id`)
- Replace old bg-noise + glow divs (3 instances: loading, error, main) with `<MapBackground />`
- `px-4` -> `px-6`
- `max-w-3xl` -> `max-w-4xl`
- Remove inconsistent glow sizes (500px, 600px)

### New Gathering (`/gatherings/new`)
- Replace old bg-noise + glow div with `<MapBackground />`
- `px-4` -> `px-6`
- `max-w-3xl` -> `max-w-4xl`

### Edit Gathering (`/gatherings/:id/edit`)
- Replace old bg-noise + glow div with `<MapBackground />`
- `px-4` -> `px-6`
- `max-w-3xl` -> `max-w-4xl`

### Nav
- No changes needed — already consistent

## 5. Cleanup

- Remove `bg-noise` utility from `globals.css` if no longer used by any page after the sweep
- Remove unused CSS (old glow-amber, font-display, text-gradient-amber etc.) if orphaned
- Verify all raw `<select>` elements are styled consistently

## Files Changed

### Modified
- `apps/web/app/components/map-background.tsx` — remove compass, add grid fade
- `apps/web/app/routes/home.tsx` — upscale text sizes
- `apps/web/app/routes/login.tsx` — swap background, fix padding
- `apps/web/app/routes/signup.tsx` — swap background, fix padding
- `apps/web/app/routes/search.tsx` — add background, fix padding, style select
- `apps/web/app/routes/dashboard.tsx` — swap background, fix padding/max-width
- `apps/web/app/routes/gatherings.$id.tsx` — swap background, fix padding/max-width
- `apps/web/app/routes/gatherings.new.tsx` — swap background, fix padding/max-width
- `apps/web/app/routes/gatherings.$id.edit.tsx` — swap background, fix padding/max-width
- `packages/ui/src/styles/globals.css` — remove orphaned utilities if applicable
