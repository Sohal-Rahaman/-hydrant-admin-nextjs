# B2B Corporate Store Jar Tracking & Consolidated Ledger Master Plan

This plan details the implementation of a high-fidelity, dual-scan (Delivered & Returned) jar tracking interface for B2B stores, a master ledger records table showing transaction logs for all stores, and an Excel sheet export utility featuring automated end-of-month calculations. 

## Project Type
- **WEB**: Next.js (App Router), TypeScript, Styled-Components, Firebase/Firestore.

---

## 🛑 User Review Required

> [!IMPORTANT]
> **No Purple accents rule compliance:** All new UI controls, scanning steps, table borders, and export buttons will adhere strictly to a sleek, premium dark/slate gray and corporate emerald green/blue color scheme, avoiding purple/violet accents completely.
> 
> **Excel Generation library:** We will leverage the pre-installed `xlsx` package to generate rich client-side multi-sheet workbooks containing raw logs on Sheet 1 and an aggregated monthly store performance summary on Sheet 2.
>
> **Firestore schema alignment:** Serialized logging (`deliveredJarIds` and `returnedJarIds`) will be stored directly inside the `metadata` property of B2BLedgerEntry objects.

---

## Open Questions

> [!NOTE]
> **Q1: Scan Verification Severity**
> Should scanning returned jars for B2B corporate stores strictly verify that the jar is registered to that specific store (like the retail flow), or should we allow bulk empty returns from any warehouse/source to be flexible since corporate logistics involve high volumes?
> *Recommendation: Flexible returns with warnings, permitting empty jars from other branches to be processed.*
>
> **Q2: Excel Sheet Layout**
> For the Excel export sheet, do you want only the filtered transactions currently visible on the table, or should it automatically download the entire month's transaction records from the DB?
> *Recommendation: Provide two export options or default to exporting the full records with active filters applied.*

---

## Tech Stack & Dependencies
- **Core:** Next.js (React 19, TypeScript)
- **Database:** Firebase Firestore (`b2b_clients`, `b2b_ledgers`)
- **Libraries:**
  - `html5-qrcode` (for fast, web-based camera barcode/QR scanning)
  - `xlsx` (pre-installed, for client-side Excel creation)
  - `styled-components` (for UI styling)
  - `date-fns` (for accurate date range parsing and manipulation)

---

## File Structure

```
sssss/hydrant-admin-nextjs/
├── docs/
│   └── PLAN-b2b-jar-tracking.md          <-- [THIS PLAN]
├── src/
│   ├── types/
│   │   └── b2b.ts                         <-- [MODIFY] Schema support for logged IDs
│   ├── lib/
│   │   └── b2bService.ts                  <-- [MODIFY] Add global query service
│   ├── app/
│   │   ├── admin/
│   │   │   ├── create-order/
│   │   │   │   └── page.tsx               <-- [MODIFY] Fix pre-existing typescript error
│   │   │   ├── b2b/
│   │   │   │   ├── page.tsx               <-- [MODIFY] Add Master Ledger Tab, Excel Export, Premium Scanner Modal
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx           <-- [MODIFY] Fix StatusBadge compilation issue, add multi-step scan
```

---

## Task Breakdown

### Phase 1: Fix Pre-existing Compilation Issues
- **Task 1.1: Fix `/admin/b2b/[id]/page.tsx` missing StatusBadge**
  - **Agent:** `frontend-specialist`
  - **Skill:** `clean-code`
  - **Description:** Locate line 752 in `/src/app/admin/b2b/[id]/page.tsx` and define `StatusBadge` as a styled component, or map it to the already defined `Badge` styled component to prevent compilation failure.
  - **INPUT:** Uncompiled `/src/app/admin/b2b/[id]/page.tsx`
  - **OUTPUT:** Compiled `/src/app/admin/b2b/[id]/page.tsx` without type errors.
  - **VERIFY:** Build check `npx tsc --noEmit`.

- **Task 1.2: Fix `/admin/create-order/page.tsx` missing `recordedBy`**
  - **Agent:** `backend-specialist`
  - **Skill:** `api-patterns`
  - **Description:** Go to line 439 in `/src/app/admin/create-order/page.tsx` and ensure `recordedBy: userData?.id || 'admin'` is passed to the `recordLedgerEntry` call, complying with the `B2BLedgerEntry` interface.
  - **INPUT:** Typings mismatch in `recordLedgerEntry()` parameters.
  - **OUTPUT:** Clean typed call in `create-order/page.tsx`.
  - **VERIFY:** Build check `npx tsc --noEmit`.

---

