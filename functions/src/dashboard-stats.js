const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Align with iOS User App - HYDRANT_ALIGNMENT.md
function normalizeOrderStatus(raw) {
  const key = String(raw || '').toLowerCase().trim();
  const map = {
    pending: 'pending', processing: 'processing', completed: 'completed', cancelled: 'cancelled',
    delivered: 'completed', canceled: 'cancelled', placed: 'pending', confirmed: 'processing',
    in_progress: 'processing', out_for_delivery: 'processing', in_transit: 'processing',
  };
  return map[key] || 'pending';
}
function isOpenOrderStatus(status) {
  const n = normalizeOrderStatus(status);
  return n === 'pending' || n === 'processing';
}

// Function to update dashboard stats
async function updateDashboardStats() {
  try {
    console.log('🔄 Updating dashboard stats...');
    
    // Get all orders
    const ordersSnapshot = await db.collection('orders').get();
    const orders = [];
    ordersSnapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    const users = [];
    usersSnapshot.forEach(doc => {
      users.push({ id: doc.id, ...doc.data() });
    });
    
    // Calculate stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Filter today's orders
    const todayOrders = orders.filter(order => {
      const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
      return orderDate >= today && orderDate < tomorrow;
    });
    
    // Calculate Today's Revenue: (today total order quantity - today cancelled orders) * 37
    const todayDeliveredOrders = todayOrders.filter(order => normalizeOrderStatus(order.status) === 'completed');
    const todayDeliveredQuantity = todayDeliveredOrders.reduce((sum, order) => {
      return sum + (order.quantity || order.items?.[0]?.quantity || 1);
    }, 0);
    const todayRevenue = todayDeliveredQuantity * 37;
    
    // Calculate Processing Orders: open orders (includes placed, confirmed, in_progress, out_for_delivery from iOS)
    const processingOrders = orders.filter(order => isOpenOrderStatus(order.status)).length;
    
    // Calculate Total Orders: open + cancelled + delivered = total orders
    const totalOrders = orders.length;
    
    // Calculate Total Users: number of users in Firebase database
    const totalUsers = users.length;
    
    // Calculate Total Revenue: all delivered orders quantity * 37
    const deliveredOrders = orders.filter(order => normalizeOrderStatus(order.status) === 'completed');
    const totalDeliveredQuantity = deliveredOrders.reduce((sum, order) => {
      return sum + (order.quantity || order.items?.[0]?.quantity || 1);
    }, 0);
    const totalRevenue = totalDeliveredQuantity * 37;
    
    // Calculate New Customers Today
    const newCustomersToday = users.filter(user => {
      const joinDate = user.createdAt?.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
      return joinDate >= today && joinDate < tomorrow;
    }).length;
    
    // Update the dashboard stats document
    const dashboardStatsRef = db.collection('dashboard_stats').doc('live_metrics');
    await dashboardStatsRef.set({
      todayRevenue,
      processingOrders,
      newCustomersToday,
      totalOrders,
      totalUsers,
      totalRevenue,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Dashboard stats updated successfully!');
    console.log({
      todayRevenue,
      processingOrders,
      newCustomersToday,
      totalOrders,
      totalUsers,
      totalRevenue
    });
    
    return {
      success: true,
      stats: {
        todayRevenue,
        processingOrders,
        newCustomersToday,
        totalOrders,
        totalUsers,
        totalRevenue
      }
    };
  } catch (error) {
    console.error('❌ Error updating dashboard stats:', error);
    return { success: false, error: error.message };
  }
}

// HTTP function to manually trigger dashboard stats update
exports.updateDashboardStats = functions.https.onRequest(async (req, res) => {
  // Allow CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    const result = await updateDashboardStats();
    if (result.success) {
      res.status(200).json({ message: 'Dashboard stats updated successfully', stats: result.stats });
    } else {
      res.status(500).json({ error: 'Failed to update dashboard stats', details: result.error });
    }
  } catch (error) {
    console.error('Error in HTTP function:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Function to initialize dashboard stats document
exports.initializeDashboardStats = functions.https.onRequest(async (req, res) => {
  try {
    const dashboardStatsRef = db.collection('dashboard_stats').doc('live_metrics');
    
    // Check if document already exists
    const doc = await dashboardStatsRef.get();
    if (doc.exists) {
      res.status(200).json({ message: 'Dashboard stats document already exists' });
      return;
    }
    
    // Create initial document
    const initialData = {
      todayRevenue: 0,
      processingOrders: 0,
      newCustomersToday: 0,
      totalOrders: 0,
      totalUsers: 0,
      totalRevenue: 0,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await dashboardStatsRef.set(initialData);
    console.log('✅ Dashboard stats document initialized successfully!');
    res.status(200).json({ message: 'Dashboard stats document initialized successfully', data: initialData });
  } catch (error) {
    console.error('❌ Error initializing dashboard stats:', error);
    res.status(500).json({ error: 'Failed to initialize dashboard stats', details: error.message });
  }
});

// Function to update dashboard stats when orders change
exports.onOrderUpdate = functions.firestore
  .document('orders/{orderId}')
  .onWrite(async (change, context) => {
    console.log('🔄 Order changed, updating dashboard stats...');
    await updateDashboardStats();
  });

// Function to update dashboard stats when users change
exports.onUserUpdate = functions.firestore
  .document('users/{userId}')
  .onWrite(async (change, context) => {
    console.log('🔄 User changed, updating dashboard stats...');
    await updateDashboardStats();
  });

module.exports = { updateDashboardStats };