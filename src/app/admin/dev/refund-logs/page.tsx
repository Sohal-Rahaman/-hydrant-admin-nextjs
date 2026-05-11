'use client';
import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const sc: Record<string, string> = { Pending: '#f59e0b', Approved: '#3b82f6', Processed: '#10b981', Rejected: '#ef4444' };

export default function RefundLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Query dev_payment_logs (or dedicated refund collection) for refund/penalty events
    const q = query(
      collection(db, 'dev_payment_logs'),
      orderBy('timestamp', 'desc'),
      limit(150)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const liveLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const refundLogs = liveLogs.filter((log: any) => 
        log.event?.includes('refund') || log.status === 'refunded' || log.type === 'penalty'
      );
      
      const formatted = refundLogs.map(log => {
        const payload = log.payload?.refund?.entity || log.payload?.payment?.entity || {};
        return {
          id: payload.id || log.id,
          customerId: payload.email || payload.contact || 'N/A',
          name: payload.contact || 'User',
          reason: payload.reason || log.description || 'Unknown Reason',
          jarPenalty: log.jarPenalty || 0,
          amount: (payload.amount || 0) / 100,
          status: payload.status === 'processed' ? 'Processed' : (payload.status === 'created' ? 'Pending' : (log.status || 'Pending')),
          gatewayRefundId: payload.id || '—',
          approvedBy: log.approvedBy || 'System',
          time: log.timestamp?.toDate().toLocaleString('en-IN') || new Date().toLocaleString('en-IN'),
        };
      });
      setLogs(formatted);
      setLoading(false);
    }, (error) => {
      console.error('Failed to fetch refund logs:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', padding: '24px', fontFamily: 'monospace' }}>
      <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>💸 Refund & Penalty Logs</h1>
      <p style={{ color: '#4b5563', fontSize: '13px', marginBottom: '24px' }}>Live refunds · Jar penalties · Gateway confirmation · Admin approval</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {Object.entries(sc).map(([s, c]) => (
          <div key={s} style={{ background: '#111827', border: `1px solid ${c}30`, borderRadius: '10px', padding: '14px' }}>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>{s}</div>
            <div style={{ color: c, fontSize: '22px', fontWeight: 800 }}>{loading ? '...' : logs.filter(m => m.status === s).length}</div>
          </div>
        ))}
      </div>
      
      <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead><tr style={{ borderBottom: '1px solid #1f2937' }}>
            {['Refund ID', 'Customer', 'Reason', 'Amount', 'Jar Penalty', 'Status', 'Approved By', 'Time'].map(h => (
              <th key={h} style={{ color: '#4b5563', fontWeight: 600, padding: '12px 14px', textAlign: 'left', fontSize: '11px' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Loading live refund logs...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: '#10b981' }}>No refunds or penalties processed recently.</td></tr>
            ) : logs.map((m, i) => (
              <tr key={m.id + i} style={{ borderBottom: '1px solid #1f293720' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1f2937')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '10px 14px', color: '#00e5ff', fontSize: '11px' }}>{m.id}</td>
                <td style={{ padding: '10px 14px' }}><div style={{ color: '#e5e7eb' }}>{m.name}</div><div style={{ color: '#4b5563', fontSize: '10px' }}>{m.customerId}</div></td>
                <td style={{ padding: '10px 14px', color: '#94a3b8', maxWidth: '150px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{m.reason}</td>
                <td style={{ padding: '10px 14px', color: '#10b981', fontWeight: 700 }}>₹{m.amount}</td>
                <td style={{ padding: '10px 14px', color: m.jarPenalty ? '#ef4444' : '#4b5563' }}>{m.jarPenalty ? `₹${m.jarPenalty}` : '—'}</td>
                <td style={{ padding: '10px 14px' }}><span style={{ color: sc[m.status] || '#f59e0b', fontWeight: 700, textTransform: 'capitalize' }}>{m.status}</span></td>
                <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '11px' }}>{m.approvedBy}</td>
                <td style={{ padding: '10px 14px', color: '#4b5563', fontSize: '11px', whiteSpace: 'nowrap' }}>{m.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
