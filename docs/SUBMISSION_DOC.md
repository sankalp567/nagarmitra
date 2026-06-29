# NagarMitra — Community Hero
**Vibe2Ship Hackathon | Coding Ninjas × Google for Developers**
**Problem Statement 2: Community Hero (Hyperlocal Problem Solver)**

**Submitted by:** Sankalp Turankar | IIT Gandhinagar | sankalp.turankar@iitgn.ac.in
**Deployed App:** https://nagarmitra-967605381609.asia-southeast1.run.app/
**GitHub Repository:** *(add link)*

---

## 1. Problem Statement Selected

**PS2 — Community Hero: Hyperlocal Problem Solver**

Build a platform that enables citizens to identify, report, **validate**, track, and resolve community issues through **collaboration**, **data**, and intelligent automation — encouraging **transparency**, **accountability**, and **community participation**.

---

## 2. The Problem: The Gap After the Complaint

Reporting a civic complaint is easy. Getting it resolved is not.

- Civic complaint resolution time in Indian cities drifted from **~30 days to ~48 days** over three years — a 60% regression (Praja Foundation, Mumbai 2023).
- Of all complaints escalated to the Municipal Commissioner, **~98% remain unresolved**. Escalation exists on paper, not in practice.
- India's flagship civic platform, **MoHUA Swachhata** (6M+ complaints), has **no escalation matrix**. Complaints go in; accountability never follows.
- Gandhinagar Municipal Corporation serves **~300,000 residents across 9 wards** with zero automated follow-through below the state level.

