import { NextResponse } from 'next/server';
import { getValidZohoToken } from '@/lib/zoho';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    const token = await getValidZohoToken();
    
    // Official Zoho Sheet v2 Workbook Creation
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sheetName = `Hydrant_Orders_${timestamp}`;
    
    // Base URL for creation endpoint in India region
    const url = "https://sheet.zoho.in/api/v2/create";
    
    const formData = new URLSearchParams();
    formData.append("method", "workbook.create");
    formData.append("workbook_name", sheetName);
    
    const response = await fetch(url, {
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
    } catch(e) { 
        console.error("Zoho Non-JSON Response:", responseText);
        throw new Error(`Zoho API Error: ${responseText.slice(0, 500)}`);
    }

    if (!response.ok || data.status === "failure") {
       console.error("Zoho Creation Failure Data:", data);
       throw new Error(`Zoho creation failed: ${data.message || data.error_message || responseText}`);
    }

    const spreadsheetId = data.resource_id;

    if (!spreadsheetId) {
        throw new Error("Zoho responded successfully but no resource_id was found.");
    }

    // Save this new ID to Firestore immediately
    await setDoc(doc(db, 'settings', 'zoho_integration'), { 
        sheet_id: spreadsheetId,
        updated_at: new Date()
    }, { merge: true });

    return NextResponse.json({ 
        success: true, 
        spreadsheet_id: spreadsheetId,
        spreadsheet_name: sheetName
    });

  } catch (err: any) {
    console.error("Zoho Create Sheet Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
