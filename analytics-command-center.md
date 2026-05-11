# Hydrant Analytics Command Center
## Task Slug: `analytics-command-center`
## Project Type: WEB (Next.js)
## Agent: `frontend-specialist` + `backend-specialist`

---

## Overview

Replace the existing basic analytics page with a **premium, real-time Analytics Command Center** at `/admin/analytics` — think Bloomberg Terminal meets modern SaaS. Every metric Hydrant needs to run a 100% tracked water delivery business in Kolkata. All data lives in Firebase, streamed live via `subscribeToCollection`.

**Business Logic First:**
- ₹37 per delivered jar = revenue engine
- Jar circulation rate = asset utilization = capital efficiency
- Wallet health = cash flow stability  
- Overdue jars = loss prevention
- Area heatmap = expansion intelligence

---

## Success Criteria

- [ ] All 8 business metrics calculated correctly from live Firebase data
- [ ] Date range filter (7d / 30d / 90d / All) works on all charts
- [ ] Zero hardcoded data — all charts render from Firestore
- [ ] Mobile responsive (works on tablet for ops managers)
- [ ] Page loads < 2s with 1000+ orders in DB
- [ ] Share link works (public read-only URL for owner/investor)
- [ ] TypeScript: zero `tsc` errors
- [ ] Build passes: `npm run build` clean

---

## Tech Stack

| Technology | Choice | Rationale |
|---|---|---|
| Charts | Recharts v3 (already installed) | Already in project, no extra install |
| Realtime | Firebase `subscribeToCollection` | Live data, existing pattern |
| State | React useState + useRef | Avoid re-render thrash on live data |
| Styling | styled-components (existing pattern) | Matches entire codebase |
| Icons | react-icons/fi | Already installed |
| Animation | framer-motion | Already installed |

---

## File Structure

```
src/app/admin/analytics/
└── page.tsx          ← REPLACE entirely (1500 lines → 800 clean lines)

No new files needed — all logic lives in the page.
```

---

## 8 Metric Modules (Business Logic)

### M1 — Daily/Monthly Revenue
```
Revenue = completed_orders.sum(quantity) × ₹37
Chart: AreaChart, date on X, ₹ on Y
Period: selectable 7d / 30d / 90d
KPIs: Today total, This Month total, MoM growth %
```

### M2 — Jar Circulation Rate
```
Circulation Rate = (jars_returned_this_period / jars_delivered_this_period) × 100
Chart: Radial gauge + donut
3 states: Available (warehouse) / Locked (customer) / Lost
Business insight: < 80% = problem
```

### M3 — Orders by Area/Zone (Kolkata)
```
Source: order.address.pincode or deliveryAddress
Group by: pincode prefix (700001, 700002 etc.)
Chart: Horizontal BarChart, top 10 areas
Business insight: Where to expand next delivery routes
```

### M4 — Customer Growth
```
New customers: users.createdAt within period
Returning: users who placed >1 order
Chart: LineChart with 2 series (new vs returning)
KPI: Total users, active this month
```

### M5 — Wallet Balance Health
```
Segments:
  🔴 Negative: wallet_balance < 0
  🟡 Low: 0 ≤ balance < 50  
  🟢 Healthy: 50 ≤ balance < 500
  💎 High: balance ≥ 500
Chart: PieChart (4 segments)
KPI: Total wallet corpus, avg balance, at-risk count
```

### M6 — Delivery Success Rate
```
Success Rate = completed / (completed + cancelled) × 100
Chart: Progress ring + trend line (7 days)
KPI: Today's rate, 30-day avg
```

### M7 — Jar Return Time (Asset Recovery)
```
Avg Hold Days = mean(jars.lastScanAt age) where status='locked'
Buckets: 0-1d / 2-3d / 4-5d / 6-7d / 7d+
Chart: BarChart histogram
Business insight: Rising avg = asset pile-up risk
```

### M8 — Overdue Jars Trend
```
Overdue = locked jars held > 4 days
Chart: LineChart (daily snapshot — use lastScanAt)
KPI: Count today, 7-day peak, at-risk capital (count × ₹800/jar deposit)
Table: Top 10 overdue with customer phone + WhatsApp quick action
```

---

## UI Architecture

```
┌─────────────────────────────────────────────────────────┐
│  🔷 HYDRANT COMMAND CENTER          [7d][30d][90d][All] │
│  Kolkata's #1 Water Delivery Intelligence               │
│  🟢 LIVE                         [Export CSV] [Share]  │
├──────┬──────┬──────┬──────┬──────┬──────┬──────┬───────┤
│ REV  │ JARS │ CUST │ DEL% │ OVRD │ WALL │ AREA │ RTME  │
│ TODAY│ OUT  │TODAY │RATE  │JARS  │RISK  │TOP   │AVG    │
├──────┴──────┴──────┴──────┴──────┴──────┴──────┴───────┤
│  📈 Revenue Trend (Area Chart — full width)             │
├───────────────────────┬─────────────────────────────────┤
│  🫙 Jar Circulation   │  📍 Orders by Area (Bar)        │
│  (Donut + 3 stats)    │                                 │
├───────────────────────┼─────────────────────────────────┤
│  💰 Wallet Health     │  👥 Customer Growth (Line)      │
│  (Pie 4 segments)     │                                 │
├───────────────────────┼─────────────────────────────────┤
│  🚚 Delivery Rate     │  ⏱️ Return Time Histogram       │
│  (Ring + trend)       │                                 │
├───────────────────────┴─────────────────────────────────┤
│  🔴 Overdue Jars Table (sortable, with call buttons)    │
└─────────────────────────────────────────────────────────┘
```

---

## Task Breakdown

