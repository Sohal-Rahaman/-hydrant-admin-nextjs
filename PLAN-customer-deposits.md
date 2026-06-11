# PLAN: Customer Deposits & Pro Plans
# Status: DRAFT - Pending User Answers

## Overview
Currently, the "Jar deposit" metric in the Wallet tab is hardcoded to `₹200` for everyone. We need to make this dynamic based on the customer's true status and allow admins to edit deposit/plan amounts per user.

## Project Type
WEB (Next.js Admin Panel) - `frontend-specialist`

## Socratic Gate (Open Questions)
Before finalizing the implementation plan, please clarify the following:

1. **Custom Deposit Amounts**: When an admin changes the deposit amount for a `DEPOSIT_CUSTOMER` (e.g. they paid ₹300 instead of ₹200), should we save this custom amount to the user's document in Firestore (e.g. as `jar_deposit_amount`)?
2. **Pro Plans Data**: For `PRO_CUSTOMER`s (paying 15, 35, or 55 per month), do we currently store which specific Pro plan they are subscribed to in their user profile? Or should we add a new dropdown/field to select their specific Pro tier?
3. **Display Rules**: 
   - `VISITOR` -> ₹0
   - `FREE_CUSTOMER` (Legacy) -> ₹0
   - `DEPOSIT_CUSTOMER` -> ₹200 (or custom editable amount)
   - `PRO_CUSTOMER` -> Shows their monthly plan amount (e.g. ₹15/mo) instead of a one-time deposit?

## Proposed Task Breakdown (Preliminary)

### Task 1: Update User Schema & UI State
- **Agent**: `frontend-specialist`
- **Action**: Add state fields for `jar_deposit_amount` (number) and `pro_plan_tier` (string). Add these to the `editFields` object when a user is selected.

### Task 2: Dynamic Deposit Display
- **Agent**: `frontend-specialist`
- **Action**: Modify the hardcoded `₹200` in the "Jar deposit" metric card to dynamically read the user's actual status and amount.

### Task 3: Admin Edit Controls
- **Agent**: `frontend-specialist`
- **Action**: In the "Wallet & Jars" tab, add an input field to edit the custom Deposit Amount (if status is Deposit Paid) or a dropdown to select the Pro Tier (if status is Pro Subscriber). Save these values to Firestore.

## Phase X: Verification
- [ ] Ensure changing status updates the UI immediately.
- [ ] Verify custom deposit amounts save to Firestore correctly.
- [ ] Ensure legacy/free customers show 0 deposit.
