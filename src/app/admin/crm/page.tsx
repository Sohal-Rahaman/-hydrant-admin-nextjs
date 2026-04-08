'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FiPhone, FiMessageCircle, FiBox, FiUsers, FiSearch, FiStar, FiClock, FiDollarSign, FiActivity, FiAlertCircle } from 'react-icons/fi';
import { subscribeToCollection } from '@/lib/firebase';
import UserInsightDrawer from '@/components/UserInsightDrawer';

// Interfaces
interface User {
  id: string;
  customerId?: string;
  name?: string;
  full_name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  phoneNumber?: string;
  email?: string;
  jars_occupied?: number;
  jarHold?: number;
  wallet_balance?: number;
  lastOrderDate?: any;
  createdAt?: any;
  __ltv?: number;
  __totalOrders?: number;
}

interface Order {
  id: string;
  userId?: string;
  customerId?: string;
  total?: number;
  amount?: number;
  status?: string;
  createdAt?: any;
  deliveryDate?: any;
}

const getTimestamp = (dateVal: any) => {
  if (!dateVal) return 0;
  if (typeof dateVal === 'number') return dateVal;
  if (typeof dateVal === 'string') return new Date(dateVal).getTime();
  if (dateVal.toDate) return dateVal.toDate().getTime();
  if (dateVal instanceof Date) return dateVal.getTime();
  return 0;
};

