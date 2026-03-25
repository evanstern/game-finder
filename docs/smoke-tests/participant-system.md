# Smoke Tests: Participant System

These are flow-based test instructions for an AI agent with browser access (Playwright). Describe what to do, not which elements to click. If the agent can't figure out the flow, that's a signal the UI needs work.

**Base URL:** `http://localhost:3000`

**Prerequisites:** The app is running with a fresh migration. There may or may not be existing users/gatherings.

---

## Setup: Create Two Test Accounts

You'll need two separate user accounts for these tests. Create them via signup if they don't exist.

**Account A (the host):**
- Display name: `SmokeHost`
- Email: `smokehost@test.com`
- Password: `testpassword123`

**Account B (the joiner):**
- Display name: `SmokeJoiner`
- Email: `smokejoiner@test.com`
- Password: `testpassword123`

Sign up both accounts. If signup says the email is taken, log in instead.

After creating both accounts, log out and proceed to Test 1.

---

## Test 1: Create a Public Gathering

**Goal:** Verify a host can create a public gathering with the new visibility field.

1. Log in as Account A (SmokeHost)
2. Navigate to create a new gathering
3. Fill in the form:
   - Title: `Smoke Test Public Game`
   - Select at least one game
   - Zip code: `90210`
   - Schedule: One-time
   - Date/time: any future date
   - Max players: `3`
   - Description: `Testing public visibility`
   - Visibility: should default to **Public** — leave it as-is
4. Submit the form

**Verify:**
- You are redirected to the gathering detail page
- The title "Smoke Test Public Game" is displayed
- The page shows a "Players" section with "0/3 joined"
- There is NO join button visible (you are the host)
- Record the gathering URL for later tests

**Report:** Pass/fail, and note any issues with the form or detail page.

---

## Test 2: Create a Private Gathering

**Goal:** Verify a host can create a private gathering and sees the invite link.

1. Still logged in as Account A (SmokeHost)
2. Navigate to create a new gathering
3. Fill in the form:
   - Title: `Smoke Test Private Game`
   - Select at least one game
   - Zip code: `90210`
   - Schedule: One-time
   - Date/time: any future date
   - Max players: `2`
   - Description: `Testing private visibility`
   - Visibility: select **Private**
4. Submit the form

**Verify:**
- You are redirected to the gathering detail page
- The page shows an "Invite Link" section with a URL containing `?code=`
- Copy the invite link URL — you'll need it for Test 5
- The Players section shows "0/2 joined"

**Report:** Pass/fail. Include the invite link URL in your report.

---

## Test 3: Join a Public Gathering

**Goal:** Verify a non-host user can join a public gathering.

1. Log out of Account A
2. Log in as Account B (SmokeJoiner)
3. Navigate to the public gathering created in Test 1 (use the URL you recorded)

**Verify before joining:**
- The detail page is visible (public gathering is accessible)
- There is a "Join Game" button visible
- The Players section shows "0/3 joined"

4. Click the "Join Game" button

**Verify after joining:**
- The page refreshes/updates
- The Players section now shows "1/3 joined"
- Your display name "SmokeJoiner" appears in the player list
- The "Join Game" button is replaced by a "Leave Game" button

**Report:** Pass/fail, and note the exact state of the participants section.

---

## Test 4: Leave a Gathering

**Goal:** Verify a participant can leave a gathering.

1. Still on the public gathering detail page as Account B
2. Click the "Leave Game" button

**Verify:**
- The Players section goes back to "0/3 joined"
- "SmokeJoiner" no longer appears in the player list
- The "Join Game" button is back

**Report:** Pass/fail.

---

## Test 5: Join a Private Gathering via Invite Link

**Goal:** Verify a user can join a private gathering using the invite link.

1. Still logged in as Account B (SmokeJoiner)
2. Navigate directly to the invite link URL from Test 2 (the one with `?code=...`)

**Verify:**
- The private gathering detail page loads
- A "Join Game" button is visible (the code was in the URL)

3. Click "Join Game"

