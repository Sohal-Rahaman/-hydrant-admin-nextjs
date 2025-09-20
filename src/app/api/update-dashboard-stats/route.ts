import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';

export async function POST() {
  try {
    // Get all orders
    const ordersSnapshot = await getDocs(collection(db, 'orders'));
    const orders: any[] = [];
    ordersSnapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    
    // Get all users
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users: any[] = [];
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
    const todayDeliveredOrders = todayOrders.filter(order => order.status === 'completed');
    const todayDeliveredQuantity = todayDeliveredOrders.reduce((sum, order) => {
      return sum + (order.quantity || order.items?.[0]?.quantity || 1);
    }, 0);
    const todayRevenue = todayDeliveredQuantity * 37;
    
    // Calculate Processing Orders: open orders (not including cancelled or delivered)
    const processingOrders = orders.filter(order => 
      order.status === 'pending' || order.status === 'processing'
    ).length;
    
    // Calculate Total Orders: open + cancelled + delivered = total orders
    const totalOrders = orders.length;
    
    // Calculate Total Users: number of users in Firebase database
    const totalUsers = users.length;
    
    // Calculate Total Revenue: all delivered orders quantity * 37
    const deliveredOrders = orders.filter(order => order.status === 'completed');
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
    const dashboardStatsRef = doc(db, 'dashboard_stats', 'live_metrics');
    await setDoc(dashboardStatsRef, {
      todayRevenue,
      processingOrders,
      newCustomersToday,
      totalOrders,
      totalUsers,
      totalRevenue,
      lastUpdated: new Date()
    });
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Dashboard stats updated successfully',
        stats: {
          todayRevenue,
          processingOrders,
          newCustomersToday,
          totalOrders,
          totalUsers,
          totalRevenue
        }
      }),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  } catch (error: any) {
    console.error('Error updating dashboard stats:', error);
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