const formatDateSafe = (dateVal: any) => {
  const ts = getTimestamp(dateVal);
  if (!ts) return 'Never';
  const d = new Date(ts);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

const getPhoneForWa = (phone?: string) => {
    if (!phone) return '';
    const cleanPhone = phone.replace(/[^\d]/g, '');
    return cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone;
};

export default function CRMScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'VIP' | 'HEALTHY' | 'AT_RISK' | 'INACTIVE' | 'JAR_RECOVERY'>('VIP');
  
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubUsers = subscribeToCollection('users', (snapshot) => {
      const formatted = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          phoneNumber: d.phoneNumber || d.phone || '',
          wallet_balance: d.wallet_balance ?? d.walletBalance ?? 0,
          jars_occupied: d.jars_occupied ?? d.jarHold ?? d.occupiedJars ?? 0,
        };
      });
      setUsers(formatted as User[]);
      if (orders.length > 0 || formatted.length > 0) setLoading(false);
    });

    const unsubOrders = subscribeToCollection('orders', (snapshot) => {
      const formatted = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(formatted as Order[]);
      if (users.length > 0 || formatted.length > 0) setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubOrders();
    };
  }, []);

  const enrichedUsers = useMemo(() => {
    return users.map(user => {
      const uOrders = orders.filter(o => o.userId === user.id || o.customerId === user.customerId);
      const ltv = uOrders.reduce((sum, o) => sum + (o.total || o.amount || 0), 0);
      return {
        ...user,
        __totalOrders: uOrders.length,
        __ltv: ltv
      };
    });
  }, [users, orders]);

  const segmentation = useMemo(() => {
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const oneMonth = 30 * 24 * 60 * 60 * 1000;

    const vip: User[] = [];
    const healthy: User[] = [];
    const atRisk: User[] = [];
    const inactive: User[] = [];
    const jarRecovery: User[] = [];

    enrichedUsers.forEach(user => {
      const lastOrderTs = getTimestamp(user.lastOrderDate) || getTimestamp(user.createdAt);
      const diff = now - lastOrderTs;
      const ltv = user.__ltv || 0;
      const tOrders = user.__totalOrders || 0;
      const jarsHeld = user.jars_occupied || user.jarHold || 0;

      // JAR RECOVERY (User is inactive but holding jars)
      if (diff > oneMonth && jarsHeld > 0) {
        jarRecovery.push(user);
        return; // Prioritize Jar Recovery
      }

      // VIP (Spent > 5000 OR Orders > 20)
      if (ltv >= 5000 || tOrders >= 20) {
        vip.push(user);
        return;
      }

      // Standard Segments
      if (!lastOrderTs || diff > oneMonth) {
        inactive.push(user);
      } else if (diff > oneWeek) {
        atRisk.push(user);
      } else {
        healthy.push(user);
      }
    });

    return { VIP: vip, HEALTHY: healthy, AT_RISK: atRisk, INACTIVE: inactive, JAR_RECOVERY: jarRecovery };
  }, [enrichedUsers]);

  const metrics = useMemo(() => {
    const totalCollection = orders.reduce((sum, o) => sum + (o.total || o.amount || 0), 0);
    const totalJarsOut = users.reduce((sum, u) => sum + (Number(u.jars_occupied) || Number(u.jarHold) || 0), 0);

    return {
      totalCollection,
      totalJarsOut,
      vipCount: segmentation.VIP.length,
      riskCount: segmentation.AT_RISK.length,
      recoveryCount: segmentation.JAR_RECOVERY.length
    };
  }, [orders, users, segmentation]);

  // Tab Filtering & Search
  let currentSegment = segmentation[activeTab] || [];
  if (search) {
    const q = search.toLowerCase();
    currentSegment = currentSegment.filter(u => {
      const name = (u.full_name || u.name || u.firstName || '').toLowerCase();
      const cId = (u.customerId || '').toLowerCase();
      const phone = (u.phone || u.phoneNumber || '').toLowerCase();
      return name.includes(q) || cId.includes(q) || phone.includes(q);
    });
  }

  // Sorting: We default sort by LTV descending, then by Orders
  currentSegment = currentSegment.sort((a, b) => (b.__ltv || 0) - (a.__ltv || 0));

  const handleWhatsApp = (e: React.MouseEvent, user: User) => {
    e.stopPropagation();
    const phone = user.phone || user.phoneNumber;
    if (!phone) return;
    const p = getPhoneForWa(phone);
    const message = encodeURIComponent(`Hi ${user.full_name || user.name || user.firstName}, Hydrant team here!`);
    window.open(`https://wa.me/${p}?text=${message}`, '_blank');
  };

  const handleCall = (e: React.MouseEvent, user: User) => {
    e.stopPropagation();
    const phone = user.phone || user.phoneNumber;
    if (!phone) return;
    window.open(`tel:${phone.replace(/[^\d+]/g, '')}`, '_self');
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-7xl mx-auto flex flex-col gap-8 font-sans">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-white uppercase flex items-center gap-3">
            <span className="w-2 h-8 bg-cyan-400"></span>
            Hydrant Hub CRM
          </h1>
          <p className="text-gray-500 text-[10px] uppercase tracking-[0.2em] font-bold mt-2">Predictive Retention Engine v3.0</p>
        </div>
        <div className="relative w-full md:w-96">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400" />
          <input
            type="text"
            placeholder="SEARCH_QUERY: NAME | PHONE | ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-5 py-3 pl-12 text-xs font-mono text-zinc-300 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 transition-all placeholder:text-zinc-700"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total LTV', value: `₹${metrics.totalCollection.toLocaleString()}`, icon: <FiDollarSign />, color: 'text-cyan-400', bg: 'bg-cyan-400/5' },
          { label: 'VIP Accounts', value: metrics.vipCount, icon: <FiStar />, color: 'text-lime-400', bg: 'bg-lime-400/5' },
          { label: 'At Risk', value: metrics.riskCount, icon: <FiActivity />, color: 'text-orange-400', bg: 'bg-orange-400/5' },
          { label: 'Jar Recovery', value: metrics.recoveryCount, icon: <FiAlertCircle />, color: 'text-red-500', bg: 'bg-red-500/5' },
        ].map((item, idx) => (
          <motion.div 
            key={idx}
            whileHover={{ y: -2 }} 
            className="bg-zinc-950 p-6 rounded border border-zinc-800 flex items-center gap-5 transition-all hover:border-zinc-700"
          >
            <div className={`w-12 h-12 rounded flex items-center justify-center text-xl ${item.bg} ${item.color} border border-current opacity-80`}>
               {item.icon}
            </div>
            <div>
              <div className="text-2xl font-bold font-mono text-white tracking-tighter">{item.value}</div>
              <div className="text-[9px] text-zinc-500 uppercase tracking-widest font-black mt-1 leading-none">{item.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex gap-1 p-1 bg-zinc-950 rounded border border-zinc-800 overflow-x-auto no-scrollbar">
        {[
          { id: 'VIP', label: 'VIP', count: segmentation.VIP.length, icon: <FiStar/>, activeColor: 'bg-lime-400 text-black', dark: true },
          { id: 'AT_RISK', label: 'RISK', count: segmentation.AT_RISK.length, icon: <FiActivity/>, activeColor: 'bg-orange-500 text-black', dark: true },
          { id: 'JAR_RECOVERY', label: 'RECOVERY', count: segmentation.JAR_RECOVERY.length, icon: <FiAlertCircle/>, activeColor: 'bg-red-500 text-white', dark: true },
          { id: 'HEALTHY', label: 'HEALTHY', count: segmentation.HEALTHY.length, icon: <FiUsers/>, activeColor: 'bg-cyan-400 text-black', dark: true },
          { id: 'INACTIVE', label: 'INACTIVE', count: segmentation.INACTIVE.length, icon: <FiClock/>, activeColor: 'bg-zinc-700 text-white', dark: true },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-3 px-6 py-3 rounded text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? tab.activeColor : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}
          >
            {tab.icon} {tab.label} <span className="opacity-50 font-mono">[{tab.count}]</span>
          </button>
        ))}
      </div>

      <div className="bg-zinc-950 border border-zinc-800 rounded overflow-hidden flex-1 shadow-2xl">
        {loading ? (
          <div className="p-20 text-center flex flex-col items-center">
            <div className="w-6 h-6 border-[2px] border-cyan-400 border-t-transparent rounded-full animate-spin mb-6" />
            <div className="text-zinc-600 text-[10px] uppercase font-black tracking-widest">Hydrating CRM Assets...</div>
          </div>
        ) : currentSegment.length === 0 ? (
          <div className="p-20 text-center text-zinc-700">
            <FiUsers className="text-5xl mx-auto mb-6 opacity-10" />
            <p className="text-[10px] uppercase font-black tracking-widest">Zero signals detected in this cluster</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-zinc-900/50 text-zinc-500 border-b border-zinc-800">
                  <th className="px-8 py-5 font-black uppercase tracking-widest text-[9px]">Entity / Identifier</th>
                  <th className="px-8 py-5 font-black uppercase tracking-widest text-[9px]">Transactions</th>
                  <th className="px-8 py-5 font-black uppercase tracking-widest text-[9px]">LTV Metrics</th>
                  <th className="px-8 py-5 font-black uppercase tracking-widest text-[9px]">Asset Retention</th>
                  <th className="px-8 py-5 font-black uppercase tracking-widest text-[9px]">Signal State</th>
                  <th className="px-8 py-5 font-black uppercase tracking-widest text-[9px] text-right">Comms</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {currentSegment.map((user) => {
                  const name = user.full_name || user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown';
                  return (
                    <tr 
                      key={user.id} 
                      onClick={() => setSelectedUser(user)}
                      className="group hover:bg-zinc-900 transition-colors cursor-pointer"
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-5">
                          <div className="w-10 h-10 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-cyan-400 font-bold text-base group-hover:border-cyan-400/50 transition-all">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-zinc-100 uppercase tracking-tight">{name}</div>
                            <div className="text-[10px] text-zinc-600 font-mono mt-1 opacity-60 group-hover:opacity-100 transition-opacity">ID: {user.customerId || user.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className="font-mono text-zinc-400">
                          {user.__totalOrders || 0} ITEMS
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <span className="font-mono font-bold text-lime-400 tracking-tighter text-sm">₹{user.__ltv?.toLocaleString() || 0}</span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <FiBox className="text-zinc-600"/> 
                          <span className={`font-mono font-bold text-sm ${((user.jars_occupied || 0) > 0) ? 'text-orange-400' : 'text-zinc-700'}`}>
                            {user.jars_occupied || user.jarHold || 0}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-zinc-500 font-mono text-[10px]">
                        Last Signal: {formatDateSafe(user.lastOrderDate)}
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={(e) => handleWhatsApp(e, user)} 
                            className="bg-zinc-900 text-zinc-400 hover:text-lime-400 hover:bg-zinc-800 p-3 rounded transition-all border border-zinc-800 hover:border-lime-400/30"
                          >
                            <FiMessageCircle size={14} />
                          </button>
                          <button 
                            onClick={(e) => handleCall(e, user)} 
                            className="bg-zinc-900 text-zinc-400 hover:text-cyan-400 hover:bg-zinc-800 p-3 rounded transition-all border border-zinc-800 hover:border-cyan-400/30"
                          >
                            <FiPhone size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <UserInsightDrawer 
        isOpen={!!selectedUser} 
        onClose={() => setSelectedUser(null)} 
        user={selectedUser} 
      />

    </div>
  );
}
