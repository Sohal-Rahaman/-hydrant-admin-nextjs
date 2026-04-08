# Project Structure Details

This document provides a detailed breakdown of the `hydrant-admin-nextjs` repository.

## Directory Tree (Simplified)

```
hydrant-admin-nextjs/
├── docs/                # Project documentation
│   ├── project-info/    # Deep technical details
├── public/              # Static assets (logos, payment codes)
├── scripts/             # Utility scripts for data/ops
├── src/
│   ├── app/             # Next.js App Router (Routes & Pages)
│   │   ├── admin/       # Core Admin Dashboard (26+ sub-routes)
│   │   ├── api/         # Backend API Routes (Server Actions/CRON)
│   │   ├── layout.tsx   # Root Layout (Auth/Registry)
│   │   └── page.tsx     # Landing/Auth Page
│   ├── components/      # Shared React Components
│   ├── context/         # React Context Providers (Auth)
│   └── lib/             # Core Utilities & Library Config
```

## Core Directories & File Responsibilities

### `src/app/admin/`
The heart of the application, containing all administrative modules.
- **`analytics/`**: Data visualization and performance reporting.
- **`crm/`**: Customer relationship management.
- **`fleet/`**: Vehicle and driver tracking.
- **`orders/`**: Live order management and history.
- **`subscriptions/`**: Managed delivery schedules.
- **`layout.tsx`**: Wraps all admin routes with a consistent sidebar and header.

### `src/app/api/`
Handles server-side logic and integrations.
- **`zoho/`**: Synchronization logic for Zoho Sheets/Books.
- **`cron/`**: Daily automated tasks (SMS alerts, status updates).
- **`orders/`**: Server-side order processing and validation.

### `src/lib/`
Utility functions and configuration for 3rd party services.
- **`firebase.ts`**: Initialized Firebase SDK and core CRUD helpers.
- **`zoho.ts`**: Logic for interacting with the Zoho API.
- **`activityLogger.ts`**: Audit trail system for tracking admin actions.
- **`orderStatus.ts`**: Shared constants and labels for order states.

### `src/components/`
- **`AdminLayout.tsx`**: The main UI shell (Sidebar, Navbar, Mobile responsiveness).
- **`AdminRoute.tsx`**: High Order Component (HOC) that redirects unauthenticated users.
- **`DeliveryHandoverModal.tsx`**: A critical UI component for updating jar delivery details.
