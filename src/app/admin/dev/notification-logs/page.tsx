'use client';
import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const sc: Record<string, string> = { Sent: '#3b82f6', Delivered: '#10b981', Failed: '#ef4444', Opened: '#8b5cf6' };
const tc: Record<string, string> = { Push: '#f59e0b', SMS: '#06b6d4', WhatsApp: '#25D366', Email: '#3b82f6' };

export default function NotificationLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Query dev_notification_logs
    const q = query(
      collection(db, 'dev_notification_logs'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const liveLogs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.channel || 'Push', // 'Push', 'SMS', 'WhatsApp', 'Email'
          content: data.title ? `${data.title} - ${data.body}` : (data.body || data.message || '—'),
          customerId: data.userId || data.target || 'N/A',
          status: data.status || 'Sent',
          opened: !!data.opened,
          time: data.timestamp?.toDate().toLocaleString('en-IN') || new Date().toLocaleString('en-IN'),
        };
      });
      setLogs(liveLogs);
      setLoading(false);
    }, (error) => {
      console.error('Failed to fetch notification logs:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', padding: '24px', fontFamily: 'monospace' }}>
      <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>🔔 Notification Logs</h1>
      <p style={{ color: '#4b5563', fontSize: '13px', marginBottom: '24px' }}>Live Push · SMS · WhatsApp · Email delivery tracking</p>
      
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
            {['ID', 'Type', 'Content', 'Customer', 'Status', 'Opened', 'Time'].map(h => (
              <th key={h} style={{ color: '#4b5563', fontWeight: 600, padding: '12px 14px', textAlign: 'left', fontSize: '11px' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Loading live notification logs...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#10b981' }}>No notifications sent recently.</td></tr>
            ) : logs.map((m) => (
              <tr key={m.id} style={{ borderBottom: '1px solid #1f293720' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1f2937')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '10px 14px', color: '#4b5563', fontSize: '11px' }}>{m.id.slice(0, 10)}...</td>
                <td style={{ padding: '10px 14px' }}><span style={{ background: `${tc[m.type] || '#4b5563'}20`, color: tc[m.type] || '#e5e7eb', padding: '2px 8px', borderRadius: '20px', fontSize: '10px' }}>{m.type}</span></td>
                <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{m.content}</td>
                <td style={{ padding: '10px 14px', color: '#e5e7eb' }}>{m.customerId}</td>
                <td style={{ padding: '10px 14px' }}><span style={{ color: sc[m.status] || '#94a3b8', fontWeight: 700, fontSize: '11px' }}>{m.status}</span></td>
                <td style={{ padding: '10px 14px' }}>{m.opened ? '✅' : '—'}</td>
                <td style={{ padding: '10px 14px', color: '#4b5563', fontSize: '11px', whiteSpace: 'nowrap' }}>{m.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
