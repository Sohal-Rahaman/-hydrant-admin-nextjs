'use client';
import { useState, useEffect } from 'react';
import { FiSearch, FiDollarSign, FiShoppingBag, FiTruck, FiShield, FiCpu, FiPlusCircle, FiRepeat } from 'react-icons/fi';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const actorColors: Record<string, string> = { 
  ADMIN: '#f59e0b', 
  SYSTEM: '#8b5cf6', 
  USER: '#10b981' 
};

const actionIcons: Record<string, any> = {
  ORDER_PLACED: FiShoppingBag,
  ORDER_DELIVERED: FiTruck,
  PAYMENT_RECEIVED: FiDollarSign,
  WALLET_TOPUP: FiPlusCircle,
  REFUND: FiRepeat,
  LOGIN: FiShield,
};

const actionColors: Record<string, string> = {
  ORDER_PLACED: '#3b82f6',
  ORDER_DELIVERED: '#10b981',
  PAYMENT_RECEIVED: '#14b8a6',
  WALLET_TOPUP: '#06b6d4',
  REFUND: '#ef4444',
};

export default function UserActivity() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'admin_activities'),
      orderBy('timestamp', 'desc'),
      limit(150)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => {
        const data = doc.data();
        const details = data.details || '';
        
        // Advanced Parsing Logic
        const amountMatch = details.match(/₹(\d+)/);
        const orderIdMatch = details.match(/(ORD-[A-Z0-9-]+|#[A-Z0-9-]+)/i);
        const paymentMethod = details.toLowerCase().includes('wallet') ? 'WALLET' : 
                             details.toLowerCase().includes('upi') ? 'UPI' : 
                             details.toLowerCase().includes('cash') ? 'CASH' : 
                             details.toLowerCase().includes('razorpay') ? 'RAZORPAY' : null;

        return {
          id: doc.id,
          userId: data.actorId || data.targetId || 'N/A',
          name: data.actorName || (data.actor === 'SYSTEM' ? 'System' : 'Unknown'),
          action: data.action || 'OTHER',
          details: details,
          actorType: data.actor || 'SYSTEM',
          time: data.timestamp?.toDate().toLocaleString('en-IN') || new Date().toLocaleString('en-IN'),
          amount: amountMatch ? amountMatch[0] : null,
          orderId: orderIdMatch ? orderIdMatch[0] : null,
          paymentMethod: paymentMethod,
          isPayment: data.action === 'PAYMENT_RECEIVED' || details.includes('₹') || details.toLowerCase().includes('payment'),
          isOrder: data.action.includes('ORDER'),
          isWallet: details.toLowerCase().includes('wallet'),
        };
      });
      setActivities(logs);
      setLoading(false);
    }, (error) => {
      console.error('Failed to fetch user activity:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filtered = activities.filter(u => {
    const matchesSearch = u.userId.includes(search) || 
                          u.name.toLowerCase().includes(search.toLowerCase()) ||
                          u.action.toLowerCase().includes(search.toLowerCase()) ||
                          u.details.toLowerCase().includes(search.toLowerCase());
    
    if (filter === 'ALL') return matchesSearch;
    if (filter === 'PAYMENTS') return matchesSearch && u.isPayment;
    if (filter === 'ORDERS') return matchesSearch && u.isOrder;
    if (filter === 'WALLET') return matchesSearch && u.isWallet;
    if (filter === 'ADMIN') return matchesSearch && u.actorType === 'ADMIN';
    return matchesSearch;
  });

  return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', padding: '24px', fontFamily: 'monospace' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>👥 User & System Activity Tracker</h1>
        <p style={{ color: '#4b5563', fontSize: '13px', margin: 0 }}>Live global feed of all system, admin, and user actions with financial & order details</p>
      </div>
      
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#111827', border: '1px solid #1f2937', borderRadius: '8px', padding: '8px 12px', flex: 1, minWidth: '300px' }}>
          <FiSearch size={14} color="#4b5563" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search user, ID, order, or action..." style={{ background: 'none', border: 'none', outline: 'none', color: '#e5e7eb', fontSize: '13px', flex: 1 }} />
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {['ALL', 'ORDERS', 'PAYMENTS', 'WALLET', 'ADMIN'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? '#3b82f6' : '#111827',
              color: filter === f ? '#fff' : '#6b7280',
              border: '1px solid #1f2937',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer'
            }}>{f}</button>
          ))}
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading ? (
          <div style={{ color: '#94a3b8', padding: '20px', textAlign: 'center' }}>Loading live activity stream...</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: '#10b981', padding: '20px', textAlign: 'center' }}>No matching activities found.</div>
        ) : filtered.map((u) => {
          const Icon = actionIcons[u.action] || FiCpu;
          return (
            <div key={u.id} style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '10px', padding: '14px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', position: 'relative' }}>
              {/* Actor Tag */}
              <div style={{ position: 'absolute', top: '10px', right: '14px', background: `${actorColors[u.actorType]}20`, color: actorColors[u.actorType], padding: '2px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 800 }}>
                {u.actorType}
              </div>

              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: `${actionColors[u.action] || '#1f2937'}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} color={actionColors[u.action] || '#4b5563'} />
              </div>

              <div style={{ minWidth: '150px' }}>
                <div style={{ color: '#e5e7eb', fontWeight: 700, fontSize: '13px' }}>{u.name}</div>
                <div style={{ color: '#4b5563', fontSize: '10px' }}>{u.userId}</div>
              </div>
              
              <div style={{ flex: 1, minWidth: '300px' }}>
                <div style={{ color: '#00e5ff', fontSize: '10px', fontWeight: 800, marginBottom: '2px' }}>{u.action}</div>
                <div style={{ color: '#94a3b8', fontSize: '12px', lineHeight: '1.4' }}>{u.details}</div>
                
                {/* Granular Detail Tags */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  {u.amount && <span style={{ color: '#10b981', background: '#10b98120', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>{u.amount}</span>}
                  {u.orderId && <span style={{ color: '#3b82f6', background: '#3b82f620', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>{u.orderId}</span>}
                  {u.paymentMethod && <span style={{ color: '#f59e0b', background: '#f59e0b20', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>{u.paymentMethod}</span>}
                </div>
              </div>
              
              <div style={{ textAlign: 'right', minWidth: '100px' }}>
                <div style={{ color: '#4b5563', fontSize: '11px' }}>{u.time}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
