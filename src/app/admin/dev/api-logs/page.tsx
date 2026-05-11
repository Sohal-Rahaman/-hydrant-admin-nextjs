'use client';
import { useState, useEffect } from 'react';
import { FiActivity, FiSearch, FiClock, FiDownload } from 'react-icons/fi';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const statusColor = (s: number) => s < 300 ? '#10b981' : s < 400 ? '#f59e0b' : '#ef4444';
const timeColor = (t: number) => t < 200 ? '#10b981' : t < 500 ? '#f59e0b' : '#ef4444';

export default function ApiLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [live, setLive] = useState(true);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!live) return;
    
    // Query dev_api_logs
    const q = query(
      collection(db, 'dev_api_logs'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const liveLogs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          api: data.endpoint || 'Unknown Endpoint',
          method: data.method || 'GET',
          responseTime: data.durationMs || 0,
          status: data.statusCode || 200,
          customerId: data.userId || 'Guest',
          timestamp: data.timestamp?.toDate().toLocaleString('en-IN') || new Date().toLocaleString('en-IN'),
          error: data.error || null,
        };
      });
      setLogs(liveLogs);
      setLoading(false);
    }, (error) => {
      console.error('Failed to fetch API logs:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [live]);

  const filtered = logs.filter(l =>
    (filter === 'all' || (filter === 'slow' && l.responseTime > 500) || (filter === 'failed' && l.status >= 400) || (filter === 'timeout' && l.status === 504)) &&
    (search === '' || l.api.includes(search) || l.customerId.includes(search))
  );

  return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', padding: '24px', fontFamily: 'monospace' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 800, margin: '0 0 4px' }}>🔗 API Log Monitor</h1>
          <p style={{ color: '#4b5563', fontSize: '13px', margin: 0 }}>Live backend function calls from dev_api_logs collection</p>
        </div>
        <button onClick={() => setLive(l => !l)}
          style={{ background: live ? '#10b98120' : '#ef444420', border: `1px solid ${live ? '#10b981' : '#ef4444'}`, borderRadius: '8px', padding: '8px 16px', color: live ? '#10b981' : '#ef4444', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FiActivity size={14} />
          {live ? 'LIVE ●' : 'PAUSED'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Total Calls Tracked', value: loading ? '...' : logs.length, color: '#3b82f6' },
          { label: 'Failed (4xx/5xx)', value: loading ? '...' : logs.filter(l => l.status >= 400).length, color: '#ef4444' },
          { label: 'Slow (>500ms)', value: loading ? '...' : logs.filter(l => l.responseTime > 500).length, color: '#f59e0b' },
          { label: 'Avg Response', value: loading || logs.length === 0 ? '...' : `${Math.floor(logs.reduce((a, l) => a + l.responseTime, 0) / logs.length)}ms`, color: '#10b981' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#111827', border: `1px solid ${s.color}30`, borderRadius: '10px', padding: '14px' }}>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>{s.label}</div>
            <div style={{ color: s.color, fontSize: '22px', fontWeight: 800 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#111827', border: '1px solid #1f2937', borderRadius: '8px', padding: '8px 12px', flex: 1 }}>
          <FiSearch size={14} color="#4b5563" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter by endpoint or customer..." style={{ background: 'none', border: 'none', outline: 'none', color: '#e5e7eb', fontSize: '13px', flex: 1 }} />
        </div>
        {['all', 'slow', 'failed', 'timeout'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ background: filter === f ? '#3b82f6' : '#111827', border: '1px solid #1f2937', borderRadius: '8px', padding: '8px 14px', color: filter === f ? '#fff' : '#94a3b8', fontSize: '12px', cursor: 'pointer', textTransform: 'capitalize' }}>
            {f}
          </button>
        ))}
        <button style={{ background: '#10b981', border: 'none', borderRadius: '8px', padding: '8px 16px', color: '#fff', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FiDownload size={14} /> Export CSV
        </button>
      </div>

      <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: '65vh', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#111827', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid #1f2937' }}>
                {['Time', 'Method', 'Endpoint', 'Status', 'Response Time', 'User ID', 'Error'].map(h => (
                  <th key={h} style={{ color: '#4b5563', fontWeight: 600, padding: '12px 14px', textAlign: 'left', whiteSpace: 'nowrap', fontSize: '11px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Loading live API logs...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#10b981' }}>No API calls recorded.</td></tr>
              ) : filtered.map((l, i) => (
                <tr key={l.id} style={{ borderBottom: '1px solid #1f293720', background: l.status >= 400 ? '#ef444408' : l.responseTime > 500 ? '#f59e0b08' : 'transparent' }}>
                  <td style={{ padding: '8px 14px', color: '#4b5563', whiteSpace: 'nowrap' }}><FiClock size={10} style={{ marginRight: '4px' }} />{l.timestamp}</td>
                  <td style={{ padding: '8px 14px' }}><span style={{ background: '#1f2937', padding: '2px 6px', borderRadius: '4px', color: '#00e5ff', fontSize: '10px' }}>{l.method}</span></td>
                  <td style={{ padding: '8px 14px', color: '#94a3b8', fontFamily: 'monospace' }}>{l.api}</td>
                  <td style={{ padding: '8px 14px' }}><span style={{ color: statusColor(l.status), fontWeight: 700 }}>{l.status}</span></td>
                  <td style={{ padding: '8px 14px' }}><span style={{ color: timeColor(l.responseTime), fontWeight: 600 }}>{l.responseTime}ms</span></td>
                  <td style={{ padding: '8px 14px', color: '#94a3b8' }}>{l.customerId}</td>
                  <td style={{ padding: '8px 14px', color: '#ef4444', fontSize: '11px' }}>{l.error || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
