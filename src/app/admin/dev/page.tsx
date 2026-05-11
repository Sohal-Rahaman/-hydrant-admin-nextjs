'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiActivity, FiAlertTriangle, FiUsers, FiZap, FiServer, FiDollarSign, FiTruck, FiRefreshCw, FiSmartphone, FiRepeat, FiShield, FiCloud, FiArrowRight, FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { collection, query, onSnapshot, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const devLinks = [
  { href: '/admin/dev/payments', label: 'Payment Monitoring', icon: FiDollarSign, color: '#10b981' },
  { href: '/admin/dev/failed-payments', label: 'Failed Payments', icon: FiAlertTriangle, color: '#ef4444' },
  { href: '/admin/dev/error-logs', label: 'Error Logs', icon: FiZap, color: '#f59e0b' },
  { href: '/admin/dev/api-logs', label: 'API Logs', icon: FiActivity, color: '#3b82f6' },
  { href: '/admin/dev/user-activity', label: 'User Activity', icon: FiUsers, color: '#8b5cf6' },
  { href: '/admin/dev/order-failures', label: 'Order Failures', icon: FiTruck, color: '#ec4899' },
  { href: '/admin/dev/wallet-txns', label: 'Wallet Transactions', icon: FiDollarSign, color: '#14b8a6' },
  { href: '/admin/dev/subscription-logs', label: 'Subscription Logs', icon: FiRepeat, color: '#f97316' },
  { href: '/admin/dev/delivery-failures', label: 'Delivery Failures', icon: FiTruck, color: '#dc2626' },
  { href: '/admin/dev/server-perf', label: 'Server & Performance', icon: FiServer, color: '#06b6d4' },
  { href: '/admin/dev/security-logs', label: 'Security Logs', icon: FiShield, color: '#6366f1' },
  { href: '/admin/dev/notification-logs', label: 'Notification Logs', icon: FiSmartphone, color: '#d946ef' },
  { href: '/admin/dev/refund-logs', label: 'Refund & Penalty Logs', icon: FiRefreshCw, color: '#84cc16' },
  { href: '/admin/dev/db-activity', label: 'Database Activity', icon: FiCloud, color: '#fb923c' },
  { href: '/admin/dev/app-versions', label: 'App Version Monitor', icon: FiSmartphone, color: '#a78bfa' },
  { href: '/admin/dev/device-sessions', label: 'Device & Session Logs', icon: FiSmartphone, color: '#34d399' },
  { href: '/admin/dev/admin-activity', label: 'Admin Activity Logs', icon: FiShield, color: '#fbbf24' },
  { href: '/admin/dev/debug-console', label: 'Debug Console', icon: FiZap, color: '#f43f5e' },
];

