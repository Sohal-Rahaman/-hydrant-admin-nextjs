# PLAN: Hydrant 2.O Pro Model Deep Dive (Phase 2)

## Context
Following the foundational Pro Model implementation, this plan addresses the remaining core architecture based on the Deep Dive documentation and user-confirmed Socratic Gate decisions.

**Decisions Confirmed:**
- **Razorpay Subscription**: Backend-driven (Option 1B).
- **Overage Enforcement**: Auto-Upgrade (Option 2B).
- **Trial Abuse Prevention**: Strict Phone check (Option 3A).
- **Legacy Restriction**: Existing users bypass Pro entirely; new users strictly cannot order without active trial or paid Pro.

---

## Task Breakdown

### 1. Razorpay Backend-Driven Subscriptions (`functions/src/pro-model.js`)
- **[Task]** Integrate Razorpay Node.js SDK inside Cloud Functions.
- **[Task]** Update `enrollPro`: Instead of directly marking the user as 'active', this function will now call Razorpay to generate a Subscription Link/ID based on the requested `planId`, and return it to the frontend.
- **[Task]** Create `razorpayWebhook` HTTPS function. It will listen for `subscription.charged` to officially update the user's `proStatus` to 'active' and extend `proPeriodEnd` by 30 days.

### 2. Auto-Upgrade Logic (`functions/src/pro-model.js`)
- **[Task]** Modify `placeOrder`:
  - When a user on the Lite Plan (limit 10) places their 11th jar order, automatically upgrade them to Pro (limit 25).
  - Charge the prorated difference (e.g., ₹20) implicitly via the existing mandate or wallet.
  - Update `proPlanId` to 'pro'.

### 3. Trial Abuse Prevention (Phone Strict)
- **[Task]** Modify `onUserCreate`:
  - Before granting the 3-day Pro Max trial, query the `users` collection to check if the specific `phoneNumber` has ever existed before (even if the UID differs).
  - If a duplicate phone number is detected, mark `proStatus` as `'expired'` immediately instead of `'trial'`.

### 4. Overdue Jar Penalty Workflow
- **[Task]** Create new PubSub cron job `chargeOverdueJar` (runs weekly/daily):
  - Queries `jars` collection where `status == 'assigned'` and `assignedAt` is older than 7 days.
  - Automatically fetches the associated `currentUserId`.
  - Charges ₹165 from the user's wallet (or triggers Razorpay mandate).
  - Logs penalty in the user's activity log.

### 5. Strict Legacy Isolation (`functions/src/pro-model.js`)
- **[Task]** Enforce strict frontend and backend separation in `placeOrder`:
  - If `isLegacy == true`, proceed to order generation without restricting limits.
  - If `isLegacy == false` and `proStatus == 'expired'` (or null), return definitive `failed-precondition` blocking New users from ordering.

---

## Agent Assignments

- **`backend-specialist`**: Handling Razorpay SDK integration, Webhook signature verification, PubSub cron generation for `chargeOverdueJar`, and updating `placeOrder` logic.
- **`frontend-specialist`**: Hooking up the Razorpay SDK checkout flow in the Admin/Customer apps when `enrollPro` returns the order parameters.

---

## Phase X: Verification Checklist

- [ ] Initiate a trial for a new user and confirm backend rejects a 2nd signup with the same phone.
- [ ] Mock an `enrollPro` checkout and confirm Razorpay subscription payload generates successfully.
- [ ] Simulate Razorpay `subscription.charged` webhook and verify `proStatus` changes to 'active'.
- [ ] Trigger an 11th jar order for a Lite user and verify auto-upgrade + wallet deduction.
- [ ] Manually age an assigned jar > 7 days and trigger `chargeOverdueJar` confirming ₹165 penalty application.
- [ ] Create order via `isLegacy = true` and ensure standard flow executes without trial limit checks.
