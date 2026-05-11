'use client';
import { useState, useEffect } from 'react';
import { FiAlertTriangle, FiSearch } from 'react-icons/fi';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function FailedPayments() {
  const [search, setSearch] = useState('');
  const [failedPayments, setFailedPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We remove the server-side 'where' clause to avoid requiring a composite index.
    // Instead, we fetch recent logs and filter for 'failed' status client-side.
    const q = query(
      collection(db, 'dev_payment_logs'),
      orderBy('timestamp', 'desc'),
      limit(200)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        time: doc.data().timestamp?.toDate().toLocaleString('en-IN') || new Date().toLocaleString('en-IN')
      }));
      
      // Client-side filtering
      const payments = allLogs.filter((log: any) => log.status === 'failed');
      
      setFailedPayments(payments);
      setLoading(false);
    }, (error) => {
      console.error('Failed to fetch failed payments:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filtered = failedPayments.filter(f =>
    (f.payload?.payment?.entity?.email || '').toLowerCase().includes(search.toLowerCase()) || 
    (f.payload?.payment?.entity?.contact || '').includes(search) ||
    (f.payload?.payment?.entity?.error_description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', padding: '24px', fontFamily: 'monospace' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 800, margin: '0 0 4px' }}>❌ Failed Payment Tracker</h1>
          <p style={{ color: '#4b5563', fontSize: '13px', margin: 0 }}>Live failed transactions from Razorpay Webhook</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total Failed (Live)', value: loading ? '...' : failedPayments.length, color: '#ef4444' },
          { label: 'Auto-Retried', value: '0', color: '#f59e0b' },
          { label: 'Support Tickets', value: '0', color: '#3b82f6' },
          { label: 'Auto-Resolved', value: '0', color: '#10b981' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#111827', border: `1px solid ${s.color}30`, borderRadius: '10px', padding: '16px' }}>
            <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '4px' }}>{s.label}</div>
            <div style={{ color: s.color, fontSize: '22px', fontWeight: 800 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#111827', border: '1px solid #1f2937', borderRadius: '8px', padding: '8px 12px', marginBottom: '16px' }}>
        <FiSearch size={14} color="#4b5563" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by email, phone, error..." style={{ background: 'none', border: 'none', outline: 'none', color: '#e5e7eb', fontSize: '13px', flex: 1 }} />
      </div>

      <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1f2937' }}>
                {['Contact', 'Order/Sub ID', 'Gateway', 'Error', 'Code', 'Amount', 'Time', 'Risk', 'Action'].map(h => (
                  <th key={h} style={{ color: '#4b5563', fontWeight: 600, padding: '12px 14px', textAlign: 'left', whiteSpace: 'nowrap', fontSize: '11px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Loading live data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: '20px', textAlign: 'center', color: '#10b981' }}>No failed payments found.</td></tr>
              ) : filtered.map((f, i) => {
                const pmt = f.payload?.payment?.entity || {};
                return (
                  <tr key={f.id} style={{ borderBottom: '1px solid #1f293720' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#1f2937')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 14px', color: '#e5e7eb' }}>
                      {pmt.email}<br/>
                      <span style={{ color: '#4b5563', fontSize: '10px' }}>{pmt.contact}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{pmt.order_id || pmt.notes?.subscription_id || 'N/A'}</td>
                    <td style={{ padding: '10px 14px', color: '#00e5ff' }}>Razorpay</td>
                    <td style={{ padding: '10px 14px', color: '#f87171', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pmt.error_description || 'Unknown Error'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: '#ef444420', color: '#ef4444', padding: '2px 8px', borderRadius: '4px', fontSize: '10px' }}>
                        {pmt.error_code || 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#e5e7eb' }}>₹{(pmt.amount || 0) / 100}</td>
                    <td style={{ padding: '10px 14px', color: '#4b5563', whiteSpace: 'nowrap' }}>{f.time}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: '#f59e0b20', color: '#f59e0b', padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700 }}>
                        MED
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button title="Create Ticket" style={{ background: '#3b82f620', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', color: '#3b82f6', fontSize: '11px' }}>Ticket</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
