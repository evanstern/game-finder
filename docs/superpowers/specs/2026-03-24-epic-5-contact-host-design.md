# Epic 5: Contact Host — Design Spec

## Overview

The final piece of the user journey. A visitor (anonymous or logged-in) can send a message to a gathering's host directly from the details page. The message is delivered via email. No messages are stored in the database — this is fire-and-forget. A Redis-based rate limiter prevents abuse.

## Key Decisions

- **Email provider:** Console-logging stub for now. An `EmailService` interface provides a clean swap point for a real provider (Resend, SendGrid, etc.) later.
- **No database storage:** Messages are not persisted. No new tables.
- **Rate limiting:** Redis sliding window — 5 messages per IP per rolling hour.
- **Form placement:** Below the Markdown description on the gathering details page.
- **Pre-fill:** Logged-in users get name and email pre-filled from their account.
- **Success UX:** Toast notification, form resets for potential follow-up.

---

## API Layer

### tRPC `contact` router

New router added to the root router alongside `auth`, `game`, and `gathering`.

| Procedure | Type | Input | Output | Auth |
|-----------|------|-------|--------|------|
| `contact.send` | mutation | `SendContactMessageInput` | `{ success: true }` | Public |

### `SendContactMessageInput` (Zod schema in `packages/contracts`)

```typescript
{
  gatheringId: string  // uuid, required
  senderName: string   // 1-100 chars, required
  senderEmail: string  // valid email, required
  message: string      // 1-2000 chars, required
}
```

### Procedure behavior

1. Rate limit check — 5 messages per IP per hour via Redis. Throw `TOO_MANY_REQUESTS` if exceeded.
2. Look up gathering by ID (must exist and have `status = 'active'`). Throw `NOT_FOUND` if missing or closed.
3. Look up host user by `gathering.host_id` to get their email and display name.
4. Call `emailService.sendContactMessage(...)` with host email, sender info, gathering title, and message body.
5. Return `{ success: true }`.

If the user is logged in, the procedure uses the form-submitted name/email (not the session). This lets logged-in users use a different contact email if they choose.

### Validation schema (`packages/contracts`)

New file `src/contact.ts`:

- `sendContactMessageSchema` — gatheringId (uuid string), senderName (1-100 chars), senderEmail (valid email), message (1-2000 chars)

### Error handling

| Scenario | tRPC code | Message |
|----------|-----------|---------|
| Gathering not found or closed | `NOT_FOUND` | "Gathering not found" |
| Rate limit exceeded | `TOO_MANY_REQUESTS` | "Too many messages. Please try again later." |

All other errors (invalid input) are handled by Zod validation in the tRPC pipeline.

---

## Email Service

### Interface — `apps/server/src/services/email.ts`

```typescript
interface EmailService {
  sendContactMessage(params: {
    toEmail: string
    toName: string
    fromName: string
    fromEmail: string
    gatheringTitle: string
    gatheringId: string
    message: string
  }): Promise<void>
}
```

### `ConsoleEmailService`

The only implementation for now. Logs a formatted block to stdout:

```
══ Contact Message ══
To: GameMaster42 <host@example.com>
From: Jane Doe <jane@example.com>
Re: Friday Board Game Night
──
Hey, I'd love to join your group! I've played Catan a few times...
════════════════════
```

### Context injection

The email service is instantiated once and passed into the tRPC context (alongside `db`, `redis`). Procedures access it via `ctx.emailService`.

### Future swap

Implement `ResendEmailService` (or another provider) with the same interface, toggle based on an env var (e.g., `EMAIL_PROVIDER=resend`), and nothing else changes.

---

## Rate Limiting

### Rate limiter — `apps/server/src/services/rate-limiter.ts`

Standalone utility, not middleware. Called explicitly by the `contact.send` procedure.

```typescript
interface RateLimiter {
  check(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }>
}
```

### Implementation

Simple sliding window using Redis:

- **Key pattern:** `rate:contact:{ip}`
- **Limit:** 5 messages per IP per rolling 60-minute window
- **Mechanism:** Redis `INCR` + `EXPIRE`. On first request, set key with 3600s TTL. On subsequent requests, increment and check count. If count > 5, reject.
- **IP extraction:** From Hono request context (`c.req.header('x-forwarded-for')` or connection remote address)

### Context injection

The rate limiter is passed into the tRPC context alongside `emailService`, `db`, and `redis`.

---

## Web Layer

### Contact form component — `apps/web/app/components/contact-form.tsx`

**Props:** `gatheringId`, `gatheringTitle`, and optionally `user` (logged-in user's name/email for pre-filling).

### Placement

Below the Markdown description on the gathering details page (`/gatherings/:id`), separated by a heading: "Interested? Send the host a message."

### Form fields

- Name (text input, pre-filled if logged in)
- Email (email input, pre-filled if logged in)
- Message (textarea, ~4 rows)
- Submit button: "Send Message"

### Behavior

- Calls `trpc.contact.send` mutation on submit
- On success: toast notification ("Message sent! The host will receive your email shortly."), form resets
- On validation error: inline field-level errors (same pattern as login/signup forms from Epic 2)
- On rate limit error: toast with the rate limit message
- On gathering not found: toast with error (edge case — gathering closed between page load and submit)
- Submit button shows loading state during the request

### Visibility

The contact form is hidden when the current user is the gathering's host. For everyone else — anonymous or logged-in — it's visible.

### New Shadcn components (`packages/ui`)

- `Textarea` — for the message field (may already exist from Epic 3, add if missing)
- `Toast` / `Sonner` — for success and error notifications (add if not already present)

Use whatever components already exist from previous epics; add only what's missing.

---

## Testing

### Server integration tests (Vitest)

**`contact.send` procedure:**
- Happy path — sends message to host, returns `{ success: true }`
- Gathering not found — throws `NOT_FOUND`
- Closed gathering — throws `NOT_FOUND`
- Invalid input — missing/invalid fields rejected by Zod
- Rate limit exceeded — throws `TOO_MANY_REQUESTS` after 5 messages
- Logged-in user can send — works the same as anonymous

**Rate limiter (unit tests):**
- Allows requests under the limit
- Blocks requests over the limit
- Window expires and resets the count

**Email service:**
- `ConsoleEmailService` calls `console.log` with expected format (basic smoke test)

### Web tests

Not in scope — consistent with Epics 2, 3, and 4. Server integration tests cover the business logic.

---

## Exit Criteria

A user (anonymous or logged-in) can:

1. View the contact form on a gathering details page (below the description)
2. Fill in name, email, and message (pre-filled if logged in)
3. Submit the form and see a toast confirmation
4. The host "receives" the message (logged to console in dev)
5. Submitting more than 5 messages in an hour is blocked with a rate limit error
6. The contact form is not shown to the gathering's own host
7. Attempting to contact a closed or nonexistent gathering shows an error
