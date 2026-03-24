# Design Consistency Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Propagate the home page's MapBackground and navy+amber theme to all pages, standardize spacing/padding, and scale up the home page's undersized text.

**Architecture:** Page-by-page sweep. Update MapBackground component first (remove compass, add grid fade mask), then update each route file to use it and normalize spacing values. No new components or abstractions — just consistent markup changes.

**Tech Stack:** React, Tailwind CSS 4, existing MapBackground component, existing Shadcn UI components

**Spec:** `docs/superpowers/specs/2026-03-24-design-consistency-pass-design.md`

---

## File Map

### Modified
- `apps/web/app/components/map-background.tsx` — remove compass rose, add radial fade mask to grid
- `apps/web/app/routes/home.tsx` — upscale text sizes/tracking to match interior pages
- `apps/web/app/routes/login.tsx` — swap old bg for MapBackground, fix padding
- `apps/web/app/routes/signup.tsx` — swap old bg for MapBackground, fix padding
- `apps/web/app/routes/search.tsx` — add MapBackground, fix padding, style select
- `apps/web/app/routes/dashboard.tsx` — swap old bg for MapBackground, fix padding/max-width
- `apps/web/app/routes/gatherings.$id.tsx` — swap old bg for MapBackground (3 instances), fix padding/max-width
- `apps/web/app/routes/gatherings.new.tsx` — swap old bg for MapBackground, fix padding/max-width
- `apps/web/app/routes/gatherings.$id.edit.tsx` — swap old bg for MapBackground, fix padding/max-width
- `packages/ui/src/styles/globals.css` — remove orphaned `bg-noise` utility if unused

---

### Task 1: Update MapBackground Component

**Files:**
- Modify: `apps/web/app/components/map-background.tsx`

- [ ] **Step 1: Remove compass rose and `showCompass` prop**

Delete the entire compass rose `<div>` (the `hidden md:flex absolute bottom-8 right-8` element with N/S/E/W labels, lines 48-94). Remove the `showCompass` prop from the interface and destructured params.

- [ ] **Step 2: Add radial fade mask to both grid layers**

On both grid `<div>` elements (mobile at line 19-25 and desktop at line 26-32), add a CSS mask so the grid fades to transparent toward the center:

```tsx
style={{
  backgroundImage: `linear-gradient(rgba(255,191,71,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,191,71,0.05) 1px, transparent 1px)`,
  backgroundSize: '24px 24px', // 32px for desktop
  maskImage: 'radial-gradient(ellipse at center, transparent 30%, black 70%)',
  WebkitMaskImage: 'radial-gradient(ellipse at center, transparent 30%, black 70%)',
}}
```

The resulting component should only accept `showGlow?: boolean`.

- [ ] **Step 3: Verify the home page still renders correctly**

Run: `pnpm --filter web dev` and check `http://localhost:5173` — the home page should show grid lines fading toward center, no compass rose, navy gradient and amber glow intact.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/components/map-background.tsx
git commit -m "refactor(web): simplify MapBackground — remove compass, add grid fade"
```

---

### Task 2: Upscale Home Page Text

**Files:**
- Modify: `apps/web/app/routes/home.tsx`

- [ ] **Step 1: Update welcome-back label (line 113)**

Change:
```
text-sm text-[rgba(255,191,71,0.5)] uppercase tracking-[3px]
```
To:
```
text-xs text-[rgba(255,191,71,0.5)] uppercase tracking-[0.2em]
```

- [ ] **Step 2: Update "Every game night" tagline (lines 125-126)**

Change:
```
text-[11px] text-[rgba(255,191,71,0.5)] uppercase tracking-[3px]
```
To:
```
text-xs text-[rgba(255,191,71,0.5)] uppercase tracking-[0.2em]
```

- [ ] **Step 3: Update popular tag pill text (line 82)**

Change `text-[10px]` to `text-xs`.

- [ ] **Step 4: Update "How It Works" heading (line 144)**

Change `text-[10px]` to `text-xs`.

- [ ] **Step 5: Update "How It Works" step elements (lines 150-155)**

- Step icon circle: change `w-9 h-9` to `w-10 h-10`
- Step label: change `text-[11px]` to `text-sm`
- Step description: change `text-[9px]` to `text-xs`

- [ ] **Step 6: Update map pin labels (line 139)**

Change `text-[9px]` to `text-xs`.

- [ ] **Step 7: Update footer text (lines 166-170)**

Change all `text-[9px]` to `text-[11px]`.

- [ ] **Step 8: Verify home page visually**

Run dev server, check home page at desktop and mobile widths. Text should be slightly larger and more readable, overall proportions preserved.

- [ ] **Step 9: Commit**

```bash
git add apps/web/app/routes/home.tsx
git commit -m "style(web): upscale home page text sizes to match interior pages"
```

---

### Task 3: Update Login Page

**Files:**
- Modify: `apps/web/app/routes/login.tsx`

- [ ] **Step 1: Add MapBackground import**

Add at top of file:
```tsx
import { MapBackground } from '../components/map-background.js'
```

- [ ] **Step 2: Replace old background with MapBackground**

Remove the old background div (lines 54-57):
```tsx
<div className="pointer-events-none absolute inset-0 overflow-hidden">
  <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-[0.02] blur-[80px]" />
  <div className="absolute inset-0 bg-noise" />
