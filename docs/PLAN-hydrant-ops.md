# PLAN-hydrant-ops

## Goal
Design and define the COMPLETE OPERATIONAL SYSTEM for HYDRANT 2.O, transforming it into a fully automated, scalable, data-driven utility business modeled after Swiggy's operations, Zoho's systems, and Amazon's control.

## System Architecture Overview
- **Database**: Firebase Firestore (existing)
- **Backend Admin & APIs**: Next.js App Router (Serverless)
- **Finance Operations**: Zoho Books (OAuth 2.0 connected via `/settings/zoho_integration`)
- **Automations & Cron**: Google Cloud Scheduler (or Vercel Cron) targeting Next.js API Routes.
- **Messaging**: WhatsApp Business API (Meta)

---

## 📦 1. DAILY OPERATIONS WORKFLOW

### Morning (06:00 AM) Prepare
- **Trigger**: Cron job `GET /api/ops/morning-prep`
- **Actions**:
  - Queries Firestore: `orders` where `status == 'pending'` & `deliveryDate == today`.
  - Groups orders by geographical sector.
  - Generates manifest and assigns delivery slots/agents automatically via round-robin or manual Admin Panel override.

### During Day (Execution)
- **Trigger**: Delivery Agent App / Mobile Web pushing `POST /api/ops/update-status`
- **Actions**:
  - Agent hits "Delivered" or "Failed" per customer.
  - Real-time Firestore sync reflects on Admin Dashboard instantly.

### End of Day (21:00 PM) Reconcile
- **Trigger**: Cron job `GET /api/ops/eod-reconcile`
- **Actions**:
  - Audits total jars dispatched vs delivered vs returned.
  - Freezes daily ledger.
  - Triggers Google Sheets Daily Sync (See Section 6).

---

## 🔄 2. ORDER → PAYMENT → INVOICE FLOW

All orders pass through a strict state machine implemented in `src/app/api/orders/create/route.ts`.

### WHEN Order is Placed:
1. Read `users/{userId}/wallet_balance`.
2. Compare against `(Qty * 37)`.
3. If Sufficient → **Atomic Firebase batch write**: Deduct wallet, create Order document (`status: confirmed`).
4. If Insufficient → Reject order creation, trigger Email template: *"Hydrant: Low Balance Alert. Please recharge to schedule tomorrow's delivery."*

### WHEN Order is Delivered:
1. Order status changes to `delivered`.
2. Wait, do we invoice now? **NO.** We batch it.
3. System fires a quick Email: *"✅ 2 Jars Delivered. Wallet Bal: ₹100"*
4. Order silently adds to the customer's un-invoiced ledger.

### WHEN Billing Cycle Hits (Weekly/Monthly):
1. **Trigger**: Cron job `GET /api/billing/generate-invoices` or Manual click from Admin.
2. System aggregates all `delivered` orders for that timeframe.
3. **Zoho Push**: System fetches `refresh_token`, pushes one massive aggregated Invoice to Zoho Books per customer (e.g., "15x 20L Water Jars for March").
4. System automatically emails this official PDF invoice.
1. If cancelled post-dispatch: Order marked `cancelled`.
2. Calculate partial deductions if applicable.
3. Credit original `wallet_balance`.
4. Push "Credit Note" API call to Zoho Books to maintain accounting parity.

---

## 👥 3. USER LIFECYCLE MANAGEMENT

Tracked via `users/{userId}` document fields: `lastOrderDate`, `orderFrequency`, `walletBalance`.

**Nightly Lifecycle Cron (`/api/users/lifecycle-eval`)**:
- Calculates `daysSinceLastOrder = today - lastOrderDate`.
- `days <= 7`: Mark **Active**.
- `7 < days <= 15`: Mark **Inactive**. 
  - *Action*: Auto-trigger Email: *"Running low on hydration? Tap to schedule a refill."*