### Phase 2: Database Schema & Service Extensions
- **Task 2.1: Extend service layer for consolidated ledger queries**
  - **Agent:** `backend-specialist`
  - **Skill:** `api-patterns`
  - **Description:** Modify `/src/lib/b2bService.ts` to add `getAllLedgerEntries(limitCount)` querying the `b2b_ledgers` collection across all clients ordered by `timestamp` desc.
  - **INPUT:** No cross-client ledger querying function.
  - **OUTPUT:** Added `getAllLedgerEntries` export in `/src/lib/b2bService.ts`.
  - **VERIFY:** Verify query successfully executes and retrieves data.

---

### Phase 3: Premium Multi-Step Scanner Modal
- **Task 3.1: Implement Sleek Camera Scanner & Auto-complete in Main B2B Console**
  - **Agent:** `frontend-specialist`
  - **Skill:** `frontend-design`
  - **Description:** Port the high-quality `Html5Qrcode` scanner flow from `DeliveryHandoverModal.tsx` directly into the B2B dashboard handover workflow (`/admin/b2b/page.tsx` and `/admin/b2b/[id]/page.tsx`).
    - Multi-step progress tracker dots (Scan Deliveries -> Scan Returns -> Finalize summary).
    - Torch (flash) activation control toggles using raw stream constraints.
    - Sound beep responses for successful scans, duplicates, and ownership verification checkups.
    - Manual input autocomplete (type digits to pad to 4 digits and append `HYD-JAR-` automatically).
    - Clear visual tags representing scanned jars with a trash bin button to remove scanned items.
  - **INPUT:** Basic HTML5QrcodeScanner in B2B Dashboard.
  - **OUTPUT:** Polished, premium responsive scanner interface.
  - **VERIFY:** Run manual tests and verify scan success, duplicate handling, and sound playback.

---

### Phase 4: Consolidated Records Table & Filters
- **Task 4.1: Build Master Ledger UI Tab**
  - **Agent:** `frontend-specialist`
  - **Skill:** `frontend-design`
  - **Description:** Introduce a beautiful tab toggle at the top of `/src/app/admin/b2b/page.tsx`: "Client Accounts" vs "Master Ledger Ledger".
  - **Table Layout:** Render a clean data table containing:
    - Serial No (index + 1)
    - Date & Time (formatted nicely)
    - Store / Corporate Name
    - Type of Transaction (Handover, Invoice, etc.)
    - Quantity Delivered / Jars Returned
    - Price Per Jar (calculated or fetched)
    - Total Transaction Value
    - Note description
  - **Filters:** Add premium, responsive date-range selection datepickers (Start Date, End Date) and a client dropdown selector.
  - **INPUT:** Company cards listing only.
  - **OUTPUT:** Tabbed console with Master Ledger Table.
  - **VERIFY:** Confirm table renders entries correctly across all stores with filters.

---

### Phase 5: High-Fidelity Excel Export
- **Task 5.1: Integrate Client-side Excel Workbook Generator**
  - **Agent:** `frontend-specialist`
  - **Skill:** `clean-code`
  - **Description:** Implement the Excel log exporter using the `xlsx` library. Triggering the export compiles:
    - **Sheet 1 (Detailed Ledger):** List of all filtered transactions showing Sl No, Store Name, Timestamp, Delivered, Returned, Price/Jar, Total Amount, Recorded By, Notes.
    - **Sheet 2 (Monthly Aggregations):** Store-by-store calculations containing: Store Name, Jars Out, Jars In, Net Holding Change, Total Billed, Outstanding Balance.
  - **INPUT:** Table state in React.
  - **OUTPUT:** Sleek spreadsheet download button generating a professionally-styled Excel workbook.
  - **VERIFY:** Click export and confirm generated `.xlsx` spreadsheet opens perfectly in MS Excel/Google Sheets with correct math.

---

## Phase X: Verification Checklist

### Automated Audits
- Run types verification:
  ```bash
  npx tsc --noEmit
  ```
- Run linter audits:
  ```bash
  npm run lint
  ```
- Build compilation check:
  ```bash
  npm run build
  ```

### Manual Verification
- Start local server (`npm run dev`) and navigate to the B2B Enterprise Console.
- Open scanner modal and verify camera opens, scans jars, plays a high beep, blocks duplicates, and manual input adds pads.
- Submit a corporate handover, verify atomic update of store inventory and credit dues in Firestore.
- Access the Master Ledger tab, verify chronological records across all stores display correctly.
- Apply a date filter and confirm records update reactively.
- Click "Export B2B Logs" and open the downloaded Excel file to verify Sheets 1 and 2 calculate correctly.

---

## ✅ PHASE X COMPLETE
- Lint: [ ]
- Security: [ ]
- Build: [ ]
- Date: [Pending Approval]
