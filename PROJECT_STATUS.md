# Wholesale Tally — Project Status (Living Document)

> **Read this first.** Single source of truth for product goals, what is built, and what every file does.  
> **Last updated:** 2026-05-23 (deploy attempt)  
> **Firebase project:** `shopautomation-8de09`  
> **Active build focus:** Phase 1 — Bill Scanner → Tally Push  

---

## How to keep this file correct

**Update this entire document when anything below changes** — not only the changelog.

| If this changes… | Update these sections |
|------------------|----------------------|
| Product vision or phase goals | [§1 Goals phase-wise](#1-goals-phase-wise-in-detail) |
| Feature completed or removed | [§2 Current status](#2-current-status-completed-work) |
| New/removed/renamed file | [§3 File & component reference](#3-file--component-reference-what-everything-does) |
| API, collection, or auth | §3 + [§4 Architecture](#4-system-architecture) + [§5 Firestore](#5-firestore-data-model) |
| Deploy URL or hosting choice | [§6 Deployment](#6-deployment--environment) |
| Backend strategy (Vercel vs Firebase vs other) | §1, §2, §4, §6 |

**Rule for AI (Cursor):** After meaningful code or plan changes, edit all affected sections in the same session. If goals change, rewrite §1 before §2.

---

## Table of contents

1. [Goals phase-wise (in detail)](#1-goals-phase-wise-in-detail)  
2. [Current status (completed work)](#2-current-status-completed-work)  
3. [File & component reference](#3-file--component-reference-what-everything-does)  
4. [System architecture](#4-system-architecture)  
5. [Firestore data model](#5-firestore-data-model)  
6. [Deployment & environment](#6-deployment--environment)  
7. [User flows (implemented)](#7-user-flows-implemented)  
8. [Related documentation](#8-related-documentation)  
9. [Changelog](#9-changelog)  

---

## 1. Goals phase-wise (in detail)

### Overall vision (unchanged)

Automate the full wholesale clothing workflow for a business like your father’s:

- **Today:** Owner writes items on paper → hired person re-types into Tally → manual e-way bill.  
- **Target:** Owner uses phone only → bills and compliance flow into Tally with minimal typing → optional credit, catalog, and retailer ordering later.

**Strategic position:** Be the **mobile frontend to Tally**, not a Tally replacement. Cloud holds truth; Tally is the accounting mirror on the shop PC.

**Core technical split:**

| Layer | Role |
|-------|------|
| Flutter app | UI on phone (scan, bill, verify, status) |
| Cloud server | AI, secrets, invoice logic, sync queue |
| Firebase | Auth, database, file storage |
| PC agent | Bridge to Tally (`localhost:9000`) |
| Tally Prime | Legal books, GST vouchers |

---

### Phase 1 — Bill Scanner → Tally Push

**Goal:** Remove the data-entry operator for **scanned paper bills** (purchase and sale).

| # | Capability | Detail |
|---|------------|--------|
| 1.1 | Capture bill | Photo, PDF upload, or paste text on phone |
| 1.2 | AI extract | Gemini reads items, rates, HSN, GST, party, dates |
| 1.3 | Human verify | Simple screen; fix errors; low-confidence fields highlighted |
| 1.4 | Confirm | Save invoice to cloud; build Tally XML; add to ordered sync queue |
| 1.5 | Tally push | Windows agent on shop PC posts voucher to Tally when PC/Tally is on |
| 1.6 | Status | Phone shows pending / synced / failed in real time |
| 1.7 | Pair agent | 6-digit code links PC agent to shop account |
| 1.8 | Auth | Phone OTP login (Firebase) |

**Phase 1 success criteria:** Father scans any paper bill → verifies → voucher appears in Tally without anyone typing into Tally manually.

**Phase 1 explicitly out of scope:** Tap-to-bill catalog, e-way bill, khata, PDF invoice, voice billing.

---

### Phase 2 — Catalog + Tap-to-Bill (outgoing sales)

**Goal:** Father bills **live sales** by tapping items while the customer speaks (no paper bill to scan).

| # | Capability | Detail |
|---|------------|--------|
| 2.1 | Item catalog | CRUD items with photo, HSN, GST %, unit, purchase/sale rate |
| 2.2 | Catalog from Phase 1 | Items learned from scanned purchase bills |
| 2.3 | Create sale | Search/tap items, qty stepper, party selection, running total |
| 2.4 | Invoice PDF | Generate PDF; business header, GST breakup, total in words |
| 2.5 | WhatsApp | Share PDF link to customer |
| 2.6 | Tally | Same queue + agent as Phase 1 (Sales vouchers) |
| 2.7 | Invoice numbering | Financial year sequence with transaction safety |

**Phase 2 success criteria:** Both directions work — scanned purchases (Phase 1) + tapped sales (Phase 2), all into Tally automatically.

---

### Phase 3 — E-Way Bill + Khata + UPI

**Goal:** End-to-end after invoice — movement compliance and money collection.

| # | Capability | Detail |
|---|------------|--------|
| 3.1 | E-way bill | One tap; NIC API with shop’s credentials; EBN stored and written back to Tally voucher |
| 3.2 | NIC setup screen | Guide user to register API on `ewaybillgst.gov.in` |
| 3.3 | Khata dashboard | Party-wise outstanding, 30/60/90 day buckets |
| 3.4 | UPI links | Per-invoice UPI deep link |
| 3.5 | Payment record | Mark paid; update ledger |
| 3.6 | WhatsApp reminders | Scheduled reminders for overdue invoices |

**Phase 3 success criteria:** Invoice → e-way (if needed) → UPI link → auto reminder if unpaid 30+ days.

---

### Phase 4 — Catalog link, voice, CA export, native app

**Goal:** Scale to many retailers and reduce friction further.

| # | Capability | Detail |
|---|------------|--------|
| 4.1 | Public catalog URL | Share on WhatsApp; retailers browse and order |
| 4.2 | Orders inbox | Incoming orders → confirm → convert to invoice |
| 4.3 | Voice billing | Hindi/Gujarati speech → match catalog → draft bill |
| 4.4 | CA export | Monthly Tally XML + GSTR-1 zip; auto-send on 5th |
| 4.5 | Native Android | Play Store app; thermal Bluetooth printers |

---

### Market problems addressed (full product, beyond Phase 1)

| Problem | Planned phase |
|---------|----------------|
| SKU explosion / no catalog | Phase 2 + photo-AI cataloging (later) |
| Khata / credit tracking | Phase 3 |
| WhatsApp orders | Phase 4 |
| E-invoicing (IRN) | Post–Phase 3 |
| Sales agent offline orders | Phase 4+ |
| Complex pricing per party | Phase 2+ |
| Returns / credit notes | Future |
| Multi-godown stock | Phase 4+ |

*If product goals change, edit this table and the phase sections above before coding.*

---

## 2. Current status (completed work)

### Summary

| Area | Status |
|------|--------|
| **Phase 1 product** | ~85% code complete; not fully deployed end-to-end |
| **Phase 2–4** | Not started (design only in blueprint) |
| **Recommended backend** | Vercel serverless (`api/` + `server/`) — no credit card |
| **Alternate backend** | Firebase Cloud Functions (`functions/`) — needs Blaze + billing |
| **Firebase** | Project configured; FlutterFire done |
| **Firestore rules + indexes** | **Deployed live** (2026-05-23) |
| **Vercel API** | **Deployed** — https://tally-amber.vercel.app/api |
| **Cloud Functions** | **Not deployed** — billing / GCF bucket 403 |
| **Firebase Storage** | Not initialized in Console |
| **PC agent** | Source complete; **not built** as `.exe` yet |

See **`DEPLOYMENT_REPORT.md`** for full deploy log and your 5-minute fix steps.

---

### Phase 1 — Done in code

| Feature | Status | Notes |
|---------|--------|-------|
| Phone OTP login | Done | `login_screen.dart` |
| FlutterFire / `firebase_options.dart` | Done | Android + Web |
| Scan bill — camera | Done | |
| Scan bill — file (PDF/image) | Done | |
| Scan bill — paste text | Done | |
| Gemini extraction API | Done | `server/lib/gemini.ts` |
| Verify screen + edit items/party/GST | Done | Amber = low confidence |
| Client-side GST total preview | Done | `bill_calculator.dart` |
| Confirm invoice + sync queue + Tally XML | Done | `confirmInvoice` handler |
| Auto-create party on confirm | Done | Firestore `parties` |
| Invoice success + sync listener | Done | |
| Dashboard sync indicator | Done | Reads `agent_devices` |
| Generate pairing code | Done | `pairAgent` |
| All 8 HTTP API routes (Vercel) | Done | `api/*.ts` |
| Duplicate APIs in Cloud Functions | Done | Optional path |
| Go agent — poll, Tally XML, masters, tray | Done | Windows only |
| Firestore rules + indexes | Done | In repo |
| Storage rules | Done | In repo |
| Vercel deploy guide | Done | `DEPLOY_VERCEL.md` |

---

### Phase 1 — Not done / not live

| Item | Status |
|------|--------|
| Vercel production deploy | **Done** — `https://tally-amber.vercel.app/api` |
| Set real `apiBaseUrl` in Flutter | **Done** in `app_config.dart` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` on Vercel | **Done** |
| Firestore rules/indexes deploy | **Done** |
| Firebase service account on Vercel | User must add env |
| `firebase deploy --only firestore,storage` | User action |
| Build `WholesaleTallyAgent.exe` | Not done |
| Pair agent on real Tally PC | Not done |
| Tally HTTP enabled on shop PC | User one-time setup |
| Khata button | Placeholder only |
| Upload bill image to Firebase Storage | Not wired in UI |
| Idempotency UDF query in agent | Partial (retry logic only) |
| Agent local SQLite offline queue | Not implemented (cloud queue only) |

---

### Phase 2–4 — Not implemented

Nothing from Phase 2–4 exists in app or server code except:

- Firestore `items` collection in rules (reserved)  
- Home screen “Khata” snackbar placeholder (Phase 3 label)  

---

## 3. File & component reference (what everything does)

### Root (`tally/`)

| File | Purpose |
|------|---------|
| `PROJECT_STATUS.md` | **This file** — goals, status, every component |
| `Wholesale_Automation_System_Blueprint.md` | Original product vision, market research, long-term architecture |
| `README.md` | Quick start; links here; setup for Flutter + Firebase |
| `DEPLOY_VERCEL.md` | Deploy backend on Vercel without credit card |
| `package.json` | Root Node deps for Vercel (`firebase-admin`, Gemini, `vercel` CLI) |
| `vercel.json` | Vercel config: API routes, CORS headers, 60s function timeout |
| `tsconfig.vercel.json` | TypeScript compile config for `api/` + `server/` |
| `firebase.json` | Firebase CLI: links `functions/`, `firestore`, `storage` |
| `.firebaserc` | Default Firebase project ID: `shopautomation-8de09` |
| `.firebaserc.example` | Template for `.firebaserc` |
| `.gitignore` | Ignores `.env`, `node_modules`, keys, build artifacts, `.vercel/` |
| `firestore.rules` | Security: users own their data; queue/agent writes server-only |
| `firestore.indexes.json` | Composite indexes for `sync_queue`, `invoices`, `parties` |
| `storage.rules` | Users read/write only under `bills/{uid}/` and `items/{uid}/` |

---

### Flutter app (`app/`)

#### Config & entry

| File | Purpose |
|------|---------|
| `pubspec.yaml` | App name, dependencies (Firebase, http, image_picker, etc.) |
| `analysis_options.yaml` | Dart linter rules |
| `lib/main.dart` | App entry; `Firebase.initializeApp`; auth gate → login or home |
| `lib/firebase_options.dart` | **Generated by FlutterFire** — API keys per platform (Android/Web) |
| `lib/config/app_config.dart` | Backend base URL (`apiBaseUrl`) and `functionUrl(name)` helper |
| `firebase.json` | FlutterFire metadata (project ID, app IDs) |
| `android/app/google-services.json` | **Generated** — Firebase Android config |
| `android/app/build.gradle.kts` | Android app build; applies Google Services plugin |
| `android/build.gradle.kts` | Project-level Gradle |
| `android/settings.gradle.kts` | Gradle plugins including `google-services` |
| `android/app/src/main/AndroidManifest.xml` | App label, INTERNET + CAMERA permissions |
| `android/app/src/main/kotlin/.../MainActivity.kt` | Default Flutter Android activity |
| `test/widget_test.dart` | Default Flutter test stub |
| `web/index.html`, `web/manifest.json` | Web shell (FlutterFire web app registered) |
| `ios/`, `macos/`, `windows/`, `linux/` | Platform scaffolding from `flutter create` (not primary targets) |

#### Screens (`app/lib/screens/`)

| File | Purpose |
|------|---------|
| `login_screen.dart` | +91 phone input → Firebase OTP → `ensureUserProfile` |
| `home_screen.dart` | Dashboard: sync status, Scan Bill, Pair PC agent, Khata placeholder |
| `scan_bill_screen.dart` | Camera / file / text → calls `extractBill` → navigate to verify |
| `verify_bill_screen.dart` | Edit bill type, date, party, line items, GST; confirm → `confirmInvoice` |
| `invoice_success_screen.dart` | Shows invoice #, total; live sync status; WhatsApp text share |

#### Services, models, utils

| File | Purpose |
|------|---------|
| `services/api_service.dart` | HTTP client: `extractBill`, `confirmInvoice`, `pairAgent`, `ensureUserProfile` |
| `services/firestore_service.dart` | Streams: `agent_devices`, `parties`, single `invoice` |
| `models/extracted_bill.dart` | Dart models for Gemini JSON (`ExtractedBill`, `ExtractedItem`, etc.) |
| `utils/bill_calculator.dart` | Computes subtotal, CGST/SGST/IGST on verify screen |

---

### Vercel backend — API routes (`api/`)

Each file is one serverless endpoint. All delegate to `server/handlers.ts`.

| File | HTTP | Purpose |
|------|------|---------|
| `extractBill.ts` | POST | User auth → Gemini OCR → return JSON bill |
| `confirmInvoice.ts` | POST | User auth → save invoice + `sync_queue` + Tally XML |
| `ensureUserProfile.ts` | POST | Create `users/{uid}` on first login |
| `pairAgent.ts` | POST | Generate 6-digit code (phone) OR pair agent (PC + code) |
| `getPendingQueue.ts` | GET | Agent auth → return pending queue items |
| `markInFlight.ts` | POST | Agent marks queue item being processed |
| `markSynced.ts` | POST | Agent marks synced/failed; updates invoice |
| `agentHeartbeat.ts` | POST | Agent reports Tally up/down + pending count |

---

### Vercel backend — server logic (`server/`)

| File | Purpose |
|------|---------|
| `handlers.ts` | **Main business logic** for all 8 endpoints |
| `firebase.ts` | Initialize `firebase-admin` from `FIREBASE_SERVICE_ACCOUNT_JSON` |
| `http.ts` | CORS wrapper + error handling for Vercel |
| `lib/auth.ts` | Verify `Bearer` Firebase token or `Agent {device_token}` |
| `lib/gemini.ts` | Gemini prompt + parse JSON for bill extraction |
| `lib/gst.ts` | GSTIN state code, inter/intra-state, tax helpers |
| `lib/tallyXml.ts` | Build Sales/Purchase voucher XML + master XML helpers |
| `lib/types.ts` | TypeScript types for API payloads |

---

### Firebase Cloud Functions — optional (`functions/`)

Same behavior as Vercel; use only if you enable **Blaze** and prefer Firebase hosting.

| File | Purpose |
|------|---------|
| `package.json` | Node 20, `firebase-functions`, `firebase-admin`, Gemini, `dotenv` |
| `tsconfig.json` | Compile `src/` → `lib/` |
| `.gitignore` | Ignores `lib/`, `node_modules`, `.env` |
| `.env.example` | Template for local `GEMINI_API_KEY` |
| `.env` | **Local only, gitignored** — Gemini key for emulator |
| `src/index.ts` | Exports all Cloud Functions (`onRequest`) |
| `src/auth.ts` | Same auth as `server/lib/auth.ts` (Express types) |
| `src/gemini.ts` | Same as `server/lib/gemini.ts` |
| `src/gst.ts` | Same as `server/lib/gst.ts` |
| `src/tallyXml.ts` | Same as `server/lib/tallyXml.ts` |
| `src/types.ts` | Same as `server/lib/types.ts` |
| `lib/*.js` | **Compiled output** — do not edit by hand |

---

### Windows Tally agent (`agent/`)

| File | Purpose |
|------|---------|
| `go.mod` | Go module definition |
| `main.go` | **Windows:** systray, pairing wizard, poll loop (10s), heartbeat (60s) |
| `main_console.go` | **Non-Windows:** prints “Windows only” and exits |
| `config/config.go` | Load/save `%APPDATA%\WholesaleTally\config.json`; default API URL |
| `cloud/api.go` | HTTP client to Vercel: `getPendingQueue`, `markSynced`, `pairAgent`, etc. |
| `sync/worker.go` | Process one queue item: create masters → POST voucher XML to Tally |
| `tally/client.go` | TCP probe port 9000; POST XML to `http://127.0.0.1:9000` |
| `tally/masters.go` | XML templates to create party ledger and stock item in Tally |

**Built artifact (not in repo):** `WholesaleTallyAgent.exe` — run `go build` on Windows.

---

### Cursor / tooling

| File | Purpose |
|------|---------|
| `.cursor/rules/update-project-status.mdc` | Rule: update this MD when code or **goals** change |

---

### Files intentionally excluded from this list

| Path | Why |
|------|-----|
| `functions/node_modules/` | Third-party dependencies |
| `app/.dart_tool/`, `app/build/` | Generated by Flutter |
| `functions/lib/*.js` | Compiled from TypeScript |
| `app/.idea/` | IDE settings |
| Platform ephemeral (`ios/Flutter/ephemeral`, etc.) | Generated |

---

## 4. System architecture

```
Phone (Flutter)
    │  HTTPS  /api/*
    ▼
Vercel (api/ + server/)  ──Admin SDK──►  Firestore
    │                                      ▲
    │  Agent HTTPS                         │ realtime
    ▼                                      │
PC Go Agent  ──localhost:9000──►  Tally Prime
```

| Component | Technology | Hosted where |
|-----------|------------|--------------|
| Mobile UI | Flutter | User’s phone |
| API server | Node / TypeScript | Vercel (intended) |
| Auth + DB | Firebase Auth + Firestore | Google (Spark) |
| Tally bridge | Go | Shop Windows PC |
| Accounting | Tally Prime | Shop Windows PC |

---

## 5. Firestore data model

| Collection | Written by | Purpose |
|------------|------------|---------|
| `users` | API / app | Business profile, GSTIN, Tally company name |
| `parties` | API | Customers / suppliers |
| `items` | — | Reserved Phase 2; rules exist, no UI yet |
| `invoices` | API | Bill documents; `status`: confirmed → synced / failed |
| `sync_queue` | API | Tally XML payloads; FIFO by `sequence_number` |
| `agent_devices` | API | Paired PC tokens, heartbeat, `tally_status` |
| `pairing_codes` | API | 6-digit codes, 10 min expiry |
| `counters` | API | Per-user `sync_sequence` counter |

---

## 6. Deployment & environment

### Deployment checklist

| Step | Action | Doc |
|------|--------|-----|
| 1 | Firebase Console: Phone auth, Firestore, Storage | `DEPLOY_VERCEL.md` |
| 2 | Download service account JSON | `DEPLOY_VERCEL.md` |
| 3 | `vercel login` → `vercel` → set env vars → `vercel --prod` | `DEPLOY_VERCEL.md` |
| 4 | Update `app/lib/config/app_config.dart` with Vercel URL | — |
| 5 | `firebase deploy --only firestore,storage` | — |
| 6 | `go build` agent on Windows; pair with app | `README.md` |
| 7 | Enable Tally HTTP port 9000 | `README.md` |

### Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `GEMINI_API_KEY` | Vercel (or `functions/.env`) | Bill AI |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Vercel | Server → Firestore |
| `API_BASE_URL` | Flutter `--dart-define` | Override API URL |
| `WHOLESALE_API_URL` | PC agent env | Override agent API base |

---

## 7. User flows (implemented)

### Scan bill → Tally

1. Login (OTP)  
2. Home → Scan Bill  
3. Capture / upload / paste → `extractBill`  
4. Verify → Confirm  
5. `confirmInvoice` → queue  
6. Agent on PC pushes to Tally  
7. Success screen shows sync state  

### Pair agent

1. Home → Pair PC Agent → 6-digit code  
2. Run agent on PC → enter code + Tally company name  
3. Dashboard shows agent/Tally status  

---

## 8. Related documentation

| File | Use when |
|------|----------|
| `DEPLOY_VERCEL.md` | Deploying API without credit card |
| `README.md` | First-time dev setup |
| `Wholesale_Automation_System_Blueprint.md` | Full vision, market problems, original Cloud Functions plan |

---

## 9. Changelog

| Date | What changed |
|------|----------------|
| 2026-05-23 | Firebase service account added to Vercel; full API live (gemini + firestore) |
| 2026-05-23 | Added `public/index.html` + `/api/health`; fixed root 404 on tally-amber.vercel.app |
| 2026-05-23 | Vercel deployed: https://tally-amber.vercel.app/api; GEMINI_API_KEY set; Flutter URL updated |
| 2026-05-23 | Deploy attempt: Firestore rules/indexes live; Vercel blocked (no login); Functions blocked (billing) |
| 2026-05-23 | Restructured into §Goals, §Status, §Files; added phase-wise goals in detail |
| 2026-05-23 | Initial `PROJECT_STATUS.md` created |

---

*When product plans change, update **§1 Goals** first, then **§2 Status**, then **§3 Files**, then changelog.*
