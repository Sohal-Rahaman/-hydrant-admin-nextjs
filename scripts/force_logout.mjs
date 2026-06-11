import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC6IhpLeJMYGVL7BXxQ-h9Pyl4WNoL0RM4",
  authDomain: "hydrant-water-delivery.firebaseapp.com",
  projectId: "hydrant-water-delivery",
  storageBucket: "hydrant-water-delivery.appspot.com",
  messagingSenderId: "257713282772",
  appId: "1:257713282772:web:3f2cad6b7d1a5690786541"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function forceLogoutAll() {
  try {
    console.log('Fetching all active admin sessions...');
    const snapshot = await getDocs(collection(db, 'admin_sessions'));
    let count = 0;
    
    const promises = snapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();
      if (data.status === 'active') {
        await updateDoc(doc(db, 'admin_sessions', docSnap.id), { status: 'revoked' });
        count++;
      }
    });

    await Promise.all(promises);
    console.log(`Successfully revoked ${count} active admin sessions.`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

forceLogoutAll();
