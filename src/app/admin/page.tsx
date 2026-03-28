'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { 
  FiDollarSign, 
  FiPackage, 
  FiUsers, 
  FiTrendingUp,
  FiRefreshCw,
  FiPlay,
  FiMapPin,
  FiCalendar,
  FiClock,
  FiInfo,
  FiUser
} from 'react-icons/fi';
import { 
  subscribeToCollection, 
  calculateRevenue, 
  getPincodeAnalytics,
  triggerSubscriptionOrders,
  getDeliveryAnalytics,
  db
} from '@/lib/firebase';
import { normalizeOrderStatus } from '@/lib/orderStatus';
import { serverTimestamp, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

const DashboardContainer = styled.div`
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
`;

const ChartsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 20px;
  margin-top: 30px;
  margin-bottom: 30px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ChartCard = styled(motion.div)`
  background: white;
  border-radius: 24px;
  padding: 30px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  border: 1px solid #f0f0f0;

  h3 {
    margin-top: 0;
    margin-bottom: 25px;
    color: #124D34;
    font-size: 1.2rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  flex-wrap: wrap;
  gap: 20px;
`;

const TitleSection = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
`;

const DashboardLogo = styled(Image)`
  width: 50px;
  height: 50px;
  border-radius: 10px;
  object-fit: cover;
`;

const Title = styled.h1`
  color: #124D34;
  margin: 0;
  font-size: 2.2rem;
  font-weight: 900;
  letter-spacing: -0.5px;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
`;

const ActionButton = styled(motion.button)`
  background: #124D34;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(18, 77, 52, 0.2);

  &:hover {
    transform: translateY(-2px);
    background: #1A5F45;
    box-shadow: 0 6px 16px rgba(18, 77, 52, 0.3);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 25px;
  margin-bottom: 40px;
`;

const StatCard = styled(motion.div)<{ color?: string }>`
  background: white;
  padding: 30px;
  border-radius: 24px;
  box-shadow: 0 4px 20px rgba(18, 77, 52, 0.05);
  border: 1px solid #f0f0f0;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 200px;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 6px;
    background: ${props => props.color || 'linear-gradient(135deg, #124D34 0%, #1A5F45 100%)'};
  }
`;

const StatHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
`;

const StatIcon = styled.div<{ color?: string }>`
  width: 54px;
  height: 54px;
  border-radius: 16px;
  background: ${props => props.color || 'rgba(18, 77, 52, 0.08)'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.color ? 'white' : '#124D34'};
  font-size: 1.4rem;
`;

const StatValue = styled.div`
  font-size: 3.5rem;
  font-weight: 900;
  color: #124D34;
  margin-bottom: 4px;
  letter-spacing: -2px;
`;

const StatLabel = styled.div`
  color: #666;
  font-size: 1rem;
  font-weight: 500;
`;

const StatTrend = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  color: #6b7280;
  font-size: 0.9rem;
  margin-top: 10px;
`;

const AnalyticsGrid = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 30px;
  margin-bottom: 40px;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

const AnalyticsCard = styled(motion.div)`
  background: white;
  padding: 35px;
  border-radius: 24px;
  box-shadow: 0 4px 25px rgba(18, 77, 52, 0.04);
  border: 1px solid #f0f0f0;
`;

const CardTitle = styled.h3`
  color: #333;
  margin: 0 0 25px 0;
  font-size: 1.3rem;
  font-weight: 600;
`;

const PincodeItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 0;
  border-bottom: 1px solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }
`;

const PincodeDetails = styled.div`
  flex: 1;
`;

const PincodeLabel = styled.div`
  font-weight: 600;
  color: #333;
  margin-bottom: 5px;
`;

const PincodeStats = styled.div`
  color: #666;
  font-size: 0.9rem;
`;

const PincodeRevenue = styled.div`
  font-weight: 700;
  color: #10b981;
  font-size: 1.1rem;
`;

const RecentOrdersList = styled.div`
  max-height: 400px;
  overflow-y: auto;
`;

const OrderItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }
`;

const OrderInfo = styled.div`
  flex: 1;
