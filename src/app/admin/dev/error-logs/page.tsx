'use client';
import { useState, useEffect } from 'react';
import { FiSearch, FiDownload } from 'react-icons/fi';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const severityColors: Record<string, string> = { Low: '#10b981', Medium: '#f59e0b', High: '#f97316', Critical: '#ef4444' };

export default function ErrorLogs() {
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('all');
  const [errors, setErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Query dev_error_logs
    const q = query(
      collection(db, 'dev_error_logs'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.type || 'System Error',
          message: data.message || 'Unknown error occurred',
          stack: data.stack || 'No stack trace available',
          endpoint: data.context?.functionName || data.context?.endpoint || '—',
          module: data.context?.module || '—',
          customerId: data.userId || '—',
          severity: data.severity || 'Medium',
          timestamp: data.timestamp?.toDate().toLocaleString('en-IN') || new Date().toLocaleString('en-IN'),
        };
      });
      setErrors(logs);
      setLoading(false);
    }, (error) => {
      console.error('Failed to fetch error logs:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filtered = errors.filter(e =>
    (severity === 'all' || e.severity === severity) &&
    (search === '' || e.message.toLowerCase().includes(search.toLowerCase()) || e.type.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', padding: '24px', fontFamily: 'monospace' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 800, margin: '0 0 4px' }}>⚡ Error Log System</h1>
        <p style={{ color: '#4b5563', fontSize: '13px', margin: 0 }}>Every app & system error captured with full context from Firebase backend</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {Object.entries(severityColors).map(([sev, color]) => (
          <div key={sev} style={{ background: '#111827', border: `1px solid ${color}30`, borderRadius: '10px', padding: '16px' }}>
            <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '4px' }}>{sev}</div>
            <div style={{ color, fontSize: '22px', fontWeight: 800 }}>{loading ? '...' : errors.filter(e => e.severity === sev).length}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#111827', border: '1px solid #1f2937', borderRadius: '8px', padding: '8px 12px', flex: 1 }}>
          <FiSearch size={14} color="#4b5563" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search errors, modules..." style={{ background: 'none', border: 'none', outline: 'none', color: '#e5e7eb', fontSize: '13px', flex: 1 }} />
        </div>
        <select value={severity} onChange={e => setSeverity(e.target.value)}
          style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '8px', padding: '8px 12px', color: '#e5e7eb', fontSize: '13px' }}>
          <option value="all">All Severity</option>
          {Object.keys(severityColors).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button style={{ background: '#3b82f6', border: 'none', borderRadius: '8px', padding: '8px 16px', color: '#fff', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FiDownload size={14} /> Export
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading ? (
          <div style={{ color: '#94a3b8', padding: '20px', textAlign: 'center' }}>Loading live error logs...</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: '#10b981', padding: '20px', textAlign: 'center' }}>No errors found. Everything is running smoothly!</div>
        ) : filtered.map((err, i) => (
          <div key={err.id} style={{ background: '#111827', border: `1px solid ${severityColors[err.severity] || '#4b5563'}30`, borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: `${severityColors[err.severity] || '#4b5563'}20`, color: severityColors[err.severity] || '#4b5563', padding: '2px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 700 }}>{err.severity}</span>
                <span style={{ background: '#1f2937', color: '#94a3b8', padding: '2px 10px', borderRadius: '20px', fontSize: '10px' }}>{err.type}</span>
                <code style={{ color: '#00e5ff', fontSize: '11px' }}>{err.id}</code>
              </div>
              <span style={{ color: '#4b5563', fontSize: '11px' }}>{err.timestamp}</span>
            </div>
            <div style={{ color: '#f87171', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>{err.message}</div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <span style={{ color: '#4b5563', fontSize: '11px' }}>📦 {err.module}</span>
              <span style={{ color: '#4b5563', fontSize: '11px' }}>🔗 {err.endpoint}</span>
              <span style={{ color: '#4b5563', fontSize: '11px' }}>👤 {err.customerId}</span>
            </div>
            <details>
              <summary style={{ color: '#6b7280', fontSize: '11px', cursor: 'pointer' }}>Stack Trace</summary>
              <pre style={{ color: '#4b5563', fontSize: '10px', marginTop: '6px', padding: '8px', background: '#0a0f1e', borderRadius: '6px', overflow: 'auto' }}>{err.stack}</pre>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}
