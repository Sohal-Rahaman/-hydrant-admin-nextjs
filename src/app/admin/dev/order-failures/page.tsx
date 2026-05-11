'use client';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function OrderFailures() {
  const [failures, setFailures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch recent orders and filter for 'cancelled'/'failed' status client-side to avoid index requirement.
    const q = query(
      collection(db, 'orders'),
      orderBy('createdAt', 'desc'),
      limit(200)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const failuresLogs = allOrders.filter((o: any) => ['canceled', 'cancelled', 'failed'].includes(o.status?.toLowerCase()));
      
      const logs = failuresLogs.map(data => {
        return {
          id: data.id,
          customerId: data.customerName || data.userId || 'N/A',
          orderId: data.orderNumber || data.id,
          failureType: data.cancellationReason || data.status || 'Cancelled',
          driverAssigned: !!data.deliveryBoyId,
          paymentStatus: data.paymentStatus || 'Pending',
          gpsFailure: false,
          cancellationReason: data.cancellationReason || 'Admin or User cancelled',
          autoRetry: false,
          time: data.createdAt?.toDate().toLocaleString('en-IN') || new Date().toLocaleString('en-IN'),
        };
      });
      setFailures(logs);
      setLoading(false);
    }, (error) => {
      console.error('Failed to fetch order failures:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const statusColor = (s: string) => ({ paid: '#10b981', failed: '#ef4444', due: '#f59e0b', pending: '#f59e0b' }[s?.toLowerCase()] || '#4b5563');

  return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', padding: '24px', fontFamily: 'monospace' }}>
      <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>📦 Order Failure Logs</h1>
      <p style={{ color: '#4b5563', fontSize: '13px', marginBottom: '24px' }}>Live cancelled and failed orders from production</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { l: 'Total Failures', v: loading ? '...' : failures.length, c: '#ef4444' }, 
          { l: 'GPS Issues', v: '0', c: '#f59e0b' }, 
          { l: 'Driver Issues', v: loading ? '...' : failures.filter(m => !m.driverAssigned).length, c: '#f97316' }, 
          { l: 'Auto-Retried', v: '0', c: '#10b981' }
        ].map((s, i) => (
          <div key={i} style={{ background: '#111827', border: `1px solid ${s.c}30`, borderRadius: '10px', padding: '16px' }}>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>{s.l}</div>
            <div style={{ color: s.c, fontSize: '22px', fontWeight: 800 }}>{s.v}</div>
          </div>
        ))}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading ? (
           <div style={{ color: '#94a3b8', padding: '20px', textAlign: 'center' }}>Loading live data...</div>
        ) : failures.length === 0 ? (
           <div style={{ color: '#10b981', padding: '20px', textAlign: 'center' }}>No order failures found.</div>
        ) : failures.map((m, i) => (
          <div key={i} style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: '#ef4444', fontWeight: 700 }}>{m.orderId}</span>
                <span style={{ background: '#ef444420', color: '#ef4444', padding: '2px 10px', borderRadius: '20px', fontSize: '10px' }}>{m.failureType}</span>
              </div>
              <span style={{ color: '#4b5563', fontSize: '11px' }}>{m.time}</span>
            </div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <span style={{ color: '#4b5563', fontSize: '11px' }}>👤 {m.customerId}</span>
              <span style={{ color: '#4b5563', fontSize: '11px' }}>🚚 Driver: {m.driverAssigned ? '✅' : '❌'}</span>
              <span style={{ color: statusColor(m.paymentStatus), fontSize: '11px', textTransform: 'capitalize' }}>💳 {m.paymentStatus}</span>
              <span style={{ color: '#4b5563', fontSize: '11px' }}>🗺️ GPS: {m.gpsFailure ? '❌ Failed' : '✅ OK'}</span>
              <span style={{ color: '#4b5563', fontSize: '11px' }}>🔁 Auto-Retry: {m.autoRetry ? '✅' : '❌'}</span>
              <span style={{ color: '#94a3b8', fontSize: '11px' }}>Reason: {m.cancellationReason}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
