'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FiPhone, FiMessageCircle, FiBox, FiUsers, FiSearch, FiStar, FiClock, FiDollarSign, FiActivity, FiAlertCircle } from 'react-icons/fi';
import { subscribeToCollection } from '@/lib/firebase';
import UserInsightDrawer from './UserInsightDrawer';

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
      const formatted = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    <div className="min-h-screen bg-[#0B0E14] text-white p-6 max-w-7xl mx-auto flex flex-col gap-6">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-500">Hydrant Hub CRM</h1>
          <p className="text-gray-400 text-sm mt-1">Predictive analytics and retention engine</p>
        </div>
        <div className="relative w-full md:w-80">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search name, phone, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#151f32] border border-emerald-500/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div whileHover={{ y: -2 }} className="bg-[#151f32] p-5 rounded-2xl border border-emerald-500/10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center text-emerald-400 text-xl">
             <FiDollarSign />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">₹{metrics.totalCollection.toLocaleString()}</div>
            <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold mt-1">Total LTV</div>
          </div>
        </motion.div>
        <motion.div whileHover={{ y: -2 }} className="bg-[#151f32] p-5 rounded-2xl border border-emerald-500/10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center text-yellow-400 text-xl">
             <FiStar />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{metrics.vipCount}</div>
            <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold mt-1">VIP Accounts</div>
          </div>
        </motion.div>
        <motion.div whileHover={{ y: -2 }} className="bg-[#151f32] p-5 rounded-2xl border border-emerald-500/10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center text-orange-400 text-xl">
             <FiActivity />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{metrics.riskCount}</div>
            <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold mt-1">At Risk Users</div>
          </div>
        </motion.div>
        <motion.div whileHover={{ y: -2 }} className="bg-[#151f32] p-5 rounded-2xl border border-emerald-500/10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-pink-500/20 flex items-center justify-center text-red-500 text-xl">
             <FiAlertCircle />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{metrics.recoveryCount}</div>
            <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold mt-1">Jar Recovery</div>
          </div>
        </motion.div>
      </div>

      <div className="flex gap-2 p-1.5 bg-[#151f32] rounded-xl overflow-x-auto custom-scrollbar border border-white/5">
        {[
          { id: 'VIP', label: `VIP (${segmentation.VIP.length})`, icon: <FiStar/>, activeColor: 'bg-emerald-500/20 text-emerald-400' },
          { id: 'AT_RISK', label: `At Risk (${segmentation.AT_RISK.length})`, icon: <FiActivity/>, activeColor: 'bg-orange-500/20 text-orange-400' },
          { id: 'JAR_RECOVERY', label: `Jar Recovery (${segmentation.JAR_RECOVERY.length})`, icon: <FiAlertCircle/>, activeColor: 'bg-red-500/20 text-red-400' },
          { id: 'HEALTHY', label: `Healthy (${segmentation.HEALTHY.length})`, icon: <FiUsers/>, activeColor: 'bg-blue-500/20 text-blue-400' },
          { id: 'INACTIVE', label: `Inactive (${segmentation.INACTIVE.length})`, icon: <FiClock/>, activeColor: 'bg-gray-500/20 text-gray-400' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg whitespace-nowrap text-sm font-semibold transition-all ${activeTab === tab.id ? tab.activeColor : 'text-gray-400 hover:bg-white/5'}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-[#151f32] border border-white/5 rounded-2xl overflow-hidden flex-1">
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
            <div className="text-gray-400 text-sm">Loading CRM Data...</div>
          </div>
        ) : currentSegment.length === 0 ? (
          <div className="p-16 text-center text-gray-500">
            <FiUsers className="text-4xl mx-auto mb-4 opacity-50" />
            <p>No users found in this segment</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-white/[0.02] text-gray-400 border-b border-white/5">
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Customer</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Orders</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">LTV</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Jars</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Last Order</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentSegment.map((user) => {
                  const name = user.full_name || user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown';
                  return (
                    <tr 
                      key={user.id} 
                      onClick={() => setSelectedUser(user)}
                      className="border-b border-white/5 hover:bg-white/[0.03] transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white">{name}</div>
                            <div className="text-xs text-gray-500 font-mono mt-0.5">{user.customerId || user.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-white/5 px-2.5 py-1 rounded-md text-gray-300 font-mono border border-white/5 text-xs">
                          {user.__totalOrders || 0} dicts
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-emerald-400">₹{user.__ltv?.toLocaleString() || 0}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <FiBox className="text-gray-500"/> 
                          <span className={`${(user.jars_occupied || 0) > 0 ? 'text-orange-400 font-bold' : 'text-gray-400'}`}>
                            {user.jars_occupied || user.jarHold || 0}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        {formatDateSafe(user.lastOrderDate)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={(e) => handleWhatsApp(e, user)} 
                            className="bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 p-2.5 rounded-lg border border-[#25D366]/20 transition-colors"
                          >
                            <FiMessageCircle />
                          </button>
                          <button 
                            onClick={(e) => handleCall(e, user)} 
                            className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 p-2.5 rounded-lg border border-blue-500/20 transition-colors"
                          >
                            <FiPhone />
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
