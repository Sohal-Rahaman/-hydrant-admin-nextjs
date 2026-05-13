'use client';
import { useState, useEffect } from 'react';
import { FiShield } from 'react-icons/fi';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function AdminActivityLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch recent activities and filter for 'ADMIN' client-side to avoid index requirement.
    const q = query(
      collection(db, 'admin_activities'),
      orderBy('timestamp', 'desc'),
      limit(200)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const adminLogs = allLogs.filter((log: any) => log.actor === 'ADMIN');
      
      const formatted = adminLogs.map((log: any) => ({
        id: log.id,
        adminId: log.actorId || 'Unknown Admin',
        name: log.actorName || 'Admin',
        action: log.action || 'ACTION',
        target: log.targetId || 'N/A',
        details: log.details || '—',
        time: log.timestamp?.toDate().toLocaleString('en-IN') || new Date().toLocaleString('en-IN'),
      }));
      setLogs(formatted);
      setLoading(false);
    }, (error) => {
      console.error('Failed to fetch admin activity logs:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', padding: '24px', fontFamily: 'monospace' }}>
      <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>🛡️ Admin Activity Logs</h1>
      <p style={{ color: '#4b5563', fontSize: '13px', marginBottom: '24px' }}>Live audit trail of all staff and superadmin actions</p>
      
      <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead><tr style={{ borderBottom: '1px solid #1f2937' }}>
            {['Log ID', 'Admin Name', 'Action', 'Target Record', 'Details', 'Time'].map(h => (
              <th key={h} style={{ color: '#4b5563', fontWeight: 600, padding: '12px 14px', textAlign: 'left', fontSize: '11px' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Loading live admin audit logs...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#10b981' }}>No admin actions recorded recently.</td></tr>
            ) : logs.map((m, i) => (
              <tr key={m.id} style={{ borderBottom: '1px solid #1f293720' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1f2937')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '10px 14px', color: '#4b5563', fontSize: '11px' }}>{m.id.slice(0, 10)}...</td>
                <td style={{ padding: '10px 14px' }}><div style={{ color: '#e5e7eb' }}>{m.name}</div><div style={{ color: '#4b5563', fontSize: '10px' }}>{m.adminId}</div></td>
                <td style={{ padding: '10px 14px' }}><span style={{ background: '#f59e0b20', color: '#f59e0b', padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700 }}>{m.action}</span></td>
                <td style={{ padding: '10px 14px', color: '#00e5ff' }}>{m.target}</td>
                <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{m.details}</td>
                <td style={{ padding: '10px 14px', color: '#4b5563', fontSize: '11px', whiteSpace: 'nowrap' }}>{m.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
