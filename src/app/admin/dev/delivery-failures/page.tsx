'use client';
import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const statusColors: Record<string, string> = { Reported: '#f59e0b', Resolved: '#10b981', Escalated: '#ef4444' };

export default function DeliveryFailures() {
  const [failures, setFailures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Query dev_delivery_failures
    const q = query(
      collection(db, 'dev_delivery_failures'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          deliveryId: data.deliveryId || data.orderId || 'Unknown',
          customerId: data.customerId || data.userId || 'N/A',
          deliveryBoyId: data.deliveryBoyId || 'Unassigned',
          gps: data.gps || data.location ? `${data.location?.lat}, ${data.location?.lng}` : 'Not Captured',
          issues: Array.isArray(data.issues) ? data.issues : [data.issue || data.reason || 'Unknown Issue'],
          time: data.timestamp?.toDate().toLocaleString('en-IN') || new Date().toLocaleString('en-IN'),
          status: data.status || 'Reported',
        };
      });
      setFailures(logs);
      setLoading(false);
    }, (error) => {
      console.error('Failed to fetch delivery failures:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', padding: '24px', fontFamily: 'monospace' }}>
      <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>🚚 Delivery Failure Reports</h1>
      <p style={{ color: '#4b5563', fontSize: '13px', marginBottom: '24px' }}>Live tracking of reported delivery issues & GPS coordinates</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {Object.entries(statusColors).map(([s, c]) => (
          <div key={s} style={{ background: '#111827', border: `1px solid ${c}30`, borderRadius: '10px', padding: '14px' }}>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>{s}</div>
            <div style={{ color: c, fontSize: '22px', fontWeight: 800 }}>{loading ? '...' : failures.filter(m => m.status === s).length}</div>
          </div>
        ))}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading ? (
          <div style={{ color: '#94a3b8', padding: '20px', textAlign: 'center' }}>Loading live delivery failure reports...</div>
        ) : failures.length === 0 ? (
          <div style={{ color: '#10b981', padding: '20px', textAlign: 'center' }}>No delivery failures reported recently.</div>
        ) : failures.map((m, i) => (
          <div key={m.id} style={{ background: '#111827', border: `1px solid ${statusColors[m.status] || '#f59e0b'}30`, borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: '#f97316', fontWeight: 700 }}>{m.deliveryId}</span>
                <span style={{ background: `${statusColors[m.status] || '#f59e0b'}20`, color: statusColors[m.status] || '#f59e0b', padding: '2px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 700 }}>{m.status}</span>
              </div>
              <span style={{ color: '#4b5563', fontSize: '11px' }}>{m.time}</span>
            </div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <span style={{ color: '#4b5563', fontSize: '11px' }}>👤 User: {m.customerId}</span>
              <span style={{ color: '#4b5563', fontSize: '11px' }}>🧑‍💼 Driver: {m.deliveryBoyId}</span>
              <span style={{ color: '#00e5ff', fontSize: '11px' }}>📍 {m.gps}</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {m.issues.map((issue: string, j: number) => (
                <span key={j} style={{ background: '#ef444420', color: '#ef4444', padding: '2px 10px', borderRadius: '20px', fontSize: '10px' }}>{issue}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
