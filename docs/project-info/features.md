# Admin Features & Modules

This document catalogs the administrative capabilities of the Hydrant Dashboard.

## Core Modules

### 1. CRM (Customer Relationship Management)
- **Path**: `src/app/admin/crm`
- **Features**:
    - **Customer Search**: Live filtering by name, phone, or email.
    - **User Insights**: A sliding drawer (`UserInsightDrawer.tsx`) providing detailed customer history.
    - **KYC Management**: Processing and verifying user identification.

### 2. Live Order Management
- **Path**: `src/app/admin/orders`
- **Features**:
    - **Real-time Queue**: Monitoring of incoming orders via Firestore snapshots.
    - **Order Handover**: Updating delivered jar counts and empty jar returns.
    - **Status Control**: Manually transitioning orders (Processing -> Out for Delivery -> Delivered).

### 3. Analytics & Reporting
- **Path**: `src/app/admin/analytics`
- **Features**:
    - **Sales Trends**: Charts showing daily and monthly revenue.
    - **Product Popularity**: Visual breakdown of most-ordered jar types.
    - **Inventory Forecasting**: Predicting jar requirements based on historical data.

### 4. Fleet & Logistics
- **Path**: `src/app/admin/fleet`
- **Features**:
    - **Live Map**: Real-time tracking of delivery vehicles.
    - **Route Optimization**: Assigning orders to logical delivery clusters.
    - **Driver Performance**: Monitoring trip completion times and success rates.

### 5. Subscription Management
- **Path**: `src/app/admin/subscriptions`
- **Features**:
    - **Recurring Orders**: Handling water delivery schedules (Every 3 days, Weekly).
    - **Pause/Resume**: Enabling customers to temporarily halt deliveries.

### 6. Finance & Wallet
- **Path**: `src/app/admin/wallet`, `src/app/admin/finance`
- **Features**:
    - **Wallet Top-ups**: Manually credited balances for specific customers.
    - **Dues Tracking**: Monitoring unpaid delivery amounts.
    - **Expense Logging**: Documenting operational costs.

---

## Utility Features

- **Notifications**: Sending global SMS or push notifications to customer groups.
- **Coupon Management**: Creating and tracking promotional discount codes.
- **Support System**: Managing customer tickets and account deletion requests.
