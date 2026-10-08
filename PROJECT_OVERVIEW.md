# Wholesale Tally (SmarTally) — Comprehensive Project Blueprint & Architecture

> **Executive Summary:** A mobile-first automation ecosystem built for traditional Indian wholesale businesses. It eliminates the manual double-entry bottleneck by turning paper slips and bills into structured accounting vouchers using AI, automatically streaming them into Tally Prime on the shop counter.

---

## 1. The Core Idea & The Real-World Problem

### 1.1 The Ground Reality in Wholesale Hubs
In traditional wholesale markets (textiles, apparel, hardware, FMCG, electricals), trade moves rapidly over counters, phone calls, and WhatsApp messages:
- **High-Velocity Counter Trade:** Sales occur rapidly with verbal negotiations and handwritten rough estimates (*kachha parchis*).
- **Physical Supplier Bills:** Incoming purchase bills arrive as paper invoices packed in transport bundles or courier packets.
- **The Operator Bottleneck:** Most wholesale shops hire a computer operator whose primary job is manually re-entering every single paper invoice line-by-line into desktop **Tally Prime**.
- **Double Entry Chaos:** Every transaction is recorded twice: first on paper by the owner, and second into Tally by the operator.
- **Compliance Delays:** E-Way Bills are manually typed into Tally or the government portal one-by-one, slowing down goods dispatch.

### 1.2 The Strategic Thesis
> **"Do not replace Tally. Be the mobile frontend to Tally."**

Most software startups fail in Indian wholesale because they attempt to replace Tally with a new ERP or mobile accounting app. Business owners and Chartered Accountants (CAs) **will not abandon Tally** — it is the industry standard for tax filing, audits, and statutory compliance.

**Wholesale Tally’s Value Proposition:**
1. Leave Tally Prime intact on the shop PC as the legal accounting ledger.
2. Put a fast, modern mobile app in the owner's hands.
3. Automatically bridge the phone to the desktop PC via a silent background sync service.

---

## 2. High-Level Architecture & Technical Philosophy

```
┌────────────────────────────────────────────────────────┐
│                      MOBILE APP                        │
│   (Flutter: Android & Web — Owner's Pocket)            │
│   • OTP Login (Zero Passwords)                         │
│   • Camera Bill Scanner / PDF Upload / Text Input      │
│   • Visual Verification UI (Amber Low-Confidence flags)│
│   • Live Tally Sync Status Indicator                   │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS (Bearer Auth)
                           ▼
┌────────────────────────────────────────────────────────┐
│                     CLOUD BACKEND                      │
│   (Vercel Serverless / Firebase Cloud Functions)       │
│   • Gemini AI Engine: Multimodal OCR & JSON extraction │
│   • GST Rule Engine: Inter-state (IGST) vs Intra-state │
│   • Tally XML Builder: Creates Voucher & Master XML    │
│   • Cloud Database: Firestore (Single Source of Truth) │
│   • Monotonic FIFO sync_queue: Ordered push queue      │
└──────────────────────────▲─────────────────────────────┘
                           │ Long-Poll / HTTPS Poll
                           │ Token Auth (`Agent <token>`)
┌──────────────────────────┴─────────────────────────────┐
│                   WINDOWS SYNC AGENT                   │
│   (Lightweight Go background service in System Tray)   │
│   • Paired via 6-digit one-time code                   │
│   • Polls sync_queue sequentially                      │
│   • Auto-creates missing Ledgers & Stock Items         │
│   • Pushes XML to localhost:9000                       │
│   • System Tray Icon: Green (Synced), Red (Error)      │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP POST (XML)
                           ▼
┌────────────────────────────────────────────────────────┐
│                   TALLY PRIME DESKTOP                  │
│   (Listening on port 9000 inside the shop)             │
│   • Accounting vouchers created automatically          │
│   • Ledgers, inventory & taxes updated                 │
└──────────────────────────┘
```

