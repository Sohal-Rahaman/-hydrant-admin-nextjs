# Plan: User Jars Tracking Display

## Context
- **Task:** Display a list of "locked" or "held" jars for the selected user in the "Wallet & Jars" section of the `/admin/users` page. 
- **Goal:** Allow admins/staff to see exactly which jar IDs (e.g. `HYD-JAR-1234`) a user is holding whenever they view a user's details or assign a new jar.

## Task Breakdown

### 1. State Management & Data Fetching
- Define a TypeScript interface for `JarData` (e.g. `interface JarData { id: string; }`).
- Add state variables: `jars` (`JarData[]`) and `jarsLoading` (`boolean`) inside `UsersPage`.
- Update the `useEffect` that listens to `selectedUser.id` to also query the `holdJars` collection where `userId == selectedUser.id`.

### 2. UI Updates in "Wallet & Jars" Tab
- Locate the "WALLET & JARS" section within `src/app/admin/users/page.tsx` (around the "JAR MANAGEMENT" sub-section).
- Add a new "HELD JARS" sub-section just below or alongside the Jar Management box.
- Map over the `jars` array and display each `jar.id` as a badge/pill (similar to the customer section).
- Handle loading and empty states ("Loading jars..." / "No jars held.").

## Agent Assignments
- **Frontend-Specialist**: To implement the UI changes in `page.tsx` using styled-components or inline styles matching the existing design system.
- **Backend-Specialist**: To implement the Firestore query to fetch the `holdJars` data accurately in real-time.

## Verification Checklist
- [ ] Ensure `holdJars` are correctly fetched when a user is selected in the "All Users" tab.
- [ ] Ensure the jar IDs render beautifully in the "WALLET & JARS" tab without breaking the layout.
- [ ] Confirm that when a jar is locked (assigned) to the user, the UI updates in real-time to reflect the new jar in the list.
