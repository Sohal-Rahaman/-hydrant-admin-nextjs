import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { getValidZohoToken } from '@/lib/zoho';

/**
 * Updates a Zoho Sheet by uploading CSV content to a worksheet.
 * Uses method=worksheet.csvdata.set
 */
async function updateZohoSheet(token: string, spreadsheetId: string, worksheetName: string, rows: any[][]) {
  if (!spreadsheetId) return;

  const csvContent = rows.map(row => 
    row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  // Method should be in the URL for better compatibility with Zoho Sheet v2 gateway
  const url = new URL(`https://sheet.zoho.in/api/v2/${spreadsheetId}`);
  url.searchParams.append("method", "worksheet.csvdata.set");

  const formData = new URLSearchParams();
  formData.append("worksheet_name", worksheetName);
  formData.append("csv_data", csvContent);
  formData.append("is_row_header", "true");

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Authorization": `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formData.toString()
  });

  const responseText = await response.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    console.error(`Zoho Cron Sync Non-JSON Response for ${worksheetName}:`, responseText);
    throw new Error(`Zoho API Error (Non-JSON) on ${worksheetName}: ${responseText.slice(0, 500)}`);
  }

  if (!response.ok || data.status === "failure") {
    console.error(`Zoho Cron Sync Failure for ${worksheetName}:`, data);
    throw new Error(`Zoho Sync Failed on ${worksheetName}: ${data.message || data.error_message || responseText}`);
  }

  return data;
}

