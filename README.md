# Wholesale Tally — Phase 1: Bill Scanner → Tally Push

Mobile app for wholesale shop owners: photograph a paper bill, AI extracts line items, verify on phone, push voucher to **Tally Prime** on the PC automatically via a Windows sync agent.

> **Living technical reference:** [`PROJECT_STATUS.md`](PROJECT_STATUS.md) — **§1 Goals (phase-wise)** · **§2 Current status** · **§3 Every file & what it does**. Update all affected sections when code or plans change.

## What Phase 1 includes

| Component | Path | Role |
|-----------|------|------|
| Flutter app | `app/` | Phone OTP login, scan bill, verify, confirm |
| Cloud Functions | `functions/` | Gemini extraction, invoice save, sync queue, agent APIs |
| Windows agent | `agent/` | Polls queue, posts XML to Tally on `localhost:9000` |
| Firestore rules | `firestore.rules` | User-owned data security |

**Not in Phase 1:** tap-to-bill catalog (Phase 2), e-way bill, khata (Phase 3).

---

## Architecture

```
[Flutter App] ──HTTPS──► [Firebase Cloud Functions]
                              │
                              ▼
                         [Firestore sync_queue]
                              ▲
[Go Agent on PC] ──poll──► getPendingQueue
       │
       ▼ HTTP XML
[Tally Prime :9000]
```

---

## Prerequisites

1. **Firebase project** (Blaze plan required for Cloud Functions + secrets)
2. **Gemini API key** — [Google AI Studio](https://aistudio.google.com/apikey)
3. **Flutter SDK** 3.16+
4. **Node.js** 20+
5. **Go** 1.22+ (to build Windows agent)
6. **Tally Prime** on Windows with ODBC/HTTP enabled (port 9000)

---

## Step 1 — Firebase setup

```bash
npm install -g firebase-tools
firebase login
cd c:\Users\avarc\Desktop\tally
# Project: shopautomation-8de09 (see .firebaserc)
```

Enable in Firebase Console:

- Authentication → Phone
- Firestore → Create database
- Storage → Default bucket

Set Gemini secret:

```bash
firebase functions:secrets:set GEMINI_API_KEY
```

Deploy:

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions,firestore,storage
```

Note deployed function URLs (region `asia-south1`), e.g.:

`https://asia-south1-PROJECT_ID.cloudfunctions.net/extractBill`

---

## Step 2 — Flutter app

```bash
cd app
dart pub global activate flutterfire_cli
flutterfire configure --project=shopautomation-8de09 --yes --platforms=android,web
flutter pub get
```

Firebase is already wired: `lib/firebase_options.dart`, `lib/main.dart`, and `lib/config/app_config.dart` point to `shopautomation-8de09`.

Run on Android:

```bash
flutter run
```

If `android/` folder is incomplete, run `flutter create .` inside `app/` first.

---

## Step 3 — Tally on PC (one-time)

1. Open Tally Prime → **F1** → Settings → Connectivity  
2. Client/Server = **Both**  
3. Port **9000**  
4. Restart Tally and open the correct company

---

## Step 4 — Windows Sync Agent

```bash
cd agent
go mod tidy
go build -o WholesaleTallyAgent.exe .
```

Run `WholesaleTallyAgent.exe` on the **same PC as Tally**.

1. In the mobile app: **Pair PC Agent** → note the 6-digit code  
2. In the agent console: enter code + exact Tally company name  
3. Config saved to `%APPDATA%\WholesaleTally\config.json`  
4. Tray icon: green = synced, yellow = pending, red = error

Set cloud URL if needed:

```powershell
$env:WHOLESALE_CLOUD_URL = "https://asia-south1-PROJECT_ID.cloudfunctions.net"
```

---

## Phase 1 user flow

1. Login with phone OTP  
2. **Scan Bill** → camera / file / paste text  
3. AI extracts items (Gemini)  
4. **Verify** screen — fix amber (low-confidence) fields  
5. **Confirm & Push to Tally**  
6. Invoice saved in Firestore + `sync_queue`  
7. PC agent picks up queue → creates voucher in Tally  
8. Success screen shows sync status in real time  

---

## Firestore collections

| Collection | Purpose |
|------------|---------|
| `users` | Business profile, GSTIN, Tally company name |
| `parties` | Suppliers / customers |
| `items` | Catalog (used more in Phase 2) |
| `invoices` | Confirmed bills |
| `sync_queue` | Pending Tally XML payloads |
| `agent_devices` | Paired PC tokens + heartbeat |
| `pairing_codes` | 6-digit codes (10 min TTL) |
| `counters` | Monotonic sync sequence per user |

---

## Cloud Functions API

| Function | Auth | Method |
|----------|------|--------|
| `extractBill` | Bearer (user) | POST |
| `confirmInvoice` | Bearer (user) | POST |
| `pairAgent` | Bearer (user) or body code | POST |
| `ensureUserProfile` | Bearer (user) | POST |
| `getPendingQueue` | `Agent {token}` | GET |
| `markInFlight` | `Agent {token}` | POST |
| `markSynced` | `Agent {token}` | POST |
| `agentHeartbeat` | `Agent {token}` | POST |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| SmartScreen blocks agent | Click "More info" → Run anyway (sign binary in V2) |
| Tally not receiving vouchers | Confirm Tally open, port 9000, company name matches config |
| Extraction wrong | Edit on verify screen; amber = low confidence |
| Agent not pairing | Code expires in 10 minutes; generate new code |
| Duplicate vouchers | UDF `APPINVOICEID` on voucher — agent skips if exists |

---

## Next phases

- **Phase 2:** Item catalog + tap-to-bill sales + PDF invoice  
- **Phase 3:** E-way bill (NIC API), khata, UPI reminders  
- **Phase 4:** Public catalog link, voice billing, CA export  

See `Wholesale_Automation_System_Blueprint.md` for full product vision.