// Helper to get start of today
const getStartOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export default function DevDashboard() {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Real-time aggregates
  const [stats, setStats] = useState({
    failedPayments: 0,
    activeUsers: 0,
    apiErrors: 0,
    walletErrors: 0,
    failedDeliveries: 0,
    pendingRefunds: 0,
    appCrashReports: 0,
    suspiciousActivities: 0,
    serverCpu: 42,
  });

  const [dailyOrders, setDailyOrders] = useState([
    { day: 'Mon', orders: 0, success: 0, failed: 0 },
    { day: 'Tue', orders: 0, success: 0, failed: 0 },
    { day: 'Wed', orders: 0, success: 0, failed: 0 },
    { day: 'Thu', orders: 0, success: 0, failed: 0 },
    { day: 'Fri', orders: 0, success: 0, failed: 0 },
    { day: 'Sat', orders: 0, success: 0, failed: 0 },
    { day: 'Sun', orders: 0, success: 0, failed: 0 },
  ]);

  const [liveUsersList, setLiveUsersList] = useState<any[]>([]);
  const [cartActivityList, setCartActivityList] = useState<any[]>([]);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // 1. Failed Payments Today
    const startOfToday = getStartOfToday();
    const q1 = query(collection(db, 'dev_payment_logs'), where('timestamp', '>=', startOfToday));
    const u1 = onSnapshot(q1, (snap) => {
      let fails = 0;
      let refunds = 0;
      snap.forEach(d => {
        const doc = d.data();
        if (doc.event === 'payment.failed') fails++;
        if (doc.status === 'refunded' || doc.event === 'refund.created') refunds++;
      });
      setStats(s => ({ ...s, failedPayments: fails, pendingRefunds: refunds }));
    });

    // 2. Active Users (Users created/updated recently - 5 mins window)
    const fiveMinsAgo = new Date(Date.now() - 5 * 60000);
    const q2 = query(collection(db, 'users'), where('updatedAt', '>=', fiveMinsAgo));
    const u2 = onSnapshot(q2, (snap) => {
      setStats(s => ({ ...s, activeUsers: snap.size }));
      const users: any[] = [];
      snap.forEach(d => users.push({ id: d.id, ...d.data() }));
      setLiveUsersList(users);
    });

    // 3. API Errors
    const q3 = query(collection(db, 'dev_api_logs'), where('status', '>=', 400), limit(100));
    const u3 = onSnapshot(q3, (snap) => {
      setStats(s => ({ ...s, apiErrors: snap.size }));
    });

    // 4. Failed Deliveries
    const q4 = query(collection(db, 'dev_delivery_failures'), where('status', '!=', 'Resolved'), limit(50));
    const u4 = onSnapshot(q4, (snap) => {
      setStats(s => ({ ...s, failedDeliveries: snap.size }));
    });

    // 5. Suspicious Activity
    const q5 = query(collection(db, 'dev_security_logs'), where('resolved', '==', false), limit(50));
    const u5 = onSnapshot(q5, (snap) => {
      setStats(s => ({ ...s, suspiciousActivities: snap.size }));
    });

    // 6. Server Perf
    const q6 = query(collection(db, 'dev_server_perf'), orderBy('timestamp', 'desc'), limit(1));
    const u6 = onSnapshot(q6, (snap) => {
      if (!snap.empty) {
        setStats(s => ({ ...s, serverCpu: snap.docs[0].data().cpu || 0 }));
      }
    });

    // 7. Orders for charts (mocking the history shape with real count for today)
    const q7 = query(collection(db, 'orders'), where('createdAt', '>=', startOfToday));
    const u7 = onSnapshot(q7, (snap) => {
      let success = 0;
      let failed = 0;
      snap.forEach(d => {
        const status = d.data().status;
        if (['Delivered', 'Completed', 'Assigned'].includes(status)) success++;
        if (['Cancelled', 'Failed'].includes(status)) failed++;
      });
      
      const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'short' });
      setDailyOrders(prev => prev.map(d => {
        if (d.day === todayDay) {
          return { ...d, orders: success + failed, success, failed };
        }
        return d;
      }));
    });

    // 8. Live Cart Activity
    const q8 = query(collection(db, 'dev_cart_activity'), orderBy('timestamp', 'desc'), limit(15));
    const u8 = onSnapshot(q8, (snap) => {
      const carts: any[] = [];
      snap.forEach(d => carts.push({ id: d.id, ...d.data() }));
      setCartActivityList(carts);
    });

    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); };
  }, []);

  const statCards = [
    { label: 'Failed Payments Today', value: stats.failedPayments, icon: FiAlertTriangle, color: '#ef4444', trend: 'Live', up: false },
    { label: 'Active Users Right Now', value: stats.activeUsers, icon: FiUsers, color: '#3b82f6', trend: 'Live', up: true },
    { label: 'API Errors (4xx/5xx)', value: stats.apiErrors, icon: FiZap, color: '#f59e0b', trend: 'Live', up: true },
    { label: 'Server CPU', value: `${stats.serverCpu}%`, icon: FiServer, color: '#8b5cf6', trend: 'Live', up: true },
    { label: 'Open Delivery Failures', value: stats.failedDeliveries, icon: FiTruck, color: '#dc2626', trend: 'Live', up: true },
    { label: 'Recent Refunds', value: stats.pendingRefunds, icon: FiRefreshCw, color: '#f97316', trend: 'Live', up: false },
    { label: 'App Crash Reports', value: stats.appCrashReports, icon: FiSmartphone, color: '#14b8a6', trend: 'Clean ✓', up: true },
    { label: 'Suspicious Activities', value: stats.suspiciousActivities, icon: FiShield, color: '#7c3aed', trend: 'Review', up: false },
  ];

  return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', padding: '24px', fontFamily: 'monospace' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', animation: 'pulse 2s infinite' }} />
            <span style={{ color: '#10b981', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>Hydrant Command Center</span>
          </div>
          <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: 800, margin: 0 }}>Development Dashboard</h1>
          <p style={{ color: '#4b5563', margin: '4px 0 0', fontSize: '13px' }}>Real-time monitoring · Logs · Debug · Analytics</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#00e5ff', fontSize: '18px', fontWeight: 700, fontFamily: 'monospace' }}>
            {currentTime.toLocaleTimeString()}
          </div>
          <div style={{ color: '#4b5563', fontSize: '12px' }}>{currentTime.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</div>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {statCards.map((s, i) => (
          <div key={i} style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '3px', height: '100%', background: s.color, borderRadius: '12px 0 0 12px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginLeft: '8px' }}>
              <div>
                <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '6px', letterSpacing: '0.5px' }}>{s.label}</div>
                <div style={{ color: '#fff', fontSize: '24px', fontWeight: 800 }}>{s.value}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                  {s.up ? <FiTrendingUp size={12} color="#10b981" /> : <FiTrendingDown size={12} color="#ef4444" />}
                  <span style={{ color: s.up ? '#10b981' : '#ef4444', fontSize: '11px' }}>{s.trend}</span>
                </div>
              </div>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.icon size={18} color={s.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '32px' }}>
        {/* Daily Orders */}
        <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ color: '#fff', fontSize: '14px', fontWeight: 700, margin: '0 0 16px', letterSpacing: '0.5px' }}>📦 Daily Orders — Success vs Failed (Live for Today)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dailyOrders}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="day" stroke="#4b5563" tick={{ fontSize: 11 }} />
              <YAxis stroke="#4b5563" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="success" fill="#10b981" name="Success" radius={[4, 4, 0, 0]} />
              <Bar dataKey="failed" fill="#ef4444" name="Failed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Live Monitoring Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
        {/* Live Users */}
        <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ color: '#fff', fontSize: '14px', fontWeight: 700, margin: '0 0 16px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', animation: 'pulse 2s infinite' }} />
            🟢 Live Users (Past 5 Mins)
          </h3>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {liveUsersList.length === 0 ? (
              <div style={{ color: '#6b7280', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>No active users in the last 5 minutes.</div>
            ) : (
              liveUsersList.map(u => (
                <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #1f2937' }}>
                  <div>
                    <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>{u.firstName || 'Guest'} {u.lastName || ''}</div>
                    <div style={{ color: '#9ca3af', fontSize: '11px' }}>{u.phone || 'No Phone'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#10b981', fontSize: '11px' }}>Online</div>
                    <div style={{ color: '#6b7280', fontSize: '10px' }}>{u.updatedAt?.toDate ? u.updatedAt.toDate().toLocaleTimeString() : 'Just now'}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cart Activity */}
        <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ color: '#fff', fontSize: '14px', fontWeight: 700, margin: '0 0 16px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 8px #3b82f6', animation: 'pulse 2s infinite' }} />
            🛒 Recent Cart Additions
          </h3>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {cartActivityList.length === 0 ? (
              <div style={{ color: '#6b7280', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>No recent cart activity.</div>
            ) : (
              cartActivityList.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #1f2937' }}>
                  <div>
                    <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>{c.userName || c.userId || 'Unknown User'}</div>
                    <div style={{ color: '#60a5fa', fontSize: '11px' }}>Added: {c.productName || 'Item'} (Qty: {c.quantity || 1})</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#9ca3af', fontSize: '10px' }}>{c.timestamp?.toDate ? c.timestamp.toDate().toLocaleTimeString() : 'Just now'}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* All Dev Modules Grid */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ color: '#fff', fontSize: '16px', fontWeight: 700, margin: '0 0 16px', letterSpacing: '0.5px' }}>
          🗂️ All Live Monitoring Modules
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
          {devLinks.map((link, i) => (
            <button key={i} onClick={() => router.push(link.href)}
              style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s', width: '100%' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = link.color)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#1f2937')}
            >
              <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: `${link.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <link.icon size={16} color={link.color} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#e5e7eb', fontSize: '13px', fontWeight: 600 }}>{link.label}</div>
                <div style={{ color: '#4b5563', fontSize: '11px', marginTop: '2px' }}>Real-time</div>
              </div>
              <FiArrowRight size={14} color="#4b5563" />
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
