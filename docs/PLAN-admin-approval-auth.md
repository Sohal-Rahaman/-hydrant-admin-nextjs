## 🧠 Brainstorm: Approval-Based Admin Auth

### Context
Currently, the admin panel allows logins via OTP or a WhatsApp mock flow. The mock flow (`loginWithWhatsApp`) automatically grants Super Admin privileges without checking if the user is actually authorized. The goal is to lock down the system so ONLY pre-approved numbers (added by the Super Admin) can access the backend.

---

### Option A: Strict Pre-Whitelisting (Recommended)
Users must be manually added to the "Manage Roles" dashboard (the `admins` collection) by the Super Admin **before** they can even attempt to log in.

✅ **Pros:**
- Maximum security. Zero chance of unauthorized access.
- Immediate rejection if the phone number isn't on the list.
- Closes the `loginWithWhatsApp` security hole completely.

❌ **Cons:**
- Super Admin must proactively add users before they can use the system.

📊 **Effort:** Low

---

### Option B: Request Access Flow
Users can log in via OTP, but if they aren't approved, they are placed in a "Pending" state. The Super Admin sees a queue of pending requests and can approve them.

✅ **Pros:**
- Slightly better UX for new employees.
- Super Admin doesn't have to manually type phone numbers (just clicks approve).

❌ **Cons:**
- Requires building a new "Pending Approvals" UI.
- More complex state management in `AuthContext`.

📊 **Effort:** High

---

## 💡 Recommendation
**Option A** is the best fit for highly confidential backend data. We will enforce strict pre-whitelisting.

# Implementation Plan

## Proposed Changes

### 1. Close Security Holes in Auth Context
#### [MODIFY] `src/context/AuthContext.tsx`
- Refactor `loginWithWhatsApp`: Before granting mock `Super Admin` access, verify the phone number is either in `SUPERADMIN_PHONES` or exists in the `admins` collection with `status: 'active'`.
- If a user fails the check (whether via OTP or Mock Auth), instantly call `signOut()` and show an alert: "Access Denied: Number not approved for Admin access."

### 2. Immediate Global Logout Script
#### [NEW] `scripts/force_logout_all.js`
- Create a one-off Node script that connects to Firestore and sets `status: 'revoked'` on ALL documents inside the `admin_sessions` collection.
- I will run this script immediately after you approve this plan to ensure everyone is kicked out.

## User Review Required
> [!IMPORTANT]
> Does Option A (Strict Pre-whitelisting) sound good to you? Once approved, I will run the script to forcefully log out everyone globally, and then patch the `AuthContext` to require explicit approval.
