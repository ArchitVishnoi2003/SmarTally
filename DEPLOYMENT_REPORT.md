# Deployment Report — 2026-05-23

What was run automatically from your machine and what still needs **one action from you**.

---

## Deployed successfully (live now)

| Item | Status | URL / detail |
|------|--------|----------------|
| **Firestore security rules** | Live | Project `shopautomation-8de09` |
| **Firestore indexes** | Live | `sync_queue`, `invoices`, `parties` queries |
| **Firebase CLI** | Logged in | `avvi6404@gmail.com` |

Console: https://console.firebase.google.com/project/shopautomation-8de09/overview

---

## Deployed — Vercel API (2026-05-23)

| Item | Value |
|------|--------|
| **Production URL** | https://tally-amber.vercel.app |
| **API base** | https://tally-amber.vercel.app/api |
| **Vercel project** | `archit-vishnois-projects/tally` |
| **GEMINI_API_KEY** | Set on Vercel production |

Flutter `app_config.dart` and Go agent default URL updated.

---

## Completed (2026-05-23)

### Firebase service account on Vercel

`FIREBASE_SERVICE_ACCOUNT_JSON` set and production redeployed. Health check should show `"firebase": true`.

---

## Previously needed (done)

### Firebase service account (for confirmInvoice / Firestore)

**Your one-time fix (30 seconds):**

```powershell
cd c:\Users\avarc\Desktop\tally
npx vercel login
```

Choose **Continue with GitHub** → approve in browser.

Then run:

```powershell
# Save Firebase service account JSON to project root first (see step 2)
.\scripts\deploy-vercel.ps1
```

---

### 2. Firebase service account (for Vercel backend)

**Blocker:** No `firebase-service-account.json` on disk. Vercel needs it to write to Firestore.

1. Open: https://console.firebase.google.com/project/shopautomation-8de09/settings/serviceaccounts/adminsdk  
2. **Generate new private key**  
3. Save as: `c:\Users\avarc\Desktop\tally\firebase-service-account.json`  
4. Re-run `.\scripts\deploy-vercel.ps1`

---

### 3. Firebase Cloud Functions (alternate backend)

**Blocker:** Google Cloud requires **billing / App Engine bucket** for Cloud Functions upload.

```
Error: Could not create bucket gcf-v2-uploads-...403
```

**Fix:** Enable billing (Blaze) at:  
https://console.developers.google.com/billing/enable?project=shopautomation-8de09

Then:

```powershell
cd c:\Users\avarc\Desktop\tally\functions
npm run build
cd ..
firebase deploy --only functions
```

Code was updated to use `functions/.env` for `GEMINI_API_KEY` (no Secret Manager).

---

### 4. Firebase Storage

**Blocker:** Storage not initialized in Console.

Open: https://console.firebase.google.com/project/shopautomation-8de09/storage → **Get started**

Then:

```powershell
firebase deploy --only storage
```

---

## Code changes made during deploy attempt

- `functions/src/index.ts` — removed Firebase Secret Manager dependency (uses `.env` only)
- `app/lib/config/app_config.dart` — default API URL set to Firebase Functions region (until Vercel URL is set)

---

## After Vercel deploy succeeds

Update Flutter (replace with your real URL):

```powershell
cd app
flutter run --dart-define=API_BASE_URL=https://YOUR-PROJECT.vercel.app/api
```

---

## Fastest path to a working app

1. `npx vercel login` (GitHub)  
2. Download `firebase-service-account.json` into project root  
3. `.\scripts\deploy-vercel.ps1`  
4. `flutter run --dart-define=API_BASE_URL=https://YOUR-URL.vercel.app/api`  

Estimated time: **5 minutes** after login.
