# NagarMitra — Security at Scale Design Spec
**Date:** 2026-06-26  
**Status:** Approved — ready for implementation  
**Scope:** Server-side security middleware for Cloud Run + Node backend. No Firebase Console or Cloud Run config changes — all via AI Studio build prompts.

---

## 1. Problem Statement

NagarMitra's API endpoints (`/api/analyze`, `/api/chat`, `/api/watchdog`, `/api/escalate-notice`) are currently open — no authentication, no rate limiting, no input validation. At scale (1000+ concurrent users), four threats emerge:

| Threat | Impact |
|---|---|
| Gemini quota exhaustion (spam `/api/analyze`) | App dies for all users including judges |
| Fake data flood | Dashboard fills with garbage; demo integrity lost |
| Availability under real load | Cloud Run overwhelmed; timeouts for everyone |
| Privacy / data leak | Citizen photos and location exposed or stored insecurely |

---

## 2. Architecture

A single `security.ts` middleware module sits in front of all routes. The existing pipeline (vision → routing → dedup → drafting → watchdog) is **not touched**. The module executes four layers in order:

```
Incoming request
      │
      ▼
[1] IP Rate Limiter       ← reject if over per-endpoint limit
      │
      ▼
[2] Payload Guard         ← reject body >2 MB or wrong Content-Type
      │
      ▼
[3] Input Validator       ← validate lat/lng, base64 signature, string lengths
      │
      ▼
[4] HMAC Token Check      ← /api/analyze only: verify short-lived session token
      │
      ▼
[5] Existing pipeline     ← UNCHANGED
```

Every rejection returns structured JSON — never a raw stack trace. The frontend reads the error and shows a human-readable message.

---

## 3. Rate Limiting

**Algorithm:** Sliding window counter per client IP, stored in a server-side `Map<string, {count, windowStart}>`. No Redis or external service needed. A `setInterval` every 5 minutes purges expired entries to prevent unbounded memory growth.

**Critical Cloud Run prerequisite:** Cloud Run places a load balancer in front of all instances. Without `app.set('trust proxy', true)` in Express, `req.ip` returns the load balancer IP — meaning all users share one IP and would be blocked together. The implementation must set `trust proxy` so Express reads the real client IP from the `X-Forwarded-For` header.

**Limits:**

| Endpoint | Limit | Window | Reason |
|---|---|---|---|
| `POST /api/analyze` | 10 req | 60 s | Gemini vision call — most expensive |
| `POST /api/chat` | 20 req | 60 s | LLM call per message |
| `POST /api/escalate-notice` | 5 req | 300 s | Generates multiple Gemini drafts |
| `POST /api/watchdog` | 3 req | 300 s | Reinforces existing 3/click cap |
| All other routes | 60 req | 60 s | Read-only / lightweight |

**On limit hit:** HTTP 429 with `Retry-After` header + `{ error: "rate_limit", retryAfter: <seconds>, message: "Too many requests — please wait X seconds" }`. Frontend displays a countdown timer.

---

## 4. Payload Guard

- `express.json({ limit: '2mb' })` — rejects oversized bodies before parsing. A valid compressed civic photo (max 900px, q60) is ~150–300 KB in base64; 2 MB is a generous ceiling.
- Requests with `Content-Type` other than `application/json` are rejected with HTTP 415.

---

## 5. Input Validation

Field-by-field checks on every write endpoint.

**`/api/analyze`:**

| Field | Rule | Action if invalid |
|---|---|---|
| `imageBase64` | Must start with `/9j/` (JPEG), `iVBOR` (PNG) | HTTP 400, field name in error |
| `mimeType` | Must be `image/jpeg`, `image/png`, or `image/webp` | HTTP 400 |
| `lat` | Number, −90 to 90, not NaN/Infinity | HTTP 400 |
| `lng` | Number, −180 to 180, not NaN/Infinity | HTTP 400 |
| `note` | String, max 500 chars | Truncate silently (UX-friendly) |

**`/api/chat`:**

| Field | Rule | Action if invalid |
|---|---|---|
| `message` | String, 1–1000 chars; HTML tags stripped before Gemini | HTTP 400 if empty/over limit |

---

## 6. HMAC Session Token

Protects `/api/analyze` from headless API abuse (raw curl, scripts that never loaded the app).

**Token issuance:**
- `GET /api/token` returns `{ token, expiresIn: 1800 }` (30-minute TTL)
- Token is `base64(ip + ":" + timestamp + ":" + HMAC-SHA256(ip+timestamp, secret))`
- Secret is generated at server startup with `crypto.randomBytes(32)` (resets on cold start — acceptable for demo; persistent env var in production)
- Stateless — no DB lookup needed to verify

**Token verification on `/api/analyze`:**
- Request must include header `X-Session-Token: <token>`
- Server verifies: valid HMAC + not expired + IP matches originating IP
- Invalid → HTTP 401 `{ error: "invalid_token" }`

**Frontend behaviour:**
- Fetches `/api/token` once on app load, stores in memory (not localStorage)
- Silently refreshes 5 minutes before expiry
- On 401, refreshes token and retries once automatically

---

## 7. Gemini Budget Guard

Server-side call counter prevents quota exhaustion even if rate limiting is bypassed.

**Counters (per server instance):**
- `geminiCallsThisMinute` — resets every 60 s
- `geminiCallsToday` — resets at midnight IST (18:30 UTC)

**Hard limits:**
- 10 vision calls/minute (free-tier RPM safety margin)
- 200 vision calls/day (leaves headroom for watchdog + chat + escalations)

On limit: HTTP 503 `{ error: "capacity", retryAfter: <seconds> }`

---

## 8. Graceful Degradation

| Failure | User sees |
|---|---|
| Rate limited (429) | Countdown timer: "Try again in Xs" |
| Gemini at capacity (503) | "Our AI is busy — try in a few minutes" + manual category option |
| Gemini timeout | "Analysis took too long — try a clearer photo" |
| Invalid input (400) | Highlighted field + specific message |
| Token invalid (401) | Silent refresh + one automatic retry |

---

## 9. Privacy Properties

- **Photos never stored server-side.** They travel as base64 in the POST body, are passed directly to Gemini, and are never written to disk, Firestore, or any log.
- **Location data** (lat/lng) is stored per ticket in Firestore with no PII (no name, no phone, no email attached to a report unless explicitly provided).
- **No third-party analytics** or tracking scripts are included in the frontend.

---

## 10. Production Architecture (post-hackathon)

At true scale (millions of users), the in-memory approach gives way to:

| Concern | Hackathon (now) | Production |
|---|---|---|
| Rate limiting | In-memory Map per instance | Redis / Firestore-backed counter (survives cold starts + multi-instance) |
| Auth | HMAC session token | Firebase Auth (Anonymous → upgrade to Google/phone) + Firebase App Check |
| DDoS | Cloud Run's built-in limits | Cloud Armor (WAF, geo-blocking, adaptive protection) |
| API key protection | Server-side env var (AI Studio) | Secret Manager + VPC-SC perimeter |
| Content moderation | Image type check + size cap | Gemini SafetySettings + Cloud Vision SafeSearch |
| Quota management | In-memory counter | Quotas API + per-user Firestore counters + billing alerts |
| Audit trail | None | Cloud Audit Logs + BigQuery export |

---

## 11. Implementation

All changes go into a single new file `server/security.ts` registered as Express middleware in `server.ts` before all route handlers. Delivered via one AI Studio build prompt (see implementation plan).
