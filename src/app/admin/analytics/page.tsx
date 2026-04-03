'use client';

import React, { useState, useEffect, useRef } from 'react';
import { normalizeOrderStatus, isOpenOrderStatus } from '@/lib/orderStatus';
import Image from 'next/image';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import {
  FiTrendingUp,
  FiBarChart,
  FiPieChart,
  FiActivity,
  FiCalendar,
  FiDollarSign,
  FiPackage,
  FiUsers,
  FiRefreshCw,
  FiDownload
} from 'react-icons/fi';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { subscribeToCollection } from '@/lib/firebase';
import { doc, onSnapshot, getFirestore, collection, getDocs } from 'firebase/firestore';
import { generateCSV, downloadCSV, generateFilename, UserDataForCSV } from '@/lib/csvExport';

const AnalyticsContainer = styled.div`
  padding: 24px;
  max-width: 1600px;
  margin: 0 auto;
  background: #0f0f0f;
  min-height: calc(100vh - 64px);
  color: #f0f0f0;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  gap: 24px;
`;

const TitleSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const Title = styled.h1`
  color: #f0f0f0;
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const AnalyticsLogo = styled(Image)`
  width: 45px;
  height: 45px;
  border-radius: 12px;
  object-fit: cover;
`;

const RefreshButton = styled(motion.button)`
  background: #10B981;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 14px;
  transition: all 0.2s;

  &:hover {
    background: #059669;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StatsOverview = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
`;

const StatCard = styled(motion.div)<{ color?: string }>`
  background: #181818;
  padding: 24px;
  border-radius: 24px;
  border: 1px solid #2e2e2e;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: border-color 0.2s;

  &:hover {
    border-color: #444;
  }
`;

const StatIcon = styled.div<{ color?: string }>`
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: ${props => props.color || 'rgba(16, 185, 129, 0.1)'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => (props.color && props.color !== 'rgba(16, 185, 129, 0.1)') ? 'white' : '#10B981'};
  font-size: 1.5rem;
`;

const StatValue = styled.div`
  font-size: 24px;
  font-weight: 800;
  color: #f0f0f0;
`;

const StatLabel = styled.div`
  color: #666;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
`;

const ChartsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  margin-bottom: 32px;

  @media (min-width: 1200px) {
    grid-template-columns: 2fr 1fr;
  }
`;

const ChartCard = styled(motion.div)`
  background: #181818;
  padding: 32px;
  border-radius: 32px;
  border: 1px solid #2e2e2e;
`;

const ChartTitle = styled.h3`
  color: #f0f0f0;
  margin: 0 0 24px 0;
  font-size: 18px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
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

// Chart color schemes
const COLORS = {
  primary: '#10B981',
  secondary: '#059669',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6'
};

const PIE_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

interface OrderData {
  id: string;
  createdAt: Date | { toDate: () => Date } | string | number;
  status: string;
  quantity: number;
  amount: number;
  items?: Array<{ quantity: number }>;
  total?: number;
}

interface UserData {
  id: string;
  createdAt: Date | { toDate: () => Date } | string | number;
}

interface DailyData {
  date: string;
  orders: number;
  quantity: number;
  revenue: number;
  delivered: number;
}

interface StatusData {
  name: string;
  value: number;
  percentage: string;
  [key: string]: string | number; // Index signature for Chart compatibility
}

interface RevenueData {
  date: string;
  revenue: number;
  orders: number;
}

// Helper function to convert various date formats to Date object
const toDate = (dateValue: Date | { toDate: () => Date } | string | number): Date => {
  if (!dateValue) return new Date();
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue === 'object' && 'toDate' in dateValue) return dateValue.toDate();
  return new Date(dateValue);
};

export default function AnalyticsPage() {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [csvDownloading, setCsvDownloading] = useState(false);
  const [stats, setStats] = useState({
    todayRevenue: 0,
    processingOrders: 0,
    newCustomersToday: 0,
    totalOrders: 0,
    totalUsers: 0,
    totalRevenue: 0
  });
  const [dailyOrdersData, setDailyOrdersData] = useState<DailyData[]>([]);
  const [orderStatusData, setOrderStatusData] = useState<StatusData[]>([]);

  // Use refs to track latest data without causing re-renders
  const ordersRef = useRef<OrderData[]>([]);
  const usersRef = useRef<UserData[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);

  useEffect(() => {
    setLoading(true);
    const db = getFirestore();

    // Subscribe to live dashboard stats from Firebase
    const unsubscribeStats = onSnapshot(
      doc(db, 'dashboard_stats', 'live_metrics'),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const liveStats = docSnapshot.data();
          console.log('📊 Live Dashboard Stats from Firebase:', liveStats);

          setStats({
            todayRevenue: liveStats.todayRevenue || 0,
            processingOrders: liveStats.processingOrders || 0,
            newCustomersToday: liveStats.newCustomersToday || 0,
            totalOrders: liveStats.totalOrders || 0,
            totalUsers: liveStats.totalUsers || 0,
            totalRevenue: liveStats.totalRevenue || 0
          });
        } else {
          console.log('⚠️ Dashboard stats document does not exist, using fallback calculation');
          // Fallback: stats will be calculated when orders/users are loaded below
        }
      },
      (error) => {
        console.error('❌ Error subscribing to dashboard stats:', error);
      }
    );

    // Subscribe to orders with error handling
    const unsubscribeOrders = subscribeToCollection('orders', (snapshot) => {
      try {
        const ordersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt || new Date(),
          status: normalizeOrderStatus(doc.data().status),
          quantity: doc.data().items?.[0]?.quantity || doc.data().quantity || 1,
          amount: doc.data().total || doc.data().amount || 37
        })) as OrderData[];

        setOrders(ordersData);
        ordersRef.current = ordersData;
        // Process data with latest values from refs
        if (usersRef.current.length > 0) {
          processOrdersData(ordersData, usersRef.current);
        }
      } catch (error) {
        console.error('❌ Error processing orders data:', error);
        setOrders([]);
      }
    }, [], (error) => {
      console.error('❌ Error subscribing to orders:', error);
      setOrders([]);
    });

    // Subscribe to users with error handling
    const unsubscribeUsers = subscribeToCollection('users', (snapshot) => {
      try {
        const usersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt || new Date()
        })) as UserData[];

        setUsers(usersData);
        usersRef.current = usersData;
        // Process data with latest values from refs
        if (ordersRef.current.length > 0) {
          processOrdersData(ordersRef.current, usersData);
        }
      } catch (error) {
        console.error('❌ Error processing users data:', error);
        setUsers([]);
      }
    }, [], (error) => {
      console.error('❌ Error subscribing to users:', error);
      setUsers([]);
    });

    setTimeout(() => setLoading(false), 2000);

    return () => {
      unsubscribeStats();
      unsubscribeOrders();
      unsubscribeUsers();
    };
  }, []); // Empty dependency array - only run once on mount

  const processOrdersData = (ordersData: OrderData[], usersData: UserData[]) => {
    // Calculate KPI stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Filter today's orders
    const todayOrders = ordersData.filter(order => {
      const orderDate = toDate(order.createdAt);
      return orderDate >= today && orderDate < tomorrow;
    });

    // New customers today
    const newCustomersToday = usersData.filter(user => {
      const joinDate = toDate(user.createdAt);
      return joinDate >= today && joinDate < tomorrow;
    }).length;

    // Today's revenue
    const todayDeliveredOrders = todayOrders.filter(order => normalizeOrderStatus(order.status) === 'completed');
    const todayDeliveredQuantity = todayDeliveredOrders.reduce((sum, order) => sum + order.quantity, 0);
    const todayRevenue = todayDeliveredQuantity * 37;

    // Processing orders (includes placed, confirmed, in_progress, out_for_delivery from iOS)
    const processingOrders = ordersData.filter(order => isOpenOrderStatus(order.status)).length;

    // Total revenue
    const allDeliveredOrders = ordersData.filter(order => normalizeOrderStatus(order.status) === 'completed');
    const totalDeliveredQuantity = allDeliveredOrders.reduce((sum, order) => sum + order.quantity, 0);
    const totalRevenue = totalDeliveredQuantity * 37;

    setStats({
      todayRevenue,
      processingOrders,
      newCustomersToday,
      totalOrders: ordersData.length,
      totalUsers: usersData.length,
      totalRevenue
    });

    // Generate daily orders chart data (last 7 days)
    const dailyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayOrders = ordersData.filter(order => {
        const orderDate = toDate(order.createdAt);
        return orderDate >= date && orderDate < nextDate;
      });

      const dayDelivered = dayOrders.filter(order => normalizeOrderStatus(order.status) === 'completed');
      const dayQuantity = dayOrders.reduce((sum, order) => sum + order.quantity, 0);
      const dayRevenue = dayDelivered.reduce((sum, order) => sum + order.quantity, 0) * 37;

      dailyData.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        orders: dayOrders.length,
        quantity: dayQuantity,
        revenue: dayRevenue,
        delivered: dayDelivered.length
      });
    }
    setDailyOrdersData(dailyData);

    // Order status distribution (normalized for consistent grouping)
    const statusCount: Record<string, number> = ordersData.reduce((acc, order) => {
      const n = normalizeOrderStatus(order.status);
      acc[n] = (acc[n] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const statusData = Object.entries(statusCount).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count as number,
      percentage: ((count as number / ordersData.length) * 100).toFixed(1)
    }));
    setOrderStatusData(statusData);

    // Revenue trend data (last 7 days)
    const revenueChartData = dailyData.map(day => ({
      date: day.date,
      revenue: day.revenue,
      orders: day.delivered
    }));
    setRevenueData(revenueChartData);
  };

  const refreshData = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  const downloadUserDataCSV = async () => {
    setCsvDownloading(true);

    try {
      const db = getFirestore();

      // Fetch all users
      const usersSnapshot = await getDocs(collection(db, 'users'));

      // Fetch all addresses
      const addressesSnapshot = await getDocs(collection(db, 'addresses'));
      const addressesMap: Record<string, any[]> = {};
      addressesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const userId = data.userId;
        if (!addressesMap[userId]) {
          addressesMap[userId] = [];
        }
        addressesMap[userId].push({
          id: doc.id,
          ...data
        });
      });

      // Fetch all orders
      const ordersSnapshot = await getDocs(collection(db, 'orders'));
      const ordersMap: Record<string, any[]> = {};
      ordersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const userId = data.userId;
        if (!ordersMap[userId]) {
          ordersMap[userId] = [];
        }
        ordersMap[userId].push({
          id: doc.id,
          ...data
        });
      });

      // Fetch all subscriptions
      const subscriptionsSnapshot = await getDocs(collection(db, 'subscriptions'));
      const subscriptionsMap: Record<string, any> = {};
      subscriptionsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const userId = data.userId;
        subscriptionsMap[userId] = {
          id: doc.id,
          ...data
        };
      });

      // Aggregate user data
      const usersData: UserDataForCSV[] = usersSnapshot.docs.map(doc => {
        const userData = doc.data();
        const userId = doc.id;

        return {
          id: userId,
          customerId: userData.customerId || 'N/A',
          name: userData.name || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'N/A',
          email: userData.email || 'N/A',
          phoneNumber: userData.phoneNumber || userData.phone || 'N/A',
          wallet_balance: userData.wallet_balance || userData.walletBalance || 0,
          totalCoins: userData.totalCoins || 0,
          totalShares: userData.totalShares || 0,
          jars_occupied: userData.jars_occupied || userData.holdJars || 0,
          createdAt: userData.createdAt || new Date(),
          addresses: addressesMap[userId] || [],
          orders: ordersMap[userId] || [],
          subscription: subscriptionsMap[userId]
        };
      });

      // Generate CSV
      const csvContent = generateCSV(usersData);

      // Download CSV
      const filename = generateFilename('hydrant_users_data');
      downloadCSV(csvContent, filename);

      console.log(`✅ Successfully exported ${usersData.length} users to CSV`);
    } catch (error) {
      console.error('❌ Error downloading user data CSV:', error);
      alert('Error generating CSV. Please try again.');
    } finally {
      setCsvDownloading(false);
    }
  };

  if (loading) {
    return (
      <LoadingSpinner>
        <FiRefreshCw size={40} />
      </LoadingSpinner>
    );
  }

  return (
    <AnalyticsContainer>
      <Header>
        <TitleSection>
          <AnalyticsLogo
            src="/hydrantlogo.png"
            alt="Hydrant Logo"
            width={45}
            height={45}
          />
          <Title>Analytics Dashboard</Title>
        </TitleSection>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <RefreshButton
            onClick={downloadUserDataCSV}
            disabled={csvDownloading}
            whileHover={{ scale: csvDownloading ? 1 : 1.02 }}
            whileTap={{ scale: csvDownloading ? 1 : 0.98 }}
            style={{
              background: csvDownloading
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
            }}
          >
            {csvDownloading ? <FiRefreshCw /> : <FiDownload />}
            {csvDownloading ? 'Generating CSV...' : 'Download User Data CSV'}
          </RefreshButton>
          <RefreshButton
            onClick={refreshData}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <FiRefreshCw />
            Refresh Data
          </RefreshButton>
        </div>
      </Header>

      <InfoBox>
        <FiActivity />
        <div>
          <strong>📊 Live Analytics - Real-Time KPI Data from Firebase:</strong>
          <br />• <strong>Data Source:</strong> Firebase collection &apos;dashboard_stats/live_metrics&apos;
          <br />• <strong>Today&apos;s Revenue:</strong> Today&apos;s completed orders quantity × ₹37 per jar
          <br />• <strong>Processing Orders:</strong> Orders with pending or processing status (excludes cancelled/completed)
          <br />• <strong>New Customers Today:</strong> Users who joined within the last 24 hours
          <br />• <strong>Total Orders:</strong> All orders (open + cancelled + delivered)
          <br />• <strong>Total Users:</strong> Total registered users in Firebase database
          <br />• <strong>Total Revenue:</strong> All completed orders quantity × ₹37 per jar
          <br />🔄 <em>Charts and KPIs update automatically from Firebase dashboard_stats collection in real-time</em>
        </div>
      </InfoBox>

      {/* KPI Overview Cards */}
      <StatsOverview>
        <StatCard
          color="linear-gradient(135deg, #10b981 0%, #059669 100%)"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <StatIcon color="linear-gradient(135deg, #10b981 0%, #059669 100%)">
            <FiDollarSign />
          </StatIcon>
          <StatValue>₹{stats.todayRevenue}</StatValue>
          <StatLabel>Today&apos;s Revenue</StatLabel>
        </StatCard>

        <StatCard
          color="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <StatIcon color="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)">
            <FiPackage />
          </StatIcon>
          <StatValue>{stats.processingOrders}</StatValue>
          <StatLabel>Processing Orders</StatLabel>
        </StatCard>

        <StatCard
          color="linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <StatIcon color="linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)">
            <FiUsers />
          </StatIcon>
          <StatValue>{stats.newCustomersToday}</StatValue>
          <StatLabel>New Customers Today</StatLabel>
        </StatCard>

        <StatCard
          color="linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%)"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <StatIcon>
            <FiTrendingUp />
          </StatIcon>
          <StatValue>{stats.totalOrders}</StatValue>
          <StatLabel>Total Orders</StatLabel>
        </StatCard>

        <StatCard
          color="linear-gradient(135deg, #ec4899 0%, #be185d 100%)"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <StatIcon color="linear-gradient(135deg, #ec4899 0%, #be185d 100%)">
            <FiUsers />
          </StatIcon>
          <StatValue>{stats.totalUsers}</StatValue>
          <StatLabel>Total Users</StatLabel>
        </StatCard>

        <StatCard
          color="linear-gradient(135deg, #059669 0%, #047857 100%)"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <StatIcon color="linear-gradient(135deg, #059669 0%, #047857 100%)">
            <FiDollarSign />
          </StatIcon>
          <StatValue>₹{stats.totalRevenue}</StatValue>
          <StatLabel>Total Revenue</StatLabel>
        </StatCard>
      </StatsOverview>

      {/* Main Charts */}
      <ChartsGrid>
        {/* Daily Orders Trend */}
        <ChartCard
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7 }}
        >
          <ChartTitle>
            <FiBarChart />
            Daily Orders & Quantity (Last 7 Days)
          </ChartTitle>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={dailyOrdersData}>
              <defs>
                <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorQuantity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={COLORS.success} stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2e2e2e" />
              <XAxis dataKey="date" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(24, 24, 24, 0.9)',
                  border: '1px solid #2e2e2e',
                  borderRadius: '16px',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 12px 24px rgba(0,0,0,0.5)',
                  color: '#f0f0f0'
                }}
                itemStyle={{ color: '#f0f0f0' }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="orders"
                stroke={COLORS.primary}
                fillOpacity={1}
                fill="url(#colorOrders)"
                name="Total Orders"
              />
              <Area
                type="monotone"
                dataKey="quantity"
                stroke={COLORS.success}
                fillOpacity={1}
                fill="url(#colorQuantity)"
                name="Total Quantity"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Order Status Distribution */}
        <ChartCard
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8 }}
        >
          <ChartTitle>
            <FiPieChart />
            Order Status Distribution
          </ChartTitle>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={orderStatusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                paddingAngle={5}
                dataKey="value"
              >
                {orderStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any, name: any, props: any) => [
                  `${value} orders (${props.payload.percentage}%)`,
                  name
                ]}
                contentStyle={{
                  backgroundColor: 'rgba(24, 24, 24, 0.9)',
                  border: '1px solid #2e2e2e',
                  borderRadius: '16px',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 12px 24px rgba(0,0,0,0.5)',
                  color: '#f0f0f0'
                }}
                itemStyle={{ color: '#f0f0f0' }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </ChartsGrid>

      {/* Revenue and Performance Charts */}
      <MetricsGrid>
        {/* Revenue Trend */}
        <ChartCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <ChartTitle>
            <FiTrendingUp />
            Revenue Trend (Last 7 Days)
          </ChartTitle>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2e2e2e" />
              <XAxis dataKey="date" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip
                formatter={(value: any, name: any) => [
                  name === 'revenue' ? `₹${value}` : value,
                  name === 'revenue' ? 'Revenue' : 'Delivered Orders'
                ]}
                contentStyle={{
                  backgroundColor: 'rgba(24, 24, 24, 0.9)',
                  border: '1px solid #2e2e2e',
                  borderRadius: '16px',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 12px 24px rgba(0,0,0,0.5)',
                  color: '#f0f0f0'
                }}
                itemStyle={{ color: '#f0f0f0' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke={COLORS.success}
                strokeWidth={3}
                dot={{ fill: COLORS.success, strokeWidth: 2, r: 4 }}
                name="Revenue (₹)"
              />
              <Line
                type="monotone"
                dataKey="orders"
                stroke={COLORS.info}
                strokeWidth={2}
                dot={{ fill: COLORS.info, strokeWidth: 2, r: 3 }}
                name="Delivered Orders"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Daily Performance Bar Chart */}
        <ChartCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
        >
          <ChartTitle>
            <FiActivity />
            Daily Performance Overview
          </ChartTitle>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyOrdersData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2e2e2e" />
              <XAxis dataKey="date" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(24, 24, 24, 0.9)',
                  border: '1px solid #2e2e2e',
                  borderRadius: '16px',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 12px 24px rgba(0,0,0,0.5)',
                  color: '#f0f0f0'
                }}
                itemStyle={{ color: '#f0f0f0' }}
              />
              <Legend />
              <Bar
                dataKey="orders"
                fill={COLORS.primary}
                name="Total Orders"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="delivered"
                fill={COLORS.success}
                name="Delivered Orders"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </MetricsGrid>

      {/* ─── Operational Intelligence ─── */}
      <OperationalIntelligence />
    </AnalyticsContainer>
  );
}

// ════════════════════════════════════════════════════════════════
// OPERATIONAL INTELLIGENCE — Jars, Dormant Users, Wallet Report
// ════════════════════════════════════════════════════════════════

const OISection = styled.div`
  margin-top: 48px;
  display: flex;
  flex-direction: column;
  gap: 32px;
`;

const OICard = styled.div`
  background: #181818;
  border-radius: 32px;
  border: 1px solid #2e2e2e;
  overflow: hidden;
`;

const OIHead = styled.div<{ $color?: string }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 32px;
  background: #222;
  border-bottom: 1px solid #2e2e2e;
  flex-wrap: wrap;
  gap: 16px;
`;

const OITitle = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 16px;
  font-weight: 800;
  color: #f0f0f0;
`;

const OIBadge = styled.span<{ $color: string }>`
  background: ${p => p.$color};
  color: white;
  border-radius: 12px;
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const ExportBtnRow = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const ExportBtn = styled.button<{ $variant?: 'green' | 'blue' | 'orange' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  font-size: 13px;
  font-weight: 700;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  background: ${p =>
    p.$variant === 'green' ? '#10B981' :
    p.$variant === 'blue' ? '#3B82F6' :
    p.$variant === 'orange' ? '#F59E0B' :
    '#333'};
  color: white;
  &:hover { 
    transform: translateY(-2px);
    filter: brightness(1.1);
  }
`;

const OITable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
`;

const OITh = styled.th`
  text-align: left;
  padding: 16px 24px;
  font-size: 11px;
  font-weight: 700;
  color: #666;
  text-transform: uppercase;
  letter-spacing: .1em;
  background: #111;
  border-bottom: 1px solid #2e2e2e;
  white-space: nowrap;
`;

const OITd = styled.td`
  padding: 16px 24px;
  border-bottom: 1px solid #2e2e2e;
  color: #ccc;
  vertical-align: middle;
`;

const CLink = styled.a`
  color: #10B981;
  text-decoration: none;
  font-weight: 600;
  &:hover { text-decoration: underline; }
`;

const EmptyRow = styled.div`
  padding: 60px;
  text-align: center;
  color: #666;
  font-size: 14px;
  font-weight: 600;
`;

const JAR_ICON = '🫙';
const DORMANT_ICON = '💤';
const NEVER_ICON = '👤';
const WALLET_ICON = '💰';

// ── Helpers ──
const toMs = (d: any): number => {
  if (!d) return 0;
  if (typeof d.toMillis === 'function') return d.toMillis();
  if (typeof d.toDate === 'function') return d.toDate().getTime();
  if (d instanceof Date) return d.getTime();
  if (typeof d === 'string' || typeof d === 'number') return new Date(d).getTime();
  return 0;
};

const fmtDate = (d: any) => {
  const ms = toMs(d);
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// CSV escape + download helper
const escCSV = (v: any) => {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
};

const buildCSV = (headers: string[], rows: (string | number)[][]): string =>
  [headers.map(escCSV).join(','), ...rows.map(r => r.map(escCSV).join(','))].join('\n');

const downloadFile = (content: string, filename: string, mime = 'text/csv') => {
  const blob = new Blob(['\ufeff' + content], { type: `${mime};charset=utf-8;` });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};

const openGoogleSheets = (content: string) => {
  // Copy CSV to clipboard then open Google Sheets new spreadsheet
  navigator.clipboard.writeText(content).then(() => {
    alert('📋 Data copied to clipboard!\n\nNow paste it into the Google Sheet that will open.');
    window.open('https://sheets.new', '_blank');
  }).catch(() => {
    window.open('https://sheets.new', '_blank');
  });
};

const TODAY = new Date();
const ONE_MONTH_AGO = new Date(TODAY.getTime() - 30 * 24 * 60 * 60 * 1000);

interface RawUser {
  id: string;
  customerId?: string;
  full_name?: string;
  name?: string;
  phone?: string;
  phoneNumber?: string;
  email?: string;
  wallet_balance?: number;
  jars_occupied?: number;
  createdAt?: any;
  [k: string]: any;
}

interface RawAddr {
  id: string;
  userId?: string;
  address_line?: string;
  address_type?: string;
  isDefault?: boolean;
}

interface RawOrder {
  id: string;
  userId?: string;
  status?: string;
  createdAt?: any;
  total?: number;
  amount?: number;
}

function OperationalIntelligence() {
  const [users, setUsers]     = useState<RawUser[]>([]);
  const [addresses, setAddresses] = useState<RawAddr[]>([]);
  const [orders, setOrders]   = useState<RawOrder[]>([]);
  const [ready, setReady]     = useState(false);

  useEffect(() => {
    let c = 0;
    const done = () => { c++; if (c === 3) setReady(true); };
    const u1 = subscribeToCollection('users',     s => { setUsers(s.docs.map(d => ({ id: d.id, ...d.data() } as RawUser)));     done(); });
    const u2 = subscribeToCollection('addresses', s => { setAddresses(s.docs.map(d => ({ id: d.id, ...d.data() } as RawAddr))); done(); });
    const u3 = subscribeToCollection('orders',    s => { setOrders(s.docs.map(d => ({ id: d.id, ...d.data() } as RawOrder)));   done(); });
    return () => { u1(); u2(); u3(); };
  }, []);

  // ── Derived datasets ──
  const userOrderMap = React.useMemo(() => {
    const m: Record<string, RawOrder[]> = {};
    orders.forEach(o => { if (o.userId) { m[o.userId] = m[o.userId] || []; m[o.userId].push(o); } });
    return m;
  }, [orders]);

  const userAddrMap = React.useMemo(() => {
    const m: Record<string, RawAddr[]> = {};
    addresses.forEach(a => { if (a.userId) { m[a.userId] = m[a.userId] || []; m[a.userId].push(a); } });
    return m;
  }, [addresses]);

  // 1️⃣ Jars on hold
  const jarsOnHold = React.useMemo(() =>
    users
      .filter(u => (u.jars_occupied || 0) > 0)
      .sort((a, b) => (b.jars_occupied || 0) - (a.jars_occupied || 0)),
  [users]);

  // 2️⃣ Never ordered
  const neverOrdered = React.useMemo(() =>
    users.filter(u => !(userOrderMap[u.id]?.length)).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt)),
  [users, userOrderMap]);

  // 3️⃣ Dormant >30 days (had orders but last was >30 days ago)
  const dormant30 = React.useMemo(() =>
    users.filter(u => {
      const ords = userOrderMap[u.id];
      if (!ords?.length) return false;
      const lastMs = Math.max(...ords.map(o => toMs(o.createdAt)));
      return lastMs > 0 && lastMs < ONE_MONTH_AGO.getTime();
    }).map(u => {
      const ords = userOrderMap[u.id];
      const lastMs = Math.max(...ords!.map(o => toMs(o.createdAt)));
      const daysSince = Math.floor((TODAY.getTime() - lastMs) / 86400000);
      return { ...u, daysSince, lastOrderDate: new Date(lastMs) };
    }).sort((a, b) => b.daysSince - a.daysSince),
  [users, userOrderMap]);

  // 4️⃣ Wallet overview
  const walletUsers = React.useMemo(() =>
    users.filter(u => (u.wallet_balance || 0) > 0).sort((a, b) => (b.wallet_balance || 0) - (a.wallet_balance || 0)),
  [users]);
  const totalWalletBalance = walletUsers.reduce((s, u) => s + (u.wallet_balance || 0), 0);

  // ── Name helper ──
  const uName = (u: RawUser) => u.full_name || u.name || u.email || u.customerId || u.id;
  const uPhone = (u: RawUser) => u.phone || u.phoneNumber || '—';
  const uAddr = (u: RawUser) => {
    const addrs = userAddrMap[u.id] || [];
    const def = addrs.find(a => a.isDefault) || addrs[0];
    return def?.address_line || '—';
  };
  const uOrders = (u: RawUser) => userOrderMap[u.id]?.length || 0;

  // ── Export functions ──
  const exportJars = () => {
    const headers = ['Customer ID', 'Name', 'Phone', 'Email', 'Jars On Hold', 'Default Address', 'Total Orders', 'Joined'];
    const rows = jarsOnHold.map(u => [u.customerId || u.id, uName(u), uPhone(u), u.email || '', u.jars_occupied || 0, uAddr(u), uOrders(u), fmtDate(u.createdAt)]);
    downloadFile(buildCSV(headers, rows), `hydrant_jars_on_hold_${new Date().toISOString().slice(0,10)}.csv`);
  };

  const exportNeverOrdered = () => {
    const headers = ['Customer ID', 'Name', 'Phone', 'Email', 'Wallet Balance (₹)', 'Default Address', 'Joined'];
    const rows = neverOrdered.map(u => [u.customerId || u.id, uName(u), uPhone(u), u.email || '', u.wallet_balance || 0, uAddr(u), fmtDate(u.createdAt)]);
    downloadFile(buildCSV(headers, rows), `hydrant_never_ordered_${new Date().toISOString().slice(0,10)}.csv`);
  };

  const exportDormant = () => {
    const headers = ['Customer ID', 'Name', 'Phone', 'Email', 'Days Since Last Order', 'Last Order Date', 'Total Orders', 'Wallet Balance (₹)', 'Default Address'];
    const rows = dormant30.map(u => [u.customerId || u.id, uName(u), uPhone(u), u.email || '', u.daysSince, fmtDate(u.lastOrderDate), uOrders(u), u.wallet_balance || 0, uAddr(u)]);
    downloadFile(buildCSV(headers, rows), `hydrant_dormant_users_${new Date().toISOString().slice(0,10)}.csv`);
  };

  const exportWallet = () => {
    const headers = ['Customer ID', 'Name', 'Phone', 'Email', 'Wallet Balance (₹)', 'Total Orders', 'Default Address'];
    const rows = walletUsers.map(u => [u.customerId || u.id, uName(u), uPhone(u), u.email || '', u.wallet_balance || 0, uOrders(u), uAddr(u)]);
    downloadFile(buildCSV(headers, rows), `hydrant_wallet_balances_${new Date().toISOString().slice(0,10)}.csv`);
  };

  if (!ready) return (
    <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
      Loading operational intelligence…
    </div>
  );

  const totalJarsOnHold = jarsOnHold.reduce((s, u) => s + (u.jars_occupied || 0), 0);

  return (
    <OISection>
      {/* ── 1. Jars On Hold ── */}
      <OICard>
        <OIHead $color="linear-gradient(135deg, #fef9c3, #fef08a)">
          <OITitle>
            {JAR_ICON} Jars On Hold
            <OIBadge $color="#d97706">{jarsOnHold.length} users</OIBadge>
            <OIBadge $color="#92400e">{totalJarsOnHold} total jars</OIBadge>
          </OITitle>
          <ExportBtnRow>
            <ExportBtn $variant="green" onClick={exportJars}>
              ⬇ Download Excel/CSV
            </ExportBtn>
            <ExportBtn $variant="blue" onClick={() => {
              const headers = ['Customer ID', 'Name', 'Phone', 'Email', 'Jars On Hold', 'Default Address', 'Total Orders', 'Joined'];
              const rows = jarsOnHold.map(u => [u.customerId || u.id, uName(u), uPhone(u), u.email || '', u.jars_occupied || 0, uAddr(u), uOrders(u), fmtDate(u.createdAt)]);
              openGoogleSheets(buildCSV(headers, rows));
            }}>
              📊 Open in Google Sheets
            </ExportBtn>
          </ExportBtnRow>
        </OIHead>
        {jarsOnHold.length === 0
          ? <EmptyRow>No users currently holding jars 🎉</EmptyRow>
          : (
          <div style={{ overflowX: 'auto' }}>
            <OITable>
              <thead>
                <tr>
                  <OITh>Customer</OITh>
                  <OITh>Phone</OITh>
                  <OITh>Address</OITh>
                  <OITh style={{ textAlign: 'center' }}>Jars 🫙</OITh>
                  <OITh style={{ textAlign: 'center' }}>Orders</OITh>
                  <OITh>Joined</OITh>
                  <OITh>Actions</OITh>
                </tr>
              </thead>
              <tbody>
                {jarsOnHold.map(u => (
                  <tr key={u.id}>
                    <OITd>
                      <div style={{ fontWeight: 600 }}>{uName(u)}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{u.customerId || u.id}</div>
                    </OITd>
                    <OITd>
                      <CLink href={`tel:${uPhone(u)}`}>{uPhone(u)}</CLink>
                    </OITd>
                    <OITd style={{ maxWidth: 220, fontSize: 11, color: '#475569' }}>{uAddr(u)}</OITd>
                    <OITd style={{ textAlign: 'center' }}>
                      <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 8, padding: '3px 10px', fontWeight: 700, fontSize: 13 }}>
                        {u.jars_occupied}
                      </span>
                    </OITd>
                    <OITd style={{ textAlign: 'center' }}>{uOrders(u)}</OITd>
                    <OITd style={{ fontSize: 11 }}>{fmtDate(u.createdAt)}</OITd>
                    <OITd>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <CLink href={`tel:${uPhone(u)}`} title="Call">📞</CLink>
                        <CLink href={`https://wa.me/${uPhone(u).replace(/\D/g, '')}`} target="_blank" title="WhatsApp">💬</CLink>
                        <CLink href={`/admin/users?customerId=${u.customerId || u.id}`} title="View profile">👤</CLink>
                      </div>
                    </OITd>
                  </tr>
                ))}
              </tbody>
            </OITable>
          </div>
        )}
      </OICard>

      {/* ── 2. Never Ordered ── */}
      <OICard>
        <OIHead $color="linear-gradient(135deg, #fee2e2, #fecaca)">
          <OITitle>
            {NEVER_ICON} Never Ordered
            <OIBadge $color="#dc2626">{neverOrdered.length} users</OIBadge>
          </OITitle>
          <ExportBtnRow>
            <ExportBtn $variant="green" onClick={exportNeverOrdered}>⬇ Download Excel/CSV</ExportBtn>
            <ExportBtn $variant="blue" onClick={() => {
              const headers = ['Customer ID', 'Name', 'Phone', 'Email', 'Wallet Balance (₹)', 'Default Address', 'Joined'];
              const rows = neverOrdered.map(u => [u.customerId || u.id, uName(u), uPhone(u), u.email || '', u.wallet_balance || 0, uAddr(u), fmtDate(u.createdAt)]);
              openGoogleSheets(buildCSV(headers, rows));
            }}>📊 Open in Google Sheets</ExportBtn>
          </ExportBtnRow>
        </OIHead>
        {neverOrdered.length === 0
          ? <EmptyRow>All registered users have placed at least one order! 🎉</EmptyRow>
          : (
          <div style={{ overflowX: 'auto' }}>
            <OITable>
              <thead>
                <tr>
                  <OITh>Customer</OITh>
                  <OITh>Phone</OITh>
                  <OITh>Email</OITh>
                  <OITh>Wallet Balance</OITh>
                  <OITh>Address</OITh>
                  <OITh>Joined</OITh>
                  <OITh>Actions</OITh>
                </tr>
              </thead>
              <tbody>
                {neverOrdered.slice(0, 100).map(u => (
                  <tr key={u.id}>
                    <OITd>
                      <div style={{ fontWeight: 600 }}>{uName(u)}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{u.customerId || u.id}</div>
                    </OITd>
                    <OITd><CLink href={`tel:${uPhone(u)}`}>{uPhone(u)}</CLink></OITd>
                    <OITd style={{ fontSize: 11 }}>{u.email || '—'}</OITd>
                    <OITd>
                      {(u.wallet_balance || 0) > 0
                        ? <span style={{ color: '#059669', fontWeight: 600 }}>₹{u.wallet_balance}</span>
                        : <span style={{ color: '#94a3b8' }}>₹0</span>}
                    </OITd>
                    <OITd style={{ maxWidth: 200, fontSize: 11, color: '#475569' }}>{uAddr(u)}</OITd>
                    <OITd style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDate(u.createdAt)}</OITd>
                    <OITd>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <CLink href={`tel:${uPhone(u)}`} title="Call">📞</CLink>
                        <CLink href={`https://wa.me/${uPhone(u).replace(/\D/g, '')}`} target="_blank" title="WhatsApp">💬</CLink>
                        <CLink href={`/admin/users?customerId=${u.customerId || u.id}`} title="View profile">👤</CLink>
                      </div>
                    </OITd>
                  </tr>
                ))}
              </tbody>
            </OITable>
            {neverOrdered.length > 100 && (
              <div style={{ textAlign: 'center', padding: '10px', fontSize: 12, color: '#64748b' }}>
                Showing 100 of {neverOrdered.length}. Download CSV to see all.
              </div>
            )}
          </div>
        )}
      </OICard>

      {/* ── 3. Dormant users (>30 days no order) ── */}
      <OICard>
        <OIHead $color="linear-gradient(135deg, #ede9fe, #ddd6fe)">
          <OITitle>
            {DORMANT_ICON} Dormant Users — No Order in 30+ Days
            <OIBadge $color="#7c3aed">{dormant30.length} users</OIBadge>
          </OITitle>
          <ExportBtnRow>
            <ExportBtn $variant="green" onClick={exportDormant}>⬇ Download Excel/CSV</ExportBtn>
            <ExportBtn $variant="blue" onClick={() => {
              const headers = ['Customer ID', 'Name', 'Phone', 'Email', 'Days Since Last Order', 'Last Order Date', 'Total Orders', 'Wallet Balance (₹)', 'Default Address'];
              const rows = dormant30.map(u => [u.customerId || u.id, uName(u), uPhone(u), u.email || '', u.daysSince, fmtDate(u.lastOrderDate), uOrders(u), u.wallet_balance || 0, uAddr(u)]);
              openGoogleSheets(buildCSV(headers, rows));
            }}>📊 Open in Google Sheets</ExportBtn>
          </ExportBtnRow>
        </OIHead>
        {dormant30.length === 0
          ? <EmptyRow>All customers ordered within the last 30 days 🎉</EmptyRow>
          : (
          <div style={{ overflowX: 'auto' }}>
            <OITable>
              <thead>
                <tr>
                  <OITh>Customer</OITh>
                  <OITh>Phone</OITh>
                  <OITh style={{ textAlign: 'center' }}>Days Silent</OITh>
                  <OITh>Last Order</OITh>
                  <OITh style={{ textAlign: 'center' }}>Total Orders</OITh>
                  <OITh>Wallet</OITh>
                  <OITh>Actions</OITh>
                </tr>
              </thead>
              <tbody>
                {dormant30.slice(0, 100).map(u => (
                  <tr key={u.id}>
                    <OITd>
                      <div style={{ fontWeight: 600 }}>{uName(u)}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{u.customerId || u.id}</div>
                    </OITd>
                    <OITd><CLink href={`tel:${uPhone(u)}`}>{uPhone(u)}</CLink></OITd>
                    <OITd style={{ textAlign: 'center' }}>
                      <span style={{
                        background: u.daysSince > 90 ? '#fee2e2' : u.daysSince > 60 ? '#fef3c7' : '#ede9fe',
                        color: u.daysSince > 90 ? '#dc2626' : u.daysSince > 60 ? '#d97706' : '#7c3aed',
                        borderRadius: 8, padding: '3px 10px', fontWeight: 700, fontSize: 13,
                        whiteSpace: 'nowrap',
                      }}>
                        {u.daysSince}d
                      </span>
                    </OITd>
                    <OITd style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDate(u.lastOrderDate)}</OITd>
                    <OITd style={{ textAlign: 'center' }}>{uOrders(u)}</OITd>
                    <OITd style={{ color: (u.wallet_balance || 0) > 0 ? '#059669' : '#94a3b8', fontWeight: 500 }}>
                      ₹{u.wallet_balance || 0}
                    </OITd>
                    <OITd>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <CLink href={`tel:${uPhone(u)}`} title="Call">📞</CLink>
                        <CLink href={`https://wa.me/${uPhone(u).replace(/\D/g, '')}`} target="_blank" title="WhatsApp">💬</CLink>
                        <CLink href={`/admin/users?customerId=${u.customerId || u.id}`} title="View profile">👤</CLink>
                      </div>
                    </OITd>
                  </tr>
                ))}
              </tbody>
            </OITable>
            {dormant30.length > 100 && (
              <div style={{ textAlign: 'center', padding: '10px', fontSize: 12, color: '#64748b' }}>
                Showing 100 of {dormant30.length}. Download CSV to see all.
              </div>
            )}
          </div>
        )}
      </OICard>

      {/* ── 4. Wallet Balance Overview ── */}
      <OICard>
        <OIHead $color="linear-gradient(135deg, #d1fae5, #a7f3d0)">
          <OITitle>
            {WALLET_ICON} Wallet Balance Overview
            <OIBadge $color="#059669">{walletUsers.length} users with balance</OIBadge>
            <OIBadge $color="#065f46">₹{totalWalletBalance.toLocaleString('en-IN')} total</OIBadge>
          </OITitle>
          <ExportBtnRow>
            <ExportBtn $variant="green" onClick={exportWallet}>⬇ Download Excel/CSV</ExportBtn>
            <ExportBtn $variant="blue" onClick={() => {
              const headers = ['Customer ID', 'Name', 'Phone', 'Email', 'Wallet Balance (₹)', 'Total Orders', 'Default Address'];
              const rows = walletUsers.map(u => [u.customerId || u.id, uName(u), uPhone(u), u.email || '', u.wallet_balance || 0, uOrders(u), uAddr(u)]);
              openGoogleSheets(buildCSV(headers, rows));
            }}>📊 Open in Google Sheets</ExportBtn>
          </ExportBtnRow>
        </OIHead>
        {walletUsers.length === 0
          ? <EmptyRow>No users with wallet balance</EmptyRow>
          : (
          <div style={{ overflowX: 'auto' }}>
            <OITable>
              <thead>
                <tr>
                  <OITh>#</OITh>
                  <OITh>Customer</OITh>
                  <OITh>Phone</OITh>
                  <OITh>Email</OITh>
                  <OITh style={{ textAlign: 'right' }}>Wallet Balance</OITh>
                  <OITh style={{ textAlign: 'center' }}>Orders</OITh>
                  <OITh>Actions</OITh>
                </tr>
              </thead>
              <tbody>
                {walletUsers.slice(0, 200).map((u, i) => (
                  <tr key={u.id}>
                    <OITd style={{ color: '#94a3b8', fontSize: 11 }}>{i + 1}</OITd>
                    <OITd>
                      <div style={{ fontWeight: 600 }}>{uName(u)}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{u.customerId || u.id}</div>
                    </OITd>
                    <OITd><CLink href={`tel:${uPhone(u)}`}>{uPhone(u)}</CLink></OITd>
                    <OITd style={{ fontSize: 11 }}>{u.email || '—'}</OITd>
                    <OITd style={{ textAlign: 'right' }}>
                      <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: 8, padding: '3px 10px', fontWeight: 700 }}>
                        ₹{(u.wallet_balance || 0).toLocaleString('en-IN')}
                      </span>
                    </OITd>
                    <OITd style={{ textAlign: 'center' }}>{uOrders(u)}</OITd>
                    <OITd>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <CLink href={`tel:${uPhone(u)}`} title="Call">📞</CLink>
                        <CLink href={`https://wa.me/${uPhone(u).replace(/\D/g, '')}`} target="_blank" title="WhatsApp">💬</CLink>
                        <CLink href={`/admin/users?customerId=${u.customerId || u.id}`} title="View profile">👤</CLink>
                      </div>
                    </OITd>
                  </tr>
                ))}
              </tbody>
            </OITable>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569' }}>
              <span>Showing top {Math.min(200, walletUsers.length)} of {walletUsers.length} users with wallet balance</span>
              <span style={{ fontWeight: 700, color: '#059669' }}>Total locked: ₹{totalWalletBalance.toLocaleString('en-IN')}</span>
            </div>
          </div>
        )}
      </OICard>
    </OISection>
  );
}