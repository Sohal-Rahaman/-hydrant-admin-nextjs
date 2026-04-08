# PLAN: Wallet Management Ledger (HYDRANT 2.0)

This plan transforms our simple "balance field" into a robust, auditable financial system. We are moving to a **double-entry ledger** approach to ensure trust and data integrity.

## User Review Required

> [!IMPORTANT]
> **Negative Balances Confirmed**: All users will be allowed to place orders even if their balance is insufficient. This "Trust First" policy means we must ensure our collection process for negative users is clear.
> 
> [!WARNING]
> **Atomic Integrity**: All wallet changes will now require a transaction record. We will use Firestore Transactions to ensure that updating a balance and creating a transaction record never fail independently.

## Proposed Changes

### 1. Database Schema (Firestore)

#### [NEW] `wallet_transactions` Collection
Every update to a user's wallet will generate a document here:
- `userId`: Reference to the user.
- `amount`: Number (positive for top-ups/refunds, negative for purchases).
- `previous_balance`: The balance BEFORE this transaction.
- `new_balance`: The balance AFTER this transaction.
- `type`: `ORDER_PAYMENT`, `TOP_UP`, `REFUND`, `ADMIN_ADJUSTMENT`, `CANCELLATION_REFUND`.
- `referenceId`: The ID of the related Order or Top-up record.
- `description`: Human-readable text (e.g., "Payment for Order #12345").
- `createdAt`: Timestamp.
- `createdBy`: UID of the actor (User or Admin).

---

### 2. API Layer (Backend)

#### [MODIFY] [orders/create/route.ts](file:///Users/Programe/hydrant-core/sssss/hydrant-admin-nextjs/src/app/api/orders/create/route.ts)
- **Trust-Based Checkout**: Remove the `insufficientFunds` check.
- **Ledger Entry**: Within the transaction, create the `wallet_transactions` record alongside the order.
- **Negative Balance Support**: Calculate `finalBalance` even if it goes below zero.

#### [MODIFY] [orders/cancel/route.ts](file:///Users/Programe/hydrant-core/sssss/hydrant-admin-nextjs/src/app/api/orders/cancel/route.ts)
- **Refund Logic**: Ensure a "Refund" transaction record is created when an order is cancelled.

---

### 3. Admin UI (Dashboard)

#### [MODIFY] [CustomersPage.tsx](file:///Users/Programe/hydrant-core/sssss/hydrant-admin-nextjs/src/app/admin/customers/page.tsx)
- **User Passbook**: Replace the static balance display in the user details drawer with a "Recent Transactions" table.
- **Audited Adjustment**: Modify the "Adjust Balance" tool to require a "Reason" field, which will be saved in the transaction description.

#### [MODIFY] [CRMPage.tsx](file:///Users/Programe/hydrant-core/sssss/hydrant-admin-nextjs/src/app/admin/crm/page.tsx)
- **Negative Balance Highlighting**: Visually flag users with deeply negative balances (e.g., > -₹100) for proactive outreach.

---

## Open Questions

1. **Transaction Limits**: Should there be a maximum negative "Trust Limit" (e.g., -₹200) to prevent abuse?
2. **Bulk Migration**: For existing users with ₹0 balance and no history, should we "initialize" their history with a one-time migration record?

---

## Verification Plan

### Automated Tests
- Test order creation with ₹0 balance -> Verify balance becomes -₹37.
- Test cancellation of a negative-balance order -> Verify balance is restored correctly.
- Verify `wallet_transactions` creation for every action.

### Manual Verification
- Perform a manual balance adjustment in the Admin UI and check the user's "Statement" view.
