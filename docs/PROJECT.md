# NagarMitra — Project Document

> **Vibe2Ship Hackathon** (Coding Ninjas × Google for Developers) · Problem Statement 2: Community Hero
> Living document — maintained throughout the build; the submission Google Doc is generated from this.
>
> **Deployed app:** https://nagarmitra-967605381609.asia-southeast1.run.app/
> **GitHub repo:** _(AI Studio–linked `nagarmitra` repo — add link)_
> **Status legend:** ✅ done & verified · 🟡 in progress · ⬜ planned

---

## 1. Problem Statement Selected

**PS2 — Community Hero (Hyperlocal Problem Solver).** Build a platform that lets citizens identify, report, validate, track, and resolve community issues (potholes, water leaks, streetlights, waste) with transparency and accountability.

## 2. Solution Overview

**NagarMitra ("City Friend")** is an agentic civic-issue resolver for Gandhinagar. A citizen photographs a problem and a Gemini-powered agent does the rest: it **sees** the issue, **scores** its severity, **routes** it to the correct municipal department and officer, **drafts** a formal complaint in **English, Hindi, and Gujarati**, **de-duplicates** repeat reports into co-witnessed tickets, and then **autonomously chases resolution** — escalating stalled complaints up a real municipal hierarchy and ultimately auto-drafting an **RTI application** and **SWAGAT / CPGRAMS** filings when deadlines lapse.

### The winning frame
Reporting a civic issue is easy; **getting it resolved is the hard part.** Most complaints die *after* filing — unrouted, unfollowed, unescalated. NagarMitra is not a complaint box; it is an **autonomous accountability agent** that pursues closure on the citizen's behalf. Crucially, it does not fight the government — it **completes what the Gujarat government itself started**: SWAGAT 2.0's auto-escalation (launched Dec 2024) works at the *state* level; NagarMitra applies the same proven model at the **GMC ward level, where no such tool exists today**.

### Real-world impact (sourced)
- Civic complaint resolution time in major Indian cities **drifted from ~30 → ~48 days in three years** (Praja Foundation, Mumbai).
- Of complaints escalated all the way to the Municipal Commissioner, **~98% remained unresolved** — escalation exists on paper, not in practice.
- The MoHUA **Swachhata app** (6M+ complaints) has **no escalation matrix** and is widely cited for fake-photo closures.
- Gujarat's **SWAGAT 2.0** auto-escalation pilot resolved **~90% of grievances within SLA** — proof the model works. _(All figures to be cited with sources in the final doc.)_

## 3. Key Features

