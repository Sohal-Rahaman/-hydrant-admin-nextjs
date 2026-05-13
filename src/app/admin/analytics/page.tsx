'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { normalizeOrderStatus } from '@/lib/orderStatus';
import styled, { keyframes } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, RadialBarChart, RadialBar
} from 'recharts';
import { subscribeToCollection, Jar } from '@/lib/firebase';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import {
  FiTrendingUp, FiTrendingDown, FiActivity, FiPackage,
  FiUsers, FiDollarSign, FiClock, FiAlertTriangle,
  FiCheckCircle, FiLock, FiPhone, FiShare2, FiDownload,
  FiRefreshCw, FiCalendar, FiMapPin, FiZap, FiInfo
} from 'react-icons/fi';
import { initDataConnect, getFinancialReport } from '@/lib/dataconnect';

// ─── Types ──────────────────────────────────────────────────────────────────

type Range = '7d' | '30d' | '90d' | 'all';

interface Order {
  id: string;
  status: string;
  quantity: number;
  createdAt: any;
  userId?: string;
  items?: { quantity: number }[];
  address?: { pincode?: string };
  deliveryAddress?: { pincode?: string; fullAddress?: string };
  paymentMethod?: string;
}

interface UserDoc {
  id: string;
  name?: string;
  full_name?: string;
  phone?: string;
  phoneNumber?: string;
  wallet_balance?: number;
  walletBalance?: number;
  customerId?: string;
  createdAt?: any;
  jars_occupied?: number;
  customer_status?: 'VISITOR' | 'FREE_CUSTOMER' | 'DEPOSIT_CUSTOMER' | 'PRO_CUSTOMER';
  total_orders?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const toDate = (v: any): Date => {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (typeof v === 'object' && 'toDate' in v) return v.toDate();
  return new Date(v);
};

const getDayStart = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d;
};

const inRange = (dateVal: any, range: Range): boolean => {
  const d = toDate(dateVal);
  if (range === 'all') return true;
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  return d >= getDayStart(days);
};

const fmtCurrency = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

const fmtDate = (d: Date, range: Range) =>
  d.toLocaleDateString('en-IN', range === '7d' ? { weekday: 'short' } : { month: 'short', day: 'numeric' });

const KOLKATA_PINCODES: Record<string, string> = {
  '700001': 'BBD Bagh', '700002': 'Shyambazar', '700003': 'Shyambazar N',
  '700004': 'Beliaghata', '700005': 'Entally', '700006': 'Beniapukur',
  '700007': 'Jorabagan', '700008': 'Kumartuli', '700009': 'Ultadanga',
  '700010': 'Maniktala', '700011': 'Bagmari', '700012': 'Phool Bagan',
  '700013': 'Sealdah', '700014': 'Tiljala', '700015': 'Chetla',
  '700016': 'Chetla S', '700017': 'Ballygunge', '700018': 'Kalighat',
  '700019': 'Bhowanipore', '700020': 'Harish Mukherjee',
  '700021': 'Hastings', '700022': 'Fort William', '700023': 'Ekbalpore',
  '700024': 'Watgunge', '700025': 'Kidderpur', '700026': 'New Alipore',
  '700027': 'Alipore', '700028': 'Tollygunge', '700029': 'Jadavpur',
  '700030': 'Garia', '700031': 'Dhakuria', '700032': 'Rashbehari',
  '700033': 'Bansdroni', '700034': 'Narendrapur', '700035': 'Regent Park',
  '700040': 'Dum Dum', '700041': 'Nager Bazar', '700048': 'Lake Town',
  '700052': 'Salt Lake City', '700054': 'New Town', '700059': 'Rajarhat',
  '700064': 'Dum Dum Cant', '700068': 'Barasat', '700078': 'Baranagar',
  '700089': 'Belgharia', '700090': 'Dakshineswar', '700102': 'Kasba',
  '700103': 'Kankurgachi', '700106': 'Liluah', '700108': 'Howrah',
};

const extractPincode = (order: Order): string => {
  return (
    order.address?.pincode ||
    order.deliveryAddress?.pincode ||
    (order.deliveryAddress?.fullAddress?.match(/\b7\d{5}\b/)?.[0]) ||
    'Unknown'
  );
};

const getPincodeName = (pin: string) =>
  KOLKATA_PINCODES[pin] || (pin !== 'Unknown' ? pin : 'Unknown Area');

// ─── Styled Components ───────────────────────────────────────────────────────

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
`;

const Page = styled.div`
  padding: 24px;
  background: #080c10;
  min-height: 100vh;
  color: #f0f4f8;
  font-family: 'Inter', system-ui, sans-serif;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
  flex-wrap: wrap;
  gap: 16px;
`;

const TitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Title = styled.h1`
  font-size: 22px;
  font-weight: 900;
  color: #f0f4f8;
  margin: 0;
  letter-spacing: -0.03em;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const LiveDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  display: inline-block;
  animation: ${pulse} 2s ease-in-out infinite;
  box-shadow: 0 0 8px rgba(16,185,129,0.6);
`;

const SourceBadge = styled.div<{ $type: 'firestore' | 'postgres' }>`
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 6px;
  border-radius: 4px;
  background: ${p => p.$type === 'postgres' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)'};
  color: ${p => p.$type === 'postgres' ? '#3b82f6' : '#10b981'};
  border: 1px solid ${p => p.$type === 'postgres' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)'};
`;

const Subtitle = styled.p`
  font-size: 13px;
  color: #4a5568;
  margin: 0;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;

const RangeGroup = styled.div`
  display: flex;
  background: #111827;
  border-radius: 10px;
  padding: 3px;
  gap: 2px;
  border: 1px solid #1f2937;
`;

const RangeBtn = styled.button<{ $active: boolean }>`
  padding: 6px 14px;
  border-radius: 7px;
  border: none;
  background: ${p => p.$active ? '#10b981' : 'transparent'};
  color: ${p => p.$active ? '#000' : '#6b7280'};
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { color: ${p => p.$active ? '#000' : '#d1d5db'}; }
`;

const ActionBtn = styled(motion.button)<{ $variant?: 'ghost' | 'solid' }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 9px;
  border: 1px solid ${p => p.$variant === 'ghost' ? '#1f2937' : 'transparent'};
  background: ${p => p.$variant === 'ghost' ? 'transparent' : '#10b981'};
  color: ${p => p.$variant === 'ghost' ? '#6b7280' : '#000'};
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: ${p => p.$variant === 'ghost' ? '#1f2937' : '#059669'}; color: ${p => p.$variant === 'ghost' ? '#f0f4f8' : '#000'}; }
`;

const KpiGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  margin-bottom: 24px;
  @media (min-width: 640px) { grid-template-columns: repeat(4, 1fr); }
  @media (min-width: 1100px) { grid-template-columns: repeat(8, 1fr); }
`;