</div>
```

Replace with:
```tsx
<MapBackground />
```

Place it as the first child of the outer `<div>`.

- [ ] **Step 3: Fix container padding and add z-index**

Change the outer div from:
```
className="relative flex min-h-[calc(100vh-65px)] items-center justify-center px-4"
```
To:
```
className="relative flex min-h-[calc(100vh-65px)] items-center justify-center px-6"
```

Add `relative z-10` to the Card element (or wrap the Card in a `<div className="relative z-10">`) so it sits above MapBackground.

- [ ] **Step 4: Verify login page visually**

Check login page — should show navy gradient with fading grid behind the centered card.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/routes/login.tsx
git commit -m "style(web): add MapBackground to login page, fix padding"
```

---

### Task 4: Update Signup Page

**Files:**
- Modify: `apps/web/app/routes/signup.tsx`

- [ ] **Step 1: Same changes as login page**

Identical to Task 3:
1. Add `MapBackground` import
2. Replace old bg-noise+glow div with `<MapBackground />`
3. Change `px-4` to `px-6`
4. Add `relative z-10` to Card so it sits above background

- [ ] **Step 2: Verify signup page visually**

Check signup page — should match login page's look.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/routes/signup.tsx
git commit -m "style(web): add MapBackground to signup page, fix padding"
```

---

### Task 5: Update Search Page

**Files:**
- Modify: `apps/web/app/routes/search.tsx`

- [ ] **Step 1: Add MapBackground import and element**

Add import:
```tsx
import { MapBackground } from '../components/map-background.js'
```

Wrap the existing content. The outer `<div>` should become:
```tsx
<div className="relative min-h-[calc(100vh-65px)]">
  <MapBackground />
  <div className="relative z-10 mx-auto max-w-5xl px-6 py-10">
    {/* existing content */}
  </div>
</div>
```

This changes `py-8` to `py-10` and wraps content in `relative z-10`.

- [ ] **Step 2: Style the raw select element**

Find the `<select>` element (radius selector, around line 169-180). Change its className from:
```
h-9 rounded-md border border-input bg-background px-3 text-sm
```
To:
```
h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground
```

This matches the Input component's styling.

- [ ] **Step 3: Verify search page visually**

Check search page with and without search results. Background should show through, grid should fade toward center.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/routes/search.tsx
git commit -m "style(web): add MapBackground to search page, fix padding and select"
```

---

### Task 6: Update Dashboard Page

**Files:**
- Modify: `apps/web/app/routes/dashboard.tsx`

- [ ] **Step 1: Add MapBackground import**

```tsx
import { MapBackground } from '../components/map-background.js'
```

- [ ] **Step 2: Replace old background with MapBackground**

Remove the old background div (lines 42-45):
```tsx
<div className="pointer-events-none absolute inset-0 overflow-hidden">
  <div className="absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-[0.03] blur-[100px]" />
  <div className="absolute inset-0 bg-noise" />
</div>
```

Replace with `<MapBackground />` as first child of outer div.

- [ ] **Step 3: Fix padding and max-width**

Change the content container (line 47) from:
```
className="relative mx-auto max-w-3xl px-4 py-10 space-y-8"
```
To:
```
className="relative z-10 mx-auto max-w-4xl px-6 py-10 space-y-8"
```

- [ ] **Step 4: Verify dashboard page visually**

Check dashboard with and without gatherings. Background should show MapBackground.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/routes/dashboard.tsx
git commit -m "style(web): add MapBackground to dashboard, fix padding/max-width"
```

---

### Task 7: Update Gathering Details Page

**Files:**
- Modify: `apps/web/app/routes/gatherings.$id.tsx`

This page has 3 separate return blocks (loading, error, main) each with their own old background div.

- [ ] **Step 1: Add MapBackground import**

```tsx
import { MapBackground } from '../components/map-background.js'
```

- [ ] **Step 2: Replace background in loading state (lines 43-52)**

Replace the old bg div with `<MapBackground />`. Update the content container:
```tsx
<div className="relative min-h-[calc(100vh-65px)]">
  <MapBackground />
  <div className="relative z-10 mx-auto max-w-4xl px-6 py-10">
    <div className="h-8 w-48 animate-pulse rounded bg-muted" />
  </div>