### T1 — Data Layer & Hooks (P0 - Foundation)
**Agent:** `backend-specialist` | **Skill:** `api-patterns`

```
INPUT:  Firebase collections: orders, users, jars
OUTPUT: Processed metric objects for all 8 modules
VERIFY: All metrics return correct values for mock dataset
```

Steps:
1. Create `useAnalyticsData(range: '7d'|'30d'|'90d'|'all')` custom hook in the page
2. Subscribe to `orders`, `users`, `jars` via `subscribeToCollection`
3. Compute all derived metrics when any source changes
4. Memoize heavy computations with `useMemo`

Key computations:
```typescript
// Revenue
const revenue = completedOrders
  .filter(o => inRange(o.createdAt, range))
  .reduce((sum, o) => sum + (o.quantity || 1) * 37, 0);

// Jar circulation
const circulationRate = (returnedInPeriod / deliveredInPeriod) * 100;

// Customer segments (new vs returning)
const newCustomers = users.filter(u => inRange(u.createdAt, range));

// Wallet health buckets
const walletBuckets = { negative: 0, low: 0, healthy: 0, high: 0 };
users.forEach(u => {
  const b = u.wallet_balance ?? 0;
  if (b < 0) walletBuckets.negative++;
  else if (b < 50) walletBuckets.low++;
  else if (b < 500) walletBuckets.healthy++;
  else walletBuckets.high++;
});

// Avg jar hold days
const avgHoldDays = lockedJars.reduce((sum, j) => 
  sum + getDays(j), 0) / lockedJars.length;
```

---

### T2 — KPI Hero Cards (P1)
**Agent:** `frontend-specialist` | **Skill:** `frontend-design`

```
INPUT:  Computed stats object
OUTPUT: 8 animated KPI cards with trend indicators
VERIFY: Cards show correct values, trend arrow direction correct
```

- Dark theme (#0a0a0a background, zinc-900 cards)
- Each card: Icon + big number + label + trend delta (▲ vs last period)
- Micro-animation: count-up on load (no library needed — requestAnimationFrame)
- Mobile: 2-column grid → desktop: 4-column → wide: 8 in a row

---

### T3 — Revenue Area Chart (P1)
**Agent:** `frontend-specialist`

```
INPUT:  dailyRevenue[] array
OUTPUT: Interactive AreaChart with gradient fill
VERIFY: Data points match manual calculation
```

- Gradient: teal (#10b981) → dark
- Tooltip: shows "₹3,774 · 102 jars · Apr 11"
- Period toggle (7d/30d/90d) re-filters data reactively
- Second line: order count (right Y-axis)

---

### T4 — Jar Circulation Module (P1)
**Agent:** `frontend-specialist`

```
INPUT:  jars[] from Firestore
OUTPUT: Donut chart + 3 stat pills
VERIFY: Total donut = total jars in DB
```

- Donut: green=available, blue=locked, red=lost
- Center text: "Circulation Rate: 87%"
- Below: 3 stat pills: Available / With Customers / Overdue

---

### T5 — Orders by Area BarChart (P1)
**Agent:** `frontend-specialist`

```
INPUT:  orders[], grouped by pincode
OUTPUT: Horizontal BarChart top 10 pincodes
VERIFY: Sum of all areas = total orders
```

- Horizontal bars (easier to read area names)
- Color: gradient by rank (darkest = top)
- Pincode → area name mapping (static Kolkata lookup table)

---

### T6 — Customer Growth LineChart (P1)
**Agent:** `frontend-specialist`

```
INPUT:  users[] with createdAt
OUTPUT: 2-series line chart (new vs returning)
VERIFY: New + returning ≈ active user count
```

- New = users who joined in period
- Returning = users with >1 order in period
- Tooltip: "Apr 11 · 3 new · 28 returning"

---

### T7 — Wallet Health PieChart (P1)
**Agent:** `frontend-specialist`

Risk segments:
- 🔴 Negative (<₹0): red
- 🟡 Low (₹0–₹50): amber
- 🟢 Healthy (₹50–₹500): green
- 💎 High (>₹500): blue

KPI below pie: "At-risk capital: ₹X (Y customers)"

---

### T8 — Delivery Success Rate Ring + Overdue Table (P1)
**Agent:** `frontend-specialist`

Delivery ring: SVG circle progress (no extra lib)
```
const circumference = 2 * Math.PI * 54; // r=54
const offset = circumference * (1 - successRate / 100);
```

Overdue table:
- Columns: Jar ID | Customer | Days | Risk | Call | WhatsApp
- Sorted by days desc
- "At-risk deposit: ₹X" (count × ₹800 estimated jar deposit)

---

### T9 — Date Range Picker + Share (P2)
**Agent:** `frontend-specialist`

Range filter: [7d] [30d] [90d] [All] pill buttons
Share: Copy URL button → adds `?range=30d` param (no auth needed for read-only share)
Export: CSV download (existing function — reuse)

---

## Phase X: Verification

```bash
# TypeScript
npx tsc --noEmit

# Lint
npm run lint

# Build
npm run build

# Runtime check
# Open http://localhost:3000/admin/analytics
# Verify: all 8 charts render with real data
# Verify: range toggle changes chart data
# Verify: mobile view (400px width) — all charts visible
```

Rule compliance:
- [ ] No purple/violet hex codes used
- [ ] No placeholder data — all from Firebase
- [ ] Mobile touch targets ≥ 44px
- [ ] No console.log left in production code

---

## Implementation Order

```
T1 (Data) → T2 (KPI Cards) → T3 (Revenue) → T4 (Jars) → T5 (Area)
→ T6 (Customers) → T7 (Wallet) → T8 (Delivery/Overdue) → T9 (Filters)
→ Phase X
```

Estimated: 1 session (~3-4 hours of focused build time)