export async function GET(request: Request) {
  // CRON Secure Guard
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized CRON execution' }, { status: 401 });
  }

  try {
    const accessToken = await getValidZohoToken();

    // Fetch the Spreadsheet ID from Firestore settings with fallback to ENV
    const zohoSettingsSnap = await getDoc(doc(db, 'settings', 'zoho_integration'));
    let spreadsheetId = zohoSettingsSnap.exists() ? zohoSettingsSnap.data().sheet_id : null;

    if (!spreadsheetId) {
      spreadsheetId = process.env.ZOHO_SHEET_ID;
    }

    if (!spreadsheetId) {
      return NextResponse.json({ 
        error: 'Zoho Spreadsheet ID not configured. Please enter it in Settings > Integrations.' 
      }, { status: 400 });
    }

    // 1. Fetch Firebase Data
    const usersSnap = await getDocs(collection(db, 'users'));
    const ordersSnap = await getDocs(collection(db, 'orders'));

    // --- Data Processing: Customers Master ---
    const customerRows = [
      ["Customer ID", "Name", "Email", "Phone", "Address", "Total Orders", "Completed Orders", "Cancelled Orders", "Wallet Balance", "Total Revenue", "Jars Held", "Joining Date", "Last Order Date", "Plan Status"]
    ];

    usersSnap.forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt;
      const lastOrder = data.lastOrderDate?.toDate ? data.lastOrderDate.toDate().toISOString() : data.lastOrderDate;
      const planStatus = data.plan?.status || 'inactive';
      const balance = data.walletBalance || 0;
      const jarsHold = data.inventory?.totalHold || 0;

      customerRows.push([
        doc.id,
        data.name || data.displayName || 'Unknown',
        data.email || 'N/A',
        data.phone || 'N/A',
        data.address || 'N/A',
        data.meta?.totalOrders || 0,
        data.meta?.totalDelivered || 0,
        data.meta?.totalCancelled || 0,
        balance,
        data.meta?.totalSpent || 0,
        jarsHold,
        createdAt || 'Unknown',
        lastOrder || 'Unknown',
        planStatus
      ]);
    });

    // --- Data Processing: Dispatch & Ledger ---
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const dispatchRows = [
      ["Order ID", "Date", "Customer ID", "Phone", "Address", "Location URL", "Quantity", "Price", "Payment Status", "Delivery Status"]
    ];
    
    // Quick loop to calculate ledger and build dispatch
    const userLedgerValues: Record<string, { recharges: number, spent: number }> = {};

    ordersSnap.forEach((doc) => {
      const data = doc.data();
      const orderDateIso = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString();
      const isToday = orderDateIso.startsWith(today);
      
      // Accumulate ledger data per user
      const uId = data.userId || 'Unknown';
      if (!userLedgerValues[uId]) userLedgerValues[uId] = { recharges: 0, spent: 0 };
      
      if (data.status === 'delivered') {
          userLedgerValues[uId].spent += Number(data.totalAmount || 0);
      }

      // If it's an order placed today or meant for today's dispatch!
      if (isToday || data.status === 'processing' || data.status === 'out_for_delivery') {
        const addrMapUrl = data.location?.lat ? `https://maps.google.com/?q=${data.location.lat},${data.location.lng}` : 'No GPS';
        
        dispatchRows.push([
          doc.id,
          orderDateIso,
          uId,
          data.customerPhone || 'N/A',
          data.customerAddress || 'N/A',
          addrMapUrl,
          data.meta?.totalJars || data.items?.length || 1,
          data.totalAmount || 0,
          data.paymentStatus || 'Paid via Wallet',
          data.status || 'Pending'
        ]);
      }
    });

    // --- Data Processing: Global Wallet Ledger ---
    const ledgerRows = [
      ["Customer ID", "Current Wallet Balance", "Lifetime Spent"]
    ];
    usersSnap.forEach((doc) => {
        const uId = doc.id;
        const bal = doc.data().walletBalance || 0;
        const spent = userLedgerValues[uId]?.spent || 0;
        ledgerRows.push([uId, bal, spent]);
    });

    // --- Data Processing: Full Statements (Last 30 Days) ---
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const stmtRows: any[][] = [];
    const sortedOrders = [...ordersSnap.docs].sort((a,b) => getTs(b.data().createdAt) - getTs(a.data().createdAt));
    
    sortedOrders.forEach((doc, i) => {
      const data = doc.data();
      const t = getTs(data.createdAt);
      if (t < thirtyDaysAgo.getTime()) return;

      const uId = data.userId;
      const uDoc = usersSnap.docs.find(d => d.id === uId);
      const u = uDoc?.data();
      const dt = new Date(t);
      const delivered = data.handover?.deliveredJars ?? data.quantity ?? 0;
      const returned = data.handover?.collectedJars ?? 0;

      stmtRows.push([
        i + 1,
        dt.toLocaleDateString('en-IN'),
        dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        doc.id,
        u?.name || data.userName || '',
        u?.customerId || '',
        u?.phoneNumber || data.userPhone || '',
        data.quantity,
        delivered,
        returned,
        u?.jars_occupied ?? 0,
        u?.wallet_balance ?? 0,
        data.paymentMethod || '',
        delivered * 37,
        data.status
      ]);
    });

    const stmtHeaders = ['Sl. No.', 'Date', 'Time', 'Order ID', 'Customer', 'HYDRA-ID', 'Phone', 'Qty', 'Delivered', 'Returned', 'Hold Jars', 'Wallet ₹', 'Payment', 'Amount ₹', 'Status'];

    // 3. Push to Zoho Sheet synchronously
    const dateStr = new Date().toISOString().slice(0, 10);
    const stmtTabName = `Orders_${dateStr.replace(/-/g, '')}`;

    await updateZohoSheet(accessToken, spreadsheetId, 'Customers', customerRows);
    await updateZohoSheet(accessToken, spreadsheetId, 'Dispatch', dispatchRows);
    await updateZohoSheet(accessToken, spreadsheetId, 'Ledger', ledgerRows);
    await updateZohoSheet(accessToken, spreadsheetId, stmtTabName, [stmtHeaders, ...stmtRows]);

    return NextResponse.json({ 
      success: true, 
      message: 'All Zoho Sheets synced successfully',
      stats: {
          customersSynced: customerRows.length - 1,
          dispatchRows: dispatchRows.length - 1,
          ledgerRows: ledgerRows.length - 1,
          statementsSynced: stmtRows.length
      }
    });

    function getTs(val: any) {
      if (!val) return 0;
      if (val.toDate) return val.toDate().getTime();
      return new Date(val).getTime();
    }

  } catch (err: any) {
    console.error("Zoho Sheet CRON Sync Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
