# Project Plan: Pro Control Center Overhaul

**Goal**: Create a comprehensive, real-time command center for managing Hydrant Pro subscriptions, onboarding fees, and renewal lifecycles.

## Phase -1: Context Check
We need to connect the Admin Panel directly to the Firestore `users` and `subscriptions` collections to extract:
- Users who have paid the ₹200 Onboarding Fee (`isOnboardingFeePaid`).
- Users active on specific plans (`planId`: `lite`, `pro`, `proMax`).
- Subscription statuses (`active`, `past_due`, `cancelled`).
- Next Billing Cycle dates (`currentPeriodEnd`).

## Phase 0: Socratic Gate (Open Questions for You)
Before we write the code, I need to clarify a few business rules:
1. **Actionable Controls**: Do you want buttons inside this dashboard to manually **Cancel**, **Pause**, or **Refund** a user's subscription, or should this purely be an analytical monitoring dashboard?
2. **"Failed Countdown" Logic**: For the "last 5 days countdown", do you mean users whose subscription has expired and they have a 5-day grace period to pay before their jars are reclaimed? 

## Phase 1: Architecture & UI Layout
We will structure the `pro-control` page into three distinct sections:

### 1. High-Level Metrics (Top Row)
- **Total Pro Members**: Active subscriptions.
- **Onboarding Revenue**: Count of users who paid the ₹200 deposit.
- **Plan Breakdown**: 
  - Standard Refill (Lite) count
  - Smart Refill (Pro) count
  - Unlimited Refill (Pro Max) count
- **At Risk**: Subscriptions failing renewal or in the grace period.

### 2. The "At-Risk" & "Action Required" Feed (Middle Row)
- A highly visible, red-tinted table specifically for users whose **Renewal Failed** or who are in the **Last 5 Days** countdown. 
- Displays their Name, Phone, Jars Held, and Days Remaining to resolve the payment.

### 3. Master Subscriber Table (Bottom Row)
A searchable, filterable data grid containing:
- Customer Name / Phone
- Deposit Paid? (Yes/No)
- Current Plan (Standard/Smart/Unlimited)
- Status (Active/Failed)
- Renewal Date
- Quick Action Button (View Details)

## Phase 2: Implementation Tasks
- [ ] Connect `onSnapshot` listeners to `users` and `orders/subscriptions` collections.
- [ ] Implement data parsing to calculate "Days until renewal" and "Days overdue".
- [ ] Build responsive, dark-themed UI components matching the Hydrant Command Center aesthetics.
- [ ] Implement filtering (e.g., "Show only Unlimited users", "Show failed renewals").

## Phase 3: Verification
- Ensure realtime updates work without manual refresh.
- Verify that filtering accurately matches the mobile app's database state.
