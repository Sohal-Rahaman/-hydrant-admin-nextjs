// Firebase configuration and initialization for Next.js
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, QuerySnapshot, DocumentData, QueryConstraint } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

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

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

// Authentication provider
export const googleProvider = new GoogleAuthProvider();

// Authentication functions
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signInWithEmail = (email: string, password: string) => signInWithEmailAndPassword(auth, email, password);
export const logOut = () => signOut(auth);

// Cloud Functions
export const markOrderAsCompleted = httpsCallable(functions, 'markOrderAsCompleted');
export const triggerSubscriptionOrders = httpsCallable(functions, 'triggerSubscriptionOrders');
export const getDeliveryAnalytics = httpsCallable(functions, 'getDeliveryAnalytics');
export const placeNewOrder = httpsCallable(functions, 'placeNewOrder');

// Firestore helper functions
export const getCollection = (collectionName: string) => collection(db, collectionName);
export const getDocument = (collectionName: string, docId: string) => doc(db, collectionName, docId);
export const addDocument = (collectionName: string, data: DocumentData) => addDoc(collection(db, collectionName), data);
export const updateDocument = (collectionName: string, docId: string, data: Partial<DocumentData>) => updateDoc(doc(db, collectionName, docId), data);
export const deleteDocument = (collectionName: string, docId: string) => deleteDoc(doc(db, collectionName, docId));

// Real-time listeners with error handling
export const subscribeToCollection = (
  collectionName: string, 
  callback: (snapshot: QuerySnapshot<DocumentData>) => void, 
  queryConstraints: QueryConstraint[] = [],
  errorCallback?: (error: Error) => void
) => {
  console.log(`🔗 Setting up subscription for collection: ${collectionName}`);
  const collectionRef = collection(db, collectionName);
  const q = queryConstraints.length > 0 ? query(collectionRef, ...queryConstraints) : collectionRef;
  
  return onSnapshot(q, 
    (snapshot) => {
      console.log(`📊 Subscription update for ${collectionName}:`, {
        size: snapshot.size,
        empty: snapshot.empty,
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
        fromCache: snapshot.metadata.fromCache
      });
      callback(snapshot);
    },
    (error) => {
      console.error(`❌ Subscription error for ${collectionName}:`, error);
      if (errorCallback) {
        errorCallback(error);
      } else {
        console.error('No error callback provided for subscription error');
      }
    }
  );
};

// Specific data fetchers
export const getUserData = async (uid: string) => {
  const userDoc = await getDoc(doc(db, 'users', uid));
  return userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null;
};

export const getAllOrders = () => {
  return getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
};

export const getAllUsers = () => {
  return getDocs(collection(db, 'users'));
};

export const getOrdersByStatus = (status: string) => {
  return getDocs(query(collection(db, 'orders'), where('status', '==', status), orderBy('createdAt', 'desc')));
};

export const getActiveSubscriptions = () => {
  return getDocs(query(collection(db, 'subscriptions'), where('isActive', '==', true)));
};

interface OrderData {
  status: string;
  createdAt: Date | { toDate: () => Date } | string | number;
  userId: string;
  address?: {
    pincode: string;
  };
}

// Analytics helper functions
export const calculateRevenue = (orders: OrderData[]) => {
  const completedOrders = orders.filter(order => order.status === 'completed');
  const cancelledOrders = orders.filter(order => order.status === 'cancelled');
  return (completedOrders.length - cancelledOrders.length) * 37; // ₹37 per jar
};

interface PincodeAnalyticsTemp {
  [pincode: string]: {
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    revenue: number;
    uniqueCustomers: Set<string>;
  };
}

interface PincodeAnalytics {
  [pincode: string]: {
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    revenue: number;
    uniqueCustomers: number;
  };
}

export const getPincodeAnalytics = (orders: OrderData[]): PincodeAnalytics => {
  const analytics: PincodeAnalyticsTemp = {};
  orders.forEach(order => {
    const pincode = order.address?.pincode || 'unknown';
    if (!analytics[pincode]) {
      analytics[pincode] = {
        totalOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        revenue: 0,
        uniqueCustomers: new Set<string>()
      };
    }
    analytics[pincode].totalOrders++;
    
    if (order.status === 'completed') {
      analytics[pincode].completedOrders++;
      analytics[pincode].revenue += 37;
    } else if (order.status === 'cancelled') {
      analytics[pincode].cancelledOrders++;
    }
    
    analytics[pincode].uniqueCustomers.add(order.userId);
  });
  
  // Convert Set to count and return proper analytics
  const finalAnalytics: PincodeAnalytics = {};
  Object.keys(analytics).forEach(pincode => {
    finalAnalytics[pincode] = {
      ...analytics[pincode],
      uniqueCustomers: analytics[pincode].uniqueCustomers.size
    };
  });
  
  return finalAnalytics;
};

interface Coordinates {
  lat: number;
  lng: number;
}

interface BaseCoordinates {
  [pincode: string]: Coordinates;
}

// Smart coordinate generation for map markers
export const generateSmartCoordinates = (pincode: string, orderNumber: number): Coordinates => {
  const baseCoordinates: BaseCoordinates = {
    '700030': { lat: 22.6441, lng: 88.4290 }, // Dum Dum area
    '700074': { lat: 22.5792, lng: 88.4337 }, // Salt Lake area
    'default': { lat: 22.5726, lng: 88.3639 } // Kolkata center
  };
  
  const base = baseCoordinates[pincode] || baseCoordinates.default;
  
  // Add some randomness for realistic spread (±0.01 degrees ≈ ±1km)
  const randomOffset = () => (Math.random() - 0.5) * 0.02;
  
  return {
    lat: base.lat + randomOffset(),
    lng: base.lng + randomOffset()
  };
};

// Generate unique customer ID
export const generateCustomerId = () => {
  const timestamp = Date.now().toString();
  const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `HYD-${timestamp.slice(-6)}-${randomNum}`;
};

// Ensure user has customer ID
export const ensureCustomerId = async (userId: string, userData: DocumentData) => {
  if (!userData.customerId) {
    const customerId = generateCustomerId();
    await updateDocument('users', userId, { customerId });
    return customerId;
  }
  return userData.customerId;
};

export default app;