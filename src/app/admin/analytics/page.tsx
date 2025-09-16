'use client';

import React, { useState, useEffect } from 'react';
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
  FiRefreshCw
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
import { doc, onSnapshot, getFirestore } from 'firebase/firestore';

const AnalyticsContainer = styled.div`
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
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

const AnalyticsLogo = styled(Image)`
  width: 45px;
  height: 45px;
  border-radius: 10px;
  object-fit: cover;
`;

const Title = styled.h1`
  color: #333;
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
`;

const RefreshButton = styled(motion.button)`
  background: linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%);
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(142, 45, 226, 0.4);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const StatsOverview = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
`;

const StatCard = styled(motion.div)<{ color?: string }>`
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
  border: 1px solid #f0f0f0;
  text-align: center;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: ${props => props.color || 'linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%)'};
  }
`;

const StatIcon = styled.div<{ color?: string }>`
  width: 50px;
  height: 50px;
  border-radius: 10px;
  background: ${props => props.color || 'linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%)'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.3rem;
  margin: 0 auto 15px;
`;

const StatValue = styled.div`
  font-size: 1.8rem;
  font-weight: 700;
  color: #333;
  margin-bottom: 5px;
`;

const StatLabel = styled.div`
  color: #666;
  font-size: 0.9rem;
  font-weight: 500;
`;

const ChartsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 30px;
  margin-bottom: 30px;

  @media (min-width: 1200px) {
    grid-template-columns: 2fr 1fr;
  }
`;

const ChartCard = styled(motion.div)`
  background: white;
  padding: 25px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid #f0f0f0;
`;

const ChartTitle = styled.h3`
  color: #333;
  margin: 0 0 20px 0;
  font-size: 1.2rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 25px;
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
  primary: '#8e2de2',
  secondary: '#4a00e0',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6'
};

const PIE_COLORS = ['#8e2de2', '#4a00e0', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

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
          // Fallback to calculation if document doesn't exist
        }
      },
      (error) => {
        console.error('❌ Error subscribing to dashboard stats:', error);
      }
    );

    // Subscribe to orders
    const unsubscribeOrders = subscribeToCollection('orders', (snapshot) => {
      const ordersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt || new Date(),
        status: doc.data().status || 'pending',
        quantity: doc.data().items?.[0]?.quantity || doc.data().quantity || 1,
        amount: doc.data().total || doc.data().amount || 37
      })) as OrderData[];
      
      setOrders(ordersData);
      processOrdersData(ordersData, users);
    });

    // Subscribe to users
    const unsubscribeUsers = subscribeToCollection('users', (snapshot) => {
      const usersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt || new Date()
      })) as UserData[];
      
      setUsers(usersData);
      processOrdersData(orders, usersData);
    });

    setTimeout(() => setLoading(false), 2000);

    return () => {
      unsubscribeStats();
      unsubscribeOrders();
      unsubscribeUsers();
    };
  }, [orders, users]);

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

    // Today&apos;s revenue
    const todayDeliveredOrders = todayOrders.filter(order => order.status === 'delivered');
    const todayDeliveredQuantity = todayDeliveredOrders.reduce((sum, order) => sum + order.quantity, 0);
    const todayRevenue = todayDeliveredQuantity * 37;

    // Processing orders
    const processingOrders = ordersData.filter(order => 
      order.status === 'pending' || order.status === 'processing'
    ).length;

    // Total revenue
    const allDeliveredOrders = ordersData.filter(order => order.status === 'delivered');
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

      const dayDelivered = dayOrders.filter(order => order.status === 'delivered');
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

    // Order status distribution
    const statusCount: Record<string, number> = ordersData.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
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
            src="/logo.jpeg" 
            alt="Hydrant Logo"
            width={45}
            height={45}
          />
          <Title>Analytics Dashboard</Title>
        </TitleSection>
        <RefreshButton
          onClick={refreshData}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <FiRefreshCw />
          Refresh Data
        </RefreshButton>
      </Header>

      <InfoBox>
        <FiActivity />
        <div>
          <strong>📊 Live Analytics - Real-Time KPI Data from Firebase:</strong>
          <br />• <strong>Data Source:</strong> Firebase collection &apos;dashboard_stats/live_metrics&apos;
          <br />• <strong>Today&apos;s Revenue:</strong> Today&apos;s delivered orders quantity × ₹37 per jar
          <br />• <strong>Processing Orders:</strong> Orders with pending or processing status (excludes cancelled/delivered)
          <br />• <strong>New Customers Today:</strong> Users who joined within the last 24 hours
          <br />• <strong>Total Orders:</strong> All orders (open + cancelled + delivered)
          <br />• <strong>Total Users:</strong> Total registered users in Firebase database
          <br />• <strong>Total Revenue:</strong> All delivered orders quantity × ₹37 per jar
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
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorQuantity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={COLORS.success} stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
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
                  backgroundColor: 'white', 
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
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
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip 
                formatter={(value: any, name: any) => [
                  name === 'revenue' ? `₹${value}` : value,
                  name === 'revenue' ? 'Revenue' : 'Delivered Orders'
                ]}
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
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
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
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
    </AnalyticsContainer>
  );
}