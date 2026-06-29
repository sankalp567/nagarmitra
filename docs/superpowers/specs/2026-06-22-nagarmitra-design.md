# NagarMitra — Design Spec

**Hackathon:** Vibe2Ship (Coding Ninjas × Google for Developers), inaugural 2026 edition
**Build phase:** 22 Jun 2026 3:00 PM → submission deadline 29 Jun 2026 2:00 PM
**Builder:** Solo, full-time
**Problem statement selected:** PS2 — Community Hero (Hyperlocal Problem Solver)
**Mandatory tooling:** Google AI Studio (core build + deploy)
**Status:** Approved design — ready to convert into an implementation plan

---

## 1. Problem statement & why we chose it

PS2 asks for a platform that lets citizens **identify, report, validate, track, and resolve**
community issues (potholes, water leaks, broken streetlights, waste) with transparency and
accountability.

We chose PS2 over PS1 ("Last-Minute Life Saver") because, for a solo full-time build judged on
this matrix, it has the better **risk-adjusted** shot at winning:

- **Demo reliability:** the killer behavior is multimodal (photo → analysis), which is rock-solid
  to demo. PS1's killer behavior (writing to your calendar/Gmail) needs Google OAuth — the single
  most common hackathon demo-breaker and a real solo time sink.
- **Impact & resonance:** a concrete, locally relevant civic problem reads stronger to (likely
  India-based) judges than "another productivity tool." We localize to Gandhinagar / Ahmedabad.
- **Innovation:** photo → severity → department routing → auto-drafted formal complaint →
  escalation watchdog is genuinely unseen in existing civic apps.
- **Google tech showcase:** Gemini multimodal + function calling + embeddings + Maps + Firebase,
  with zero OAuth fragility.

## 2. Evaluation matrix (the scoreboard we optimize for)

| Criteria | Weight | How NagarMitra targets it |
|---|---|---|
| Problem Solving & Impact | 20% | Solves routing failure + citizen helplessness; locally grounded |
| Agentic Depth | 20% | Planner→tools→reflect loop + proactive escalation watchdog |
| Innovation & Creativity | 20% | Photo→formal bilingual complaint→autonomous escalation |
| Usage of Google Technologies | 15% | Gemini (vision, function calling, embeddings) + Maps + Firebase + AI Studio/Cloud Run |
| Product Experience & Design | 10% | Clean hero flow; live streaming agent reasoning panel |
| Technical Implementation | 10% | Multimodal + embeddings dedup + retries/fallbacks |
| Completeness & Usability | 5% | Pre-seeded data, no auth dependency, full vertical slice |

Agentic Depth + Innovation + Problem Solving = **60%**. Google tech = another 15%. The design
concentrates effort there.

## 3. Solution overview

**NagarMitra** ("City Friend") turns a single photo of a civic problem into a resolved issue.
A Gemini agent **sees** the problem, **scores** its severity, **routes** it to the correct
municipal officer, **writes** the formal complaint (Hindi + English), and then **chases it on its
own** until it's resolved.