`;

const OrderId = styled.div`
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
  font-size: 0.9rem;
`;

const OrderDetails = styled.div`
  color: #666;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const OrderStatus = styled.div<{ status: string }>`
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  
  ${props => {
    switch (props.status) {
      case 'pending':
        return `background: #fef3c7; color: #92400e;`;
      case 'processing':
        return `background: #dbeafe; color: #1e40af;`;
      case 'completed':
        return `background: #d1fae5; color: #065f46;`;
      case 'cancelled':
        return `background: #fee2e2; color: #991b1b;`;
      default:
        return `background: #f3f4f6; color: #374151;`;
    }
  }}
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: #666;
`;

const InfoBox = styled.div`
  background: #e0f2fe;
  border: 1px solid #0891b2;
  color: #0c4a6e;
  padding: 15px;
  border-radius: 10px;
  margin-bottom: 20px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 0.9rem;
  line-height: 1.5;
`;

const LoadingSpinner = styled(motion.div)`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  
  svg {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    revenue: 0,
    openOrders: 0,
    newCustomers: 0,
    totalOrders: 0,
    totalUsers: 0,
    totalRevenue: 0,
    expressCount: 0,
    subscriptionCount: 0,
    normalCount: 0
  });

  const [chartData, setChartData] = useState<{
    date: string;
    orders: number;
    newUsers: number;
  }[]>([]);
  
interface OrderData {
  id: string;
  createdAt: Date | { toDate: () => Date } | string | number;
  status: string;
  quantity: number;
  amount: number;
  items?: Array<{ quantity: number }>;
  total?: number;
  customerName?: string;
  deliveryAddress?: string;
  userId: string;
  address?: {
    pincode: string;
  };
  deliveryPartner?: {
    name: string;
    phone: string;
  };
  priority?: number;
  orderType?: string;
  sla_deadline?: any;
}

interface UserData {
  id: string;
  createdAt: Date | { toDate: () => Date } | string | number;
  signupDate?: Date | { toDate: () => Date } | string | number;
  registeredAt?: Date | { toDate: () => Date } | string | number;
}

interface SubscriptionData {
  id: string;
  isActive: boolean;
}