const KpiCard = styled(motion.div)<{ $accent: string }>`
  background: #0d1117;
  border: 1px solid #161b22;
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
  overflow: hidden;
  transition: border-color 0.2s;
  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: ${p => p.$accent};
  }
  &:hover { border-color: #30363d; }
`;

const KpiIcon = styled.div<{ $color: string }>`
  width: 32px; height: 32px;
  border-radius: 8px;
  background: ${p => p.$color}18;
  display: flex; align-items: center; justify-content: center;
  color: ${p => p.$color};
  font-size: 14px;
`;

const KpiValue = styled.div`
  font-size: 20px;
  font-weight: 900;
  color: #f0f4f8;
  letter-spacing: -0.04em;
  line-height: 1;
`;

const KpiLabel = styled.div`
  font-size: 10px;
  font-weight: 700;
  color: #4a5568;
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

const KpiTrend = styled.div<{ $up: boolean }>`
  font-size: 10px;
  font-weight: 700;
  color: ${p => p.$up ? '#10b981' : '#ef4444'};
  display: flex; align-items: center; gap: 2px;
`;

const ChartsGrid = styled.div`
  display: grid;
  gap: 18px;
  margin-bottom: 18px;
`;

const Row2 = styled.div`
  display: grid;
  gap: 18px;
  @media (min-width: 900px) { grid-template-columns: 1fr 1fr; }
`;

const Row3 = styled.div`
  display: grid;
  gap: 18px;
  @media (min-width: 1100px) { grid-template-columns: 1fr 1fr 1fr; }
`;

const Card = styled(motion.div)`
  background: #0d1117;
  border: 1px solid #161b22;
  border-radius: 18px;
  padding: 24px;
`;

const CardTitle = styled.div`
  font-size: 13px;
  font-weight: 800;
  color: #8b949e;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const TooltipStyle = {
  backgroundColor: 'rgba(13,17,23,0.97)',
  border: '1px solid #30363d',
  borderRadius: '10px',
  color: '#f0f4f8',
  fontSize: '12px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
};

const AxisStyle = { stroke: '#30363d', fontSize: 11 };

// Donut center label
const renderDonutLabel = ({ cx, cy, rate }: { cx: number; cy: number; rate: number }) => (
  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
    <tspan x={cx} dy="-6" fontSize="20" fontWeight="900" fill="#f0f4f8">{rate}%</tspan>
    <tspan x={cx} dy="18" fontSize="10" fill="#4a5568">Circulation</tspan>
  </text>
);

