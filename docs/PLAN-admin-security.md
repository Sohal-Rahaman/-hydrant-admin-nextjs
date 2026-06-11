# Admin Panel Security & Session Management

This plan outlines the implementation of robust security features for the admin panel, focusing on device management, strict session expiration, and superadmin controls.

## Context
- **User Request:** "huge security, every 2 days logout automatically from all device, manage device and logged in device, 7908013185 superadmin, remove access from anyone"
- **Mode:** PLANNING ONLY (no code)
- **Output:** docs/PLAN-admin-security.md

## User Review Required

> [!IMPORTANT]
> **Superadmin Phone Number:** The plan hardcodes `+917908013185` as the primary superadmin. Please confirm this matches the exact format stored in Firebase Authentication (including country code).
>
> **UI Design Rules:** The `ui-ux-pro-max` generator suggested Purple, but our strict `GEMINI.md` rules contain a **PURPLE BAN**. Therefore, the UI will use a high-contrast **Dark Slate & Acid Green / Signal Orange** color palette, adhering strictly to the "Anti-Cliché" and "OLED Dark Mode" guidelines.

## Proposed Changes

### Configuration & Context

#### [MODIFY] src/lib/firebase.ts
- Add types for `AdminSession` to include `createdAt`, `expiresAt`, `deviceId`, `os`, and `browser`.
- Ensure `SUPERADMIN_PHONES` includes `+917908013185`.
- Add helper functions: `revokeAdminSession`, `revokeAllUserSessions`.

#### [MODIFY] src/context/AuthContext.tsx
- **2-Day Auto Logout:** Enforce a strict 48-hour expiration on all sessions. When setting up the session, set `expiresAt`.
- **Session Validation:** On load and periodically, check if the current session has expired (`Date.now() > expiresAt`). If so, automatically log out the user.
- **Enhanced Tracking:** Continue saving `os`, `browser`, and `userAgent` to the `admin_sessions` collection.

---

### Navigation

#### [MODIFY] src/components/AdminLayout.tsx
- Add a new navigation item for the Security Center.
- **Path:** `/admin/security`
- **Label:** `Security Center`
- **Icon:** `FiShield`
- **Permission:** Accessible only to `superadmin`.

---

### Security Module UI

#### [NEW] src/app/admin/security/page.tsx
This page will serve as the **PRO Control Center** for security.
- **Real-time Session Board:** Subscribe to the `admin_sessions` Firestore collection to show all active sessions.
- **Device Management:** Display cards for each active login, showing:
  - User Name & Phone
  - Role
  - Device (e.g., Mac Safari, Windows Chrome, iPhone Safari)
  - Last Active Time
  - Expiry Countdown (Time left until the 48-hour auto-logout)
- **Super Admin Actions:**
  - **"Revoke Device"**: A button on each card to immediately log out that specific device.
  - **"Log Out Everywhere"**: A global action to revoke all active sessions for a specific user.

## Verification Checklist
- [ ] 48-hour expiration is calculated correctly.
- [ ] Expired sessions automatically log the user out.
- [ ] Superadmin can see all active sessions across all devices.
- [ ] Superadmin can revoke a specific device session.
- [ ] Superadmin can log a user out of all devices.
- [ ] Non-superadmins cannot access the Security Center.