### Core Architecture Pillars:
1. **The Cloud is the Source of Truth:** Tally is treated as an accounting mirror. If Tally crashes or data is accidentally altered on the PC, the entire ledger can be re-synced from the cloud.
2. **Outbound-Only Polling:** The Windows Sync Agent reaches out to the cloud. This avoids router port forwarding, static IPs, dynamic DNS, and firewall blocks on residential WiFi.
3. **Monotonic FIFO Queue & Idempotency:** Vouchers have monotonic sequence numbers to guarantee chronological order. Every voucher carries an idempotency tag (`APPINVOICEID`) so network retries never create duplicate entries in Tally.

---

## 3. Detailed Phase-by-Phase Feature Breakdown

### Phase 1: Bill Scanner → Tally Push (Active / Built)
Eliminates data entry for incoming supplier purchase bills and physical paper bills.

* **Frictionless Phone OTP Authentication:** Fast login via phone number and OTP without complex passwords.
* **Multi-Input Bill Scanner:**
  * **Camera Capture:** Snap a photo of a physical bill or paper slip directly in the shop.
  * **File Upload:** Upload PDF invoices received over WhatsApp or email.
  * **Direct Text Paste:** Paste raw bill messages or text descriptions.
* **Gemini AI Vision Extraction:**
  * Uses Google Gemini with structured JSON extraction schemas.
  * Extracts: Supplier/Customer Name, GSTIN, Invoice Date, Invoice Number, Payment Mode.
  * Line-by-line item extraction: Item Description, Quantity, Unit (Pcs, Mtr, Box), Unit Rate, Discount, HSN Code, Tax Rate.
  * Confidence Scoring: High-confidence vs low-confidence fields.
* **Human-in-the-Loop Visual Verification Screen:**
  * An intuitive review screen where low-confidence fields are highlighted with **amber badges**.
  * The owner can tweak any rate or quantity with a tap instead of typing the entire bill from scratch.
  * Dynamic GST tax preview: Computes Subtotal, CGST, SGST, IGST, and Grand Total on the fly.
* **Automated Tally XML Generation:**
  * Detects state codes from GSTIN numbers to classify transactions as intra-state (CGST + SGST) or inter-state (IGST).
  * Automatically constructs standard Tally XML vouchers (`Purchase` or `Sales`).
  * Generates auto-creation definitions for new Ledger Masters and Stock Items so Tally does not reject unfamiliar items.
* **Seamless PC Agent Pairing:**
  * Mobile displays a temporary 6-digit pairing code (10-minute TTL).
  * Entering this code into the desktop agent securely binds the PC to the shop's cloud account.
* **Windows Go Sync Agent:**
  * Tiny background executable with system tray integration.
  * Continuously polls the cloud queue, probes Tally on port 9000, and reports health heartbeats back to mobile.
  * Live sync status reflected on the phone: *Pending*, *In-Flight*, *Synced*, or *Failed*.

---

### Phase 2: Item Catalog & Tap-to-Bill (Outgoing Sales)
Empowers the owner to bill counter sales live while talking to the customer, removing paper slips entirely.

* **Photo-First Item Catalog:**
  * Solves the textile SKU issue: take a photo of a fabric or garment; AI auto-suggests category, fabric type, color, and standard price bands.
  * Pre-configured HSN codes and GST percentages per item.
* **Fast Tap-to-Bill POS Screen:**
  * Visual grid of popular items.
  * One-tap quantity steppers (`+` / `-`).
  * Instant party ledger selection.
* **Instant Digital Invoices & WhatsApp Delivery:**
  * Generates a branded, GST-compliant PDF invoice with business details, GST breakup, and total in words.
  * Direct one-tap WhatsApp share link to the buyer's phone.
* **Direct Sales Voucher Sync:**
  * Outgoing sales automatically queue and sync to Tally as `Sales` vouchers alongside Phase 1 purchases.

---

### Phase 3: Compliance & Cash Flow (E-Way Bill, Khata & UPI)
Automates post-sale compliance and debt collection.