**Hero demo moment:** Upload a pothole photo. The agent's reasoning streams live on screen
("detected pothole ~40cm near a storm drain, severity 4/5 → routing to AMC Roads Dept, Ward 3 →
drafting complaint…"). Out comes a ready-to-send bilingual complaint, a pin on the civic map, and
a tracked ticket. Days later a **watchdog agent wakes up on its own** and escalates because nobody
acted. "It acted without me asking" is the beat that wins Agentic Depth.

## 4. Agentic architecture

A single **Orchestrator agent** runs a plan → call-tool → reflect loop over Gemini function
calling, coordinating a tool belt. State lives in Firestore. Each unit below is independently
understandable and testable.

### 4.1 Orchestrator agent
- **What it does:** receives a report, plans the sequence of tool calls, feeds results back into
  reasoning, decides new-vs-duplicate, and emits the final complaint + ticket.
- **Model:** `gemini-3.5-flash` (fast, strong at agentic/coding/function-calling).
- **Depends on:** the four tools below + Firestore.
- **Visible behavior:** every step is streamed to the UI activity panel.

### 4.2 Vision analyst (tool)
- **What it does:** image (+ optional note) → structured JSON `{issue_type, description,
  severity 1–5, hazards[], confidence}`.
- **Model:** `gemini-3.1-pro-preview`, structured output via `responseSchema`.
- **Depends on:** photo in Firebase Storage.

### 4.3 Geo-router (tool)
- **What it does:** reverse-geocodes GPS → ward/zone, then looks up responsible department +
  officer designation + contact channel from the seeded routing table.
- **Depends on:** Google Maps Geocoding API + `departments` collection.

### 4.4 Duplicate detector (tool)
- **What it does:** embeds the issue description and checks semantic + geo proximity against open
  reports. On match: link the new reporter as a **co-witness** instead of creating a new ticket
  (a genuine agentic decision).
- **Depends on:** Gemini embeddings + `reports` collection.

### 4.5 Complaint drafter (tool)
- **What it does:** generates a formal complaint letter in **Hindi + English**, addressed to the
  routed officer, citing severity and location; output is a shareable artifact (copy / PDF /
  WhatsApp / email deep-link).
- **Model:** `gemini-3.5-flash`. (Stretch: Google Search grounding for bylaw citations.)

### 4.6 Escalation watchdog (proactive agent)
- **What it does:** scans open tickets, detects ones past SLA, auto-drafts an escalation notice to
  the next authority tier, and notifies the citizen with one-tap send — **with no user prompt**.
- **Implementation:** real scheduled Cloud Run cron if time allows; for judging, a **"simulate
  time" button** triggers the identical logic on demand so judges see it act live.
- **Depends on:** `reports` collection + complaint drafter.

### 4.7 Self-correction
- On low Vision confidence (blurry/ambiguous photo) the orchestrator **asks the user a clarifying
  question** inline rather than guessing. Visible self-correction = agentic-depth signal.

## 5. Screens / UX

1. **Report screen (hero):** "Report an issue" CTA → capture/upload photo, auto-grab GPS (manual
   map-pin fallback), optional voice/text note. On submit, a **live agent activity panel** streams
   the orchestrator's reasoning and tool calls (Vision → Router → Dedup → Drafter), ending in the
   drafted complaint + created ticket. Inline clarifying question on low confidence.
2. **Ticket detail:** the generated **bilingual complaint** (copy / download PDF / share to
   WhatsApp or email via deep-link), photo, severity, routed department + officer, status
   timeline, and a "simulate time passing" control that fires the watchdog's auto-escalation.
3. **Civic map + impact dashboard:** public Google Map with severity-colored pins, filters
   (category / ward / status), and an impact strip (reported / resolved / avg resolution time /
   top wards). **Pre-seeded with ~15–20 realistic Gandhinagar–Ahmedabad issues.**
4. **(Thin) My reports / co-witness:** list of the user's tickets and ones co-witnessed via dedup
   merges.

## 6. Data model (Firestore)

- **`reports`** — `photoUrl`, `geo{lat,lng,ward,zone}`, `category`, `severity` (1–5),
  `aiAnalysis{description,hazards,confidence}`, `department`, `officer`, `complaintHi`,
  `complaintEn`, `status` (`open→acknowledged→escalated→resolved`), `createdAt`,
  `lastEscalatedAt`, `coWitnesses[]`, `embedding`, `duplicateOf` (nullable).
- **`departments`** — seeded routing table: ward/zone → department + officer designation +
  contact channel (Gandhinagar Municipal Corp + AMC, ~5–10 wards).
- **`agentRuns`** *(optional)* — per-report step trace `{tool, input, output, timestamp}`; doubles
  as on-screen proof of agentic depth.

## 7. Tech stack & Google technologies

| Layer | Tech | Role |
|---|---|---|
| Build + deploy | **Google AI Studio → Cloud Run** | Mandatory; scaffolds React app, Publish → live URL, Gemini key stays server-side |
| Reasoning (vision) | **Gemini `3.1-pro-preview`** | Multimodal: type + severity + hazards (structured JSON) |
| Orchestration | **Gemini `3.5-flash`** | Function-calling loop + complaint drafting |
| Dedup | **Gemini embeddings** | Semantic + geo duplicate detection |
| Map / geo | **Google Maps Platform** | Map + pins, Geocoding (GPS → ward) |
| Data / auth / files | **Firebase** | Firestore, Storage (photos), Auth (anon + Google) |
| Frontend | **React** (AI Studio default) | Clean, responsive UI |

5+ distinct Google products, used intentionally. **Stretch:** `gemini-3.1-flash-live-preview`
(voice reporting); Google Search grounding (bylaw citations).

**Key handling:** Gemini API calls run server-side via the deployed Cloud Run backend (key never
in client bundle). Maps JS key is client-side but referrer-restricted. Firebase config is
client-side (normal).

## 8. Demo script (2–3 min)

1. **Hook (0:20):** "Spot a pothole in India — who do you complain to, in what format, how do you
   follow up? Most people give up; reported issues die in an inbox."
2. **Live hero run (0:20→1:40):** upload photo → agent panel streams Vision→Router→Dedup→Drafter →
   bilingual complaint + new map pin. Show a blurry photo triggering the clarifying question.
3. **Unprompted moment (1:40→2:10):** hit "simulate 7 days" → watchdog wakes, sees no action,
   auto-escalates. "I never asked it to."
4. **Impact + Google tech (2:10→2:30):** dashboard metrics + "built entirely on Google AI Studio +
   Gemini multimodal + Maps + Firebase."
5. **Architecture flash (2:30→2:40):** the agent diagram.

## 9. Seven-day build schedule

| Day | Date | Goal | Output |
|---|---|---|---|
| 1 | Sun 22 Jun (from 3pm) | Smoke-test the whole pipe. Create AI Studio app; **verify Starter-tier eligibility (do NOT link Cloud billing)**; deploy React skeleton to Cloud Run with one real Gemini call. Init GitHub repo + Firebase + Maps key. Lock data model. Confirm AI Studio front/back split. | Deployed skeleton calling Gemini live |
| 2 | Mon 23 Jun | Vision pipeline: photo → Storage → `3.1-pro` → structured JSON. Report screen + streaming agent panel. Seed `departments`. | Photo → live AI analysis on screen |
| 3 | Tue 24 Jun | Orchestrator + function-calling tool belt: Geo-router + Drafter (bilingual). Full report→complaint flow. **Mentor session 4–6pm.** | End-to-end report → complaint |
| 4 | Wed 25 Jun | Embeddings dedup + co-witness merge. Civic map (pins, filters) + impact strip. Pre-seed 15–20 issues. | Map + dashboard alive |
| 5 | Thu 26 Jun | Escalation watchdog + "simulate time" trigger + auto-escalation. Low-confidence clarifying question. Ticket detail (copy/PDF/share, timeline). **Feature-freeze EOD.** | Feature-complete |
| 6 | Fri 27 Jun | Polish: UI + thinking states, error handling/retries everywhere, responsive, redeploy with `min-instances=1`. Write project-description Google Doc. | Hardened, polished build |
| 7 | Sat 28 Jun | Record 2–3 min demo video, finalize README (architecture + Google-tech list), final deploy verify, **submit on BlockseBlock**. | Submitted, with buffer day spare |
| Buffer | Sun 29 Jun (pre-2pm) | Re-verify live link + quota 30 min before; submit if anything slipped. | Safety net |

## 10. Scope boundaries (YAGNI — deliberately NOT building)

- No real municipal API integration (none exists; complaints go via shareable letter / WhatsApp /
  email deep-links).
- No authority/admin console (that was the rejected Approach B).
- No gamification / leaderboards / social feed (rejected Approach C).
- No native mobile app — responsive web only.
- No payments; no notification infra beyond share deep-links (optional single email send).
- No multi-city scale — Gandhinagar / Ahmedabad only.

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Free Starter-tier disqualification | Verify Day 1; **do not link a Cloud billing account** before the deploy smoke test. Fallback: clean Google account, or the AI Pro $10 Cloud credits as a standard-project route. |
| Gemini rate limits during judging | Use `3.5-flash`; retry with exponential backoff; pre-warm before demo; consider a cached known-good demo run. |
| "Looks like a CRUD app" | Stream the agent's reasoning + tool calls live — core design choice, not optional. |
| Cloud Run cold starts | `min-instances=1` before judging. |
| API keys exposed | Gemini server-side via Cloud Run; Maps key referrer-restricted; Firebase config is expected client-side. |
| AI Studio front/back split uncertainty | Day-1 smoke test before committing architecture. |
| Vision misclassifies on stage | Self-correction clarifying question + a vetted known-good demo photo set. |
| Scope creep | Hard feature-freeze EOD Day 5; this YAGNI list is binding. |
| Live link dies during eval | Re-verify link + quota 30 min before submit and during the eval window. |

## 12. Submission checklist (mandatory)

- [ ] **Deployed app link** — public, functional, via Google AI Studio (Cloud Run); stays live through eval.
- [ ] **GitHub repo** — code + README (architecture diagram, Google-tech list, setup steps).
- [ ] **Project description Google Doc** — Problem Statement Selected, Solution Overview, Key
      Features, Technologies Used, Google Technologies Utilized; link-shared; keep version history.
- [ ] Submitted only via the **BlockseBlock** platform before **29 Jun 2:00 PM**.

## 13. Day-1 verifications (resolve before committing)

1. Starter-tier deploy works on this Google account (billing untouched).
2. How AI Studio Build structures frontend vs backend, and where our Gemini calls live.
3. Firebase project wired (Firestore, Storage, anon Auth) and reachable from the deployed app.
4. Maps API key created and referrer-restricted to the Cloud Run domain.