// Helper function to convert various date formats to Date object
const toDate = (dateValue: any): Date => {
  if (!dateValue) return new Date();
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue === 'object' && dateValue.toDate && typeof dateValue.toDate === 'function') {
    return dateValue.toDate();
  }
  if (typeof dateValue === 'object' && dateValue.seconds) {
    return new Date(dateValue.seconds * 1000);
  }
  try {
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return new Date();
    return d;
  } catch {
    return new Date();
  }
};

  const [orders, setOrders] = useState<OrderData[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([]);
  const [pincodeAnalytics, setPincodeAnalytics] = useState<Record<string, any>>({});
  const [recentOrders, setRecentOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Function to manually initialize dashboard stats
  const initializeDashboardStats = async () => {
    setActionLoading(true);
    try {
      // Try to initialize the dashboard stats document via API
      const response = await fetch('/api/init-dashboard-stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Dashboard stats document initialized successfully!');
        alert('Dashboard stats initialized successfully!');
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('❌ Error initializing dashboard stats:', error);
      // Show error message
      if (error.message.includes('permission-denied')) {
        alert('Permission denied. Please make sure you are logged in as an admin user.');
      } else {
        alert(`Error initializing dashboard stats: ${error.message}`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Function to manually trigger dashboard stats update
  const updateDashboardStats = async () => {
    setActionLoading(true);
    try {
      // Call the API endpoint to update dashboard stats
      const response = await fetch('/api/update-dashboard-stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Dashboard stats updated successfully!', result.stats);
        alert('Dashboard stats updated successfully!');
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('❌ Error updating dashboard stats:', error);
      alert(`Error updating dashboard stats: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setError('');

    // Subscribe to live dashboard stats from Firebase dashboard_stats collection
    const unsubscribeStats = onSnapshot(
      doc(db, 'dashboard_stats', 'live_metrics'),
      (docSnapshot) => {
        console.log('🔍 Dashboard Stats Debug Info:');
        console.log('- Document exists:', docSnapshot.exists());
        console.log('- Document ID:', docSnapshot.id);
        console.log('- Document metadata:', docSnapshot.metadata);
        
        if (docSnapshot.exists()) {
          const liveStats = docSnapshot.data();
          console.log('📊 Raw dashboard_stats data:', liveStats);
          console.log('📋 Available fields:', Object.keys(liveStats));
          
          // Log each field individually for debugging
          console.log('Field values:');
          console.log('- todayRevenue:', liveStats.todayRevenue, typeof liveStats.todayRevenue);
          console.log('- processingOrders:', liveStats.processingOrders, typeof liveStats.processingOrders);
          console.log('- newCustomersToday:', liveStats.newCustomersToday, typeof liveStats.newCustomersToday);
          console.log('- totalOrders:', liveStats.totalOrders, typeof liveStats.totalOrders);
          console.log('- totalUsers:', liveStats.totalUsers, typeof liveStats.totalUsers);
          console.log('- totalRevenue:', liveStats.totalRevenue, typeof liveStats.totalRevenue);
          
          setStats({
            revenue: liveStats.todayRevenue || 0,
            openOrders: liveStats.processingOrders || 0,
            newCustomers: liveStats.newCustomersToday || 0,
            totalOrders: liveStats.totalOrders || 0,
            totalUsers: liveStats.totalUsers || 0,
            totalRevenue: liveStats.totalRevenue || 0,
            expressCount: liveStats.expressCount || 0,
            subscriptionCount: liveStats.subscriptionCount || 0,
            normalCount: liveStats.normalCount || 0
          });
          
          console.log('✅ Stats updated successfully with values:', {
            revenue: liveStats.todayRevenue || 0,
            openOrders: liveStats.processingOrders || 0,
            newCustomers: liveStats.newCustomersToday || 0,
            totalOrders: liveStats.totalOrders || 0,
            totalUsers: liveStats.totalUsers || 0,
            totalRevenue: liveStats.totalRevenue || 0
          });
        } else {
          console.log('❌ Dashboard stats document does NOT exist in Firebase!');
          console.log('📝 Please create the document at: dashboard_stats/live_metrics');
          console.log('🔧 Required fields: todayRevenue, processingOrders, newCustomersToday, totalOrders, totalUsers, totalRevenue');
          
          // Keep using fallback calculation if document doesn't exist
          console.log('🔄 Using fallback calculation from orders/users collections...');
          calculateStats(orders, users);
        }
      },
      (error) => {
        console.error('❌ Error subscribing to dashboard stats:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        // Handle permission denied error specifically
        if (error.code === 'permission-denied') {
          console.log('🔐 Permission denied for dashboard_stats collection - using fallback calculation');
          // Continue with fallback calculation without showing error
          setError('Permission denied for dashboard stats. Please ensure you are logged in as an admin and try initializing the dashboard stats document.');
          calculateStats(orders, users);
        } else if (error.code === 'not-found') {
          console.log('📝 Dashboard stats document not found - using fallback calculation');
          // Continue with fallback calculation without showing error
          setError('Dashboard stats document not found. Please initialize the dashboard stats document.');
          calculateStats(orders, users);
        } else {
          console.log('🔄 General error with dashboard_stats - using fallback calculation');
          setError(`Error connecting to dashboard stats: ${error.message}`);
          calculateStats(orders, users);
        }
      }
    );

    // Subscribe to orders collection
    const unsubscribeOrders = subscribeToCollection('orders', (snapshot) => {
      try {
        console.log('🔍 Raw orders snapshot:', {
          totalDocs: snapshot.docs.length,
          isEmpty: snapshot.empty,
          size: snapshot.size
        });
        
        if (snapshot.empty) {
          console.warn('⚠️ Orders collection is empty!');
          console.log('📋 Consider adding some test orders to see data in dashboard');
          setOrders([]);
          setRecentOrders([]);
          setPincodeAnalytics({});
          calculateStats([], users);
          return;
        }
        
        const ordersData = snapshot.docs.map((doc, index) => {
          const data = doc.data();
          console.log(`📋 Order ${index + 1} raw data:`, {
            id: doc.id,
            status: data.status,
            createdAt: data.createdAt,
            quantity: data.quantity,
            items: data.items,
            amount: data.amount,
            total: data.total,
            customerName: data.customerName,
            deliveryAddress: data.deliveryAddress,
            allFields: Object.keys(data)
          });
          
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt || data.orderDate || data.timestamp || new Date(),
            status: normalizeOrderStatus(data.status),
            quantity: data.items?.[0]?.quantity || data.quantity || 1,
            amount: data.total || data.amount || 37
          };
        }) as OrderData[];
        
        console.log('✅ Processed orders data:', {
          totalOrders: ordersData.length,
          statuses: ordersData.map(o => o.status),
          uniqueStatuses: [...new Set(ordersData.map(o => o.status))],
          pendingCount: ordersData.filter(o => o.status === 'pending').length,
          processingCount: ordersData.filter(o => o.status === 'processing').length,
          deliveredCount: ordersData.filter(o => o.status === 'completed').length,
          completedCount: ordersData.filter(o => o.status === 'completed').length,
          cancelledCount: ordersData.filter(o => o.status === 'cancelled').length
        });
        
        setOrders(ordersData);
        
        // Set recent orders (last 10)
        setOrders(ordersData);
        
        // Set recent orders (last 10)
        const sortedOrders = [...ordersData].sort((a, b) => {
          const dateA = toDate(a.createdAt);
          const dateB = toDate(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });
        setRecentOrders(sortedOrders.slice(0, 10));
        
        // Calculate pincode analytics
        setPincodeAnalytics(getPincodeAnalytics(ordersData));
        
        calculateStats(ordersData, []); // Pass current users if needed, or wait for users effect
      } catch (error) {
        console.error('❌ Error processing orders:', error);
        setError('Failed to load orders data');
      }
    }, [], (error) => {
      console.error('❌ Orders subscription error:', error);
      setError(`Error connecting to Firebase orders: ${error.message}`);
    });

    // Subscribe to users collection
    const unsubscribeUsers = subscribeToCollection('users', (snapshot) => {
      try {
        console.log('👥 Firebase users snapshot received:', {
          totalUsers: snapshot.docs.length,
          isEmpty: snapshot.empty
        });
        
        if (snapshot.empty) {
          console.warn('⚠️ Users collection is empty!');
          setUsers([]);
          calculateStats(orders, []);
          return;
        }
        
        const usersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt || doc.data().signupDate || doc.data().registeredAt || new Date()
        })) as UserData[];
        
        console.log('✅ Processed users data:', {
          totalUsers: usersData.length,
          sampleUser: usersData[0] ? {
            id: usersData[0].id,
            createdAt: usersData[0].createdAt,
            fields: Object.keys(usersData[0])
          } : 'No users found'
        });
        
        setUsers(usersData);
        calculateStats(orders, usersData);
      } catch (error) {
        console.error('❌ Error processing users:', error);
        setError('Failed to load users data');
      }
    });

    // Subscribe to subscriptions collection
    const unsubscribeSubscriptions = subscribeToCollection('subscriptions', (snapshot) => {
      try {
        const subscriptionsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as SubscriptionData[];
        setSubscriptions(subscriptionsData.filter(sub => sub.isActive));
      } catch (error) {
        console.error('Error processing subscriptions:', error);
      }
    });

    // Set loading to false after initial data load
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    return () => {
      unsubscribeStats();
      unsubscribeOrders();
      unsubscribeUsers();
      unsubscribeSubscriptions();
      clearTimeout(timer);
    };
  }, []);

  // Effect to calculate chart data whenever orders or users change
  useEffect(() => {
    if (!orders.length && !users.length) return;

    const last7DaysData = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const nextD = new Date(d);
      nextD.setDate(nextD.getDate() + 1);

      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

      // get orders for this day
      const dayOrders = orders.filter(order => {
        const orderDate = toDate(order.createdAt);
        return orderDate >= d && orderDate < nextD;
      });

      // get users for this day
      const dayUsers = users.filter(user => {
        const joinDate = toDate(user.createdAt);
        return joinDate >= d && joinDate < nextD;
      });

      last7DaysData.push({
        date: dayLabel,
        orders: dayOrders.length,
        newUsers: dayUsers.length,
      });
    }

    console.log('📈 Chart Data Updated:', last7DaysData);
    setChartData(last7DaysData);
  }, [orders, users]);

  const calculateStats = (ordersData: OrderData[], usersData: UserData[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Filter today's orders
    const todayOrders = ordersData.filter(order => {
      const orderDate = toDate(order.createdAt);
      return orderDate >= today && orderDate < tomorrow;
    });

    // Filter new customers today (joined within 24 hours)
    const newCustomersToday = usersData.filter(user => {
      const joinDate = toDate(user.createdAt);
      return joinDate >= today && joinDate < tomorrow;
    }).length;

    // Calculate Today&apos;s Revenue: (today total order quantity - today cancelled orders) * 37
    const todayDeliveredOrders = todayOrders.filter(order => order.status === 'completed');
    const todayDeliveredQuantity = todayDeliveredOrders.reduce((sum, order) => {
      return sum + (order.quantity || order.items?.[0]?.quantity || 1);
    }, 0);
    const todayRevenue = todayDeliveredQuantity * 37;

    // Calculate Processing Orders: open orders (not including cancelled or delivered)
    const processingOrders = ordersData.filter(order => 
      order.status === 'pending' || order.status === 'processing'
    ).length;

    // Calculate Total Orders: open + cancelled + delivered = total orders
    const totalOrders = ordersData.length;

    // Calculate Total Users: number of users in Firebase database
    const totalUsers = usersData.length;

    // Calculate Total Revenue: (total delivered order quantity - total cancelled orders) * 37
    const allDeliveredOrders = ordersData.filter(order => order.status === 'completed');
    const totalDeliveredQuantity = allDeliveredOrders.reduce((sum, order) => {
      return sum + (order.quantity || order.items?.[0]?.quantity || 1);
    }, 0);
    const totalRevenue = totalDeliveredQuantity * 37;

    const expressCount = ordersData.filter(o => o.priority === 2 && (o.status === 'pending' || o.status === 'processing')).length;
    const subscriptionCount = ordersData.filter(o => o.priority === 1 && (o.status === 'pending' || o.status === 'processing')).length;
    const normalCount = ordersData.filter(o => (o.priority === 0 || o.priority === undefined) && (o.status === 'pending' || o.status === 'processing')).length;

    console.log('📊 Dashboard Statistics Calculated:', {
      todayOrders: todayOrders.length,
      todayDeliveredOrders: todayDeliveredOrders.length,
      todayDeliveredQuantity,
      todayRevenue,
      processingOrders,
      newCustomersToday,
      totalOrders,
      totalUsers,
      totalDeliveredQuantity,
      totalRevenue,
      expressCount,
      subscriptionCount,
      normalCount
    });

    setStats({
      revenue: todayRevenue,
      openOrders: processingOrders,
      newCustomers: newCustomersToday,
      totalOrders: totalOrders,
      totalUsers: totalUsers,
      totalRevenue: totalRevenue,
      expressCount,
      subscriptionCount,
      normalCount
    });
  };

  const handleTriggerSubscriptions = async () => {
    setActionLoading(true);
    try {
      await triggerSubscriptionOrders();
      alert('Subscription orders triggered successfully!');
    } catch (error) {
      console.error('Error triggering subscriptions:', error);
      alert('Error triggering subscriptions. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGetAnalytics = async () => {
    setActionLoading(true);
    try {
      const result = await getDeliveryAnalytics();
      console.log('Analytics data:', result.data);
      alert('Analytics exported successfully! Check console for details.');
    } catch (error) {
      console.error('Error getting analytics:', error);
      alert('Error getting analytics. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const createDashboardStatsDocument = async () => {
    try {
      const sampleStats = {
        todayRevenue: 74,
        processingOrders: 2,
        newCustomersToday: 1,
        totalOrders: 10,
        totalUsers: 5,
        totalRevenue: 1000,
        lastUpdated: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'dashboard_stats', 'live_metrics'), sampleStats);
      console.log('✅ Dashboard stats document created successfully!');
      alert('🎉 Dashboard stats document created!\nYour dashboard should now show live data.');
    } catch (error) {
      console.error('❌ Error creating dashboard stats document:', error);
      alert(`Error creating document: ${error}`);
    }
  };

  const diagnoseData = () => {
    console.log('🔍 DASHBOARD DIAGNOSIS:');
    console.log('Orders state:', {
      length: orders.length,
      sample: orders[0] || 'No orders'
    });
    console.log('Users state:', {
      length: users.length,
      sample: users[0] || 'No users'
    });
    console.log('Current stats:', stats);
    console.log('Loading state:', loading);
    console.log('Error state:', error);
    
    alert(`Dashboard Diagnosis:
• Orders: ${orders.length} items
• Users: ${users.length} items
• Loading: ${loading}
• Error: ${error || 'None'}

Check console for detailed logs`);
  };

  if (loading) {
    return (
      <LoadingSpinner>
        <FiRefreshCw size={40} />
      </LoadingSpinner>
    );
  }

  return (
    <DashboardContainer>
      <Header>
        <TitleSection>
          <DashboardLogo 
            src="/hydrantlogo.png" 
            alt="Hydrant Logo"
            width={50}
            height={50}
          />
          <Title>Admin Dashboard</Title>
        </TitleSection>
        <ActionButtons>
          <ActionButton 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={initializeDashboardStats}
            disabled={actionLoading}
          >
            <FiRefreshCw /> {actionLoading ? 'Initializing...' : 'Init Dashboard Stats'}
          </ActionButton>
          <ActionButton 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={updateDashboardStats}
            disabled={actionLoading}
          >
            <FiRefreshCw /> {actionLoading ? 'Updating...' : 'Update Dashboard Stats'}
          </ActionButton>
          <ActionButton 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => triggerSubscriptionOrders()}
            disabled={actionLoading}
          >
            <FiPlay /> Generate Subscription Orders
          </ActionButton>
        </ActionButtons>
      </Header>

      <ChartsGrid>
        <ChartCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3>Orders Overview (Last 7 Days)</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#124D34" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#124D34" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#666', fontSize: 12}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#666', fontSize: 12}} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Area 
                type="monotone" 
                dataKey="orders" 
                name="Total Orders"
                stroke="#124D34" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorOrders)" 
              />
            </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3>User Growth (Last 7 Days)</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#666', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#666', fontSize: 12}} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  cursor={{ fill: '#f3f4f6' }}
                />
                <Bar dataKey="newUsers" name="New Users" fill="#10B981" radius={[6, 6, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </ChartsGrid>

      <StatsGrid>
        <StatCard
          color="linear-gradient(135deg, #10b981 0%, #059669 100%)"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <StatHeader>
            <div>
              <StatValue>₹{stats.revenue}</StatValue>
              <StatLabel>Today&apos;s Revenue</StatLabel>
              <StatTrend>
                <FiTrendingUp />
                Delivered orders × ₹37
              </StatTrend>
            </div>
            <StatIcon color="linear-gradient(135deg, #10b981 0%, #059669 100%)">
              <FiDollarSign />
            </StatIcon>
          </StatHeader>
        </StatCard>

        <StatCard
          color="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <StatHeader>
            <div>
              <StatValue>{stats.openOrders}</StatValue>
              <StatLabel>Processing Orders</StatLabel>
              <StatTrend>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <span style={{ fontSize: '0.7rem', background: '#fee2e2', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>
                    🚀 {stats.expressCount}
                  </span>
                  <span style={{ fontSize: '0.7rem', background: '#dcfce7', color: '#16a34a', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>
                    ♻️ {stats.subscriptionCount}
                  </span>
                  <span style={{ fontSize: '0.7rem', background: '#f3f4f6', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>
                    📦 {stats.normalCount}
                  </span>
                </div>
              </StatTrend>
            </div>
            <StatIcon color="#124D34">
              <FiPackage />
            </StatIcon>
          </StatHeader>
        </StatCard>

        <StatCard
          color="linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <StatHeader>
            <div>
              <StatValue>{stats.newCustomers}</StatValue>
              <StatLabel>New Customers Today</StatLabel>
              <StatTrend>
                <FiCalendar />
                Joined within 24 hours
              </StatTrend>
            </div>
            <StatIcon color="#124D34">
              <FiUsers />
            </StatIcon>
          </StatHeader>
        </StatCard>

        <StatCard
          color="linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%)"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <StatHeader>
            <div>
              <StatValue>{stats.totalOrders}</StatValue>
              <StatLabel>Total Orders</StatLabel>
              <StatTrend>
                <FiPackage />
                Open + Cancelled + Delivered
              </StatTrend>
            </div>
            <StatIcon>
              <FiTrendingUp />
            </StatIcon>
          </StatHeader>
        </StatCard>

        <StatCard
          color="linear-gradient(135deg, #ec4899 0%, #be185d 100%)"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <StatHeader>
            <div>
              <StatValue>{stats.totalUsers}</StatValue>
              <StatLabel>Total Users</StatLabel>
              <StatTrend>
                <FiUsers />
                All registered users
              </StatTrend>
            </div>
            <StatIcon color="linear-gradient(135deg, #ec4899 0%, #be185d 100%)">
              <FiUsers />
            </StatIcon>
          </StatHeader>
        </StatCard>

        <StatCard
          color="linear-gradient(135deg, #059669 0%, #047857 100%)"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <StatHeader>
            <div>
              <StatValue>₹{stats.totalRevenue}</StatValue>
              <StatLabel>Total Revenue</StatLabel>
              <StatTrend>
                <FiDollarSign />
                All completed orders × ₹37
              </StatTrend>
            </div>
            <StatIcon color="#124D34">
              <FiDollarSign />
            </StatIcon>
          </StatHeader>
        </StatCard>
      </StatsGrid>

      {error && (
        <InfoBox>
          <FiInfo size={20} />
          <div>
            <strong>Dashboard Stats Error:</strong> {error}
            <br />
            <br />
            To fix this issue:
            <br />
            1. Make sure you are logged in as an admin user
            <br />
            2. Click the "Init Dashboard Stats" button above to create the required document
            <br />
            3. If the problem persists, contact your system administrator
          </div>
        </InfoBox>
      )}

      <AnalyticsGrid>
        <AnalyticsCard
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7 }}
        >
          <CardTitle>Area Analytics</CardTitle>
          {Object.keys(pincodeAnalytics).length > 0 ? (
            <div>
              {Object.entries(pincodeAnalytics).map(([pincode, data]: [string, any]) => (
                <PincodeItem key={pincode}>
                  <PincodeDetails>
                    <PincodeLabel>
                      <FiMapPin style={{ display: 'inline', marginRight: '8px' }} />
                      {pincode === '700030' ? 'Dum Dum (700030)' : 
                       pincode === '700074' ? 'Salt Lake City (700074)' : 
                       `Area ${pincode}`}
                    </PincodeLabel>
                    <PincodeStats>
                      {data.totalOrders} orders • {data.completedOrders} completed • {data.cancelledOrders} cancelled
                    </PincodeStats>
                  </PincodeDetails>
                  <PincodeRevenue>₹{data.revenue}</PincodeRevenue>
                </PincodeItem>
              ))}
              {subscriptions.length > 0 && (
                <PincodeItem>
                  <PincodeDetails>
                    <PincodeLabel>
                      <FiRefreshCw style={{ display: 'inline', marginRight: '8px' }} />
                      Active Subscriptions
                    </PincodeLabel>
                    <PincodeStats>
                      {subscriptions.length} active subscribers
                    </PincodeStats>
                  </PincodeDetails>
                  <PincodeRevenue>₹{subscriptions.length * 37}/day</PincodeRevenue>
                </PincodeItem>
              )}
            </div>
          ) : (
            <EmptyState>
              <FiMapPin size={24} style={{ marginBottom: '10px' }} />
              <div>No area data available</div>
              <div style={{ fontSize: '0.8rem', marginTop: '5px' }}>Data will appear once orders are placed</div>
            </EmptyState>
          )}
        </AnalyticsCard>

        <AnalyticsCard
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8 }}
        >
          <CardTitle>Recent Orders</CardTitle>
          <RecentOrdersList>
            {recentOrders.length > 0 ? (
              recentOrders.map((order) => (
                <OrderItem key={order.id}>
                  <OrderInfo>
                    <OrderId>#{order.id.substring(0, 8)}</OrderId>
                    <OrderDetails>
                      <FiUsers style={{ fontSize: '0.8rem' }} />
                      {order.customerName || 'Unknown Customer'}
                      <FiMapPin style={{ fontSize: '0.8rem' }} />
                      {order.address?.pincode || 'No pincode'}
                      <FiClock style={{ fontSize: '0.8rem' }} />
                      {order.createdAt ? 
                        toDate(order.createdAt).toLocaleDateString() : 
                        'No date'
                      }
                    </OrderDetails>
                    {order.deliveryPartner && (
                      <div style={{ 
                        fontSize: '0.75rem', color: '#059669', marginTop: '6px', 
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: '#f0fdf4', padding: '4px 8px', borderRadius: '6px',
                        width: 'fit-content', border: '1px solid #dcfce7'
                      }}>
                        <FiUser size={12} />
                        <span style={{ fontWeight: '700' }}>{order.deliveryPartner.name}</span>
                      </div>
                    )}
                  </OrderInfo>
                  <div style={{ textAlign: 'right' }}>
                    <OrderStatus status={order.status || 'pending'}>
                      {order.status || 'pending'}
                    </OrderStatus>
                    <div style={{ marginTop: '4px', fontSize: '0.9rem', fontWeight: '600', color: '#10b981' }}>
                      ₹{order.amount || 37}
                    </div>
                  </div>
                </OrderItem>
              ))
            ) : (
              <EmptyState>
                <FiPackage size={24} style={{ marginBottom: '10px' }} />
                <div>No recent orders</div>
                <div style={{ fontSize: '0.8rem', marginTop: '5px' }}>Orders will appear here once placed</div>
              </EmptyState>
            )}
          </RecentOrdersList>
        </AnalyticsCard>
      </AnalyticsGrid>

      <InfoBox>
        <FiInfo />
        <div>
          <strong>Real-time Data Source:</strong> This dashboard displays live data from your Firebase 'dashboard_stats' collection.
          <br />• KPI metrics are fetched from the 'dashboard_stats/live_metrics' document
          <br />• Orders and users data are fetched from respective collections for analytics
          <br />• All metrics update automatically as new data is added to Firebase
          <br />• The dashboard_stats collection provides optimized performance for real-time KPIs
        </div>
      </InfoBox>
    </DashboardContainer>
  );
}