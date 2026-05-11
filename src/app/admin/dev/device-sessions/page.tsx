'use client';
import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function DeviceSessions() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Query users collection for device info/sessions if available
    // Fallback to dev_device_sessions
    const q = query(
      collection(db, 'users'), // Using real users collection
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const liveSessions = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          customerId: data.name || data.full_name || 'Unknown User',
          phone: data.phone || 'N/A',
          device: data.deviceInfo?.model || 'Unknown Device',
          os: data.deviceInfo?.os || 'Unknown OS',
          fcmToken: data.fcmToken ? 'Registered' : 'None',
          lastActive: data.updatedAt?.toDate().toLocaleString('en-IN') || data.createdAt?.toDate().toLocaleString('en-IN') || 'Unknown',
          status: 'Active',
        };
      });
      setSessions(liveSessions);
      setLoading(false);
    }, (error) => {
      console.error('Failed to fetch device sessions:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', padding: '24px', fontFamily: 'monospace' }}>
      <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>📱 Device & Session Logs</h1>
      <p style={{ color: '#4b5563', fontSize: '13px', marginBottom: '24px' }}>Live active devices and FCM token registrations</p>
      
      <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead><tr style={{ borderBottom: '1px solid #1f2937' }}>
            {['User ID', 'Name / Phone', 'Device', 'OS', 'FCM Token', 'Status', 'Last Active'].map(h => (
              <th key={h} style={{ color: '#4b5563', fontWeight: 600, padding: '12px 14px', textAlign: 'left', fontSize: '11px' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Loading active sessions...</td></tr>
            ) : sessions.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#10b981' }}>No sessions found.</td></tr>
            ) : sessions.map((m, i) => (
              <tr key={m.id} style={{ borderBottom: '1px solid #1f293720' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1f2937')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '10px 14px', color: '#4b5563', fontSize: '11px' }}>{m.id}</td>
                <td style={{ padding: '10px 14px' }}><div style={{ color: '#e5e7eb' }}>{m.customerId}</div><div style={{ color: '#4b5563', fontSize: '10px' }}>{m.phone}</div></td>
                <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{m.device}</td>
                <td style={{ padding: '10px 14px', color: '#00e5ff' }}>{m.os}</td>
                <td style={{ padding: '10px 14px', color: m.fcmToken === 'Registered' ? '#10b981' : '#4b5563' }}>{m.fcmToken}</td>
                <td style={{ padding: '10px 14px' }}><span style={{ background: '#10b98120', color: '#10b981', padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700 }}>{m.status}</span></td>
                <td style={{ padding: '10px 14px', color: '#4b5563', fontSize: '11px', whiteSpace: 'nowrap' }}>{m.lastActive}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