</div>
```

- [ ] **Step 3: Replace background in error state (lines 56-66)**

Same pattern:
```tsx
<div className="relative min-h-[calc(100vh-65px)]">
  <MapBackground />
  <div className="relative z-10 mx-auto max-w-4xl px-6 py-10 text-center">
    <p className="text-lg text-muted-foreground">Gathering not found.</p>
  </div>
</div>
```

- [ ] **Step 4: Replace background in main render (lines 72-77)**

Replace old bg div with `<MapBackground />`. Update content container from:
```
className="relative mx-auto max-w-3xl px-4 py-10 space-y-8"
```
To:
```
className="relative z-10 mx-auto max-w-4xl px-6 py-10 space-y-8"
```

- [ ] **Step 5: Verify gathering details page visually**

Check a gathering detail page. All three states (loading, error, content) should have MapBackground.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/routes/gatherings.\$id.tsx
git commit -m "style(web): add MapBackground to gathering details, fix padding/max-width"
```

---

### Task 8: Update New Gathering Page

**Files:**
- Modify: `apps/web/app/routes/gatherings.new.tsx`

- [ ] **Step 1: Add MapBackground import and replace old background**

Add import. Remove old bg div (lines 24-27). Add `<MapBackground />` as first child.

- [ ] **Step 2: Fix padding and max-width**

Change content container (line 29) from:
```
className="relative mx-auto max-w-3xl px-4 py-10"
```
To:
```
className="relative z-10 mx-auto max-w-4xl px-6 py-10"
```

- [ ] **Step 3: Verify and commit**

Check the create gathering form page visually.

```bash
git add apps/web/app/routes/gatherings.new.tsx
git commit -m "style(web): add MapBackground to new gathering page, fix padding/max-width"
```

---

### Task 9: Update Edit Gathering Page

**Files:**
- Modify: `apps/web/app/routes/gatherings.$id.edit.tsx`

- [ ] **Step 1: Add MapBackground import and replace old background**

Add import. Remove old bg div (lines 64-67). Add `<MapBackground />` as first child.

- [ ] **Step 2: Fix padding and max-width**

Change content container (line 69) from:
```
className="relative mx-auto max-w-3xl px-4 py-10"
```
To:
```
className="relative z-10 mx-auto max-w-4xl px-6 py-10"
```

- [ ] **Step 3: Verify and commit**

Check the edit gathering form page visually.

```bash
git add apps/web/app/routes/gatherings.\$id.edit.tsx
git commit -m "style(web): add MapBackground to edit gathering page, fix padding/max-width"
```

---

### Task 10: CSS Cleanup

**Files:**
- Modify: `packages/ui/src/styles/globals.css`

- [ ] **Step 1: Check if `bg-noise` is still used anywhere**

Run: `grep -r "bg-noise" apps/ packages/ --include="*.tsx" --include="*.ts" --include="*.css"`

If no results (outside of the utility definition itself), remove the `.bg-noise` utility block from `globals.css` (lines 65-68).

- [ ] **Step 2: Check for other orphaned utilities**

Run:
```bash
grep -r "glow-amber\|font-display\|text-gradient-amber\|text-teal\|text-copper\|text-plum\|border-teal\|border-copper\|border-plum" apps/ packages/ --include="*.tsx" --include="*.ts"
```

Only remove utilities that have zero usage in any `.tsx`/`.ts` file.

- [ ] **Step 3: Verify the app builds**

Run: `pnpm build`

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/styles/globals.css
git commit -m "chore(ui): remove orphaned CSS utilities"
```

---

### Task 11: Final Verification

- [ ] **Step 1: Visual walkthrough of all pages**

Start dev server: `pnpm --filter web dev`

Check each page at desktop width (~1280px):
1. `/` — Home: grid fades toward center, no compass, text scaled up
2. `/login` — MapBackground behind centered card
3. `/signup` — MapBackground behind centered card
4. `/search` — MapBackground behind search form and results
5. `/dashboard` — MapBackground, wider container (max-w-4xl)
6. `/gatherings/new` — MapBackground behind form
7. Any gathering detail page — MapBackground, wider container

Verify: consistent `px-6` horizontal padding, `py-10` vertical padding on all interior pages, no visual artifacts from the grid fade mask.

- [ ] **Step 2: Check mobile viewport (~375px)**

Verify grid lines use 24px size on mobile, content is not clipped, cards still center properly on auth pages.

- [ ] **Step 3: Final commit if any tweaks were needed**

If any small adjustments were made during verification:
```bash
git add -A
git commit -m "style(web): polish design consistency pass"
```