- `days > 15`: Mark **Churned**.
  - *Action*: Auto-trigger Promo Email: *"Here is a 10% discount on your next Jar!"*
- `totalOrders > 50`: Tag as **High-Value**. Priority routing applied to morning deliveries.

---

## 💰 4. WALLET & DEPOSIT CONTROL

**Critical Accounting Principle**: Wallet is Prepaid Revenue. Deposit is a Liability.
- `walletBalance`: Used for per-jar (`₹37`) deductions.
- `depositBalance`: Tracks security (e.g. `₹350`). Represented in Zoho Books strictly as a **Liability / Customer Advance** account, never under Sales Revenue.

**Deposit Refund Flow**:
1. User requests refund.
2. Admin reviews jars returned vs jars missing.
3. System automatically calculates `depositBalance - Maintenance Fee (₹150)`.
4. Final amount queued for UPI payout.
5. Account marked `deactivated`.

---

## 🤖 5. AUTOMATION SYSTEM (COMMUNICATION)

Powered by standard SMTP/Gmail or a transactional email service (SendGrid/Resend) wrapped in Next.js APIs.

| Trigger Event | Action/Message | Channel |
| :--- | :--- | :--- |
| **No order in 3 days** | "Reminder: Schedule your next drop." | Email |
| **Wallet < ₹50** | "Low balance! Recharge now to avoid interruption." | Email |
| **Order Delivered** | "✅ 2 Jars Delivered. Wallet Bal: ₹100" | Email |
| **Refund Processed** | "₹200 Deposit Refund initiated to your Bank." | Email |

---

## 📊 6. REPORTING SYSTEM (GOOGLE SHEETS)

Automated Analytics bypasses complex BI tools via a nightly secure push to Google Sheets API (`/api/reports/sheets-sync`).

- **Sheet 1: Orders**: Extracts `createdAt`, `total`, `delivered_count`, `failed_count`.
- **Sheet 2: Revenue**: Wallet deduptions vs Cash on Delivery vs Top-ups.
- **Sheet 3: Users**: Deltas of Active, Inactive, Churned arrays.
- **Sheet 4: Deposits**: Total liability held vs Refunds pending execution.

---

## 🧑‍💻 7. ADMIN PANEL ACTION SYSTEM

Expanding our current Next.js Admin Panel to operate the above pipelines safely:

- **User Page**: Single pane of glass viewing Wallet, Deposit Liability, and Zoho Sync Status. Buttons to manually trigger WhatsApp push.
- **Orders Page**: Real-time assignment dropdowns linking order blocks to Agents.
- **Finance Page**: Ledger views, manual refund approvals, and Zoho sync error logs.
- **Analytics Page**: Chart.js visualizations mirroring the Google Sheets data.

---

## ⚠️ 8. ERROR HANDLING

- **Transaction Failures**: Firebase `runTransaction` ensures data consistency. If wallet deduction fails mid-flight, order drops to `failed`.
- **Zoho / 3rd Party API Outages**: Next.js API implements a "Dead Letter Queue" inside Firestore (`sys_errors` collection). Cron job retries pushing failed invoices to Zoho Books next hour.
- **Manual Overrides**: Admin Master Switch allows forcing an order to "Delivered" and bypassing wallet check in disputes.

---

## 📈 9. SCALING SYSTEM

- **Idempotency**: All API routes will be written to be idempotent. (Hitting the Zoho invoice generate button twice won't create 2 invoices).
- **Serverless Architecture**: Next.js automatically scales API concurrent limits gracefully.
- **Event-Driven**: Moving from hard-coded direct function calls to Pub/Sub queues when processing exceeds >500 daily orders to ensure lightning-fast UI responses.

---

## Done When
- [ ] Admin panel surfaces all the above logic in the UI.
- [ ] Wallet and Order states are strictly validated on the backend.
- [ ] Webhooks and Next.js APIs successfully trigger WhatsApp, Zoho, and Sheets respectively without manual input.
