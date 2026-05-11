# 💧 Hydrant: Project Specification (Full)
**Project Title:** Hydrant Admin & Ecosystem  
**Last Updated:** April 2026  
**Developer:** Sohal Rahaman  

---

## 1. Executive Summary (Non-Technical)
Hydrant is a high-performance, technology-driven water delivery service based in Kolkata. The ecosystem consists of a mobile application for customers and a "Command Center" admin dashboard for operations management.

### Business Model
- **Product:** Premium 20L Water Jars.
- **Revenue Engine:** ₹37 per delivered jar.
- **Asset Management:** Tracking a circulating fleet of high-value jars (assets).
- **Financial Model:** Wallet-based payments with automated subscription billing.

### Core Objectives
1. **Operational Efficiency:** Real-time tracking of orders from placement to delivery.
2. **Asset Security:** Monitoring jar circulation to prevent loss and optimize reuse.
3. **Data Intelligence:** Using area-based analytics to identify high-growth zones in Kolkata.
4. **Cash Flow Stability:** Real-time wallet health monitoring and risk assessment.

---

## 2. Technical Architecture

### Frontend Stack (Admin Dashboard)
- **Framework:** Next.js 15.5+ (App Router)
- **Language:** TypeScript (Strict Mode)
- **Styling:** Tailwind CSS v4 (CSS-first config) + Styled Components v6
- **State Management:** React Context API + Firebase Real-time Listeners (`onSnapshot`)
- **Visuals:** Recharts (Analytics), Framer Motion (Animations), React Icons (Lucide/Feather)

### Backend & Infrastructure
- **Cloud Provider:** Firebase (Google Cloud)
- **Database:** Firestore (NoSQL, Real-time)
- **Authentication:** Firebase Auth (Phone OTP whitelisting for Admins, Google Auth)
- **Serverless Logic:** Firebase Cloud Functions (Node.js)
- **Deployment:** Vercel (Frontend), Netlify (Alternative)

### Key Integrations
- **Google Maps API:** Fleet navigation and area heatmaps.
- **WhatsApp API:** Overdue jar notifications and customer support.
- **Fast2SMS/Nodemailer:** OTP delivery and transactional emails.
- **XLSX/jsPDF:** Operational report generation.

---

## 3. Design System: "Industrial Precision"

The UI is designed to feel like a "Bloomberg Terminal for Water Distribution," prioritizing data density and technical accuracy over generic aesthetics.

### Visual Identity
- **Theme:** "Shadow Void" (Global Dark Mode: `#0A0A0A`).
- **Accent Palette:**
  - **Signal Cyan (`#00E5FF`):** Information, navigation, and primary CTAs.
  - **Precision Lime (`#A3E635`):** Success states, completions, and healthy metrics.
  - **At-Risk Amber (`#FBBF24`):** Low wallet balance, pending approvals.
  - **Violation Red (`#F87171`):** Cancelled orders, overdue jars, asset loss.
- **Typography:**
  - **Secondary:** *Fira Sans* (Interface elements).
  - **Technical:** *Fira Code* (Numerical data, IDs, timestamps).
- **Physical Attributes:** Strict `2px` border radius (Hard-edge industrial look).

---

## 4. Operational Modules (Features)

### 📊 Analytics Command Center
- **Revenue Engine:** Real-time calculation of revenue from completed orders.
- **Jar Circulation:** Asset utilization rate (Warehouse vs. Customer vs. Lost).
- **Wallet Health Engine:** Segmentation of the customer base by financial risk.
- **Area Heatmap:** Performance tracking by Kolkata pincodes (e.g., 700030, 700074).

### 🚚 Order & Fleet Management
- **Smart Sorting:** Routing based on pincode and delivery windows.
- **Handover Flow:** QR-code based jar scanning to link assets to customers.
- **Subscription Engine:** Automated daily order generation for long-term users.

### 👥 CRM (Customer Relationship Management)
- **User Intelligence:** 360-degree view of customer order history and hold days.
- **Loss Prevention:** Automated alerts for jars held > 4 days.
- **Wallet Management:** Bulk top-up approvals and adjustment logs.

---

## 5. Security & Data Integrity
- **Firestore Rules:** Multi-tier security allowing only whitelisted admins full access.
- **Admin Whitelisting:** Phone-number-based access control for Superadmins.
- **Audit Trails:** History tracking for every asset (jar) movement.

---

## 6. Development Roadmap (Emerald Edition)
1. **Phase 1 (Legacy):** Basic order listing and user CRUD.
2. **Phase 2 (Migration):** Transition to Next.js 15 and the "Industrial Precision" design.
3. **Phase 3 (Intelligence):** Implementation of the 8-metric Analytics Command Center.
4. **Phase 4 (Scale):** Advanced fleet automation and predictive inventory management.

---

**Built with ❤️ for Kolkata's #1 Water Delivery Intelligence.**
