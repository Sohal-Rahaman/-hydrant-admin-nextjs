// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

console.log('Environment variables check:');
console.log('- NEXT_PUBLIC_FIREBASE_API_KEY:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'SET' : 'MISSING');
console.log('- NEXT_PUBLIC_FIREBASE_PROJECT_ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'MISSING');

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

console.log('Firebase config:', {
  apiKey: firebaseConfig.apiKey ? 'SET' : 'MISSING',
  projectId: firebaseConfig.projectId || 'MISSING'
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Check if dashboard stats document exists
async function checkDashboardStats() {
  try {
    const dashboardStatsRef = doc(db, 'dashboard_stats', 'live_metrics');
    const docSnap = await getDoc(dashboardStatsRef);
    
    if (docSnap.exists()) {
      console.log('✅ Dashboard stats document exists!');
      console.log('Data:', docSnap.data());
    } else {
      console.log('❌ Dashboard stats document does not exist.');
      console.log('You need to initialize it.');
    }
  } catch (error) {
    console.error('❌ Error checking dashboard stats:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
  }
}

// Run the check
checkDashboardStats().then(() => {
  console.log('Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});