const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');
require('dotenv').config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seedJars() {
  console.log('🌱 Seeding 500 Jars to Firestore...');
  
  for (let i = 1; i <= 500; i++) {
    const jarId = `HYD-JAR-${i.toString().padStart(4, '0')}`;
    const jarRef = doc(db, 'jars', jarId);
    
    await setDoc(jarRef, {
      id: jarId,
      currentOwnerId: null,
      status: 'available',
      lastScanAt: new Date(),
      history: []
    });
    
    if (i % 50 === 0) {
      console.log(`✅ Seeded ${i}/500: ${jarId}`);
    }
  }
  
  console.log('✨ Firestore seeding complete!');
  process.exit(0);
}

seedJars().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