**Verify after joining:**
- The Players section shows "1/2 joined"
- "SmokeJoiner" appears in the player list

**Report:** Pass/fail.

---

## Test 6: Private Gathering Requires Code

**Goal:** Verify a private gathering cannot be joined without the code.

1. Still logged in as Account B
2. Navigate to the private gathering URL but WITHOUT the `?code=` parameter (just `/gatherings/{id}`)

**Verify:**
- The gathering detail page loads (the page itself is accessible)
- If the user is not already a participant, there should be some way to enter a join code, or if they are already joined from Test 5, they should see "Leave Game"
- If you left the gathering first: trying to join without a code should either show a code input field or fail with an error

**Report:** Describe what you see. The key question: is a private gathering joinable without knowing the code?

---

## Test 7: Search Excludes Private Gatherings

**Goal:** Verify private gatherings don't appear in search results.

1. Navigate to the search page
2. Search with zip code `90210`

**Verify:**
- "Smoke Test Public Game" appears in results (or would if active)
- "Smoke Test Private Game" does NOT appear in results

**Report:** Pass/fail. List which gatherings appeared in results.

---

## Test 8: Dashboard Shows Joined Gatherings

**Goal:** Verify the dashboard "My Games" section works.

1. Log in as Account B (SmokeJoiner) if not already
2. First, make sure Account B has joined at least one gathering (re-join the public gathering from Test 1 if needed)
3. Navigate to the dashboard

**Verify:**
- There is a section for gatherings you've joined (separate from hosted gatherings)
- The joined gathering appears with its title and a "Joined" or "Waitlisted" badge
- Clicking the title links to the gathering detail page

**Report:** Pass/fail. Describe the layout and content of the "My Games" section.

---

## Test 9: Waitlist When Full

**Goal:** Verify that joining a full gathering puts you on the waitlist.

This test requires the public gathering from Test 1 (max 3 players) to be full. Since we only have 2 test accounts, we can verify the concept with the private gathering (max 2 players) if Account B is already joined.

1. Log in as Account A (SmokeHost)
2. Navigate to the private gathering from Test 2
3. Check the player count — if it shows "1/2 joined" (Account B is there), then Account A is the host and can't join. We need a different approach.

**Alternative:** Use the public gathering (max 3). Join as Account B. Since we can't easily create a 3rd account in this flow, just verify:
- When Account B joins and the count is below max, status is "Joined"
- The waitlist badge/indicator exists in the UI code (verify the UI is prepared for it)

**Report:** Describe what you observe about the player count and join status. Note if the UI appears ready to handle a "Waitlisted" state.

---

## Test 10: Host Cannot Join Own Gathering

**Goal:** Verify the host doesn't see a join button on their own gathering.

1. Log in as Account A (SmokeHost)
2. Navigate to the public gathering from Test 1

**Verify:**
- There is NO "Join Game" button
- The host sees Edit/Close buttons instead
- The Players section is visible with the participant list

**Report:** Pass/fail.

---

## Summary Report Format

After running all tests, provide a summary:

```
PARTICIPANT SYSTEM SMOKE TEST RESULTS
=====================================
Test 1 (Create Public Gathering):    PASS/FAIL — [notes]
Test 2 (Create Private Gathering):   PASS/FAIL — [notes]
Test 3 (Join Public Gathering):      PASS/FAIL — [notes]
Test 4 (Leave Gathering):            PASS/FAIL — [notes]
Test 5 (Join via Invite Link):       PASS/FAIL — [notes]
Test 6 (Private Requires Code):      PASS/FAIL — [notes]
Test 7 (Search Excludes Private):    PASS/FAIL — [notes]
Test 8 (Dashboard My Games):         PASS/FAIL — [notes]
Test 9 (Waitlist):                   PASS/FAIL — [notes]
Test 10 (Host Can't Join):           PASS/FAIL — [notes]

ISSUES FOUND:
- [list any bugs, UI problems, or confusing flows]

UI USABILITY NOTES:
- [list any flows that were hard to figure out without specific element references]
```
