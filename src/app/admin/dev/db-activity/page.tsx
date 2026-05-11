'use client';
import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const opColors: Record<string, string> = { READ: '#3b82f6', WRITE: '#10b981', UPDATE: '#f59e0b', DELETE: '#ef4444' };

export default function DatabaseActivity() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Query dev_db_activity
    const q = query(
      collection(db, 'dev_db_activity'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const liveLogs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          collection: data.collectionName || 'Unknown',
          operation: data.operation || 'READ',
          docId: data.documentId || '—',
          size: data.sizeBytes ? `${(data.sizeBytes / 1024).toFixed(1)} KB` : '0 KB',
          latency: data.latencyMs ? `${data.latencyMs}ms` : '—',
          time: data.timestamp?.toDate().toLocaleString('en-IN') || new Date().toLocaleString('en-IN'),
        };
      });
      setLogs(liveLogs);
      setLoading(false);
    }, (error) => {
      console.error('Failed to fetch DB activity logs:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', padding: '24px', fontFamily: 'monospace' }}>
      <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>☁️ Database Activity</h1>
      <p style={{ color: '#4b5563', fontSize: '13px', marginBottom: '24px' }}>Live Firestore Reads, Writes, Updates, and Deletes tracking</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {Object.entries(opColors).map(([op, c]) => (
          <div key={op} style={{ background: '#111827', border: `1px solid ${c}30`, borderRadius: '10px', padding: '14px' }}>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>{op}s</div>
            <div style={{ color: c, fontSize: '22px', fontWeight: 800 }}>{loading ? '...' : logs.filter(m => m.operation === op).length}</div>
          </div>
        ))}
      </div>
      
      <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead><tr style={{ borderBottom: '1px solid #1f2937' }}>
            {['Time', 'Collection', 'Operation', 'Document ID', 'Payload Size', 'Latency'].map(h => (
              <th key={h} style={{ color: '#4b5563', fontWeight: 600, padding: '12px 14px', textAlign: 'left', fontSize: '11px' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Loading live database logs...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#10b981' }}>No database operations logged recently.</td></tr>
            ) : logs.map((m, i) => (
              <tr key={m.id + i} style={{ borderBottom: '1px solid #1f293720' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1f2937')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '10px 14px', color: '#4b5563', fontSize: '11px', whiteSpace: 'nowrap' }}>{m.time}</td>
                <td style={{ padding: '10px 14px', color: '#00e5ff' }}>{m.collection}</td>
                <td style={{ padding: '10px 14px' }}><span style={{ color: opColors[m.operation] || '#94a3b8', fontWeight: 800, fontSize: '11px' }}>{m.operation}</span></td>
                <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{m.docId}</td>
                <td style={{ padding: '10px 14px', color: '#e5e7eb' }}>{m.size}</td>
                <td style={{ padding: '10px 14px', color: '#10b981' }}>{m.latency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
