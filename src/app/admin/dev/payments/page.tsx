'use client';
import { useState, useEffect } from 'react';
import { FiDollarSign, FiSearch, FiDownload, FiRefreshCw, FiFilter, FiCopy, FiEye, FiCheckCircle, FiXCircle, FiClock } from 'react-icons/fi';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const statusColors: Record<string, string> = {
  success: '#10b981', failed: '#ef4444', pending: '#f59e0b', refunded: '#3b82f6'
};

export default function PaymentMonitoring() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'dev_payment_logs'), orderBy('timestamp', 'desc'), limit(100));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const livePayments = snapshot.docs.map(doc => {
        const data = doc.data();
        const payload = data.payload?.payment?.entity || {};
        return {
          id: data.id || doc.id,
          customerId: payload.email || 'N/A',
          customerName: payload.contact || 'N/A',
          orderId: payload.order_id || payload.notes?.subscription_id || 'N/A',
          method: payload.method || 'Razorpay',
          amount: (payload.amount || 0) / 100,
          status: data.status || 'unknown',
          failureReason: payload.error_description || '—',
          time: data.timestamp?.toDate().toLocaleString('en-IN') || new Date().toLocaleString('en-IN'),
        };
      });
      setPayments(livePayments);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching payment logs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filtered = payments.filter(p =>
    (statusFilter === 'all' || p.status === statusFilter) &&
    (search === '' || p.customerId.toLowerCase().includes(search.toLowerCase()) ||
      p.customerName.toLowerCase().includes(search.toLowerCase()) ||
      p.orderId.toLowerCase().includes(search.toLowerCase()))
  );

  const successCount = payments.filter(p => p.status === 'success').length;
  const failedCount = payments.filter(p => p.status === 'failed').length;
  const pendingCount = payments.filter(p => p.status === 'pending').length;

  return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', padding: '24px', fontFamily: 'monospace' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 800, margin: '0 0 4px' }}>💳 Payment Monitoring</h1>
        <p style={{ color: '#4b5563', fontSize: '13px', margin: 0 }}>Live tracking of all Razorpay Webhook events</p>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total Tracked', value: loading ? '...' : payments.length, color: '#3b82f6' },
          { label: 'Success', value: loading ? '...' : successCount, color: '#10b981' },
          { label: 'Failed', value: loading ? '...' : failedCount, color: '#ef4444' },
          { label: 'Pending', value: loading ? '...' : pendingCount, color: '#f59e0b' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#111827', border: `1px solid ${s.color}30`, borderRadius: '10px', padding: '16px' }}>
            <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '4px' }}>{s.label}</div>
            <div style={{ color: s.color, fontSize: '22px', fontWeight: 800 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#111827', border: '1px solid #1f2937', borderRadius: '8px', padding: '8px 12px', flex: '1', minWidth: '200px' }}>
          <FiSearch size={14} color="#4b5563" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by Contact, Email, Order ID..." style={{ background: 'none', border: 'none', outline: 'none', color: '#e5e7eb', fontSize: '13px', flex: 1 }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '8px', padding: '8px 12px', color: '#e5e7eb', fontSize: '13px', cursor: 'pointer' }}>
          <option value="all">All Status</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>
        <button style={{ background: '#10b981', border: 'none', borderRadius: '8px', padding: '8px 16px', color: '#fff', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FiDownload size={14} /> Export CSV
        </button>
      </div>

      {/* Table */}
      <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1f2937' }}>
                {['Payment ID', 'Contact/Email', 'Order ID', 'Method', 'Amount', 'Status', 'Failure Reason', 'Time', 'Actions'].map(h => (
                  <th key={h} style={{ color: '#4b5563', fontWeight: 600, padding: '12px 16px', textAlign: 'left', whiteSpace: 'nowrap', letterSpacing: '0.5px', fontSize: '11px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Loading live payment data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '20px', textAlign: 'center', color: '#10b981' }}>No payments found.</td></tr>
              ) : filtered.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #1f293720' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#1f2937')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '10px 16px', color: '#00e5ff' }}>{p.id}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ color: '#e5e7eb' }}>{p.customerId}</div>
                    <div style={{ color: '#4b5563', fontSize: '11px' }}>{p.customerName}</div>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{p.orderId}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ background: '#1f2937', borderRadius: '4px', padding: '2px 8px', color: '#e5e7eb' }}>{p.method}</span>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#fff', fontWeight: 700 }}>₹{p.amount}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ background: `${statusColors[p.status] || '#94a3b8'}18`, color: statusColors[p.status] || '#94a3b8', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, textTransform: 'capitalize' }}>
                      {p.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', color: p.failureReason !== '—' ? '#ef4444' : '#4b5563', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.failureReason}</td>
                  <td style={{ padding: '10px 16px', color: '#4b5563', whiteSpace: 'nowrap' }}>{p.time}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button title="View Details" style={{ background: '#3b82f620', border: 'none', borderRadius: '4px', padding: '4px 6px', cursor: 'pointer', color: '#3b82f6' }}><FiEye size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
