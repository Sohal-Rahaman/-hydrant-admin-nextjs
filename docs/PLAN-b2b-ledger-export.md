# Plan: B2B Ledger & Orders Enhancements with Excel Export

## Overview
This plan outlines the enhancements to the B2B Store Detail Profile page (`src/app/admin/b2b/[id]/page.tsx`) to show:
1. A complete, granular transaction ledger table with Serial No, Date, Time, Quantity, Price, and Total Value.
2. A completely restructured Orders tab table displaying the Order Date, Time, Jar Delivery count, Jar Return count, and the delivery agent name ("Delivered By" e.g., Rose, Moti, Sohal).
3. Client-side Excel exporters for BOTH tabs (Ledger Audit Log and Orders Delivery Log) using the `xlsx` library with automated end-of-month summary totals.

## Project Type
**WEB** (Next.js client-side dashboard panel).

## Success Criteria
1. **Expanded B2B Orders Tab Table**: Redesign the "Orders" tab table to display:
   - Order ID
   - Date
   - Time
   - Jar Delivery (quantity of full jars delivered)
   - Jar Return (quantity of empty jars collected)
   - Total Amount (₹)
   - Status
   - Delivered By (assigned partner: e.g. Rose, Moti, Sohal)
2. **Detailed B2B Ledger Table**: Redesign the "Ledger" tab table to render distinct columns for:
   - Serial No (`Sl No`)
   - Date
   - Time
   - Transaction Type
   - Reference ID
   - Quantity Delivered (Jars)
   - Quantity Returned (Jars)
   - Price Per Jar (₹)
   - Total Value (₹)
   - Notes / Description
3. **HUD Stats Card Aggregates**: Display cumulative aggregates for Total Jars Delivered, Total Jars Returned, Net Holding Delta, and Total Financial Value for the selected store.
4. **Excel Export Capabilities**:
   - **Export Store Orders**: Emerald-green button in the Orders tab that downloads `B2B_Store_Orders_{StoreName}_{Date}.xlsx` showing all order details and totals.
   - **Export Store Ledger**: Emerald-green button in the Ledger tab that downloads `B2B_Store_Ledger_{StoreName}_{Date}.xlsx` with audit trails and aggregates.
5. **Compile & Build Safety**: Zero compile warnings or TypeScript issues (`npx tsc --noEmit` and `npm run build` pass successfully).

## Tech Stack
- Next.js / React Web
- Styled Components
- Lucide React / React Icons (`FiDownload`, `FiFileText`, `FiTruck`)
- `xlsx` library (Excel sheet generator)
- `date-fns` (DateTime parsing & formatting)

---

## File Structure
- `src/app/admin/b2b/[id]/page.tsx` (Modify)
- `docs/PLAN-b2b-ledger-export.md` (This document)

---

## Task Breakdown

### Task 1: Orders Tab Table Redesign & Data Mapping
- **Agent**: `frontend-specialist`
- **Skill**: `frontend-design`
- **Priority**: P1 (Core UI)
- **Description**: Rebuild the orders rendering table under `activeTab === 'orders'` to display the 8 specified columns. Safely parse and map order timestamps and quantities.
- **Data Mapping Rules**:
  - **Date**: `format(order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt), 'dd MMM yyyy')`
  - **Time**: `format(order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt), 'hh:mm a')`
  - **Jar Delivery**: `order.handover?.deliveredJars ?? order.deliveredJars ?? order.quantity ?? 0`
  - **Jar Return**: `order.handover?.collectedJars ?? order.collectedJars ?? order.returnedJars ?? 0`
  - **Delivered By**: `order.deliveryPartner?.name || order.assignedPartner || 'Unassigned'` (displays Rose, Moti, Sohal, etc.)
- **INPUT**: Loaded `orders` state array.
- **OUTPUT**: Modern, high-density order tracking table inside the tab.
- **VERIFY**: Switch to the Orders tab, confirm all new columns render, and verify delivery partner names appear.

### Task 2: Detailed Ledger Tab Table Redesign
- **Agent**: `frontend-specialist`
- **Skill**: `frontend-design`
- **Priority**: P1 (Core UI)
- **Description**: Expand the Ledger tab `<Table>` component to display 10 distinct columns representing serial numbers, dates, times, types, references, delivered/returned jars, pricing, amounts, and notes.
- **INPUT**: Existing `ledger` state mapping.
- **OUTPUT**: Refined detailed ledger list layout.
- **VERIFY**: Select the Ledger tab and verify the layout, cell alignments, and responsive columns.

### Task 3: Real-Time Cumulative HUD Metrics Cards
- **Agent**: `frontend-specialist`
- **Skill**: `frontend-design`
- **Priority**: P1 (Analytics)
- **Description**: Add real-time calculations from the loaded `ledger` state to compute total jars delivered, returned, net delta, and financial totals, and display them in a visually premium HUD block inside the tab.
- **INPUT**: Filtered or loaded `ledger` state.
- **OUTPUT**: Four HUD stats cards rendered above the table (Total Jars Delivered, Total Jars Returned, Net Jars Held, Total Financial Value).
- **VERIFY**: Manually cross-check the calculations against the individual ledger items.

### Task 4: Store Orders & Store Ledger Excel Exporters
- **Agent**: `frontend-specialist`
- **Skill**: `nextjs-react-expert`
- **Priority**: P1 (Export Actions)
- **Description**: Write client-side Excel download handlers using `xlsx` to output sheets for store orders and store ledger transactions. Place custom emerald-green export buttons next to the headers.
- **Sheet 1: Store Orders Layout**:
  - S.No, Order ID, Date, Time, Jar Delivery, Jar Return, Total Amount, Status, and Delivered By.
  - Final footer row with SUM totals of Jar Delivery, Jar Return, and Total Amount.
- **Sheet 2: Store Ledger Layout**:
  - S.No, Date, Time, Type, Reference ID, Qty Delivered, Qty Returned, Price per Jar, Total Value, and Description.
  - Final footer row with SUM totals of Qty Delivered, Qty Returned, and Total Value.
- **INPUT**: Selected client master data, `orders` state, `ledger` state, and `xlsx` helper.
- **OUTPUT**: Two beautiful export buttons that download target Excel sheets.
- **VERIFY**: Download both files, open them, and verify that columns, formats, and SUM formulas are 100% correct.

---

## Phase X: Verification Plan

### Automated Checks
- Run TypeScript compile checks:
  ```bash
  npx tsc --noEmit
  ```
- Run production build:
  ```bash
  npm run build
  ```

### Manual Checks
- [ ] No purple hex codes inside the new designs.
- [ ] Socratic Gate questions were fully aligned with the user.
- [ ] The generated Excel sheet file contains all correct calculations.