**The breakthrough framing:** India's own government already proved the model works. Gujarat's **SWAGAT 2.0** auto-escalation (CM's Secretariat, December 2024) resolved **~90% of state grievances within SLA** using automated escalation. The gap is that SWAGAT operates at the *state* level. At the **ward level** — where daily civic life happens — there is no equivalent.

**NagarMitra does not propose a new idea. It completes what the Gujarat government itself started.**

---

## 3. Solution Overview

**NagarMitra ("City Friend")** is an agentic civic-issue resolver. It transforms a citizen's photograph into a legally-grounded complaint, routes it to the correct officer, and then autonomously pursues resolution through the real municipal hierarchy — without any further action from the citizen.

**The citizen journey:**

| Step | What Happens | Who Does It |
|------|-------------|-------------|
| Take a photo | Upload pothole / leak / streetlight / waste image | Citizen |
| AI sees it | Classifies issue type, severity 1–5, hazards, confidence score | Gemini 2.0 Flash |
| Routes it | Maps to correct GMC department + officer designation | Geo-Router agent |
| Community validates | If a nearby report exists, merges as co-witness — citizen becomes part of a collective complaint | Duplicate Detector |
| Drafts complaint | Formal complaint in English, Hindi, and Gujarati | Complaint Drafter (Gemini) |
| Tracks & escalates | Autonomous watchdog climbs hierarchy as SLA lapses | Escalation Watchdog agent |
| Legal documents | RTI, SWAGAT 2.0, CPGRAMS auto-drafted at Day 21 | Gemini + Search Grounding |

**Community participation by design:** Every feature in NagarMitra is built around collective action, not individual complaints. Co-witness merging turns 8 isolated reports into a single complaint with 8 signatories. The Ward Civic Health Index makes systemic patterns visible to all citizens. The dispute button gives anyone the power to reject a false "resolved" mark. This is not a reporting inbox — it is a community accountability platform.

---

## 4. Agentic Architecture

NagarMitra implements a genuine multi-agent **plan → tool-call → reflect** loop. The orchestrator receives each agent's structured output, decides the next tool, and adjusts based on the result. This is not an LLM wrapper — each agent has a defined API contract, input schema, and output type.

### Agent Roster

**Agent 1 — Vision Analyst** (Gemini 2.0 Flash, multimodal)
- Input: citizen photo (client-compressed, max 900px, q60)
- Output: `{ issue_type, severity: 1–5, specific_hazards[], confidence_score }`
- Self-correction: if `confidence < 0.6`, returns a clarifying question to the citizen instead of guessing

**Agent 2 — Geo-Router**
- Input: GPS coordinates + issue category
- Output: GMC ward ID + department (Roads & Engineering / Water Supply / Solid Waste / Street Lighting / Drainage) + officer designation
- Geofence: haversine from Gandhinagar center; judges outside 20km get a manual ward picker

**Agent 3 — Duplicate Detector**
- Algorithm: haversine distance ≤ 60m + same category → merge into existing ticket, append citizen as co-witness
- This is the **community validation** mechanism: the second citizen does not file a duplicate — they verify and amplify the first citizen's complaint
- Co-witness count surfaced on success screen: *"Your report strengthens an existing complaint — N witnesses now"*

**Agent 4 — Complaint Drafter** (Gemini)
- Input: structured ticket data — real IDs, real dates, real officer names injected verbatim, never generated
- Output: trilingual formal complaint (English / Hindi / Gujarati) in a single Gemini call
- Anti-fabrication guarantee: the model is explicitly forbidden from generating these fields

**Agent 5 — Escalation Watchdog** (autonomous — zero user trigger required)
Scans all open tickets against current time. Climbs the real GMC hierarchy:

| Day | Action | Target Authority |
|-----|--------|-----------------|
| 7 | Escalation notice | Executive Engineer |
| 14 | Escalation notice | Deputy Municipal Commissioner |
| 21 | RTI application (Form A, §6(1)/§7(1) RTI Act 2005) + SWAGAT 2.0 petition + CPGRAMS grievance | CM's Secretariat / DARPG |
| 28 | Final summons | Municipal Commissioner |

All three Day-21 documents share one consistent ticket timeline — no contradictions when filed simultaneously. One-click clipboard copy. Demo controls: "Simulate +7 / +14 / +21 days" with virtual clock — the deepest technical capability visible and verifiable in under 60 seconds.


**Agent 6 — Systemic Pattern Detector** (Gemini)
- Detects 2+ same-category issues in the same ward in a rolling window
- Auto-drafts a root-cause bulletin for departmental review
- Enables intervention at the systemic level, not just individual tickets

### What Makes It Genuinely Agentic

| Agentic Property | NagarMitra Implementation |
|---|---|
| Multi-step planning | Vision → routing → dedup → drafting → dispatch pipeline |
| Real tool use | Each agent calls a specific API or algorithm — not generic prompting |
| Autonomous unprompted action | Watchdog scans and escalates without any user trigger |
| Persistent state | Tickets, timelines, co-witnesses, escalation history in Firestore + localStorage |
| Visible reasoning | Streaming "Municipal Processing Log" with per-step elapsed time |
| Self-correction | Low confidence vision → clarifying question, not a hallucinated answer |
| Grounded output | Google Search grounding on every legal citation — real statutes, verifiable links |

---

## 5. Innovation

### Three capabilities no other civic platform offers:

**1. Autonomous ward-level RTI + SWAGAT + CPGRAMS drafting from a single ticket**
No existing civic app auto-drafts a complete RTI application, SWAGAT petition, and CPGRAMS grievance from one complaint. These are the three most powerful legal tools available to an Indian citizen — typically requiring hours of manual research and form-filling. NagarMitra delivers all three in one click, generated from the same consistent ticket timeline so there are no contradictions if filed simultaneously. This is accountability that is not just possible — it is effortless.

**2. Co-witness complaint strengthening — community validation as a civic amplifier**
Most platforms treat duplicate reports as noise to suppress. NagarMitra converts them into collective proof. A second report within 60m of the same category does not create a new complaint — it strengthens the existing one by adding the citizen as a co-witness. A pothole with 8 co-witnesses carries a fundamentally different weight than 8 fragmented individual reports. The system changes the dynamic from isolated individual voice to organized community pressure on one accountable officer. This is the "community verification" requirement from PS2, implemented as an amplification mechanism rather than a moderation tool.

**3. Ward Civic Health Index — predictive intelligence for preemptive intervention**
Each of Gandhinagar's 9 wards gets a continuously-updated Civic Health Score (0–100) computed from: open ticket count, escalation rate, and resolved percentage. Color-coded as Critical / Needs Attention / Healthy, the index surfaces wards trending toward failure *before* they reach crisis — enabling officials to allocate resources preemptively rather than reactively. This is the "predictive insights" capability from PS2, grounded in real ticket data rather than ML speculation.

**4. AI-wired gamification — civic engagement tied directly to Gemini vision output**
Most civic gamification awards points for any report regardless of severity. NagarMitra's Civic Contribution Score is directly wired to the Gemini vision analysis: a severity-5 pothole (immediate safety hazard) earns more points than a severity-1 litter report, because it actually affects more residents. This creates a feedback loop between AI intelligence and citizen behaviour — citizens are incentivised to photograph and describe issues clearly so the AI can score severity accurately. The five-tier progression (Concerned Citizen → Active Reporter → Civic Champion → Ward Guardian → Community Sentinel) and demographic impact statements ("your report may affect 38,000 residents") are designed without leaderboards, streaks, or public rankings — gamification that acknowledges civic contribution without trivialising the process.

### Broader innovation frame
NagarMitra targets the **moment after filing** — the gap every existing civic app ignores. The Swachhata app closes complaints by accepting photos. NagarMitra pursues resolution by escalating to the Municipal Commissioner if needed. The product's north star is not "more complaints filed" but "fewer unresolved complaints outstanding."

---

## 6. Key Features

### Reporting & Analysis
- **Photo-based AI image analysis** — AI Studio "Analyze images" chip + Gemini 2.0 Flash: issue type, severity 1–5, specific hazards, confidence score from one photo; structured output schema enforced server-side
- **Trilingual complaint drafting** — English / Hindi / Gujarati in a single Gemini call; all metadata injected, none fabricated
- **Voice-first reporting** — AI Studio "Transcribe audio" chip enables speech-to-text in Hindi (hi-IN), Gujarati (gu-IN), and English (en-IN); citizens describe the issue verbally, transcript auto-fills the complaint note field
- **GPS location + reverse geocoding** — Google Maps Platform provides precise citizen location and maps coordinates to GMC ward and street address automatically
- **Streaming agent reasoning panel** — "Municipal Processing Log" shows every pipeline step with per-step elapsed time

### Community Participation & Validation
- **Co-witness complaint strengthening** — duplicate reports within 60m merge into the existing complaint, adding co-witnesses
- **Civic Contribution Score with AI-driven severity multiplier** — points for civic actions (filing: +1–3 depending on Gemini-assigned severity, co-witnessing: +2, Day-7 escalation: +3); severity-4 reports earn +1 bonus, severity-5 earn +2 bonus — the gamification engine is directly wired to the AI vision output
- **Five-tier civic progression** — Concerned Citizen (0–2) → Active Reporter (3–6) → Civic Champion (7–14) → Ward Guardian (15–24) → Community Sentinel (25+); tier label shown above score on success screen and dashboard; gold treatment from Civic Champion upward
- **Demographic impact statement** — success screen shows "Your report may affect approximately N residents in Ward X" using real GMC ward population data; makes individual action feel meaningful at civic scale
- **First-achievement milestones** — one-time text callouts for: first report filed, first co-witness, first escalation triggered, reaching Civic Champion; styled as left-bordered inline callouts, no emojis, government-appropriate tone
- **Persistent navbar civic score** — current tier name and point total always visible in the navigation bar across all screens; updates reactively after every scoring action without page reload; gold text applied to tier name at Civic Champion and above
- **Community Contributors panel** — Dashboard panel with aggregate score, tier, point mechanics breakdown, and chronological recent contributions
- **Citizen resolution dispute** — citizen disputes premature "resolved" marking → auto-triggers next escalation tier
- **"Ask NagarMitra" civic chat** — Gemini + Google Search; ticket-specific Q&A + standalone tab for GMC procedures, RTI Act, SWAGAT, CPGRAMS
- **WhatsApp share + copy ticket link** — one-tap sharing to mobilize community support

### Autonomous Escalation & Legal Accountability
- **Escalation Watchdog** — Day 7 → EE → Day 14 → DyMC → Day 21 → RTI + SWAGAT + CPGRAMS → Day 28 → Commissioner (zero user trigger)
- **"What Happens Next" timeline** — exact escalation dates shown to citizen after filing, calculated from submission timestamp
- **One-click legal documents** — RTI application (Form A), SWAGAT 2.0 petition, CPGRAMS grievance; clipboard copy at Day 21
- **Search-grounded legal citations** — GPMC Act §63, RTI Act §6(1), GMC Citizen Charter SLAs; verifiable source links on every document

### Predictive Intelligence & Dashboard
- **GMC Ward Civic Health Index** — per-ward score 0–100, updated from live ticket data; Critical / Needs Attention / Healthy; predictive resource allocation signal
- **Systemic Pattern Bulletin** — Gemini detects same-category clusters per ward → auto-drafts root-cause report for departmental review
- **Impact Dashboard** — total grievances, resolution ratio, average resolution window, per-ward and per-category breakdowns, sourced national statistics
- **Civic Map** — Leaflet.js + OpenStreetMap; severity-colored pins, ward health polygon overlays, popup ticket detail

### Security
- **5-layer server middleware:** trust proxy (Cloud Run), sliding-window IP rate limiter, 2MB payload guard, input validation (image magic-byte check, lat/lng bounds, XSS strip), HMAC-SHA256 session tokens
- **Gemini budget guard:** 10 calls/min, 200/day hard cap per instance
- All Gemini API keys server-side only — client never receives or handles a key

---

## 7. Google Technologies Utilized

| Google Technology | How It Powers NagarMitra |
|---|---|
| **Google AI Studio** | Core build + deploy tool. Entire app authored in Build mode via natural-language prompts across 7 days. Published to Cloud Run via Publish → GitHub integration. |
| **AI Studio — "Analyze images" chip** | Enables Gemini multimodal vision for photo-based civic issue classification. Photo → structured `{issue_type, severity, hazards, confidence}` on every report submission. |
| **AI Studio — "Transcribe audio" chip** | Powers voice-first reporting: citizen speaks in Hindi, Gujarati, or English → transcript auto-fills the complaint note field, lowering the literacy barrier for civic participation. |
| **AI Studio — "Use Google Search data" chip** | Enables Gemini Search Grounding on all complaints, escalation notices, RTI/SWAGAT/CPGRAMS documents, and Ask NagarMitra responses — real legal citations with verifiable source links. |
| **Gemini 2.0 Flash** | Primary model for all multimodal image classification and agentic pipeline orchestration. Fast enough to stay within Cloud Run request timeout. |
| **Gemini 1.5 Flash** | Fallback model for chat, trilingual complaint drafting, and escalation notices. Separate quota pool from 2.0 Flash — ensures service continuity when primary quota is exhausted. |
| **Google Maps Platform** | Provides precise GPS location lookup and reverse geocoding — converts citizen coordinates into GMC ward ID and street address used throughout the complaint and escalation pipeline. |
| **@google/genai SDK** | All server-side Gemini calls made via the official `@google/genai` Node.js SDK. API keys stored as Cloud Run environment variables; never transmitted to the client. |
| **Firebase Firestore** | Ticket persistence, co-witness records, escalation history, timeline state. Spark free tier. localStorage fallback auto-activates when Firestore daily reads are exhausted. |
| **Google Cloud Run** | Scalable serverless hosting. Free Starter tier — no billing account required. `trust proxy` configured for GCP load balancer. |

*Firebase Storage and Firebase Blaze billing deliberately excluded to preserve free-tier deployability and demonstrate the full capability of Google's free developer stack.*

---

## 8. Technologies Used

| Layer | Technology |
|---|---|
| Frontend | React (Google AI Studio–generated scaffold) |
| Backend | Node.js / Express |
| AI SDK | `@google/genai` (official Google Generative AI Node.js SDK) |
| AI Models | Gemini 2.0 Flash (vision + routing), Gemini 1.5 Flash (text, chat, escalation drafting) |
| Image Analysis | AI Studio "Analyze images" chip → Gemini 2.0 Flash multimodal |
| Voice Transcription | AI Studio "Transcribe audio" chip (hi-IN / gu-IN / en-IN) |
| Search & Grounding | AI Studio "Use Google Search data" chip → Gemini Search Grounding |
| Location | Google Maps Platform (GPS + reverse geocoding → ward mapping) |
| Map Display | Leaflet.js + OpenStreetMap (severity-colored pins, ward overlays) |
| Database | Firebase Firestore (Spark) + localStorage fallback |
| Deployment | Google Cloud Run (free Starter tier) |
| Security | HMAC-SHA256 session tokens, sliding-window rate limiter, 5-layer input validation middleware |

---

## 9. Product Design Decisions

**Government-appropriate aesthetic:** Civic platforms must project trust and seriousness. NagarMitra uses a clean, text-forward, icon-based design — no decorative elements — appropriate for a tool citizens use to pursue legal remedies. Citizens must feel they are interacting with an authoritative system, not a startup product.

**Progressive disclosure:** The agentic pipeline runs silently. Citizens see their complaint result immediately. The "Municipal Processing Log" and reasoning detail are available for those who want to understand the process — but the primary flow is never blocked by internal complexity.

**Trilingual throughout:** Complaint drafts, escalation notices, UI labels, and the "Ask NagarMitra" chat work in English, Hindi, and Gujarati — reflecting Gandhinagar's demographic reality and the PS2 goal of broad community participation.

**Voice-first for inclusion:** Web Speech API voice input enables citizens who prefer speaking to typing — reducing the literacy barrier to civic participation. Zero quota cost; works offline.

**Offline resilience:** Firestore + localStorage fallback means the core reporting, escalation, and chat flows continue when Firestore daily reads are exhausted. The app degrades gracefully, not catastrophically.

**Ward Health color coding:** Critical / Needs Attention / Healthy maps to the hospital triage mental model — instinctively understood by anyone who has ever seen a status dashboard. Officials and citizens read the same visual signal.

**Demo-safe geofence design:** Judges outside Gandhinagar see a manual ward picker — so their demo experience is identical to a local citizen's, regardless of physical location. The geofence message explains the context without breaking immersion.

---

## 10. Technical Implementation

**Dedup algorithm:** Category + haversine distance (≤60m threshold). Replaced embedding-based cosine similarity after it proved unreliable — same-category issues described with different vocabulary produced near-zero similarity, and the embedding endpoint caused watchdog timeouts. The geo + category rule is O(n), deterministic, and requires zero additional model calls.

**Anti-fabrication architecture:** All document-generation prompts inject real ticket IDs, real dates, and real officer designations as structured data fields. The Gemini prompt explicitly forbids generating these fields — they come from the ticket store. This is not a UX nicety — a fabricated ticket reference number would render an RTI filing legally void.

**Quota resilience:** Gemini 2.0 Flash (primary) and 1.5 Flash (fallback) use separate quota pools. The Budget Guard (10 calls/min, 200/day per instance) prevents runaway usage. The reasoning card is served from a separate non-blocking GET `/api/reasoning/:ticketId` endpoint — vision pipeline response time is never blocked by reasoning generation.

**Cloud Run compatibility:** `app.set('trust proxy', true)` ensures IP-based rate limiting works correctly behind GCP's load balancer. All payload validation runs before Gemini is ever called — invalid image signatures and out-of-bounds coordinates are rejected without spending quota.

---

## 11. Real-World Impact & Scalability

**Immediate:** Gandhinagar GMC — 300,000 residents, 9 wards, 0 automated escalation below state level. NagarMitra provides all of it, free, today.

**National scale:** Only the department routing table and officer matrix need updating to deploy to any of India's **4,000+ urban local bodies**. No code changes. Same Gemini + Firestore + Cloud Run stack, same free tier.

**Government alignment:** SWAGAT 2.0 at the state level achieved ~90% SLA resolution. NagarMitra extends this proven model to the ward level — not replacing government, but activating the accountability mechanisms that already exist in law and go unused in practice.

**Measurable target:** If NagarMitra narrows Gandhinagar's average resolution from the national drift (48 days) toward SWAGAT-level (~7 days), that is a **6x improvement for 300,000 residents, using zero paid infrastructure**.

---

## 12. Build Process

Built entirely in **Google AI Studio** using its agentic Build mode (React + Node + Firebase scaffold), iterated through natural-language prompts across 7 days (June 22–29 2026), and deployed via Publish → Cloud Run with GitHub integration.

**Engineering decisions made during the build:**
- Dropped embedding-based duplicate detection (watchdog timeouts, unreliable cosine similarity for civic language) → replaced with geo + category rule
- Moved reasoning card to a separate non-blocking endpoint after it caused vision pipeline timeouts under Cold Run cold-start conditions
- Kept Google Maps Platform for location services (GPS + reverse geocoding); switched map *display* from Google Maps tiles to Leaflet + OpenStreetMap when the Maps tile API key failed on the Cloud Run domain — location data pipeline was unaffected
- Added Gemini 1.5 Flash as fallback after discovering 2.0 Flash and AI Studio Build mode share the same daily quota pool
- All Gemini keys server-side from day one; HMAC session tokens replace cookie-based auth for Cloud Run compatibility

---

*All 25+ features listed above are deployed and accessible at* https://nagarmitra-967605381609.asia-southeast1.run.app/ — *the app is live, the watchdog is active, the escalation simulation works, and every claim in this document reflects the current working state of the deployed application.*

---

## 13. Screenshots

### Report Issue — Landing Page
*(Screenshot: `01-report-issue-home.png`)*

### Photo Upload with Gandhinagar Presets
*(Screenshot: `02-report-with-preset.png`)*

### Voice-First Reporting — Trilingual (Hindi / Gujarati / English)
*(Screenshot: `18-voice-reporting.png`)*

### Civic Map — Real Gandhinagar Streets, Severity-Colored Pins, Ward Overlays
*(Screenshot: `03-civic-map.png`)*

### Ask NagarMitra — Gemini + Google Search Grounded Civic Chat
*(Screenshot: `04-ask-nagarmitra.png`)*

### Dashboard — Municipal Impact Command Center + Escalation Watchdog Controls
*(Screenshot: `06-dashboard-watchdog.png`)*

### Autonomous Escalation Watchdog — Live Gemini Processing (+7 Day Simulation)
*(Screenshot: `14-watchdog-7days.png`)*

### Escalation Results — Tickets Escalated to Executive Engineer
*(Screenshot: `16-escalation-results.png`)*

### GMC Ward Civic Health Index — AI-Predicted, Per-Ward Scores, CRITICAL Status
*(Screenshot: `07-ward-health-index.png`)*

### AI Systemic Pattern Alerts — Gemini-Generated Root-Cause Bulletins
*(Screenshot: `10-systemic-alerts.png`)*

### Municipal Performance Metrics Dashboard
*(Screenshot: `11-performance-metrics.png`)*

### Impact Statistics — Why This Matters (48 days / ~98% / 6M+ / ~90%)
*(Screenshot: `08-impact-stats.png`)*

### Civic Contribution Score Panel — "Concerned Citizen" Tier + Point Mechanics
*(Screenshot: `09-civic-score-panel.png`)*

### Navbar — Persistent Civic Score Indicator Across All Screens
*(Screenshot: `19-navbar-civic-score.png`)*
