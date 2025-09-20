import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export async function POST() {
  try {
    const dashboardStatsRef = doc(db, 'dashboard_stats', 'live_metrics');
    
    const initialData = {
      todayRevenue: 0,
      processingOrders: 0,
      newCustomersToday: 0,
      totalOrders: 0,
      totalUsers: 0,
      totalRevenue: 0,
      lastUpdated: new Date()
    };
    
    await setDoc(dashboardStatsRef, initialData);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Dashboard stats initialized successfully' 
      }),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  } catch (error: any) {
    console.error('Error initializing dashboard stats:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  }
}