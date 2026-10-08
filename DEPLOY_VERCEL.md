# Deploy backend on Vercel (free, no credit card)

Use this instead of Firebase Cloud Functions (no Blaze / no billing card).

**You still use Firebase Spark (free)** for:
- Phone login (Auth)
- Database (Firestore)
- Bill photos (Storage)

**Vercel (free)** runs the server logic: AI scan, save invoice, Tally queue.

**PC agent** still required for Tally on the shop computer.

---

## Step 1 — Firebase service account (one-time)

Cloud Functions are not used, but Vercel needs permission to write to Firestore.

1. [Firebase Console](https://console.firebase.google.com/project/shopautomation-8de09/settings/serviceaccounts/adminsdk)  
2. **Generate new private key** → downloads a `.json` file  
3. Keep this file **secret** (never commit to Git)

---

## Step 2 — Vercel account (no card)

1. Sign up at [vercel.com](https://vercel.com) with **GitHub** (Hobby plan — no credit card for personal projects).  
2. Install CLI:

```powershell
npm install -g vercel@latest
```

---

## Step 3 — Deploy from your project folder

```powershell
cd c:\Users\avarc\Desktop\tally
npm install
vercel login
vercel
```

First `vercel` run asks project name — accept defaults.

---

## Step 4 — Environment variables on Vercel

In [Vercel Dashboard](https://vercel.com) → your project → **Settings** → **Environment Variables**:

| Name | Value |
|------|--------|
| `GEMINI_API_KEY` | Your Gemini API key |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Paste **entire** contents of the service account `.json` file (one line is OK) |

Then redeploy:

```powershell
vercel --prod
```

Copy the production URL, e.g. `https://wholesale-tally-abc123.vercel.app`

---

## Step 5 — Point the Flutter app

Edit `app/lib/config/app_config.dart`:

```dart
static const String apiBaseUrl =
    'https://YOUR-PROJECT.vercel.app/api';
```

Or run with:

```powershell
flutter run --dart-define=API_BASE_URL=https://YOUR-PROJECT.vercel.app/api
```

---

## Step 6 — Point the PC agent

When pairing, enter API URL:

```
https://YOUR-PROJECT.vercel.app/api
```

Or set before running agent:

```powershell
$env:WHOLESALE_API_URL = "https://YOUR-PROJECT.vercel.app/api"
```

---

## What stays on Firebase Spark (free, no card)

Enable in Console if not done:

- Authentication → Phone  
- Firestore database  
- Storage  

You do **not** need Blaze or `firebase deploy --only functions`.

---

## Limits (Hobby / free)

| Service | Typical free allowance |
|---------|-------------------------|
| Vercel | 100 GB bandwidth/month, serverless invocations generous for small shop |
| Firebase Spark | Auth + Firestore + Storage free tiers |
| Gemini | Google AI Studio free quota |

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `GEMINI_API_KEY not set` | Add env var on Vercel, redeploy `--prod` |
| `Unauthorized` on API | User must be logged in; token sent as `Bearer` |
| Firestore permission | `FIREBASE_SERVICE_ACCOUNT_JSON` must be full JSON |
| App still calls old URL | Update `apiBaseUrl` in `app_config.dart` |