* **1-Tap Direct NIC E-Way Bill Generation:**
  * Most software forces users to pay hefty GSP fees or endure Tally's clunky e-way module.
  * Uses the business's own direct NIC credentials (`ewaybillgst.gov.in`) for **100% free, 3-second EBN generation**.
  * Automatically writes the generated E-Way Bill Number (EBN) back into the Tally voucher.
* **Smart Digital Khata (Receivables Tracking):**
  * Tracks party-wise outstanding balances on 30, 60, and 90-day aging buckets.
  * Eliminates physical red notebooks (*bahi-khata*).
* **Embedded UPI Payment Links:**
  * QR codes and dynamic UPI links embedded directly on digital bills.
  * Customers pay via PhonePe, Google Pay, or Paytm; ledger reconciles automatically.
* **Automated WhatsApp Payment Reminders:**
  * Scheduled, polite reminder messages sent to overdue debtors with payment links attached.

---

### Phase 4: Network Expansion & Scale
Extends the platform across the wholesale ecosystem.

* **WhatsApp Order Ingestion:**
  * Retailers frequently send orders via WhatsApp voice notes and photos of scribbled lists.
  * Ingests and parses these messages using AI to auto-draft a pending invoice for the owner to approve with one click.
* **Vernacular Voice Billing:**
  * Natural speech billing in Hindi, Gujarati, and Marathi (e.g., *"Do thaan red cotton, char piece blue silk"*).
  * Automatically matches catalog items and drafts the bill.
* **Shareable Digital Storefront:**
  * A lightweight WhatsApp catalog link showing "New Arrivals" sent to hundreds of retail clients.
  * Orders placed by retailers flow straight into the wholesaler's app.
* **Chartered Accountant (CA) Export Pack:**
  * One-click monthly export package containing Tally XML and GSTR-1 draft files sent directly to the CA on the 5th of every month.

---

## 4. Codebase Directory Mapping

| Layer | Directory / File | Tech Stack | Role |
| :--- | :--- | :--- | :--- |
| **Mobile App** | `app/` | Flutter (Dart) | Multi-platform mobile app (Android & Web) |
| **App Screens** | `app/lib/screens/` | Flutter | `login_screen.dart`, `home_screen.dart`, `scan_bill_screen.dart`, `verify_bill_screen.dart`, `invoice_success_screen.dart` |
| **Cloud Endpoints** | `api/` | Vercel Serverless (TS) | 8 API handlers: `extractBill`, `confirmInvoice`, `pairAgent`, `ensureUserProfile`, `getPendingQueue`, `markInFlight`, `markSynced`, `agentHeartbeat` |
| **Server Logic** | `server/` | Node.js / TypeScript | Core backend orchestration & business rules |
| **AI OCR Engine** | `server/lib/gemini.ts` | Google Gemini API | Multimodal structured prompt parser |
| **Tax & XML Engine** | `server/lib/gst.ts` & `tallyXml.ts` | TypeScript | GST classification and Tally XML generation |
| **Desktop Agent** | `agent/` | Go (Golang) | Windows background daemon with system tray icon |
| **Database Rules** | `firestore.rules` | Firebase Firestore | User-level security rules and document isolation |

---

## 5. Economic & Competitive Moat

1. **Zero Behavioral Change for the CA:** The CA continues opening Tally on their desktop as they have for decades.
2. **Zero Manual Double Entry:** Eliminates hours of tedious typing and reliance on a dedicated data-entry operator.
3. **Works with Spotty Internet:** Designed offline-first; bills can be scanned or created even when the shop or warehouse has poor connectivity.
4. **Negligible Running Cost:** Built on serverless infrastructure and direct government APIs, keeping operating costs minimal (~₹1,000/year domain cost).
5. **Natural B2B Network Effect:** When wholesalers share invoices and digital catalogs with retailers, those retailers can be onboarded, creating an organic distribution loop.
