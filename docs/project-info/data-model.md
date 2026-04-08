# Firestore Data Model

This document outlines the core Collections and Document schemas used by the Hydrant ecosystem.

## Primary Collections & Schemas

### 1. `users`
Represents customer and admin profiles.
- **Fields**:
    - `uid`: Unique identifier (Auth UID).
    - `displayName`: Full name.
    - `phoneNumber`: Primary contact.
    - `isAdmin`: Boolean flag (Critical for route protection).
    - `walletBalance`: Current prepaid amount.
    - `isKycVerified`: Identity status.

### 2. `orders`
Capture individual delivery transactions.
- **Fields**:
    - `orderId`: Human-readable tracking ID (e.g., ORD-123).
    - `userId`: Reference to the customer.
    - `status`: [Pending, Processing, Out for Delivery, Delivered, Cancelled].
    - `items`: Array of products (Jars, Water types).
    - `deliveredJars`: Actual count handed over.
    - `emptyJarsReturned`: Count of returned jars.
    - `totalAmount`: Final financial value.
    - `createdAt`: ISO 8601 Timestamp.

### 3. `subscriptions`
Managed recurring delivery schedules.
- **Fields**:
    - `userId`: Reference to owner.
    - `frequency`: [Daily, Weekly, BI-Weekly, Custom].
    - `nextDeliveryDate`: Calculated timestamp.
    - `active`: Boolean status.

### 4. `products`
Store information about water jars and services.
- **Fields**:
    - `name`: Product title (e.g., 20L Mineral Water).
    - `price`: Standard cost.
    - `stock`: Available inventory.
    - `category`: [Water, Sanitization, Jar Accessory].

### 5. `holdJars`
Tracks physical jar inventory in the possession of the customer.
- **Fields**:
    - `userId`: Reference to customer.
    - `count`: Total jars currently held (non-returned).
    - `lastUpdate`: Audit timestamp.

### 6. `dashboard_stats`
Aggregated data for global reporting (populated via API/Functions).
- **Fields**:
    - `totalOrders`: Overall count.
    - `totalRevenue`: Sum of all delivered payments.
    - `activeCustomers`: Count of users with recent activity.

---

## Technical Details

- **Indexing**: Composite indexes are defined in `firestore.indexes.json` for complex queries like "Active Subscriptions for User" and "Delivered Orders by Date".
- **Security**: Access is restricted based on `request.auth.uid` and the `isAdmin` flag (Refer to `firestore.rules`).
- **Syncing**: Order updates automatically trigger `holdJars` adjustments to maintain accurate inventory.
