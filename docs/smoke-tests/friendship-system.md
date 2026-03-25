# Smoke Tests: Friendship System

These are flow-based test instructions for an AI agent with browser access (Playwright). Describe what to do, not which elements to click. If the agent can't figure out the flow, that's a signal the UI needs work.

**Base URL:** `http://localhost:3000`

**Prerequisites:** The app is running with participant system and friendship system migrations applied. The two test accounts from the participant system smoke tests should exist (SmokeHost / smokehost@test.com and SmokeJoiner / smokejoiner@test.com, both with password testpassword123). Both should share at least one gathering (SmokeJoiner joined SmokeHost's public gathering).

If the test accounts don't exist or don't share a gathering, create them and have SmokeJoiner join one of SmokeHost's public gatherings first.

---

## Test 1: Send Friend Request from Gathering Page

**Goal:** Verify a user can send a friend request to someone they share a gathering with.

1. Log in as Account B (SmokeJoiner)
2. Navigate to a gathering where both Account A (SmokeHost) and Account B are participants (or Account A is the host)
3. Look at the participant list and/or the "Hosted by" section

**Verify before sending:**
- There should be an "Add Friend" button or link next to Account A's name (SmokeHost)
- There should NOT be an "Add Friend" button next to your own name

4. Click the "Add Friend" button next to SmokeHost

**Verify after sending:**
- The "Add Friend" button is replaced with a "Pending" indicator
- The page does not show an error

**Report:** Pass/fail. Note where the Add Friend button appeared (participant list, host section, or both).

---

## Test 2: Nav Badge Shows Request Count

**Goal:** Verify the nav bar shows a friend request count badge.

1. Log in as Account A (SmokeHost) — this is the person who received the friend request
2. Look at the navigation bar

**Verify:**
- There is a "Friends" link in the nav
- There is a badge/count indicator showing at least 1 pending request
- The badge is visible without scrolling

**Report:** Pass/fail. Describe what the badge looks like and where it appears.

---

## Test 3: View and Accept Friend Request

**Goal:** Verify the /friends page shows incoming requests and they can be accepted.

1. Still logged in as Account A (SmokeHost)
2. Navigate to the Friends page (click the Friends link in the nav)

**Verify before accepting:**
- There is a "Friend Requests" section
- SmokeJoiner's request appears with their display name
- There are Accept and Decline buttons

3. Click Accept on SmokeJoiner's request

**Verify after accepting:**
- The request disappears from the requests section
- SmokeJoiner appears in the "My Friends" section
- The nav badge count updates (should be 0 now, badge may disappear)

**Report:** Pass/fail. Describe the layout of both sections.

---

## Test 4: Friend Appears in Both Users' Lists

**Goal:** Verify the friendship is bidirectional.

1. Log out of Account A
2. Log in as Account B (SmokeJoiner)
3. Navigate to the Friends page

**Verify:**
- SmokeHost appears in the "My Friends" section
- There are no pending requests (the request was accepted, not waiting)

**Report:** Pass/fail.

---

## Test 5: Friend Badge on Gathering Detail Page

**Goal:** Verify "Friend" badge appears next to friends on gathering pages.

1. Still logged in as Account B (SmokeJoiner)
2. Navigate to a gathering that SmokeHost is hosting or participating in

**Verify:**
- Next to SmokeHost's name, there is a "Friend" indicator (not "Add Friend")
- The "Add Friend" button is NOT shown for SmokeHost

**Report:** Pass/fail. Describe what you see next to the host/participant name.

---

## Test 6: Friend Activity Feed

**Goal:** Verify the friend activity page shows gatherings friends are involved in.

1. Log in as Account B (SmokeJoiner)
2. Navigate to /friends/activity (via the Friends page link or directly)

**Verify:**
- If SmokeHost has any public, active gatherings that SmokeJoiner is NOT part of, they should appear here
- Each gathering card shows which friend is involved and their role (hosting/playing)
- If SmokeHost has no other gatherings, the empty state should show appropriately

**Report:** Pass/fail. Describe what gatherings appear and the friend badges on them.

---

## Test 7: Dashboard Friend Activity Preview

**Goal:** Verify the dashboard shows a friend activity count/preview.

1. Still logged in as Account B (SmokeJoiner)
2. Navigate to the dashboard

**Verify:**
- There is a "Social" section showing friend activity count
- There is a "View Activity" link/button that goes to /friends/activity
- The count matches what you saw on the activity page

**Report:** Pass/fail. Describe the preview section.

---

## Test 8: Remove Friend

**Goal:** Verify a user can remove a friend.

1. Log in as Account B (SmokeJoiner)
2. Navigate to the Friends page
3. Find SmokeHost in the "My Friends" section
4. Click "Remove" (there may be a confirmation dialog)

**Verify after removing:**
- SmokeHost no longer appears in the friends list
- The "My Friends" section is empty or SmokeHost is gone

5. Navigate back to a gathering page where SmokeHost is present

**Verify:**
- The "Add Friend" button is back (since they are no longer friends)
- The "Friend" badge is gone

**Report:** Pass/fail.

---

## Test 9: Decline Friend Request

**Goal:** Verify declining a friend request works.

1. First, re-establish the setup: Log in as Account B (SmokeJoiner), navigate to a shared gathering, and send a friend request to SmokeHost again
2. Log out. Log in as Account A (SmokeHost)
3. Navigate to the Friends page
4. Decline SmokeJoiner's request

**Verify:**
- The request disappears from the requests section
- SmokeJoiner does NOT appear in the "My Friends" section
- The nav badge updates

**Report:** Pass/fail.

---

## Test 10: Re-send After Decline

**Goal:** Verify that after a declined request, the other user can send a new request.

1. Still logged in as Account A (SmokeHost) — the one who declined
2. Navigate to a shared gathering
3. Look for SmokeJoiner in the participant list

**Verify:**
- The "Add Friend" button should be available again (the declined request was cleaned up)

4. Send a friend request to SmokeJoiner from Account A this time

**Verify:**
- The request is sent successfully (shows "Pending")

**Report:** Pass/fail. Note if the re-send worked or if there was an error.

---

## Summary Report Format

```
FRIENDSHIP SYSTEM SMOKE TEST RESULTS
=====================================
Test 1  (Send Friend Request):        PASS/FAIL — [notes]
Test 2  (Nav Badge):                   PASS/FAIL — [notes]
Test 3  (Accept Request):             PASS/FAIL — [notes]
Test 4  (Bidirectional Friend):        PASS/FAIL — [notes]
Test 5  (Friend Badge on Gathering):   PASS/FAIL — [notes]
Test 6  (Friend Activity Feed):        PASS/FAIL — [notes]
Test 7  (Dashboard Preview):           PASS/FAIL — [notes]
Test 8  (Remove Friend):              PASS/FAIL — [notes]
Test 9  (Decline Request):            PASS/FAIL — [notes]
Test 10 (Re-send After Decline):       PASS/FAIL — [notes]

ISSUES FOUND:
- [list any bugs, UI problems, or confusing flows]

UI USABILITY NOTES:
- [list any flows that were hard to figure out without specific element references]
```
