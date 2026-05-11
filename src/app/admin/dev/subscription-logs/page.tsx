'use client';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const eventColors: Record<string, string> = { 
  'subscription.authenticated': '#10b981', 
  'subscription.activated': '#3b82f6', 
  'subscription.charged': '#8b5cf6', 
  'subscription.halted': '#ef4444', 
  'subscription.cancelled': '#f97316', 
  'subscription.completed': '#06b6d4' 
};

export default function SubscriptionLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We can't use startsWith directly in Firestore without a range hack, 
    // but we know we log all razorpay events to dev_payment_logs.
    // For now, we fetch recent events and filter in client if we can't filter server-side easily,
    // or just fetch 100 recent payment logs and filter for subscription events.
    const q = query(
      collection(db, 'dev_payment_logs'),
      orderBy('timestamp', 'desc'),
      limit(200)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const subLogs = allLogs.filter((log: any) => log.event && log.event.startsWith('subscription.'));
      
      const formatted = subLogs.map(log => {
        const payload = log.payload?.subscription?.entity || {};
        return {
          id: payload.id || log.id,
          customerId: payload.notes?.userId || 'N/A',
          name: payload.notes?.customerName || 'User',
          type: payload.notes?.planId || 'Unknown Plan',
          event: log.event,
          status: payload.status || 'unknown',
          renewalDate: payload.current_end ? new Date(payload.current_end * 1000).toLocaleDateString('en-IN') : '—',
          expiredDate: payload.ended_at ? new Date(payload.ended_at * 1000).toLocaleDateString('en-IN') : '—',
          autoRenewal: payload.cancel_at_period_end === 0,
          time: log.timestamp?.toDate().toLocaleString('en-IN') || new Date().toLocaleString('en-IN'),
        };
      });
      setLogs(formatted);
      setLoading(false);
    }, (error) => {
      console.error('Failed to fetch subscription logs:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const activeCount = logs.filter(l => l.event === 'subscription.authenticated' || l.event === 'subscription.activated').length;
  const haltedCount = logs.filter(l => l.event === 'subscription.halted' || l.event === 'subscription.cancelled').length;

  return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', padding: '24px', fontFamily: 'monospace' }}>
      <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>🔁 Subscription Logs</h1>
      <p style={{ color: '#4b5563', fontSize: '13px', marginBottom: '24px' }}>Live subscription lifecycle events from Razorpay</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { l: 'Recent Events', v: loading ? '...' : logs.length, c: '#3b82f6' }, 
          { l: 'Activations', v: loading ? '...' : activeCount, c: '#10b981' }, 
          { l: 'Halted/Cancelled', v: loading ? '...' : haltedCount, c: '#ef4444' }, 
          { l: 'Expiring Soon', v: '0', c: '#f59e0b' }
        ].map((s, i) => (
          <div key={i} style={{ background: '#111827', border: `1px solid ${s.c}30`, borderRadius: '10px', padding: '14px' }}>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>{s.l}</div>
            <div style={{ color: s.c, fontSize: '22px', fontWeight: 800 }}>{s.v}</div>
          </div>
        ))}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading ? (
          <div style={{ color: '#94a3b8', padding: '20px', textAlign: 'center' }}>Loading live data...</div>
        ) : logs.length === 0 ? (
          <div style={{ color: '#10b981', padding: '20px', textAlign: 'center' }}>No subscription events found.</div>
        ) : logs.map((m, i) => (
          <div key={i} style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '10px', padding: '14px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <span style={{ color: '#00e5ff', fontSize: '11px', minWidth: '120px' }}>{m.id}</span>
            <div style={{ minWidth: '120px' }}><div style={{ color: '#e5e7eb', fontSize: '12px' }}>{m.name}</div><div style={{ color: '#4b5563', fontSize: '10px' }}>{m.customerId}</div></div>
            <span style={{ background: '#1f2937', color: '#94a3b8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>{m.type.toUpperCase()}</span>
            <span style={{ background: `${eventColors[m.event] || '#4b5563'}20`, color: eventColors[m.event] || '#4b5563', padding: '2px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 700 }}>
              {m.event.split('.')[1]?.toUpperCase() || m.event}
            </span>
            <span style={{ color: '#4b5563', fontSize: '11px' }}>🗓 Renewal: {m.renewalDate}</span>
            {m.expiredDate !== '—' && <span style={{ color: '#ef4444', fontSize: '11px' }}>Expired: {m.expiredDate}</span>}
            <span style={{ color: m.autoRenewal ? '#10b981' : '#ef4444', fontSize: '11px' }}>Auto: {m.autoRenewal ? '✅' : '❌'}</span>
            <span style={{ color: '#4b5563', fontSize: '11px', marginLeft: 'auto' }}>{m.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
