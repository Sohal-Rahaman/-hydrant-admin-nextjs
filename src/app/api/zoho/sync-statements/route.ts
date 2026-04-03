import { NextResponse } from 'next/server';
import { getValidZohoToken } from '@/lib/zoho';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Updates a Zoho Sheet by uploading CSV content to a worksheet.
 * Uses method=worksheet.csvdata.set
 */
async function updateZohoSheet(token: string, spreadsheetId: string, csvContent: string) {
  // Use a simple, short worksheet name to avoid special character issues
  const worksheetName = `Sync_${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;
  
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
    console.error("Zoho Non-JSON Response:", responseText);
    throw new Error(`Zoho API Error (Non-JSON): ${responseText.slice(0, 500)}`);
  }

  if (!response.ok || data.status === "failure") {
    console.error("Zoho Sync Failure:", data);
    throw new Error(`Zoho Sync Failed: ${data.message || data.error_message || responseText}`);
  }

  return data;
}

export async function POST(request: Request) {
  try {
    const { csvData } = await request.json();
    if (!csvData) {
      return NextResponse.json({ error: "CSV data is required" }, { status: 400 });
    }

    const token = await getValidZohoToken();
    
    // Get the dynamic Sheet ID from Firestore
    const zohoRef = doc(db, 'settings', 'zoho_integration');
    const zohoSnap = await getDoc(zohoRef);
    const sheetId = zohoSnap.exists() ? zohoSnap.data().sheet_id : process.env.ZOHO_SHEET_ID;

    if (!sheetId) {
      return NextResponse.json({ error: "Zoho Spreadsheet ID is not configured. Go to Settings > Integrations." }, { status: 400 });
    }

    await updateZohoSheet(token, sheetId, csvData);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Zoho Sync Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
