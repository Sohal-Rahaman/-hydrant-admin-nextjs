'use client';
import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function AppVersionMonitor() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Query dev_app_versions
    const q = query(collection(db, 'dev_app_versions'), orderBy('timestamp', 'desc'), limit(100));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const liveLogs = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          version: data.version || 'Unknown',
          os: data.os || 'Unknown',
          device: data.device || 'Unknown',
          customerId: data.userId || 'Guest',
          time: data.timestamp?.toDate().toLocaleString('en-IN') || new Date().toLocaleString('en-IN'),
        };
      });
      setLogs(liveLogs);
      setLoading(false);
    }, (error) => {
      console.error('Failed to fetch app versions:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Compute version distribution
  const versionCounts = logs.reduce((acc, l) => {
    acc[l.version] = (acc[l.version] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topVersions = (Object.entries(versionCounts) as [string, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', padding: '24px', fontFamily: 'monospace' }}>
      <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>📱 App Version Monitor</h1>
      <p style={{ color: '#4b5563', fontSize: '13px', marginBottom: '24px' }}>Live tracking of active app versions installed across the user base</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {topVersions.map(([v, count], i) => (
          <div key={v} style={{ background: '#111827', border: `1px solid ${i === 0 ? '#10b981' : '#3b82f6'}30`, borderRadius: '10px', padding: '14px' }}>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>Version v{v}</div>
            <div style={{ color: i === 0 ? '#10b981' : '#3b82f6', fontSize: '22px', fontWeight: 800 }}>{count}</div>
          </div>
        ))}
        {topVersions.length === 0 && !loading && (
           <div style={{ background: '#111827', border: `1px solid #4b556330`, borderRadius: '10px', padding: '14px' }}>
             <div style={{ color: '#6b7280', fontSize: '11px' }}>No Data</div>
             <div style={{ color: '#94a3b8', fontSize: '22px', fontWeight: 800 }}>0</div>
           </div>
        )}
      </div>
      
      <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead><tr style={{ borderBottom: '1px solid #1f2937' }}>
            {['Log ID', 'User ID', 'Version', 'OS', 'Device', 'Last Seen'].map(h => (
              <th key={h} style={{ color: '#4b5563', fontWeight: 600, padding: '12px 14px', textAlign: 'left', fontSize: '11px' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Loading live version logs...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#10b981' }}>No app version logs recorded.</td></tr>
            ) : logs.map((m, i) => (
              <tr key={m.id + i} style={{ borderBottom: '1px solid #1f293720' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1f2937')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '10px 14px', color: '#4b5563', fontSize: '11px' }}>{m.id.slice(0, 10)}...</td>
                <td style={{ padding: '10px 14px', color: '#e5e7eb' }}>{m.customerId}</td>
                <td style={{ padding: '10px 14px' }}><span style={{ background: '#10b98120', color: '#10b981', padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700 }}>v{m.version}</span></td>
                <td style={{ padding: '10px 14px', color: '#00e5ff' }}>{m.os}</td>
                <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{m.device}</td>
                <td style={{ padding: '10px 14px', color: '#4b5563', fontSize: '11px', whiteSpace: 'nowrap' }}>{m.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