- ✅ **Photo-based AI issue analysis** — Gemini vision returns structured issue type, severity (1–5), specific hazards, and a confidence score from a single photo. Model: gemini-2.0-flash / gemini-1.5-flash (fast, timeout-resistant).
- ✅ **AI geo-routing** — the issue category is mapped to the correct GMC department (Roads & Engineering, Water Supply, Solid Waste, Street Lighting, Drainage, etc.) with a **department-matched officer designation**; location maps to the ward.
- ✅ **Trilingual formal complaint drafting** — a ready-to-send complaint in **English, Hindi, and Gujarati** (single Gemini call), using the real ticket reference and real dates (strict anti-fabrication).
- ✅ **Duplicate detection + co-witness** — a new report within 60 m of an existing open report of the same category is merged; the reporter is added as a co-witness. Co-witness count is surfaced prominently on the success screen ("Your report strengthens an existing complaint — N witnesses").
- ✅ **Autonomous Escalation Watchdog (tiered)** — scans open tickets and climbs a real municipal hierarchy by ticket age, all unprompted:
  - **Day 7** → escalation notice to the **Executive Engineer**
  - **Day 14** → escalation notice to the **Deputy Municipal Commissioner**
  - **Day 21** → auto-drafts an **RTI application** (Form 'A', §6(1)/§7(1), RTI Act 2005) + a **SWAGAT 2.0** petition (CM's Secretariat) + a **CPGRAMS** grievance (DARPG, Govt of India)
  - **Day 28** → final summons to the **Municipal Commissioner**
  - Documents share one consistent timeline. Demo controls: "Simulate +7 / +14 / +21 days" with a live virtual clock. RTI/SWAGAT/CPGRAMS documents are copyable to clipboard in one click.
- ✅ **Live agent reasoning panel** — a streaming "Municipal Processing Log" shows each agent step (vision → routing → dedup → drafting → dispatch) with per-step elapsed time.
- ✅ **"What Happens Next" escalation timeline** — after filing, a visual timeline shows the citizen the exact dates when their complaint will be escalated at each tier, calculated from the filing date.
- ✅ **Citizen resolution dispute** — when a ticket is marked resolved, citizen can confirm or dispute. Disputing triggers the next escalation tier automatically.
- ✅ **Civic Map** — Google Maps with severity-colored issue pins and filters.
- ✅ **Impact Dashboard** — total grievances, resolved count, resolution ratio, average clear window, per-ward and per-category breakdowns. Includes sourced "Why This Matters" stats panel.
- ✅ **GMC Ward Civic Health Index** — per-ward health score (0–100) calculated from open tickets, escalation rate, and resolved count. Color-coded: Critical / Needs Attention / Healthy.
- ✅ **Systemic Pattern Bulletin** — detects 2+ same-category issues in the same ward → Gemini auto-drafts a root-cause bulletin for departmental review. Displayed as AI Systemic Alerts on Dashboard.
- ✅ **Search-grounded citations** — real legal references cited under complaints & escalations via Gemini Search grounding, with working source links (e.g., Gujarat GPMC Act §63, RTI Act §6(1), GMC Citizen Charter SLA).
- ✅ **"Ask NagarMitra" chat agent** — ticket-specific chat panel on every ticket detail page; standalone grounded Q&A tab for GMC procedures, RTI Act 2005, SWAGAT 2.0, CPGRAMS. Powered by Gemini + Google Search.
- ✅ **Voice-first reporting** — speak in Hindi, Gujarati, or English → browser Web Speech API transcribes → auto-fills complaint note. Zero quota, zero API key.
- ✅ **Geofence + demo-mode ward picker** — haversine check from Gandhinagar center (23.2156°N, 72.6369°E); judges >20 km away get a manual ward selector so they can file identically to GPS-located citizens.
- ✅ **5-layer security middleware** — trust proxy (Cloud Run), sliding-window IP rate limiter, 2 MB payload guard, input validation (image signature, lat/lng, XSS strip), HMAC session tokens, Gemini budget guard (10 calls/min, 200/day).
- ✅ **WhatsApp share + copy link** — one-tap share of ticket status via WhatsApp; copy ticket URL to clipboard.
- ✅ **Agentic pipeline explainer** — in-app "How NagarMitra Works" 5-step visual on the report page so judges understand the plan→tool→reflect loop without reading docs.
- 🟡 **Visible agent reasoning + confidence** — reasoning card as separate non-blocking GET /api/reasoning/:ticketId (vision pipeline unaffected).
- ⬜ **Predictive "Civic Health Score"** (stretch) — ML-based forecast of which wards will degrade next monsoon season.

## 4. Agentic Architecture

A server-side **orchestrator** runs a plan → call-tool → reflect loop over a **tool belt**:

- **Vision analyst** — image → structured `{issue_type, description, severity, hazards, confidence}`.
- **Geo-router** — location + category → ward + correct department + officer.
- **Duplicate detector** — category + geo-proximity → new ticket vs. co-witness merge.
- **Complaint drafter** — trilingual formal complaint (structured JSON).
- **Escalation watchdog** — a *proactive* agent that runs without a user trigger: detects SLA-breached tickets and climbs the escalation ladder, generating tier-appropriate documents.
- **Self-correction** — on low vision confidence, the agent asks the citizen a clarifying question instead of guessing.

What makes it genuinely *agentic* (not an LLM wrapper): multi-step planning, real tool use, **autonomous unprompted action** (the watchdog), persistent state (tickets/timelines), and visible reasoning.

## 5. Technologies Used

- **Frontend:** React (Google AI Studio–generated)
- **Backend:** Node.js runtime (server-side Gemini calls; keys never client-side)
- **Data:** Firebase Firestore (+ localStorage fallback for offline/demo resilience)
- **SDK:** `@google/genai`
- **Deployment:** Google Cloud Run (via Google AI Studio Publish)

## 6. Google Technologies Utilized

- **Google AI Studio** — core build + deploy tool (mandatory); app authored entirely in Build mode and published to Cloud Run via GitHub integration.
- **Gemini 2.0 Flash / 1.5 Flash** — multimodal vision (issue classification, severity, hazards); agent orchestration; trilingual complaint drafting; escalation/RTI/SWAGAT/CPGRAMS generation; systemic pattern bulletins. All calls server-side.
- **Gemini Search Grounding** — real legal/regulatory citations with verifiable source links on complaints, escalation notices, and Ask NagarMitra chat responses.
- **Google Maps Platform** — civic map with severity-colored pins, ward boundaries, reverse geocoding.
- **Firebase Firestore** — persistence of tickets, timelines, co-witnesses, escalation history (+ localStorage fallback when Firestore quota is exhausted).
- **Google Cloud Run** — scalable serverless hosting (free Starter tier, no billing required).

> Deliberately avoided to protect the free-tier deploy: Firebase Storage / Blaze billing (photos stored as compressed base64 instead).

## 7. Build Process

NagarMitra was designed and built **entirely in Google AI Studio** using its agentic "vibe-coding" Build mode (React + Node + Firebase scaffold), iterated through natural-language prompts, and deployed via Publish → Cloud Run with GitHub integration.

The build was front-loaded with structured planning: a design spec, an implementation plan, and a 5-agent research sweep (market analysis, agentic-depth patterns, Google-tech options, real-world civic data, and demo strategy). Load-bearing pure logic (department routing, duplicate-similarity, watchdog SLA rules) was unit-tested before integration.

**Notable engineering decisions:**
- Dropped embedding-based duplicate detection after it proved unreliable (near-zero cosine, then a failing endpoint that hung the watchdog); replaced it with a robust **category + geo-proximity** rule.
- Hardened the agent against **fabricated facts** — real ticket IDs, dates, and officers are passed in and used verbatim; the watchdog enforces a single consistent escalation timeline.
- Kept all Gemini calls **server-side** and avoided any billing-triggering service to preserve free deployment eligibility.

## 8. Demo Script (2.5 min)

1. **Problem (0:00–0:20)** — "Civic complaints take 48 days to resolve. 98% of escalations to the Commissioner go unresolved. Reporting is easy — getting it fixed is not."
2. **Live report (0:20–0:50)** — upload pothole photo → narrate streaming agent panel (vision → routing → dedup → trilingual draft). Show per-step timing.
3. **Depth (0:50–1:15)** — open ticket: trilingual complaint (EN/HI/GU), "What Happens Next" escalation timeline with real dates, Ask NagarMitra Desk panel.
4. **Hero moment (1:15–1:50)** — Dashboard → "Simulate +21 days" → watchdog autonomously climbs EE → DyMC → auto-drafts **RTI application + SWAGAT 2.0 + CPGRAMS**, unprompted. Copy RTI to clipboard.
5. **Intelligence layer (1:50–2:10)** — Dashboard: Ward Health Index, Systemic Pattern Bulletin auto-generated by Gemini, sourced impact stats.
6. **Scale (2:10–2:30)** — "This completes Gujarat's own SWAGAT 2.0 at the ward level. One AI Studio agent loop. Deployable to any of India's 4,000+ municipalities today."

## 9. Known Constraints & Quota Management

- **Gemini free-tier quota is the real ceiling.** The agentic pipeline makes several Gemini calls per report (vision + trilingual draft + grounding), and the watchdog generates multiple documents per ticket per tier — so heavy testing exhausts the **daily** free-tier quota (HTTP 429). When that happens, Gemini calls fall back to a local stub and every issue classifies as "Others." **This is a quota limit, not a logic bug** — it self-heals on the daily reset (~12:30 AM IST).
- **Quota-conservation measures applied:** Gemini Budget Guard (10 calls/min, 200/day hard limits in server/civicEngine.ts); removed the permanent "quota-exceeded" kill-switch; watchdog capped to ~3 escalations per click; reasoning card moved to a separate non-blocking endpoint.
- **Firestore free-tier read quota** can be exhausted by heavy testing (5-digit daily read limit on Spark tier). App falls back to localStorage automatically; Firestore-independent features (chat, vision, drafting) continue unaffected. Resets at midnight IST.
- **Demo-day plan:** preserve quota before judging; backup demo video recorded on fresh quota as insurance. ✅
- **Deliberately not enabling billing / Firebase Blaze** (would jeopardise the free Cloud Run Starter-tier deploy) — photos are stored as compressed base64 instead of Firebase Storage.
- **Cosmetic:** anonymous Firebase auth returns `auth/admin-restricted-operation` (Anonymous sign-in not enabled in the Firebase console). Does **not** affect analysis; enable in Firebase Console (free, Authentication → Sign-in method → Anonymous) to clear console noise.

## 10. Submission Checklist

- [x] Deployed app link — https://nagarmitra-967605381609.asia-southeast1.run.app/
- [x] Backup demo video recorded ✅
- [ ] Enable Firebase Anonymous Auth (Firebase Console → Authentication → Sign-in method → Anonymous)
- [ ] GitHub repository link + README (export from AI Studio → GitHub)
- [ ] Project-description Google Doc (generated from this file)
- [ ] Submitted via the BlockseBlock platform before **29 Jun 2026, 2:00 PM IST**

---

## Changelog / Build Log

- **22 Jun** — Problem statement chosen (PS2); design spec + implementation plan written; AI Studio scaffold deployed to Cloud Run.
- **23 Jun** — Real Gemini vision wired; trilingual drafting (EN/HI/GU); Firestore persistence; duplicate detection + co-witness; back navigation; proactive escalation watchdog.
- **24 Jun** — Tiered escalation ladder (EE → DyMC → RTI/SWAGAT/CPGRAMS) with consistent dates + audit trail; fixed watchdog hang (dropped embeddings); 5-agent improvement research; Tier 1 complete ✅ (Search grounding, visible reasoning/confidence card + watchdog decision-trace, sourced impact panel); Tier 4 (Commissioner final summons) added to the escalation ladder. Started Tier-2. **Discovered the daily Gemini free-tier quota was exhausted** by heavy testing → all Gemini calls fall back to the stub ("Others") when rate-limited — *not a logic bug; resets daily.* Applied quota fixes (removed permanent kill-switch; backoff + cooldown; watchdog cap; fold reasoning into vision). AI Studio build limit also hit → paused.
- **Resume point (25 Jun, on fresh quota):** strategy is **build all remaining Tier-2 features first, then test together.** (1) Verify vision is real again (garbage → Garbage & Sanitation, pothole → Potholes & Roads). (2) Record the backup demo video. (3) Build/verify Systemic Pattern Bulletin, "Ask NagarMitra" chat, Voice-first (via the **"Transcribe audio"** chip); Predictive Civic Health Score = stretch. (4) Conserve quota throughout. (5) Add GitHub repo link + real stat sources to this doc; enable Anonymous sign-in in Firebase (free) to clear console noise.
- **25 Jun** — A cascade (reasoning-card schema break → quota 429 → stale in-memory kill-switch → broken API route returning HTML → "upstream request timeout") destabilized the build. **Reverted to the pre-reasoning-card checkpoint.** On fresh quota, vision classification, the escalation ladder, trilingual drafting, dedup, and Search grounding are all working again. **Stable baseline restored.** Lesson: don't put nice-to-have fields in the core vision schema; add reasoning as a separate non-blocking call.
- **26 Jun** — Switched vision model to gemini-2.0-flash (eliminated timeout). **Backup demo recorded ✅.** Added voice-first reporting (browser Web Speech API — hi-IN/gu-IN/en-IN, zero quota). Built "Ask NagarMitra" grounded chat (4th nav item + ticket-specific panel). Fixed all 4 seed ticket thumbnails (inline SVG data URIs). Added geofence + manual ward picker. Implemented 5-layer security middleware (trust proxy, sliding-window rate limiter, payload guard, input validation, HMAC session tokens, Gemini budget guard). Security design doc committed.
- **27 Jun** — Added sourced Impact Statistics panel (30→48 day drift, ~98% unresolved, SWAGAT ~90%). Built Systemic Pattern Bulletin (Gemini auto-detects issue clusters per ward). Added GMC Ward Civic Health Index (0–100 score per ward, color-coded). Added "What Happens Next" escalation timeline card with real calculated dates. Added citizen resolution dispute button (citizen-triggered escalation). Added WhatsApp share + copy ticket link. Added co-witness visibility on success screen. Added RTI/SWAGAT/CPGRAMS one-click clipboard copy. Added in-app agentic pipeline explainer ("How NagarMitra Works"). Added "Powered by Gemini" badges on AI-generated sections. Removed "Local Compliance Fallback Active" error banner. Improved standalone chat fallback with static suggested questions. Switched to gemini-1.5-flash as fallback model (separate quota pool).
