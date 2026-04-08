# Project Architecture

This document details the technological foundations and system design of the `hydrant-admin-nextjs` dashboard.

## Tech Stack Overview

- **Frontend Framework**: Next.js 16 (App Router)
- **Programming Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS v4 (Utility-first) + Styled Components (for specific complex components)
- **Backend Service**: Firebase (Firestore, Auth, Functions)
- **UI Components**: custom components, Framer Motion for animations
- **Data Visualization**: Recharts
- **Integrations**: Zoho Sheets/Books, NodeMailer

---

## Authentication Flow

The application uses **Firebase Authentication** wrapped in a custom React Context.

1.  **`AuthProvider` (`src/context/AuthContext`)**: Monitor auth state changes and provide user profile data globally.
2.  **`AdminRoute` HOC (`src/components/AdminRoute.tsx`)**:
    - intercept navigation to protected routes.
    - Validate user existence and "Admin" role (stored in Firestore `admins` collection).
    - Redirect to `/` (Login) if unauthenticated or unauthorized.

---

## State Management Strategy

1.  **Global Identity**: Managed by `AuthProvider`.
2.  **Server State**: Directly fetched from Firestore via the `firebase` SDK in both Client and Server components.
3.  **Real-time Synchronization**: Uses `onSnapshot` for high-priority live views (Orders, Fleet Tracking).
4.  **Local UI State**: `useState` and `useReducer` within feature modules.

---

## Routing & Layouts

- **Root Layout (`src/app/layout.tsx`)**: Sets the font, global styles, and provides the Auth context.
- **Admin Layout (`src/app/admin/layout.tsx`)**: Implements the `AdminLayout` component which provides:
    - Sticky Navigation Bar.
    - Collapsible Sidebar with module links.
    - Responsive padding for main content areas.

---

## Data Integration (Zoho Sync)

- **Sync Loop**: The `src/api/zoho/` routes and `src/lib/zoho.ts` handle the export of daily delivery data from Firestore to Zoho Sheets.
- **Logic**: Iterates through "Delivered" orders, formats them as JSON, and uses OAuth 2.0 to push row updates to the connected spreadsheet.
