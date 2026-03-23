const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, getDoc, setDoc, query, where, getDocs } = require('firebase/firestore');

// Firebase configuration - Replace with your actual config
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyC6IhpLeJMYGVL7BXxQ-h9Pyl4WNoL0RM4",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "hydrant-water-delivery.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "hydrant-water-delivery",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "hydrant-water-delivery.appspot.com",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "257713282772",
  appId: process.env.FIREBASE_APP_ID || "1:257713282772:web:3f2cad6b7d1a5690786541"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function addNew100Coupon() {
  try {
    console.log('🔍 Checking if NEW100 coupon already exists...');
    
    // Check if the coupon already exists
    const couponsRef = collection(db, 'coupons');
    const q = query(couponsRef, where('code', '==', 'NEW100'));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      console.log('✅ NEW100 coupon already exists in the database:');
      querySnapshot.forEach((doc) => {
        console.log('- ID:', doc.id);
        console.log('- Data:', doc.data());
      });
      return;
    }
    
    console.log('➕ Creating NEW100 coupon...');
    
    // Create the NEW100 coupon
    const newCoupon = {
      code: 'NEW100',
      description: 'Waives the ₹200 joining fee for new users. Discount applies to item value only (₹37 × quantity), excluding delivery charges.',
      type: 'joining_fee_waiver',
      discountType: 'fixed_amount',
      discountValue: 200,
      maxUses: null,
      usedCount: 0,
      isActive: true,
      createdAt: new Date(),
      expiresAt: null
    };
    
    const docRef = await setDoc(doc(db, 'coupons', 'NEW100'), newCoupon);
    
    console.log('🎉 NEW100 coupon created successfully!');
    console.log('📄 Coupon details:');
    console.log('- Code:', newCoupon.code);
    console.log('- Description:', newCoupon.description);
    console.log('- Type:', newCoupon.type);
    console.log('- Discount:', `₹${newCoupon.discountValue}`);
    console.log('- Active:', newCoupon.isActive ? 'Yes' : 'No');
    console.log('- Max Uses:', newCoupon.maxUses || 'Unlimited');
    
  } catch (error) {
    console.error('❌ Error creating NEW100 coupon:', error);
    process.exit(1);
  }
}

// Run the function
addNew100Coupon().then(() => {
  console.log('✅ Script completed successfully');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});