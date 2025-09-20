const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

// Load environment variables
require('dotenv').config();

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Initialize dashboard stats document
async function initDashboardStats() {
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
    console.log('✅ Dashboard stats document initialized successfully!');
    console.log('Document path: dashboard_stats/live_metrics');
    console.log('Initial data:', initialData);
  } catch (error) {
    console.error('❌ Error initializing dashboard stats:', error);
  }
}

// Run the initialization
initDashboardStats().then(() => {
  console.log('Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});