// ─── Delivery Success Ring ────────────────────────────────────────────────────
const SuccessRing = ({ rate }: { rate: number }) => {
  const r = 54; const circ = 2 * Math.PI * r;
  const offset = circ * (1 - rate / 100);
  const color = rate >= 90 ? '#10b981' : rate >= 75 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" style={{ margin: '0 auto', display: 'block' }}>
      <circle cx="70" cy="70" r={r} fill="none" stroke="#161b22" strokeWidth="14" />
      <circle
        cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="14"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 70 70)"
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
      <text x="70" y="66" textAnchor="middle" fontSize="24" fontWeight="900" fill="#f0f4f8">{rate}%</text>
      <text x="70" y="84" textAnchor="middle" fontSize="10" fill="#4a5568">SUCCESS</text>
    </svg>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AnalyticsCommandCenter() {
  const [range, setRange] = useState<Range>('30d');
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [jars, setJars] = useState<Jar[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const [reportSource, setReportSource] = useState<'firestore' | 'postgres'>('firestore');

  // Initialize Data Connect
  useEffect(() => {
    initDataConnect();
  }, []);

  // Subscribe to all three collections
  useEffect(() => {
    const unsub1 = subscribeToCollection('orders', snap => {
      setOrders(snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          status: normalizeOrderStatus(data.status),
          quantity: data.items?.[0]?.quantity ?? data.quantity ?? 1,
          createdAt: data.createdAt,
          userId: data.userId,
          address: data.address,
          deliveryAddress: data.deliveryAddress,
          paymentMethod: data.paymentMethod,
        };
      }));
      setLoading(false);
    }, [], (err) => {
      console.error('❌ Analytics Orders subscription error:', err);
      setLoading(false);
    });
    const unsub2 = subscribeToCollection('users', snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserDoc)));
    }, [], (err) => console.error('❌ Analytics Users subscription error:', err));
    const unsub3 = subscribeToCollection('jars', snap => {
      setJars(snap.docs.map(d => ({ id: d.id, ...d.data() } as Jar)));
    }, [], (err) => console.error('❌ Analytics Jars subscription error:', err));
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  // Fetch PostgreSQL Aggregates if available
  useEffect(() => {
    const fetchAggregates = async () => {
      const report = await getFinancialReport(range);
      if (report) {
        console.log('✅ Using PostgreSQL for financial aggregates');
        setReportSource('postgres');
        // Update local state with aggregated financial data
      }
    };
    fetchAggregates();
  }, [range]);

  // ── Derived Metrics ────────────────────────────────────────────────────────

  const rangedOrders = useMemo(
    () => orders.filter(o => inRange(o.createdAt, range)),
    [orders, range]
  );

  const completedOrders = useMemo(
    () => rangedOrders.filter(o => o.status === 'completed'),
    [rangedOrders]
  );

  // M1 — Revenue
  const totalRevenue = useMemo(
    () => completedOrders.reduce((s, o) => s + o.quantity * 37, 0),
    [completedOrders]
  );

  const todayRevenue = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return orders
      .filter(o => o.status === 'completed' && toDate(o.createdAt) >= today)
      .reduce((s, o) => s + o.quantity * 37, 0);
  }, [orders]);

  // Daily revenue series
  const dailyRevenue = useMemo(() => {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 90;
    return Array.from({ length: Math.min(days, 90) }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const dayOrders = orders.filter(o => {
        const od = toDate(o.createdAt);
        return od >= d && od < next;
      });
      const revenue = dayOrders
        .filter(o => o.status === 'completed')
        .reduce((s, o) => s + o.quantity * 37, 0);
      return {
        date: fmtDate(d, range),
        revenue,
        orders: dayOrders.length,
        delivered: dayOrders.filter(o => o.status === 'completed').length,
      };
    });
  }, [orders, range]);

  // M2 — Jar Circulation
  const lockedJars = useMemo(() => jars.filter(j => j.status === 'locked'), [jars]);
  const availableJars = useMemo(() => jars.filter(j => j.status === 'available'), [jars]);
  const lostJars = useMemo(() => jars.filter(j => j.status === 'lost'), [jars]);
  const overdueJars = useMemo(
    () => lockedJars.filter(j => {
      const d = toDate(j.lastScanAt);
      return (Date.now() - d.getTime()) / 86400000 >= 4;
    }),
    [lockedJars]
  );
  const circulationRate = useMemo(
    () => jars.length > 0 ? Math.round((availableJars.length / jars.length) * 100) : 0,
    [jars, availableJars]
  );
  const jarDonut = useMemo(() => [
    { name: 'In Warehouse', value: availableJars.length, color: '#10b981' },
    { name: 'With Customers', value: lockedJars.length, color: '#3b82f6' },
    { name: 'Reported Lost', value: lostJars.length, color: '#ef4444' },
  ], [availableJars, lockedJars, lostJars]);

  // M3 — Orders by Area
  const areaData = useMemo(() => {
    const map: Record<string, number> = {};
    rangedOrders.forEach(o => {
      const pin = extractPincode(o);
      map[pin] = (map[pin] || 0) + 1;
    });
    return Object.entries(map)
      .map(([pin, count]) => ({ area: getPincodeName(pin), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [rangedOrders]);

  // M4 — Customer Growth
  const newCustomers = useMemo(
    () => users.filter(u => inRange(u.createdAt, range)).length,
    [users, range]
  );

  const customerGrowth = useMemo(() => {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 90;
    return Array.from({ length: Math.min(days, 30) }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (Math.min(days, 30) - 1 - i));
      d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const newC = users.filter(u => {
        const cd = toDate(u.createdAt);
        return cd >= d && cd < next;
      }).length;
      // Returning = users who ordered on that day and had a prior order
      const orderedUserIds = new Set(
        orders.filter(o => { const od = toDate(o.createdAt); return od >= d && od < next; })
          .map(o => o.userId)
      );
      const returning = [...orderedUserIds].filter(uid => {
        if (!uid) return false;
        const userOrders = orders.filter(o => o.userId === uid && toDate(o.createdAt) < d);
        return userOrders.length > 0;
      }).length;
      return { date: fmtDate(d, range), new: newC, returning };
    });
  }, [users, orders, range]);

  // M5 — Wallet Health
  const walletBuckets = useMemo(() => {
    let negative = 0, low = 0, healthy = 0, high = 0;
    users.forEach(u => {
      const b = u.wallet_balance ?? u.walletBalance ?? 0;
      if (b < 0) negative++;
      else if (b < 50) low++;
      else if (b < 500) healthy++;
      else high++;
    });
    return [
      { name: '🔴 Negative', value: negative, color: '#ef4444' },
      { name: '🟡 Low (<₹50)', value: low, color: '#f59e0b' },
      { name: '🟢 Healthy', value: healthy, color: '#10b981' },
      { name: '💎 High (>₹500)', value: high, color: '#3b82f6' },
    ];
  }, [users]);

  const atRiskWalletBalance = useMemo(
    () => users.filter(u => (u.wallet_balance ?? u.walletBalance ?? 0) < 0)
      .reduce((s, u) => s + Math.abs(u.wallet_balance ?? u.walletBalance ?? 0), 0),
    [users]
  );

  // M6 — Delivery Success Rate
  const successRate = useMemo(() => {
    const completed = rangedOrders.filter(o => o.status === 'completed').length;
    const cancelled = rangedOrders.filter(o => o.status === 'cancelled').length;
    const total = completed + cancelled;
    return total > 0 ? Math.round((completed / total) * 100) : 100;
  }, [rangedOrders]);

  // M7 — Jar Return Time Histogram
  const returnTimeHist = useMemo(() => {
    const buckets = [
      { label: '0–1d', min: 0, max: 2, count: 0 },
      { label: '2–3d', min: 2, max: 4, count: 0 },
      { label: '4–5d', min: 4, max: 6, count: 0 },
      { label: '6–7d', min: 6, max: 8, count: 0 },
      { label: '7d+', min: 8, max: Infinity, count: 0 },
    ];
    lockedJars.forEach(j => {
      const days = (Date.now() - toDate(j.lastScanAt).getTime()) / 86400000;
      const bucket = buckets.find(b => days >= b.min && days < b.max);
      if (bucket) bucket.count++;
    });
    return buckets.map(({ label, count }) => ({ label, count }));
  }, [lockedJars]);

  const avgHoldDays = useMemo(() => {
    if (lockedJars.length === 0) return 0;
    const total = lockedJars.reduce((s, j) =>
      s + (Date.now() - toDate(j.lastScanAt).getTime()) / 86400000, 0
    );
    return Math.round(total / lockedJars.length * 10) / 10;
  }, [lockedJars]);

  // M8 — Overdue with owner lookup
  const overdueWithUsers = useMemo(() => {
    const userMap: Record<string, UserDoc> = {};
    users.forEach(u => {
      userMap[u.id] = u;
      if (u.customerId) userMap[u.customerId] = u;
    });
    return overdueJars
      .map(j => {
        const days = Math.floor((Date.now() - toDate(j.lastScanAt).getTime()) / 86400000);
        const u = j.currentOwnerId ? userMap[j.currentOwnerId] : undefined;
        return { jar: j, days, user: u };
      })
      .sort((a, b) => b.days - a.days)
      .slice(0, 10);
  }, [overdueJars, users]);

  // ── M9: Jars On Hold — grouped by user ──────────────────────────────────
  const jarsOnHoldData = useMemo(() => {
    const userMap: Record<string, UserDoc> = {};
    users.forEach(u => {
      userMap[u.id] = u;
      if (u.customerId) userMap[u.customerId] = u;
    });
    // Group locked jars by owner
    const byOwner: Record<string, { user: UserDoc | undefined; jars: Jar[]; maxDays: number }> = {};
    lockedJars.forEach(j => {
      const ownerId = j.currentOwnerId || 'unknown';
      const days = Math.floor((Date.now() - toDate(j.lastScanAt).getTime()) / 86400000);
      if (!byOwner[ownerId]) {
        byOwner[ownerId] = { user: userMap[ownerId], jars: [], maxDays: 0 };
      }
      byOwner[ownerId].jars.push(j);
      if (days > byOwner[ownerId].maxDays) byOwner[ownerId].maxDays = days;
    });
    return Object.entries(byOwner)
      .map(([id, v]) => ({ ownerId: id, ...v }))
      .sort((a, b) => b.jars.length - a.jars.length)
      .slice(0, 20);
  }, [lockedJars, users]);

  const holdDonut = useMemo(() => {
    const counts = { '1 Jar': 0, '2 Jars': 0, '3 Jars': 0, '4+ Jars': 0 };
    jarsOnHoldData.forEach(d => {
      const len = d.jars.length;
      if (len === 1) counts['1 Jar']++;
      else if (len === 2) counts['2 Jars']++;
      else if (len === 3) counts['3 Jars']++;
      else counts['4+ Jars']++;
    });
    return [
      { name: '1 Jar', value: counts['1 Jar'], color: '#10b981' },
      { name: '2 Jars', value: counts['2 Jars'], color: '#3b82f6' },
      { name: '3 Jars', value: counts['3 Jars'], color: '#f59e0b' },
      { name: '4+ Jars', value: counts['4+ Jars'], color: '#ef4444' },
    ];
  }, [jarsOnHoldData]);

  // ── M12: Lifetime Value (LTV) Leaderboard ──────────────────────────────────
  const customerLTV = useMemo(() => {
    const ltvMap: Record<string, { user: UserDoc; completed: number; revenue: number }> = {};
    const userMap: Record<string, UserDoc> = {};
    users.forEach(u => { userMap[u.id] = u; if (u.customerId) userMap[u.customerId] = u; });

    orders.filter(o => o.status === 'completed').forEach(o => {
      const uid = o.userId || '';
      if (!ltvMap[uid]) {
        ltvMap[uid] = { user: userMap[uid] || { id: uid }, completed: 0, revenue: 0 };
      }
      ltvMap[uid].completed++;
      ltvMap[uid].revenue += o.quantity * 37;
    });

    return Object.values(ltvMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 15);
  }, [orders, users]);

  // ── M13: Inventory Forecasting ─────────────────────────────────────────────
  const inventoryForecast = useMemo(() => {
    const days = range === 'all' ? 30 : (range === '7d' ? 7 : range === '30d' ? 30 : 90);
    const totalJarsCount = completedOrders.reduce((s, o) => s + o.quantity, 0);
    const avgDailyJars = totalJarsCount / days;
    const daysLeft = avgDailyJars > 0 ? Math.floor(availableJars.length / avgDailyJars) : Infinity;
    const runOutDate = new Date();
    if (daysLeft !== Infinity && daysLeft < 365) {
      runOutDate.setDate(runOutDate.getDate() + daysLeft);
    } else {
      return { avgDailyJars: Math.round(avgDailyJars * 10) / 10, daysLeft: null, runOutDate: null };
    }
    
    return { avgDailyJars: Math.round(avgDailyJars * 10) / 10, daysLeft, runOutDate };
  }, [completedOrders, availableJars, range]);

  // ── M14: Segmented Churn Analysis (7d / 14d / 30d) ─────────────────────────
  const churnAnalysis = useMemo(() => {
    const now = Date.now();
    const buckets = { active: 0, atRisk: 0, coolingDown: 0, dormant: 0 };

    const userLastOrder: Record<string, number> = {};
    orders.filter(o => o.status === 'completed').forEach(o => {
      const uid = o.userId || '';
      const orderDate = toDate(o.createdAt).getTime();
      if (!userLastOrder[uid] || orderDate > userLastOrder[uid]) {
        userLastOrder[uid] = orderDate;
      }
    });

    users.forEach(u => {
      const last = userLastOrder[u.id];
      if (!last) return;
      const diffDays = (now - last) / 86400000;
      if (diffDays <= 7) buckets.active++;
      else if (diffDays <= 14) buckets.atRisk++;
      else if (diffDays <= 30) buckets.coolingDown++;
      else buckets.dormant++;
    });

    return [
      { name: 'Active (≤7d)', value: buckets.active, color: '#10b981' },
      { name: 'At Risk (7-14d)', value: buckets.atRisk, color: '#f59e0b' },
      { name: 'Cooling (14-30d)', value: buckets.coolingDown, color: '#ef4444' },
      { name: 'Dormant (30d+)', value: buckets.dormant, color: '#1f2937' },
    ];
  }, [users, orders]);

  // ── M15: Customer Segment Breakdown ─────────────────────────────────────────
  const customerSegments = useMemo(() => {
    const segments = {
      PRO_CUSTOMER: 0,
      DEPOSIT_CUSTOMER: 0,
      FREE_CUSTOMER: 0,
      VISITOR: 0
    };
    
    users.forEach(u => {
      const s = u.customer_status || 'VISITOR';
      if (segments[s] !== undefined) segments[s]++;
      else segments.VISITOR++;
    });
    
    return [
      { name: 'PRO Subscribers', value: segments.PRO_CUSTOMER, color: '#EAB308', status: 'PRO_CUSTOMER' },
      { name: 'Deposit Paid', value: segments.DEPOSIT_CUSTOMER, color: '#00E5FF', status: 'DEPOSIT_CUSTOMER' },
      { name: 'Legacy (Free)', value: segments.FREE_CUSTOMER, color: '#A3E635', status: 'FREE_CUSTOMER' },
      { name: 'App Visitors', value: segments.VISITOR, color: '#4a5568', status: 'VISITOR' },
    ];
  }, [users]);

  // URL State Persistence
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('range');
    if (r && ['7d', '30d', '90d', 'all'].includes(r)) setRange(r as Range);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('range', range);
    window.history.replaceState({}, '', url.toString());
  }, [range]);

  // ── M10: Never Ordered ──────────────────────────────────────────────────
  const neverOrderedUsers = useMemo(() => {
    const orderedIds = new Set(orders.map(o => o.userId).filter(Boolean));
    return users
      .filter(u => !orderedIds.has(u.id))
      .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime())
      .slice(0, 20);
  }, [users, orders]);

  const neverOrderedPie = useMemo(() => {
    const total = users.length;
    const never = neverOrderedUsers.length;
    const ordered = total - never;
    return [
      { name: 'Ordered at least once', value: ordered, color: '#10b981' },
      { name: 'Never ordered', value: never, color: '#ef4444' },
    ];
  }, [users.length, neverOrderedUsers.length]);

  // ── M11: Dormant Users — no order in 30+ days ─────────────────────────
  const dormantUsers = useMemo(() => {
    const cutoff = getDayStart(30);
    // find each user's last order date
    const lastOrder: Record<string, Date> = {};
    orders.forEach(o => {
      if (!o.userId) return;
      const d = toDate(o.createdAt);
      if (!lastOrder[o.userId] || d > lastOrder[o.userId]) {
        lastOrder[o.userId] = d;
      }
    });
    const orderedIds = new Set(orders.map(o => o.userId).filter(Boolean));
    return users
      .filter(u => orderedIds.has(u.id) && (lastOrder[u.id] ? lastOrder[u.id] < cutoff : false))
      .map(u => ({
        user: u,
        lastOrderDate: lastOrder[u.id],
        daysSince: Math.floor((Date.now() - (lastOrder[u.id]?.getTime() ?? 0)) / 86400000),
      }))
      .sort((a, b) => b.daysSince - a.daysSince)
      .slice(0, 20);
  }, [users, orders]);

  const dormantTrend = useMemo(() => {
    // 7 buckets: 30–37d, 38–45d, ... 86+d
    const buckets = [
      { label: '30–45d', min: 30, max: 46, count: 0 },
      { label: '46–60d', min: 46, max: 61, count: 0 },
      { label: '61–75d', min: 61, max: 76, count: 0 },
      { label: '76–90d', min: 76, max: 91, count: 0 },
      { label: '90d+', min: 91, max: Infinity, count: 0 },
    ];
    dormantUsers.forEach(({ daysSince }) => {
      const b = buckets.find(bk => daysSince >= bk.min && daysSince < bk.max);
      if (b) b.count++;
    });
    return buckets.map(({ label, count }) => ({ label, count }));
  }, [dormantUsers]);

  // KPI summary cards data
  const kpis = useMemo(() => [
    {
      label: "Today's Revenue", value: fmtCurrency(todayRevenue),
      icon: <FiDollarSign />, color: '#10b981', accent: '#10b981',
      trend: null,
    },
    {
      label: 'Period Revenue', value: fmtCurrency(totalRevenue),
      icon: <FiTrendingUp />, color: '#10b981', accent: '#10b981',
      trend: null,
    },
    {
      label: 'Total Orders', value: rangedOrders.length.toString(),
      icon: <FiPackage />, color: '#3b82f6', accent: '#3b82f6',
      trend: null,
    },
    {
      label: 'Delivered', value: completedOrders.length.toString(),
      icon: <FiCheckCircle />, color: '#10b981', accent: '#10b981',
      trend: null,
    },
    {
      label: 'New Customers', value: newCustomers.toString(),
      icon: <FiUsers />, color: '#8b5cf6', accent: '#8b5cf6',
      trend: null,
    },
    {
      label: 'Success Rate', value: `${successRate}%`,
      icon: <FiActivity />, color: successRate >= 90 ? '#10b981' : '#f59e0b', accent: successRate >= 90 ? '#10b981' : '#f59e0b',
      trend: null,
    },
    {
      label: 'Overdue Jars', value: overdueJars.length.toString(),
      icon: <FiAlertTriangle />, color: overdueJars.length > 0 ? '#ef4444' : '#10b981', accent: overdueJars.length > 0 ? '#ef4444' : '#10b981',
      trend: null,
    },
    {
      label: 'Avg Hold Days', value: `${avgHoldDays}d`,
      icon: <FiClock />, color: avgHoldDays > 4 ? '#f59e0b' : '#10b981', accent: avgHoldDays > 4 ? '#f59e0b' : '#10b981',
      trend: null,
    },
    ...customerSegments.map(s => ({
      label: s.name,
      value: s.value.toLocaleString(),
      icon: s.status === 'PRO_CUSTOMER' ? <FiZap /> : s.status === 'DEPOSIT_CUSTOMER' ? <FiCheckCircle /> : s.status === 'FREE_CUSTOMER' ? <FiPackage /> : <FiUsers />,
      color: s.color,
      accent: s.color,
      trend: null
    }))
  ], [todayRevenue, totalRevenue, rangedOrders, completedOrders, newCustomers, successRate, overdueJars, avgHoldDays, customerSegments]);

  const handleExport = useCallback(() => {
    setCsvLoading(true);
    try {
      const data = orders.map(o => ({
        OrderID: o.id,
        Date: toDate(o.createdAt).toLocaleDateString(),
        Status: o.status,
        Quantity: o.quantity,
        User: o.userId,
        Area: getPincodeName(extractPincode(o)),
        Pincode: extractPincode(o),
        Method: o.paymentMethod || 'COD',
        Total: o.quantity * 37
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "HydrantOrders");
      XLSX.writeFile(wb, `Hydrant_Analytics_${range}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) {
      console.error("Export failed", e);
    } finally {
      setCsvLoading(false);
    }
  }, [orders, range]);

  // Share
  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/admin/analytics?range=${range}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [range]);


  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Page style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div style={{ textAlign: 'center' }}>
          <FiZap size={40} color="#10b981" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#4a5568', marginTop: 16, fontWeight: 700 }}>Loading Command Center...</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      {/* ── Header ── */}
      <Header>
        <TitleGroup>
          <Title>
            <FiActivity color="#10b981" />
            Hydrant Command Center
            <LiveDot title="Live data" />
          </Title>
          <Subtitle>
            Kolkata&apos;s #1 Water Delivery · {orders.length.toLocaleString()} total orders · {users.length.toLocaleString()} customers
          </Subtitle>
        </TitleGroup>
        <Controls>
          <RangeGroup>
            {(['7d', '30d', '90d', 'all'] as Range[]).map(r => (
              <RangeBtn key={r} $active={range === r} onClick={() => setRange(r)}>
                {r === 'all' ? 'All' : r}
              </RangeBtn>
            ))}
          </RangeGroup>
          <ActionBtn $variant="ghost" onClick={handleShare} whileTap={{ scale: 0.96 }}>
            <FiShare2 size={13} /> {copied ? '✓ Copied!' : 'Share'}
          </ActionBtn>
          <ActionBtn onClick={handleExport} disabled={csvLoading} whileTap={{ scale: 0.96 }}>
            {csvLoading ? <FiRefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <FiDownload size={13} />}
            {csvLoading ? 'Exporting...' : 'Export XLS'}
          </ActionBtn>
        </Controls>
      </Header>

      {/* ── KPI Cards ── */}
      <KpiGrid>
        {kpis.map((k, i) => (
          <KpiCard
            key={k.label}
            $accent={k.accent}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <KpiIcon $color={k.color}>{k.icon}</KpiIcon>
            <KpiValue>{k.value}</KpiValue>
            <KpiLabel>{k.label}</KpiLabel>
          </KpiCard>
        ))}
      </KpiGrid>

      {/* ── M1: Revenue Trend ── */}
      <Card
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        style={{ marginBottom: 18 }}
      >
        <CardTitle><FiDollarSign color="#10b981" /> Revenue & Delivery Trend</CardTitle>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={dailyRevenue} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#161b22" />
            <XAxis dataKey="date" tick={AxisStyle} axisLine={false} tickLine={false} />
            <YAxis tick={AxisStyle} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`} />
            <Tooltip
              contentStyle={TooltipStyle}
              formatter={(v: number, name: string) => [
                name === 'revenue' ? fmtCurrency(v) : v,
                name === 'revenue' ? 'Revenue' : 'Deliveries'
              ]}
            />
            <Legend formatter={v => v === 'revenue' ? 'Revenue (₹)' : 'Delivered Orders'} />
            <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2}
              fill="url(#revGrad)" dot={false} activeDot={{ r: 5, fill: '#10b981' }} />
            <Area type="monotone" dataKey="delivered" stroke="#3b82f6" strokeWidth={2}
              fill="url(#ordGrad)" dot={false} activeDot={{ r: 5, fill: '#3b82f6' }} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* ── Row 2: Jar Circulation + Orders by Area ── */}
      <Row2 style={{ marginBottom: 18 }}>
        {/* M2 */}
        <Card initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
          <CardTitle><FiPackage color="#3b82f6" /> Jar Circulation</CardTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie
                  data={jarDonut} cx="50%" cy="50%"
                  innerRadius={55} outerRadius={80}
                  paddingAngle={4} dataKey="value"
                  startAngle={90} endAngle={-270}
                >
                  {jarDonut.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                {renderDonutLabel({ cx: 90, cy: 90, rate: circulationRate })}
                <Tooltip contentStyle={TooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {jarDonut.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color }} />
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#f0f4f8' }}>{d.value}</div>
                    <div style={{ fontSize: 10, color: '#4a5568', fontWeight: 700, textTransform: 'uppercase' }}>{d.name}</div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 4, padding: '8px 12px', background: overdueJars.length > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', borderRadius: 8, border: `1px solid ${overdueJars.length > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}` }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: overdueJars.length > 0 ? '#ef4444' : '#10b981' }}>{overdueJars.length}</div>
                <div style={{ fontSize: 10, color: '#4a5568', fontWeight: 700, textTransform: 'uppercase' }}>Overdue (&gt;4d)</div>
              </div>
            </div>
          </div>
        </Card>

        {/* M3 */}
        <Card initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
          <CardTitle><FiMapPin color="#f59e0b" /> Orders by Area (Kolkata)</CardTitle>
          {areaData.length === 0 ? (
            <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: 13 }}>
              No area data available — enable pincode capture in orders
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={areaData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#161b22" horizontal={false} />
                <XAxis type="number" tick={AxisStyle} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="area" tick={{ ...AxisStyle, fontSize: 10 }} width={90} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TooltipStyle} formatter={(v: number) => [v, 'Orders']} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {areaData.map((_, i) => (
                    <Cell key={i} fill={`rgba(245,158,11,${1 - i * 0.08})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </Row2>

      {/* ── Row 3: Wallet + Customer Growth + Delivery Rate ── */}
      <Row3 style={{ marginBottom: 18 }}>
        {/* M5 */}
        <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
          <CardTitle><FiDollarSign color="#10b981" /> Wallet Balance Health</CardTitle>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={walletBuckets} cx="50%" cy="50%"
                innerRadius={45} outerRadius={70}
                paddingAngle={3} dataKey="value"
              >
                {walletBuckets.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={TooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            {walletBuckets.map(b => (
              <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: b.color, flexShrink: 0 }} />
                <span style={{ color: '#8b949e' }}>{b.name}</span>
                <span style={{ color: '#f0f4f8', fontWeight: 800, marginLeft: 'auto' }}>{b.value}</span>
              </div>
            ))}
          </div>
          {atRiskWalletBalance > 0 && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', fontSize: 11, color: '#fca5a5', fontWeight: 700 }}>
              ⚠️ At-risk dues: {fmtCurrency(atRiskWalletBalance)}
            </div>
          )}
        </Card>

        {/* M4 */}
        <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
          <CardTitle><FiUsers color="#8b5cf6" /> Customer Growth</CardTitle>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={customerGrowth} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#161b22" />
              <XAxis dataKey="date" tick={AxisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={AxisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TooltipStyle} />
              <Legend />
              <Line type="monotone" dataKey="new" stroke="#8b5cf6" strokeWidth={2}
                dot={false} name="New Customers" />
              <Line type="monotone" dataKey="returning" stroke="#10b981" strokeWidth={2}
                dot={false} name="Returning" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* M6 */}
        <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
          <CardTitle><FiCheckCircle color={successRate >= 90 ? '#10b981' : '#f59e0b'} /> Delivery Success Rate</CardTitle>
          <SuccessRing rate={successRate} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 16 }}>
            {[
              { label: 'Delivered', value: completedOrders.length, color: '#10b981' },
              { label: 'Cancelled', value: rangedOrders.filter(o => o.status === 'cancelled').length, color: '#ef4444' },
              { label: 'Active', value: rangedOrders.filter(o => !['completed', 'cancelled'].includes(o.status)).length, color: '#3b82f6' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', padding: '8px', background: '#111827', borderRadius: 8 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: '#4a5568', fontWeight: 700 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </Card>
      </Row3>

      {/* ── Row: Return Time Histogram ── */}
      <Row2 style={{ marginBottom: 18 }}>
        {/* M7 */}
        <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
          <CardTitle><FiClock color="#f59e0b" /> Jar Return Time Distribution</CardTitle>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: avgHoldDays > 4 ? '#f59e0b' : '#10b981' }}>{avgHoldDays}d</span>
            <span style={{ fontSize: 12, color: '#4a5568' }}>average hold time</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={returnTimeHist} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#161b22" />
              <XAxis dataKey="label" tick={AxisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={AxisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TooltipStyle} formatter={(v: number) => [v, 'Jars']} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {returnTimeHist.map((d, i) => (
                  <Cell key={i} fill={
                    d.label === '7d+' ? '#ef4444' :
                    d.label.startsWith('4') || d.label.startsWith('6') ? '#f59e0b' : '#10b981'
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Stats summary */}
        <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
          <CardTitle><FiZap color="#10b981" /> Business Health Summary</CardTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              {
                label: 'Revenue per Order', value: completedOrders.length > 0 ? fmtCurrency(Math.round(totalRevenue / completedOrders.length)) : '₹0',
                color: '#10b981', sub: 'avg ticket value'
              },
              {
                label: 'Jars in Field', value: `${lockedJars.length} / ${jars.length}`,
                color: '#3b82f6', sub: 'deployment ratio'
              },
              {
                label: 'At-Risk Deposit', value: fmtCurrency(overdueJars.length * 800),
                color: overdueJars.length > 5 ? '#ef4444' : '#f59e0b',
                sub: `${overdueJars.length} jars × ₹800 est.`
              },
              {
                label: 'Negative Wallets', value: walletBuckets[0].value.toString(),
                color: walletBuckets[0].value > 10 ? '#ef4444' : '#f59e0b',
                sub: `${fmtCurrency(atRiskWalletBalance)} outstanding`
              },
              {
                label: 'Customer Base', value: users.length.toString(),
                color: '#8b5cf6', sub: `+${newCustomers} this period`
              },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#111827', borderRadius: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#8b949e', fontWeight: 600 }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: '#4a5568' }}>{s.sub}</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </Card>
      </Row2>

      {/* ── M8: Overdue Jars Table ── */}
      {overdueWithUsers.length > 0 && (
        <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          <CardTitle>
            <FiAlertTriangle color="#ef4444" />
            🔴 Overdue Jar Alert — {overdueWithUsers.length} jars requiring follow-up
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#4a5568', fontWeight: 600 }}>
              Est. at-risk deposit: {fmtCurrency(overdueJars.length * 800)}
            </span>
          </CardTitle>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #161b22' }}>
                  {['Jar ID', 'Customer', 'Customer ID', 'Days Held', 'Risk', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#4a5568', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overdueWithUsers.map(({ jar, days, user }) => {
                  const phone = user?.phone || user?.phoneNumber;
                  const waPhone = phone ? phone.replace(/\D/g, '').replace(/^(?!91)/, '91') : '';
                  const isCritical = days >= 7;
                  return (
                    <tr key={jar.id} style={{ borderBottom: '1px solid #161b22', background: isCritical ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                      <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 700, color: '#f0f4f8' }}>{jar.id}</td>
                      <td style={{ padding: '12px', color: '#8b949e' }}>{user?.name || user?.full_name || '—'}</td>
                      <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{user?.customerId || '—'}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                          background: isCritical ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                          color: isCritical ? '#f87171' : '#fbbf24',
                          border: `1px solid ${isCritical ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                        }}>
                          {isCritical ? '🔴' : '🟡'} {days}d
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: isCritical ? '#f87171' : '#fbbf24', fontSize: 12, fontWeight: 700 }}>
                        {isCritical ? 'CRITICAL' : 'OVERDUE'}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {phone && (
                            <a href={`tel:${phone}`}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6, background: '#10b981', color: '#000', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>
                              <FiPhone size={11} /> Call
                            </a>
                          )}
                          {waPhone && (
                            <a
                              href={`https://wa.me/${waPhone}?text=Hi, please return the Hydrant jar ${jar.id} — held for ${days} days. Thank you!`}
                              target="_blank" rel="noreferrer"
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6, background: '#25d366', color: '#000', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>
                              WA
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── M9: Jars On Hold ── */}
      <Card
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        style={{ marginBottom: 18 }}
      >
        <CardTitle>
          <FiLock color="#3b82f6" />
          🫙 Jars On Hold — {lockedJars.length} jars with {jarsOnHoldData.length} customers
        </CardTitle>
        <Row2>
          {/* Donut by quantity */}
          <div>
            <div style={{ fontSize: 12, color: '#4a5568', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Jars Per Customer</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={holdDonut} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                    paddingAngle={4} dataKey="value" startAngle={90} endAngle={-270}>
                    {holdDonut.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <text x="80" y="74" textAnchor="middle" fontSize="20" fontWeight="900" fill="#f0f4f8">{lockedJars.length}</text>
                  <text x="80" y="90" textAnchor="middle" fontSize="9" fill="#4a5568">TOTAL</text>
                  <Tooltip contentStyle={TooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {holdDonut.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color }} />
                    <span style={{ fontSize: 12, color: '#8b949e' }}>{d.name}</span>
                    <span style={{ fontSize: 16, fontWeight: 900, color: '#f0f4f8', marginLeft: 'auto', minWidth: 24, textAlign: 'right' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Top holders list */}
          <div>
            <div style={{ fontSize: 12, color: '#4a5568', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top Jar Holders</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
              {jarsOnHoldData.slice(0, 12).map(({ ownerId, user, jars: held, maxDays }) => {
                const phone = user?.phone || user?.phoneNumber;
                const waPhone = phone ? phone.replace(/\D/g, '').replace(/^(?!91)/, '91') : '';
                const isRisk = maxDays >= 4;
                return (
                  <div key={ownerId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#111827', borderRadius: 9 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: isRisk ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: isRisk ? '#f87171' : '#10b981', flexShrink: 0 }}>
                      {held.length}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#f0f4f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user?.name || user?.full_name || user?.customerId || ownerId.slice(0, 10)}
                      </div>
                      <div style={{ fontSize: 10, color: '#4a5568' }}>Max {maxDays}d hold · {held.length} jar{held.length > 1 ? 's' : ''}</div>
                    </div>
                    {phone && (
                      <a href={`tel:${phone}`} style={{ padding: '4px 10px', borderRadius: 6, background: '#10b981', color: '#000', fontSize: 10, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
                        <FiPhone size={10} />
                      </a>
                    )}
                    {waPhone && (
                      <a href={`https://wa.me/${waPhone}?text=Hi! Please return your Hydrant water jar(s). Thank you!`}
                        target="_blank" rel="noreferrer"
                        style={{ padding: '4px 10px', borderRadius: 6, background: '#25d366', color: '#000', fontSize: 10, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
                        WA
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Row2>
      </Card>

      {/* ── M10 & M11: Never Ordered + Dormant — side by side ── */}
      <Row2 style={{ marginBottom: 18 }}>

        {/* M10: Never Ordered */}
        <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0 }}>
          <CardTitle><FiUsers color="#ef4444" /> Never Ordered — {neverOrderedUsers.length} inactive accounts</CardTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={neverOrderedPie} cx="50%" cy="50%"
                  innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                  {neverOrderedPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={TooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {neverOrderedPie.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: '#8b949e' }}>{d.name}</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#f0f4f8', marginLeft: 6 }}>{d.value}</span>
                </div>
              ))}
              <div style={{ fontSize: 11, color: '#4a5568', marginTop: 4 }}>
                Conversion opportunity: {users.length > 0 ? Math.round((neverOrderedUsers.length / users.length) * 100) : 0}% unconverted
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#4a5568', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recently Joined — Never Ordered</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto' }}>
            {neverOrderedUsers.map(u => {
              const phone = u.phone || u.phoneNumber;
              const waPhone = phone ? phone.replace(/\D/g, '').replace(/^(?!91)/, '91') : '';
              return (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: '#111827', borderRadius: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f0f4f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.name || u.full_name || u.customerId || '—'}
                    </div>
                    <div style={{ fontSize: 10, color: '#4a5568' }}>Joined {toDate(u.createdAt).toLocaleDateString('en-IN')}</div>
                  </div>
                  {phone && (
                    <a href={`tel:${phone}`} style={{ padding: '3px 8px', borderRadius: 5, background: '#10b981', color: '#000', fontSize: 10, fontWeight: 700, textDecoration: 'none' }}>Call</a>
                  )}
                  {waPhone && (
                    <a href={`https://wa.me/${waPhone}?text=Hi! We noticed you haven't placed your first Hydrant water order yet. Try us today! 💧`}
                      target="_blank" rel="noreferrer"
                      style={{ padding: '3px 8px', borderRadius: 5, background: '#25d366', color: '#000', fontSize: 10, fontWeight: 700, textDecoration: 'none' }}>WA</a>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* M11: Dormant Users */}
        <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0 }}>
          <CardTitle><FiClock color="#f59e0b" /> Dormant Users — {dormantUsers.length} no order in 30d+</CardTitle>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={dormantTrend} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#161b22" />
              <XAxis dataKey="label" tick={AxisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={AxisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TooltipStyle} formatter={(v: number) => [v, 'Customers']} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {dormantTrend.map((d, i) => (
                  <Cell key={i} fill={d.label === '90d+' ? '#ef4444' : d.label.startsWith('76') ? '#f59e0b' : '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 12, color: '#4a5568', fontWeight: 700, margin: '12px 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Longest Dormant — Re-engage Now</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto' }}>
            {dormantUsers.map(({ user: u, lastOrderDate, daysSince }) => {
              const phone = u.phone || u.phoneNumber;
              const waPhone = phone ? phone.replace(/\D/g, '').replace(/^(?!91)/, '91') : '';
              const isCritical = daysSince >= 60;
              return (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: '#111827', borderRadius: 8, borderLeft: `3px solid ${isCritical ? '#ef4444' : '#f59e0b'}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f0f4f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.name || u.full_name || u.customerId || '—'}
                    </div>
                    <div style={{ fontSize: 10, color: '#4a5568' }}>Last order {lastOrderDate?.toLocaleDateString('en-IN') || '—'}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 900, color: isCritical ? '#f87171' : '#fbbf24', flexShrink: 0 }}>{daysSince}d</span>
                  {phone && (
                    <a href={`tel:${phone}`} style={{ padding: '3px 8px', borderRadius: 5, background: '#10b981', color: '#000', fontSize: 10, fontWeight: 700, textDecoration: 'none' }}>Call</a>
                  )}
                  {waPhone && (
                    <a href={`https://wa.me/${waPhone}?text=Hi! We miss you at Hydrant 💧 It's been a while since your last order. Ready to reorder?`}
                      target="_blank" rel="noreferrer"
                      style={{ padding: '3px 8px', borderRadius: 5, background: '#25d366', color: '#000', fontSize: 10, fontWeight: 700, textDecoration: 'none' }}>WA</a>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </Row2>

      {/* ── M12, M13, M14: Advanced Intelligence Row ── */}
      <Row3 style={{ marginBottom: 18 }}>
        
        {/* M12: LTV Leaderboard */}
        <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
          <CardTitle><FiTrendingUp color="#10b981" /> LTV Leaderboard — Top 15 Spenders</CardTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
            {customerLTV.map((item, i) => (
              <div key={item.user.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#111827', borderRadius: 10, borderLeft: i < 3 ? '3px solid #10b981' : 'none' }}>
                <div style={{ width: 22, color: '#4a5568', fontSize: 10, fontWeight: 900 }}>#{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#f0f4f8', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {item.user.name || item.user.full_name || item.user.customerId || '—'}
                  </div>
                  <div style={{ fontSize: 9, color: '#4a5568' }}>{item.completed} orders</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#10b981' }}>{fmtCurrency(item.revenue)}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* M13: Inventory Forecasting */}
        <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
          <CardTitle><FiPackage color="#3b82f6" /> Inventory Forecasting</CardTitle>
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: 44, fontWeight: 900, color: inventoryForecast.daysLeft === null ? '#4a5568' : inventoryForecast.daysLeft < 3 ? '#ef4444' : '#3b82f6', letterSpacing: '-2px' }}>
              {inventoryForecast.daysLeft === null ? '—' : inventoryForecast.daysLeft}
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#4a5568', textTransform: 'uppercase', marginBottom: 20 }}>Days of Inventory Remaining</div>
            
            <div style={{ background: '#111827', borderRadius: 14, padding: 16, textAlign: 'left', border: '1px solid #1f2937' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: '#8b949e' }}>Burn Rate</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#f0f4f8' }}>{inventoryForecast.avgDailyJars} jars/day</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: '#8b949e' }}>Critical Threshold</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#ef4444' }}>3 Days left</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#8b949e' }}>Est. Depletion</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#3b82f6' }}>{inventoryForecast.runOutDate?.toLocaleDateString('en-IN') || 'Stable'}</span>
              </div>
            </div>

            <div style={{ marginTop: 24, padding: '12px', borderRadius: 10, background: inventoryForecast.daysLeft && inventoryForecast.daysLeft < 5 ? '#ef444415' : 'transparent', border: inventoryForecast.daysLeft && inventoryForecast.daysLeft < 5 ? '1px solid #ef444433' : 'none' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: inventoryForecast.daysLeft && inventoryForecast.daysLeft < 5 ? '#ef4444' : '#4a5568' }}>
                {inventoryForecast.daysLeft && inventoryForecast.daysLeft < 5 ? '⚠️ REPLENISHMENT REQUIRED' : '✅ INVENTORY LEVELS STABLE'}
              </div>
            </div>
          </div>
        </Card>

        {/* M14: Churn Segmentation */}
        <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}>
          <CardTitle><FiActivity color="#ef4444" /> Churn Segmentation</CardTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={churnAnalysis} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                  {churnAnalysis.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={TooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {churnAnalysis.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color }} />
                  <span style={{ fontSize: 11, color: '#8b949e' }}>{d.name.split(' ')[0]}</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#f0f4f8' }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 14, padding: '10px 14px', background: '#111827', borderRadius: 10, fontSize: 11, color: '#6b7280' }}>
            <FiInfo size={12} style={{ marginRight: 6 }} /> 
            {churnAnalysis[1].value + churnAnalysis[2].value} users reaching "At Risk" phase. Consider a re-engagement campaign.
          </div>
        </Card>
      </Row3>

      {/* ── M15: Customer Mix ── */}
      <Row2 style={{ marginBottom: 18 }}>
        <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}>
          <CardTitle><FiUsers color="var(--color-accent-cyan)" /> Customer Segment Mix (BI)</CardTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: 30, justifyContent: 'center', padding: '20px 0' }}>
            <ResponsiveContainer width={220} height={220}>
              <PieChart>
                <Pie 
                  data={customerSegments} 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={60} 
                  outerRadius={90} 
                  paddingAngle={5} 
                  dataKey="value"
                  animationDuration={1500}
                >
                  {customerSegments.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={TooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {customerSegments.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 4, background: d.color }} />
                  <div>
                    <div style={{ fontSize: 10, color: '#8b949e', fontWeight: 700, textTransform: 'uppercase' }}>{d.name}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#f0f4f8' }}>
                      {d.value} <span style={{ fontSize: 10, color: '#4a5568', fontWeight: 500 }}>({Math.round(d.value / (users.length || 1) * 100)}%)</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}>
          <CardTitle><FiActivity color="#10b981" /> Acquisition vs Retention Trend</CardTitle>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={customerGrowth}>
              <defs>
                <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorRet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="date" {...AxisStyle} />
              <YAxis {...AxisStyle} />
              <Tooltip contentStyle={TooltipStyle} />
              <Area type="monotone" dataKey="new" name="New Customers" stroke="#10b981" fillOpacity={1} fill="url(#colorNew)" strokeWidth={3} />
              <Area type="monotone" dataKey="returning" name="Returning Users" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRet)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </Row2>

      {/* ── M16: Spatial Density Heatmap ── */}
      <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }} style={{ marginBottom: 18 }}>
        <CardTitle><FiMapPin color="#8b5cf6" /> Spatial Density Heatmap — Order Concentration</CardTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {areaData.map((d, i) => {
            const density = Math.round((d.count / (areaData[0]?.count || 1)) * 100);
            return (
              <div key={d.area} style={{ padding: '16px', background: '#111827', border: '1px solid #161b22', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#f0f4f8' }}>{d.area}</div>
                    <div style={{ fontSize: 10, color: '#4a5568' }}>Ranking #{i+1} in Volume</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: density > 60 ? '#8b5cf6' : '#3b82f6' }}>{d.count}</div>
                </div>
                <div style={{ height: 6, background: '#161b22', borderRadius: 3, overflow: 'hidden' }}>
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${density}%` }}
                    transition={{ duration: 1, delay: 1.5 + (i * 0.05) }}
                    style={{ height: '100%', background: `linear-gradient(90deg, #3b82f6, #8b5cf6)`, borderRadius: 3 }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase' }}>
                  <span>Low Density</span>
                  <span>{density}% Concentration</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Footer */}
      <div style={{ marginTop: 32, textAlign: 'center', color: '#1f2937', fontSize: 11, fontWeight: 700 }}>
        HYDRANT INTELLIGENCE NODE · KOLKATA · REAL-TIME DATA · {new Date().toLocaleDateString('en-IN')}
      </div>
    </Page>
  );
}